/**
 * Escrow domain module for the Zenland SDK
 */

import { graphqlRequest } from "../request";
import { ESCROW_QUERY, ESCROWS_QUERY } from "../queries";
import type {
  GqlEscrow,
  GqlEscrowPage,
  GqlEscrowFilter,
  EscrowQueryResponse,
  EscrowsQueryResponse,
} from "../generated/types";

/** State groups for filtering escrows */
export const STATE_GROUPS = {
  ACTIVE: ["PENDING", "ACTIVE", "FULFILLED"] as const,
  IN_DISPUTE: ["DISPUTED", "AGENT_INVITED"] as const,
  COMPLETED: ["RELEASED", "AGENT_RESOLVED", "REFUNDED", "SPLIT"] as const,
} as const;

export type StateGroup = keyof typeof STATE_GROUPS;

export interface ListEscrowsArgs {
  limit?: number;
  offset?: number;
  buyer?: string;
  seller?: string;
  agent?: string;
  /** Search across buyer, seller, or agent roles */
  user?: string;
  state?: string;
  /** Multiple states for group filtering */
  states?: string[];
  orderBy?: string;
  orderDirection?: "asc" | "desc";
}

/**
 * Creates escrow domain functions bound to a base URL
 */
export function createEscrowsDomain(baseUrl: string) {
  /**
   * List escrows with filtering and pagination
   */
  async function list(args?: ListEscrowsArgs): Promise<GqlEscrowPage> {
    const where: GqlEscrowFilter = {};

    // Role-specific filters
    if (args?.buyer) where.buyer = args.buyer.toLowerCase();
    if (args?.seller) where.seller = args.seller.toLowerCase();
    if (args?.agent) where.agent = args.agent.toLowerCase();

    // State filters - single or multiple
    if (args?.states && args.states.length > 0) {
      where.state_in = args.states;
    } else if (args?.state) {
      where.state = args.state;
    }

    // User filter: search across buyer, seller, or agent roles
    if (args?.user) {
      const userLower = args.user.toLowerCase();
      where.OR = [{ buyer: userLower }, { seller: userLower }, { agent: userLower }];
    }

    const variables = {
      limit: args?.limit ?? 30,
      offset: args?.offset ?? 0,
      orderBy: args?.orderBy ?? "createdAt",
      orderDirection: args?.orderDirection ?? "desc",
      where: Object.keys(where).length > 0 ? where : undefined,
    };

    const response = await graphqlRequest<EscrowsQueryResponse, typeof variables>(
      baseUrl,
      ESCROWS_QUERY,
      variables,
    );

    return response.escrows;
  }

  /**
   * Get a single escrow by ID (address)
   */
  async function getById(id: string): Promise<GqlEscrow | null> {
    const variables = { id: id.toLowerCase() };

    const response = await graphqlRequest<EscrowQueryResponse, typeof variables>(
      baseUrl,
      ESCROW_QUERY,
      variables,
    );

    return response.escrow;
  }

  /**
   * Get escrows for a specific user across all roles
   */
  async function getByUser(
    userAddress: string,
    args?: Omit<ListEscrowsArgs, "user" | "buyer" | "seller" | "agent">,
  ): Promise<GqlEscrowPage> {
    return list({ ...args, user: userAddress });
  }

  /**
   * Get escrows by state group
   */
  async function getByStateGroup(
    stateGroup: StateGroup,
    args?: Omit<ListEscrowsArgs, "state" | "states">,
  ): Promise<GqlEscrowPage> {
    return list({ ...args, states: [...STATE_GROUPS[stateGroup]] });
  }

  return {
    list,
    getById,
    getByUser,
    getByStateGroup,
  };
}

export type EscrowsDomain = ReturnType<typeof createEscrowsDomain>;
