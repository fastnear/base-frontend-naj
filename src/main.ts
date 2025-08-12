import { generateKeyPair, getStoredKeyPair, storeKeyPair } from './auth'
import { signOffline } from './offline'
import { createProvider, getBalance, detectNetwork } from './near-helpers'

// Network config - auto-detect based on hostname
const NETWORK_ID = detectNetwork()

// Contract ID for function-call access keys (optional)
const CONTRACT_ID = null // Set this to your contract ID if needed

// UI elements
const loginForm = document.getElementById('login-form')
const loggedInView = document.getElementById('logged-in')
const loginBtn = document.getElementById('login-btn')
const logoutBtn = document.getElementById('logout-btn')
const checkBalanceBtn = document.getElementById('check-balance')
const signMessageBtn = document.getElementById('sign-message')
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

// Sign a test message using our own offline signing
async function signTestMessage() {
  if (!accountId) {
    showStatus('Please connect your wallet first', true)
    return
  }

  signMessageBtn.disabled = true
  
  try {
    // Generate or retrieve a key pair for this demo
    if (!keyPair) {
      // Check if we have a stored key for this account
      const stored = getStoredKeyPair(accountId)
      if (stored) {
        keyPair = stored.keyPair
      } else {
        // Generate a new key for offline signing demo
        const generated = generateKeyPair()
        keyPair = generated.keyPair
        // Store it for future use (demo only - not for production!)
        storeKeyPair(accountId, keyPair)
        showStatus('Generated new key pair for offline signing demo')
      }
    }
    
    // Create a test payload
    const testPayload = {
      statement: "Hello NEAR! This is a test offline signature.",
      timestamp: Date.now(),
      account_id: accountId
    }
    
    // Sign using our offline signing format
    const { envelope, signature_b58 } = signOffline(keyPair, testPayload, {
      network: detectNetwork() as 'mainnet' | 'testnet'
    })
    
    console.log('Signed envelope:', envelope)
    console.log('Signature:', signature_b58)
    
    showStatus(`Offline signature created:\n\nPayload:\n${JSON.stringify(testPayload, null, 2)}\n\nSignature: ${signature_b58.slice(0, 40)}...\n\nPublic Key: ${envelope.offline_signature.public_key}`)
  } catch (error) {
    showStatus(`Error: ${error.message}`, true)
  } finally {
    signMessageBtn.disabled = false
  }
}

// Event listeners
loginBtn.addEventListener('click', login)
logoutBtn.addEventListener('click', logout)
checkBalanceBtn.addEventListener('click', checkBalance)
signMessageBtn.addEventListener('click', signTestMessage)

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
