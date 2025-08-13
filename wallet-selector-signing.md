# NEAR Wallet Selector: Private Keys and Message Signing

## Executive Summary

**DO NOT** try to access private keys from NEAR wallets directly. The wallet-selector provides proper abstractions for signing that work across all wallet types. This document explains the right way to handle signing and why accessing localStorage for keys is wrong.

## The Right Way: Use Wallet Selector APIs

### NEP-413 Message Signing

```javascript
import { verifySignature, verifyFullKeyBelongsToUser } from "@near-wallet-selector/core";

// 1. Sign a message (works with ALL wallet types)
const message = "Your message here";
const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(32)));
const recipient = "yourapp.com";

const signedMessage = await wallet.signMessage({
  message,
  nonce,
  recipient
});

// 2. Verify the signature
const isValid = verifySignature({
  message,
  nonce,
  recipient,
  publicKey: signedMessage.publicKey,
  signature: signedMessage.signature
});

// 3. Verify key ownership
const keyBelongsToUser = await verifyFullKeyBelongsToUser({
  publicKey: signedMessage.publicKey,
  accountId: signedMessage.accountId,
  network: selector.options.network
});
```

### Why NOT to Access Keys Directly

❌ **Bad: Searching localStorage for keys**
```javascript
// DON'T DO THIS!
const keys = Object.keys(localStorage);
for (const key of keys) {
  if (key.startsWith('near-wallet:') || key.includes('keystore')) {
    // This violates wallet abstraction
  }
}
```

✅ **Good: Use wallet-selector methods**
```javascript
// DO THIS!
const signedMessage = await wallet.signMessage({ message, nonce, recipient });
```

## Table of Contents
1. [How Wallet Selector Works](#how-wallet-selector-works)
2. [Private Key Access by Wallet Type](#private-key-access-by-wallet-type)
3. [Function-Call Keys](#function-call-keys)
4. [Message Signing Support](#message-signing-support)
5. [Implementation Strategies](#implementation-strategies)
6. [Security Considerations](#security-considerations)

## How Wallet Selector Works

The `@near-wallet-selector/core` provides a unified interface for multiple NEAR wallets:

```typescript
interface Wallet {
  signIn(params: SignInParams): Promise<Account[]>
  signOut(): Promise<void>
  getAccounts(): Promise<Account[]>
  signAndSendTransaction(params: SignAndSendTransactionParams): Promise<FinalExecutionOutcome>
  signAndSendTransactions(params: SignAndSendTransactionsParams): Promise<FinalExecutionOutcome[]>
  signMessage?(params: SignMessageParams): Promise<SignedMessage> // Optional!
}
```

**Key insight**: The interface doesn't include methods to access private keys directly.

## Private Key Access by Wallet Type

### 🔑 Wallets with Limited Key Access

#### MyNearWallet
- **Function-Call Keys**: ✅ (stored in localStorage)
- **Full Access Keys**: ❌
- **Storage Location**: `localStorage.getItem('functionCallKey')`
- **Format**: 
  ```json
  {
    "privateKey": "ed25519:base58encodedkey...",
    "contractId": "contract.near",
    "methods": ["method1", "method2"]
  }
  ```

**How it works**:
1. During sign-in with a contract ID, MyNearWallet generates a new key pair
2. The private key is temporarily stored in localStorage
3. The public key is added to your account via the wallet interface
4. After confirmation, the key migrates from `near-api-js:keystore:` to `functionCallKey`

#### HERE Wallet
- **Function-Call Keys**: ❌
- **Full Access Keys**: ❌
- **Alternative**: Supports `signMessage()` method

#### Meteor Wallet
- **Function-Call Keys**: ❌
- **Full Access Keys**: ❌
- **Alternative**: Supports `signMessage()` method

#### Sender Wallet
- **Function-Call Keys**: ❌
- **Full Access Keys**: ❌
- **Note**: Browser extension, keys stay in the extension

### 🔐 Why Most Wallets Don't Expose Keys

1. **Security**: Private keys should never leave the wallet environment
2. **User Trust**: Users expect wallets to protect their keys
3. **Standards**: Web3 wallets typically only expose signing methods, not keys
4. **Recovery**: If apps stored keys, users could lose funds if the app is compromised

## Function-Call Keys

Function-call keys are limited-permission keys that can only:
- Call specific methods on specific contracts
- Cannot transfer tokens
- Cannot add/delete other keys
- Cannot deploy contracts

### When You Get Function-Call Keys

1. **During Contract-Specific Login**:
   ```javascript
   await wallet.signIn({
     contractId: "app.near",
     methodNames: ["set_status", "get_status"]
   })
   ```

2. **Storage Migration** (MyNearWallet specific):
   ```javascript
   // Before wallet redirect:
   localStorage: "near-api-js:keystore:alice.near:testnet" → private key
   
   // After successful login:
   localStorage: "functionCallKey" → { privateKey, contractId, methods }
   ```

### Accessing Function-Call Keys

```javascript
function getWalletFunctionCallKey() {
  const stored = localStorage.getItem('functionCallKey')
  if (!stored) return null
  
  try {
    const { privateKey, contractId, methods } = JSON.parse(stored)
    return {
      keyPair: nearAPI.utils.KeyPair.fromString(privateKey),
      contractId,
      methods
    }
  } catch (e) {
    return null
  }
}
```

## Message Signing Support

### Wallets with `signMessage()` Support

Some wallets implement the optional `signMessage()` method:

```javascript
const wallet = await selector.wallet()

if (wallet.signMessage) {
  const signed = await wallet.signMessage({
    message: "Hello NEAR",
    recipient: "app.near",
    nonce: Buffer.from(randomBytes(32)),
    callbackUrl: "https://app.example.com/callback"
  })
  // Returns: { accountId, publicKey, signature }
}
```

**Support Matrix**:
| Wallet | signMessage() | Notes |
|--------|--------------|-------|
| MyNearWallet | ✅ | Redirects to wallet |
| HERE Wallet | ✅ | In-page signing |
| Meteor Wallet | ✅ | Mobile/extension |
| Sender | ❓ | Check capabilities |
| WalletConnect | ❓ | Depends on wallet |

### Checking for Message Signing Support

```javascript
async function canSignMessages(selector) {
  const wallet = await selector.wallet()
  return typeof wallet.signMessage === 'function'
}
```

## Implementation Strategies

### Strategy 1: Use Function-Call Keys When Available

```javascript
async function signOfflineMessageWithWallet({ payload, accountId }) {
  // 1. Try function-call key (MyNearWallet)
  const functionCallKey = getFunctionCallKey()
  if (functionCallKey) {
    return signOfflineMessage({
      payload,
      keyPair: functionCallKey.keyPair,
      accountId,
      // ... other params
    })
  }
  
  // 2. Try wallet.signMessage()
  const wallet = await selector.wallet()
  if (wallet.signMessage) {
    // Note: This might redirect or show a popup
    return wallet.signMessage({
      message: JSON.stringify(payload),
      recipient: window.location.origin
    })
  }
  
  // 3. Fall back to app-generated key
  return signWithAppKey(payload, accountId)
}
```

### Strategy 2: App-Specific Keys

For consistent behavior across all wallets:

```javascript
class AppKeyManager {
  async getOrCreateAppKey(accountId) {
    const storageKey = `app_key_${accountId}`
    const stored = localStorage.getItem(storageKey)
    
    if (stored) {
      return nearAPI.utils.KeyPair.fromString(stored)
    }
    
    // Generate new app-specific key
    const newKey = nearAPI.utils.KeyPair.fromRandom('ed25519')
    localStorage.setItem(storageKey, newKey.toString())
    
    // Optionally: Guide user to add this key to their account
    return newKey
  }
}
```

### Strategy 3: Hybrid Approach

Best of both worlds:

```javascript
async function getBestAvailableKey(accountId) {
  // Priority order:
  // 1. Wallet-provided function-call key (most trusted)
  // 2. Wallet signMessage() method (requires user interaction)
  // 3. App-specific key (always available)
  
  const sources = [
    { name: 'wallet-function-key', key: getWalletFunctionCallKey() },
    { name: 'app-stored-key', key: getAppStoredKey(accountId) }
  ]
  
  for (const source of sources) {
    if (source.key) {
      console.log(`Using key from: ${source.name}`)
      return source.key
    }
  }
  
  // Generate new if nothing exists
  return generateNewAppKey(accountId)
}
```

## Security Considerations

### ⚠️ Function-Call Key Limitations

1. **Scope**: Only works for the specific contract and methods
2. **Expiration**: No built-in expiration (app should handle)
3. **Revocation**: User can delete via wallet or account management
4. **Storage**: Plain text in localStorage (use with caution)

### ✅ Best Practices

1. **Never store full-access keys**
2. **Clearly communicate key usage to users**
3. **Implement key rotation for app-specific keys**
4. **Check on-chain key validity before critical operations**
5. **Provide UI for users to manage app keys**

### 🔒 Secure Key Storage Patterns

```javascript
// Bad: Storing sensitive keys without encryption
localStorage.setItem('private_key', keyPair.toString())

// Better: Namespace and metadata
localStorage.setItem('app_name:signing_key:alice.near', JSON.stringify({
  key: keyPair.toString(),
  created: Date.now(),
  purpose: 'offline_message_signing',
  // Never store full-access keys!
  type: 'function_call'
}))

// Best: Use wallet-provided signing when possible
await wallet.signMessage({ ... })
```

## Common Patterns and Pitfalls

### Pattern: Detecting Available Keys

```javascript
function detectAvailableKeys(accountId, network) {
  const keys = {
    walletFunctionCall: null,
    nearApiJsKeystore: null,
    appSpecific: null
  }
  
  // Check wallet function-call key
  const fcKey = localStorage.getItem('functionCallKey')
  if (fcKey) {
    try {
      keys.walletFunctionCall = JSON.parse(fcKey)
    } catch (e) {}
  }
  
  // Check old NEAR API JS keystore
  const oldKey = localStorage.getItem(
    `near-api-js:keystore:${accountId}:${network}`
  )
  if (oldKey) {
    keys.nearApiJsKeystore = oldKey
  }
  
  // Check app-specific
  const appKey = localStorage.getItem(`myapp:key:${accountId}`)
  if (appKey) {
    keys.appSpecific = appKey
  }
  
  return keys
}
```

### Pitfall: Assuming Key Availability

```javascript
// ❌ Bad: Assumes key exists
const key = JSON.parse(localStorage.getItem('functionCallKey'))
const signed = await sign(key.privateKey, message)

// ✅ Good: Defensive checking
const keyData = localStorage.getItem('functionCallKey')
if (!keyData) {
  // Handle no key scenario
  return alternativeSigningMethod()
}

try {
  const { privateKey } = JSON.parse(keyData)
  if (!privateKey) throw new Error('No private key in data')
  
  const keyPair = nearAPI.utils.KeyPair.fromString(privateKey)
  return await signOfflineMessage({ keyPair, ... })
} catch (e) {
  console.error('Failed to use wallet key:', e)
  return alternativeSigningMethod()
}
```

## Migration Guide: NEAR API JS to Wallet Selector

If migrating from old NEAR API JS patterns:

```javascript
// Old: Direct keystore access
const keyStore = new nearAPI.keyStores.BrowserLocalStorageKeyStore()
const keyPair = await keyStore.getKey(networkId, accountId)

// New: Check multiple sources
async function migrateKeyAccess(accountId, networkId) {
  // 1. Check if wallet selector has the key
  const functionCallKey = getFunctionCallKeyFromWallet()
  if (functionCallKey) return functionCallKey
  
  // 2. Check if old keystore has it
  const oldKeystore = new nearAPI.keyStores.BrowserLocalStorageKeyStore()
  try {
    const oldKey = await oldKeystore.getKey(networkId, accountId)
    if (oldKey) {
      console.warn('Found key in old keystore - should migrate')
      return oldKey
    }
  } catch (e) {}
  
  // 3. Use wallet.signMessage or generate new
  return null
}
```

## Conclusion

**Key Takeaways**:
1. Most wallets don't expose private keys (by design)
2. MyNearWallet provides function-call keys for specific contracts
3. Use `wallet.signMessage()` when available
4. App-specific keys are a valid fallback strategy
5. Always verify keys on-chain for security-critical operations

**Recommended Approach**:
1. First, check for wallet-provided function-call keys
2. Second, try wallet.signMessage() if supported
3. Finally, fall back to app-generated keys with clear user communication

Remember: The goal is secure, user-controlled signing—not necessarily direct key access.