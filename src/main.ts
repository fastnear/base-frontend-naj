import { generateKeyPair, storeKeyPair, getStoredKeyPair } from './auth.ts'
import { createProvider, getBalance, signOfflineMessage, detectNetwork, findExistingKey } from './near-helpers.ts'

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
let keyPair = null
let walletSelector = null

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

    // Try to restore key pair
    const storedKey = getStoredKeyPair(accountId)
    if (storedKey) {
      keyPair = storedKey.keyPair
      console.log('Restored key pair for', accountId)
    }

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
  loginForm.classList.remove('hidden')
  loggedInView.classList.add('hidden')
  statusEl.classList.add('hidden')
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

// Sign a test message
async function signTestMessage() {
  if (!accountId || !keyPair) {
    showStatus('No key pair available', true)
    return
  }

  signMessageBtn.disabled = true
  
  try {
    const testPayload = {
      message: "Hello NEAR!",
      timestamp: Date.now(),
      account: accountId
    }
    
    const signed = signOfflineMessage(testPayload, keyPair)
    
    console.log('Signed message:', signed)
    showStatus(`Signed message:\n${JSON.stringify(signed.message, null, 2)}\n\nSignature: ${signed.signature.slice(0, 20)}...`)
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

// Initialize wallet selector (lazy loaded)
async function initializeWalletSelector() {
  const { initWalletSelector, onWalletChange, getWalletInfo } = await import('./wallet-selector.ts')
  
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
      
      // Try to find key for this account
      console.log('Looking for existing keys for:', accountId)
      findExistingKey(accountId, NETWORK_ID).then(key => {
        if (key) {
          keyPair = key
          console.log('✅ Found key for wallet account:', key)
        } else {
          console.log('❌ No key found for wallet account')
        }
      })
    } else if (accountId) {
      // User signed out - just update UI, don't call logout again
      console.log('User signed out')
      localStorage.removeItem('near_session')
      accountId = null
      keyPair = null
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
  
  // Just check for our simple session first
  // Wallet selector will be loaded on demand when user clicks login
  checkSession()
}

// Initialize
init()
