import type {
  WalletSelector,
  WalletSelectorParams,
  WalletSelectorState,
  NetworkId,
} from '@near-wallet-selector/core'
import { setupWalletSelector } from '@near-wallet-selector/core'
import type { WalletSelectorModal, ModalOptions } from '@near-wallet-selector/modal-ui-js'
import { setupModal } from '@near-wallet-selector/modal-ui-js'
import type { MyNearWalletParams } from '@near-wallet-selector/my-near-wallet'
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet'
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet'
import { setupIntearWallet } from '@near-wallet-selector/intear-wallet'

// If your bundler supports CSS imports (Vite/Next/Rspack/etc.), keep this line.
// Otherwise, include the stylesheet via <link> in your HTML and remove this import.
import '@near-wallet-selector/modal-ui-js/styles.css'

import { detectNetwork } from './near-helpers'

// Single instance (simple and explicit; no lazy loading)
let selector: WalletSelector | null = null
let modal: WalletSelectorModal | null = null

/**
 * Initialize wallet selector (no lazy/dynamic imports).
 * Pass `contractId = null` for general auth without contract AK creation.
 */
export async function initWalletSelector(
  contractId: string | null = null,
  opts?: {
    networkId?: NetworkId
    myNearWallet?: MyNearWalletParams
    debug?: boolean
    withModal?: boolean
  }
): Promise<WalletSelector> {
  if (selector) return selector

  const networkId = (opts?.networkId ?? (detectNetwork() as NetworkId))
  const debug = opts?.debug ?? true
  const withModal = opts?.withModal ?? true

  const selectorConfig: WalletSelectorParams = {
    network: networkId,
    modules: [
      setupIntearWallet(),
      setupMyNearWallet(opts?.myNearWallet),
      setupMeteorWallet(),
    ],
    debug,
  }

  if (contractId) {
    selectorConfig.createAccessKeyFor = { contractId, methodNames: [] }
  }

  selector = await setupWalletSelector(selectorConfig)

  if (withModal) {
    const modalOptions: ModalOptions = { contractId: contractId ?? '' }
    modal = setupModal(selector, modalOptions)
  }

  return selector
}

/**
 * Show wallet selector modal.
 */
export function showWalletModal(): void {
  if (!modal) throw new Error('Wallet selector modal not initialized')
  modal.show()
}

/**
 * Hide wallet selector modal.
 */
export function hideWalletModal(): void {
  if (!modal) return
  modal.hide()
}

/**
 * Get current wallet + accounts.
 */
export async function getWalletInfo(): Promise<{
  wallet: Awaited<ReturnType<WalletSelector['wallet']>> | null
  accounts: WalletSelectorState['accounts']
}> {
  if (!selector) throw new Error('Wallet selector not initialized')

  const state = selector.store.getState()
  if (!state.selectedWalletId) {
    return { wallet: null, accounts: [] }
  }
  const wallet = await selector.wallet()
  return { wallet, accounts: state.accounts }
}

/**
 * Sign out from current wallet.
 */
export async function signOut(): Promise<void> {
  if (!selector) throw new Error('Wallet selector not initialized')
  const wallet = await selector.wallet()
  await wallet.signOut()
}

/**
 * Subscribe to wallet state changes.
 * Returns an unsubscribe function.
 */
export function onWalletChange(callback: (state: WalletSelectorState) => void): () => void {
  if (!selector) throw new Error('Wallet selector not initialized')
  const sub = selector.store.observable.subscribe(callback)
  return () => sub.unsubscribe()
}

/**
 * Get the underlying selector (or null if not initialized).
 */
export function getSelector(): WalletSelector | null {
  return selector
}