import type { 
  WalletSelector,
  WalletSelectorParams,
  NetworkId,
  WalletSelectorState,
  WalletModuleFactory
} from '@near-wallet-selector/core'
import type { WalletSelectorModal, ModalOptions } from '@near-wallet-selector/modal-ui-js'
import type { MyNearWalletParams } from '@near-wallet-selector/my-near-wallet'
import { detectNetwork } from './near-helpers.ts'

// Wallet selector instance
let selector: WalletSelector | null = null
let modal: WalletSelectorModal | null = null

// Type for the loaded modules
interface WalletModules {
  setupWalletSelector: (params: WalletSelectorParams) => Promise<WalletSelector>
  setupIntearWallet: () => WalletModuleFactory
  setupMyNearWallet: (params?: MyNearWalletParams) => WalletModuleFactory
  setupMeteorWallet: () => WalletModuleFactory
  setupModal: (selector: WalletSelector, options?: { contractId?: string }) => WalletSelectorModal
}

// Lazy load wallet modules
async function loadWalletModules(): Promise<WalletModules> {
  // Load CSS dynamically
  if (!document.querySelector('link[href*="modal-ui-js"][href*="styles.css"]')) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/@near-wallet-selector/modal-ui-js@9.3.0/styles.css'
    document.head.appendChild(link)
  }
  
  const [
    { setupWalletSelector },
    { setupIntearWallet },
    { setupMyNearWallet },
    { setupMeteorWallet },
    { setupModal }
  ] = await Promise.all([
    import('@near-wallet-selector/core'),
    import('@near-wallet-selector/intear-wallet'),
    import('@near-wallet-selector/my-near-wallet'),
    import('@near-wallet-selector/meteor-wallet'),
    import('@near-wallet-selector/modal-ui-js')
  ])
  
  return {
    setupWalletSelector,
    setupIntearWallet,
    setupMyNearWallet,
    setupMeteorWallet,
    setupModal
  }
}

/**
 * Initialize wallet selector
 */
export async function initWalletSelector(contractId: string | null = null): Promise<WalletSelector> {
  const networkId = detectNetwork() as NetworkId // Returns 'testnet' or 'mainnet'
  console.log('=== Wallet Selector Init ===')
  console.log('Network ID detected:', networkId)
  console.log('Contract ID:', contractId)
  
  // Load modules on demand
  const modules = await loadWalletModules()
  
  // Build selector configuration
  const selectorConfig: WalletSelectorParams = {
    network: networkId,
    modules: [
      modules.setupIntearWallet(),
      modules.setupMyNearWallet(), // Uses default URLs based on network
      modules.setupMeteorWallet(),
    ],
    debug: true, // Enable debug logging
  }
  
  console.log('Wallet modules configured:', selectorConfig.modules.length)
  
  // Add contract-specific access key if provided
  if (contractId) {
    selectorConfig.createAccessKeyFor = {
      contractId,
      methodNames: [] // Empty array = all methods
    }
  }
  
  selector = await modules.setupWalletSelector(selectorConfig)
  
  // Setup modal with proper options
  const modalOptions: ModalOptions = {
    contractId: contractId || '', // Empty string if no contract
  }
  modal = modules.setupModal(selector, modalOptions)
  
  return selector
}

/**
 * Show wallet selector modal
 */
export async function showWalletModal(): Promise<void> {
  if (!modal) {
    throw new Error('Wallet selector not initialized')
  }
  modal.show()
}

/**
 * Hide wallet selector modal
 */
export function hideWalletModal(): void {
  if (modal) {
    modal.hide()
  }
}

/**
 * Get current wallet and account info
 */
export async function getWalletInfo() {
  if (!selector) {
    throw new Error('Wallet selector not initialized')
  }
  
  const state = selector.store.getState()
  if (!state.selectedWalletId) {
    return { wallet: null, accounts: [] }
  }
  
  const wallet = await selector.wallet()
  return {
    wallet,
    accounts: state.accounts
  }
}

/**
 * Sign out from current wallet
 */
export async function signOut(): Promise<void> {
  if (!selector) {
    throw new Error('Wallet selector not initialized')
  }
  
  const wallet = await selector.wallet()
  if (wallet) {
    await wallet.signOut()
  }
}

/**
 * Subscribe to wallet state changes
 */
export function onWalletChange(callback: (state: WalletSelectorState) => void) {
  if (!selector) {
    throw new Error('Wallet selector not initialized')
  }
  
  return selector.store.observable.subscribe(callback)
}

/**
 * Get wallet selector instance
 */
export function getSelector(): WalletSelector | null {
  return selector
}