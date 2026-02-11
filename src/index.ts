/**
 * @zenland/sdk
 *
 * Official SDK for interacting with the Zenland escrow protocol indexer.
 *
 * @example
 * ```typescript
 * import { createZenlandClient, zenland } from '@zenland/sdk';
 *
 * // Use the default client (production API)
 * const escrows = await zenland.escrows.list();
 *
 * // Or create a custom client
 * const client = createZenlandClient({ baseUrl: 'http://localhost:42069' });
 * const agents = await client.agents.list({ onlyActive: true });
 * ```
 */

// Main client
export { createZenlandClient, zenland } from "./client";
export type { ZenlandClient, ZenlandClientConfig } from "./client";

// Domain modules (for advanced usage)
export {
  createEscrowsDomain,
  createAgentsDomain,
  createProtocolStatsDomain,
  createTransactionLogsDomain,
  STATE_GROUPS,
} from "./domains";
export type {
  EscrowsDomain,
  AgentsDomain,
  ProtocolStatsDomain,
  TransactionLogsDomain,
  ListEscrowsArgs,
  ListAgentsArgs,
  ListTransactionLogsArgs,
  StateGroup,
  ProtocolStats,
} from "./domains";

// Types
export type {
  // GraphQL types
  GqlAgent,
  GqlAgentCase,
  GqlAgentCasePage,
  GqlAgentPage,
  GqlAgentFilter,
  GqlEscrow,
  GqlEscrowPage,
  GqlEscrowFilter,
  GqlProtocolStats,
  GqlTransactionLog,
  GqlTransactionLogPage,
  GqlTransactionLogFilter,
  GqlPageInfo,
  BigIntScalar,
  Maybe,
  InputMaybe,
} from "./generated/types";

// Protocol / business-logic utilities
export {
  computeAgentMavUsd,
  isAgentEligibleForEscrow,
} from "./agents/eligibility";
export type {
  IndexerAgent,
  AgentEligibilityFailureReason,
  AgentEligibilityResult,
} from "./agents/eligibility";

// Errors
export { ZenlandGraphQLError, ZenlandRequestError } from "./request";
