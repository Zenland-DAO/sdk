/**
 * Known Zenland protocol deployments per chain.
 */

export interface ZenlandDeployment {
  escrowFactory: string;
  agentRegistry: string;
  /** First block to scan for events (factory deployment block) */
  startBlock: bigint;
}

export const ZENLAND_DEPLOYMENTS: Record<number, ZenlandDeployment> = {
  // Ethereum mainnet
  1: {
    escrowFactory: "0xba2c6322fd59e2703a28d82db572950297600129",
    agentRegistry: "0x3406c744958b182d6edd2615ff9e53f0fbc60802",
    startBlock: 24525702n,
  },
  // Sepolia
  11155111: {
    escrowFactory: "0x9f5b706288ce48ae26a161664cd6b15b9c9ebc5e",
    agentRegistry: "0x50cdb07a74a1898308eb2331940dd6b9263cce56",
    startBlock: 10231793n,
  },
};
