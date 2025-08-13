# Wallet Maintenance Guide

Since wallet-selector lacks active maintenance, this guide helps developers work with NEAR wallets effectively.

## Current State (as of discovery)

- **Wallet-selector version**: 9.3.0
- **Maintenance status**: Near-abandoned, but still functional
- **Key insight**: Each wallet implements storage differently with no coordination

## How to Add Support for New Wallets

When a new wallet appears or existing wallet changes:

1. **Install the wallet and test `createAccessKeyFor`**:
   ```javascript
   createAccessKeyFor: {
     contractId: 'test.testnet',
     methodNames: []
   }
   ```

2. **After sign-in, check localStorage**:
   ```javascript
   // Look for new keys
   Object.keys(localStorage).forEach(key => {
     const value = localStorage.getItem(key)
     if (value && value.includes('ed25519:')) {
       console.log('Potential key storage:', key)
     }
   })
   ```

3. **Update `getFunctionCallKey()` in [`near-helpers.ts`](./src/near-helpers.ts)**:
   ```javascript
   // Add new wallet pattern
   try {
     const newWalletKey = localStorage.getItem('new_wallet_pattern')
     if (newWalletKey) {
       // Parse and return
     }
   } catch (e) {
     console.log('No key in NewWallet format')
   }
   ```

4. **Document in [`WALLET_KEY_STORAGE_PATTERNS.md`](./WALLET_KEY_STORAGE_PATTERNS.md)**

## Common Wallet Quirks

### MyNearWallet
- Stores comprehensive JSON with contract info
- Redirects for message signing
- Most "standard" implementation

### Meteor Wallet
- Simple key storage without contract info
- Supports in-page message signing
- Uses account-specific key names

### Intear Wallet
- Most comprehensive storage (includes logout keys)
- Supports cross-device logout
- Good reference for advanced features

## Debugging Tips

1. **Use the Debug button**: Our UI includes "Debug: List Keys" to show all potential keys

2. **Check wallet source code**:
   - Wallet implementations: `node_modules/@near-wallet-selector/[wallet-name]/src`
   - Look for `localStorage.setItem` calls

3. **Test both flows**:
   - With `createAccessKeyFor` (function-call keys)
   - Without (uses `wallet.signMessage()` if available)

## If Wallet-Selector Breaks

Consider these alternatives:

1. **Direct wallet integration**: Each wallet has its own SDK
2. **Fork wallet-selector**: Maintain critical functionality
3. **Use this reference**: Our `getFunctionCallKey()` covers known patterns

## Testing Checklist

When testing wallet integration:

- [ ] Sign in with `createAccessKeyFor` configured
- [ ] Check if function-call key is stored
- [ ] Test offline signing with stored key
- [ ] Test `wallet.signMessage()` if supported
- [ ] Document storage pattern
- [ ] Update compatibility matrix

## Future-Proofing

1. **Version lock dependencies**: Wallet updates might break patterns
2. **Monitor wallet announcements**: Changes often undocumented
3. **Test regularly**: Wallets update independently
4. **Share findings**: Help the community

---

Remember: The chaos of wallet storage patterns is due to lack of coordination, not bad design. Each wallet solved the problem independently.