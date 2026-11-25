<template>
  <div class="pane-sources">
    <!-- coin -->
    <div class="pane-sources__section">
      <div class="pane-sources__section-header">
        <span class="pane-sources__title"
          >Coins<template v-if="coinsCount"> · {{ coinsCount }}</template></span
        >
        <input
          v-model="coinQuery"
          type="search"
          class="form-control pane-sources__search"
          placeholder="Search coin"
        />
      </div>
      <div class="pane-sources__coins">
        <button
          v-for="item of coinTiles"
          :key="item.base"
          type="button"
          class="pane-sources__coin"
          :class="{ '-active': item.base === coin }"
          :title="item.count + ' markets'"
          @click="selectCoin(item.base)"
        >
          <img v-if="item.icon" :src="item.icon" alt="" loading="lazy" />
          <span>{{ item.base }}</span>
        </button>
        <span
          v-if="!coinTiles.length && !isLoading"
          class="pane-sources__empty"
        >
          No coin found
        </span>
      </div>
      <p v-if="moreCoins" class="pane-sources__more">
        + {{ moreCoins }} more {{ coinQuery.trim() ? 'matching ' : '' }}coin{{
          moreCoins === 1 ? '' : 's'
        }},
        {{
          coinQuery.trim()
            ? 'refine your search'
            : 'use the search to find them'
        }}
      </p>
    </div>

    <!-- filters + summary -->
    <div class="pane-sources__toolbar">
      <div class="pane-sources__filters">
        <button
          v-for="type of typeFilters"
          :key="type.id"
          type="button"
          class="pane-sources__filter"
          :class="{ '-active': types[type.id] }"
          @click="toggleFilter(types, type.id)"
        >
          {{ type.label }}
        </button>
        <span class="pane-sources__divider"></span>
        <button
          v-for="quote of quoteFilters"
          :key="quote"
          type="button"
          class="pane-sources__filter"
          :class="{ '-active': quotes[quote] }"
          @click="toggleFilter(quotes, quote)"
        >
          {{ quote }}
        </button>
      </div>
      <div class="pane-sources__summary">
        <span class="pane-sources__count">{{ label }}</span>
        <label
          class="checkbox-control -small pane-sources__all"
          :class="{ '-disabled': !shownMarkets.length }"
          title="Add (or remove) every market shown below"
          v-tippy
        >
          <input
            type="checkbox"
            class="form-control"
            :checked="allSelected"
            :disabled="!shownMarkets.length"
            @change="toggleAll"
          />
          <div></div>
          <span>Select all</span>
        </label>
      </div>
    </div>

    <p v-if="isLoading" class="pane-sources__loading">
      Loading markets… {{ loadedCount }}/{{ exchanges.length }} exchanges
    </p>

    <!-- exchanges -->
    <div class="pane-sources__grid">
      <div
        v-for="group of groups"
        :key="group.exchange"
        class="pane-sources__tile"
        :class="{ '-off': !group.selected }"
      >
        <button
          type="button"
          class="pane-sources__tile-header"
          :title="
            group.selected === group.markets.length
              ? 'Remove all ' + group.name + ' markets'
              : 'Add all ' + group.name + ' markets'
          "
          @click="toggleExchange(group)"
        >
          <i :class="'icon-' + group.exchange"></i>
          <span class="pane-sources__tile-name">{{ group.name }}</span>
          <span class="pane-sources__tile-count"
            >{{ group.selected }}/{{ group.markets.length }}</span
          >
        </button>
        <div class="pane-sources__chips">
          <button
            v-for="market of group.markets"
            :key="market.id"
            type="button"
            class="pane-sources__chip"
            :class="{ '-active': selection[market.id] }"
            @click="toggleMarket(market.id)"
          >
            {{ market.label }}
            <small>{{ market.type }}</small>
          </button>
        </div>
      </div>
    </div>

    <p
      v-if="!isLoading && !groups.length"
      class="pane-sources__empty text-center"
    >
      No {{ coin }} market matches these filters.
    </p>

    <!-- markets of the pane that aren't listed above (other coin, unknown) -->
    <div v-if="otherMarkets.length" class="pane-sources__section">
      <div class="pane-sources__title">Other markets in this pane</div>
      <div class="pane-sources__chips">
        <button
          v-for="market of otherMarkets"
          :key="market"
          type="button"
          class="pane-sources__chip -active"
          title="Remove"
          v-tippy
          @click="toggleMarket(market)"
        >
          {{ market }} <i class="icon-cross"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import {
  getExchangeSymbols,
  getMarketProduct,
  indexedProducts,
  indexProducts,
  isAllowedQuote,
  parseMarket,
  QUOTE_CURRENCIES
} from '@/services/productsService'
import { Product } from '@/store/app'
import coinIconsSymbols from 'virtual:coin-icons'

// exchanges without historical data: not listed for charts
const CHART_HIDDEN_EXCHANGES = ['HITBTC', 'BITMEX', 'BITMART', 'WHITEBIT']

// colored coin logos (see vite.coin-icons.js)
const COIN_ICONS = coinIconsSymbols.reduce(
  (acc, symbol) => {
    acc[symbol] = true
    return acc
  },
  {} as { [symbol: string]: boolean }
)

function getCoinIcon(base: string) {
  // ex: 1000SHIB -> SHIB
  const symbol = base.replace(/^\d+M?(?=[A-Z])/, '')

  return COIN_ICONS[symbol]
    ? `${import.meta.env.BASE_URL}coins/${symbol}.svg`
    : null
}

// listed first, then A to Z (names starting with a digit, ex: 1000SHIB, last)
const FIRST_COINS = ['BTC', 'ETH', 'SOL']

// stablecoins are quotes, never a pane's coin
const STABLECOINS = [
  'USDT',
  'USDC',
  'USDE',
  'USDS',
  'DAI',
  'FDUSD',
  'TUSD',
  'USDD',
  'USDP',
  'BUSD',
  'PYUSD',
  'RLUSD',
  'USD1',
  'USDG',
  'UST',
  'EURC',
  'EURT'
]

// coin tiles shown at once, others are found with the search
const MAX_COINS = 24

// biggest coins by market cap (Nov 2026, stablecoins and wrapped tokens
// excluded, BTC / ETH / SOL kept first), they get the tiles. When fewer are
// available (ex: charts only list coins with historical data), the coins
// listed on the most exchanges fill the remaining tiles
const TOP_COINS = [
  'BTC',
  'ETH',
  'SOL',
  'BNB',
  'XRP',
  'TRX',
  'HYPE',
  'ZEC',
  'XMR',
  'DOGE',
  'BCH',
  'LINK',
  'ADA',
  'XLM',
  'LEO',
  'NEAR',
  'SUI',
  'AVAX',
  'LTC',
  'HBAR',
  'GRAM', // formerly TON
  'TON',
  'SHIB',
  'DOT',
  'UNI',
  'AAVE',
  'CRO',
  'TAO'
]

function compareCoins(a: string, b: string) {
  const firstA = FIRST_COINS.indexOf(a)
  const firstB = FIRST_COINS.indexOf(b)

  if (firstA !== -1 || firstB !== -1) {
    return (
      (firstA === -1 ? Infinity : firstA) - (firstB === -1 ? Infinity : firstB)
    )
  }

  const digitA = /^\d/.test(a)
  const digitB = /^\d/.test(b)

  if (digitA !== digitB) {
    return digitA ? 1 : -1
  }

  return a.localeCompare(b)
}

interface MarketChip {
  id: string
  label: string
  type: string
}

interface ExchangeGroup {
  exchange: string
  name: string
  markets: MarketChip[]
  selected: number
}

/**
 * "Sources" tab of the pane settings: the one place to pick the pane's markets.
 * Pick a coin, then every exchange's markets for it are listed (spot / perp,
 * USD / USDT / USDC filters), tap a market to add or remove it.
 */
@Component({
  name: 'PaneSources',
  props: {
    paneId: {
      type: String,
      required: true
    }
  }
})
export default class PaneSources extends Vue {
  paneId: string

  coin = 'BTC'
  coinQuery = ''
  types = { spot: true, perp: true }
  quotes = QUOTE_CURRENCIES.reduce((acc, quote) => {
    acc[quote] = true
    return acc
  }, {})
  typeFilters = [
    { id: 'spot', label: 'Spot' },
    { id: 'perp', label: 'Perpetual' }
  ]
  quoteFilters = QUOTE_CURRENCIES
  loadedCount = 0
  productsVersion = 0

  get exchanges(): string[] {
    return this.$store.getters['exchanges/getExchanges']
  }

  get isChart() {
    return this.$store.state.panes.panes[this.paneId].type === 'chart'
  }

  get isLoading() {
    return this.loadedCount < this.exchanges.length
  }

  get markets(): string[] {
    return this.$store.state.panes.panes[this.paneId].markets
  }

  get selection(): { [id: string]: boolean } {
    return this.markets.reduce((acc, market) => {
      acc[market] = true
      return acc
    }, {})
  }

  get historicalMarkets(): string[] {
    return this.$store.state.app.historicalMarkets
  }

  /**
   * every usable product (supported quote, no dated futures, charts: only
   * exchanges and markets with historical data)
   */
  get products(): Product[] {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    this.productsVersion

    const historical = this.isChart && this.historicalMarkets.length > 0
    const historicalIndex = historical
      ? this.historicalMarkets.reduce((acc, id) => {
          acc[id] = true
          return acc
        }, {})
      : null
    const products = []

    for (const exchange of this.exchanges) {
      if (
        !indexedProducts[exchange] ||
        (this.isChart && CHART_HIDDEN_EXCHANGES.indexOf(exchange) !== -1)
      ) {
        continue
      }

      for (const product of indexedProducts[exchange] as Product[]) {
        if (
          product.type === 'future' ||
          !isAllowedQuote(product.quote) ||
          (historicalIndex && !historicalIndex[product.id])
        ) {
          continue
        }

        products.push(product)
      }
    }

    return products
  }

  get coinCounts(): { [base: string]: number } {
    const counts = {}

    for (const product of this.products) {
      if (STABLECOINS.indexOf(product.base) === -1) {
        counts[product.base] = (counts[product.base] || 0) + 1
      }
    }

    return counts
  }

  get coinsCount() {
    return Object.keys(this.coinCounts).length
  }

  get coinsList(): string[] {
    const counts = this.coinCounts
    const query = this.coinQuery.trim().toUpperCase()

    // most listed first, to pick which coins get a tile
    const bases = Object.keys(counts)
      .filter(base => !query || base.indexOf(query) !== -1)
      .sort((a, b) => counts[b] - counts[a])

    return bases
  }

  get coinTiles() {
    const counts = this.coinCounts
    const query = this.coinQuery.trim()
    let bases: string[]

    if (query) {
      bases = this.coinsList.slice(0, MAX_COINS)
    } else {
      // biggest coins by market cap, then the most listed ones
      bases = TOP_COINS.filter(base => counts[base]).slice(0, MAX_COINS)

      for (const base of this.coinsList) {
        if (bases.length >= MAX_COINS) {
          break
        }

        if (bases.indexOf(base) === -1) {
          bases.push(base)
        }
      }

      // the pane's coin always gets a tile
      if (counts[this.coin] && bases.indexOf(this.coin) === -1) {
        bases.push(this.coin)
      }
    }

    return bases.sort(compareCoins).map(base => ({
      base,
      icon: getCoinIcon(base),
      count: counts[base]
    }))
  }

  get moreCoins() {
    return Math.max(0, this.coinsList.length - this.coinTiles.length)
  }

  /**
   * markets of the selected coin passing the filters (filtered out markets
   * stay in the pane, they're just not listed)
   */
  get shownMarkets(): Product[] {
    return this.products.filter(
      product =>
        product.base === this.coin &&
        this.types[product.type] &&
        this.quotes[product.quote]
    )
  }

  get groups(): ExchangeGroup[] {
    const groups: { [exchange: string]: ExchangeGroup } = {}

    for (const product of this.shownMarkets) {
      if (!groups[product.exchange]) {
        groups[product.exchange] = {
          exchange: product.exchange,
          name: product.exchange.replace(/_/g, ' '),
          markets: [],
          selected: 0
        }
      }

      groups[product.exchange].markets.push({
        id: product.id,
        label: product.pair.toUpperCase(),
        type: product.type
      })

      if (this.selection[product.id]) {
        groups[product.exchange].selected++
      }
    }

    // exchanges order
    return this.exchanges
      .filter(exchange => groups[exchange])
      .map(exchange => groups[exchange])
  }

  get allSelected() {
    return (
      this.shownMarkets.length > 0 &&
      this.shownMarkets.every(product => this.selection[product.id])
    )
  }

  // pane markets of another coin or not listed at all (ex: exchange hidden
  // for charts), filtered out markets of the coin aren't included
  get otherMarkets() {
    if (this.isLoading) {
      return []
    }

    const coinMarkets = this.products.reduce((acc, product) => {
      if (product.base === this.coin) {
        acc[product.id] = true
      }
      return acc
    }, {})

    return this.markets.filter(market => !coinMarkets[market])
  }

  get label() {
    const count = this.markets.length
    const exchanges = this.markets
      .map(market => parseMarket(market)[0])
      .filter((exchange, index, all) => all.indexOf(exchange) === index).length

    return `${count} market${count === 1 ? '' : 's'} · ${exchanges} exchange${
      exchanges === 1 ? '' : 's'
    }`
  }

  created() {
    this.initializeFromPane()
    this.loadProducts()
  }

  /**
   * coin = most common base of the pane's markets, filters = types it uses
   */
  initializeFromPane() {
    const bases: { [base: string]: number } = {}
    const types = {}

    for (const market of this.markets) {
      const [exchange, pair] = parseMarket(market)
      const product = getMarketProduct(exchange, pair)

      if (!product) {
        continue
      }

      bases[product.base] = (bases[product.base] || 0) + 1
      types[product.type] = true
    }

    const coin = Object.keys(bases).sort((a, b) => bases[b] - bases[a])[0]

    if (coin) {
      this.coin = coin
    }

    if (types['spot'] || types['perp']) {
      this.types = { spot: !!types['spot'], perp: !!types['perp'] }
    }
  }

  loadProducts() {
    for (const exchange of this.exchanges) {
      if (indexedProducts[exchange]) {
        this.loadedCount++
        continue
      }

      getExchangeSymbols(exchange)
        .then(symbols => {
          if (!indexedProducts[exchange]) {
            indexProducts(exchange, symbols)
          }
        })
        .catch(error => {
          console.error(`[sources] couldn't load ${exchange} markets`, error)
        })
        .finally(() => {
          this.loadedCount++
          this.productsVersion++
        })
    }
  }

  toggleFilter(filters: { [key: string]: boolean }, key: string) {
    Vue.set(filters, key, !filters[key])
  }

  setMarkets(markets: string[]) {
    this.$store.dispatch('panes/setMarketsForPane', {
      id: this.paneId,
      markets
    })
  }

  toggleMarket(id: string) {
    if (this.selection[id]) {
      this.setMarkets(this.markets.filter(market => market !== id))
    } else {
      this.setMarkets([...this.markets, id])
    }
  }

  toggleMarkets(ids: string[], select: boolean) {
    if (select) {
      this.setMarkets([
        ...this.markets,
        ...ids.filter(id => !this.selection[id])
      ])
    } else {
      this.setMarkets(this.markets.filter(market => ids.indexOf(market) === -1))
    }
  }

  toggleExchange(group: ExchangeGroup) {
    this.toggleMarkets(
      group.markets.map(market => market.id),
      group.selected !== group.markets.length
    )
  }

  toggleAll() {
    this.toggleMarkets(
      this.shownMarkets.map(product => product.id),
      !this.allSelected
    )
  }

  /**
   * switch the pane to another coin: same exchanges / types / quotes as the
   * current coin's markets (or every listed market when nothing matches)
   */
  selectCoin(base: string) {
    if (base === this.coin) {
      return
    }

    const previous = this.products.filter(
      product => product.base === this.coin && this.selection[product.id]
    )
    const candidates = this.products.filter(
      product =>
        product.base === base &&
        this.types[product.type] &&
        this.quotes[product.quote]
    )

    let markets = candidates.filter(candidate =>
      previous.some(
        product =>
          product.exchange === candidate.exchange &&
          product.type === candidate.type &&
          product.quote === candidate.quote
      )
    )

    if (!markets.length) {
      markets = candidates
    }

    const previousIds = previous.map(product => product.id)

    this.coin = base
    this.coinQuery = ''
    this.setMarkets([
      ...this.markets.filter(market => previousIds.indexOf(market) === -1),
      ...markets.map(product => product.id)
    ])
  }
}
</script>

<style lang="scss" scoped>
.pane-sources {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__section-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  &__title {
    opacity: 0.75;
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.05em;
  }

  &__search {
    margin-left: auto;
    width: 10rem;
    max-width: 50%;
    padding: 0.25rem 0.5rem;
  }

  &__coins {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
    gap: 0.375rem;
  }

  &__coin {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    min-width: 0;
    min-height: 3.25rem;
    padding: 0.375rem 0.25rem;
    border: 1px solid transparent;
    border-radius: 0.375rem;
    background-color: var(--theme-background-150);
    color: var(--theme-color-base);
    font: inherit;
    font-size: 0.75rem;
    cursor: pointer;

    img {
      width: 1.5rem;
      height: 1.5rem;
      // keeps dark logos (ex: XLM) visible on the dark theme
      filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.5));
    }

    span {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &:hover {
      background-color: var(--theme-background-200);
    }

    &.-active {
      border-color: var(--theme-accent-base);
      background-color: var(--theme-accent-base);
      color: var(--theme-accent-color);
    }
  }

  &__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }

  &__filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
  }

  &__filter {
    padding: 0.25rem 0.625rem;
    border: 1px solid var(--theme-background-200);
    border-radius: 1rem;
    background: none;
    color: var(--theme-color-base);
    font: inherit;
    font-size: 0.8125rem;
    opacity: 0.6;
    cursor: pointer;

    &.-active {
      border-color: var(--theme-accent-base);
      background-color: var(--theme-accent-base);
      color: var(--theme-accent-color);
      opacity: 1;
    }
  }

  &__divider {
    width: 1px;
    height: 1.25rem;
    margin: 0 0.25rem;
    background-color: var(--theme-background-200);
  }

  &__summary {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-left: auto;
  }

  &__count {
    opacity: 0.75;
    white-space: nowrap;
  }

  &__all {
    margin: 0;
    white-space: nowrap;

    &.-disabled {
      opacity: 0.5;
    }
  }

  &__more {
    margin: 0;
    opacity: 0.6;
    font-size: 0.8125rem;
  }

  &__loading,
  &__empty {
    margin: 0;
    opacity: 0.6;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(12.5rem, 1fr));
    gap: 0.5rem;
  }

  &__tile {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
    padding: 0.5rem;
    border-radius: 0.375rem;
    background-color: var(--theme-background-150);

    &.-off {
      opacity: 0.55;
    }
  }

  &__tile-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0;
    border: 0;
    background: none;
    color: var(--theme-color-base);
    font: inherit;
    text-align: left;
    cursor: pointer;

    i {
      font-size: 1.125rem;
    }
  }

  &__tile-name {
    flex-grow: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.8125rem;
  }

  &__tile-count {
    font-size: 0.75rem;
    opacity: 0.75;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  &__chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    max-width: 100%;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--theme-background-200);
    border-radius: 0.25rem;
    background: none;
    color: var(--theme-color-base);
    font-family: $font-monospace;
    font-size: 0.75rem;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    small {
      opacity: 0.6;
      font-family: inherit;
      text-transform: uppercase;
      font-size: 0.625rem;
    }

    &:hover {
      border-color: var(--theme-color-50);
    }

    &.-active {
      border-color: var(--theme-accent-base);
      background-color: var(--theme-accent-base);
      color: var(--theme-accent-color);
    }
  }
}
</style>
