import { createProvider, getBalance, detectNetwork, getFunctionCallKey, signOfflineMessage, verifyOfflineMessage, debugListPotentialKeys } from './near-helpers'
import { utils } from 'near-api-js'

// Network config - auto-detect based on hostname
const NETWORK_ID = detectNetwork()

// Contract ID for function-call access keys (optional)
const CONTRACT_ID = 'count.mike.testnet' // This enables creation of function-call keys

// UI elements
const loginForm = document.getElementById('login-form')
const loggedInView = document.getElementById('logged-in')
const loginBtn = document.getElementById('login-btn')
const logoutBtn = document.getElementById('logout-btn')
const checkBalanceBtn = document.getElementById('check-balance')
const signMessageBtn = document.getElementById('sign-message')
const debugKeysBtn = document.getElementById('debug-keys')
const currentAccountEl = document.getElementById('current-account')
const statusEl = document.getElementById('status')

// State
let provider = null
let accountId = null
let walletSelector = null
let keyPair = null // Our own key for offline signing

// Initialize provider with optional auth
function initProvider() {
  const apiKey = import.meta.env.VITE_FASTNEAR_API_KEY
  provider = createProvider(NETWORK_ID, apiKey)
  console.log(`Provider initialized for ${NETWORK_ID}`, apiKey ? 'with auth' : 'without auth')
}

// Show status message
function showStatus(message, isError = false) {
  statusEl.textContent = message
  statusEl.classList.remove('hidden', 'error', 'success')
  statusEl.classList.add(isError ? 'error' : 'success')
}

// Check if we have a stored session
function checkSession() {
  const stored = localStorage.getItem('near_session')
  if (stored) {
    const session = JSON.parse(stored)
    accountId = session.accountId

    // Note: Keys are managed by wallet selector, not stored locally

    currentAccountEl.textContent = accountId
    loginForm.classList.add('hidden')
    loggedInView.classList.remove('hidden')
    showStatus(`Restored session for ${accountId}`)
  }
}

// Login flow - now uses wallet selector
async function login() {
  showStatus('Loading wallet selector...')
  
  try {
    // Lazy load wallet selector on first use
    if (!walletSelector) {
      await initializeWalletSelector()
    }
    
    // Show wallet selector modal
    const { showWalletModal } = await import('./wallet-selector.ts')
    await showWalletModal()
  } catch (error) {
    console.error('Login error:', error)
    showStatus(`Error: ${error.message}`, true)
  }
}

// Logout
async function logout() {
  try {
    // Only call signOut if we have a wallet selected
    if (walletSelector) {
      const { getWalletInfo, signOut } = await import('./wallet-selector.ts')
      const info = await getWalletInfo()
      if (info.wallet) {
        await signOut()
      }
    }
  } catch (error) {
    console.error('Logout error:', error)
  }
  
  localStorage.removeItem('near_session')
  accountId = null
  keyPair = null
  loginForm.style.display = 'block'
  loggedInView.style.display = 'none'
  statusEl.style.display = 'none'
}

// Check balance
async function checkBalance() {
  if (!accountId) return

  checkBalanceBtn.disabled = true
  showStatus('Checking balance...')

  try {
    const balance = await getBalance(provider, accountId)
    showStatus(`Balance: ${balance.available} NEAR\nStaked: ${balance.staked} NEAR`)
  } catch (error) {
    showStatus(`Error: ${error.message}`, true)
  } finally {
    checkBalanceBtn.disabled = false
  }
}

// Sign a test message using wallet-selector's signMessage API or function-call key
async function signTestMessage() {
  if (!accountId) {
    showStatus('Please connect your wallet first', true)
    return
  }

  signMessageBtn.disabled = true
  
  try {
    // First, check if we have a function-call key available
    const functionCallKey = getFunctionCallKey(accountId, NETWORK_ID)
    if (functionCallKey) {
      console.log('Found function-call key for:', functionCallKey.contractId)
      console.log('Key source:', functionCallKey.source)
      
      // Use FN-OS1 for offline signing with the function-call key
      const payload = {
        message: "Hello NEAR! This is a test message signed with function-call key.",
        timestamp: Date.now()
      }
      
      const signedMessage = await signOfflineMessage({
        payload,
        keyPair: functionCallKey.keyPair,
        accountId,
        aud: window.location.origin,
        network: NETWORK_ID
      })
      
      // Verify the signature
      const isValid = await verifyOfflineMessage(signedMessage)
      
      showStatus(`FN-OS1 Message Signed with Function-Call Key:\n\nPayload: ${JSON.stringify(payload, null, 2)}\n\nAccount: ${accountId}\nContract: ${functionCallKey.contractId}\nPublic Key: ${functionCallKey.keyPair.getPublicKey().toString()}\n\nSignature Valid: ${isValid ? '✅' : '❌'}\n\nFull Envelope:\n${JSON.stringify(signedMessage, null, 2).slice(0, 200)}...`)
      return
    }
    
    // Fall back to wallet.signMessage() if no function-call key
    const { getWallet } = await import('./wallet-selector.ts')
    const wallet = await getWallet()
    
    if (!wallet) {
      showStatus('No wallet selected', true)
      return
    }
    
    // Check if wallet supports message signing
    if (!wallet.signMessage) {
      showStatus('This wallet does not support message signing and no function-call key available', true)
      return
    }
    
    // Create NEP-413 compliant message parameters
    const message = "Hello NEAR! This is a test message to sign."
    const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(32)))
    const recipient = window.location.origin
    
    // Request signature from wallet
    const signedMessage = await wallet.signMessage({
      message,
      nonce,
      recipient
    })
    
    // Some wallets (like MyNearWallet) redirect and don't return the signature
    if (!signedMessage) {
      showStatus('Wallet will redirect for signing. Check the callback URL for the signature.')
      return
    }
    
    console.log('Signed message:', signedMessage)
    
    // Import verification utilities from wallet-selector
    const { verifySignature, verifyFullKeyBelongsToUser } = await import('@near-wallet-selector/core')
    
    // Verify the signature
    const isValid = verifySignature({
      message,
      nonce,
      recipient,
      publicKey: signedMessage.publicKey,
      signature: signedMessage.signature
    })
    
    // Verify key belongs to user
    let keyBelongsToUser = false
    try {
      keyBelongsToUser = await verifyFullKeyBelongsToUser({
        publicKey: signedMessage.publicKey,
        accountId: signedMessage.accountId,
        network: walletSelector.options.network
      })
    } catch (e) {
      console.log('Could not verify key ownership:', e)
    }
    
    showStatus(`NEP-413 Message Signed:\n\nMessage: "${message}"\n\nAccount: ${signedMessage.accountId}\nPublic Key: ${signedMessage.publicKey}\n\nSignature: ${signedMessage.signature.slice(0, 40)}...\n\nSignature Valid: ${isValid ? '✅' : '❌'}\nKey Belongs to User: ${keyBelongsToUser ? '✅' : '❌'}`)
  } catch (error) {
    showStatus(`Error: ${error.message}`, true)
  } finally {
    signMessageBtn.disabled = false
  }
}

// Debug function to list potential keys
function debugKeys() {
  if (!accountId) {
    showStatus('Please connect your wallet first', true)
    return
  }
  
  console.log('Debugging keys for:', accountId)
  const keys = debugListPotentialKeys(accountId)
  
  // Also try to get function-call key
  const functionCallKey = getFunctionCallKey(accountId, NETWORK_ID)
  if (functionCallKey) {
    showStatus(`Found function-call key!\n\nSource: ${functionCallKey.source}\nContract: ${functionCallKey.contractId || 'N/A'}\nPublic Key: ${functionCallKey.keyPair.getPublicKey().toString()}\n\nCheck console for all potential keys.`)
  } else {
    showStatus(`No function-call key found for ${accountId}.\n\nFound ${keys.length} potential key entries in localStorage.\nCheck console for details.`)
  }
}

// Event listeners
loginBtn.addEventListener('click', login)
logoutBtn.addEventListener('click', logout)
checkBalanceBtn.addEventListener('click', checkBalance)
signMessageBtn.addEventListener('click', signTestMessage)
debugKeysBtn.addEventListener('click', debugKeys)

// Initialize wallet selector
async function initializeWalletSelector() {
  const { initWalletSelector, onWalletChange, getWalletInfo } = await import('./wallet-selector')
  
  // Initialize wallet selector
  walletSelector = await initWalletSelector(CONTRACT_ID)
  
  // Subscribe to wallet changes
  onWalletChange((state) => {
    console.log('=== Wallet state changed ===')
    console.log('State:', state)
    console.log('Accounts:', state.accounts)
    console.log('Selected wallet:', state.selectedWalletId)
    
    if (state.accounts.length > 0) {
      // User signed in
      accountId = state.accounts[0].accountId
      console.log('Setting accountId:', accountId)
      currentAccountEl.textContent = accountId
      loginForm.classList.add('hidden')
      loggedInView.classList.remove('hidden')
      showStatus(`Connected: ${accountId}`)
      
      // Keys are managed by the wallet selector
    } else if (accountId) {
      // User signed out - just update UI, don't call logout again
      console.log('User signed out')
      localStorage.removeItem('near_session')
      accountId = null
      currentAccountEl.textContent = ''
      loginForm.classList.remove('hidden')
      loggedInView.classList.add('hidden')
      statusEl.classList.add('hidden')
    }
  })
  
  // Check for existing wallet session
  const walletInfo = await getWalletInfo()
  if (walletInfo.accounts.length > 0) {
    accountId = walletInfo.accounts[0].accountId
    currentAccountEl.textContent = accountId
    loginForm.classList.add('hidden')
    loggedInView.classList.remove('hidden')
    showStatus(`Connected: ${accountId}`)
  }
}

// Initialize app
async function init() {
  initProvider()
  
  // Initialize wallet selector and check for existing session
  await initializeWalletSelector()
  
  // Check if user is already signed in
  if (walletSelector) {
    const state = walletSelector.store.getState()
    if (state.accounts.length > 0) {
      // User is already signed in
      accountId = state.accounts[0].accountId
      currentAccountEl.textContent = accountId
      loginForm.style.display = 'none'
      loggedInView.style.display = 'block'
      showStatus(`Connected: ${accountId}`)
    }
  }
}

// Initialize
init()
