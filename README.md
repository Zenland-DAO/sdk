# @zenland/sdk

Official SDK for interacting with the Zenland escrow protocol indexer.

## Installation

```bash
npm install @zenland/sdk
# or
yarn add @zenland/sdk
# or
pnpm add @zenland/sdk
```

## Usage

### Core SDK (Framework Agnostic)

The core SDK works in any JavaScript/TypeScript environment (Node.js, browsers, etc.):

```typescript
import { createZenlandClient, zenland } from '@zenland/sdk';

// Use the default client (production API at https://api.zen.land)
const escrows = await zenland.escrows.list();

// Or create a custom client with a different endpoint
const client = createZenlandClient({ baseUrl: 'http://localhost:42069' });

// Fetch escrows
const { items, totalCount } = await client.escrows.list({ limit: 10 });

// Fetch a specific escrow
const escrow = await client.escrows.getById('0x...');

// Fetch escrows for a user
const userEscrows = await client.escrows.getByUser('0x...', {
  states: ['ACTIVE', 'PENDING'],
});

// Fetch agents
const agents = await client.agents.list({ onlyActive: true });

// Fetch a specific agent
const agent = await client.agents.getById('0x...');

// Fetch protocol stats
const stats = await client.protocolStats.get();

// Fetch transaction logs for an escrow
const logs = await client.transactionLogs.getByEscrow('0x...');
```

### React Hooks

For React applications, use the React integration with built-in caching via React Query:

```tsx
import { ZenlandProvider, useEscrows, useAgent, useProtocolStats } from '@zenland/sdk/react';

// Wrap your app with the provider
function App() {
  return (
    <ZenlandProvider>
      <MyComponent />
    </ZenlandProvider>
  );
}

// With custom config (e.g., for local development)
function App() {
  return (
    <ZenlandProvider config={{ baseUrl: 'http://localhost:42069' }}>
      <MyComponent />
    </ZenlandProvider>
  );
}

// Use the hooks in your components
function MyComponent() {
  // Fetch escrows for a connected user
  const { data: escrows, isLoading } = useEscrows({
    address: '0x...', // User's wallet address
    role: 'buyer',    // Filter by role: 'all' | 'buyer' | 'seller' | 'agent'
    stateTab: 'ACTIVE', // Filter by state group
  });

  // Fetch a single agent
  const { data: agent } = useAgent('0x...');

  // Fetch protocol stats
  const { data: stats } = useProtocolStats();

  if (isLoading) return <div>Loading...</div>;

  return (
    <ul>
      {escrows?.items.map(escrow => (
        <li key={escrow.id}>{escrow.state}</li>
      ))}
    </ul>
  );
}
```

### Peer Dependencies for React

When using `@zenland/sdk/react`, you need to have these peer dependencies installed:

```bash
npm install react @tanstack/react-query
```

## API Reference

### Core Client

#### `createZenlandClient(config?)`

Creates a new Zenland SDK client.

```typescript
interface ZenlandClientConfig {
  baseUrl?: string; // Default: 'https://api.zen.land'
}
```

#### `zenland`

A default client instance using the production API.

### Escrows

```typescript
// List escrows with filters
client.escrows.list({
  limit?: number,
  offset?: number,
  buyer?: string,
  seller?: string,
  agent?: string,
  user?: string,     // Search across all roles
  state?: string,
  states?: string[], // Multiple states
});

// Get a single escrow
client.escrows.getById(id: string);

// Get escrows for a user (all roles)
client.escrows.getByUser(address: string, options?);

// Get escrows by state group
client.escrows.getByStateGroup('ACTIVE' | 'IN_DISPUTE' | 'COMPLETED', options?);
```

### Agents

```typescript
// List agents
client.agents.list({
  limit?: number,
  offset?: number,
  onlyActive?: boolean,
  onlyAvailable?: boolean,
});

// Get a single agent
client.agents.getById(id: string);

// Get available agents
client.agents.getAvailable(options?);
```

### Protocol Stats

```typescript
// Get global protocol statistics
client.protocolStats.get();

// Get raw stats (without BigInt conversion)
client.protocolStats.getRaw();
```

### Transaction Logs

```typescript
// List transaction logs
client.transactionLogs.list({
  escrowAddress?: string,
  limit?: number,
  offset?: number,
});

// Get logs for an escrow
client.transactionLogs.getByEscrow(escrowAddress: string, options?);

// Parse event data
client.transactionLogs.parseEventData(eventData: string);
```

## State Groups

Escrows can be filtered by state groups:

```typescript
import { STATE_GROUPS } from '@zenland/sdk';

// STATE_GROUPS.ACTIVE = ['PENDING', 'ACTIVE', 'FULFILLED']
// STATE_GROUPS.IN_DISPUTE = ['DISPUTED', 'AGENT_INVITED']
// STATE_GROUPS.COMPLETED = ['RELEASED', 'AGENT_RESOLVED', 'REFUNDED', 'SPLIT']
```

## Error Handling

```typescript
import { ZenlandGraphQLError, ZenlandRequestError } from '@zenland/sdk';

try {
  const escrow = await client.escrows.getById('0x...');
} catch (error) {
  if (error instanceof ZenlandGraphQLError) {
    console.error('GraphQL errors:', error.errors);
  } else if (error instanceof ZenlandRequestError) {
    console.error('Request failed:', error.status, error.statusText);
  }
}
```

## TypeScript

The SDK is fully typed. You can import types directly:

```typescript
import type {
  GqlEscrow,
  GqlAgent,
  GqlProtocolStats,
  GqlEscrowPage,
  GqlAgentPage,
} from '@zenland/sdk';
```

## License

MIT
