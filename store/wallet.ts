import { actionTree, getterTree } from 'typed-vuex'
import { Wallet } from '@injectivelabs/web3-strategy'
import {
  getAddressFromInjectiveAddress,
  getInjectiveAddress
} from '@injectivelabs/ui-common'
import { confirm, connect, getAddresses } from '~/app/services/wallet'
import { validateMetamask, isMetamaskInstalled } from '~/app/services/metamask'
import { WalletConnectStatus } from '~/types'
import { GAS_FREE_DEPOSIT_REBATE_ENABLED } from '~/app/utils/constants'

const initialStateFactory = () => ({
  walletConnectStatus: WalletConnectStatus.idle as WalletConnectStatus,
  address: '' as string,
  injectiveAddress: '' as string,
  addressConfirmation: '' as string,
  addresses: [] as string[],
  metamaskInstalled: false as boolean,
  wallet: Wallet.Metamask
})

const initialState = initialStateFactory()

export const state = () => ({
  walletConnectStatus: initialState.walletConnectStatus as WalletConnectStatus,
  addresses: initialState.addresses as string[],
  address: initialState.address as string,
  injectiveAddress: initialState.injectiveAddress as string,
  addressConfirmation: initialState.addressConfirmation as string,
  metamaskInstalled: initialState.metamaskInstalled as boolean,
  wallet: initialState.wallet as Wallet
})

export type WalletStoreState = ReturnType<typeof state>

export const getters = getterTree(state, {
  isUserWalletConnected: (state) => {
    const addressConnectedAndConfirmed =
      !!state.address && !!state.addressConfirmation
    const hasAddresses = state.addresses.length > 0

    return (
      hasAddresses && addressConnectedAndConfirmed && !!state.injectiveAddress
    )
  }
})

export const mutations = {
  setWallet(state: WalletStoreState, wallet: Wallet) {
    state.wallet = wallet
  },

  setAddress(state: WalletStoreState, address: string) {
    state.address = address
  },

  setAddressConfirmation(state: WalletStoreState, addressConfirmation: string) {
    state.addressConfirmation = addressConfirmation
  },

  setInjectiveAddress(state: WalletStoreState, injectiveAddress: string) {
    state.injectiveAddress = injectiveAddress
  },

  setMetamaskInstalled(state: WalletStoreState, metamaskInstalled: boolean) {
    state.metamaskInstalled = metamaskInstalled
  },

  setAddresses(state: WalletStoreState, addresses: string[]) {
    state.addresses = addresses
  },

  setWalletConnectStatus(
    state: WalletStoreState,
    walletConnectStatus: WalletConnectStatus
  ) {
    state.walletConnectStatus = walletConnectStatus
  },

  reset(state: WalletStoreState) {
    const initialState = initialStateFactory()

    state.address = initialState.address
    state.addresses = initialState.addresses
    state.injectiveAddress = initialState.injectiveAddress
    state.addressConfirmation = initialState.addressConfirmation
  },

  resetPage(_state: WalletStoreState) {
    //
  }
}

export const actions = actionTree(
  { state, mutations },
  {
    async init({ state }) {
      const { wallet } = state

      if (!wallet) {
        return
      }

      await connect({ wallet })
    },

    async initPage(_) {
      await this.app.$accessor.bank.fetchBankBalancesWithToken()
      await this.app.$accessor.account.fetchSubaccounts()
      await this.app.$accessor.account.fetchSubaccountsBalances()
      await this.app.$accessor.account.fetchSubaccountsBalancesWithPrices()
      await this.app.$accessor.onboard.init()
      await this.app.$accessor.token.getErc20TokensWithBalanceAndPriceFromBankAndMarkets()

      if (GAS_FREE_DEPOSIT_REBATE_ENABLED) {
        await this.app.$accessor.gasRebate.init()
      }
    },

    async onConnect(_) {
      await this.app.$accessor.account.fetchSubaccounts()
      await this.app.$accessor.bank.fetchBalances()
      await this.app.$accessor.exchange.initFeeDiscounts()

      if (this.app.context.route.name === 'funding') {
        await this.app.$accessor.wallet.initPage()
      }

      if (this.app.context.route.name === 'trade-and-earn') {
        await this.app.$accessor.exchange.initTradeAndEarn()
      }

      if (
        ['spot-spot', 'derivatives-derivative'].includes(
          this.app.context.route.name
        )
      ) {
        await this.app.$accessor.account.streamSubaccountBalances()
      }
    },

    async isMetamaskInstalled({ commit }) {
      commit('setMetamaskInstalled', await isMetamaskInstalled())
    },

    async getHWAddresses({ state, commit }, wallet: Wallet) {
      if (state.addresses.length === 0 || state.wallet !== wallet) {
        await connect({ wallet })

        commit('setWallet', wallet)
        commit('setAddresses', await getAddresses())
      } else {
        const newAddresses = await getAddresses()

        commit('setAddresses', [...state.addresses, ...newAddresses])
      }
    },

    async connectLedger({ state, commit }, addresses: string[]) {
      await this.app.$accessor.app.validate()

      commit('setWalletConnectStatus', WalletConnectStatus.connecting)
      commit('setWallet', state.wallet)

      await connect({ wallet: state.wallet })

      const [address] = addresses
      const addressConfirmation = await confirm(address)
      const injectiveAddress = getInjectiveAddress(address)

      commit('setInjectiveAddress', injectiveAddress)
      commit('setAddressConfirmation', addressConfirmation)
      commit('setAddresses', addresses)
      commit('setAddress', address)

      await this.app.$accessor.wallet.onConnect()

      commit('setWalletConnectStatus', WalletConnectStatus.connected)
    },

    async connectMetamask({ commit }) {
      commit('setWalletConnectStatus', WalletConnectStatus.connecting)

      await this.app.$accessor.app.validate()

      commit('setWallet', Wallet.Metamask)

      await connect({
        wallet: Wallet.Metamask
      })

      const addresses = await getAddresses()
      const [address] = addresses
      const addressConfirmation = await confirm(address)
      const injectiveAddress = getInjectiveAddress(address)

      commit('setInjectiveAddress', injectiveAddress)
      commit('setAddress', address)
      commit('setAddresses', addresses)
      commit('setAddressConfirmation', addressConfirmation)

      await this.app.$accessor.wallet.onConnect()

      commit('setWalletConnectStatus', WalletConnectStatus.connected)
    },

    async connectKeplr({ commit }) {
      await this.app.$accessor.app.validate()

      commit('setWalletConnectStatus', WalletConnectStatus.connecting)
      commit('setWallet', Wallet.Keplr)

      await connect({
        wallet: Wallet.Keplr
      })

      const injectiveAddresses = await getAddresses()
      const [injectiveAddress] = injectiveAddresses
      const addressConfirmation = await confirm(injectiveAddress)
      const ethereumAddress = getAddressFromInjectiveAddress(injectiveAddress)

      commit('setInjectiveAddress', injectiveAddress)
      commit('setAddress', ethereumAddress)
      commit('setAddresses', injectiveAddresses)
      commit('setAddressConfirmation', addressConfirmation)

      await this.app.$accessor.wallet.onConnect()

      commit('setWalletConnectStatus', WalletConnectStatus.connected)
    },

    async connectTorus({ commit }) {
      await this.app.$accessor.app.validate()

      commit('setWalletConnectStatus', WalletConnectStatus.connecting)
      commit('setWallet', Wallet.Torus)

      await connect({
        wallet: Wallet.Torus
      })

      const addresses = await getAddresses()
      const [address] = addresses
      const addressConfirmation = await confirm(address)
      const injectiveAddress = getInjectiveAddress(address)

      commit('setInjectiveAddress', injectiveAddress)
      commit('setAddress', address)
      commit('setAddresses', addresses)
      commit('setAddressConfirmation', addressConfirmation)

      await this.app.$accessor.wallet.onConnect()

      commit('setWalletConnectStatus', WalletConnectStatus.connected)
    },

    async validate({ state }) {
      const { chainId } = this.app.$accessor.app

      if (state.wallet === Wallet.Metamask) {
        await validateMetamask(state.address, chainId)
      }
    },

    async logout({ commit }) {
      await this.app.$accessor.account.reset()
      await this.app.$accessor.token.reset()
      await this.app.$accessor.spot.resetSubaccount()
      await this.app.$accessor.derivatives.resetSubaccount()
      await this.app.$accessor.bank.reset()
      await this.app.$accessor.referral.reset()
      await this.app.$accessor.positions.reset()
      await this.app.$accessor.activity.reset()

      commit('reset')
      commit('resetPage')
      commit('setWalletConnectStatus', WalletConnectStatus.disconnected)
    },

    async resetPage({ commit }) {
      await this.app.$accessor.token.reset()
      await this.app.$accessor.onboard.reset()
      await this.app.$accessor.gasRebate.reset()

      commit('resetPage')
    }
  }
)
