# Knowledge Summary: NEAR Wallet Integration & Offline Signing

## What We Learned with High Certainty ✅

### 1. Wallet Key Storage Patterns
When `createAccessKeyFor` is configured in wallet-selector initialization:
- **MyNearWallet**: Stores at `localStorage.getItem('functionCallKey')` as JSON
- **Meteor Wallet**: Stores at `localStorage.getItem('_meteor_wallet${accountId}:${network}')` as raw key
- **Intear Wallet**: Stores at `localStorage.getItem('_intear_wallet_connected_account')` as comprehensive JSON

### 2. The createAccessKeyFor Option
```javascript
// In wallet-selector initialization
const selectorConfig = {
  network: 'testnet',
  modules: [...],
  createAccessKeyFor: {
    contractId: 'count.mike.testnet',
    methodNames: []  // empty = all methods
  }
}
```
This causes wallet-selector to:
1. Generate a new key pair locally
2. Request the wallet to add it as a function-call key
3. Different wallets store this key differently (see above)

### 3. Alternative Patterns
- **Create-near-app**: Comments out `createAccessKeyFor` entirely, avoiding local key storage
- **NEP-413**: Some wallets support `wallet.signMessage()` for standardized message signing
- **Direct key access**: Possible but questionable from security perspective

## What Remains Uncertain ❓

### 1. Security Boundaries
- Is accessing wallet-stored keys from localStorage acceptable or a violation?
- The keys ARE there and accessible, but should we use them?
- No clear guidance in documentation

### 2. Best Practices
- Should apps use `createAccessKeyFor` + localStorage keys?
- Or exclusively use `wallet.signMessage()` when available?
- Or generate completely separate app-specific keys?

### 3. Future Direction
- Is `createAccessKeyFor` being phased out?
- Will wallets standardize their storage patterns?
- How should apps handle the inconsistency across wallets?

## Our Pragmatic Solution

### Two-Tier Offline Signing
1. **Default: Simple Signing** (`simple-offline-signature.js`)
   - Just JSON.stringify + sign
   - No complex canonicalization
   - Works immediately for internal workflows

2. **Optional: FN-OS1** (`offline-signature.js`)
   - Full specification with replay protection, TTL, etc.
   - Set `USE_FN_OS1 = true` to enable
   - Can be refined without blocking development

### Key Discovery Function
`getFunctionCallKey()` checks all known wallet storage patterns:
- Returns key if found, null otherwise
- Includes source information for debugging
- Falls back to wallet.signMessage() if no keys found

## Files Created/Modified

### Documentation
- [`CLAUDE.md`](./CLAUDE.md) - AI context with certainty levels
- [`WALLET_KEY_STORAGE_PATTERNS.md`](./WALLET_KEY_STORAGE_PATTERNS.md) - Detailed wallet patterns
- [`QUESTIONS_FOR_PRINCIPAL_ENGINEER.md`](./QUESTIONS_FOR_PRINCIPAL_ENGINEER.md) - Unresolved questions
- [`FN-OS1.md`](./FN-OS1.md) - Full offline signature specification

### Code
- [`src/simple-offline-signature.js`](./src/simple-offline-signature.js) - Pragmatic signing (default)
- [`src/offline-signature.js`](./src/offline-signature.js) - FN-OS1 implementation (optional)
- [`src/near-helpers.ts`](./src/near-helpers.ts) - Updated with `getFunctionCallKey()`
- [`src/main.ts`](./src/main.ts) - Uses function-call keys when available

## The Main Paradox

Wallet-selector's `createAccessKeyFor` creates a situation where:
1. Wallets store function-call keys in localStorage
2. These keys are clearly accessible to JavaScript
3. But using them might violate abstraction principles
4. Yet they're the only way to do offline signing with those wallets

This needs clarification from NEAR core team or wallet developers.