/**
 * Domain modules index
 */

export { createEscrowsDomain, STATE_GROUPS } from "./escrows";
export type { EscrowsDomain, ListEscrowsArgs, StateGroup } from "./escrows";

export { createAgentsDomain } from "./agents";
export type { AgentsDomain, ListAgentsArgs } from "./agents";

export { createProtocolStatsDomain } from "./protocol-stats";
export type { ProtocolStatsDomain, ProtocolStats } from "./protocol-stats";

export { createTransactionLogsDomain } from "./transaction-logs";
export type { TransactionLogsDomain, ListTransactionLogsArgs } from "./transaction-logs";
