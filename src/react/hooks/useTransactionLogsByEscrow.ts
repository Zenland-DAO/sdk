"use client";

import { useQuery } from "@tanstack/react-query";
import { useZenlandClientOptional } from "../context";
import type { GqlTransactionLog } from "../../generated/types";
import type { ListTransactionLogsArgs } from "../../domains/transaction-logs";

export interface UseTransactionLogsByEscrowOptions {
  /** Whether to enable the query */
  enabled?: boolean;
  /** Stale time in milliseconds (default: 30s) */
  staleTime?: number;
  /** Refetch interval in milliseconds */
  refetchInterval?: number;
  /** Transaction log list options */
  list?: Omit<ListTransactionLogsArgs, "escrowAddress">;
}

/**
 * Hook to fetch transaction logs for a specific escrow.
 */
export function useTransactionLogsByEscrow(
  escrowAddress: string | undefined | null,
  options?: UseTransactionLogsByEscrowOptions,
) {
  const client = useZenlandClientOptional();
  const addr = escrowAddress?.toLowerCase();

  return useQuery<GqlTransactionLog[]>({
    queryKey: [
      "zenland",
      "transactionLogs",
      "escrow",
      addr,
      options?.list?.limit,
      options?.list?.offset,
      options?.list?.orderBy,
      options?.list?.orderDirection,
    ],
    queryFn: async () => {
      if (!addr) return [];
      return client.transactionLogs.getByEscrow(addr, options?.list);
    },
    enabled: !!addr && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 30_000,
    refetchInterval: options?.refetchInterval,
    refetchOnWindowFocus: false,
  });
}
