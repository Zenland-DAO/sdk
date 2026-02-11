"use client";

import { useQuery } from "@tanstack/react-query";
import { useZenlandClientOptional } from "../context";
import type { ProtocolStats } from "../../domains/protocol-stats";

export interface UseProtocolStatsOptions {
  /** Whether to enable the query */
  enabled?: boolean;
  /** Stale time in milliseconds (default: 30s) */
  staleTime?: number;
  /** Refetch interval in milliseconds (default: 60s) */
  refetchInterval?: number;
}

/**
 * Hook to fetch global protocol statistics.
 *
 * @example
 * ```tsx
 * import { useProtocolStats } from '@zenland/sdk/react';
 *
 * function ProtocolOverview() {
 *   const { data: stats, isLoading } = useProtocolStats();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!stats) return <div>Stats not available</div>;
 *
 *   return (
 *     <div>
 *       <p>Total Escrows: {stats.totalEscrowsCreated}</p>
 *       <p>TVL: {stats.currentTVL.toString()}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useProtocolStats(options?: UseProtocolStatsOptions) {
  const client = useZenlandClientOptional();

  return useQuery<ProtocolStats | null>({
    queryKey: ["zenland", "protocolStats"],
    queryFn: () => client.protocolStats.get(),
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 30 * 1000, // 30 seconds
    refetchInterval: options?.refetchInterval ?? 60 * 1000, // 1 minute
  });
}

export type { ProtocolStats };
