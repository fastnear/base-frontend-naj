# CLAUDE.md — AI-Optimized Documentation for Claude Code

This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with this repository. It emphasizes technical continuity, autonomous development workflows, and architectural understanding.

**📚 IMPORTANT**: This codebase serves as a reference implementation for NEAR wallet integration with offline signing, documenting patterns that are poorly maintained in wallet-selector.

## Project Context

This is a bare-bones NEAR template designed for quick prototyping - the kind of thing you'd copy for a 20-minute watercooler idea. No frills, no framework overhead, just the essentials to connect a NEAR testnet account and interact with contracts.

## Knowledge Certainty Levels

### High Certainty (✅ Tested & Verified)
- Wallet-selector's `createAccessKeyFor` option generates function-call keys during sign-in
- Different wallets store these keys in distinct localStorage patterns (documented in [`WALLET_KEY_STORAGE_PATTERNS.md`](./WALLET_KEY_STORAGE_PATTERNS.md))
- FN-OS1 offline signature format works with both Ed25519 and Secp256k1 curves
- Direct JsonRpcProvider usage is more reliable than legacy `nearAPI.connect()` patterns
- TypeScript configuration provides error checking without enforcing .ts files

### Medium Certainty (⚠️ Observed but needs more testing)
- Function-call keys from wallets can be used for offline signing (works but security implications unclear)
- Wallet storage patterns may vary by wallet version
- Some wallets (like Meteor) might not store contract/method restrictions with keys

### Low Certainty (❓ Questions remain)
- How wallets handle key revocation and cleanup
- Cross-device logout mechanisms (Intear has it, others unclear)
- Long-term viability of wallet-selector given maintenance issues
- Why create-near-app avoids `createAccessKeyFor` (simplicity vs other reasons)

## Critical Context for AI Sessions

### Autonomous Development Workflow

#### Available Scripts
- `yarn dev` - Development server on port 3001
- `yarn dev-ai` - Development server on port 3002 (for AI sessions)
- `yarn build` - Production build
- `yarn preview` - Preview production build

#### Script Execution Pattern
**CRITICAL**: Always use `ai-output.txt` for command output to prevent git pollution:

```bash
# For type checking and building
yarn type-check && yarn build > ai-output.txt 2>&1

# For testing dev server (with timeout to prevent hanging)
timeout 5 yarn dev-ai > ai-output.txt 2>&1
```

After running commands:
1. Read the output file
2. Parse for errors or warnings (now with file:line numbers!)
3. Fix any issues found
4. Re-run to verify fixes (overwrites the same file)

Note: `ai-output.txt` is in `.gitignore` to keep the repository clean

## Technical Decisions & Key Insights

### Build System
- **Using Vite** - Simple, fast, good module support
- No TypeScript enforcement - vanilla JS for quick hacking

### Package Management
- **Using Yarn with traditional node_modules** via `.yarnrc.yml`: `nodeLinker: node-modules`
- **Why**: Essential for exploring type definitions in node_modules

### NEAR Connection Approach
- **Avoided `nearAPI.connect()`** - This older pattern has InMemorySigner compatibility issues
- **Use direct JsonRpcProvider** instead:
  ```javascript
  const provider = new nearAPI.providers.JsonRpcProvider({ url, headers })
  ```
- **Key insight**: The modern near-api-js supports direct provider usage without the connection ceremony
- **Why this matters**: Many examples still show `nearAPI.connect()` but it creates unnecessary complexity and version conflicts

### Authentication Pattern
- FastNear RPC with Bearer token for higher rate limits
- Environment variable pattern: `VITE_FASTNEAR_API_KEY` (Vite requires `VITE_` prefix)
- Only add headers when API key exists (don't set undefined headers)

### Key Management Philosophy
- **Login = Creating function-call access key** (not full access)
- Store keys in localStorage for prototyping (obviously not production-ready)
- Generate keys locally, but adding them to account requires existing key (wallet redirect)
- Multi-wallet key discovery: checks MyNearWallet, Meteor wallet, Intear wallet, and standard formats
- **createAccessKeyFor**: When configured with a contractId, enables wallets to create and store function-call keys locally

### Ergonomic Helpers Created
Created `near-helpers.js` to fix awkward near-api-js patterns:
- `createProvider()` - Simple provider setup with optional auth
- `detectNetwork()` - Auto-detect testnet/mainnet based on hostname
- `accountExists()` - Clean boolean check instead of catching errors
- `getBalance()` - Returns formatted NEAR amounts, not yocto strings
- `signOfflineMessage()` - FN-OS1 offline signing with dual-curve support
- `verifyOfflineMessage()` - Verify FN-OS1 signatures
- `verifyKeyOnChain()` - Check if a public key belongs to an account
- `getFunctionCallKey()` - Finds function-call keys from various wallet storage locations
- `viewMethod()` - Easy contract view calls with auto-parsing
- `buildAddKeyAction()` - Helper for adding function-call keys

### Offline Signature Approach

**Default: Simple Signing** (Pragmatic, "just works")
```javascript
// Uses simple JSON stringify + sign approach
const signed = await signOfflineMessage({
  payload: { action: "authenticate" },
  keyPair,
  accountId: "alice.testnet"
})
// Returns: { message, signature, publicKey, accountId }
```

**Optional: FN-OS1** (Full specification with advanced features)
- Set `USE_FN_OS1 = true` in `simple-offline-signature.js` to enable
- Adds replay protection, TTL, deterministic canonicalization
- Dual-curve support (Ed25519 + Secp256k1)
- See [`FN-OS1.md`](./FN-OS1.md) for complete specification

This two-tier approach allows internal workflows to proceed without being blocked by finalizing the offline signature standard.

### TypeScript Approach
- **Not enforcing TypeScript** - This is for quick hacking
- But we have TypeScript configured for better error messages!
- Run `yarn type-check` to get detailed errors with file paths and line numbers
- Benefits:
  - Catches null/undefined errors before runtime
  - Shows exact line numbers for issues
  - IntelliSense improvements in VS Code
  - Type checking without converting to .ts files
- Key type files to reference:
  - `@near-js/providers/lib/esm/json-rpc-provider.d.ts`
  - `@near-js/crypto/lib/esm/key_pair_ed25519.d.ts`
  - `@near-js/transactions/lib/esm/action_creators.d.ts`

## Wallet Key Storage Patterns

When `createAccessKeyFor` is configured, different wallets store function-call keys differently:
- **MyNearWallet**: `functionCallKey` (JSON with privateKey, contractId, methods)
- **Meteor Wallet**: `_meteor_wallet${accountId}:${network}` (raw key string)
- **Intear Wallet**: `_intear_wallet_connected_account` (JSON with comprehensive data)

See [`WALLET_KEY_STORAGE_PATTERNS.md`](./WALLET_KEY_STORAGE_PATTERNS.md) for detailed documentation.

## What This Template Is NOT
- Not a production-ready authentication system
- Not a full-featured NEAR dApp framework
- Not trying to implement every NEAR feature
- Not following NEPs unless absolutely necessary

## Wallet Selector Integration
Successfully integrated @near-wallet-selector/core v9.3.0:
- Provides professional wallet connection UI
- Supports MyNearWallet, Meteor Wallet, Intear Wallet
- Handles wallet state management and persistence
- Works alongside our ergonomic helpers
- Version mismatch with near-api-js v6 handled via yarn overrides

### Wallet Selector Setup
```javascript
// Initialize with optional contract ID for function-call keys
await initWalletSelector(contractId)

// Show wallet modal
await showWalletModal()

// Subscribe to state changes
onWalletChange((state) => {
  // Handle account changes
})
```

## Next Steps / TODOs
- [ ] Implement actual wallet redirect for adding function-call keys
- [ ] Add simple contract interaction example
- [ ] Create transaction signing with stored keys
- [ ] Add example of calling a specific contract method

## Common Issues & Solutions

### Issue: TypeScript errors with near-api-js
**Solution**: We're using vanilla JS, so these don't affect us. The types are there for reference only.

### Issue: RPC rate limiting
**Solution**: Use FastNear API key in `.env` file

### Issue: Can't find type definitions
**Solution**: Make sure `.yarnrc.yml` has `nodeLinker: node-modules` and reinstall

## Key Files
- [`src/near-helpers.ts`](./src/near-helpers.ts) - Ergonomic wrappers around near-api-js
- [`src/simple-offline-signature.js`](./src/simple-offline-signature.js) - Simple signing (default, pragmatic)
- [`src/offline-signature.js`](./src/offline-signature.js) - FN-OS1 implementation (optional, full spec)
- [`src/auth.ts`](./src/auth.ts) - Key pair management utilities (DEPRECATED)
- [`src/main.ts`](./src/main.ts) - Main application logic
- [`src/wallet-selector.ts`](./src/wallet-selector.ts) - Wallet connection integration
- [`FN-OS1.md`](./FN-OS1.md) - Complete offline signature specification
- [`WALLET_KEY_STORAGE_PATTERNS.md`](./WALLET_KEY_STORAGE_PATTERNS.md) - How wallets store function-call keys
- [`QUESTIONS_FOR_PRINCIPAL_ENGINEER.md`](./QUESTIONS_FOR_PRINCIPAL_ENGINEER.md) - Architectural questions and uncertainties
