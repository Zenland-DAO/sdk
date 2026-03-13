"use client";

import { useQuery } from "@tanstack/react-query";
import { useZenlandClientOptional } from "../context";
import type { GqlAgentPage } from "../../generated/types";

export interface UseAgentsArgs {
  /** Only return active agents */
  onlyActive?: boolean;
  /** Only return available agents */
  onlyAvailable?: boolean;
  /** Pagination limit */
  limit?: number;
  /** Pagination offset */
  offset?: number;
  /** Field to order by (e.g. "stablecoinStake", "totalResolved", "disputeFeeBps", "totalEscrowsAssigned") */
  orderBy?: string;
  /** Order direction */
  orderDirection?: "asc" | "desc";
  /** Whether to enable the query */
  enabled?: boolean;
}

/**
 * Hook to fetch agents with filtering and pagination.
 *
 * @example
 * ```tsx
 * import { useAgents } from '@zenland/sdk/react';
 *
 * function AgentList() {
 *   const { data, isLoading } = useAgents({ onlyActive: true });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <ul>
 *       {data?.items.map(agent => (
 *         <li key={agent.id}>{agent.description}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useAgents(args?: UseAgentsArgs) {
  const client = useZenlandClientOptional();
  const { enabled = true, ...filterArgs } = args ?? {};

  return useQuery<GqlAgentPage>({
    queryKey: ["zenland", "agents", filterArgs.onlyActive, filterArgs.onlyAvailable, filterArgs.limit, filterArgs.offset, filterArgs.orderBy, filterArgs.orderDirection],
    queryFn: () => client.agents.list(filterArgs),
    enabled,
  });
}
