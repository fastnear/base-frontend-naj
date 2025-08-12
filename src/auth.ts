import * as nearAPI from 'near-api-js'
import { KeyPair } from '@near-js/crypto'
import { encodeTransaction } from '@near-js/transactions'
import { encode } from 'bs58'

// Generate a new key pair for function call access
export function generateKeyPair() {
  const keyPair = KeyPair.fromRandom('ed25519')
  return {
    keyPair,
    publicKey: keyPair.getPublicKey().toString(),
    secretKey: encode(keyPair.secretKey)
  }
}

// Store key pair securely in localStorage
export function storeKeyPair(accountId, keyPair) {
  const keyData = {
    accountId,
    publicKey: keyPair.getPublicKey().toString(),
    secretKey: encode(keyPair.secretKey),
    created: Date.now()
  }
  
  // Store under account-specific key
  localStorage.setItem(`near_key_${accountId}`, JSON.stringify(keyData))
}

// Retrieve stored key pair
export function getStoredKeyPair(accountId) {
  const stored = localStorage.getItem(`near_key_${accountId}`)
  if (!stored) return null
  
  try {
    const keyData = JSON.parse(stored)
    // Reconstruct KeyPair from stored data
    const keyPair = KeyPair.fromString(keyData.secretKey)
    return {
      keyPair,
      publicKey: keyData.publicKey,
      created: keyData.created
    }
  } catch (e) {
    console.error('Failed to restore key pair:', e)
    return null
  }
}

// Create function call access key transaction
export function createAddKeyTransaction(accountId, publicKey, contractId = null) {
  const actions = [
    nearAPI.transactions.addKey(
      nearAPI.utils.PublicKey.from(publicKey),
      nearAPI.transactions.functionCallAccessKey(
        contractId, // null means access to any contract
        [], // empty array means access to any method
        null // no allowance limit
      )
    )
  ]
  
  return {
    actions,
    gas: '30000000000000', // 30 TGas
    deposit: '0'
  }
}

// Sign a transaction with stored key
export async function signTransaction(transaction, keyPair) {
  const message = encodeTransaction(transaction)
  const signature = keyPair.sign(message)
  
  return {
    transaction,
    signature: {
      signature: encode(signature.signature),
      publicKey: keyPair.getPublicKey().toString()
    }
  }
}