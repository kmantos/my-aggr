import dialogService from '@/services/dialogService'
import store from '@/store'
import { createComponent, mountComponent } from '@/utils/helpers'
import { isTouchSupported } from '@/utils/touchevent'
import { MouseEventParams } from 'lightweight-charts'
import Chart from './chart'
import AlertEventHandler from './controls/alertEventHandler'
import MeasurementEventHandler from './controls/measurementEventHandler'
import {
  DEFAULT_BAR_SPACING,
  MAX_ZOOM,
  getChartCustomColorsOptions
} from './options'
import { components, controlledCharts, syncCrosshair } from './common'
import iframeService from '@/services/iframeService'

export default class ChartControl {
  chart: Chart

  private onPanTimeout: number
  private lastCrosshairX: number
  private activeEvent: any
  private isSyncingCrosshairs: boolean

  private clickHandler: (event: MouseEvent | TouchEvent) => void
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
        case 'settings/TOGGLE_ALERTS_LABEL':
        case 'settings/SET_ALERTS_COLOR':
        case 'settings/SET_ALERTS_LINESTYLE':
        case 'settings/SET_ALERTS_LINEWIDTH':
          this.chart.refreshMarkets()
          this.chart.refreshAllIndicatorAdapters()
          this.chart.renderAll()
          break
        case 'settings/TOGGLE_CHART_FLIP':
          this.chart.applyFlip()
          break
        case 'settings/SET_CHART_REFRESH_RATE':
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
    if (!visibleLogicalRange) {
      return
    }

    // max zoom (lightweight-charts only has a min bar spacing option)
    const maxBarSpacing = MAX_ZOOM * DEFAULT_BAR_SPACING

    if (this.chart.getBarSpacing(visibleLogicalRange) > maxBarSpacing + 0.01) {
      this.chart.chartInstance
        .timeScale()
        .applyOptions({ barSpacing: maxBarSpacing })
      return
    }

    if (this.chart.panPrevented || this.chart.isLoading) {
      return
    }

    if (this.onPanTimeout) {
      clearTimeout(this.onPanTimeout)
      this.onPanTimeout = null
    }

    this.onPanTimeout = setTimeout(() => {
      this.onPanTimeout = null

      if (!this.chart.chartInstance) {
        return
      }

      // remember zoom (shown in the chart settings)
      this.chart.savePosition()

      if (
        this.chart.type !== 'time' ||
        this.chart.chartCache.cacheRange.from === null
      ) {
        return
      }

      // get latest visible logical range
      visibleLogicalRange = this.chart.chartInstance
        .timeScale()
        .getVisibleLogicalRange()

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
