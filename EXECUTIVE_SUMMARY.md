# Executive Summary: NEAR Wallet Integration Investigation

## Context Update

**The localStorage key access pattern is intended and expected.** The confusion arose from wallet-selector's maintenance issues and lack of documentation, not from the pattern being wrong.

## What We Found

### The Setup
```javascript
// wallet-selector configuration
{
  network: 'testnet',
  createAccessKeyFor: {
    contractId: 'count.mike.testnet',
    methodNames: []
  }
}
```

### The Result
Different wallets store the generated function-call keys in localStorage:
- MyNearWallet: `localStorage.getItem('functionCallKey')`
- Meteor: `localStorage.getItem('_meteor_wallet${accountId}:${network}')`  
- Intear: `localStorage.getItem('_intear_wallet_connected_account')`

### The Discovery
1. Wallet-selector lacks maintainers who understand how different wallets work
2. Each wallet implements key storage differently (no standardization)
3. The pattern of accessing these keys IS intended
4. Create-near-app comments out `createAccessKeyFor` possibly to avoid complexity

## What We've Documented

Since wallet-selector is in a near-abandoned state, we've thoroughly documented:

1. **How each wallet stores keys** - Critical knowledge that was undocumented
2. **Working code to find keys** - `getFunctionCallKey()` checks all known patterns
3. **Compatibility matrix** - Which wallets support what features
4. **Implementation details** - For future maintainers

## Our Current Solution

We implemented a pragmatic two-tier approach:
1. **Simple signing by default** - Just JSON.stringify + sign
2. **FN-OS1 as optional** - Full spec with replay protection, etc.

This lets us proceed without being blocked, but we need architectural guidance.

## Key Documents

1. [`QUESTIONS_FOR_PRINCIPAL_ENGINEER.md`](./QUESTIONS_FOR_PRINCIPAL_ENGINEER.md) - Detailed questions with code examples
2. [`WALLET_KEY_STORAGE_PATTERNS.md`](./WALLET_KEY_STORAGE_PATTERNS.md) - How each wallet stores keys
3. [`src/near-helpers.ts`](./src/near-helpers.ts) - Contains `getFunctionCallKey()` that finds wallet keys

## Value of This Investigation

Given wallet-selector's maintenance state, this investigation provides:

1. **Working implementation** - `getFunctionCallKey()` that handles all known wallet patterns
2. **Comprehensive documentation** - Future developers won't have to reverse-engineer
3. **Pragmatic approach** - Simple signing by default, FN-OS1 when needed
4. **Knowledge preservation** - Critical wallet behaviors now documented

## Recommendations

1. **Continue using localStorage keys** - It's the intended pattern
2. **Use our `getFunctionCallKey()`** - Handles all wallet variations
3. **Consider maintaining a fork** - If wallet-selector continues to degrade
4. **Document wallet quirks** - As we discover them

---

**This repository now serves as a reference implementation for wallet integration with offline signing support.**