<template>
  <div class="pane-trades">
    <pane-header
      :paneId="paneId"
      ref="paneHeader"
      :settings="() => import('@/components/trades/TradesDialog.vue')"
    >
      <hr />
    </pane-header>
    <ul
      ref="tradesContainer"
      class="trades-list"
      :class="['hide-scrollbar', this.showLogos && '-logos', '-logos-colors']"
    ></ul>
    <trades-placeholder
      v-if="showPlaceholder"
      :paneId="paneId"
    ></trades-placeholder>
  </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'

import { Trade } from '@/types/types'

import aggregatorService from '@/services/aggregatorService'
import gifsService from '@/services/gifsService'
import PaneMixin from '@/mixins/paneMixin'
import PaneHeader from '@/components/panes/PaneHeader.vue'
import TradesPlaceholder from '@/components/trades/TradesPlaceholder.vue'
import { parseMarket } from '@/services/productsService'
import TradesFeed from '@/components/trades/tradesFeed'

@Component({
  components: { PaneHeader, TradesPlaceholder },
  name: 'Trades'
})
export default class Trades extends Mixins(PaneMixin) {
  showPlaceholder = true

  private feed: TradesFeed

  get showLogos() {
    return this.$store.state[this.paneId].showLogos
  }

  $refs!: {
    tradesContainer: HTMLElement
  }

  created() {
    aggregatorService.on('trades', this.onTrades)

    this._onStoreMutation = this.$store.subscribe(mutation => {
      switch (mutation.type) {
        case 'settings/TOGGLE_SLIPPAGE':
        case this.paneId + '/TOGGLE_PREFERENCE':
          this.feed.cachePreferences()
          this.refreshList()
          break
        case this.paneId + '/SET_MAX_ROWS':
          // the store validates the value (invalid input is ignored)
          this.feed.setMaxCount(this.$store.state[this.paneId].maxRows)
          break
        case 'panes/SET_PANE_MARKETS':
          if (
            mutation.type !== 'panes/SET_PANE_MARKETS' ||
            mutation.payload.id === this.paneId
          ) {
            this.feed.cachePaneMarkets()
            this.refreshList()
          }
          break
        case this.paneId + '/SET_THRESHOLD_GIF':
          gifsService.getGifs(mutation.payload.value, true)
          this.feed.prepareColors()
          this.refreshList()
          break
        case this.paneId + '/SET_THRESHOLD_AUDIO':
        case 'settings/SET_AUDIO_VOLUME':
        case 'settings/TOGGLE_AUDIO':
          this.feed.cacheAudio()
          break
        case this.paneId + '/SET_AUDIO_THRESHOLD':
        case this.paneId + '/TOGGLE_MUTED':
          this.feed.cacheAudio(false)
          break
        case 'settings/SET_BACKGROUND_COLOR':
        case this.paneId + '/SET_THRESHOLD_COLOR':
        case this.paneId + '/SET_THRESHOLD_AMOUNT':
        case this.paneId + '/TOGGLE_THRESHOLD_MAX':
        case this.paneId + '/DELETE_THRESHOLD':
        case this.paneId + '/ADD_THRESHOLD':
          this.feed.prepareColors()
          this.refreshList()

          if (
            mutation.type === this.paneId + '/DELETE_THRESHOLD' ||
            this.paneId + '/ADD_THRESHOLD'
          ) {
            this.feed.cacheAudio()
          }
          break
      }
    })
  }

  mounted() {
    this.feed = new TradesFeed(
      this.paneId,
      this.$refs.tradesContainer,
      this.$store.state[this.paneId].maxRows
    )
  }

  beforeDestroy() {
    aggregatorService.off('trades', this.onTrades)

    if (this.feed) {
      this.feed.destroy()
    }
  }

  onTrades(trades: Trade[]) {
    if (this.feed.processTrades(trades) === this.showPlaceholder) {
      this.showPlaceholder = false
    }
  }

  refreshList() {
    const elements = this.$el.getElementsByClassName('trade')

    const trades: Trade[] = []

    for (const element of elements) {
      const [exchange, pair] = parseMarket(element.getAttribute('title'))

      const timestamp = element
        .querySelector('.trade__time')
        .getAttribute('data-timestamp')
      const price =
        parseFloat(
          (element.querySelector('.trade__price') as HTMLElement)?.innerText
        ) || 0
      const size =
        parseFloat(
          (element.querySelector('.trade__amount__base') as HTMLElement)
            .innerText
        ) || 0
      const side: 'buy' | 'sell' = element.classList.contains('-buy')
        ? 'buy'
        : 'sell'
      const amount =
        size * (this.$store.state.settings.preferQuoteCurrencySize ? price : 1)
      const trade: Trade = {
        timestamp: timestamp as unknown as number,
        exchange,
        pair,
        price,
        avgPrice: price,
        amount,
        size,
        side
      }

      if (element.classList.contains('-liquidation')) {
        trade.liquidation = true
      }

      trades.push(trade)
    }

    this.feed.clear()
    this.feed.processTradesSilent(trades)
  }
}
</script>

<style lang="scss">
.pane-trades {
  &.-extra-small .trade {
    padding: 0 1rem 0 1rem;

    &.-level-0 {
      line-height: 1.25em !important;
    }
    &.-level-1 {
      line-height: 1.66em !important;
    }
    &.-level-2 {
      line-height: 1.75em !important;
    }
  }
}

.trades-list {
  margin: 0;
  padding: 0;
  overflow: auto;
  max-height: 100%;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  scrollbar-width: none;

  &:not(.-logos) {
    .trade__exchange,
    .trade__pair {
      font-size: 75%;
    }
  }

  &.-logos {
    .trade__exchange {
      overflow: visible;
      text-align: center;
      flex-grow: 0.5;

      &:before {
        font-family: 'icon';
        font-weight: 400;
        font-size: 1em;
        line-height: 0;
        position: relative;
        top: 0.1em;
      }
    }

    @each $exchange, $icon in $exchange-list {
      .-#{$exchange} .trade__exchange:before {
        content: $icon;
      }
    }

    &.-logos-colors {
      .trade__exchange {
        background-repeat: no-repeat;
        background-position: center;
        background-size: 1em;

        &:before {
          display: none;
        }
      }

      @each $exchange, $icon in $exchange-list {
        .-#{$exchange} .trade__exchange {
          background-image: url('../../assets/exchanges/#{$exchange}.svg');
        }
      }
    }
  }
}

.trades-placeholder {
  text-align: center;
  overflow: auto;
  max-height: 100%;

  &__market {
    color: var(--theme-color-200);
  }
}

.trade {
  display: flex;
  background-position: center center;
  background-size: cover;
  background-blend-mode: overlay;
  position: relative;
  padding: 0 2rem 0 0.5rem;

  &:after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    opacity: 0;
    background-color: white;
    animation: 1s $ease-out-expo highlight;
    pointer-events: none;
  }

  &.-sell {
    background-color: lighten($red, 35%);
    color: $red;
  }

  &.-buy {
    background-color: lighten($green, 50%);
    color: $green;
  }

  &.-level-0 {
    line-height: 1.875em;
    font-size: 0.875em;
  }

  &.-level-1 {
    line-height: 1.875em;
    font-size: 1em;
  }

  &.-level-2 {
    line-height: 1.75em;
    font-size: 1.125em;
    font-weight: 600;
    padding-bottom: 1px;
  }

  &.-level-3 {
    line-height: 2em;
    box-shadow: 0 0 20px rgba(black, 0.5);
    z-index: 1;
    font-size: 1.25em;
    padding-bottom: 2px;
    font-weight: 600;
  }

  > div {
    flex-grow: 1;
    flex-basis: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon-quote,
  .icon-base {
    line-height: 0;
    font-size: 0.875em;
  }

  .trade__pair {
    font-size: 87.5%;
  }

  .trade__exchange {
    text-align: left;
  }

  .trade__price {
    small {
      font-size: 0.75em;
      font-weight: 400;
      line-height: 1em;
      display: inline-block;
      vertical-align: top;
      padding: 0.2em 0.25em;
    }
  }

  .trade__amount {
    flex-grow: 1.25;
    .trade__amount__base {
      display: none;
      padding: 0 0.5em;
    }

    &:hover {
      > .trade__amount__base {
        display: block;
      }

      > .trade__amount__quote {
        display: none;
      }
    }
  }

  .trade__time {
    position: absolute;
    right: 0.5rem;
    text-align: right;
    overflow: visible;

    &.-fixed {
      font-size: 87.5%;
    }
  }
}

#app[data-prefered-sizing-currency='base'] .trade .trade__amount {
  .trade__amount__quote {
    display: none;
  }

  .trade__amount__base {
    display: block;
  }

  &:hover {
    > span.trade__amount__base {
      display: none;
    }

    > span.trade__amount__quote {
      display: block;
    }
  }
}

#app.-light .trade.-level-3 {
  box-shadow: 0 0 20px rgba(white, 0.5);
}
</style>
