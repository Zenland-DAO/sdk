"use client";

import { useQuery } from "@tanstack/react-query";
import { useZenlandClientOptional } from "../context";
import type { GqlEscrow } from "../../generated/types";

export interface UseEscrowOptions {
  /** Whether to enable the query */
  enabled?: boolean;
}

/**
 * Hook to fetch a single escrow by ID.
 *
 * @example
 * ```tsx
 * import { useEscrow } from '@zenland/sdk/react';
 *
 * function EscrowDetail({ id }: { id: string }) {
 *   const { data: escrow, isLoading, error } = useEscrow(id);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!escrow) return <div>Escrow not found</div>;
 *
 *   return <div>{escrow.state}</div>;
 * }
 * ```
 */
export function useEscrow(id: string | undefined, options?: UseEscrowOptions) {
  const client = useZenlandClientOptional();

  return useQuery<GqlEscrow | null>({
    queryKey: ["zenland", "escrow", id],
    queryFn: () => {
      if (!id) return null;
      return client.escrows.getById(id);
    },
    enabled: !!id && (options?.enabled ?? true),
  });
}
