/**
 * In-memory replica of the indexer tables, built by replaying onchain events.
 *
 * `applyEvent` is a port of the Ponder handlers in `indexer/src/index.ts` so
 * that the RPC data source produces the same rows the indexer would.
 * Keep the two in sync when handler logic changes.
 */

/** Zero address (lowercase) */
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const TERMINAL_STATES = ["RELEASED", "AGENT_RESOLVED", "REFUNDED", "SPLIT"];

export type ContractType = "FACTORY" | "AGENT_REGISTRY" | "ESCROW";

export interface EscrowRow {
  id: string;
  chainId: number;
  buyer: string;
  seller: string;
  agent: string | null;
  token: string;
  amount: bigint;
  creationFee: bigint;
  buyerProtectionTime: bigint;
  termsHash: string;
  version: number;
  state: string;
  createdAt: bigint;
  fundedAt: bigint;
  sellerAcceptDeadline: bigint;
  sellerAcceptedAt: bigint | null;
  sellerDeclinedAt: bigint | null;
  cancelledExpiredAt: bigint | null;
  fulfilledAt: bigint | null;
  resolvedAt: bigint | null;
  agentInvitedAt: bigint | null;
  splitProposer: string | null;
  proposedBuyerBps: number | null;
  proposedSellerBps: number | null;
  buyerApprovedSplit: boolean | null;
  sellerApprovedSplit: boolean | null;
  buyerReceived: bigint | null;
  sellerReceived: bigint | null;
  agentFeeReceived: bigint | null;
}

export interface AgentRow {
  id: string;
  isActive: boolean;
  isAvailable: boolean;
  stablecoinToken: string;
  stablecoinDecimals: number;
  stablecoinStake: bigint;
  daoTokenStake: bigint;
  disputeFeeBps: number;
  assignmentFeeBps: number;
  description: string;
  contact: string;
  totalResolved: number;
  activeCases: number;
  registrationTime: bigint;
  lastEngagementTimestamp: bigint;
  totalEscrowsAssigned: number;
  totalEarnings: bigint;
  totalSlashed: bigint;
}

export interface AgentCaseRow {
  id: string;
  agent: string;
  escrow: string;
  invitedAt: bigint;
  resolvedAt: bigint | null;
  timedOut: boolean;
  feeEarned: bigint | null;
}

export interface ProtocolStatsRow {
  id: string;
  chainId: number;
  totalEscrowsCreated: number;
  totalVolumeEscrowed: bigint;
  totalFeesCollected: bigint;
  currentTVL: bigint;
  activeEscrowCount: number;
  totalAgentsRegistered: number;
  activeAgentsCount: number;
}

export interface TransactionLogRow {
  id: string;
  txHash: string;
  blockNumber: bigint;
  logIndex: number;
  timestamp: bigint;
  eventName: string;
  contractAddress: string;
  contractType: ContractType;
  escrowAddress: string | null;
  agentAddress: string | null;
  userAddress: string | null;
  eventData: string;
}

/** All indexed rows for a single chain */
export interface ChainState {
  chainId: number;
  escrows: Map<string, EscrowRow>;
  agents: Map<string, AgentRow>;
  agentCases: Map<string, AgentCaseRow>;
  stats: ProtocolStatsRow;
  logs: TransactionLogRow[];
}

/** A decoded onchain event, ready to be applied */
export interface ChainEvent {
  contractType: ContractType;
  eventName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>;
  /** Lowercase emitting contract address */
  address: string;
  txHash: string;
  blockNumber: bigint;
  logIndex: number;
  timestamp: bigint;
}

/** Immutable escrow params that are not part of the EscrowCreated event */
export interface EscrowImmutables {
  buyerProtectionTime: bigint;
  termsHash: string;
  sellerAcceptDeadline: bigint;
}

const CHAIN_ID_TO_STATS_ID: Record<number, string> = {
  1: "mainnet",
  11155111: "sepolia",
};

/** Stats ID used by the indexer for a chain ("mainnet", "sepolia", ...) */
export function getStatsIdForChain(chainId: number): string {
  return CHAIN_ID_TO_STATS_ID[chainId] ?? `chain-${chainId}`;
}

export function createChainState(chainId: number): ChainState {
  return {
    chainId,
    escrows: new Map(),
    agents: new Map(),
    agentCases: new Map(),
    stats: {
      id: getStatsIdForChain(chainId),
      chainId,
      totalEscrowsCreated: 0,
      totalVolumeEscrowed: 0n,
      totalFeesCollected: 0n,
      currentTVL: 0n,
      activeEscrowCount: 0,
      totalAgentsRegistered: 0,
      activeAgentsCount: 0,
    },
    logs: [],
  };
}

function lower(value: string): string {
  return value.toLowerCase();
}

function addLog(
  state: ChainState,
  event: ChainEvent,
  data: {
    escrowAddress?: string;
    agentAddress?: string;
    userAddress?: string;
    eventData: Record<string, unknown>;
  },
) {
  state.logs.push({
    id: `${event.txHash}-${event.logIndex}`,
    txHash: event.txHash,
    blockNumber: event.blockNumber,
    logIndex: event.logIndex,
    timestamp: event.timestamp,
    eventName: event.eventName,
    contractAddress: event.address,
    contractType: event.contractType,
    escrowAddress: data.escrowAddress ? lower(data.escrowAddress) : null,
    agentAddress: data.agentAddress ? lower(data.agentAddress) : null,
    userAddress: data.userAddress ? lower(data.userAddress) : null,
    eventData: JSON.stringify(data.eventData),
  });
}

/** Funds left an escrow: update TVL + active escrow count */
function releaseTvl(state: ChainState, amount: bigint) {
  state.stats.currentTVL -= amount;
  state.stats.activeEscrowCount = Math.max(0, state.stats.activeEscrowCount - 1);
}

/**
 * Apply a single event to the chain state.
 *
 * Events must be applied in (blockNumber, logIndex) order.
 * Events without a handler in the indexer are ignored.
 */
export function applyEvent(
  state: ChainState,
  event: ChainEvent,
  immutables: Map<string, EscrowImmutables>,
): void {
  const key = `${event.contractType}:${event.eventName}`;
  const args = event.args;
  const timestamp = event.timestamp;

  switch (key) {
    // ============================================
    // ESCROW FACTORY
    // ============================================

    case "FACTORY:EscrowCreated": {
      const escrowAddress = lower(args.escrow);
      const agentAddr = lower(args.agent);
      const extra = immutables.get(escrowAddress);
      const buyerProtectionTime = extra?.buyerProtectionTime ?? 0n;
      const termsHash = extra?.termsHash ?? "0x";
      const sellerAcceptDeadline = extra?.sellerAcceptDeadline ?? 0n;

      state.escrows.set(escrowAddress, {
        id: escrowAddress,
        chainId: state.chainId,
        buyer: lower(args.buyer),
        seller: lower(args.seller),
        agent: agentAddr === ZERO_ADDRESS ? null : agentAddr,
        token: lower(args.token),
        amount: args.amount,
        creationFee: args.creationFee,
        buyerProtectionTime,
        termsHash: lower(termsHash),
        version: Number(args.version),
        state: "PENDING",
        createdAt: timestamp,
        fundedAt: timestamp,
        sellerAcceptDeadline,
        sellerAcceptedAt: null,
        sellerDeclinedAt: null,
        cancelledExpiredAt: null,
        fulfilledAt: null,
        resolvedAt: null,
        agentInvitedAt: null,
        splitProposer: null,
        proposedBuyerBps: null,
        proposedSellerBps: null,
        buyerApprovedSplit: null,
        sellerApprovedSplit: null,
        buyerReceived: null,
        sellerReceived: null,
        agentFeeReceived: null,
      });

      if (agentAddr !== ZERO_ADDRESS) {
        const agentRecord = state.agents.get(agentAddr);
        if (agentRecord) agentRecord.totalEscrowsAssigned += 1;
      }

      state.stats.totalEscrowsCreated += 1;
      state.stats.totalVolumeEscrowed += args.amount;
      state.stats.currentTVL += args.amount;
      state.stats.activeEscrowCount += 1;

      addLog(state, event, {
        escrowAddress,
        userAddress: args.buyer,
        eventData: {
          buyer: args.buyer,
          seller: args.seller,
          agent: args.agent,
          token: args.token,
          amount: args.amount.toString(),
          creationFee: args.creationFee.toString(),
          version: Number(args.version),
          buyerProtectionTime: buyerProtectionTime.toString(),
          termsHash,
          sellerAcceptDeadline: sellerAcceptDeadline.toString(),
        },
      });
      return;
    }

    case "FACTORY:ProtocolFeePaid": {
      state.stats.totalFeesCollected += args.feeAmount;
      addLog(state, event, {
        userAddress: args.payer,
        eventData: { payer: args.payer, token: args.token, feeAmount: args.feeAmount.toString() },
      });
      return;
    }

    case "FACTORY:AgentAssignmentFeePaid": {
      const agentRecord = state.agents.get(lower(args.agent));
      if (agentRecord) agentRecord.totalEarnings += args.feeAmount;
      addLog(state, event, {
        agentAddress: args.agent,
        userAddress: args.payer,
        eventData: {
          payer: args.payer,
          agent: args.agent,
          token: args.token,
          feeAmount: args.feeAmount.toString(),
        },
      });
      return;
    }

    // ============================================
    // AGENT REGISTRY
    // ============================================

    case "AGENT_REGISTRY:AgentRegistered": {
      const agentAddr = lower(args.agent);
      const existing = state.agents.get(agentAddr);
      const profile = {
        isActive: true,
        isAvailable: true,
        stablecoinToken: lower(args.stablecoinToken),
        stablecoinDecimals: Number(args.stablecoinDecimals),
        stablecoinStake: args.stablecoinStake as bigint,
        daoTokenStake: args.daoTokenStake as bigint,
        disputeFeeBps: Number(args.disputeFeeBps),
        assignmentFeeBps: Number(args.assignmentFeeBps),
        description: args.description as string,
        contact: args.contact as string,
        totalResolved: 0,
        activeCases: 0,
        registrationTime: timestamp,
        lastEngagementTimestamp: 0n,
      };

      if (!existing) {
        state.agents.set(agentAddr, {
          id: agentAddr,
          ...profile,
          totalEscrowsAssigned: 0,
          totalEarnings: 0n,
          totalSlashed: 0n,
        });
        state.stats.totalAgentsRegistered += 1;
        state.stats.activeAgentsCount += 1;
      } else {
        // Re-registration after unstake: keep lifetime aggregates intact.
        if (!existing.isActive) state.stats.activeAgentsCount += 1;
        Object.assign(existing, profile);
      }

      addLog(state, event, {
        agentAddress: args.agent,
        eventData: {
          stablecoinToken: args.stablecoinToken,
          stablecoinDecimals: Number(args.stablecoinDecimals),
          stablecoinStake: args.stablecoinStake.toString(),
          daoTokenStake: args.daoTokenStake.toString(),
          disputeFeeBps: Number(args.disputeFeeBps),
          assignmentFeeBps: Number(args.assignmentFeeBps),
          description: args.description,
          contact: args.contact,
        },
      });
      return;
    }

    case "AGENT_REGISTRY:AgentDisputeFeeUpdated":
    case "AGENT_REGISTRY:AgentAssignmentFeeUpdated": {
      const agentRecord = state.agents.get(lower(args.agent));
      if (agentRecord) {
        if (event.eventName === "AgentDisputeFeeUpdated") {
          agentRecord.disputeFeeBps = Number(args.newFeeBps);
        } else {
          agentRecord.assignmentFeeBps = Number(args.newFeeBps);
        }
      }
      addLog(state, event, {
        agentAddress: args.agent,
        eventData: { oldFeeBps: Number(args.oldFeeBps), newFeeBps: Number(args.newFeeBps) },
      });
      return;
    }

    case "AGENT_REGISTRY:StablecoinStakeIncreased":
    case "AGENT_REGISTRY:DaoTokenStakeIncreased": {
      const agentRecord = state.agents.get(lower(args.agent));
      if (agentRecord) {
        if (event.eventName === "StablecoinStakeIncreased") {
          agentRecord.stablecoinStake = args.newTotal;
        } else {
          agentRecord.daoTokenStake = args.newTotal;
        }
      }
      addLog(state, event, {
        agentAddress: args.agent,
        eventData: { newTotal: args.newTotal.toString() },
      });
      return;
    }

    case "AGENT_REGISTRY:AgentUnstaked": {
      const agentRecord = state.agents.get(lower(args.agent));
      if (agentRecord) {
        agentRecord.isActive = false;
        agentRecord.isAvailable = false;
        agentRecord.stablecoinStake = 0n;
        agentRecord.daoTokenStake = 0n;
      }
      state.stats.activeAgentsCount = Math.max(0, state.stats.activeAgentsCount - 1);
      addLog(state, event, {
        agentAddress: args.agent,
        eventData: {
          stablecoinAmount: args.stablecoinAmount.toString(),
          daoTokenAmount: args.daoTokenAmount.toString(),
        },
      });
      return;
    }

    case "AGENT_REGISTRY:AgentProfileUpdated": {
      const agentRecord = state.agents.get(lower(args.agent));
      if (agentRecord) {
        agentRecord.description = args.description;
        agentRecord.contact = args.contact;
      }
      addLog(state, event, {
        agentAddress: args.agent,
        eventData: { description: args.description, contact: args.contact },
      });
      return;
    }

    case "AGENT_REGISTRY:AgentAvailabilitySet": {
      const agentRecord = state.agents.get(lower(args.agent));
      if (agentRecord) agentRecord.isAvailable = args.available;
      addLog(state, event, {
        agentAddress: args.agent,
        eventData: { available: args.available },
      });
      return;
    }

    case "AGENT_REGISTRY:ResolutionRecorded": {
      const agentRecord = state.agents.get(lower(args.agent));
      if (agentRecord) {
        agentRecord.totalResolved += 1;
        agentRecord.lastEngagementTimestamp = timestamp;
      }
      addLog(state, event, {
        agentAddress: args.agent,
        eventData: { timedOut: args.timedOut },
      });
      return;
    }

    case "AGENT_REGISTRY:StablecoinSlashed":
    case "AGENT_REGISTRY:DaoTokenSlashed": {
      const agentRecord = state.agents.get(lower(args.agent));
      if (agentRecord) {
        if (event.eventName === "StablecoinSlashed") {
          agentRecord.stablecoinStake -= args.amount;
        } else {
          agentRecord.daoTokenStake -= args.amount;
        }
        agentRecord.totalSlashed += args.amount;
      }
      addLog(state, event, {
        agentAddress: args.agent,
        eventData: { amount: args.amount.toString(), recipient: args.recipient },
      });
      return;
    }

    // ============================================
    // ESCROW INSTANCES
    // ============================================

    case "ESCROW:SellerAccepted": {
      const escrowRecord = state.escrows.get(event.address);
      if (escrowRecord) {
        escrowRecord.state = "ACTIVE";
        escrowRecord.sellerAcceptedAt = args.timestamp;
      }
      addLog(state, event, {
        escrowAddress: event.address,
        userAddress: args.seller,
        eventData: { seller: args.seller, timestamp: args.timestamp.toString() },
      });
      return;
    }

    case "ESCROW:SellerDeclined": {
      const escrowRecord = state.escrows.get(event.address);
      if (escrowRecord) {
        escrowRecord.state = "REFUNDED";
        escrowRecord.resolvedAt = args.timestamp;
        escrowRecord.sellerDeclinedAt = args.timestamp;
        escrowRecord.buyerReceived = escrowRecord.amount;
        releaseTvl(state, escrowRecord.amount);
      }
      addLog(state, event, {
        escrowAddress: event.address,
        userAddress: args.seller,
        eventData: { seller: args.seller, timestamp: args.timestamp.toString() },
      });
      return;
    }

    case "ESCROW:EscrowCancelledExpired": {
      const escrowRecord = state.escrows.get(event.address);
      if (escrowRecord) {
        escrowRecord.state = "REFUNDED";
        escrowRecord.resolvedAt = timestamp;
        escrowRecord.cancelledExpiredAt = timestamp;
        escrowRecord.buyerReceived = args.amount;
        releaseTvl(state, escrowRecord.amount);
      }
      addLog(state, event, {
        escrowAddress: event.address,
        userAddress: args.buyer,
        eventData: { buyer: args.buyer, amount: args.amount.toString() },
      });
      return;
    }

    case "ESCROW:FulfillmentConfirmed": {
      const escrowRecord = state.escrows.get(event.address);
      if (escrowRecord) {
        escrowRecord.state = "FULFILLED";
        escrowRecord.fulfilledAt = args.timestamp;
      }
      addLog(state, event, {
        escrowAddress: event.address,
        userAddress: args.seller,
        eventData: { seller: args.seller, timestamp: args.timestamp.toString() },
      });
      return;
    }

    case "ESCROW:FundsReleased": {
      const escrowRecord = state.escrows.get(event.address);
      if (escrowRecord) {
        escrowRecord.state = "RELEASED";
        escrowRecord.resolvedAt = timestamp;
        escrowRecord.sellerReceived = args.amount;
        releaseTvl(state, escrowRecord.amount);
      }
      addLog(state, event, {
        escrowAddress: event.address,
        userAddress: args.to,
        eventData: { to: args.to, amount: args.amount.toString(), fee: args.fee.toString() },
      });
      return;
    }

    case "ESCROW:DisputeOpened": {
      const escrowRecord = state.escrows.get(event.address);
      if (escrowRecord) escrowRecord.state = "DISPUTED";
      addLog(state, event, {
        escrowAddress: event.address,
        userAddress: args.buyer,
        eventData: { buyer: args.buyer },
      });
      return;
    }

    case "ESCROW:AgentInvited": {
      const agentAddr = lower(args.agent);
      const escrowRecord = state.escrows.get(event.address);
      if (escrowRecord) {
        Object.assign(escrowRecord, {
          state: "AGENT_INVITED",
          agent: agentAddr,
          agentInvitedAt: timestamp,
          // State transition invalidates split negotiations
          splitProposer: null,
          proposedBuyerBps: null,
          proposedSellerBps: null,
          buyerApprovedSplit: null,
          sellerApprovedSplit: null,
        });
      }

      const caseId = `${agentAddr}-${event.address}`;
      state.agentCases.set(caseId, {
        id: caseId,
        agent: agentAddr,
        escrow: event.address,
        invitedAt: timestamp,
        resolvedAt: null,
        timedOut: false,
        feeEarned: null,
      });

      const agentRecord = state.agents.get(agentAddr);
      if (agentRecord) {
        agentRecord.activeCases += 1;
        agentRecord.lastEngagementTimestamp = timestamp;
      }

      addLog(state, event, {
        escrowAddress: event.address,
        agentAddress: args.agent,
        userAddress: args.inviter,
        eventData: { inviter: args.inviter, agent: args.agent },
      });
      return;
    }

    case "ESCROW:AgentResolved": {
      const escrowRecord = state.escrows.get(event.address);
      if (escrowRecord) {
        escrowRecord.state = "AGENT_RESOLVED";
        escrowRecord.resolvedAt = timestamp;
        escrowRecord.buyerReceived = (escrowRecord.amount * args.buyerBps) / 10000n;
        escrowRecord.sellerReceived = (escrowRecord.amount * args.sellerBps) / 10000n;
        escrowRecord.agentFeeReceived = args.agentFeeAmount;

        if (escrowRecord.agent) {
          const agentCase = state.agentCases.get(`${escrowRecord.agent}-${event.address}`);
          if (agentCase) {
            agentCase.resolvedAt = timestamp;
            agentCase.feeEarned = args.agentFeeAmount;
          }
          const agentRecord = state.agents.get(escrowRecord.agent);
          if (agentRecord) {
            agentRecord.activeCases = Math.max(0, agentRecord.activeCases - 1);
            agentRecord.totalEarnings += args.agentFeeAmount;
          }
        }

        releaseTvl(state, escrowRecord.amount);
      }
      addLog(state, event, {
        escrowAddress: event.address,
        eventData: {
          buyerBps: Number(args.buyerBps),
          sellerBps: Number(args.sellerBps),
          agentFeeAmount: args.agentFeeAmount.toString(),
        },
      });
      return;
    }

    case "ESCROW:AgentTimedOut": {
      const agentAddr = lower(args.agent);
      const escrowRecord = state.escrows.get(event.address);
      if (escrowRecord) escrowRecord.state = "DISPUTED";

      const agentCase = state.agentCases.get(`${agentAddr}-${event.address}`);
      if (agentCase) agentCase.timedOut = true;

      const agentRecord = state.agents.get(agentAddr);
      if (agentRecord) agentRecord.activeCases = Math.max(0, agentRecord.activeCases - 1);

      addLog(state, event, {
        escrowAddress: event.address,
        agentAddress: args.agent,
        eventData: { agent: args.agent },
      });
      return;
    }

    case "ESCROW:Refunded": {
      const escrowRecord = state.escrows.get(event.address);
      if (escrowRecord) {
        // decline()/cancelExpired() emit their own event first and already
        // released TVL; avoid double-subtraction.
        const alreadyFinalized = TERMINAL_STATES.includes(escrowRecord.state);
        escrowRecord.state = "REFUNDED";
        escrowRecord.resolvedAt = timestamp;
        escrowRecord.buyerReceived = args.amount;
        if (!alreadyFinalized) releaseTvl(state, escrowRecord.amount);
      }
      addLog(state, event, {
        escrowAddress: event.address,
        userAddress: args.buyer,
        eventData: { buyer: args.buyer, amount: args.amount.toString() },
      });
      return;
    }

    case "ESCROW:SplitProposed": {
      const escrowRecord = state.escrows.get(event.address);
      if (escrowRecord) {
        // Proposer auto-approves their own proposal
        const isBuyer = lower(args.proposer) === escrowRecord.buyer;
        escrowRecord.splitProposer = lower(args.proposer);
        escrowRecord.proposedBuyerBps = Number(args.buyerBps);
        escrowRecord.proposedSellerBps = Number(args.sellerBps);
        escrowRecord.buyerApprovedSplit = isBuyer;
        escrowRecord.sellerApprovedSplit = !isBuyer;
      }
      addLog(state, event, {
        escrowAddress: event.address,
        userAddress: args.proposer,
        eventData: {
          proposer: args.proposer,
          buyerBps: Number(args.buyerBps),
          sellerBps: Number(args.sellerBps),
        },
      });
      return;
    }

    case "ESCROW:SplitProposalCancelled": {
      const escrowRecord = state.escrows.get(event.address);
      if (escrowRecord) {
        escrowRecord.splitProposer = null;
        escrowRecord.proposedBuyerBps = null;
        escrowRecord.proposedSellerBps = null;
        escrowRecord.buyerApprovedSplit = null;
        escrowRecord.sellerApprovedSplit = null;
      }
      addLog(state, event, {
        escrowAddress: event.address,
        userAddress: args.previousProposer,
        eventData: {
          previousProposer: args.previousProposer,
          previousBuyerBps: Number(args.previousBuyerBps),
          previousSellerBps: Number(args.previousSellerBps),
        },
      });
      return;
    }

    case "ESCROW:SplitApproved": {
      const escrowRecord = state.escrows.get(event.address);
      if (escrowRecord) {
        if (lower(args.approver) === escrowRecord.buyer) {
          escrowRecord.buyerApprovedSplit = true;
        } else {
          escrowRecord.sellerApprovedSplit = true;
        }
      }
      addLog(state, event, {
        escrowAddress: event.address,
        userAddress: args.approver,
        eventData: { approver: args.approver },
      });
      return;
    }

    case "ESCROW:SplitExecuted": {
      const escrowRecord = state.escrows.get(event.address);
      if (escrowRecord) {
        Object.assign(escrowRecord, {
          state: "SPLIT",
          resolvedAt: timestamp,
          buyerReceived: args.buyerAmount,
          sellerReceived: args.sellerAmount,
          splitProposer: null,
          proposedBuyerBps: null,
          proposedSellerBps: null,
          buyerApprovedSplit: null,
          sellerApprovedSplit: null,
        });
        releaseTvl(state, escrowRecord.amount);
      }
      addLog(state, event, {
        escrowAddress: event.address,
        eventData: {
          buyerAmount: args.buyerAmount.toString(),
          sellerAmount: args.sellerAmount.toString(),
        },
      });
      return;
    }

    default:
      // Event has no indexer handler (e.g. ImplementationRegistered)
      return;
  }
}
