# Wallet Integration Documentation for Principal Engineer

This document compiles discoveries about NEAR wallet integration patterns, particularly around `createAccessKeyFor` and offline signing. Given wallet-selector's maintenance issues, this serves as critical documentation.

## Repository Context

This investigation was conducted in a bare-bones NEAR template repository designed for quick prototyping. The codebase includes:
- Wallet-selector integration with `createAccessKeyFor` support
- FN-OS1 (FastNear Offline Signature v1) implementation
- Discovery of wallet key storage patterns

### Key Files for Reference
- [`src/wallet-selector.ts`](./src/wallet-selector.ts) - Wallet integration code
- [`src/near-helpers.ts`](./src/near-helpers.ts) - Contains `getFunctionCallKey()` that searches for wallet keys
- [`src/offline-signature.js`](./src/offline-signature.js) - FN-OS1 implementation
- [`WALLET_KEY_STORAGE_PATTERNS.md`](./WALLET_KEY_STORAGE_PATTERNS.md) - Documented wallet storage patterns

### External Code References
- [Wallet-selector core options](https://github.com/near/wallet-selector/blob/main/packages/core/src/lib/options.types.ts) - Shows `createAccessKeyFor` option
- [Meteor wallet implementation](https://github.com/near/wallet-selector/blob/main/packages/meteor-wallet/src/lib/meteor-wallet.ts) - Uses `_meteor_wallet` prefix
- [Intear wallet implementation](https://github.com/near/wallet-selector/blob/main/packages/intear-wallet/src/lib/intear-wallet.ts) - Stores comprehensive key data

## What We Discovered

### High Confidence Findings
1. **Wallet Key Storage**: When `createAccessKeyFor` is configured in wallet-selector:
   - MyNearWallet stores keys at `localStorage.getItem('functionCallKey')`
   - Meteor Wallet stores at `localStorage.getItem('_meteor_wallet${accountId}:${network}')`
   - Intear Wallet stores at `localStorage.getItem('_intear_wallet_connected_account')`

2. **Key Access Pattern**: We initially had a `findExistingKey()` function that searched localStorage for wallet keys - this was identified as a bad practice and removed.

3. **Alternative Approaches**:
   - Some wallets support `wallet.signMessage()` for NEP-413 message signing
   - Create-near-app templates comment out `createAccessKeyFor` entirely

### Conflicting Patterns Observed
- The codebase initially searched for and used wallet-stored keys directly
- Documentation suggests this violates wallet abstraction principles
- But wallets ARE storing these keys in accessible localStorage
- Create-near-app avoids this entirely by not using `createAccessKeyFor`

## 1. Wallet Integration Architecture

### Current Understanding
- Wallet-selector provides a unified interface for multiple NEAR wallets
- Direct private key access from wallets violates security boundaries
- Different wallets have different capabilities (some support `signMessage()`, others don't)

### Questions
1. **Function-Call Keys vs Full Access Keys**: What's the recommended approach for applications that need consistent offline signing capabilities across all wallet types? Should we:
   - Only support wallets with `signMessage()` capability?
   - Generate app-specific keys for offline signing (separate from wallet keys)?
   - Use function-call keys when available, fall back to other methods?
   - **Use `createAccessKeyFor` to get official wallet-generated function-call keys?**

2. **MyNearWallet Behavior**: MyNearWallet stores function-call keys in localStorage after redirect. Is this:
   - A legacy pattern that should be avoided?
   - Still acceptable for specific use cases?
   - Something that will be deprecated in future wallet versions?

3. **Cross-Wallet Compatibility**: How should applications handle the inconsistent capabilities across wallets?
   - Some wallets support NEP-413 message signing
   - Some wallets expose function-call keys
   - Some wallets provide neither

## 2. Offline Signature Standards

### Current Understanding
- We implemented FN-OS1 (FastNear Offline Signature v1) with dual-curve support
- NEP-413 is the wallet standard for message signing
- Different signature formats serve different purposes

### Questions
1. **Standards Alignment**: Should FN-OS1 align more closely with NEP-413, or are they solving different problems?
   - NEP-413: Wallet-based message signing with user interaction
   - FN-OS1: Application-level offline signatures with deterministic canonicalization

2. **Curve Support**: Is dual-curve support (Ed25519 + Secp256k1) necessary for NEAR applications?
   - Ed25519 is NEAR's native curve
   - Secp256k1 provides Ethereum compatibility
   - What are the real-world use cases for each?

## 3. Security Model

### Current Understanding
- Accessing wallet keys directly (via localStorage) is a security anti-pattern
- Wallet-selector provides proper abstractions for secure operations
- Different security models for different wallet types

### Questions
1. **Key Storage**: For applications that need persistent signing capabilities without user interaction:
   - Is generating app-specific keys acceptable?
   - How should these keys be stored securely in the browser?
   - What's the recommended key rotation strategy?

2. **Trust Boundaries**: Where should the trust boundaries be drawn?
   - Wallet ↔ Application
   - Application ↔ Contract
   - Browser ↔ External Services

## 4. Transaction Patterns

### Current Understanding
- `createAccessKeyFor` option in wallet-selector can generate function-call keys
- Create-near-app templates commented this out in favor of simpler patterns
- Different approaches for different use cases
- **KEY INSIGHT**: When `createAccessKeyFor` is used:
  - Wallet-selector generates a local key pair
  - The wallet is asked to add this key to the user's account during sign-in
  - MyNearWallet stores this function-call key in localStorage
  - This enables contract calls without further wallet interaction

### Questions
1. **Access Key Strategy**: When should applications use `createAccessKeyFor`?
   - Pros: Enables contract calls without wallet interaction
   - Cons: More complex user experience, key management overhead
   - Is this pattern being phased out?
   - Is this the "proper" way to get local keys for offline signing?

2. **Wallet Redirects**: How should applications handle wallet redirects gracefully?
   - Callback URL handling
   - State preservation across redirects
   - Error recovery patterns

## 5. Implementation Patterns

### Questions
1. **Iframe Communication**: You mentioned "iframe logic happening" - what security considerations should we be aware of for wallet iframe communication?

2. **Best Practices**: What are the current best practices for:
   - Wallet connection flow
   - Transaction signing UX
   - Error handling and recovery
   - Multi-wallet support

3. **Future Direction**: What's the roadmap for NEAR wallet infrastructure?
   - Will there be more standardization across wallets?
   - Are there new standards in development?
   - How should applications prepare for future changes?

## 6. Testing and Development

### Questions
1. **Local Development**: What's the recommended approach for testing wallet integrations locally?
   - Mock wallets?
   - Testnet best practices?
   - Integration testing strategies?

2. **Debugging**: How should developers debug wallet-related issues?
   - Common pitfalls to avoid
   - Diagnostic tools or techniques
   - Logging best practices

## Summary

**Key Finding**: Accessing localStorage keys IS the intended pattern. The confusion arose from wallet-selector's poor maintenance and lack of documentation.

### What This Investigation Provides

1. **Comprehensive wallet storage documentation** - Previously undocumented patterns
2. **Working implementation** - `getFunctionCallKey()` handles all known variations
3. **Reference for future developers** - Don't have to reverse-engineer each wallet
4. **Pragmatic signing approach** - Simple by default, FN-OS1 optional

### Maintenance Concerns

Given that wallet-selector is in a near-abandoned state:
- No maintainers who understand wallet implementations
- Documentation is sparse or outdated
- Different wallets evolved different patterns with no coordination
- This reference implementation helps fill the gap

### Recommendations Going Forward

1. **Use localStorage keys** - It's what the wallets expect
2. **Document quirks as discovered** - Build institutional knowledge
3. **Consider wallet-selector fork** - If degradation continues
4. **Share this reference** - Help other developers avoid the same confusion

## Additional Context: What We Tried and Learned

### Unintuitive Discoveries

1. **nearAPI.connect() is problematic**
   - Initially tried the "standard" connection pattern from docs
   - Hit InMemorySigner compatibility issues
   - Solution: Use `new nearAPI.providers.JsonRpcProvider()` directly
   - This isn't well documented but works much better

2. **Wallet storage is wallet-specific, not wallet-selector specific**
   - Expected wallet-selector to abstract storage
   - Reality: Each wallet implements its own localStorage pattern
   - No standardization even for the same `createAccessKeyFor` feature

3. **Create-near-app comments out the feature we needed**
   ```javascript
   // createAccessKeyFor: HelloNearContract,  // <- Commented out!
   ```
   - This seems to be intentional to avoid complexity
   - But then how do apps do offline signing?

### Failed Attempts

1. **Tried to use wallet.signMessage() consistently**
   - Not all wallets support it
   - MyNearWallet redirects away from the app
   - Can't rely on this for seamless UX

2. **Attempted to find documentation on key access patterns**
   - No official docs on whether accessing localStorage keys is acceptable
   - Wallet source code shows they store keys there
   - But best practices remain unclear

3. **Looked for a "getPrivateKey()" method in wallet-selector**
   - Doesn't exist (probably for good reasons)
   - But then why do wallets store keys in accessible localStorage?

### Useful References We Found

1. **Wallet Source Code** (most helpful for understanding storage):
   - [Meteor Wallet](https://github.com/near/wallet-selector/blob/main/packages/meteor-wallet/src/lib/meteor-wallet.ts#L23-L26) - Shows `_meteor_wallet` prefix
   - [Intear Wallet](https://github.com/near/wallet-selector/blob/main/packages/intear-wallet/src/lib/intear-wallet.ts#L26) - Shows comprehensive storage
   - [MyNearWallet](https://github.com/near/wallet-selector/tree/main/packages/my-near-wallet) - Uses `functionCallKey`

2. **Wallet Selector Core**:
   - [Options Type Definition](https://github.com/near/wallet-selector/blob/main/packages/core/src/lib/options.types.ts#L53-L60) - Shows `createAccessKeyFor` structure
   - [Core Module](https://github.com/near/wallet-selector/blob/main/packages/core/src/lib/wallet-selector.ts) - No key access methods

3. **Example Apps**:
   - [Create-near-app templates](https://github.com/near/create-near-app/tree/main/templates) - Notably avoid `createAccessKeyFor`
   - [NEAR Guest Book](https://github.com/near-examples/guest-book) - Uses simpler patterns

### Key Technical Details

1. **Function-Call Key Permissions**:
   - Limited to specified contract (or all if null)
   - Limited to specified methods (or all if empty array)
   - Cannot transfer tokens or delete keys
   - Perfect for app-specific actions, but...

2. **The Signing Dilemma**:
   ```javascript
   // What we want:
   const signature = await signOffline(data)
   
   // What we have:
   // Option 1: wallet.signMessage() - not always available
   // Option 2: localStorage keys - feels hacky
   // Option 3: Generate own keys - loses wallet integration benefits
   ```

3. **Cross-Wallet Compatibility Matrix**:
   | Wallet | Stores Keys | signMessage() | Notes |
   |--------|-------------|---------------|--------|
   | MyNearWallet | ✅ | ✅ (redirects) | Both options suboptimal |
   | Meteor | ✅ | ✅ | Best of both? |
   | Intear | ✅ | ✅ | Comprehensive storage |

### Final Thoughts

The core issue seems to be a mismatch between:
- What `createAccessKeyFor` enables (local key storage)
- What best practices suggest (don't access wallet keys)
- What apps actually need (offline signing capability)

Either accessing stored keys is acceptable (then why isn't it documented?), or there's a better pattern we're missing. The fact that create-near-app avoids this entirely suggests the latter, but then how do production apps handle offline signing?