/**
 * Zenland SDK Client
 *
 * The main entry point for interacting with the Zenland indexer.
 */

import { createEscrowsDomain, type EscrowsDomain } from "./domains/escrows";
import { createAgentsDomain, type AgentsDomain } from "./domains/agents";
import { createProtocolStatsDomain, type ProtocolStatsDomain } from "./domains/protocol-stats";
import { createTransactionLogsDomain, type TransactionLogsDomain } from "./domains/transaction-logs";
import { ZENLAND_DEPLOYMENTS, type ZenlandDeployment } from "./rpc/deployments";
import type { ZenlandRpcStorage } from "./rpc/snapshot";
import { getChainSync } from "./rpc/sync";
import {
  createRpcAgentsDomain,
  createRpcEscrowsDomain,
  createRpcProtocolStatsDomain,
  createRpcTransactionLogsDomain,
} from "./rpc/domains";

/** Default production indexer URL */
const DEFAULT_BASE_URL = "https://api.zen.land";

export interface ZenlandRpcChainConfig {
  chainId: number;
  /** JSON-RPC endpoint for this chain */
  rpcUrl: string;
  /** Override contract addresses / start block (required for unknown chains) */
  deployment?: Partial<ZenlandDeployment>;
}

export interface ZenlandRpcConfig {
  /** Chains to read from. Order matters for lookups by address (first match wins). */
  chains: ZenlandRpcChainConfig[];
  /** Minimum time between two syncs per chain in ms (default 2000) */
  minSyncIntervalMs?: number;
  /** Blocks to stay behind the chain head (default 1) */
  blockLag?: number;
  /** Blocks after which events are final and get cached (default 64) */
  confirmations?: number;
  /**
   * Persist synced data so later sessions only fetch new blocks, e.g.
   * `window.localStorage`. Only confirmed blocks are stored.
   */
  storage?: ZenlandRpcStorage;
  /**
   * Endpoint serving snapshots from `client.rpc.snapshot()`, fetched with
   * `?chainId=` when `storage` is empty. Saves first-time visitors the full
   * history scan.
   */
  snapshotUrl?: string;
  /**
   * Answer the first reads with data restored from `storage` / `snapshotUrl`
   * immediately and sync in the background (default false). `subscribe`
   * fires when the background sync brings changes.
   */
  staleWhileRevalidate?: boolean;
}

export interface ZenlandRpcControls {
  /** Sync a chain, then return its confirmed state as an encoded snapshot (null if unknown) */
  snapshot(chainId: number): Promise<string | null>;
}

export interface ZenlandClientConfig {
  /** Base URL for the indexer API. Defaults to https://api.zen.land */
  baseUrl?: string;
  /**
   * Read data directly from the chain via RPC instead of the indexer.
   * When set, `baseUrl` is ignored.
   */
  rpc?: ZenlandRpcConfig;
}

export interface ZenlandClient {
  /** The base URL being used by this client (empty when reading from RPC) */
  readonly baseUrl: string;

  /** Escrow-related operations */
  readonly escrows: EscrowsDomain;

  /** Agent-related operations */
  readonly agents: AgentsDomain;

  /** Protocol statistics */
  readonly protocolStats: ProtocolStatsDomain;

  /** Transaction logs */
  readonly transactionLogs: TransactionLogsDomain;

  /**
   * Listen for data changes (RPC mode: a sync found new events). The
   * GraphQL client never calls the listener. Returns an unsubscribe function.
   */
  subscribe(listener: () => void): () => void;

  /** RPC mode only: snapshot export for serving `snapshotUrl` */
  readonly rpc?: ZenlandRpcControls;
}

/**
 * Create a new Zenland SDK client.
 *
 * @example
 * ```typescript
 * // Use production API (default)
 * const client = createZenlandClient();
 *
 * // Use custom endpoint (e.g., local development)
 * const client = createZenlandClient({ baseUrl: 'http://localhost:42069' });
 *
 * // Read directly from the chain (no indexer)
 * const client = createZenlandClient({
 *   rpc: { chains: [{ chainId: 1, rpcUrl: 'https://...' }] },
 * });
 *
 * // Fetch escrows
 * const { items, totalCount } = await client.escrows.list({ limit: 10 });
 *
 * // Fetch a specific escrow
 * const escrow = await client.escrows.getById('0x...');
 *
 * // Fetch agents
 * const agents = await client.agents.list({ onlyActive: true });
 *
 * // Fetch protocol stats
 * const stats = await client.protocolStats.get();
 * ```
 */
export function createZenlandClient(config?: ZenlandClientConfig): ZenlandClient {
  if (config?.rpc) {
    return createRpcClient(config.rpc);
  }

  const baseUrl = normalizeBaseUrl(config?.baseUrl ?? DEFAULT_BASE_URL);

  return {
    baseUrl,
    escrows: createEscrowsDomain(baseUrl),
    agents: createAgentsDomain(baseUrl),
    protocolStats: createProtocolStatsDomain(baseUrl),
    transactionLogs: createTransactionLogsDomain(baseUrl),
    subscribe: () => () => {},
  };
}

/**
 * Create a client that reads directly from the chain via RPC
 */
function createRpcClient(rpc: ZenlandRpcConfig): ZenlandClient {
  const syncers = rpc.chains.map((chain) => {
    const deployment = { ...ZENLAND_DEPLOYMENTS[chain.chainId], ...chain.deployment };
    if (!deployment.escrowFactory || !deployment.agentRegistry || deployment.startBlock === undefined) {
      throw new Error(`Zenland: no deployment known for chain ${chain.chainId}; pass \`deployment\`.`);
    }
    return getChainSync({
      chainId: chain.chainId,
      rpcUrl: chain.rpcUrl,
      deployment: deployment as ZenlandDeployment,
      minSyncIntervalMs: rpc.minSyncIntervalMs,
      blockLag: rpc.blockLag,
      confirmations: rpc.confirmations,
      storage: rpc.storage,
      snapshotUrl: rpc.snapshotUrl,
      staleWhileRevalidate: rpc.staleWhileRevalidate,
    });
  });

  return {
    baseUrl: "",
    escrows: createRpcEscrowsDomain(syncers),
    agents: createRpcAgentsDomain(syncers),
    protocolStats: createRpcProtocolStatsDomain(syncers),
    transactionLogs: createRpcTransactionLogsDomain(syncers),
    subscribe(listener) {
      const unsubscribes = syncers.map((s) => s.subscribe(listener));
      return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
    },
    rpc: {
      async snapshot(chainId) {
        const syncer = syncers.find((s) => s.chainId === chainId);
        return syncer ? syncer.snapshot() : null;
      },
    },
  };
}

/**
 * Normalize base URL by removing trailing slash
 */
function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/**
 * Default client instance using production API.
 * Use this for quick access without creating a new client.
 *
 * @example
 * ```typescript
 * import { zenland } from '@zenland/sdk';
 *
 * const escrows = await zenland.escrows.list();
 * ```
 */
export const zenland = createZenlandClient();
