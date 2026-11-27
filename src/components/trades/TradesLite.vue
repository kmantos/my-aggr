<template>
  <div class="pane-trades" @mouseenter="bindScroll">
    <pane-header
      :paneId="paneId"
      ref="paneHeader"
      :settings="() => import('@/components/trades/TradesDialog.vue')"
    >
      <hr />
    </pane-header>
    <div v-if="paused" class="pane-trades__paused">Paused</div>
    <canvas ref="canvas" @dblclick="prepareEverything" />
  </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import PaneMixin from '../../mixins/paneMixin'
import aggregatorService from '../../services/aggregatorService'
import { formatAmount, formatMarketPrice } from '../../services/productsService'
import { Threshold, TradesPaneState } from '../../store/panesSettings/trades'
import {
  getColorByWeight,
  getLinearShadeText,
  getLinearShade,
  joinRgba,
  rgbaToRgb,
  splitColorCode,
  getAppBackgroundColor
} from '../../utils/colors'

import PaneHeader from '@/components/panes/PaneHeader.vue'
import dialogService from '../../services/dialogService'
import audioService, { AudioFunction } from '../../services/audioService'
import logos from '@/assets/exchanges'
import { Trade } from '../../types/types'
import { getDefaultFontFamily } from '../../utils/helpers'

const DEBUG = false
const GRADIENT_DETAIL = 5
const LOGOS = {}

enum TradeType {
  trade,
  liquidation
}

@Component({
  name: 'TradesLite',
  components: {
    PaneHeader
  }
})
export default class TradesLite extends Mixins(PaneMixin) {
  private ctx: CanvasRenderingContext2D
  private width: number
  private maxWidth: number
  private pairOffset: number
  private priceOffset: number
  private amountOffset: number
  private height: number
  private lineHeight: number
  private fontSize: number
  private paddingTop: number
  private paddingLeft: number
  private margin: number
  private logoWidth: number
  private timeWidth: number
  private pxRatio: number
  private maxLines: number
  private maxHistory: number
  private buyColorBase: string
  private buyColor100: string
  private sellColorBase: string
  private sellColor100: string
  private themeBase: string
  private renderTrades: boolean
  private showPairs: boolean
  private showPrices: boolean
  private drawOffset: number

  // prepared thresholds by type (trade or liquidation)
  private minAmount: number
  private minAudio: number
  private colors: {
    [type: string]: {
      lastRangeIndex: number
      minAmount: number
      maxAmount: number
      significantAmount: number
      ranges: {
        from: number
        to: number
        buy: {
          background: string
          color: string
          step: number
        }[]
        sell: {
          background: string
          color: string
          step: number
        }[]
        max?: boolean
      }[]
    }
  }
  private sounds: {
    [type: string]: { buy: AudioFunction; sell: AudioFunction }[]
  }

  private baseSizingCurrency: boolean
  private filters: {
    [key in TradeType]: boolean
  }
  private rendering: boolean
  private tradesRendering: {
    type: TradeType
    background: number[]
    color: number[]
    step: number
    exchange: string
    amount: number
    count: number
    price: number
    side: string
    time: string
  }[]

  private tradesHistory: any[]
  private paneMarkets: { [market: string]: boolean }
  private volumeBySide: { buy: number; sell: number }
  private insignificantVolumeBySide: { buy: number; sell: number }
  private addedVolumeBySide: { buy: number; sell: number }
  private offset: number
  private maxCount: number
  private limit: number
  private batchSize = 1

  paused = 0

  $refs!: {
    canvas: HTMLCanvasElement
  }

  private scrollHandler: (event) => void
  private blurHandler: (event) => void

  created() {
    this._onStoreMutation = this.$store.subscribe(mutation => {
      switch (mutation.type) {
        case 'panes/SET_PANE_ZOOM':
          if (mutation.payload.id === this.paneId) {
            this.onResize()
          }
          break
        case 'panes/SET_PANE_MARKETS':
          if (mutation.payload.id === this.paneId) {
            this.clear()
            this.prepareMarkets()
            this.renderHistory()
          }
          break
        case this.paneId + '/SET_MAX_ROWS':
        case this.paneId + '/TOGGLE_PREFERENCE':
          this.prepareTypeFilter(true)
          this.prepareDisplaySettings()
          this.refreshColumnsWidth()
          this.renderHistory()
          break
        case this.paneId + '/SET_THRESHOLD_AUDIO':
        case this.paneId + '/TOGGLE_MUTED':
        case 'settings/SET_AUDIO_VOLUME':
        case 'settings/TOGGLE_AUDIO':
          this.prepareAudio()
          break
        case this.paneId + '/SET_AUDIO_THRESHOLD':
          this.prepareAudio(false)
          break
        case 'settings/SET_BACKGROUND_COLOR':
        case this.paneId + '/SET_THRESHOLD_COLOR':
        case this.paneId + '/SET_THRESHOLD_AMOUNT':
        case this.paneId + '/TOGGLE_THRESHOLD_MAX':
        case this.paneId + '/DELETE_THRESHOLD':
        case this.paneId + '/ADD_THRESHOLD':
          this.prepareColors()
          this.renderHistory()

          if (
            mutation.type === this.paneId + '/DELETE_THRESHOLD' ||
            mutation.type === this.paneId + '/ADD_THRESHOLD'
          ) {
            this.prepareAudio()
          }
          break
      }
    })
  }

  mounted() {
    this.ctx = this.$refs.canvas.getContext('2d', { alpha: false })

    this.$nextTick(this.prepareEverything)

    aggregatorService.on('trades', this.onTrades)
  }

  async prepareEverything() {
    this.reset()

    this.prepareTypeFilter()
    this.prepareMarkets()
    this.prepareColors()
    await this.prepareAudio()

    this.renderHistory()
  }

  beforeDestroy() {
    aggregatorService.off('trades', this.onTrades)

    this._onStoreMutation()

    if (this.blurHandler) {
      this.onBlur()
    }
  }

  onTrades(trades: Trade[]) {
    let date = null
    let side = null

    for (let i = 0; i < trades.length; i++) {
      const marketKey = trades[i].exchange + ':' + trades[i].pair
      const type = trades[i].liquidation
        ? TradeType.liquidation
        : TradeType.trade

      if (!this.filters[type] || !this.paneMarkets[marketKey]) {
        continue
      }

      if (
        trades[i].amount < this.colors[type].minAmount ||
        trades[i].amount > this.colors[type].maxAmount
      ) {
        if (trades[i].amount > this.minAudio) {
          this.sounds[type][0][trades[i].side](
            audioService,
            trades[i].amount / this.colors[type].significantAmount
          )
        }

        this.insignificantVolumeBySide[trades[i].side] += trades[i].amount
        continue
      }

      this.volumeBySide[trades[i].side] += trades[i].amount

      if (side === null) {
        side = trades[i].side
      }

      const { background, color, step } = this.getColors(
        trades[i].amount,
        trades[i].side,
        type
      )

      this.maxCount = Math.max(this.maxCount, trades[i].count)

      const trade = {
        type,
        background,
        color,
        step,
        exchange: trades[i].exchange,
        pair: trades[i].pair,
        amount: trades[i].amount,
        count: trades[i].count,
        price: trades[i].avgPrice,
        side: trades[i].side,
        time: null
      }

      if (!date) {
        date = new Date(+trades[i].timestamp)

        trade.time = [date.getHours(), date.getMinutes(), date.getSeconds()]
          .map(value => value.toString().padStart(2, '0'))
          .join(':')
      }

      if (trade.amount > this.minAudio) {
        this.sounds[type][Math.floor(trade.step / GRADIENT_DETAIL)][trade.side](
          audioService,
          trade.amount / this.colors[type].significantAmount
        )
      }

      this.tradesRendering.push(trade)
    }

    if (date && !this.rendering) {
      this.volumeBySide[side] += this.insignificantVolumeBySide[side]
      this.addedVolumeBySide[side] += this.insignificantVolumeBySide[side]
      this.insignificantVolumeBySide[side] = 0
      this.renderTradesBatch()
    }
  }

  getThresholdsByType(type: TradeType | string): Threshold[] {
    const paneSettings = this.$store.state[this.paneId] as TradesPaneState

    if (type === TradeType.liquidation) {
      return paneSettings.liquidations
    }

    return paneSettings.thresholds
  }

  async openSettings() {
    dialogService.open(
      (await import('@/components/trades/TradesDialog.vue')).default,
      {
        paneId: this.paneId
      }
    )
  }

  async prepareTypeFilter(checkRequirements?: boolean) {
    this.filters = {
      [TradeType.trade]: this.$store.state[this.paneId].showTrades,
      [TradeType.liquidation]: this.$store.state[this.paneId].showLiquidations
    }

    this.baseSizingCurrency =
      !this.$store.state.settings.preferQuoteCurrencySize

    if (checkRequirements) {
      // check for unused or missing colors / audio

      for (const type in this.filters) {
        if (!this.filters[type] && typeof this.colors[type] !== 'undefined') {
          // clear unused colors
          delete this.colors[type]
        } else if (
          this.filters[type] &&
          typeof this.colors[type] === 'undefined'
        ) {
          // generate required colors
          this.prepareThresholds(
            type as unknown as TradeType,
            this.getThresholdsByType(type)
          )
        }

        if (!this.filters[type] && typeof this.sounds[type] !== 'undefined') {
          // clear unused sounds
          delete this.sounds[type]
        } else if (
          this.filters[type] &&
          typeof this.sounds[type] === 'undefined' &&
          this.minAudio > 0
        ) {
          // generate required sounds
          await this.prepareSounds(type, this.getThresholdsByType(+type))
        }
      }
    }

    for (let i = 0; i < this.tradesHistory.length; i++) {
      if (!this.filters[(this.tradesHistory as any).type]) {
        this.tradesHistory.splice(i, 1)
        i--
      }
    }
  }

  prepareMarkets() {
    this.paneMarkets = this.$store.state.panes.panes[
      this.paneId
    ].markets.reduce((output, marketKey) => {
      output[marketKey] = true
      return output
    }, {})
  }

  async prepareAudio(prepareSounds = true) {
    const audioThreshold = this.$store.state[this.paneId].audioThreshold

    if (
      !this.$store.state.settings.useAudio ||
      this.$store.state[this.paneId].muted
    ) {
      this.minAudio = Infinity
      this.sounds = {}
      return
    }

    if (audioThreshold) {
      if (
        typeof audioThreshold === 'string' &&
        /\d\s*%$/.test(audioThreshold)
      ) {
        this.minAudio = this.minAmount * (parseFloat(audioThreshold) / 100)
      } else {
        this.minAudio = +audioThreshold
      }
    } else {
      this.minAudio = this.minAmount * 0.1
    }

    if (prepareSounds) {
      for (const type in this.filters) {
        if (this.filters[type]) {
          await this.prepareSounds(type, this.getThresholdsByType(+type))
        }
      }
    }
  }

  async prepareSounds(type: string, thresholds: Threshold[]) {
    const sounds = []

    for (let i = 0; i < thresholds.length; i++) {
      sounds.push({
        buy: await audioService.buildAudioFunction(
          thresholds[i].buyAudio,
          'buy'
        ),
        sell: await audioService.buildAudioFunction(
          thresholds[i].sellAudio,
          'sell'
        )
      })
    }

    this.sounds[type] = sounds
  }

  prepareColors() {
    const style = getComputedStyle(document.documentElement)
    this.themeBase = style.getPropertyValue('--theme-base')

    let baseColorThreshold

    if (this.filters[TradeType.trade]) {
      baseColorThreshold =
        this.$store.state[this.paneId].thresholds[
          this.$store.state[this.paneId].thresholds.length - 2
        ]
    } else {
      baseColorThreshold =
        this.$store.state[this.paneId].liquidations[
          this.$store.state[this.paneId].thresholds.length - 2
        ]
    }

    this.buyColorBase = baseColorThreshold.buyColor
    this.buyColor100 = joinRgba(
      getLinearShade(splitColorCode(this.buyColorBase), 0.25)
    )
    this.sellColorBase = baseColorThreshold.sellColor
    this.sellColor100 = joinRgba(
      getLinearShade(splitColorCode(this.sellColorBase), 0.25)
    )

    // cache color counters
    for (const type in this.filters) {
      if (this.filters[type]) {
        this.prepareThresholds(
          type as unknown as TradeType,
          this.getThresholdsByType(+type)
        )
      }
    }

    // recalculate trades respective colors
    for (let i = 0; i < this.tradesHistory.length; i++) {
      if (this.tradesHistory[i].amount < this.minAmount) {
        this.tradesHistory.splice(i, 1)
        i--
        continue
      }

      const color = this.getColors(
        this.tradesHistory[i].amount,
        this.tradesHistory[i].side,
        this.tradesHistory[i].type
      )

      Object.assign(this.tradesHistory[i], color)
    }
  }

  prepareThresholds(type: TradeType, thresholds: Threshold[]) {
    // app background color for computed threshold color
    const themeBackgroundColor = splitColorCode(this.themeBase)
    const appBackgroundColor = getAppBackgroundColor()

    const ranges = []
    let significantAmount
    const total = thresholds.length * GRADIENT_DETAIL

    // loop through thresholds
    // thresholds [0, 1, 2, 3]
    // ranges [0-1, 1-2, 2-3]
    for (let i = 0; i < thresholds.length - 1; i++) {
      const from = thresholds[i].amount
      const to = thresholds[i + 1].amount

      if (i === 0) {
        significantAmount = to
      }

      const buyColorFrom = splitColorCode(thresholds[i].buyColor)
      const buyColorTo = splitColorCode(thresholds[i + 1].buyColor)
      const buyAlpha =
        typeof buyColorFrom[3] === 'undefined' ? 1 : buyColorFrom[3]

      const buyColorRange = [
        rgbaToRgb(buyColorFrom, appBackgroundColor),
        rgbaToRgb(buyColorTo, appBackgroundColor)
      ]

      const buyColorRangeTheme = [
        rgbaToRgb(buyColorFrom, themeBackgroundColor),
        rgbaToRgb(buyColorTo, themeBackgroundColor)
      ]

      const sellColorFrom = splitColorCode(thresholds[i].sellColor)
      const sellColorTo = splitColorCode(thresholds[i + 1].sellColor)
      const sellAlpha =
        typeof sellColorFrom[3] === 'undefined' ? 1 : sellColorFrom[3]

      const sellColorRange = [
        rgbaToRgb(sellColorFrom, appBackgroundColor),
        rgbaToRgb(sellColorTo, appBackgroundColor)
      ]

      const sellColorRangeTheme = [
        rgbaToRgb(sellColorFrom, themeBackgroundColor),
        rgbaToRgb(sellColorTo, themeBackgroundColor)
      ]

      const buy = []
      const sell = []

      // for every range, slice the range into n colors
      for (let j = 0; j < GRADIENT_DETAIL; j++) {
        const position = j / (GRADIENT_DETAIL - 1) // 0 to 1

        // get a color between buyColorRange[0] and buyColorRange[1]
        // get a optimal text color
        const buyBackground = getColorByWeight(
          buyColorRange[0],
          buyColorRange[1],
          position
        )
        const buyTextColor = getColorByWeight(
          buyColorRangeTheme[0],
          buyColorRangeTheme[1],
          position
        )
        const buyText = getLinearShadeText(
          buyTextColor,
          0.5 + Math.min(1, (i * GRADIENT_DETAIL + j) / total),
          Math.exp(1 - buyAlpha) / 5
        )

        buy.push({
          background: joinRgba(buyBackground),
          color: joinRgba(buyText),
          step: i * GRADIENT_DETAIL + j
        })

        // same for the sells
        const sellBackground = getColorByWeight(
          sellColorRange[0],
          sellColorRange[1],
          position
        )
        const sellTextColor = getColorByWeight(
          sellColorRangeTheme[0],
          sellColorRangeTheme[1],
          position
        )
        const sellText = getLinearShadeText(
          sellTextColor,
          0.5 + Math.min(1, (i * GRADIENT_DETAIL + j) / total),
          Math.exp(1 - sellAlpha) / 5
        )

        sell.push({
          background: joinRgba(sellBackground),
          color: joinRgba(sellText),
          step: i * GRADIENT_DETAIL + j
        })
      }

      ranges.push({
        from,
        to,
        buy,
        sell
      })

      if (thresholds[i + 1].max) {
        // next threshold as the max checkbox ticked -> last range pushed will be the last
        ranges[ranges.length - 1].max = true
        break
      }
    }

    // cache min / max
    const lastRangeIndex = ranges.length - 1
    const minAmount = ranges[0].from

    let maxAmount

    if (!ranges[ranges.length - 1].max) {
      maxAmount = Infinity
    } else {
      maxAmount = ranges[ranges.length - 1].to
    }

    this.colors[type] = {
      lastRangeIndex,
      minAmount,
      maxAmount,
      significantAmount,
      ranges
    }

    if (type == TradeType.trade || !this.filters[TradeType.trade]) {
      this.minAmount = minAmount
    }
  }

  prepareDisplaySettings() {
    const pane = this.$store.state[this.paneId] as TradesPaneState
    this.maxHistory = pane.maxRows
    this.showPairs = pane.showPairs
    this.renderTrades = true
    this.showPrices = pane.showPrices
    this.offset = 0
    this.drawOffset = 0

    this.refreshColumnsWidth()
  }

  onResize(width, height, isMounting) {
    this.resize()

    if (!isMounting) {
      this.renderHistory()
    }
  }

  resize() {
    const canvas = this.$refs.canvas

    let headerHeight = 0

    if (!this.$store.state.settings.autoHideHeaders) {
      headerHeight =
        (this.$store.state.panes.panes[this.paneId].zoom || 1) * 2 * 16
    }

    this.pxRatio = window.devicePixelRatio || 1
    const zoom = this.$store.state.panes.panes[this.paneId].zoom || 1

    this.width = canvas.width = this.$el.clientWidth * this.pxRatio
    this.height = canvas.height =
      (this.$el.clientHeight - headerHeight) * this.pxRatio
    this.fontSize = Math.round(14 * zoom * this.pxRatio)
    // logos a bit bigger than the text
    this.logoWidth = Math.round(this.fontSize * 1.3)
    this.preloadLogos()
    // vertical padding of a row: a bit more on wide panes, capped
    this.paddingTop = Math.round(
      Math.min(
        Math.max(this.width * 0.006, 3 * this.pxRatio),
        6 * this.pxRatio * zoom
      )
    )
    this.lineHeight = Math.round(this.fontSize + this.paddingTop)
    this.drawOffset = 0
    this.maxLines = Math.ceil(this.height / this.lineHeight)
    this.renderTrades = true
    this.offset = this.offset || 0
    this.limit = this.offset + this.maxLines

    this.ctx.font = `${zoom > 1.25 ? '600 ' : ''}${
      this.fontSize
    }px ${getDefaultFontFamily()}`
    this.ctx.textBaseline = 'middle'

    this.refreshColumnsWidth()
  }

  refreshColumnsWidth() {
    if (typeof this.showPairs === 'undefined') {
      return
    }

    const zoom = this.$store.state.panes.panes[this.paneId].zoom || 1

    // side margin and gap after the logo: grow with the pane, capped
    this.margin = Math.round(
      Math.min(
        Math.max(this.width * 0.02, 6 * this.pxRatio),
        12 * this.pxRatio * zoom
      )
    )
    this.paddingLeft = Math.round(
      Math.min(
        Math.max(this.width * 0.02, 4 * this.pxRatio),
        10 * this.pxRatio * zoom
      )
    )

    // 3 columns: logo + price (left) | amount (right aligned) | time (smaller)
    const contentWidth = this.width - this.margin * 2
    const firstColumnWidth = contentWidth * 0.45
    const amountColumnWidth = contentWidth * 0.35
    this.timeWidth = contentWidth * 0.2 - this.paddingLeft

    this.priceOffset = this.margin + this.logoWidth + this.paddingLeft
    // amounts left aligned at the start of the 2nd column
    this.amountOffset = this.margin + firstColumnWidth

    // text width available in the first column (price, then pair if shown)
    const firstColumnText =
      firstColumnWidth - this.logoWidth - this.paddingLeft * 2
    const firstColumnItems =
      (this.showPrices ? 1 : 0) + (this.showPairs ? 1 : 0) || 1
    this.maxWidth = Math.min(
      firstColumnText / firstColumnItems,
      amountColumnWidth - this.paddingLeft
    )
    this.pairOffset =
      this.priceOffset +
      (this.showPrices ? this.maxWidth + this.paddingLeft : 0)
  }

  getColors(amount, side, type) {
    const colors = this.colors[type]

    for (let i = 0; i < colors.ranges.length; i++) {
      if (i === colors.lastRangeIndex || amount < colors.ranges[i].to) {
        let innerStep = GRADIENT_DETAIL - 1

        if (amount < colors.ranges[i].to) {
          innerStep = Math.floor(
            ((amount - colors.ranges[i].from) /
              (colors.ranges[i].to - colors.ranges[i].from)) *
              GRADIENT_DETAIL
          )
        }

        return colors.ranges[i][side][innerStep]
      }
    }
  }

  clear() {
    this.ctx.resetTransform()
    const style = getComputedStyle(document.documentElement)
    const themeBase = splitColorCode(style.getPropertyValue('--theme-base'))
    const backgroundColor = splitColorCode(
      style.getPropertyValue('--theme-background-base'),
      themeBase
    )
    themeBase[3] = 0.1
    this.ctx.fillStyle = joinRgba(
      splitColorCode(joinRgba(themeBase), backgroundColor)
    )
    this.ctx.fillRect(0, 0, this.width, this.height)
  }

  reset() {
    if (this.ctx) {
      this.clear()
    }

    this.tradesRendering = []
    this.tradesHistory = []
    this.volumeBySide = { buy: 0, sell: 0 }
    this.insignificantVolumeBySide = { buy: 0, sell: 0 }
    this.addedVolumeBySide = { buy: 0, sell: 0 }
    this.colors = {}
    this.sounds = {}
    this.offset = 0
    this.limit = 0
    this.maxCount = 100

    this.prepareDisplaySettings()
  }

  renderTradesBatch() {
    if (this.paused) {
      this.paused = this.tradesRendering.length
      this.rendering = false
      return
    }

    let count = Math.ceil(this.tradesRendering.length * 0.1)
    let i = 0
    while (count-- && ++i <= this.batchSize) {
      const trade = this.tradesRendering.shift()

      if (this.renderTrades) {
        this.renderTrade(trade)

        if (this.offset >= 1) {
          this.offset++
        }
      }

      this.tradesHistory.unshift(trade)

      if (this.tradesHistory.length > this.maxHistory) {
        const trade = this.tradesHistory.pop()

        if (this.addedVolumeBySide[trade.side]) {
          trade.amount += this.addedVolumeBySide[trade.side]
          this.addedVolumeBySide[trade.side] = 0
        }

        this.volumeBySide[trade.side] -= trade.amount
      }
    }

    const rate = Math.ceil(this.tradesRendering.length / 10)
    this.batchSize = rate

    this.rendering = this.tradesRendering.length > 0

    if (this.rendering) {
      return requestAnimationFrame(this.renderTradesBatch)
    }
  }

  renderTrade(trade) {
    const market = trade.exchange + ':' + trade.pair

    const paddingTop =
      this.paddingTop + Math.round((trade.step / 2) * this.pxRatio)
    // + 3px for a bit taller rows
    const height = this.lineHeight + paddingTop * 2 + 3 * this.pxRatio

    this.ctx.drawImage(this.ctx.canvas, 0, height)
    this.ctx.fillStyle = trade.background
    this.ctx.fillRect(0, this.drawOffset, this.width, height)

    this.drawHistogram(trade, height)
    this.ctx.fillStyle = trade.color

    this.drawLogo(
      trade.exchange,
      this.margin,
      this.drawOffset + height / 2 - this.logoWidth / 2
    )

    if (this.showPairs) {
      this.drawPair(trade, height)
    }

    if (this.showPrices) {
      this.drawPrice(trade, market, height)
    }

    this.drawAmount(trade, height)

    if (trade.time) {
      this.drawTime(trade, height)
    }
  }

  // time (hh:mm:ss) in a smaller 10px font
  drawTime(trade, height) {
    const zoom = this.$store.state.panes.panes[this.paneId].zoom || 1
    const backupFont = this.ctx.font
    this.ctx.font = this.ctx.font.replace(
      new RegExp(`${this.fontSize}px`),
      `${Math.round(10 * zoom * this.pxRatio)}px`
    )
    this.ctx.textAlign = 'right'
    this.ctx.fillText(
      trade.time,
      this.width - this.margin,
      this.drawOffset + height / 2 + 1,
      this.timeWidth
    )
    this.ctx.font = backupFont
  }

  drawHistogram(trade, height) {
    this.ctx.fillStyle = 'rgba(255,255,255,0.05)'
    this.ctx.fillRect(
      0,
      0,
      Math.min(1, trade.count / 100) * this.width,
      this.drawOffset + height
    )
  }

  drawPair(trade, height) {
    this.ctx.textAlign = 'left'
    this.ctx.fillText(
      trade.pair,
      this.pairOffset,
      this.drawOffset + height / 2 + 1,
      this.maxWidth
    )
  }

  drawPrice(trade, market, height) {
    this.ctx.textAlign = 'left'
    this.ctx.fillText(
      formatMarketPrice(trade.price, market),
      this.priceOffset,
      this.drawOffset + height / 2 + 1,
      this.maxWidth
    )
  }

  drawAmount(trade: Trade, height) {
    this.ctx.textAlign = 'left'
    const amount = this.baseSizingCurrency
      ? Math.round(trade.amount * 1e6) / 1e6
      : formatAmount(trade.amount)

    this.ctx.fillText(
      amount,
      this.amountOffset,
      this.drawOffset + height / 2 + 1,
      this.maxWidth
    )
  }

  renderHistory() {
    this.clear()

    if (!this.renderTrades) {
      return
    }

    if (DEBUG) {
      this.renderDebug()
    }

    const offset = Math.round(this.offset)
    const limit = Math.round(this.limit)

    if (limit - offset <= 0) {
      this.ctx.fillText('waiting for trades', 8, 8)
      return
    }

    for (let i = limit - 1; i >= offset; i--) {
      if (!this.tradesHistory[i]) {
        continue
      }

      this.renderTrade(this.tradesHistory[i])
    }
  }

  renderDebug() {
    const quarterWidth = this.width / 4
    this.ctx.fillStyle = this.buyColorBase
    this.ctx.fillRect(0, 0, quarterWidth, this.lineHeight)
    this.ctx.fillStyle = this.buyColor100
    this.ctx.fillRect(quarterWidth, 0, quarterWidth, this.lineHeight)
    this.ctx.fillStyle = this.sellColor100
    this.ctx.fillRect(quarterWidth * 2, 0, quarterWidth, this.lineHeight)
    this.ctx.fillStyle = this.sellColorBase
    this.ctx.fillRect(quarterWidth * 3, 0, quarterWidth, this.lineHeight)

    for (const type in this.filters) {
      if (this.filters[type]) {
        for (const range of this.colors[type].ranges) {
          for (let i = 0; i < range.buy.length; i++) {
            this.ctx.translate(0, this.lineHeight)
            const buy = range.buy[i]
            this.ctx.fillStyle = buy.background
            this.ctx.fillRect(0, 0, this.width / 2, this.lineHeight)
            this.ctx.fillStyle = buy.color
            this.ctx.textAlign = 'left'
            this.ctx.fillText('B:' + buy.color, 0, this.lineHeight / 2)

            const sell = range.sell[i]
            this.ctx.fillStyle = sell.background
            this.ctx.fillRect(
              this.width / 2,
              0,
              this.width / 2,
              this.lineHeight
            )
            this.ctx.fillStyle = sell.color
            this.ctx.textAlign = 'left'
            this.ctx.fillText(
              'S: ' + sell.color,
              this.width / 2,
              this.lineHeight / 2
            )
          }
        }
      }
    }

    this.ctx.resetTransform()
  }

  onBlur() {
    this.$el.removeEventListener('mouseleave', this.blurHandler)
    this.$el.removeEventListener('wheel', this.scrollHandler)
    delete this.scrollHandler
    delete this.blurHandler
    this.paused = 0
    this.offset = 0
    this.limit = this.maxLines
    this.renderHistory()
    this.renderTradesBatch()
  }

  onScroll(event) {
    event.preventDefault()

    const direction = Math.sign(event.deltaY) * (event.shiftKey ? 2 : 1)

    const offset = Math.max(
      0,
      Math.min(this.tradesHistory.length, this.offset + direction)
    )
    const limit = Math.min(
      this.tradesHistory.length,
      Math.max(offset + this.maxLines, this.limit + direction)
    )

    const redraw = Math.round(offset) !== Math.round(this.offset)

    this.paused = offset
    this.offset = offset
    this.limit = limit

    if (redraw) {
      this.renderHistory()
    }
  }

  bindScroll() {
    if (this.scrollHandler) {
      this.onBlur()
      return
    }

    // setting (default: on for PC, off for phones / car screens)
    if (!this.$store.state.settings.pauseTradesOnHover) {
      return
    }

    this.paused = 1

    this.blurHandler = this.onBlur.bind(this)
    this.scrollHandler = this.onScroll.bind(this)
    this.$el.addEventListener('wheel', this.scrollHandler)
    this.$el.addEventListener('mouseleave', this.blurHandler)
  }

  // logo rendered once into a small canvas (loads asynchronously)
  getLogo(exchange) {
    if (!LOGOS[exchange] && logos[exchange]) {
      const canvas = document.createElement('canvas')
      canvas.width = this.logoWidth
      canvas.height = this.logoWidth

      const image = new Image()
      image.onload = () => {
        const ctx = canvas.getContext('2d')
        ctx.drawImage(image, 0, 0, this.logoWidth, this.logoWidth)
      }
      image.src = logos[exchange]

      LOGOS[exchange] = canvas
    }

    return LOGOS[exchange]
  }

  // load every exchange logo upfront: the first trade of an exchange
  // already gets its logo
  preloadLogos() {
    for (const exchange in logos) {
      this.getLogo(exchange)
    }
  }

  drawLogo(exchange, x, y) {
    const logo = this.getLogo(exchange)

    if (logo) {
      this.ctx.drawImage(logo, x, y, this.logoWidth, this.logoWidth)
    }
  }
}
</script>
<style lang="scss" scoped>
canvas {
  width: 100%;
  height: 100%;
  background-color: var(--theme-background-base);
}

.pane-trades {
  position: relative;
}

.pane-trades__paused {
  position: absolute;
  bottom: 0.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  pointer-events: none;
}
</style>
