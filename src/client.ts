/**
 * Zenland SDK Client
 *
 * The main entry point for interacting with the Zenland indexer.
 */

import { createEscrowsDomain, type EscrowsDomain } from "./domains/escrows";
import { createAgentsDomain, type AgentsDomain } from "./domains/agents";
import { createProtocolStatsDomain, type ProtocolStatsDomain } from "./domains/protocol-stats";
import { createTransactionLogsDomain, type TransactionLogsDomain } from "./domains/transaction-logs";

/** Default production indexer URL */
const DEFAULT_BASE_URL = "https://api.zen.land";

export interface ZenlandClientConfig {
  /** Base URL for the indexer API. Defaults to https://api.zen.land */
  baseUrl?: string;
}

export interface ZenlandClient {
  /** The base URL being used by this client */
  readonly baseUrl: string;

  /** Escrow-related operations */
  readonly escrows: EscrowsDomain;

  /** Agent-related operations */
  readonly agents: AgentsDomain;

  /** Protocol statistics */
  readonly protocolStats: ProtocolStatsDomain;

  /** Transaction logs */
  readonly transactionLogs: TransactionLogsDomain;
}

/**
 * Create a new Zenland SDK client.
 *
 * @example
 * ```typescript
 * // Use production API (default)
 * const client = createZenlandClient();
 *
 * // Use custom endpoint (e.g., local development)
 * const client = createZenlandClient({ baseUrl: 'http://localhost:42069' });
 *
 * // Fetch escrows
 * const { items, totalCount } = await client.escrows.list({ limit: 10 });
 *
 * // Fetch a specific escrow
 * const escrow = await client.escrows.getById('0x...');
 *
 * // Fetch agents
 * const agents = await client.agents.list({ onlyActive: true });
 *
 * // Fetch protocol stats
 * const stats = await client.protocolStats.get();
 * ```
 */
export function createZenlandClient(config?: ZenlandClientConfig): ZenlandClient {
  const baseUrl = normalizeBaseUrl(config?.baseUrl ?? DEFAULT_BASE_URL);

  return {
    baseUrl,
    escrows: createEscrowsDomain(baseUrl),
    agents: createAgentsDomain(baseUrl),
    protocolStats: createProtocolStatsDomain(baseUrl),
    transactionLogs: createTransactionLogsDomain(baseUrl),
  };
}

/**
 * Normalize base URL by removing trailing slash
 */
function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/**
 * Default client instance using production API.
 * Use this for quick access without creating a new client.
 *
 * @example
 * ```typescript
 * import { zenland } from '@zenland/sdk';
 *
 * const escrows = await zenland.escrows.list();
 * ```
 */
export const zenland = createZenlandClient();
