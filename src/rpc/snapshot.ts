/**
 * Serializable snapshots of a synced `ChainState`.
 *
 * A snapshot only contains confirmed blocks, so it can be persisted (browser
 * storage) or shared (server route) without carrying reorged-out events.
 */

import { STATE_VERSION, type ChainState } from "./store";

export interface ChainSnapshot {
  version: number;
  chainId: number;
  /** Deployment the state was built from (lowercase factory + start block) */
  escrowFactory: string;
  startBlock: bigint;
  /** Last block included in the state */
  block: bigint;
  knownEscrows: string[];
  state: ChainState;
}

/**
 * Key/value storage used to persist snapshots. `window.localStorage` fits
 * as-is; async stores (IndexedDB wrappers, files, Redis) work too.
 */
export interface ZenlandRpcStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
}

/** Tag for bigint values in JSON (JSON has no bigint type) */
const BIGINT_TAG = "$n";

export function encodeSnapshot(snapshot: ChainSnapshot): string {
  const { state } = snapshot;
  return JSON.stringify(
    {
      ...snapshot,
      state: {
        ...state,
        escrows: [...state.escrows.values()],
        agents: [...state.agents.values()],
        agentCases: [...state.agentCases.values()],
      },
    },
    (_key, value) => (typeof value === "bigint" ? { [BIGINT_TAG]: value.toString() } : value),
  );
}

/** Parse a snapshot; returns null when malformed or from another state version */
export function decodeSnapshot(raw: string): ChainSnapshot | null {
  try {
    const parsed = JSON.parse(raw, (_key, value) =>
      value !== null && typeof value === "object" && typeof value[BIGINT_TAG] === "string"
        ? BigInt(value[BIGINT_TAG])
        : value,
    );
    if (parsed?.version !== STATE_VERSION) return null;

    const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((row) => [row.id, row]));
    const { state } = parsed;
    return {
      ...parsed,
      state: {
        ...state,
        escrows: byId(state.escrows),
        agents: byId(state.agents),
        agentCases: byId(state.agentCases),
      },
    };
  } catch {
    return null;
  }
}
