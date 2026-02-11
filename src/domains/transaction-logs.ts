/**
 * Transaction Logs domain module for the Zenland SDK
 */

import { graphqlRequest } from "../request";
import { TRANSACTION_LOGS_QUERY } from "../queries";
import type { GqlTransactionLog, TransactionLogsQueryResponse } from "../generated/types";

export interface ListTransactionLogsArgs {
  escrowAddress?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
}

/**
 * Creates transaction logs domain functions bound to a base URL
 */
export function createTransactionLogsDomain(baseUrl: string) {
  /**
   * List transaction logs with filtering and pagination
   */
  async function list(args?: ListTransactionLogsArgs): Promise<GqlTransactionLog[]> {
    const variables = {
      escrowAddress: args?.escrowAddress?.toLowerCase(),
      limit: args?.limit ?? 100,
      offset: args?.offset ?? 0,
      orderBy: args?.orderBy ?? "timestamp",
      orderDirection: args?.orderDirection ?? "asc",
    };

    const response = await graphqlRequest<TransactionLogsQueryResponse, typeof variables>(
      baseUrl,
      TRANSACTION_LOGS_QUERY,
      variables,
    );

    return response.transactionLogs.items;
  }

  /**
   * Get transaction logs for a specific escrow
   */
  async function getByEscrow(
    escrowAddress: string,
    args?: Omit<ListTransactionLogsArgs, "escrowAddress">,
  ): Promise<GqlTransactionLog[]> {
    return list({ ...args, escrowAddress });
  }

  /**
   * Parse eventData JSON string from a transaction log
   */
  function parseEventData(eventData: string): Record<string, unknown> {
    try {
      return JSON.parse(eventData);
    } catch {
      return {};
    }
  }

  return {
    list,
    getByEscrow,
    parseEventData,
  };
}

export type TransactionLogsDomain = ReturnType<typeof createTransactionLogsDomain>;
