"use client";

import { useQuery } from "@tanstack/react-query";
import { useZenlandClientOptional } from "../context";
import { STATE_GROUPS } from "../../domains/escrows";
import type { GqlEscrow, ZenlandClient } from "../../index";

/** State groups for categorization */
const ACTIVE_STATES = STATE_GROUPS.ACTIVE;
const DISPUTE_STATES = STATE_GROUPS.IN_DISPUTE;
const COMPLETED_STATES = STATE_GROUPS.COMPLETED;
const TVL_STATES = [...ACTIVE_STATES, ...DISPUTE_STATES] as const;

export interface UserDashboardStats {
  activeCount: number;
  disputeCount: number;
  completedCount: number;
  tvl: bigint;
  recentEscrows: GqlEscrow[];
}

/**
 * Fetch count of escrows for a user filtered by states.
 */
async function fetchUserEscrowCount(
  client: ZenlandClient,
  userAddress: string,
  states: readonly string[],
): Promise<number> {
  const userLower = userAddress.toLowerCase();

  const result = await client.escrows.list({
    limit: 1,
    user: userLower,
    states: [...states],
  });

  return result.totalCount;
}

/**
 * Fetch user's escrows that contribute to TVL and calculate sum.
 */
async function fetchUserTVL(client: ZenlandClient, userAddress: string): Promise<bigint> {
  const userLower = userAddress.toLowerCase();

  const result = await client.escrows.list({
    limit: 1000,
    user: userLower,
    states: [...TVL_STATES],
  });

  return result.items.reduce((sum, escrow) => sum + BigInt(escrow.amount), BigInt(0));
}

/**
 * Fetch user's recent escrows for dashboard display.
 */
async function fetchUserRecentEscrows(
  client: ZenlandClient,
  userAddress: string,
  limit: number = 5,
): Promise<GqlEscrow[]> {
  const userLower = userAddress.toLowerCase();

  const result = await client.escrows.list({
    limit,
    user: userLower,
  });

  return result.items;
}

/**
 * Fetch all user dashboard stats in parallel.
 */
async function getUserDashboardStats(
  client: ZenlandClient,
  userAddress: string,
): Promise<UserDashboardStats> {
  const [activeCount, disputeCount, completedCount, tvl, recentEscrows] = await Promise.all([
    fetchUserEscrowCount(client, userAddress, ACTIVE_STATES),
    fetchUserEscrowCount(client, userAddress, DISPUTE_STATES),
    fetchUserEscrowCount(client, userAddress, COMPLETED_STATES),
    fetchUserTVL(client, userAddress),
    fetchUserRecentEscrows(client, userAddress, 5),
  ]);

  return {
    activeCount,
    disputeCount,
    completedCount,
    tvl,
    recentEscrows,
  };
}

/**
 * Fetch global dashboard stats.
 */
async function getGlobalDashboardStats(
  client: ZenlandClient,
): Promise<Omit<UserDashboardStats, "tvl"> & { tvl: null }> {
  const [activeCount, disputeCount, completedCount, recentEscrows] = await Promise.all([
    fetchGlobalEscrowCount(client, [...ACTIVE_STATES]),
    fetchGlobalEscrowCount(client, [...DISPUTE_STATES]),
    fetchGlobalEscrowCount(client, [...COMPLETED_STATES]),
    fetchGlobalRecentEscrows(client, 5),
  ]);

  return {
    activeCount,
    disputeCount,
    completedCount,
    tvl: null,
    recentEscrows,
  };
}

async function fetchGlobalEscrowCount(client: ZenlandClient, states: string[]): Promise<number> {
  const result = await client.escrows.list({
    limit: 1,
    states,
  });
  return result.totalCount;
}

async function fetchGlobalRecentEscrows(client: ZenlandClient, limit: number = 5): Promise<GqlEscrow[]> {
  const result = await client.escrows.list({ limit });
  return result.items;
}

/**
 * Hook to fetch user-specific dashboard statistics.
 */
export function useUserStats(userAddress: string | undefined) {
  const client = useZenlandClientOptional();
  return useQuery<UserDashboardStats | null>({
    queryKey: ["zenland", "userStats", userAddress],
    queryFn: async () => {
      if (!userAddress) return null;
      return getUserDashboardStats(client, userAddress);
    },
    enabled: !!userAddress,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
}

/**
 * Hook to fetch global dashboard statistics.
 */
export function useGlobalStats() {
  const client = useZenlandClientOptional();
  return useQuery({
    queryKey: ["zenland", "globalStats"],
    queryFn: () => getGlobalDashboardStats(client),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
