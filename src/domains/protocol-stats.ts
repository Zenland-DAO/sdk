/**
 * Protocol Stats domain module for the Zenland SDK
 */

import { graphqlRequest } from "../request";
import { PROTOCOL_STATS_QUERY } from "../queries";
import type { GqlProtocolStats, ProtocolStatsQueryResponse } from "../generated/types";

/** Normalized protocol stats with BigInt values */
export interface ProtocolStats {
  id: string;
  totalEscrowsCreated: number;
  totalVolumeEscrowed: bigint;
  totalFeesCollected: bigint;
  currentTVL: bigint;
  activeEscrowCount: number;
  totalAgentsRegistered: number;
  activeAgentsCount: number;
}

/**
 * Convert raw GraphQL response to normalized ProtocolStats
 */
function normalizeProtocolStats(raw: GqlProtocolStats): ProtocolStats {
  return {
    id: raw.id,
    totalEscrowsCreated: raw.totalEscrowsCreated,
    totalVolumeEscrowed: BigInt(raw.totalVolumeEscrowed),
    totalFeesCollected: BigInt(raw.totalFeesCollected),
    currentTVL: BigInt(raw.currentTVL),
    activeEscrowCount: raw.activeEscrowCount,
    totalAgentsRegistered: raw.totalAgentsRegistered,
    activeAgentsCount: raw.activeAgentsCount,
  };
}

/**
 * Creates protocol stats domain functions bound to a base URL
 */
export function createProtocolStatsDomain(baseUrl: string) {
  /**
   * Fetch global protocol statistics
   */
  async function get(): Promise<ProtocolStats | null> {
    const variables = { id: "global" };

    const response = await graphqlRequest<ProtocolStatsQueryResponse, typeof variables>(
      baseUrl,
      PROTOCOL_STATS_QUERY,
      variables,
    );

    if (!response.protocolStats) {
      return null;
    }

    return normalizeProtocolStats(response.protocolStats);
  }

  /**
   * Fetch raw protocol statistics (without BigInt conversion)
   */
  async function getRaw(): Promise<GqlProtocolStats | null> {
    const variables = { id: "global" };

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
