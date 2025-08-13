import * as nearAPI from 'near-api-js'
import { KeyPair } from '@near-js/crypto'
import { encode, decode } from 'bs58'
import { createOfflineSignature, verifyEnvelope, assertKeyOnChain } from './offline-signature.js'
import { simpleSign, simpleVerify, USE_FN_OS1 } from './simple-offline-signature.js'

// Domains that indicate testnet
const TestnetDomains = {
  'localhost': true,
  '127.0.0.1': true,
  'test.near.social': true,
}

/**
 * Auto-detect network based on hostname
 */
export function detectNetwork() {
  return window.location.hostname in TestnetDomains ? 'testnet' : 'mainnet'
}

/**
 * Create a NEAR provider with optional FastNear auth
 */
export function createProvider(network = null, apiKey = null) {
  // Auto-detect network if not specified
  if (!network) {
    network = detectNetwork()
  }
  
  const urls = {
    testnet: 'https://rpc.testnet.fastnear.com',
    mainnet: 'https://rpc.mainnet.fastnear.com'
  }
  
  const options = { url: urls[network] }
  if (apiKey) {
    options.headers = { 'Authorization': `Bearer ${apiKey}` }
  }
  
  return new nearAPI.providers.JsonRpcProvider(options)
}

/**
 * Generate a new key pair and return it in a simple format
 */
export function generateKeyPair() {
  const keyPair = KeyPair.fromRandom('ed25519')
  return {
    keyPair,
    publicKey: keyPair.getPublicKey().toString(),
    keyPairString: keyPair.toString() // ed25519:base58secretkey format
  }
}

/**
 * Restore key pair from stored secret key (handles multiple formats)
 */
export function restoreKeyPair(secretKey: string) {
  // Handle both "ed25519:xxx" and raw base58 formats
  const cleanKey = secretKey.startsWith('ed25519:') 
    ? secretKey 
    : `ed25519:${secretKey}`
  
  return KeyPair.fromString(cleanKey)
}

/**
 * Create a function-call access key for a specific contract
 * @param {string} contractId - Contract to grant access to (or null for any contract)
 * @param {string[]} methods - Methods to allow (empty array = all methods)
 * @param {string} allowance - Gas allowance in NEAR (e.g., "0.25" for 0.25 NEAR worth of gas)
 */
export function createFunctionCallKey(contractId = null, methods = [], allowance = null) {
  const allowanceYocto = allowance 
    ? nearAPI.utils.format.parseNearAmount(allowance)
    : null
  
  return nearAPI.transactions.functionCallAccessKey(
    contractId || '', // empty string means any contract
    methods,
    allowanceYocto ? BigInt(allowanceYocto) : undefined
  )
}

/**
 * Build the action to add a function-call key to an account
 */
export function buildAddKeyAction(publicKey, contractId = null, methods = [], allowance = null) {
  const accessKey = createFunctionCallKey(contractId, methods, allowance)
  const pubKey = typeof publicKey === 'string' 
    ? nearAPI.utils.PublicKey.from(publicKey)
    : publicKey
    
  return nearAPI.transactions.addKey(pubKey, accessKey)
}

/**
 * Sign an offline message - uses simple signing by default
 * Set USE_FN_OS1 = true in simple-offline-signature.js to use FN-OS1
 * @param {object} options - Signing options
 * @param {object} options.payload - The actual data to sign
 * @param {KeyPair} options.keyPair - The key pair to sign with
 * @param {string} options.accountId - NEAR account id being proven
 * @param {string} options.aud - Audience (who this is intended for)
 * @param {string} options.network - Network ('testnet' or 'mainnet', defaults to auto-detect)
 * @param {number} options.ttlMinutes - TTL in minutes (default 5)
 * @returns {Promise<object>} Signed message with signature
 */
export async function signOfflineMessage({ 
  payload, 
  keyPair, 
  accountId, 
  aud, 
  network = null,
  ttlMinutes = 5 
}) {
  if (USE_FN_OS1) {
    // Use full FN-OS1 specification
    if (!network) {
      network = detectNetwork()
    }
    
    return createOfflineSignature({
      network,
      aud,
      sub: accountId,
      keyPair,
      payload,
      ttlMinutes
    })
  } else {
    // Use simple signing (default)
    return simpleSign({ payload, keyPair, accountId })
  }
}

/**
 * Verify an offline signed message
 * @param {object} signedMessage - The signed message object
 * @returns {Promise<boolean>} Whether the signature is valid
 */
export async function verifyOfflineMessage(signedMessage) {
  if (USE_FN_OS1) {
    return verifyEnvelope(signedMessage)
  } else {
    return simpleVerify(signedMessage)
  }
}

/**
 * Simple account check - does this account exist?
 */
export async function accountExists(provider, accountId) {
  try {
    await provider.query({
      request_type: 'view_account',
      finality: 'final',
      account_id: accountId
    })
    return true
  } catch (e) {
    if (e.toString().includes('does not exist')) {
      return false
    }
    throw e
  }
}

/**
 * Get account balance in NEAR (not yocto)
 */
export async function getBalance(provider, accountId) {
  const account = await provider.query({
    request_type: 'view_account',
    finality: 'final',
    account_id: accountId
  })
  
  return {
    available: nearAPI.utils.format.formatNearAmount(account.amount, 4),
    staked: nearAPI.utils.format.formatNearAmount(account.staked || '0', 4),
    total: nearAPI.utils.format.formatNearAmount(
      (BigInt(account.amount) + BigInt(account.staked || '0')).toString(), 
      4
    )
  }
}

/**
 * Check if a public key exists on an account
 */
export async function hasAccessKey(provider, accountId, publicKey) {
  try {
    await provider.query({
      request_type: 'view_access_key',
      finality: 'final',
      account_id: accountId,
      public_key: publicKey
    })
    return true
  } catch (e) {
    return false
  }
}

// NOTE: Direct key access from wallets has been removed.
// Use wallet-selector's signMessage() API instead for secure message signing.
// See wallet-selector-signing.md for proper wallet integration patterns.

/**
 * Get function-call key created by wallet-selector (if available)
 * This is only available when createAccessKeyFor was used during wallet setup
 * Different wallets store keys in different formats
 * @param {string} accountId - Account to find keys for
 * @param {string} network - Network ('testnet' or 'mainnet')
 * @returns {object|null} Key pair and contract info or null
 */
export function getFunctionCallKey(accountId: string, network: string = null) {
  if (!network) {
    network = detectNetwork()
  }
  
  // 1. Check MyNearWallet format (stores under 'functionCallKey')
  try {
    const stored = localStorage.getItem('functionCallKey')
    if (stored) {
      const data = JSON.parse(stored)
      if (data.privateKey) {
        console.log('Found function-call key in MyNearWallet format')
        return {
          keyPair: KeyPair.fromString(data.privateKey),
          contractId: data.contractId,
          methods: data.methods || [],
          source: 'mynearwallet'
        }
      }
    }
  } catch (e) {
    console.log('No key in MyNearWallet format')
  }
  
  // 2. Check Meteor wallet format (_meteor_wallet prefix)
  try {
    const meteorKey = localStorage.getItem(`_meteor_wallet${accountId}:${network}`)
    if (meteorKey) {
      console.log('Found key in Meteor wallet format')
      return {
        keyPair: KeyPair.fromString(meteorKey),
        contractId: null, // Meteor doesn't store contract info
        methods: [],
        source: 'meteor'
      }
    }
  } catch (e) {
    console.log('No key in Meteor wallet format')
  }
  
  // 3. Check Intear wallet format (_intear_wallet_connected_account)
  try {
    const intearData = localStorage.getItem('_intear_wallet_connected_account')
    if (intearData) {
      const parsed = JSON.parse(intearData)
      if (parsed.key && parsed.accounts && parsed.accounts[0].accountId === accountId) {
        console.log('Found key in Intear wallet format')
        return {
          keyPair: KeyPair.fromString(parsed.key),
          contractId: parsed.contractId || null,
          methods: parsed.methodNames || [],
          source: 'intear'
        }
      }
    }
  } catch (e) {
    console.log('No key in Intear wallet format')
  }
  
  // 4. Check standard near-api-js keystore format
  try {
    const nearApiKey = localStorage.getItem(`near-api-js:keystore:${accountId}:${network}`)
    if (nearApiKey) {
      console.log('Found key in near-api-js keystore format')
      return {
        keyPair: KeyPair.fromString(nearApiKey),
        contractId: null,
        methods: [],
        source: 'near-api-js'
      }
    }
  } catch (e) {
    console.log('No key in near-api-js format')
  }
  
  // 5. Check if wallet-selector temporarily stored a key during createAccessKeyFor flow
  try {
    const keys = Object.keys(localStorage)
    for (const key of keys) {
      // Look for patterns that might indicate wallet-generated keys
      if (key.includes(accountId) && (key.includes('keystore') || key.includes('key'))) {
        const value = localStorage.getItem(key)
        if (value && value.includes('ed25519:')) {
          console.log(`Found potential key in: ${key}`)
          try {
            const keyPair = KeyPair.fromString(value)
            return {
              keyPair,
              contractId: null,
              methods: [],
              source: key
            }
          } catch (e) {
            // Not a valid key, continue searching
          }
        }
      }
    }
  } catch (e) {
    console.log('No keys found in search')
  }
  
  return null
}

/**
 * Debug function to list all potential keys in localStorage
 * @param {string} accountId - Account to search for
 */
export function debugListPotentialKeys(accountId: string) {
  console.log('=== Searching for keys in localStorage ===')
  console.log('Account:', accountId)
  console.log('Total localStorage items:', localStorage.length)
  
  const potentialKeys = []
  const keys = Object.keys(localStorage)
  
  for (const key of keys) {
    const value = localStorage.getItem(key)
    
    // Check if this might be a key storage
    if (
      key.includes(accountId) || 
      key.includes('keystore') || 
      key.includes('key') ||
      key.includes('wallet') ||
      (value && value.includes('ed25519:'))
    ) {
      potentialKeys.push({
        key,
        value: value.length > 100 ? value.substring(0, 100) + '...' : value,
        hasEd25519: value.includes('ed25519:'),
        length: value.length
      })
    }
  }
  
  console.table(potentialKeys)
  return potentialKeys
}

/**
 * Call a view method on a contract (no gas needed)
 * @param {Provider} provider - The NEAR provider
 * @param {string} contractId - Contract to call
 * @param {string} method - Method name
 * @param {object} args - Method arguments
 * @returns {Promise<any>} The parsed result
 */
export async function viewMethod(provider, contractId, method, args = {}) {
  const result = await provider.query({
    request_type: 'call_function',
    finality: 'final',
    account_id: contractId,
    method_name: method,
    args_base64: btoa(JSON.stringify(args))
  })
  
  // Parse the result from base64
  // Decode base64 result (browser-compatible)
  const raw = Uint8Array.from(atob(result.result), c => c.charCodeAt(0));
  const resultString = new TextDecoder().decode(raw)
  try {
    return JSON.parse(resultString)
  } catch (e) {
    // Return raw string if not JSON
    return resultString
  }
}

/**
 * Check if a public key exists on a NEAR account (identity binding)
 * @param {Provider} provider - The NEAR provider
 * @param {string} accountId - Account to check
 * @param {string} publicKey - Public key to verify (e.g. "ed25519:...")
 * @returns {Promise<boolean>} True if key exists on account
 */
export async function verifyKeyOnChain(provider, accountId, publicKey) {
  return assertKeyOnChain(provider, accountId, publicKey)
}