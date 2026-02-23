/**
 * Generated types from the Zenland indexer GraphQL schema.
 * These types are bundled with the SDK for convenience.
 */

export type Maybe<T> = T | null;
export type InputMaybe<T> = T | null | undefined;

/** GraphQL BigInt scalar - can be string or number from the API */
export type BigIntScalar = string | number | bigint;

/** Page info for paginated queries */
export interface GqlPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: Maybe<string>;
  endCursor?: Maybe<string>;
}

// ============================================================================
// Agent Types
// ============================================================================

export interface GqlAgent {
  id: string;
  isActive: boolean;
  isAvailable: boolean;
  stablecoinDecimals: number;
  stablecoinToken: string;
  stablecoinStake: BigIntScalar;
  daoTokenStake: BigIntScalar;
  disputeFeeBps: number;
  assignmentFeeBps: number;
  description: string;
  contact: string;
  totalResolved: number;
  activeCases: number;
  totalEscrowsAssigned: number;
  registrationTime: BigIntScalar;
  lastEngagementTimestamp: BigIntScalar;
  totalEarnings: BigIntScalar;
  totalSlashed: BigIntScalar;
  cases?: Maybe<GqlAgentCasePage>;
}

export interface GqlAgentCase {
  id: string;
  escrow: string;
  agent: string;
  invitedAt: BigIntScalar;
  resolvedAt?: Maybe<BigIntScalar>;
  timedOut: boolean;
  feeEarned?: Maybe<BigIntScalar>;
  escrowRef?: Maybe<GqlEscrow>;
}

export interface GqlAgentCasePage {
  items: GqlAgentCase[];
  totalCount: number;
  pageInfo: GqlPageInfo;
}

export interface GqlAgentPage {
  items: GqlAgent[];
  totalCount: number;
  pageInfo: GqlPageInfo;
}

export interface GqlAgentFilter {
  id?: InputMaybe<string>;
  id_in?: InputMaybe<string[]>;
  isActive?: InputMaybe<boolean>;
  isAvailable?: InputMaybe<boolean>;
  AND?: InputMaybe<GqlAgentFilter[]>;
  OR?: InputMaybe<GqlAgentFilter[]>;
}

// ============================================================================
// Escrow Types
// ============================================================================

export interface GqlEscrow {
  id: string;
  /** Chain ID where this escrow is deployed (1 for mainnet, 11155111 for sepolia) */
  chainId: number;
  buyer: string;
  seller: string;
  agent?: Maybe<string>;
  amount: BigIntScalar;
  token: string;
  state: string;
  createdAt: BigIntScalar;
  sellerAcceptDeadline: BigIntScalar;
  buyerProtectionTime: BigIntScalar;
  termsHash: string;
  version: number;
  fundedAt: BigIntScalar;
  fulfilledAt?: Maybe<BigIntScalar>;
  resolvedAt?: Maybe<BigIntScalar>;
  agentInvitedAt?: Maybe<BigIntScalar>;
  splitProposer?: Maybe<string>;
  proposedBuyerBps?: Maybe<number>;
  proposedSellerBps?: Maybe<number>;
  buyerApprovedSplit?: Maybe<boolean>;
  sellerApprovedSplit?: Maybe<boolean>;
  agentFeeReceived?: Maybe<BigIntScalar>;
  buyerReceived?: Maybe<BigIntScalar>;
  sellerReceived?: Maybe<BigIntScalar>;
  creationFee: BigIntScalar;
  sellerAcceptedAt?: Maybe<BigIntScalar>;
  sellerDeclinedAt?: Maybe<BigIntScalar>;
  cancelledExpiredAt?: Maybe<BigIntScalar>;
}

export interface GqlEscrowPage {
  items: GqlEscrow[];
  totalCount: number;
  pageInfo: GqlPageInfo;
}

export interface GqlEscrowFilter {
  id?: InputMaybe<string>;
  id_in?: InputMaybe<string[]>;
  buyer?: InputMaybe<string>;
  seller?: InputMaybe<string>;
  agent?: InputMaybe<string>;
  state?: InputMaybe<string>;
  state_in?: InputMaybe<string[]>;
  token?: InputMaybe<string>;
  AND?: InputMaybe<GqlEscrowFilter[]>;
  OR?: InputMaybe<GqlEscrowFilter[]>;
}

// ============================================================================
// Protocol Stats Types
// ============================================================================

export interface GqlProtocolStats {
  id: string;
  /** Chain ID (1 for mainnet, 11155111 for sepolia) */
  chainId: number;
  totalEscrowsCreated: number;
  totalVolumeEscrowed: BigIntScalar;
  totalFeesCollected: BigIntScalar;
  currentTVL: BigIntScalar;
  activeEscrowCount: number;
  totalAgentsRegistered: number;
  activeAgentsCount: number;
}

// ============================================================================
// Transaction Log Types
// ============================================================================

export interface GqlTransactionLog {
  id: string;
  txHash: string;
  blockNumber: BigIntScalar;
  timestamp: BigIntScalar;
  eventName: string;
  contractAddress: string;
  contractType: string;
  escrowAddress?: Maybe<string>;
  agentAddress?: Maybe<string>;
  userAddress?: Maybe<string>;
  eventData: string;
}

export interface GqlTransactionLogPage {
  items: GqlTransactionLog[];
  totalCount: number;
  pageInfo: GqlPageInfo;
}

export interface GqlTransactionLogFilter {
  escrowAddress?: InputMaybe<string>;
  agentAddress?: InputMaybe<string>;
  userAddress?: InputMaybe<string>;
  eventName?: InputMaybe<string>;
  AND?: InputMaybe<GqlTransactionLogFilter[]>;
  OR?: InputMaybe<GqlTransactionLogFilter[]>;
}

// ============================================================================
// User Escrow Types (Junction table for user-escrow relationships)
// ============================================================================

export interface GqlUserEscrow {
  id: string;
  user: string;
  escrow: string;
  role: string;
  escrowRef?: Maybe<GqlEscrow>;
}

export interface GqlUserEscrowPage {
  items: GqlUserEscrow[];
  totalCount: number;
  pageInfo: GqlPageInfo;
}

// ============================================================================
// Query Response Types
// ============================================================================

export interface AgentQueryResponse {
  agent: Maybe<GqlAgent>;
}

export interface AgentsQueryResponse {
  agents: GqlAgentPage;
}

export interface EscrowQueryResponse {
  escrow: Maybe<GqlEscrow>;
}

export interface EscrowsQueryResponse {
  escrows: GqlEscrowPage;
}

export interface ProtocolStatsQueryResponse {
  protocolStats: Maybe<GqlProtocolStats>;
  agents: { items: Array<{ stablecoinStake: BigIntScalar }> };
}

export interface TransactionLogsQueryResponse {
  transactionLogs: GqlTransactionLogPage;
}
