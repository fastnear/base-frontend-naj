# FN-OS1: FastNear Offline Signature Specification v1

## Executive Summary

FN-OS1 is a minimal, secure offline signature format for NEAR Protocol that provides:
- **Dual-curve support** (Ed25519 and Secp256k1)
- **Deterministic canonicalization** for consistent signing
- **Replay protection** via nonces and short TTLs
- **Identity binding** through optional on-chain verification
- **Single top-level key** for unambiguous wallet detection

## Core Design Principles

1. **Simplicity First**: One envelope format, one top-level key, no ambiguity
2. **NEAR Native**: Uses NEAR's key encoding and supports both NEAR curves
3. **Secure by Default**: Domain separation, replay protection, expiration
4. **Wallet Friendly**: Clearly distinguishable from on-chain transactions

## Envelope Structure

### The One Rule
Every FN-OS1 message MUST have exactly one top-level key: `"offline_signature"`

```json
{
  "offline_signature": {
    "domain": "fastnear/offline-signature@v1",
    "alg": "ed25519",
    "network": "testnet",
    "aud": "https://app.fastnear.com",
    "sub": "alice.testnet",
    "pk": "ed25519:7cQ3Yy7x3wz2HqYk7PqWQj8z9A2B4C6D8E0F2G4H6J8K",
    "nonce": "G0jQ3Yy7x3wz2HqYk7PqWQ",
    "iat": "2025-08-12T20:00:00Z",
    "exp": "2025-08-12T20:05:00Z",
    "payload": {
      "action": "authenticate",
      "data": "custom application data"
    }
  }
}
```

### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `domain` | string | ✅ | Must be `"fastnear/offline-signature@v1"` |
| `alg` | string | ✅ | Either `"ed25519"` or `"secp256k1-ecdsa"` |
| `network` | string | ✅ | Either `"testnet"` or `"mainnet"` |
| `aud` | string | ✅ | Audience - who this signature is for (URL or identifier) |
| `sub` | string | ✅ | Subject - NEAR account being proven |
| `pk` | string | ✅ | Public key in NEAR format |
| `nonce` | string | ✅ | Random 16-32 bytes, base58 encoded |
| `iat` | string | ✅ | Issued at time (ISO 8601 UTC) |
| `exp` | string | ✅ | Expiration time (ISO 8601 UTC) |
| `payload` | any | ✅ | Application-specific data |

### Key Encoding

Public keys MUST use NEAR's standard encoding:
- **Ed25519**: `"ed25519:<base58(32 bytes)>"`
- **Secp256k1**: `"secp256k1:<base58(64 bytes uncompressed XY)>"`

Note: NEAR uses uncompressed secp256k1 keys WITHOUT the 0x04 prefix in storage.

## Cryptographic Operations

### Canonicalization

To ensure deterministic signatures across implementations:

1. **Sort object keys** lexicographically at all levels
2. **No whitespace** between JSON elements
3. **UTF-8 encoding** of the final string
4. **Include the outer wrapper** in canonicalization

Example implementation:
```javascript
function canonicalize(value) {
  const canon = (v) => {
    if (v === null || typeof v !== 'object') return v
    if (Array.isArray(v)) return v.map(canon)
    const out = {}
    for (const k of Object.keys(v).sort()) {
      out[k] = canon(v[k])
    }
    return out
  }
  return JSON.stringify(canon(value))
}
```

### Signing Process

1. **Create envelope** with all required fields
2. **Canonicalize** the entire object (including outer `{ "offline_signature": ... }`)
3. **Sign based on algorithm**:
   - **Ed25519**: Sign canonical bytes directly
   - **Secp256k1**: Sign SHA-256(canonical bytes)
4. **Return** base58-encoded signature

### Signature Format

- **Ed25519**: 64-byte EdDSA signature
- **Secp256k1**: 64-byte compact ECDSA (r||s) with low-S normalization
- Both encoded as base58 strings

## Security Considerations

### Domain Separation
The fixed `domain` field prevents cross-protocol attacks. Signatures for `"fastnear/offline-signature@v1"` can never be confused with:
- NEAR blockchain transactions
- Other signing protocols
- Future versions of FN-OS

### Replay Protection
1. **Unique nonces**: 16-32 random bytes per signature
2. **Short TTL**: Recommended 5 minutes or less
3. **Audience binding**: `aud` field limits where signatures are valid
4. **Network binding**: Prevents testnet signatures on mainnet

### Identity Verification
Two levels of verification:
1. **Cryptographic**: Proves possession of private key for `pk`
2. **Identity**: Proves `pk` belongs to `sub` on `network` (via RPC)

## Implementation Guide

### TypeScript/JavaScript

```typescript
import { ed25519 } from '@noble/curves/ed25519'
import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'
import bs58 from 'bs58'

// Sign a message
async function signFNOS1(keyPair: KeyPair, params: {
  network: 'testnet' | 'mainnet',
  aud: string,
  sub: string,
  payload: any,
  ttlMinutes?: number
}) {
  const envelope = buildEnvelope({
    alg: getAlgFromKeyPair(keyPair),
    network: params.network,
    aud: params.aud,
    sub: params.sub,
    pk: keyPair.getPublicKey().toString(),
    nonce: generateNonce(),
    iat: new Date().toISOString(),
    exp: new Date(Date.now() + (params.ttlMinutes || 5) * 60000).toISOString(),
    payload: params.payload
  })
  
  return signEnvelope(envelope, keyPair)
}

// Verify a signature
async function verifyFNOS1(signed: { message: any, signature: string }) {
  // 1. Cryptographic verification
  const valid = await verifyEnvelope(signed)
  if (!valid) return { valid: false }
  
  // 2. Optional identity verification
  const { sub, pk, network } = signed.message.offline_signature
  const onChain = await assertKeyOnChain(provider, sub, pk)
  
  return { valid: true, onChain }
}
```

### Validation Checklist

✅ Exactly one top-level key (`"offline_signature"`)  
✅ Domain equals `"fastnear/offline-signature@v1"`  
✅ All required fields present  
✅ Signature not expired (with small clock skew tolerance)  
✅ Algorithm matches public key type  
✅ Signature length is 64 bytes  
✅ Canonical JSON used for signing  

## Comparison with Other Standards

### vs SIWE (EIP-4361)
- SIWE uses human-readable text format
- FN-OS1 uses structured JSON for easier parsing
- Both provide similar security guarantees

### vs ADR-036 (Cosmos)
- ADR-036 signs arbitrary bytes with type prefixes
- FN-OS1 has built-in structure and fields
- FN-OS1 includes replay protection by default

### vs NEP-413 (NEAR)
- NEP-413 is more complex with multiple message types
- FN-OS1 focuses on simplicity with one format
- FN-OS1 supports both NEAR curves natively

## Test Vectors

### Ed25519 Test Vector

```json
{
  "message": {
    "offline_signature": {
      "domain": "fastnear/offline-signature@v1",
      "alg": "ed25519",
      "network": "testnet",
      "aud": "https://app.fastnear.com",
      "sub": "alice.testnet",
      "pk": "ed25519:8fWHD35Rjd78yeowShh9GwhRudRtLLsGCRUZHPvJmZpS",
      "nonce": "3Qyrc8XBpbr8Fn9V",
      "iat": "2025-08-12T20:00:00Z",
      "exp": "2025-08-12T20:05:00Z",
      "payload": {
        "action": "test"
      }
    }
  },
  "signature": "3PBVTwGfghGLPfQmqPyHXbQjdRxqxwJSfxkKCg5yYcTY9hgCdQX3vR5HdqGV1apJ3nTZxPZfxPuQZDcEqNNfYLsE",
  "secretKey": "ed25519:3D4YudUahN1nawWogh8pAKSj92sUNMdbZGjn7kERKmAC28AvGUhaJhbqLyPZTGvr5kNV2Pe7XQpE65JL7fJzTzqz"
}
```

### Secp256k1 Test Vector

```json
{
  "message": {
    "offline_signature": {
      "domain": "fastnear/offline-signature@v1",
      "alg": "secp256k1-ecdsa",
      "network": "mainnet",
      "aud": "https://example.com",
      "sub": "bob.near",
      "pk": "secp256k1:5ftgm7uC8bPrRPZWuVtwK8p4VUsq9Gq6mVGMcV5TJHqJRd5LXFNhfvfAatAKHRdx31SqnpSmCVP8DSvWmtkMMoVx",
      "nonce": "7KJH8g3nB5mW2Xq9",
      "iat": "2025-08-12T20:00:00Z",
      "exp": "2025-08-12T20:05:00Z",
      "payload": {
        "msg": "Hello NEAR"
      }
    }
  },
  "signature": "5TQ4MPVSport1CYqy8LfkPGaUPQbkN9vgBGkp7SZmKQBJ9ZQ8LLoM3qqMBnqFfbnUHxKQxVGqPr3aLCzeHLLVQHH",
  "secretKey": "secp256k1:9ZNzLxNff5oKBpapDjpbgKPPUX9u6vnBUQpJ2HQnJhke"
}
```

## Future Considerations

### Backwards Compatibility
The `domain` field enables future versions without breaking v1:
- `"fastnear/offline-signature@v2"` could add new required fields
- Verifiers can reject unknown versions cleanly

### Optional Extensions
Future optional fields (ignored by v1 verifiers):
- `cap`: Capabilities/permissions
- `challenge`: Server-provided challenge
- `metadata`: Additional application context

## Reference Implementation

The complete reference implementation is available in this repository:
- [`src/offline-signature.js`](./src/offline-signature.js) - Core FN-OS1 implementation
- [`src/near-helpers.ts`](./src/near-helpers.ts) - High-level API wrappers
- [`src/main.ts`](./src/main.ts) - Example usage in web app

## FAQ

### Why include the public key instead of using recovery?
- Ed25519 doesn't support key recovery
- Uniform behavior across both curves
- Explicit is better than implicit
- Enables pre-verification without recovery computation

### Why SHA-256 for secp256k1 instead of signing bytes directly?
- ECDSA requires fixed-size input (hash)
- SHA-256 is standard for ECDSA
- Consistent with NEAR's transaction signing

### Can I use this for login/authentication?
Yes! The `payload` field can contain session tokens, challenges, or any auth data your application needs.

### How do I handle clock skew?
Verifiers should allow ±2 minutes of skew on `exp` to handle minor time differences between systems.

## License

This specification is released under CC0 1.0 Universal (Public Domain).