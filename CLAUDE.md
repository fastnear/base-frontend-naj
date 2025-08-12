# CLAUDE.md — AI-Optimized Documentation for Claude Code

This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with this repository. It emphasizes technical continuity, autonomous development workflows, and architectural understanding.

## Project Context

This is a bare-bones NEAR template designed for quick prototyping - the kind of thing you'd copy for a 20-minute watercooler idea. No frills, no framework overhead, just the essentials to connect a NEAR testnet account and interact with contracts.

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

### Authentication Pattern
- FastNear RPC with Bearer token for higher rate limits
- Environment variable pattern: `VITE_FASTNEAR_API_KEY` (Vite requires `VITE_` prefix)
- Only add headers when API key exists (don't set undefined headers)

### Key Management Philosophy
- **Login = Creating function-call access key** (not full access)
- Store keys in localStorage for prototyping (obviously not production-ready)
- Generate keys locally, but adding them to account requires existing key (wallet redirect)
- Multi-wallet key discovery: checks NEAR browser keystore, HERE wallet, Meteor wallet, MyNearWallet formats

### Ergonomic Helpers Created
Created `near-helpers.js` to fix awkward near-api-js patterns:
- `createProvider()` - Simple provider setup with optional auth
- `detectNetwork()` - Auto-detect testnet/mainnet based on hostname
- `accountExists()` - Clean boolean check instead of catching errors
- `getBalance()` - Returns formatted NEAR amounts, not yocto strings
- `signOfflineMessage()` - Simple offline signing with consistent wrapper format
- `findExistingKey()` - Searches multiple wallet storage locations
- `viewMethod()` - Easy contract view calls with auto-parsing
- `buildAddKeyAction()` - Helper for adding function-call keys

### Offline Signature Format
Decided on minimal, consistent structure:
```javascript
{
  "offline_signature": {
    // your actual payload here
  }
}
```
No NEPs, no complex standards - just a simple wrapper that's always the same.

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

## What This Template Is NOT
- Not a production-ready authentication system
- Not a full-featured NEAR dApp framework
- Not trying to implement every NEAR feature
- Not following NEPs unless absolutely necessary

## Wallet Selector Integration
Successfully integrated @near-wallet-selector/core v9.3.0:
- Provides professional wallet connection UI
- Supports MyNearWallet, HERE Wallet, Meteor Wallet
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
- `src/near-helpers.js` - Ergonomic wrappers around near-api-js
- `src/auth.js` - Key pair management utilities
- `src/main.js` - Main application logic
