import { MismatchDirection } from 'lightweight-charts'
import store from '@/store'
import { ChartPaneState } from '@/store/panesSettings/chart'
import { floorTimestampToTimeframe } from '@/utils/helpers'
import { splitColorCode } from '@/utils/colors'
import { formatAmount } from '@/services/productsService'
import type Chart from './chart'

const DAY = 60 * 60 * 24

// lightweight-charts price axis label geometry (see PriceAxisViewRenderer):
// height = fontSize + 2.5px top/bottom padding per 12px of font
// width = inner/outer padding (5px per 12px of font) + text + tick
// (the 1px border is drawn by the scale itself, the label starts after it)
const LABEL_PADDING_RATIO = 2.5 / 12
const LABEL_HORIZONTAL_PADDING_RATIO = 5 / 12
const LABEL_TICK_LENGTH = 5

interface CountdownBox {
  text: string
  top: number
  left: number
  width: number
  fontSize: number
  fontFamily: string
  background: string
  color: string
}

/**
 * Candle close countdown displayed under the price series' last value label
 * (on the price axis), moving along with it.
 *
 * - time bars: time left until the bar closes (mm:ss, hh:mm:ss or Xd HHh)
 * - tick / volume / bps bars: progress toward closing the bar (e.g. 37/100)
 */
export default class CandleCountdown {
  private element: HTMLDivElement
  private frame: number
  private rendered: string
  private colorsCache: { [color: string]: string } = {}
  private measureContext: CanvasRenderingContext2D

  constructor(private chart: Chart) {}

  attach() {
    this.detach()

    this.element = document.createElement('div')
    this.element.className = 'chart-countdown'
    this.element.style.display = 'none'
    this.chart.chartElement.appendChild(this.element)

    this.loop()
  }

  detach() {
    if (this.frame) {
      cancelAnimationFrame(this.frame)
      this.frame = null
    }

    if (this.element) {
      this.element.remove()
      this.element = null
    }

    this.rendered = null
  }

  private loop = () => {
    this.render(this.compute())
    this.frame = requestAnimationFrame(this.loop)
  }

  private render(box: CountdownBox | null) {
    const key = box ? JSON.stringify(box) : ''

    if (key === this.rendered || !this.element) {
      return
    }

    this.rendered = key

    if (!box) {
      this.element.style.display = 'none'
      return
    }

    const style = this.element.style
    style.display = 'block'
    style.top = box.top + 'px'
    style.left = box.left + 'px'
    style.width = box.width + 'px'
    style.fontSize = box.fontSize + 'px'
    style.lineHeight = box.fontSize + 'px'
    style.padding = box.fontSize * LABEL_PADDING_RATIO + 'px 0'
    style.fontFamily = box.fontFamily
    style.backgroundColor = box.background
    style.color = box.color
    this.element.textContent = box.text
  }

  private compute(): CountdownBox | null {
    const chartInstance = this.chart.chartInstance
    const paneState = store.state[this.chart.paneId] as ChartPaneState

    if (
      !chartInstance ||
      !paneState ||
      store.state.settings.showCountdown === false
    ) {
      return null
    }

    const api = this.chart.getPriceApi()

    if (!api) {
      return null
    }

    const options = api.options() as any

    if (options.visible === false || options.lastValueVisible === false) {
      return null
    }

    // charts only have the right price scale (plus the time scale)
    const side = options.priceScaleId

    if (side !== 'right') {
      return null
    }

    const bar = api.dataByIndex(
      Number.MAX_SAFE_INTEGER,
      MismatchDirection.NearestLeft
    ) as any

    if (!bar) {
      return null
    }

    const price = typeof bar.close === 'number' ? bar.close : bar.value

    if (typeof price !== 'number') {
      return null
    }

    const coordinate = api.priceToCoordinate(price)

    if (coordinate === null) {
      return null
    }

    const text = this.getText()

    if (!text) {
      return null
    }

    const layout = chartInstance.options().layout
    const fontSize = layout.fontSize
    const labelHeight = fontSize * (1 + LABEL_PADDING_RATIO * 2)
    const scaleWidth = chartInstance.priceScale(side).width()
    const paneHeight =
      this.chart.chartElement.clientHeight - chartInstance.timeScale().height()
    const top = Math.round(coordinate + labelHeight / 2)

    // hide when the price label is off screen
    if (!scaleWidth || coordinate < 0 || top + labelHeight > paneHeight) {
      return null
    }

    const background = this.getLabelColor(options, bar)
    const font = `${fontSize}px ${layout.fontFamily}`
    // same box as the price label: lightweight-charts rounds the label width
    // to device pixels (measured on screen: label = text box + 2.5px)
    const dpr = window.devicePixelRatio || 1
    const textBoxWidth = Math.max(
      this.getLabelWidth(api.priceFormatter().format(price), font, fontSize),
      this.getLabelWidth(text, font, fontSize)
    )
    const labelWidth = Math.min(
      scaleWidth + 1,
      Math.round((textBoxWidth + 2.5) * dpr) / dpr
    )

    // labels are drawn from the chart side of the price scale
    const left =
      side === 'right'
        ? this.chart.chartElement.clientWidth - scaleWidth - 1
        : scaleWidth - labelWidth - 1 // left scale border

    return {
      text,
      top,
      left,
      width: labelWidth,
      fontSize,
      fontFamily: layout.fontFamily,
      background,
      color: this.getContrastColor(background)
    }
  }

  private getLabelWidth(text: string, font: string, fontSize: number) {
    if (!this.measureContext) {
      this.measureContext = document.createElement('canvas').getContext('2d')
    }

    this.measureContext.font = font

    return Math.round(
      fontSize * LABEL_HORIZONTAL_PADDING_RATIO * 2 +
        // lightweight-charts measures digits 2-9 as 0 (widest) for stable labels
        Math.ceil(
          this.measureContext.measureText(text.replace(/[2-9]/g, '0')).width
        ) +
        LABEL_TICK_LENGTH
    )
  }

  private getText(): string {
    const { type, timeframe } = this.chart

    if (!timeframe) {
      return null
    }

    if (type === 'time') {
      return this.getTimeLeft(timeframe)
    }

    const renderer = this.chart.activeRenderer

    if (!renderer) {
      return null
    }

    if (type === 'tick') {
      return `${renderer.bar.cbuy + renderer.bar.csell}/${timeframe}`
    }

    if (type === 'vol') {
      return `${formatAmount(renderer.bar.vbuy + renderer.bar.vsell)}/${formatAmount(timeframe)}`
    }

    if (type === 'bps') {
      return `${Math.round(this.getBpsMove())}/${timeframe} bps`
    }

    return null
  }

  private getTimeLeft(timeframe: number): string {
    const now = Date.now() / 1000
    const isOdd = this.chart.isOddTimeframe
    const barStart = floorTimestampToTimeframe(now, timeframe, isOdd)
    let barEnd = barStart + timeframe

    if (isOdd) {
      // odd timeframes restart at every day open
      barEnd = Math.min(barEnd, Math.floor(now / DAY) * DAY + DAY)
    }

    const left = Math.max(0, Math.ceil(barEnd - now))
    const days = Math.floor(left / DAY)
    const hours = Math.floor((left % DAY) / 3600)
    const minutes = Math.floor((left % 3600) / 60)
    const seconds = left % 60
    const pad = (n: number) => n.toString().padStart(2, '0')

    if (days) {
      return `${days}d ${pad(hours)}h`
    }

    if (hours) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    }

    return `${pad(minutes)}:${pad(seconds)}`
  }

  /**
   * same computation as the bps grouping (see grouping.ts)
   */
  private getBpsMove(): number {
    const renderer = this.chart.activeRenderer
    let sum = 0
    let count = 0

    for (const identifier in renderer.sources) {
      const source = renderer.sources[identifier]

      if (!this.chart.marketsFilters[identifier] || source.open === null) {
        continue
      }

      sum += source.close
      count++
    }

    if (!count || !renderer.bar.close) {
      return 0
    }

    return (
      Math.abs((sum / count - renderer.bar.close) / renderer.bar.close) * 10000
    )
  }

  /**
   * same color as lightweight-charts' last value label
   */
  private getLabelColor(options: any, bar: any): string {
    if (options.priceLineColor) {
      return options.priceLineColor
    }

    if (bar.color) {
      return bar.color
    }

    if (typeof bar.open === 'number') {
      return bar.open <= bar.close ? options.upColor : options.downColor
    }

    return options.lineColor || options.color || options.topLineColor
  }

  private getContrastColor(background: string): string {
    if (!background) {
      return 'white'
    }

    if (!this.colorsCache[background]) {
      const [r, g, b] = splitColorCode(background)
      // same weights as lightweight-charts' generateContrastColors
      const grayscale = 0.199 * r + 0.687 * g + 0.114 * b
      this.colorsCache[background] = grayscale > 160 ? 'black' : 'white'
    }

    return this.colorsCache[background]
  }
}
