/**
 * Agent domain module for the Zenland SDK
 */

import { graphqlRequest } from "../request";
import { AGENT_QUERY, AGENTS_QUERY } from "../queries";
import type {
  GqlAgent,
  GqlAgentPage,
  GqlAgentFilter,
  AgentQueryResponse,
  AgentsQueryResponse,
} from "../generated/types";

export interface ListAgentsArgs {
  limit?: number;
  offset?: number;
  onlyActive?: boolean;
  onlyAvailable?: boolean;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
}

/**
 * Creates agent domain functions bound to a base URL
 */
export function createAgentsDomain(baseUrl: string) {
  /**
   * List agents with filtering and pagination
   */
  async function list(args?: ListAgentsArgs): Promise<GqlAgentPage> {
    const where: GqlAgentFilter = {};

    if (args?.onlyActive) where.isActive = true;
    if (args?.onlyAvailable) where.isAvailable = true;

    const variables = {
      limit: args?.limit ?? 30,
      offset: args?.offset ?? 0,
      orderBy: args?.orderBy ?? "totalResolved",
      orderDirection: args?.orderDirection ?? "desc",
      where: Object.keys(where).length > 0 ? where : undefined,
    };

    const response = await graphqlRequest<AgentsQueryResponse, typeof variables>(
      baseUrl,
      AGENTS_QUERY,
      variables,
    );

    return response.agents;
  }

  /**
   * Get a single agent by ID (address)
   */
  async function getById(id: string): Promise<GqlAgent | null> {
    const variables = { id: id.toLowerCase() };

    const response = await graphqlRequest<AgentQueryResponse, typeof variables>(
      baseUrl,
      AGENT_QUERY,
      variables,
    );

    return response.agent;
  }

  /**
   * Get all active and available agents
   */
  async function getAvailable(args?: Omit<ListAgentsArgs, "onlyActive" | "onlyAvailable">): Promise<GqlAgentPage> {
    return list({ ...args, onlyActive: true, onlyAvailable: true });
  }

  return {
    list,
    getById,
    getAvailable,
  };
}

export type AgentsDomain = ReturnType<typeof createAgentsDomain>;
