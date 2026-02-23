/**
 * GraphQL query strings for the Zenland indexer.
 * These are compiled into the SDK to avoid runtime parsing.
 */

export const AGENT_QUERY = `
query Agent($id: String!) {
  agent(id: $id) {
    id
    isActive
    isAvailable
    stablecoinDecimals
    stablecoinToken
    stablecoinStake
    daoTokenStake
    disputeFeeBps
    assignmentFeeBps
    description
    contact
    totalResolved
    activeCases
    totalEscrowsAssigned
    registrationTime
    lastEngagementTimestamp
    totalEarnings
    totalSlashed
    cases(limit: 5, orderBy: "invitedAt", orderDirection: "desc") {
      items {
        id
        escrow
        invitedAt
        resolvedAt
        timedOut
        escrowRef {
          id
          amount
          token
          state
        }
      }
      totalCount
    }
  }
}
`;

export const AGENTS_QUERY = `
query Agents($where: agentFilter, $orderBy: String, $orderDirection: String, $limit: Int, $offset: Int) {
  agents(where: $where, orderBy: $orderBy, orderDirection: $orderDirection, limit: $limit, offset: $offset) {
    totalCount
    items {
      id
      isActive
      isAvailable
      stablecoinDecimals
      stablecoinStake
      daoTokenStake
      disputeFeeBps
      assignmentFeeBps
      description
      contact
      totalResolved
      activeCases
      totalEscrowsAssigned
      registrationTime
      lastEngagementTimestamp
      totalEarnings
      totalSlashed
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
  }
}
`;

export const ESCROW_QUERY = `
query escrow($id: String!) {
  escrow(id: $id) {
    id
    chainId
    buyer
    seller
    agent
    amount
    token
    state
    createdAt
    sellerAcceptDeadline
    buyerProtectionTime
    termsHash
    version
    fundedAt
    fulfilledAt
    resolvedAt
    agentInvitedAt
    splitProposer
    proposedBuyerBps
    proposedSellerBps
    buyerApprovedSplit
    sellerApprovedSplit
    agentFeeReceived
    buyerReceived
    sellerReceived
    creationFee
  }
}
`;

export const ESCROWS_QUERY = `
query escrows(
  $limit: Int = 30
  $offset: Int = 0
  $orderBy: String = "createdAt"
  $orderDirection: String = "desc"
  $where: escrowFilter
) {
  escrows(
    limit: $limit
    offset: $offset
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    items {
      id
      chainId
      buyer
      seller
      agent
      amount
      token
      state
      createdAt
      fundedAt
      fulfilledAt
      sellerAcceptDeadline
      agentInvitedAt
      buyerProtectionTime
      splitProposer
      buyerApprovedSplit
      sellerApprovedSplit
      proposedBuyerBps
      proposedSellerBps
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
    totalCount
  }
}
`;

export const PROTOCOL_STATS_QUERY = `
query protocolStats($id: String! = "mainnet") {
  protocolStats(id: $id) {
    id
    chainId
    totalEscrowsCreated
    totalVolumeEscrowed
    totalFeesCollected
    currentTVL
    activeEscrowCount
    totalAgentsRegistered
    activeAgentsCount
  }
  agents(where: { isActive: true }, limit: 1000) {
    items {
      stablecoinStake
    }
  }
}
`;

export const RECENT_ESCROWS_QUERY = `
query recentEscrows($limit: Int = 5) {
  escrows(
    limit: $limit
    orderBy: "createdAt"
    orderDirection: "desc"
  ) {
    items {
      id
      amount
      token
      state
      createdAt
    }
  }
}
`;

export const TRANSACTION_LOGS_QUERY = `
query transactionLogs(
  $escrowAddress: String
  $limit: Int
  $offset: Int
  $orderBy: String
  $orderDirection: String
) {
  transactionLogs(
    where: { escrowAddress: $escrowAddress }
    limit: $limit
    offset: $offset
    orderBy: $orderBy
    orderDirection: $orderDirection
  ) {
    items {
      id
      txHash
      blockNumber
      timestamp
      eventName
      contractAddress
      contractType
      escrowAddress
      agentAddress
      userAddress
      eventData
    }
  }
}
`;
