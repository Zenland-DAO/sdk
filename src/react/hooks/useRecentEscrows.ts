"use client";

import { useQuery } from "@tanstack/react-query";
import { useZenlandClientOptional } from "../context";
import type { GqlEscrow } from "../../generated/types";

export interface UseRecentEscrowsOptions {
  /** Number of escrows to fetch (default: 5) */
  limit?: number;
  /** Whether to enable the query */
  enabled?: boolean;
  /** Stale time in milliseconds (default: 15s) */
  staleTime?: number;
  /** Refetch interval in milliseconds (default: 30s) */
  refetchInterval?: number;
}

/**
 * Hook to fetch recent escrows for activity feeds.
 *
 * @example
 * ```tsx
 * import { useRecentEscrows } from '@zenland/sdk/react';
 *
 * function ActivityFeed() {
 *   const { data: escrows, isLoading } = useRecentEscrows({ limit: 10 });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <ul>
 *       {escrows?.map(escrow => (
 *         <li key={escrow.id}>
 *           {escrow.state} - {escrow.amount}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useRecentEscrows(options?: UseRecentEscrowsOptions) {
  const client = useZenlandClientOptional();
  const limit = options?.limit ?? 5;

  return useQuery<GqlEscrow[]>({
    queryKey: ["zenland", "recentEscrows", limit],
    queryFn: async () => {
      const result = await client.escrows.list({
        limit,
        orderBy: "createdAt",
        orderDirection: "desc",
      });
      return result.items;
    },
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 15 * 1000, // 15 seconds
    refetchInterval: options?.refetchInterval ?? 30 * 1000, // 30 seconds
  });
}
