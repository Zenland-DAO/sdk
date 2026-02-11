"use client";

import { useQuery } from "@tanstack/react-query";
import { useZenlandClientOptional } from "../context";
import type { GqlAgent } from "../../generated/types";

export interface UseAgentOptions {
  /** Whether to enable the query */
  enabled?: boolean;
}

/**
 * Hook to fetch a single agent by address.
 *
 * @example
 * ```tsx
 * import { useAgent } from '@zenland/sdk/react';
 *
 * function AgentProfile({ address }: { address: string }) {
 *   const { data: agent, isLoading, error } = useAgent(address);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!agent) return <div>Agent not found</div>;
 *
 *   return <div>{agent.description}</div>;
 * }
 * ```
 */
export function useAgent(address: string | undefined, options?: UseAgentOptions) {
  const client = useZenlandClientOptional();

  return useQuery<GqlAgent | null>({
    queryKey: ["zenland", "agent", address],
    queryFn: () => {
      if (!address) return null;
      return client.agents.getById(address);
    },
    enabled: !!address && (options?.enabled ?? true),
  });
}
