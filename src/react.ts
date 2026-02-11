/**
 * @zenland/sdk/react
 *
 * React hooks and components for the Zenland SDK.
 *
 * @example
 * ```tsx
 * import { ZenlandProvider, useEscrows, useAgent } from '@zenland/sdk/react';
 *
 * function App() {
 *   return (
 *     <ZenlandProvider>
 *       <MyComponent />
 *     </ZenlandProvider>
 *   );
 * }
 *
 * function MyComponent() {
 *   const { data: escrows } = useEscrows({ address: '0x...' });
 *   const { data: agent } = useAgent('0x...');
 *   // ...
 * }
 * ```
 */

// Context and provider
export { ZenlandProvider, useZenlandClient, useZenlandClientOptional } from "./react/context";
export type { ZenlandProviderProps } from "./react/context";

// Hooks
export {
  useEscrow,
  useEscrows,
  useAgent,
  useAgents,
  useProtocolStats,
  useUserStats,
  useGlobalStats,
  useTransactionLogsByEscrow,
  useRecentEscrows,
  STATE_GROUPS,
} from "./react/hooks";
export type {
  UseEscrowOptions,
  UseEscrowsArgs,
  EscrowRole,
  EscrowStateTab,
  UseAgentOptions,
  UseAgentsArgs,
  UseProtocolStatsOptions,
  UseRecentEscrowsOptions,
  UserDashboardStats,
  UseTransactionLogsByEscrowOptions,
  ProtocolStats,
} from "./react/hooks";

// Re-export types from core for convenience
export type {
  GqlAgent,
  GqlAgentPage,
  GqlEscrow,
  GqlEscrowPage,
  GqlProtocolStats,
  GqlTransactionLog,
  GqlPageInfo,
} from "./generated/types";

// Re-export client for advanced usage
export { createZenlandClient } from "./client";
export type { ZenlandClient, ZenlandClientConfig } from "./client";
