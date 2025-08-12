# NEAR Scrappy Template

A minimal template for building NEAR applications. Provides wallet connectivity, RPC communication, and offline signing capabilities without framework overhead.

## Requirements

- Node.js 16+
- Yarn

## Installation

```bash
yarn install
cp .env.example .env  # Optional: Add FastNear API key
```

## Development

```bash
yarn dev        # Development server on port 3001
yarn dev-ai     # Alternative port 3002 for AI sessions
yarn build      # Production build
yarn type-check # TypeScript validation
```

## Architecture

### Core Files

- `src/main.ts` - Application entry point, UI state management, event handlers
- `src/wallet-selector.ts` - Wallet connection interface using @near-wallet-selector/core v9.3
- `src/auth.ts` - Local key pair generation and storage utilities
- `src/near-helpers.ts` - NEAR API wrapper functions for common operations
- `src/offline.ts` - Canonical JSON signing implementation for offline signatures
- `src/rpc.ts` - FastNear RPC authentication and request helpers
- `src/env.d.ts` - TypeScript environment variable declarations

### Dependencies

- `near-api-js@6.2.5` - NEAR Protocol JavaScript API
- `@near-wallet-selector/*@9.3.0` - Wallet connection modules
- `bs58` - Base58 encoding/decoding
- `vite@5.0.0` - Build tool and development server
- `typescript@5.9.2` - Optional type checking

## Configuration

### Environment Variables

- `VITE_FASTNEAR_API_KEY` - Optional API key for FastNear RPC endpoints

### Network Selection

Network is auto-detected based on hostname:
- `localhost` → testnet
- `*.vercel.app` → mainnet
- `*.netlify.app` → mainnet
- Default → testnet

## API Usage

### RPC Calls

```typescript
import { rpcCall } from './rpc'

const account = await rpcCall<AccountView>(
  'https://rpc.testnet.fastnear.com',
  'query',
  {
    request_type: 'view_account',
    account_id: 'example.testnet',
    finality: 'final'
  }
)
```

### Wallet Connection

```typescript
import { initWalletSelector, showWalletModal, getWalletInfo } from './wallet-selector'

// Initialize selector with optional contract ID
const selector = await initWalletSelector('contract.testnet')

// Display wallet selection modal
showWalletModal()

// Get current wallet state
const { wallet, accounts } = await getWalletInfo()
```

### Offline Signing

```typescript
import { signOffline } from './offline'
import { KeyPair } from '@near-js/crypto'

const keyPair = KeyPair.fromRandom('ed25519')
const payload = { message: 'Sign this', timestamp: Date.now() }

const { envelope, signature_b58 } = signOffline(keyPair, payload, {
  network: 'testnet',
  ttlSeconds: 300,
  aud: 'myservice.com'
})
```

### View Methods

```typescript
import { viewMethod } from './near-helpers'

const result = await viewMethod(
  provider,
  'contract.testnet',
  'get_status',
  { account_id: 'user.testnet' }
)
```

## Offline Signature Format

The template implements a custom offline signature envelope:

```json
{
  "offline_signature": {
    "v": 1,
    "algo": "ed25519",
    "context": "fastnear.offline",
    "network": "testnet",
    "public_key": "ed25519:...",
    "nonce": "base58_random_bytes",
    "iat": 1234567890,
    "exp": 1234568190,
    "aud": "optional_audience",
    "origin": "https://example.com",
    "payload": { "custom": "data" }
  }
}
```

Signatures are canonical JSON (sorted keys) to ensure consistent byte representation.

## Key Management

For demonstration purposes, the template stores generated key pairs in localStorage:
- Key format: `near_key_{accountId}`
- Storage format: `{ accountId, publicKey, keyPairString, created }`

This approach is not suitable for production use.

## Wallet Integration

Supported wallets:
- MyNearWallet
- Meteor Wallet
- InTEAR Wallet

The wallet selector manages its own key storage and signing. The offline signing functionality is separate and intended for custom authentication flows.

## TypeScript Usage

TypeScript is configured for development assistance but not enforcement:
- `allowJs: true` - JavaScript files are supported
- `checkJs: true` - Type checking for JS files
- `strict: false` - Relaxed type checking
- `noImplicitAny: false` - Implicit any allowed

## Build Output

Production builds are output to `dist/` directory. The build uses Vite's default optimizations including:
- Module bundling
- Tree shaking
- Minification
- Asset optimization

## Limitations

- Local key storage is not secure for production
- No transaction construction helpers
- No contract deployment utilities
- Limited error handling examples
- No test framework included

## Technical Decisions

1. **Direct JsonRpcProvider** - Avoids complexity of `nearAPI.connect()` pattern
2. **No lazy loading** - All imports are static for simplicity
3. **Vanilla event handlers** - No framework abstractions
4. **Single HTML file** - All UI elements defined in index.html
5. **CSS in HTML** - Styles included directly, no build step required