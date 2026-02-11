"use client";

import { useQuery } from "@tanstack/react-query";
import { useZenlandClientOptional } from "../context";
import { STATE_GROUPS, type StateGroup } from "../../domains/escrows";
import type { GqlEscrowPage } from "../../generated/types";

export type EscrowRole = "all" | "buyer" | "seller" | "agent";
export type EscrowStateTab = "all" | StateGroup;

export interface UseEscrowsArgs {
  /** User address to filter by */
  address?: string;
  /** Pagination limit */
  limit?: number;
  /** Pagination offset */
  offset?: number;
  /** Filter by role (requires address) */
  role?: EscrowRole;
  /** Filter by state group */
  stateTab?: EscrowStateTab;
  /** Filter by specific state */
  state?: string;
  /** Filter by multiple states */
  states?: string[];
  /** Whether to enable the query */
  enabled?: boolean;
}

/**
 * Hook to fetch escrows with filtering and pagination.
 *
 * @example
 * ```tsx
 * import { useEscrows } from '@zenland/sdk/react';
 *
 * function MyEscrows({ address }: { address: string }) {
 *   const { data, isLoading } = useEscrows({
 *     address,
 *     role: 'buyer',
 *     stateTab: 'ACTIVE',
 *   });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <ul>
 *       {data?.items.map(escrow => (
 *         <li key={escrow.id}>{escrow.state}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useEscrows(args?: UseEscrowsArgs) {
  const client = useZenlandClientOptional();
  const { address, role = "all", stateTab, enabled = true } = args ?? {};

  // Determine states to filter based on stateTab
  const getStatesFromTab = (): string[] | undefined => {
    if (!stateTab || stateTab === "all") {
      return args?.states;
    }
    return [...STATE_GROUPS[stateTab]];
  };

  return useQuery<GqlEscrowPage>({
    queryKey: ["zenland", "escrows", address, role, stateTab, args?.state, args?.states, args?.limit, args?.offset],
    queryFn: async () => {
      if (!address) {
        return { items: [], totalCount: 0, pageInfo: { hasNextPage: false, hasPreviousPage: false } };
      }

      const states = getStatesFromTab();

      return client.escrows.list({
        limit: args?.limit,
        offset: args?.offset,
        buyer: role === "buyer" ? address : undefined,
        seller: role === "seller" ? address : undefined,
        agent: role === "agent" ? address : undefined,
        user: role === "all" ? address : undefined,
        state: args?.state,
        states,
      });
    },
    enabled: !!address && enabled,
  });
}

// Re-export for convenience
export { STATE_GROUPS } from "../../domains/escrows";
