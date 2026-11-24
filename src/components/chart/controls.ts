import alertService, { MarketAlert } from '@/services/alertService'
import dialogService from '@/services/dialogService'
import store from '@/store'
import {
  createComponent,
  floorTimestampToTimeframe,
  getEventCords,
  mountComponent
} from '@/utils/helpers'
import { isTouchSupported } from '@/utils/touchevent'
import {
  IPriceLine,
  MouseEventParams,
  PriceLineOptions
} from 'lightweight-charts'
import Chart from './chart'
import AlertEventHandler from './controls/alertEventHandler'
import MeasurementEventHandler from './controls/measurementEventHandler'
import { getChartCustomColorsOptions } from './options'
import { components, controlledCharts, syncCrosshair } from './common'
import iframeService from '@/services/iframeService'

export default class ChartControl {
  chart: Chart

  private onPanTimeout: number
  private lastCrosshairX: number
  private activeEvent: any
  private isSyncingCrosshairs: boolean

  private clickHandler: (event: MouseEvent | TouchEvent) => void
  private contextMenuHandler: (event: MouseEvent | TouchEvent) => void
  private clearChartsCrosshairsHandler: (event: MouseEvent) => void
  private crosshairMoveHandler: (MouseEventParams) => void
  private onPanHandler: (MouseEventParams) => void
  private unsubscribeStore: () => void

  constructor(chart) {
    this.chart = chart
  }

  bindEvents() {
    this.subscribeStore()

    // bind pan
    this.onPanHandler = this.onPan.bind(this)
    this.chart.chartInstance
      .timeScale()
      .subscribeVisibleLogicalRangeChange(this.onPanHandler)
    const canvas = this.chart.chartElement

    // bind click
    if (import.meta.env.VITE_APP_PUBLIC_VAPID_KEY) {
      this.clickHandler = this.onClick.bind(this)
      canvas.addEventListener(
        isTouchSupported() ? 'touchstart' : 'mousedown',
        this.clickHandler
      )
    }
    this.contextMenuHandler = this.onContextMenu.bind(this)
    canvas.addEventListener('contextmenu', this.contextMenuHandler)

    // bind crosshair
    this.crosshairMoveHandler = this.onCrosshairMove.bind(this)
    this.chart.chartInstance.subscribeCrosshairMove(this.crosshairMoveHandler)
    this.clearChartsCrosshairsHandler = this.clearChartsCrosshairs.bind(this)
    canvas.addEventListener('mouseleave', this.clearChartsCrosshairsHandler)

    controlledCharts.push(this.chart)
  }

  unbindEvents() {
    this.unsubscribeStore()

    // unbind pan
    this.chart.chartInstance
      .timeScale()
      .unsubscribeVisibleLogicalRangeChange(this.onPan)

    // unbind click / context menu
    const canvas = this.chart.chartElement

    if (import.meta.env.VITE_APP_PUBLIC_VAPID_KEY) {
      const clickEventName = isTouchSupported() ? 'touchstart' : 'mousedown'
      canvas.removeEventListener(clickEventName, this.clickHandler)
      this.clickHandler = null
    }
    canvas.removeEventListener('contextmenu', this.contextMenuHandler)
    this.contextMenuHandler = null

    // unbind crosshair
    this.chart.chartInstance.unsubscribeCrosshairMove(this.crosshairMoveHandler)
    this.crosshairMoveHandler = null

    // remove from sync
    const index = controlledCharts.indexOf(this.chart)
    if (index !== -1) {
      controlledCharts.splice(index, 1)
    }
  }

  subscribeStore() {
    this.unsubscribeStore = store.subscribe(mutation => {
      switch (mutation.type) {
        case this.chart.paneId + '/FLAG_INDICATOR_AS_SAVED':
          this.chart.saveIndicatorPreview(mutation.payload)
          break
        case 'settings/SET_CHART_THEME':
        case 'settings/SET_TEXT_COLOR':
        case 'settings/SET_BACKGROUND_COLOR':
          this.chart.chartInstance.applyOptions(
            getChartCustomColorsOptions(this.chart.paneId)
          )
          // custom colors options include the (hidden) default watermark
          this.chart.updatePriceWatermark(true)
          break
        case 'settings/SET_TIMEZONE_OFFSET':
          this.chart.setTimezoneOffset(store.state.settings.timezoneOffset)
          this.chart.clearChart()
          this.chart.renderAll()
          break
        case 'panes/SET_PANE_MARKETS':
          if (mutation.payload.id === this.chart.paneId) {
            store.state[this.chart.paneId].hiddenMarkets = {}
            this.chart.refreshMarkets()

            this.chart.clear()
            this.chart.fetch()
          }
          break
        case 'panes/SET_PANE_ZOOM':
          if (mutation.payload.id === this.chart.paneId) {
            this.chart.updateFontSize()
          }
          break
        case this.chart.paneId + '/SET_TIMEFRAME':
          this.chart.clear()
          this.chart.fetch()
          break
        case 'settings/TOGGLE_ALERTS':
        case this.chart.paneId + '/TOGGLE_ALERTS':
        case this.chart.paneId + '/TOGGLE_ALERTS_LABEL':
        case 'settings/SET_ALERTS_COLOR':
        case 'settings/SET_ALERTS_LINESTYLE':
        case 'settings/SET_ALERTS_LINEWIDTH':
        case 'app/EXCHANGE_UPDATED':
        case this.chart.paneId + '/TOGGLE_MARKET':
          this.chart.refreshMarkets()
          this.chart.refreshAllIndicatorAdapters()
          this.chart.renderAll()
          break
        case this.chart.paneId + '/SET_REFRESH_RATE':
          this.chart.clearQueue()
          this.chart.setupQueue()
          break
        case this.chart.paneId + '/SET_INDICATOR_OPTION':
          this.chart.setIndicatorOption(
            mutation.payload.id,
            mutation.payload.key,
            mutation.payload.value,
            mutation.payload.silent
          )
          break
        case this.chart.paneId + '/SET_PRICE_SCALE':
          if (mutation.payload.priceScale) {
            this.chart.refreshPriceScale(mutation.payload.id)
          }
          break
        case this.chart.paneId + '/SET_INDICATOR_SCRIPT':
          this.chart.rebuildIndicator(mutation.payload.id)
          break
        case this.chart.paneId + '/ADD_INDICATOR':
          if (this.chart.addIndicator(mutation.payload.id)) {
            this.chart.redrawIndicator(mutation.payload.id)
          }
          break
        case this.chart.paneId + '/UPDATE_INDICATOR_ORDER':
          this.chart.moveIndicator(
            mutation.payload.id,
            mutation.payload.position
          )
          break
        case this.chart.paneId + '/REMOVE_INDICATOR':
          this.chart.removeIndicator(mutation.payload)
          break
        case 'settings/TOGGLE_AUTO_HIDE_HEADERS':
          this.chart.refreshChartDimensions()
          break
      }
    })
  }

  onContextMenu(event) {
    if (window.innerWidth < 375) {
      return
    }

    const canvas = event.currentTarget as HTMLCanvasElement

    event.preventDefault()
    const { x, y } = getEventCords(event, true)
    const { top, left } = canvas.getBoundingClientRect()
    const api = this.chart.getPriceApi()
    const market = this.chart.mainIndex

    let price
    let alert
    if (api) {
      const pricedCoordinate = api.coordinateToPrice(y - top)

      if (pricedCoordinate) {
        price = alertService.formatPrice(pricedCoordinate)
      }

      const timeScale = this.chart.chartInstance.timeScale()

      const priceline = api.getPriceLine(
        price,
        timeScale ? timeScale.coordinateToLogical(x - left) : null
      ) as IPriceLine

      if (priceline) {
        const pricelineOptions = priceline.options() as PriceLineOptions &
          MarketAlert

        alert = {
          price: pricelineOptions.price,
          market: pricelineOptions.market,
          message: pricelineOptions.message
        }
      }
    }

    const timestamp = floorTimestampToTimeframe(
      Date.now() / 1000,
      this.chart.timeframe
    )
    const timeframe = store.state[this.chart.paneId].timeframe.toString()
    const paneId = this.chart.paneId

    this.createContextMenu({
      value: {
        top: y - 1,
        left: x - 1,
        width: 2,
        height: 2
      },
      market,
      price,
      timeframe,
      timestamp,
      paneId,
      alert,
      getPrice: this.chart.getPrice.bind(this.chart)
    })
  }

  async createContextMenu(propsData) {
    if (components.contextMenu) {
      components.contextMenu.$off('cmd')
      for (const key in propsData) {
        components.contextMenu[key] = propsData[key]
      }
    } else {
      document.body.style.cursor = 'progress'
      const module = await import(`@/components/chart/ChartContextMenu.vue`)
      document.body.style.cursor = ''

      components.contextMenu = createComponent(module.default, propsData)

      mountComponent(components.contextMenu)
    }

    components.contextMenu.$on('cmd', args => {
      if (this.chart[args[0]] instanceof Function) {
        this.chart[args[0]](...args.slice(1))
      } else {
        throw new Error(
          `[chart/control] ContextMenu->chart->${args[0]} is not a function`
        )
      }
    })
  }

  onClick(event: MouseEvent | TouchEvent) {
    if (dialogService.hasDialogOpened) {
      return
    }

    if (
      dialogService.hasDialogOpened ||
      (event instanceof MouseEvent && event.button)
    ) {
      return
    }

    const previousEventBusy = this.activeEvent && this.activeEvent.isBusy

    if (event.shiftKey) {
      this.activeEvent = new MeasurementEventHandler(this.chart, event)
    } else if (store.state.settings.alerts) {
      if (previousEventBusy) {
        return
      }

      this.activeEvent = new AlertEventHandler(this.chart, event)
    }
  }

  /**
   * TV chart mousemove event
   */
  onCrosshairMove(event: MouseEventParams) {
    if (!event || !event.point) {
      return
    }

    let change

    if (event.point && event.point.y) {
      const chartPrice = this.chart.getPrice()
      const priceApi = this.chart.getPriceApi()

      if (chartPrice && priceApi) {
        const crosshairPrice = priceApi.coordinateToPrice(event.point.y)
        change = (1 - crosshairPrice / chartPrice) * -1
      }
    }

    const params = {
      timestamp: event.time,
      change
    }

    syncCrosshair(params, this.chart.paneId)
    this.isSyncingCrosshairs = true

    if (iframeService) {
      iframeService.send('crosshair', params)
    }

    if (this.lastCrosshairX === event.point.x) {
      return
    }

    this.lastCrosshairX = event.point.x
  }

  onPan(visibleLogicalRange) {
    if (
      !visibleLogicalRange ||
      this.chart.panPrevented ||
      this.chart.isLoading ||
      this.chart.type !== 'time'
    ) {
      return
    }

    if (this.onPanTimeout) {
      clearTimeout(this.onPanTimeout)
      this.onPanTimeout = null
    }

    this.onPanTimeout = setTimeout(() => {
      this.onPanTimeout = null

      if (this.chart.chartCache.cacheRange.from === null) {
        return
      }

      // get latest visible logical range
      visibleLogicalRange = this.chart.chartInstance
        .timeScale()
        .getVisibleLogicalRange()

      this.chart.savePosition(visibleLogicalRange)

      this.chart.fetchMore(visibleLogicalRange)
    }, 500) as unknown as number
  }

  clearChartsCrosshairs() {
    if (!this.isSyncingCrosshairs) {
      return
    }

    for (let i = 0; i < controlledCharts.length; i++) {
      controlledCharts[i].chartInstance.setCrosshair(null, null, null)
    }

    this.isSyncingCrosshairs = false
  }

  async toggleTimeframeDropdown(event) {
    const propsData = {
      value: event.currentTarget,
      paneId: this.chart.paneId
    }

    if (!components.timeframeDropdown) {
      const module = await import(`@/components/chart/TimeframeDropdown.vue`)
      components.timeframeDropdown = createComponent(module.default, propsData)

      mountComponent(components.timeframeDropdown)

      components.timeframeDropdown.$on('input', value => {
        components.timeframeDropdown.value = value
      })
    } else {
      if (components.timeframeDropdown.value === event.currentTarget) {
        components.timeframeDropdown.value = null
      } else {
        components.timeframeDropdown.paneId = propsData.paneId
        components.timeframeDropdown.value = propsData.value
      }
    }
  }
}
