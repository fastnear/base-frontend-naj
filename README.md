# NEAR Scrappy Template

A minimal, no-nonsense template for quickly building NEAR apps. No frameworks, no TypeScript burden - just vanilla JS with Vite for fast dev experience.

## Features

- **Wallet Selector integration** - Professional wallet connection UI
- Direct `JsonRpcProvider` usage (avoids `nearAPI.connect()` complexity)
- FastNear RPC support with Bearer token authentication
- Multi-wallet support (MyNearWallet, HERE, Meteor)
- Local key pair generation and storage
- Session persistence
- Dark mode UI by default
- Network auto-detection (testnet/mainnet)

## Quick Start

```bash
# Install dependencies
yarn install

# Copy env example
cp .env.example .env

# Add your FastNear API key (optional but recommended)
# Get one at: https://fastnear.com

# Start dev server
yarn dev     # port 3001
yarn dev-ai  # port 3002

# Build for production
yarn build
```

## Architecture

```
index.html          # Entry point with minimal UI
src/
  main.js          # Core app logic, provider setup, UI handling
  auth.js          # Key pair generation and storage utilities
```

## Key Patterns

### Direct Provider Usage
```javascript
const provider = new nearAPI.providers.JsonRpcProvider({
  url: 'https://rpc.testnet.fastnear.com',
  headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : undefined
})
```

### Simple Account Queries
```javascript
const account = await provider.query({
  request_type: 'view_account',
  finality: 'final',
  account_id: accountId
})
```

## Wallet Selector

The template includes @near-wallet-selector for professional wallet integration:

```javascript
// Set CONTRACT_ID in main.js to create function-call access keys
const CONTRACT_ID = 'guest-book.testnet'

// Wallet selector handles:
// - Multiple wallet options
// - Connection persistence  
// - State management
// - User-friendly UI
```

## TODO

- Implement contract interaction examples using wallet selector
- Add transaction signing examples
- Create more helper functions for common patterns

## Notes

- This template uses testnet by default
- Keys are stored in localStorage (not for production use)
- The InMemorySigner issue is avoided by using direct provider calls