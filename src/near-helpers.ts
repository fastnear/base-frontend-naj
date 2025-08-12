import * as nearAPI from 'near-api-js'
import { KeyPair } from '@near-js/crypto'
import { encode, decode } from 'bs58'

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
    secretKey: keyPair.toString(), // ed25519:base58secretkey format
    rawSecretKey: encode(keyPair.secretKey) // just the base58 part
  }
}

/**
 * Restore key pair from stored secret key (handles multiple formats)
 */
export function restoreKeyPair(secretKey) {
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
 * Sign an offline message with a consistent wrapper format
 * @param {object} payload - The actual data to sign
 * @param {KeyPair} keyPair - The key pair to sign with
 * @returns {object} Signed message with signature
 */
export function signOfflineMessage(payload, keyPair) {
  const message = {
    offline_signature: payload
  }
  
  // Convert to bytes for signing
  const messageBytes = new TextEncoder().encode(JSON.stringify(message))
  
  // Sign the message
  const signature = keyPair.sign(messageBytes)
  
  return {
    message,
    signature: encode(signature.signature),
    publicKey: signature.publicKey.toString()
  }
}

/**
 * Verify an offline signed message
 * @param {object} signedMessage - The signed message object
 * @returns {boolean} Whether the signature is valid
 */
export function verifyOfflineMessage(signedMessage) {
  const { message, signature, publicKey } = signedMessage
  
  // Reconstruct the message bytes
  const messageBytes = new TextEncoder().encode(JSON.stringify(message))
  
  // Decode the signature
  const sigBytes = decode(signature)
  
  // Get the public key
  const pubKey = nearAPI.utils.PublicKey.from(publicKey)
  
  // Create a key pair with just the public key for verification
  // This is a bit hacky but works for verification
  const keyPair = KeyPair.fromString('ed25519:' + encode(new Uint8Array(64)))
  
  return pubKey.verify(messageBytes, sigBytes)
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

/**
 * Find existing keys from various wallet sources
 * @param {string} accountId - Account to find keys for
 * @param {string} network - Network to search on (defaults to auto-detect)
 * @returns {object|null} Found key pair or null
 */
export async function findExistingKey(accountId, network = null) {
  if (!network) {
    network = detectNetwork()
  }
  
  console.log('=== findExistingKey ===')
  console.log('Looking for keys for:', accountId, 'on', network)
  console.log('localStorage keys:', Object.keys(localStorage))
  
  // 1. Check NEAR API JS default browser keystore
  try {
    const keyStore = new nearAPI.keyStores.BrowserLocalStorageKeyStore()
    const keyPair = await keyStore.getKey(network, accountId)
    if (keyPair) {
      console.log('✅ Found key in NEAR browser keystore')
      return keyPair
    }
  } catch (e) {
    console.log('❌ No key in NEAR browser keystore:', e.message)
  }
  
  // 2. Check our custom storage (from auth.js pattern)
  try {
    const customKey = `near_key_${accountId}`
    console.log(`Checking custom storage: ${customKey}`)
    const stored = localStorage.getItem(customKey)
    if (stored) {
      const keyData = JSON.parse(stored)
      const keyPair = KeyPair.fromString(keyData.secretKey)
      console.log('✅ Found key in our custom storage')
      return keyPair
    }
  } catch (e) {
    console.log('❌ No key in custom storage:', e.message)
  }
  
  // 3. Check HERE wallet format
  try {
    const hereKeystore = localStorage.getItem('herewallet:keystore')
    if (hereKeystore) {
      const parsed = JSON.parse(hereKeystore)
      if (parsed[network] && parsed[network].accounts && parsed[network].accounts[accountId]) {
        const keyPair = nearAPI.utils.KeyPair.fromString(parsed[network].accounts[accountId])
        console.log('Found key in HERE wallet')
        return keyPair
      }
    }
  } catch (e) {
    console.log('No key in HERE wallet')
  }
  
  // 4. Check Meteor wallet format
  try {
    const meteorKey = localStorage.getItem(`_meteor_wallet${accountId}:${network}`)
    if (meteorKey) {
      const keyPair = nearAPI.utils.KeyPair.fromString(meteorKey)
      console.log('Found key in Meteor wallet')
      return keyPair
    }
  } catch (e) {
    console.log('No key in Meteor wallet')
  }
  
  // 5. Check MyNearWallet format (near-wallet prefix)
  try {
    const keys = Object.keys(localStorage)
    for (const key of keys) {
      if (key.startsWith(`near-wallet:${network}:`) && key.includes(accountId)) {
        const keyPair = nearAPI.utils.KeyPair.fromString(localStorage.getItem(key))
        console.log('Found key in MyNearWallet format')
        return keyPair
      }
    }
  } catch (e) {
    console.log('No key in MyNearWallet format')
  }
  
  return null
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
  const resultString = Buffer.from(result.result).toString()
  try {
    return JSON.parse(resultString)
  } catch (e) {
    // Return raw string if not JSON
    return resultString
  }
}