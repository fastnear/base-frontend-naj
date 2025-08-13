# NEAR Wallet Key Storage Patterns

This document summarizes how different NEAR wallets store function-call keys when `createAccessKeyFor` is used during wallet-selector initialization.

## Overview

When you configure wallet-selector with `createAccessKeyFor`:
```javascript
const selectorConfig = {
  network: 'testnet',
  modules: [...],
  createAccessKeyFor: {
    contractId: 'count.mike.testnet',
    methodNames: []  // empty array means all methods
  }
}
```

Different wallets handle and store the generated function-call keys differently.

## Wallet Storage Patterns

### 1. MyNearWallet
- **Storage Key**: `functionCallKey`
- **Format**: JSON object
```javascript
{
  "privateKey": "ed25519:base58encodedkey...",
  "contractId": "count.mike.testnet",
  "methods": ["method1", "method2"]
}
```
- **Notes**: Stores the key after redirect flow completes

### 2. Meteor Wallet
- **Storage Key**: `_meteor_wallet${accountId}:${network}`
- **Example**: `_meteor_walletmike.testnet:testnet`
- **Format**: Raw key string (e.g., `ed25519:base58encodedkey...`)
- **Notes**: Uses prefix `_meteor_wallet` with account and network

### 3. Intear Wallet
- **Storage Key**: `_intear_wallet_connected_account`
- **Format**: JSON object
```javascript
{
  "accounts": [{"accountId": "mike.testnet", "publicKey": "ed25519:..."}],
  "key": "ed25519:base58encodedkey...",
  "contractId": "count.mike.testnet",
  "methodNames": ["method1", "method2"],
  "logoutKey": "ed25519:publickey..."
}
```
- **Notes**: Stores comprehensive data including logout key for cross-device logout

### 4. Standard near-api-js Format
- **Storage Key**: `near-api-js:keystore:${accountId}:${network}`
- **Example**: `near-api-js:keystore:mike.testnet:testnet`
- **Format**: Raw key string
- **Notes**: Legacy format used by older NEAR apps

## Security Considerations

1. **Different Trust Models**: Each wallet has its own security model:
   - Some store keys in plaintext (MyNearWallet, Meteor)
   - Some use structured formats with additional metadata (Intear)
   - Storage patterns may change with wallet updates

2. **Key Scope**: Function-call keys are limited to:
   - Specific contract (if contractId provided)
   - Specific methods (if methodNames provided)
   - Cannot transfer tokens or manage account

3. **Storage Security**: All keys are stored in localStorage:
   - Vulnerable to XSS attacks
   - Accessible to any script on the same origin
   - Should be treated as sensitive data

## Implementation in This Project

The `getFunctionCallKey()` function in `near-helpers.ts` checks all these formats:

```javascript
// Usage
const functionCallKey = getFunctionCallKey(accountId, network)
if (functionCallKey) {
  console.log('Found key from:', functionCallKey.source)
  console.log('Contract:', functionCallKey.contractId)
  // Use functionCallKey.keyPair for signing
}
```

## Debugging

Use the "Debug: List Keys" button in the UI to see all potential key storage entries in localStorage. This helps identify:
- Which wallet was used
- Where keys are stored
- What format they're in

## Best Practices

1. **Always check multiple formats** - Users might switch between wallets
2. **Verify key validity** - Keys might be revoked on-chain
3. **Handle missing keys gracefully** - Fall back to wallet signing methods
4. **Don't assume key availability** - Some wallets don't support function-call keys
5. **Respect wallet boundaries** - Only access keys that wallets intentionally expose

## Future Considerations

- Wallet storage patterns may change in future versions
- New wallets may have different approaches
- Standards like NEP-413 provide alternatives to direct key access
- Consider using `wallet.signMessage()` when available instead of direct key access