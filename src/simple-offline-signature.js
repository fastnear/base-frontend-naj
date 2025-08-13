/**
 * Simple offline signature implementation
 * This is the pragmatic "just works" version for internal workflows
 * 
 * For the full FN-OS1 specification, see offline-signature.js
 */

import { encode, decode } from 'bs58'
import * as nearAPI from 'near-api-js'

/**
 * Simple offline message signing - minimal wrapper around key signing
 * @param {object} options - Signing options
 * @param {object} options.payload - The data to sign
 * @param {KeyPair} options.keyPair - The key pair to sign with
 * @param {string} options.accountId - NEAR account id
 * @returns {object} Simple signed message
 */
export function simpleSign({ payload, keyPair, accountId }) {
  // Just stringify and sign - no fancy canonicalization
  const message = JSON.stringify({
    payload,
    accountId,
    timestamp: Date.now()
  })
  
  const messageBytes = new TextEncoder().encode(message)
  const signature = keyPair.sign(messageBytes)
  
  return {
    message,
    signature: encode(signature.signature),
    publicKey: keyPair.getPublicKey().toString(),
    accountId
  }
}

/**
 * Verify a simple signed message
 * @param {object} signedMessage - The signed message to verify
 * @returns {boolean} Whether the signature is valid
 */
export function simpleVerify(signedMessage) {
  try {
    const { message, signature, publicKey } = signedMessage
    const messageBytes = new TextEncoder().encode(message)
    
    // Import public key and verify
    const pubKey = nearAPI.utils.PublicKey.from(publicKey)
    return pubKey.verify(messageBytes, decode(signature))
  } catch (e) {
    return false
  }
}

/**
 * Feature flag to use FN-OS1 or simple signing
 */
export const USE_FN_OS1 = false // Set to true to use the full FN-OS1 spec