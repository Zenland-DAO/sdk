/**
 * Protocol Stats domain module for the Zenland SDK
 * 
 * Stats are tracked per-chain. By default, mainnet stats are returned
 * for production UI. Use chainId parameter to query other networks.
 */

import { graphqlRequest } from "../request";
import { PROTOCOL_STATS_QUERY } from "../queries";
import type { GqlProtocolStats, ProtocolStatsQueryResponse } from "../generated/types";

/** Default stats ID for production (Ethereum mainnet) */
const DEFAULT_STATS_ID = "mainnet";

/** Normalized protocol stats with BigInt values */
export interface ProtocolStats {
  id: string;
  chainId?: number;
  totalEscrowsCreated: number;
  totalVolumeEscrowed: bigint;
  totalFeesCollected: bigint;
  /** True TVL = escrowTVL + agentStakingTVL */
  currentTVL: bigint;
  /** TVL held in active escrow contracts only */
  escrowTVL: bigint;
  /** TVL held as agent stablecoin collateral in the registry */
  agentStakingTVL: bigint;
  activeEscrowCount: number;
  totalAgentsRegistered: number;
  activeAgentsCount: number;
}

/**
 * Convert raw GraphQL response to normalized ProtocolStats
 */
function normalizeProtocolStats(
  raw: GqlProtocolStats,
  activeAgents: Array<{ stablecoinStake: string | number | bigint }>,
): ProtocolStats {
  const escrowTVL = BigInt(raw.currentTVL);
  const agentStakingTVL = activeAgents.reduce(
    (sum, a) => sum + BigInt(a.stablecoinStake),
    0n,
  );
  return {
    id: raw.id,
    chainId: (raw as any).chainId,
    totalEscrowsCreated: raw.totalEscrowsCreated,
    totalVolumeEscrowed: BigInt(raw.totalVolumeEscrowed),
    totalFeesCollected: BigInt(raw.totalFeesCollected),
    currentTVL: escrowTVL + agentStakingTVL,
    escrowTVL,
    agentStakingTVL,
    activeEscrowCount: raw.activeEscrowCount,
    totalAgentsRegistered: raw.totalAgentsRegistered,
    activeAgentsCount: raw.activeAgentsCount,
  };
}

export interface GetProtocolStatsOptions {
  /** 
   * Stats ID to query. Defaults to "mainnet".
   * Use "sepolia" for testnet stats.
   */
  statsId?: string;
}

/**
 * Creates protocol stats domain functions bound to a base URL
 */
export function createProtocolStatsDomain(baseUrl: string) {
  /**
   * Fetch protocol statistics for a specific chain.
   * Defaults to mainnet for production use.
   * 
   * @param options - Optional parameters
   * @param options.statsId - Stats ID to query (default: "mainnet")
   */
  async function get(options?: GetProtocolStatsOptions): Promise<ProtocolStats | null> {
    const variables = { id: options?.statsId ?? DEFAULT_STATS_ID };

    const response = await graphqlRequest<ProtocolStatsQueryResponse, typeof variables>(
      baseUrl,
      PROTOCOL_STATS_QUERY,
      variables,
    );

    if (!response.protocolStats) {
      return null;
    }

    return normalizeProtocolStats(response.protocolStats, response.agents?.items ?? []);
  }

  /**
   * Fetch raw protocol statistics (without BigInt conversion)
   * 
   * @param options - Optional parameters
   * @param options.statsId - Stats ID to query (default: "mainnet")
   */
  async function getRaw(options?: GetProtocolStatsOptions): Promise<GqlProtocolStats | null> {
    const variables = { id: options?.statsId ?? DEFAULT_STATS_ID };

    const response = await graphqlRequest<ProtocolStatsQueryResponse, typeof variables>(
      baseUrl,
      PROTOCOL_STATS_QUERY,
      variables,
    );

    return response.protocolStats;
  }

  return {
    get,
    getRaw,
  };
}

export type ProtocolStatsDomain = ReturnType<typeof createProtocolStatsDomain>;
