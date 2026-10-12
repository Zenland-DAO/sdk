/**
 * RPC sync engine.
 *
 * Fetches protocol events with `eth_getLogs` and replays them into an
 * in-memory `ChainState`. The first sync scans from the deployment block;
 * later syncs only fetch new blocks. Syncs are de-duplicated and throttled so
 * many hooks rendering at once trigger a single round of RPC calls.
 */

import {
  createPublicClient,
  decodeEventLog,
  http,
  toHex,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { agentRegistryEventsAbi, escrowFactoryEventsAbi, escrowInstanceAbi } from "./abis";
import type { ZenlandDeployment } from "./deployments";
import {
  applyEvent,
  createChainState,
  type ChainEvent,
  type ChainState,
  type ContractType,
  type EscrowImmutables,
} from "./store";

/** Multicall3 is deployed at the same address on all supported chains */
const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

/** Max escrow addresses per eth_getLogs request */
const ADDRESS_CHUNK_SIZE = 250;

/** Below this block range, a failing eth_getLogs is not split further */
const MIN_SPLIT_RANGE = 1_000n;

/** Provider errors that mean "query too large, try a smaller range" */
const RANGE_ERROR_PATTERN =
  /range|limit|too many|exceed|more than|too large|response size|max results|timeout/i;

interface RpcLog {
  address: Hex;
  topics: [Hex, ...Hex[]] | [];
  data: Hex;
  blockNumber: Hex;
  /** Returned by most providers; fetched separately when missing */
  blockTimestamp?: Hex;
  transactionHash: Hex;
  logIndex: Hex;
  removed?: boolean;
}

export interface ChainSyncConfig {
  chainId: number;
  rpcUrl: string;
  deployment: ZenlandDeployment;
  /** Minimum time between two syncs (default 2s) */
  minSyncIntervalMs?: number;
  /**
   * Blocks to stay behind the head (default 1). Load-balanced RPCs may report
   * a head block that the node serving eth_getLogs has not seen yet.
   */
  blockLag?: number;
}

export interface ChainSync {
  readonly chainId: number;
  /** Bring the state up to the latest block and return it */
  sync(): Promise<ChainState>;
  /** Current state (may be stale or empty if never synced) */
  readonly state: ChainState;
  /** Whether at least one sync has completed */
  readonly isSynced: boolean;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function createChainSync(config: ChainSyncConfig): ChainSync {
  const { chainId, deployment } = config;
  const minSyncIntervalMs = config.minSyncIntervalMs ?? 2_000;
  const blockLag = BigInt(config.blockLag ?? 1);
  const factoryAddress = deployment.escrowFactory.toLowerCase();
  const registryAddress = deployment.agentRegistry.toLowerCase();

  const client: PublicClient = createPublicClient({ transport: http(config.rpcUrl) });

  const state = createChainState(chainId);
  const knownEscrows: string[] = [];
  let lastBlock: bigint | null = null;
  let lastSyncAt = 0;
  let inflight: Promise<ChainState> | null = null;

  /**
   * eth_getLogs that halves the block range when the provider rejects it.
   */
  async function getLogs(
    address: string | string[],
    fromBlock: bigint,
    toBlock: bigint,
  ): Promise<RpcLog[]> {
    try {
      const logs = (await client.request({
        method: "eth_getLogs",
        params: [
          {
            address: address as Address | Address[],
            fromBlock: toHex(fromBlock),
            toBlock: toHex(toBlock),
          },
        ],
      })) as unknown as RpcLog[];
      return logs.filter((log) => !log.removed);
    } catch (err) {
      const message = err instanceof Error ? `${err.message} ${(err as { details?: string }).details ?? ""}` : "";
      if (toBlock - fromBlock < MIN_SPLIT_RANGE || !RANGE_ERROR_PATTERN.test(message)) throw err;
      const mid = (fromBlock + toBlock) / 2n;
      const [left, right] = await Promise.all([
        getLogs(address, fromBlock, mid),
        getLogs(address, mid + 1n, toBlock),
      ]);
      return [...left, ...right];
    }
  }

  function decode(logs: RpcLog[], abi: Abi, contractType: ContractType): ChainEvent[] {
    const events: ChainEvent[] = [];
    for (const log of logs) {
      try {
        const decoded = decodeEventLog({ abi, data: log.data, topics: log.topics });
        events.push({
          contractType,
          eventName: String(decoded.eventName),
          args: decoded.args as unknown as Record<string, unknown>,
          address: log.address.toLowerCase(),
          txHash: log.transactionHash.toLowerCase(),
          blockNumber: BigInt(log.blockNumber),
          logIndex: Number(log.logIndex),
          timestamp: log.blockTimestamp ? BigInt(log.blockTimestamp) : -1n,
        });
      } catch {
        // Unknown event signature (not part of the ABI) - ignore
      }
    }
    return events;
  }

  /** Fill timestamps for providers that don't return `blockTimestamp` */
  async function fillMissingTimestamps(events: ChainEvent[]): Promise<void> {
    const missing = [...new Set(events.filter((e) => e.timestamp < 0n).map((e) => e.blockNumber))];
    if (missing.length === 0) return;
    const blocks = await Promise.all(missing.map((blockNumber) => client.getBlock({ blockNumber })));
    const byNumber = new Map(blocks.map((b) => [b.number, b.timestamp]));
    for (const event of events) {
      if (event.timestamp < 0n) event.timestamp = byNumber.get(event.blockNumber) ?? 0n;
    }
  }

  /** Read escrow params that are not included in EscrowCreated */
  async function readImmutables(escrows: string[]): Promise<Map<string, EscrowImmutables>> {
    const result = new Map<string, EscrowImmutables>();
    if (escrows.length === 0) return result;

    const functionNames = ["buyerProtectionTime", "termsHash", "sellerAcceptDeadline"] as const;
    const values = await client.multicall({
      multicallAddress: MULTICALL3_ADDRESS,
      allowFailure: false,
      batchSize: 32_768,
      contracts: escrows.flatMap((address) =>
        functionNames.map((functionName) => ({
          address: address as Address,
          abi: escrowInstanceAbi,
          functionName,
        })),
      ),
    });

    escrows.forEach((address, i) => {
      result.set(address, {
        buyerProtectionTime: values[i * 3] as bigint,
        termsHash: values[i * 3 + 1] as string,
        sellerAcceptDeadline: values[i * 3 + 2] as bigint,
      });
    });
    return result;
  }

  async function runSync(): Promise<ChainState> {
    const latest = (await client.getBlockNumber({ cacheTime: 0 })) - blockLag;
    const fromBlock = lastBlock === null ? deployment.startBlock : lastBlock + 1n;
    if (fromBlock > latest) return state;

    // One eth_getLogs (per chunk) for factory + registry + known escrows.
    const addresses = [factoryAddress, registryAddress, ...knownEscrows];
    const logs = (
      await Promise.all(chunk(addresses, ADDRESS_CHUNK_SIZE).map((c) => getLogs(c, fromBlock, latest)))
    ).flat();

    const factoryEvents = decode(
      logs.filter((log) => log.address.toLowerCase() === factoryAddress),
      escrowFactoryEventsAbi as Abi,
      "FACTORY",
    );
    const createdEscrows = factoryEvents
      .filter((e) => e.eventName === "EscrowCreated")
      .map((e) => String(e.args.escrow).toLowerCase());

    // Escrows created in this range only have logs from this range onwards,
    // so one extra [fromBlock, latest] scan covers them.
    const [newEscrowLogChunks, immutables] = await Promise.all([
      Promise.all(chunk(createdEscrows, ADDRESS_CHUNK_SIZE).map((c) => getLogs(c, fromBlock, latest))),
      readImmutables(createdEscrows),
    ]);

    const events = [
      ...factoryEvents,
      ...decode(
        logs.filter((log) => log.address.toLowerCase() === registryAddress),
        agentRegistryEventsAbi as Abi,
        "AGENT_REGISTRY",
      ),
      ...decode(
        [
          ...logs.filter((log) => {
            const address = log.address.toLowerCase();
            return address !== factoryAddress && address !== registryAddress;
          }),
          ...newEscrowLogChunks.flat(),
        ],
        escrowInstanceAbi as Abi,
        "ESCROW",
      ),
    ];
    await fillMissingTimestamps(events);

    // Everything fetched successfully - now mutate state.
    events.sort((a, b) =>
      a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1,
    );
    for (const event of events) applyEvent(state, event, immutables);

    knownEscrows.push(...createdEscrows);
    lastBlock = latest;
    return state;
  }

  function sync(): Promise<ChainState> {
    if (inflight) return inflight;
    if (lastBlock !== null && Date.now() - lastSyncAt < minSyncIntervalMs) {
      return Promise.resolve(state);
    }
    inflight = runSync()
      .then((result) => {
        lastSyncAt = Date.now();
        return result;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  }

  return {
    chainId,
    sync,
    state,
    get isSynced() {
      return lastBlock !== null;
    },
  };
}

/** Shared syncers so multiple clients with the same config share one cache */
const syncCache = new Map<string, ChainSync>();

export function getChainSync(config: ChainSyncConfig): ChainSync {
  const key = `${config.chainId}:${config.rpcUrl}:${config.deployment.escrowFactory.toLowerCase()}`;
  let syncer = syncCache.get(key);
  if (!syncer) {
    syncer = createChainSync(config);
    syncCache.set(key, syncer);
  }
  return syncer;
}
