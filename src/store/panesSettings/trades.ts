import { MutationTree, ActionTree, GetterTree, Module } from 'vuex'

import Vue from 'vue'
import { parseAmount, randomString } from '@/utils/helpers'
import { ModulesState } from '..'
import { getLogShade, joinRgba, splitColorCode } from '@/utils/colors'
import defaultTresholds from '@/store/defaultThresholds.json'

export interface Threshold {
  id: string
  amount: number
  buyColor: string
  sellColor: string
  buyAudio: string
  sellAudio: string
  max?: boolean
}

export interface TradesPaneState {
  _id?: string
  liquidations: Threshold[]
  thresholds: Threshold[]
  audioThreshold: number
  muted: boolean
  maxRows: number
  showPairs: boolean
  showPrices: boolean
  showTrades: boolean
  showLiquidations: boolean
}

const getters = {
  getThreshold: state => (id: string) => {
    for (let i = 0; i < state.thresholds.length; i++) {
      if (state.thresholds[i].id === id) {
        return state.thresholds[i]
      }
    }

    for (let i = 0; i < state.liquidations.length; i++) {
      if (state.liquidations[i].id === id) {
        return state.liquidations[i]
      }
    }
  }
} as GetterTree<TradesPaneState, ModulesState>

const state = {
  liquidations: [],
  thresholds: [],
  audioThreshold: null,
  maxRows: 10,
  muted: false,
  showPairs: false,
  showTrades: true,
  // new trades panes: trades only (liquidations have their own pane)
  showLiquidations: false,
  showPrices: true
} as TradesPaneState

const actions = {
  boot({ state }) {
    if (
      !state.thresholds.length ||
      (state.thresholds.length === 1 &&
        typeof state.thresholds[0].id === 'undefined')
    ) {
      state.thresholds = defaultTresholds.thresholds
    }

    if (
      !state.liquidations.length ||
      (state.liquidations.length === 1 &&
        typeof state.liquidations[0].id === 'undefined')
    ) {
      state.liquidations = defaultTresholds.liquidations
    }
  },
  generateSwatch(
    { state },
    {
      color,
      side,
      type = 'thresholds',
      baseVariance = 0.15
    }: {
      color: string
      side: 'buy' | 'sell'
      type: 'thresholds' | 'liquidations'
      baseVariance: number
    }
  ) {
    const count = state[type].length
    const baseMultipler = (count / 2) * -baseVariance
    const colorRgb = color ? splitColorCode(color) : null
    const name = `${side}Color`

    if (!colorRgb) {
      return
    }

    for (let i = 0; i < count; i++) {
      if (i === 1) {
        state[type][i][name] = joinRgba([
          colorRgb[0],
          colorRgb[1],
          colorRgb[2],
          (colorRgb[3] || 1) * 0.8
        ])
      } else {
        const buyScaled = getLogShade(
          colorRgb,
          baseMultipler + baseVariance * (i ? i : -0.5)
        )
        if (!i) {
          buyScaled[3] = 0.5
        }
        state[type][i][name] = joinRgba(buyScaled)
      }
    }
  }
} as ActionTree<TradesPaneState, ModulesState>

const mutations = {
  SET_MAX_ROWS(state, value) {
    // whole number between 1 and 1000, invalid input keeps the current value
    const rows = Math.round(+value)

    if (!isNaN(rows) && rows >= 1) {
      state.maxRows = Math.min(1000, rows)
    }
  },
  TOGGLE_MUTED(state) {
    state.muted = !state.muted
  },
  TOGGLE_PREFERENCE(state, key) {
    state[key] = !state[key]
  },
  SET_THRESHOLD_AMOUNT(state, { id, value }) {
    const threshold = this.getters[state._id + '/getThreshold'](id)

    if (threshold) {
      threshold.amount = parseAmount(value)
    }
  },
  TOGGLE_THRESHOLD_MAX(state, id) {
    const threshold = this.getters[state._id + '/getThreshold'](id)

    if (threshold) {
      Vue.set(threshold, 'max', !threshold.max)
    }
  },
  SET_THRESHOLD_COLOR(state, { id, side, value }) {
    if (!id) {
      return
    }

    const threshold = this.getters[state._id + '/getThreshold'](id)

    if (threshold) {
      threshold[side] = value
    }
  },
  SET_THRESHOLD_AUDIO(state, { id, buyAudio, sellAudio }) {
    const threshold = this.getters[state._id + '/getThreshold'](id)

    if (threshold) {
      threshold['buyAudio'] = buyAudio
      threshold['sellAudio'] = sellAudio
    }
  },
  ADD_THRESHOLD(state, type) {
    const previousThreshold = state[type][state[type].length - 1]

    let buyAudio = `play(659.26, ratio, ratio, 0)`
    let sellAudio = `play(493.88, ratio, ratio, 0)`

    if (previousThreshold) {
      buyAudio = previousThreshold.buyAudio
      sellAudio = previousThreshold.sellAudio
    }

    state[type].push({
      id: randomString(8),
      amount: state[type][state[type].length - 1].amount * 2,
      buyColor: 'rgb(0, 255, 0)',
      sellColor: 'rgb(255, 0, 0)',
      buyAudio,
      sellAudio
    })
  },
  DELETE_THRESHOLD(state, id: string) {
    const tradesIndex = state.thresholds.indexOf(
      state.thresholds.find(t => t.id === id)
    )

    if (tradesIndex !== -1) {
      state.thresholds.splice(tradesIndex, 1)

      return
    }

    const liquidationsIndex = state.liquidations.indexOf(
      state.liquidations.find(t => t.id === id)
    )

    if (liquidationsIndex !== -1) {
      state.liquidations.splice(liquidationsIndex, 1)

      return
    }
  },
  SET_AUDIO_THRESHOLD(state, amount: number) {
    state.audioThreshold = amount
  }
} as MutationTree<TradesPaneState>

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
} as Module<TradesPaneState, ModulesState>
