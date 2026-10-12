/**
 * RPC-backed implementations of the SDK domains.
 *
 * They expose the same functions and return the same shapes as the GraphQL
 * domains (bigints serialized as decimal strings, lowercase addresses), so
 * consumers can switch data sources without code changes.
 */

import { STATE_GROUPS, type EscrowsDomain, type ListEscrowsArgs, type StateGroup } from "../domains/escrows";
import type { AgentsDomain, ListAgentsArgs } from "../domains/agents";
import type { ProtocolStats, ProtocolStatsDomain, GetProtocolStatsOptions } from "../domains/protocol-stats";
import type { ListTransactionLogsArgs, TransactionLogsDomain } from "../domains/transaction-logs";
import type {
  GqlAgent,
  GqlAgentCase,
  GqlAgentCasePage,
  GqlAgentPage,
  GqlEscrow,
  GqlEscrowPage,
  GqlPageInfo,
  GqlProtocolStats,
  GqlTransactionLog,
} from "../generated/types";
import type { ChainSync } from "./sync";
import { getStatsIdForChain, type ChainState } from "./store";

const DEFAULT_STATS_ID = "mainnet";

/** Convert bigint fields to strings, matching the GraphQL API output */
function serialize<T extends object>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = typeof value === "bigint" ? value.toString() : value;
  }
  return out;
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : 1;
  return (a as number | bigint) < (b as number | bigint) ? -1 : 1;
}

/** Sort rows by a field name, falling back to `id` for stable ordering */
function sortRows<T extends { id: string }>(rows: T[], orderBy: string, direction: "asc" | "desc"): T[] {
  const sign = direction === "desc" ? -1 : 1;
  return rows.sort((a, b) => {
    const primary = compareValues(
      (a as Record<string, unknown>)[orderBy],
      (b as Record<string, unknown>)[orderBy],
    );
    return primary !== 0 ? sign * primary : compareValues(a.id, b.id);
  });
}

function paginate<T>(rows: T[], limit: number, offset: number): { items: T[]; totalCount: number; pageInfo: GqlPageInfo } {
  return {
    items: rows.slice(offset, offset + limit),
    totalCount: rows.length,
    pageInfo: {
      hasNextPage: offset + limit < rows.length,
      hasPreviousPage: offset > 0,
    },
  };
}

/**
 * Sync all chains. A chain that fails to sync falls back to its last known
 * state; if it was never synced the error is surfaced to the caller.
 */
async function loadStates(syncers: ChainSync[]): Promise<ChainState[]> {
  const results = await Promise.allSettled(syncers.map((s) => s.sync()));
  return results.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    if (syncers[i].isSynced) return syncers[i].state;
    throw result.reason;
  });
}

export function createRpcEscrowsDomain(syncers: ChainSync[]): EscrowsDomain {
  async function list(args?: ListEscrowsArgs): Promise<GqlEscrowPage> {
    const states = await loadStates(syncers);
    const buyer = args?.buyer?.toLowerCase();
    const seller = args?.seller?.toLowerCase();
    const agent = args?.agent?.toLowerCase();
    const user = args?.user?.toLowerCase();
    const stateFilter =
      args?.states && args.states.length > 0 ? args.states : args?.state ? [args.state] : undefined;

    const rows = states
      .flatMap((s) => [...s.escrows.values()])
      .filter(
        (e) =>
          (!buyer || e.buyer === buyer) &&
          (!seller || e.seller === seller) &&
          (!agent || e.agent === agent) &&
          (!stateFilter || stateFilter.includes(e.state)) &&
          (!user || e.buyer === user || e.seller === user || e.agent === user),
      );

    sortRows(rows, args?.orderBy ?? "createdAt", args?.orderDirection ?? "desc");
    const page = paginate(rows, args?.limit ?? 30, args?.offset ?? 0);
    return { ...page, items: page.items.map((e) => serialize(e) as unknown as GqlEscrow) };
  }

  async function getById(id: string): Promise<GqlEscrow | null> {
    const states = await loadStates(syncers);
    const key = id.toLowerCase();
    for (const s of states) {
      const row = s.escrows.get(key);
      if (row) return serialize(row) as unknown as GqlEscrow;
    }
    return null;
  }

  async function getByUser(
    userAddress: string,
    args?: Omit<ListEscrowsArgs, "user" | "buyer" | "seller" | "agent">,
  ): Promise<GqlEscrowPage> {
    return list({ ...args, user: userAddress });
  }

  async function getByStateGroup(
    stateGroup: StateGroup,
    args?: Omit<ListEscrowsArgs, "state" | "states">,
  ): Promise<GqlEscrowPage> {
    return list({ ...args, states: [...STATE_GROUPS[stateGroup]] });
  }

  return { list, getById, getByUser, getByStateGroup };
}

export function createRpcAgentsDomain(syncers: ChainSync[]): AgentsDomain {
  async function list(args?: ListAgentsArgs): Promise<GqlAgentPage> {
    const states = await loadStates(syncers);
    const rows = states
      .flatMap((s) => [...s.agents.values()])
      .filter((a) => (!args?.onlyActive || a.isActive) && (!args?.onlyAvailable || a.isAvailable));

    sortRows(rows, args?.orderBy ?? "stablecoinStake", args?.orderDirection ?? "desc");
    const page = paginate(rows, args?.limit ?? 30, args?.offset ?? 0);
    return { ...page, items: page.items.map((a) => serialize(a) as unknown as GqlAgent) };
  }

  async function getById(id: string): Promise<GqlAgent | null> {
    const states = await loadStates(syncers);
    const key = id.toLowerCase();

    // Chains are checked in configured order (mainnet first by default)
    for (const s of states) {
      const row = s.agents.get(key);
      if (!row) continue;

      const cases = [...s.agentCases.values()].filter((c) => c.agent === key);
      sortRows(cases, "invitedAt", "desc");
      const page = paginate(cases, 5, 0);

      const casePage: GqlAgentCasePage = {
        ...page,
        items: page.items.map((c): GqlAgentCase => {
          const escrow = s.escrows.get(c.escrow);
          return {
            ...(serialize(c) as unknown as GqlAgentCase),
            escrowRef: escrow ? (serialize(escrow) as unknown as GqlEscrow) : null,
          };
        }),
      };

      return { ...(serialize(row) as unknown as GqlAgent), cases: casePage };
    }
    return null;
  }

  async function getAvailable(args?: Omit<ListAgentsArgs, "onlyActive" | "onlyAvailable">): Promise<GqlAgentPage> {
    return list({ ...args, onlyActive: true, onlyAvailable: true });
  }

  return { list, getById, getAvailable };
}

export function createRpcProtocolStatsDomain(syncers: ChainSync[]): ProtocolStatsDomain {
  async function load(options?: GetProtocolStatsOptions): Promise<ChainState | null> {
    const statsId = options?.statsId ?? DEFAULT_STATS_ID;
    const syncer = syncers.find((s) => getStatsIdForChain(s.chainId) === statsId);
    if (!syncer) return null;
    const [state] = await loadStates([syncer]);
    return state;
  }

  async function get(options?: GetProtocolStatsOptions): Promise<ProtocolStats | null> {
    const state = await load(options);
    if (!state) return null;

    const { stats } = state;
    const agentStakingTVL = [...state.agents.values()]
      .filter((a) => a.isActive)
      .reduce((sum, a) => sum + a.stablecoinStake, 0n);

    return {
      id: stats.id,
      chainId: stats.chainId,
      totalEscrowsCreated: stats.totalEscrowsCreated,
      totalVolumeEscrowed: stats.totalVolumeEscrowed,
      totalFeesCollected: stats.totalFeesCollected,
      currentTVL: stats.currentTVL + agentStakingTVL,
      escrowTVL: stats.currentTVL,
      agentStakingTVL,
      activeEscrowCount: stats.activeEscrowCount,
      totalAgentsRegistered: stats.totalAgentsRegistered,
      activeAgentsCount: stats.activeAgentsCount,
    };
  }

  async function getRaw(options?: GetProtocolStatsOptions): Promise<GqlProtocolStats | null> {
    const state = await load(options);
    return state ? (serialize(state.stats) as unknown as GqlProtocolStats) : null;
  }

  return { get, getRaw };
}

export function createRpcTransactionLogsDomain(syncers: ChainSync[]): TransactionLogsDomain {
  async function list(args?: ListTransactionLogsArgs): Promise<GqlTransactionLog[]> {
    const states = await loadStates(syncers);
    const escrowAddress = args?.escrowAddress?.toLowerCase();

    const rows = states
      .flatMap((s) => s.logs)
      .filter((log) => !escrowAddress || log.escrowAddress === escrowAddress);

    // Keep onchain order for logs sharing a timestamp (same block)
    const orderBy = args?.orderBy ?? "timestamp";
    const sign = (args?.orderDirection ?? "asc") === "desc" ? -1 : 1;
    rows.sort((a, b) => {
      const primary = compareValues(
        (a as unknown as Record<string, unknown>)[orderBy],
        (b as unknown as Record<string, unknown>)[orderBy],
      );
      if (primary !== 0) return sign * primary;
      const block = compareValues(a.blockNumber, b.blockNumber);
      return sign * (block !== 0 ? block : a.logIndex - b.logIndex);
    });

    const offset = args?.offset ?? 0;
    return rows.slice(offset, offset + (args?.limit ?? 100)).map(({ logIndex: _logIndex, ...log }) => {
      return serialize(log) as unknown as GqlTransactionLog;
    });
  }

  async function getByEscrow(
    escrowAddress: string,
    args?: Omit<ListTransactionLogsArgs, "escrowAddress">,
  ): Promise<GqlTransactionLog[]> {
    return list({ ...args, escrowAddress });
  }

  function parseEventData(eventData: string): Record<string, unknown> {
    try {
      return JSON.parse(eventData);
    } catch {
      return {};
    }
  }

  return { list, getByEscrow, parseEventData };
}
