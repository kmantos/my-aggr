<template>
  <div class="pane-chart">
    <pane-header
      ref="paneHeader"
      :paneId="paneId"
      :settings="() => import('@/components/chart/ChartDialog.vue')"
    >
      <button
        v-for="(timeframeLabel, timeframe) of favoriteTimeframes"
        :key="timeframe"
        @click="selectTimeframe($event, timeframe)"
        title="Maintain shift key to change timeframe on all panes"
        class="btn pane-chart__timeframe -text -cases"
        :class="[
          timeframeForHuman === timeframeLabel && 'pane-header__highlight'
        ]"
      >
        <span>{{ timeframeLabel }}</span>
      </button>
      <Btn
        ref="timeframeButton"
        @click="toggleTimeframeDropdown($event, $refs.timeframeButton)"
        class="-arrow -cases pane-header__highlight pane-chart__timeframe-selector"
      >
        <span>{{ !isKnownTimeframe ? timeframeForHuman : '' }}</span>
      </Btn>
      <hr />
    </pane-header>
    <chart-layout
      v-if="layouting"
      :pane-id="paneId"
      :layouting="layouting"
      :axis="axis"
    ></chart-layout>

    <div class="chart__container" ref="chartContainer"></div>
  </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'

import paneActions from '@/utils/paneActions'
import Chart from './chart'

import { getTimeframeForHuman, sleep } from '@/utils/helpers'
import { ChartPaneState } from '@/store/panesSettings/chart'

import aggregatorService from '@/services/aggregatorService'
import { AlertEvent } from '@/services/alertService'

import PaneMixin from '@/mixins/paneMixin'
import PaneHeader from '@/components/panes/PaneHeader.vue'
import ChartLayout from '@/components/chart/Layout.vue'
import Btn from '@/components/framework/Btn.vue'

import { Trade } from '@/types/types'

@Component({
  name: 'Chart',
  components: {
    ChartLayout,
    PaneHeader,
    Btn
  }
})
export default class ChartComponent extends Mixins(PaneMixin) {
  axis = {
    top: 0,
    left: 0,
    right: 0,
    time: 0
  }

  private chart: Chart

  get layouting() {
    this.refreshAxisSize()
    return (this.$store.state[this.paneId] as ChartPaneState).layouting
  }

  get favoriteTimeframes() {
    return this.$store.state.settings.favoriteTimeframes
  }

  get timeframe() {
    return this.$store.state[this.paneId].timeframe
  }

  get isKnownTimeframe() {
    return Object.keys(this.favoriteTimeframes).indexOf(this.timeframe) !== -1
  }

  get timeframeForHuman() {
    if (!this.timeframe) {
      return 'ERR'
    }

    return getTimeframeForHuman(this.timeframe)
  }

  $refs!: {
    chartContainer: HTMLElement
    paneHeader: PaneHeader
    timeframeButton: HTMLElement
  }

  mounted() {
    this.chart = new Chart(this.paneId, this.$refs.chartContainer)

    this.bindAggregator()

    paneActions.on('restart', this.onRestartAction)
    paneActions.on('zoom', this.onZoomAction)
    paneActions.on('alerts-context', this.onAlertsContextAction)
  }

  destroyChart() {
    this.unbindAggregator()

    this.chart.destroy()
  }

  beforeDestroy() {
    paneActions.off('restart', this.onRestartAction)
    paneActions.off('zoom', this.onZoomAction)
    paneActions.off('alerts-context', this.onAlertsContextAction)

    this.destroyChart()
  }

  // actions triggered from the chart settings dialog
  // the alerts tab needs the chart's alerts market, current price and format
  onAlertsContextAction(
    paneId: string,
    callback: (context: {
      market: string
      price: number
      format: (price: number) => string
    }) => void
  ) {
    if (paneId === this.paneId) {
      const api = this.chart.getPriceApi()

      callback({
        market: this.chart.mainIndex,
        price: this.chart.getPrice(),
        format: api ? price => api.priceFormatter().format(price) : null
      })
    }
  }

  onRestartAction(paneId: string) {
    if (paneId === this.paneId) {
      this.restart()
    }
  }

  onZoomAction(
    paneId: string,
    { zoom, scrollToLatest }: { zoom: number; scrollToLatest?: boolean }
  ) {
    if (paneId === this.paneId) {
      this.chart.setZoom(zoom, scrollToLatest)
    }
  }

  onTrades(trades: Trade[]) {
    this.chart.queueTrades(trades)
  }

  onAlert(alertEvent: AlertEvent) {
    this.chart.onAlert(alertEvent)
  }

  bindAggregator() {
    aggregatorService.on('trades', this.onTrades)
    aggregatorService.on('alert', this.onAlert)
  }

  unbindAggregator() {
    aggregatorService.off('trades', this.onTrades)
    aggregatorService.off('alert', this.onAlert)
  }

  onResize() {
    if (!this.chart) {
      return
    }

    this.chart.refreshChartDimensions()
    this.chart.updateFontSize()
    this.refreshAxisSize()
  }

  async refreshAxisSize() {
    if (!this.$refs.chartContainer) {
      return
    }

    await sleep(100)

    this.axis = this.chart.getAxisSize()
  }

  async toggleTimeframeDropdown(event, button) {
    button.isLoading = true
    await this.chart.toggleTimeframeDropdown(event)
    button.isLoading = false
  }

  restart() {
    this.chart.restart()
  }

  selectTimeframe(event, timeframe) {
    if (timeframe === this.timeframe) {
      this.toggleTimeframeDropdown(event, this.$refs.timeframeButton)
      return
    }
    this.$store.dispatch(`${this.paneId}/setTimeframe`, timeframe)
  }
}
</script>

<style lang="scss" scoped>
.pane-chart {
  font-family: $font-condensed;

  &__timeframe {
    $timeframe: &;
    opacity: 0.5;
    padding-inline: 0.125em;

    &.pane-header__highlight {
      opacity: 1;

      ~ #{$timeframe}-selector {
        opacity: 0.5;

        .pane:not(:hover) & {
          padding-inline: 0.0625em;
        }

        &:after {
          margin-inline: -0.25em;
        }

        &:hover {
          opacity: 1;
        }
      }
    }

    &:hover {
      opacity: 1;
    }
  }
}

.chart__container {
  position: relative;
  width: 100%;
  flex-grow: 1;
  // own stacking context so the price watermark (z-index -1) stays inside
  isolation: isolate;

  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
</style>

<style lang="scss">
// price watermark (see chart.ts updatePriceWatermark), behind the chart,
// centered on the whole chart width including the price scale
.chart-price-watermark {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: -1;
  display: none;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  white-space: nowrap;
  pointer-events: none;
  font-weight: 600;
  line-height: 1;
}

// last price box: price + candle countdown (see priceLabel.ts), created
// outside of vue so not scoped
.chart-price-label {
  position: absolute;
  // same weight as the price label above it (drawn on the chart canvas)
  font-weight: normal;
  z-index: 3;
  box-sizing: border-box;
  text-align: center;
  // price, line break, countdown
  white-space: pre;
  overflow: hidden;
  pointer-events: none;
  font-variant-numeric: tabular-nums;
}
</style>
