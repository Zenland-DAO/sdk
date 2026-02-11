/**
 * Agent eligibility utilities.
 *
 * This is protocol/business logic (React-agnostic) and is safe to consume
 * from any app (interface, backend, bots, etc.).
 */

/**
 * Minimal view of an Agent returned by the indexer.
 */
export type IndexerAgent = {
  id: string;
  isActive: boolean;
  isAvailable: boolean;
  stablecoinStake: bigint;
  stablecoinDecimals: number;
  registrationTime: bigint;
  activeCases: number;
  totalResolved: number;
};

export type AgentEligibilityFailureReason =
  | "NOT_REGISTERED"
  | "NOT_ACTIVE"
  | "NOT_AVAILABLE"
  | "INSUFFICIENT_MAV";

export type AgentEligibilityResult =
  | {
      ok: true;
      agentMavUsd: bigint;
      requiredUsd: bigint;
    }
  | {
      ok: false;
      reason: AgentEligibilityFailureReason;
      agentMavUsd?: bigint;
      requiredUsd: bigint;
    };

/**
 * MAV multiplier - how much MAV you get per dollar staked.
 * $1 stake * 20 = $20 MAV
 */
const MAV_MULTIPLIER = 20n;

/**
 * Compute agent MAV from its stablecoin stake.
 *
 * Bigint-safe:
 * - stablecoinStake is in smallest units (stablecoinDecimals)
 * - return MAV in the same smallest units (stablecoinDecimals)
 */
export function computeAgentMavUsd(
  agent: Pick<IndexerAgent, "stablecoinStake" | "stablecoinDecimals">,
): bigint {
  // decimals are not used in arithmetic; they’re carried for formatting.
  // MAV is a simple multiplier in the same units.
  return BigInt(agent.stablecoinStake) * MAV_MULTIPLIER;
}

/**
 * Evaluate whether an agent is eligible for a given escrow amount.
 *
 * NOTE: escrowAmount must be the escrow principal ONLY (fees excluded).
 */
export function isAgentEligibleForEscrow(args: {
  agent: IndexerAgent | null | undefined;
  escrowAmount: bigint;
}): AgentEligibilityResult {
  const requiredUsd = args.escrowAmount;

  if (!args.agent) {
    return { ok: false, reason: "NOT_REGISTERED", requiredUsd };
  }

  if (!args.agent.isActive) {
    return { ok: false, reason: "NOT_ACTIVE", requiredUsd };
  }

  if (!args.agent.isAvailable) {
    return { ok: false, reason: "NOT_AVAILABLE", requiredUsd };
  }

  const agentMavUsd = computeAgentMavUsd(args.agent);

  if (agentMavUsd < requiredUsd) {
    return { ok: false, reason: "INSUFFICIENT_MAV", agentMavUsd, requiredUsd };
  }

  return { ok: true, agentMavUsd, requiredUsd };
}
