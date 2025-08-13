import { utils } from 'near-api-js'
import bs58 from 'bs58'
import { ed25519 } from '@noble/curves/ed25519'
import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'

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

export function generateNonce() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return bs58.encode(bytes)
}

function parseNearPk(pk) {
  const [kind, b58] = pk.split(':')
  const raw = bs58.decode(b58)
  
  if (kind === 'ed25519') {
    if (raw.length !== 32) throw new Error('ed25519 pk must be 32 bytes')
    return { alg: 'ed25519', pub: raw }
  }
  
  if (kind === 'secp256k1') {
    if (raw.length !== 64) throw new Error('secp256k1 pk must be 64 bytes (uncompressed XY)')
    // Add uncompressed prefix for noble
    const sec1 = new Uint8Array(65)
    sec1[0] = 0x04
    sec1.set(raw, 1)
    return { alg: 'secp256k1-ecdsa', pub: sec1 }
  }
  
  throw new Error(`Unknown pk kind: ${kind}`)
}

function getAlgFromKeyPair(keyPair) {
  const pkString = keyPair.getPublicKey().toString()
  const [kind] = pkString.split(':')
  return kind === 'secp256k1' ? 'secp256k1-ecdsa' : 'ed25519'
}

export function buildEnvelope({
  network,
  aud,
  sub,
  pk,
  nonce,
  iat,
  exp,
  payload,
  alg
}) {
  return {
    offline_signature: {
      domain: 'fastnear/offline-signature@v1',
      alg,
      network,
      aud,
      sub,
      pk,
      nonce,
      iat,
      exp,
      payload
    }
  }
}

export async function signEnvelope(envelope, keyPair) {
  const bytes = new TextEncoder().encode(canonicalize(envelope))
  const { alg } = envelope.offline_signature
  
  let signature
  
  if (alg === 'ed25519') {
    // For ed25519, we can use the NEAR KeyPair directly
    const signResult = keyPair.sign(bytes)
    signature = signResult.signature
  } else if (alg === 'secp256k1-ecdsa') {
    // For secp256k1, we need to extract the private key and use noble
    // NEAR's KeyPair doesn't expose private key directly, so we'll use the sign method
    // and extract the signature
    const digest = sha256(bytes)
    const signResult = keyPair.sign(digest)
    signature = signResult.signature
  } else {
    throw new Error(`Unsupported alg: ${alg}`)
  }
  
  return {
    message: envelope,
    signature: bs58.encode(signature),
    publicKey: envelope.offline_signature.pk
  }
}

export async function verifyEnvelope({ message, signature }) {
  const keys = Object.keys(message)
  if (keys.length !== 1 || keys[0] !== 'offline_signature') {
    return false
  }

  const { offline_signature: sig } = message
  
  if (sig.domain !== 'fastnear/offline-signature@v1') {
    return false
  }
  
  if (!sig?.alg || !sig?.aud || !sig?.pk || !sig?.nonce || !sig?.exp || !sig?.sub) {
    return false
  }
  
  const now = Date.now()
  if (new Date(sig.exp).getTime() < now) {
    return false
  }

  try {
    const bytes = new TextEncoder().encode(canonicalize(message))
    const sigBytes = bs58.decode(signature)
    const { alg, pub } = parseNearPk(sig.pk)
    
    // Verify alg matches
    if (sig.alg !== alg && !(sig.alg === 'secp256k1-ecdsa' && alg === 'secp256k1-ecdsa')) {
      return false
    }
    
    if (alg === 'ed25519') {
      if (sigBytes.length !== 64) return false
      return ed25519.verify(sigBytes, bytes, pub)
    } else if (alg === 'secp256k1-ecdsa') {
      if (sigBytes.length !== 64) return false
      const digest = sha256(bytes)
      return secp256k1.verify(sigBytes, digest, pub)
    }
    
    return false
  } catch (e) {
    return false
  }
}

export function createOfflineSignature({
  network,
  aud,
  sub,
  keyPair,
  payload,
  ttlMinutes = 5
}) {
  const now = new Date()
  const exp = new Date(now.getTime() + ttlMinutes * 60 * 1000)
  const alg = getAlgFromKeyPair(keyPair)
  
  const envelope = buildEnvelope({
    alg,
    network,
    aud,
    sub,
    pk: keyPair.getPublicKey().toString(),
    nonce: generateNonce(),
    iat: now.toISOString(),
    exp: exp.toISOString(),
    payload
  })
  
  return signEnvelope(envelope, keyPair)
}

export async function assertKeyOnChain(provider, accountId, publicKey) {
  try {
    await provider.query({
      request_type: 'view_access_key',
      finality: 'final',
      account_id: accountId,
      public_key: publicKey
    })
    return true
  } catch (error) {
    // Key not found or account doesn't exist
    return false
  }
}