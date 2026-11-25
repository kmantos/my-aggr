import { Workspace } from '@/types/types'
import { IDBPDatabase, IDBPTransaction } from 'idb'
import { AggrDB } from './workspacesService'
import { Threshold, TradesPaneState } from '@/store/panesSettings/trades'
import {
  getMarketProduct,
  isAllowedQuote,
  parseMarket,
  QUOTE_CURRENCIES
} from './productsService'
import { MarketAlert } from './alertService'

export const databaseUpgrades = {
  0: (db: IDBPDatabase<any>) => {
    console.debug(`[idb] create idb stores`)

    const workspacesStore = db.createObjectStore('workspaces', {
      keyPath: 'id'
    })

    workspacesStore.createIndex('name', 'name')

    const seriesStore = db.createObjectStore('series', {
      keyPath: 'id'
    })

    seriesStore.createIndex('name', 'name')

    db.createObjectStore('products', {
      keyPath: 'exchange'
    })

    db.createObjectStore('gifs', {
      keyPath: 'slug'
    })
  },
  1: (db: IDBPDatabase<AggrDB>) => {
    ;(db as any).deleteObjectStore('series')

    const indicatorsStore = db.createObjectStore('indicators', {
      keyPath: 'id'
    })

    indicatorsStore.createIndex('name', 'name')
  },
  2: (db: IDBPDatabase<AggrDB>) => {
    db.createObjectStore('presets', {
      keyPath: 'name'
    })
  },
  3: (db: IDBPDatabase<AggrDB>) => {
    db.createObjectStore('sounds', {
      keyPath: 'name'
    })
    db.createObjectStore('colors', {
      autoIncrement: true
    })
  },
  5: async (db: IDBPDatabase<AggrDB>) => {
    db.createObjectStore('alerts', {
      keyPath: 'market'
    })
  },
  7: async (db: IDBPDatabase<AggrDB>, tx: IDBPTransaction<AggrDB>) => {
    const objectStore = tx.objectStore('alerts')
    const markets = (await objectStore.getAllKeys()) as any

    for (const market of markets) {
      const [exchange, pair] = parseMarket(market)
      const { local } = getMarketProduct(exchange, pair, true)

      const record = (await objectStore.get(market)) as any

      let alerts: MarketAlert[]

      if (record.prices) {
        alerts = record.prices.map(price => ({
          price,
          market: local,
          active: true
        }))
      } else {
        alerts = record.alerts.map(alert => ({
          ...alert,
          market: local
        }))
      }

      alerts = alerts.filter(alert => alert.price >= 0)

      await (objectStore as any).delete(market)

      if (alerts.length) {
        await (objectStore as any).put({
          market: local,
          alerts
        })
      }
    }
  },
  8: async (db: IDBPDatabase<AggrDB>, tx: IDBPTransaction<AggrDB>) => {
    // CVD is no longer added to new charts by default (still in the library)
    const objectStore = tx.objectStore('indicators') as any
    const cvd = await objectStore.get('cvd')

    if (cvd && cvd.enabled) {
      await objectStore.put({ ...cvd, enabled: false })
    }
  },
  9: async (db: IDBPDatabase<AggrDB>, tx: IDBPTransaction<AggrDB>) => {
    // Volume is no longer added to new charts by default (still in the library)
    const objectStore = tx.objectStore('indicators') as any
    const volume = await objectStore.get('volume')

    if (volume && volume.enabled) {
      await objectStore.put({ ...volume, enabled: false })
    }
  }
}

export const workspaceUpgrades = {
  1: (workspace: Workspace) => {
    const layout = workspace.states.panes.layout

    workspace.states.panes.layouts = {
      lg: JSON.parse(JSON.stringify(layout))
    }

    delete workspace.states.panes.layout
  },
  2: (workspace: Workspace) => {
    if (!workspace.states.settings) {
      return
    }

    workspace.states.settings.audioFilters = {
      HighPassFilter: !!workspace.states.settings.audioFilter,
      LowPassFilter: false,
      Compressor: !!workspace.states.settings.audioCompressor,
      Delay: !!workspace.states.settings.audioDelay,
      PingPongDelay: !!workspace.states.settings.audioPingPong,
      Chorus: false
    }

    delete workspace.states.settings.audioFilter
    delete workspace.states.settings.audioCompressor
    delete workspace.states.settings.audioPingPong
    delete workspace.states.settings.audioDelay
  },
  3: (workspace: Workspace) => {
    // remove alternative layouts, keep only the one fitting current screen size
    const breakpointsWidth = { xl: 1400, lg: 1024, md: 768, sm: 480, xs: 0 }
    const breakpointsCols = { xl: 32, lg: 24, md: 16, sm: 12, xs: 8 }
    const layouts = workspace.states.panes.layouts
    const breakpoints = Object.keys(layouts).reduce((cols, breakpoint) => {
      cols[breakpoint] = breakpointsWidth[breakpoint]
      return cols
    }, {})

    // sort by layout size
    const keys = Object.keys(breakpoints).sort((a, b) => {
      return breakpointsCols[b] - breakpointsCols[a]
    })

    // ensure smallest is level 0 layout
    breakpoints[keys[keys.length - 1]] = 0

    const width = window.innerWidth

    let currentBreakpoint

    for (currentBreakpoint of keys) {
      if (width > breakpoints[currentBreakpoint]) {
        break
      }
    }

    const currentLayout = workspace.states.panes.layouts[currentBreakpoint]

    if (currentBreakpoint !== 'lg') {
      const cols = breakpointsCols[currentBreakpoint]
      const coeficient = breakpointsCols.lg / cols

      for (const pane of currentLayout) {
        pane.x = Math.floor(pane.x * coeficient)
        pane.y = Math.floor(pane.y * coeficient)
        pane.w = Math.floor(pane.w * coeficient)
        pane.h = Math.floor(pane.h * coeficient)
      }
    }

    workspace.states.panes.layout = currentLayout
    delete workspace.states.panes.layouts

    for (const paneId in workspace.states.panes.panes) {
      if (
        workspace.states.panes.panes[paneId].type !== 'chart' ||
        !workspace.states[paneId]
      ) {
        continue
      }

      let scaleMargins = {
        top: 0.1,
        bottom: 0.2
      }

      if (workspace.states[paneId].indicators) {
        const rightIndicatorId = Object.keys(
          workspace.states[paneId].indicators
        ).find(id => {
          return (
            workspace.states[paneId].indicators[id].options &&
            workspace.states[paneId].indicators[id].options.scaleMargins &&
            workspace.states[paneId].indicators[id].options.priceScaleId ===
              'right'
          )
        }) as string

        if (rightIndicatorId) {
          scaleMargins =
            workspace.states[paneId].indicators[rightIndicatorId].options
              .scaleMargins
        }
      }

      workspace.states[paneId].priceScales = {
        right: {
          mode: 0,
          scaleMargins
        }
      }
    }
  },
  4: (workspace: Workspace) => {
    for (const paneId in workspace.states.panes.panes) {
      if (
        workspace.states.panes.panes[paneId].type !== 'trades' ||
        !workspace.states[paneId]
      ) {
        continue
      }

      const state = workspace.states[paneId] as TradesPaneState

      let liquidationThreshold: Threshold = {
        id: 'liquidation_threshold',
        amount: 10000,
        buyColor: 'rgba(236,64,122,0.5)',
        sellColor: 'rgba(255,152,0,0.5)',
        buyAudio:
          "var srqtR = Math.min(1, gain / 4)\nplay(329.63, srqtR, srqtR*2,0,,,'sine')\nplay(329.63, srqtR, srqtR*4,0.08,,,'sine')",
        sellAudio:
          "var srqtR = Math.min(1, gain / 6)\nplay(440, srqtR, srqtR*2,0,,,'sine')\nplay(440, srqtR, srqtR*4,0.08,,,'sine')"
      }

      if (
        workspace.states[paneId].liquidation &&
        workspace.states[paneId].liquidation.amount < 25000
      ) {
        liquidationThreshold = workspace.states[paneId].liquidation
        liquidationThreshold.id = 'liquidation_threshold'

        if (workspace.states[paneId].liquidation.gif) {
          liquidationThreshold.buyGif = workspace.states[paneId].liquidation.gif
          liquidationThreshold.sellGif =
            workspace.states[paneId].liquidation.gif
          delete (liquidationThreshold as any).gif
        }
      }

      state.liquidations = [
        liquidationThreshold,
        {
          id: 'liquidation_significant',
          amount: 25000,
          buyColor: 'rgba(236,64,122,0.6)',
          sellColor: 'rgba(255,152,0,0.7)',
          buyAudio:
            "var srqtR = Math.min(1, gain / 4)\nplay(329.63, srqtR, srqtR*4,0,,,'sine')\nplay(329.63, srqtR, srqtR*6,0.08,,,'sine')",
          sellAudio:
            "var srqtR = Math.min(1, gain / 6)\nplay(440, srqtR, srqtR*4,0,,,'sine')\nplay(440, srqtR, srqtR*6,0.08,,,'sine')"
        },
        {
          id: 'liquidation_huge',
          amount: 100000,
          buyGif: 'rekt',
          sellGif: 'rekt',
          buyColor: 'rgba(236,64,122,0.7)',
          sellColor: 'rgba(255,152,0,0.8)',
          buyAudio:
            "var srqtR = Math.min(1, gain / 4)\nplay(329.63, srqtR, srqtR*4,0,,,'sine')\nplay(329.63, srqtR, srqtR*8,0.08,,,'sine')",
          sellAudio:
            "var srqtR = Math.min(1, gain / 6)\nplay(440, srqtR, srqtR*4,0,,,'sine')\nplay(440, srqtR, srqtR*8,0.08,,,'sine')"
        },
        {
          id: 'liquidation_rare',
          amount: 1000000,
          buyGif: 'explosion',
          sellGif: 'explosion',
          buyColor: 'rgb(156,39,176)',
          sellColor: 'rgb(255,235,59)',
          buyAudio:
            "var srqtR = Math.min(1, gain / 10)\nplay(329.63, srqtR, 1,0,,,'sine')\nplay(329.63, srqtR, srqtR*10,0.08,,,'sine')",
          sellAudio:
            "var srqtR = Math.min(1, gain / 10)\nplay(440, srqtR, 1,0,,,'sine')\nplay(440, srqtR, srqtR*10,0.08,,,'sine')"
        }
      ]

      for (let i = 0; i < state.thresholds.length; i++) {
        if (!(state.thresholds[i] as any).gif) {
          continue
        }

        state.thresholds[i].buyGif = (state.thresholds[i] as any).gif
        state.thresholds[i].sellGif = (state.thresholds[i] as any).gif
        delete (state.thresholds[i] as any).gif
      }
    }
  },
  5: (workspace: Workspace) => {
    for (const paneId in workspace.states.panes.panes) {
      const pane = workspace.states.panes.panes[paneId]
      pane.zoom = Math.ceil(pane.zoom / 0.0625) * 0.0625
    }
  },
  6: (workspace: Workspace) => {
    for (const paneId in workspace.states.panes.panes) {
      const pane = workspace.states.panes.panes[paneId]

      if (!/^trades/.test(pane.type) || !workspace.states[paneId]) {
        continue
      }

      if (typeof workspace.states[paneId].showTradesPairs !== 'undefined') {
        workspace.states[paneId].showPairs =
          workspace.states[paneId].showTradesPairs
        delete workspace.states[paneId].showTradesPairs
      }

      if (typeof workspace.states[paneId].showPrice !== 'undefined') {
        workspace.states[paneId].showPrices = workspace.states[paneId].showPrice
        delete workspace.states[paneId].showPrice
      }

      if (
        typeof workspace.states[paneId].showPressureHistogram !== 'undefined'
      ) {
        workspace.states[paneId].showHistograms =
          workspace.states[paneId].showPressureHistogram
        delete workspace.states[paneId].showPressureHistogram
      }

      if (typeof workspace.states[paneId].tradeType !== 'undefined') {
        workspace.states[paneId].showTrades =
          workspace.states[paneId].tradeType === 'both' ||
          workspace.states[paneId].tradeType === 'trades'
        workspace.states[paneId].showLiquidations =
          workspace.states[paneId].tradeType === 'both' ||
          workspace.states[paneId].tradeType === 'liquidations'
        delete workspace.states[paneId].tradeType
      }
    }
  },
  7: (workspace: Workspace) => {
    if (
      workspace.states.settings &&
      workspace.states.settings.alertsColor === 'red'
    ) {
      workspace.states.settings.alertsColor = 'rgb(255, 0, 0)'
    }
  },
  8: (workspace: Workspace) => {
    // new chart defaults: 1m instead of 5s, no default CVD indicator
    for (const paneId in workspace.states.panes.panes) {
      const pane = workspace.states.panes.panes[paneId]
      const state = workspace.states[paneId]

      if (pane.type !== 'chart' || !state) {
        continue
      }

      if (+state.timeframe === 5) {
        state.timeframe = 60
      }

      if (!state.indicators) {
        continue
      }

      for (const id in state.indicators) {
        const indicator = state.indicators[id]

        if (id !== 'cvd' && indicator.libraryId !== 'cvd') {
          continue
        }

        delete state.indicators[id]

        if (Array.isArray(state.indicatorOrder)) {
          state.indicatorOrder = state.indicatorOrder.filter(
            indicatorId => indicatorId !== id
          )
        }

        const priceScaleId = indicator.options && indicator.options.priceScaleId

        if (
          priceScaleId &&
          state.priceScales &&
          !Object.values(state.indicators).some(
            (other: any) =>
              other.options && other.options.priceScaleId === priceScaleId
          )
        ) {
          delete state.priceScales[priceScaleId]
        }
      }
    }
  },
  9: (workspace: Workspace) => {
    // new default layout (BTC + ETH charts, SPOT / FUTURES / REKTS on all
    // exchanges): drop saved panes so they are rebuilt from defaultPanes.json
    const panes = workspace.states.panes ? workspace.states.panes.panes : null

    for (const paneId in panes || {}) {
      delete workspace.states[paneId]
    }

    delete workspace.states.panes

    // and enable every exchange
    const exchanges = workspace.states.exchanges

    for (const exchangeId in exchanges || {}) {
      const exchange = exchanges[exchangeId]

      if (
        exchangeId[0] !== '_' &&
        exchange &&
        typeof exchange === 'object' &&
        !Array.isArray(exchange)
      ) {
        exchange.disabled = false
      }
    }
  },
  10: (workspace: Workspace) => {
    // trades lists show clock time (10:04) instead of "5s ago",
    // and the thresholds multiplier slider is gone
    const panes = workspace.states.panes ? workspace.states.panes.panes : {}

    for (const paneId in panes) {
      const state = workspace.states[paneId]

      if (panes[paneId].type !== 'trades' || !state) {
        continue
      }

      state.showTimeAgo = false
      delete state.thresholdsMultipler
    }
  },
  11: (workspace: Workspace) => {
    // chart options removed from the app: drop their saved values
    const removedChartOptions = [
      'showLegend',
      'showVerticalGridlines',
      'verticalGridlinesColor',
      'showHorizontalGridlines',
      'horizontalGridlinesColor',
      'showWatermark',
      'watermarkColor',
      'showBorder',
      'borderColor',
      'showLeftScale',
      'showRightScale',
      'showTimeScale',
      'fillGapsWithEmpty'
    ]
    const panes = workspace.states.panes ? workspace.states.panes.panes : {}

    for (const paneId in panes) {
      const state = workspace.states[paneId]

      if (panes[paneId].type !== 'chart' || !state) {
        continue
      }

      for (const key of removedChartOptions) {
        delete state[key]
      }
    }

    if (workspace.states.settings) {
      delete workspace.states.settings.normalizeWatermarks
    }
  },
  12: (workspace: Workspace) => {
    // chart text color option removed (charts use the theme text color)
    const panes = workspace.states.panes ? workspace.states.panes.panes : {}

    for (const paneId in panes) {
      if (panes[paneId].type === 'chart' && workspace.states[paneId]) {
        delete workspace.states[paneId].textColor
      }
    }
  },
  13: (workspace: Workspace) => {
    // trade lists: 10 lines by default, clock time only, no threshold multipliers
    const panes = workspace.states.panes ? workspace.states.panes.panes : {}

    for (const paneId in panes) {
      const state = workspace.states[paneId]

      if (!/^trades/.test(panes[paneId].type) || !state) {
        continue
      }

      state.maxRows = 10
      delete state.showTimeAgo
      delete state.multipliers
    }
  },
  14: (workspace: Workspace) => {
    // chart refresh rate, countdown and flip moved to the main settings (one
    // value for every chart): keep the first chart's values. Weighted average
    // price is always used in trade lists.
    const panes = workspace.states.panes ? workspace.states.panes.panes : {}
    let copied = false

    for (const paneId in panes) {
      const state = workspace.states[paneId]

      if (!state) {
        continue
      }

      if (panes[paneId].type === 'chart') {
        if (!copied) {
          // settings are only stored once changed: merge into a partial state
          const settings =
            workspace.states.settings || (workspace.states.settings = {})

          if (typeof state.refreshRate === 'number') {
            settings.chartRefreshRate = state.refreshRate
          }
          if (typeof state.showCountdown === 'boolean') {
            settings.showCountdown = state.showCountdown
          }
          if (typeof state.flipped === 'boolean') {
            settings.flipCharts = state.flipped
          }
          copied = true
        }

        delete state.refreshRate
        delete state.showCountdown
        delete state.flipped
      } else if (/^trades/.test(panes[paneId].type)) {
        delete state.showAvgPrice
      }
    }
  },
  15: (workspace: Workspace) => {
    // futures (dated contracts) search filter removed
    const settings = workspace.states.settings

    if (settings && settings.searchTypes) {
      delete settings.searchTypes.futures
    }
  },
  16: (workspace: Workspace) => {
    // search history (recents) and the historical data filter removed: search
    // always lists markets with historical data
    const settings = workspace.states.settings

    if (!settings) {
      return
    }

    delete settings.previousSearchSelections

    if (settings.searchTypes) {
      delete settings.searchTypes.recent
      delete settings.searchTypes.recentSearches
      delete settings.searchTypes.historical
    }
  },
  17: (workspace: Workspace) => {
    // only USD, USDT and USDC quoted markets are used, and charts zoom from 1x
    // to 10x starting at 3x (barSpacing null = default zoom)
    const settings = workspace.states.settings

    if (settings && settings.searchQuotes) {
      for (const quote in settings.searchQuotes) {
        if (QUOTE_CURRENCIES.indexOf(quote) === -1) {
          delete settings.searchQuotes[quote]
        }
      }
    }

    const panes = workspace.states.panes ? workspace.states.panes.panes : {}

    for (const paneId in panes) {
      const pane = panes[paneId]

      if (Array.isArray(pane.markets)) {
        const markets = pane.markets.filter(market => {
          const [exchange, pair] = parseMarket(market)
          const product = getMarketProduct(exchange, pair)

          return (
            !product || exchange === 'AGGR' || isAllowedQuote(product.quote)
          )
        })

        // never leave a pane without markets
        if (markets.length) {
          pane.markets = markets
        }
      }

      if (pane.type === 'chart' && workspace.states[paneId]) {
        workspace.states[paneId].barSpacing = null
      }
    }
  }
}
