import aggregatorService from '@/services/aggregatorService'
import workspacesService from '@/services/workspacesService'
import { slugify, uniqueName } from '@/utils/helpers'
import { registerModule } from '@/utils/store'
import Vue from 'vue'
import { MutationTree, ActionTree, GetterTree, Module } from 'vuex'
import { ModulesState } from '.'
import panesSettings from './panesSettings'
import defaultPanes from './defaultPanes.json'
import { ListenedProduct } from './app'
import { getMarketProduct, parseMarket } from '../services/productsService'
import { GridItem, GridSpace, findOrCreateSpace } from '@/utils/grid'
import dialogService from '@/services/dialogService'
import { IS_CAR_BROWSER } from '@/utils/constants'

// the site has chart panes and trades panes (the "trades-lite" feed)
export enum PaneType {
  chart = 'chart',
  trades = 'trades-lite'
}

export type MarketsListeners = { [market: string]: ListenedProduct }

export interface Pane {
  type: string
  id: string
  name: string
  zoom?: number
  markets?: string[]
  settings?: any
  // default panes: replace markets with every matching market from all
  // enabled exchanges, once, after first boot (see resolveAutoMarkets)
  autoMarkets?: { pairs: string[]; types: string[] }
}

export interface PanesState {
  locked?: boolean
  layout: GridItem[]
  panes: { [paneId: string]: Pane }
  marketsListeners: MarketsListeners
  syncedWithParentFrame: string[]
}

// 24 columns x 24 rows: BTC + ETH charts on the left, SPOT / FUTURES / REKTS on the right
const layoutDesktop = [
  { i: 'chart', type: 'chart', x: 0, y: 0, w: 20, h: 16 },
  { i: 'chart-eth', type: 'chart', x: 0, y: 16, w: 20, h: 8 },
  { i: 'spot', type: 'trades-lite', x: 20, y: 0, w: 4, h: 5 },
  { i: 'futures', type: 'trades-lite', x: 20, y: 5, w: 4, h: 13 },
  { i: 'liquidations', type: 'trades-lite', x: 20, y: 18, w: 4, h: 6 }
]

const layoutMobile = [
  { i: 'chart', type: 'chart', x: 0, y: 0, w: 24, h: 16 },
  { i: 'futures', type: 'trades-lite', x: 0, y: 16, w: 24, h: 8 }
]

const state: PanesState = JSON.parse(JSON.stringify(defaultPanes))

const getters = {
  getName: state => (id: string) => {
    const name = state.panes[id].name
    const market = state.marketsListeners[state.panes[id].markets[0]]

    if (name) {
      return name.trim()
    } else if (market) {
      return market.local
    } else {
      return state.panes[id].type
    }
  },
  getFocusedPaneId: (state, getters, rootState) => (type: string) => {
    if (
      rootState.app.focusedPaneId &&
      state.panes[rootState.app.focusedPaneId].type === type
    ) {
      return rootState.app.focusedPaneId
    } else {
      for (const id in state.panes.panes) {
        if (state.panes.panes[id].type === type) {
          return id
        }
      }
    }

    return null
  }
} as GetterTree<PanesState, ModulesState>

const actions = {
  async boot({ state, dispatch }) {
    if (!state.layout.length && Object.keys(state.panes).length) {
      dispatch('setupLayout')
    }

    for (const market in state.marketsListeners) {
      if (typeof state.marketsListeners[market] === 'number') {
        delete state.marketsListeners[market]
      } else {
        state.marketsListeners[market].listeners = 0
      }
    }
  },
  async addPane(
    { commit, dispatch, state },
    options: Pane & {
      settings?: any
      originalGridItem?: any
    }
  ) {
    if (!panesSettings[options.type] && options.name.indexOf(':') === -1) {
      this.dispatch('app/showNotice', {
        title: 'Unrecognized pane type "' + options.type + '"',
        type: 'error'
      })
      return
    }

    const name = options.name || ''
    const id = uniqueName(
      slugify(name || options.type),
      Object.keys(state.panes)
    )

    const pane: Pane = {
      id,
      name,
      type: options.type,
      zoom: options.zoom,
      settings: options.settings,
      markets: options.markets || Object.keys(state.marketsListeners)
    }

    const item = { pane, space: null }

    try {
      item.space = await findOrCreateSpace(
        state.layout,
        options.originalGridItem
      )
    } catch (error) {
      dialogService.confirm({
        message: `Please remove one or more existing panes to create space before adding a new pane`,
        cancel: null
      })
    }

    await registerModule(id, {}, true, pane)

    commit('ADD_PANE', pane)
    commit('ADD_GRID_ITEM', item)

    dispatch('refreshMarketsListeners')
  },
  async removePane({ commit, state, dispatch, rootState }, id: string) {
    const item = state.panes[id]

    if (!item) {
      return
    }

    dispatch('removePaneGridItems', id)
    commit('REMOVE_PANE', id)
    dispatch('refreshMarketsListeners')

    if (state.syncedWithParentFrame.indexOf(id) !== -1) {
      commit('TOGGLE_SYNC_WITH_PARENT_FRAME', id)
    }

    if (rootState.app.focusedPaneId === id) {
      this.commit('app/SET_FOCUSED_PANE', null)
    }

    await workspacesService.removeState(id)

    setTimeout(() => {
      this.unregisterModule(id)

      localStorage.removeItem(id)
    })
  },
  removePaneGridItems({ commit, state }, id: string) {
    const item = state.layout.find(item => item.i === id)

    if (item) {
      const index = state.layout.indexOf(item)
      commit('REMOVE_GRID_ITEM', index)
    }
  },
  async refreshMarketsListeners(
    { rootState, commit, state },
    { markets, id } = {}
  ) {
    // cache original listeners (market: n listeners)
    const originalListeners: { [marketKey: string]: number } = Object.keys(
      state.marketsListeners
    ).reduce((listenersByMarkets, marketKey) => {
      listenersByMarkets[marketKey] =
        state.marketsListeners[marketKey].listeners

      return listenersByMarkets
    }, {})

    // new listeners stored here
    const marketsListeners: MarketsListeners = {}

    for (const paneId in state.panes) {
      let paneMarkets = state.panes[paneId].markets
      if (markets && (!id || paneId === id)) {
        paneMarkets = markets
      }

      for (const marketKey of paneMarkets) {
        if (typeof marketsListeners[marketKey] === 'undefined') {
          if (state.marketsListeners[marketKey]) {
            marketsListeners[marketKey] = state.marketsListeners[marketKey]
            marketsListeners[marketKey].listeners = 0
          } else {
            const [exchange, pair] = parseMarket(marketKey)

            marketsListeners[marketKey] = getMarketProduct(exchange, pair, true)

            marketsListeners[marketKey].listeners = 0
          }
        }

        if (!rootState.exchanges[marketsListeners[marketKey].exchange]) {
          continue
        }

        if (typeof marketsListeners[marketKey] !== 'undefined') {
          marketsListeners[marketKey].listeners++
        }
      }
    }

    const allUniqueMarkets = Object.keys(marketsListeners)
      .concat(Object.keys(state.marketsListeners))
      .filter((v, i, a) => a.indexOf(v) === i)

    const toConnect = []
    const toDisconnect = []

    for (const market of allUniqueMarkets) {
      const previousListeners = originalListeners[market]
      const currentListeners =
        marketsListeners[market] && marketsListeners[market].listeners

      if (!previousListeners && currentListeners) {
        toConnect.push(market)
      } else if (previousListeners && !currentListeners) {
        toDisconnect.push(market)

        if (state.marketsListeners[market]) {
          // dlete market from store
          delete state.marketsListeners[market]
        }
      }
    }

    aggregatorService.connect(toConnect)
    aggregatorService.disconnect(toDisconnect)

    commit('SET_MARKETS_LISTENERS', marketsListeners)

    if (markets) {
      for (const paneId in state.panes) {
        if (!id || paneId === id) {
          commit('SET_PANE_MARKETS', { id: paneId, markets })
        }
      }
    }
  },
  setMarketsForAll({ dispatch }, markets: string[]) {
    return dispatch('refreshMarketsListeners', { markets })
  },
  setMarketsForPane(
    { dispatch },
    { id, markets }: { id: string; markets: string[] }
  ) {
    return dispatch('refreshMarketsListeners', { id, markets })
  },
  async resetPane(
    { state, rootState },
    { id, data, type }: { id: string; data?: any; type?: string }
  ) {
    const pane = JSON.parse(JSON.stringify(state.panes[id]))

    const currentPaneState = Object.assign(
      {},
      rootState[id],
      data && typeof data === 'object' ? data : {}
    )

    const layoutItem = state.layout.find(a => a.i === id)
    const originalPaneType = layoutItem.type
    layoutItem.type = 'div'

    const paneItem = state.panes[id]
    paneItem.type = type || originalPaneType

    this.unregisterModule(id)

    await workspacesService.removeState(id)

    if (currentPaneState) {
      await workspacesService.saveState(id, currentPaneState)
    }

    await registerModule(id, {}, true, pane)

    layoutItem.type = type || originalPaneType
  },
  setZoom({ commit, dispatch }, { id, zoom }: { id: string; zoom: number }) {
    commit('SET_PANE_ZOOM', { id, zoom })

    dispatch('refreshZoom', { id })
  },
  refreshZoom({ state }, { id, zoom }: { id: string; zoom?: number }) {
    zoom =
      typeof zoom === 'number'
        ? zoom
        : state.panes[id].zoom
          ? Math.max(0.1, state.panes[id].zoom)
          : 1
    const el = document.getElementById(id) as HTMLElement

    if (el) {
      const parent = el.parentElement

      parent.style.fontSize = zoom ? zoom + 'rem' : ''
      el.classList.remove('-large', '-extra-large', '-small', '-extra-small')

      if (zoom > 1) {
        el.classList.add('-large')
        if (zoom >= 2) {
          el.classList.add('-extra-large')
        }
      } else if (zoom < 1) {
        el.classList.add('-small')
        if (zoom < 0.87) {
          el.classList.add('-extra-small')
        }
      }
    }
  },
  setupLayout({ state }) {
    // first time load
    // app not even loaded yet

    let initialZoom = 1
    const innerWidth = window.innerWidth
    // car screens (wide but short, ex: 853x336) use the phone layout too
    const isCarScreen =
      IS_CAR_BROWSER || (innerWidth >= 768 && window.innerHeight < 500)

    if (innerWidth >= 768 && !isCarScreen) {
      // start with desktop layout
      state.layout = layoutDesktop

      if (innerWidth >= 1920) {
        initialZoom = 1.25
      }
    } else {
      // start with mobile layout (phones and car screens)
      state.layout = layoutMobile

      // only keep the panes used by the mobile layout
      for (const paneId in state.panes) {
        if (!layoutMobile.find(item => item.i === paneId)) {
          delete state.panes[paneId]
        }
      }

      // no liquidations pane (REKTS) on mobile: show them in FUTURES
      if (state.panes.futures && state.panes.futures.settings) {
        state.panes.futures.settings.showLiquidations = true
      }
    }

    if (initialZoom > 1) {
      for (const paneId in state.panes) {
        state.panes[paneId].zoom = initialZoom
      }
    }
  }
} as ActionTree<PanesState, ModulesState>

const mutations = {
  ADD_PANE: (state, pane: Pane) => {
    Vue.set(state.panes, pane.id, pane)
  },
  REMOVE_PANE: (state, id: string) => {
    Vue.delete(state.panes, id)
  },
  ADD_GRID_ITEM: (state, { pane, space }: { pane: Pane; space: GridSpace }) => {
    const item: GridItem = {
      i: pane.id,
      type: pane.type,
      x: space.x,
      y: space.y,
      w: space.w,
      h: space.h
    }

    state.layout.push(item)
  },
  REMOVE_GRID_ITEM: (state, index) => {
    state.layout.splice(index, 1)
  },
  UPDATE_LAYOUT: (state, items: GridItem[]) => {
    state.layout = items
  },
  TOGGLE_LAYOUT: state => {
    state.locked = !state.locked
  },
  SET_MARKETS_LISTENERS: (state, marketsListeners: MarketsListeners) => {
    state.marketsListeners = marketsListeners
  },
  SET_PANE_MARKETS: (
    state,
    { id, markets }: { id: string; markets: string[] }
  ) => {
    state.panes[id].markets = markets
  },
  CLEAR_PANE_AUTO_MARKETS: (state, id: string) => {
    if (state.panes[id]) {
      Vue.delete(state.panes[id], 'autoMarkets')
    }
  },
  SET_PANE_NAME: (state, { id, name }: { id: string; name: string }) => {
    state.panes[id].name = name
  },
  SET_PANE_ZOOM: (state, { id, zoom }: { id: string; zoom: number }) => {
    Vue.set(state.panes[id], 'zoom', zoom)
  },
  TOGGLE_SYNC_WITH_PARENT_FRAME: (state, paneId) => {
    const index = state.syncedWithParentFrame.indexOf(paneId)

    if (index !== -1) {
      state.syncedWithParentFrame.splice(index, 1)
    } else {
      state.syncedWithParentFrame.push(paneId)
    }
  }
} as MutationTree<PanesState>

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
} as Module<PanesState, ModulesState>
