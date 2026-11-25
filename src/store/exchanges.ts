import aggregatorService from '@/services/aggregatorService'
import { ActionTree, GetterTree, Module } from 'vuex'
import { ModulesState } from '.'

// every supported exchange is always available: markets are picked per pane
// eslint-disable-next-line @typescript-eslint/ban-types
export type ExchangeSettings = {}

export type ExchangesState = { [exchangeId: string]: ExchangeSettings } & {
  _id: string
  _exchanges: string[]
}

export const supportedExchanges = import.meta.env.VITE_APP_EXCHANGES.split(
  ','
).map(id => id.toUpperCase())

const state = supportedExchanges.reduce(
  (exchangesState: ExchangesState, id: string) => {
    exchangesState[id] = {}

    return exchangesState
  },
  {
    _exchanges: []
  } as any
) as ExchangesState

state._id = 'exchanges'

const getters = {
  getExchanges: state =>
    Object.keys(state).filter(id => id !== 'INDEX' && !/^_/.test(id))
} as GetterTree<ExchangesState, ModulesState>

const actions = {
  async boot({ dispatch }) {
    await dispatch('prepareExchanges')
  },
  prepareExchanges({ state, getters, rootState }) {
    state._exchanges.splice(0, state._exchanges.length)

    for (const id of getters.getExchanges) {
      if (supportedExchanges.indexOf(id) === -1) {
        if (rootState.exchanges[id]) {
          delete rootState.exchanges[id]
        }

        continue
      }

      state._exchanges.push(id)
    }
  },
  async disconnect({ rootState }, id: string) {
    const exchangeRegex = new RegExp(`^${id}:`, 'i')
    const markets = Object.keys(rootState.panes.marketsListeners).filter(p =>
      exchangeRegex.test(p)
    )

    console.log(
      `[exchanges.${id}] manually disconnecting ${markets.join(', ')}`
    )

    await aggregatorService.disconnect(markets)
  },
  async connect({ rootState }, id: string) {
    const exchangeRegex = new RegExp(`^${id}:`, 'i')
    const markets = Object.keys(rootState.panes.marketsListeners).filter(p =>
      exchangeRegex.test(p)
    )

    console.log(`[exchanges.${id}] manually connecting ${markets.join(', ')}`)

    await aggregatorService.connect(markets)
  }
} as ActionTree<ExchangesState, ModulesState>

export default {
  namespaced: true,
  getters,
  state,
  actions
} as Module<ExchangesState, ModulesState>
