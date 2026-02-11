"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createZenlandClient, type ZenlandClient, type ZenlandClientConfig } from "../client";

const ZenlandContext = createContext<ZenlandClient | null>(null);

export interface ZenlandProviderProps {
  children: ReactNode;
  /** Optional configuration for the SDK client */
  config?: ZenlandClientConfig;
}

/**
 * Provider component for the Zenland SDK.
 *
 * Wrap your app with this provider to use the React hooks.
 *
 * @example
 * ```tsx
 * import { ZenlandProvider } from '@zenland/sdk/react';
 *
 * function App() {
 *   return (
 *     <ZenlandProvider>
 *       <YourApp />
 *     </ZenlandProvider>
 *   );
 * }
 *
 * // With custom config
 * <ZenlandProvider config={{ baseUrl: 'http://localhost:42069' }}>
 *   <YourApp />
 * </ZenlandProvider>
 * ```
 */
export function ZenlandProvider({ children, config }: ZenlandProviderProps) {
  const client = useMemo(() => createZenlandClient(config), [config]);

  return <ZenlandContext.Provider value={client}>{children}</ZenlandContext.Provider>;
}

/**
 * Hook to access the Zenland SDK client.
 *
 * Must be used within a ZenlandProvider.
 *
 * @example
 * ```tsx
 * import { useZenlandClient } from '@zenland/sdk/react';
 *
 * function MyComponent() {
 *   const client = useZenlandClient();
 *   // Use client.escrows, client.agents, etc.
 * }
 * ```
 */
export function useZenlandClient(): ZenlandClient {
  const context = useContext(ZenlandContext);
  if (!context) {
    throw new Error("useZenlandClient must be used within a ZenlandProvider");
  }
  return context;
}

/**
 * Hook to access the Zenland SDK client, creating a default one if not in a provider.
 *
 * This is useful for components that might be used outside of a ZenlandProvider.
 */
export function useZenlandClientOptional(): ZenlandClient {
  const context = useContext(ZenlandContext);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => context ?? createZenlandClient(), [context]);
}
