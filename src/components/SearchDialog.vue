<template>
  <Dialog
    ref="dialog"
    class="search-dialog"
    size="wide"
    @resize="onResize"
    @clickOutside="hide"
  >
    <template v-slot:header>
      <div v-if="selectedPaneId">
        <div class="dialog__title">
          Connect →
          <code class="-filled -green">
            <span>{{ paneName }}</span>
          </code>
          <button
            type="button"
            class="btn -small ml4 -text -no-grab"
            v-tippy
            title="Connect to all"
            @click="detargetPane"
          >
            <i class="icon-cross"></i>
          </button>
        </div>
      </div>
      <div v-else>
        <div class="dialog__title">Manage connections</div>
      </div>
      <Loader
        v-if="isLoading || isPreloading"
        small
        class="mtauto mbauto mr0"
        title="Updating database..."
        v-tippy
      />
      <div class="column -center"></div>
    </template>
    <div
      class="search-dialog__side hide-scrollbar"
      :class="{ '-show': mobileShowFilters }"
    >
      <ToggableSection title="Extras" persistent id="search-extras">
        <label class="checkbox-control -small mb4">
          <input
            type="checkbox"
            class="form-control"
            :checked="searchTypes.normalize"
            @change="$store.commit('settings/TOGGLE_SEARCH_TYPE', 'normalize')"
          />
          <div></div>
          <span>
            Group by pair
            <i
              class="icon-info info-tap"
              v-tippy="infoTippy"
              @click.stop.prevent="showInfo"
              title="One row per pair across every exchange (ex: BTCUSDT on Binance, Bybit, OKX...), a click adds them all at once.<br>Off: one row per exchange market."
            ></i>
          </span>
        </label>
        <label class="checkbox-control -small mb4">
          <input
            type="checkbox"
            class="form-control"
            :checked="searchTypes.mergeUsdt"
            @change="$store.commit('settings/TOGGLE_SEARCH_TYPE', 'mergeUsdt')"
          />
          <div></div>
          <span>
            Merge stablecoins
            <i
              class="icon-info info-tap"
              v-tippy="infoTippy"
              @click.stop.prevent="showInfo"
              title="Treat USDT, USDC, USD and other stablecoins as the same quote, so BTCUSDT, BTCUSDC and BTCUSD end up in a single BTCUSD row"
            ></i>
          </span>
        </label>
      </ToggableSection>

      <ToggableSection title="Exchanges" id="search-exchanges">
        <template v-for="id of exchanges">
          <label
            class="checkbox-control -small mb4 -custom hide-scrollbar"
            :key="id"
            v-if="
              !$store.state.exchanges[id].disabled &&
              hiddenExchanges.indexOf(id) === -1
            "
          >
            <input
              type="checkbox"
              class="form-control"
              :checked="searchExchanges[id] !== false"
              @click="toggleExchange($event, id)"
            />
            <div :class="'icon-' + id"></div>
            <span>
              <span v-text="id"></span>
              <a
                v-if="canRefreshProducts"
                href="javascript:void(0);"
                class="-text"
                @click.stop="refreshExchangeProducts(id)"
                :title="`Refresh ${id}'s products`"
                v-tippy="{ boundary: 'window', placement: 'left' }"
              >
                <i class="icon-refresh ml8 mr8"></i>
              </a>
            </span>
          </label>
        </template>
        <template v-slot:control>
          <label class="checkbox-control -small flex-right">
            <input
              type="checkbox"
              class="form-control"
              :checked="allExchangesEnabled"
              @change="toggleAll"
            />
            <div></div>
          </label>
        </template>
      </ToggableSection>

      <ToggableSection title="Type" id="search-type">
        <label class="checkbox-control -small mb4">
          <input
            type="checkbox"
            class="form-control"
            :checked="searchTypes.spots"
            @change="$store.commit('settings/TOGGLE_SEARCH_TYPE', 'spots')"
          />
          <div></div>
          <span>Spot</span>
        </label>
        <label class="checkbox-control -small mb4">
          <input
            type="checkbox"
            class="form-control"
            :checked="searchTypes.perpetuals"
            @change="$store.commit('settings/TOGGLE_SEARCH_TYPE', 'perpetuals')"
          />
          <div></div>
          <span>Perpetual</span>
        </label>
      </ToggableSection>

      <ToggableSection id="search-quotes">
        <template v-slot:title>
          <div class="toggable-section__title">
            Currency
            <span v-if="quotesCount.length" class="badge -red ml8 mr8">{{
              quotesCount.length
            }}</span>
          </div>
        </template>
        <label
          class="checkbox-control -small mb4"
          v-for="quote of quoteCurrencies"
          :key="quote"
        >
          <input
            type="checkbox"
            class="form-control"
            :checked="
              searchQuotes[quote] === true || searchQuotes[quote] === undefined
            "
            @change="
              $store.commit('settings/TOGGLE_SEARCH_QUOTE', {
                key: quote,
                value: $event.target.checked
              })
            "
          />
          <div></div>
          <span>{{ quote }}</span>
        </label>
      </ToggableSection>
    </div>
    <div class="search-dialog__wrapper hide-scrollbar">
      <div
        class="search-dialog-selection search-dialog__tags form-control hide-scrollbar"
        :class="groupsCount < 10 && '-sticky'"
        @click="$refs.input.focus()"
        ref="selection"
      >
        <template v-if="searchTypes.normalize">
          <button
            v-for="(markets, localPair) of groupedSelection"
            :key="localPair"
            class="search-dialog__tags-item btn -green -pill"
            :title="'Click to remove ' + markets.join(', ')"
            @click.stop.prevent="toggleMarkets(markets)"
          >
            <span
              v-if="markets.length > 1"
              class="badge -green ml8"
              v-text="markets.length"
            ></span>
            <span v-text="localPair"></span>
          </button>
        </template>
        <template v-else>
          <button
            v-for="market of selectedProducts"
            :key="market.id"
            class="search-dialog__tags-item btn -theme"
            :class="{ '-green': activeMarkets.indexOf(market.id) !== -1 }"
            :title="`Click to remove ${market.id}`"
            @click.stop.prevent="toggleMarkets(market.id)"
          >
            <template v-if="!market.exchange">
              {{ market.id }}
            </template>
            <template v-else>
              <i class="mr4" :class="`icon-${market.exchange}`"></i>
              {{ market.pair }}
            </template>
          </button>
        </template>
        <input
          ref="input"
          class="search-dialog__tags-item"
          type="text"
          :placeholder="`Search (${filteredProducts.length})`"
          :value="query"
          @input="onInput"
        />
      </div>
      <button
        v-if="query.length || selection.length"
        class="btn search-dialog__tags-delete -text -small"
        @click="clearSelection"
        title="Clear"
        v-tippy="{ boundary: 'window', placement: 'bottom' }"
      >
        <i class="icon-cross"></i>
      </button>
      <div class="search-dialog__results hide-scrollbar">
        <table class="table mt8 table--inset" v-if="searchTypes.normalize">
          <tbody>
            <tr
              v-for="(group, index) in slicedResults"
              :key="group.localPair"
              @click="toggleMarkets(group.markets)"
              :class="{ '-active': activeIndex === index }"
              class="-action"
            >
              <td v-text="group.localPair"></td>
              <td class="-lower">
                <span class="search-dialog__group-count">
                  <div class="badge mr8">
                    {{ group.markets.length }}
                  </div>
                </span>
                <i
                  v-for="(pairs, exchange) of group.exchanges"
                  :key="exchange"
                  class="pr4 search-dialog__exchange-logo"
                  :class="'icon-' + exchange"
                ></i>
              </td>
            </tr>
          </tbody>
        </table>
        <table v-else class="table table--inset mt8">
          <tbody>
            <tr
              v-for="(market, index) of slicedResults"
              :key="market.id"
              @click="toggleMarkets([market.id])"
              :class="{ '-active': activeIndex === index }"
              class="-action"
            >
              <td
                class="icon search-dialog__exchange text-center text-color-base"
                :class="'icon-' + market.exchange"
              ></td>
              <td v-text="market.exchange"></td>
              <td v-text="market.pair"></td>
              <td v-text="market.type"></td>
            </tr>
          </tbody>
        </table>

        <transition name="fade-scale">
          <div
            v-if="!isPreloading && !pagesCount"
            class="search-dialog__results-empty"
            :style="{ backgroundImage: `url(${noResultsPng})` }"
          >
            <p
              class="shake-horizontal"
              v-html="noResultsMessage"
              @click="$event.target.tagName === 'BUTTON' && clearSelection()"
            ></p>
          </div>
        </transition>
      </div>
      <div v-if="pagesCount" class="search-dialog__results-footer mt8 d-flex">
        <button class="btn -text mrauto" @click="addAll">
          <i class="icon-plus mr8"></i> add all
        </button>
        <button
          v-for="(i, index) in pagination"
          :key="index"
          class="btn -text search-dialog__results-footer-page"
          :class="[page === i && '-active -theme']"
          @click="goPage(i)"
        >
          {{ i + 1 }}
        </button>
      </div>
    </div>

    <template v-slot:footer>
      <btn
        class="btn -text mrauto search-dialog__side-toggle"
        @click="mobileShowFilters = !mobileShowFilters"
      >
        <i class="icon-cog"></i>
      </btn>
      <a href="javascript:void(0);" class="btn -text" @click="hide">Cancel</a>
      <btn
        class="-large -green ml8"
        @click.native="submit"
        :loading="isLoading"
      >
        {{ submitLabel }}
      </btn>
    </template>
  </Dialog>
</template>

<script>
import Loader from '@/components/framework/Loader.vue'
import Btn from '@/components/framework/Btn.vue'
import Dialog from '@/components/framework/Dialog.vue'
import DialogMixin from '@/mixins/dialogMixin'
import { copyTextToClipboard, getBucketId } from '@/utils/helpers'
import dialogService from '@/services/dialogService'
import workspacesService from '@/services/workspacesService'
import {
  indexedProducts,
  indexProducts,
  getExchangeSymbols,
  ensureIndexedProducts,
  parseMarket,
  stripStableQuote,
  QUOTE_CURRENCIES,
  isAllowedQuote
} from '@/services/productsService'
import ToggableSection from '@/components/framework/ToggableSection.vue'
import { isTouchSupported } from '@/utils/touchevent'
import noResultsPng from '@/assets/noresults.png'

const RESULTS_PER_PAGE = 25

// not listed when connecting a chart
const CHART_HIDDEN_EXCHANGES = [
  'AGGR',
  'HITBTC',
  'BITMEX',
  'BITMART',
  'WHITEBIT'
]

const selectedProducts = {}
let flattenedProducts = []

export default {
  mixins: [DialogMixin],
  components: {
    ToggableSection,
    Dialog,
    Btn,
    Loader
  },
  props: {
    paneId: {
      required: false
    },
    pristine: {
      type: Boolean,
      default: false
    },
    input: {
      type: String,
      default: null
    }
  },
  data: () => ({
    // info icons: hover on desktop; on touch screens tippy is manual (its touch
    // handling hides it right away) and a tap shows it without toggling the checkbox
    infoTippy: isTouchSupported() ? { trigger: 'manual' } : {},
    page: 0,
    query: '',
    markets: [],
    maxPages: 5,
    selection: [],
    isLoading: false,
    noResultsPng,
    noResultsMessage: null,
    isPreloading: false,
    productsReady: false,
    selectedPaneId: null,
    cacheTimestamp: 0,
    originalSelection: [],
    activeIndex: null,
    mobileShowFilters: false,
    canRefreshProducts: true,
    quoteCurrencies: QUOTE_CURRENCIES
  }),
  computed: {
    paneName() {
      if (!this.selectedPaneId) {
        return 'n/a'
      }

      const name = this.$store.getters['panes/getName'](this.selectedPaneId)

      if (!name.trim().length) {
        return this.$store.state.panes.panes[this.selectedPaneId].type
      }

      return name
    },
    activeMarkets() {
      return Object.keys(this.$store.state.panes.marketsListeners)
    },
    paneMarkets() {
      if (!this.selectedPaneId) {
        return []
      }

      return this.$store.state.panes.panes[this.selectedPaneId].markets
    },
    toConnect() {
      if (this.selectedPaneId) {
        return this.selection.filter(a => this.paneMarkets.indexOf(a) === -1)
          .length
      } else {
        return this.selection.filter(a => this.activeMarkets.indexOf(a) === -1)
          .length
      }
    },
    toDisconnect() {
      return this.originalSelection.filter(
        a => this.selection.indexOf(a) === -1
      ).length
    },
    submitLabel() {
      const toConnect = +this.toConnect
      const toDisconnect = +this.toDisconnect

      if (!this.selection.length && toDisconnect) {
        return `disconnect (${toDisconnect})`
      } else if (toConnect) {
        return `connect (${toConnect})`
      }

      return 'refresh'
    },
    searchTypes() {
      return this.$store.state.settings.searchTypes
    },
    // exchanges without historical data are of no use to a chart (no results)
    // but still feed the trades panes
    hiddenExchanges() {
      const pane =
        this.selectedPaneId &&
        this.$store.state.panes.panes[this.selectedPaneId]

      return pane && pane.type === 'chart' ? CHART_HIDDEN_EXCHANGES : []
    },
    searchQuotes() {
      const searchQuotesPreferences = this.$store.state.settings.searchQuotes

      return this.quoteCurrencies.reduce((acc, quote) => {
        acc[quote] =
          typeof searchQuotesPreferences[quote] === 'undefined'
            ? false
            : searchQuotesPreferences[quote]

        return acc
      }, {})
    },
    quotesCount() {
      return Object.values(this.searchQuotes).filter(a => !!a)
    },
    allQuotes() {
      return !this.quotesCount.length
    },
    exchanges() {
      return this.$store.getters['exchanges/getExchanges']
    },
    searchExchanges() {
      const searchExchanges = this.$store.state.settings.searchExchanges

      return Object.keys(this.$store.state.exchanges).reduce((output, id) => {
        if (this.$store.state.exchanges[id].disabled) {
          return output
        }

        output[id] =
          typeof searchExchanges[id] === 'undefined'
            ? true
            : searchExchanges[id]

        return output
      }, {})
    },
    allExchangesEnabled() {
      return (
        typeof Object.values(this.searchExchanges).find(a => a === false) ===
        'undefined'
      )
    },
    hasFilters() {
      const hasSpot = this.searchTypes.spots
      const hasPerpetuals = this.searchTypes.perpetuals
      const isMergeStables = this.searchTypes.mergeUsdt
      return isMergeStables || hasSpot || hasPerpetuals
    },
    historicalMarkets() {
      return this.$store.state.app.historicalMarkets
    },
    queryFilter: function () {
      const multiQuery = this.query
        .replace(/[ ,]/g, '|')
        .replace(/(^|\w|\s)\*(\w|\s|$)/g, '$1.*$2')

      if (this.searchTypes.normalize) {
        return new RegExp('^' + multiQuery, 'i')
      } else {
        return new RegExp(multiQuery, 'i')
      }
    },
    filteredProducts() {
      // force recalculate computed when cacheTimestamp changes
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const id = this.cacheTimestamp

      const hasSpot = this.searchTypes.spots
      const hasPerpetuals = this.searchTypes.perpetuals

      const exchanges = this.searchExchanges
      const hiddenExchanges = this.hiddenExchanges
      const hasTypeFilters = hasSpot || hasPerpetuals

      const searchQuotes = this.searchQuotes
      const allQuotes = this.allQuotes

      // only markets with historical data (all markets until that list loads)
      const historicalMarkets = this.historicalMarkets
      const hasHistorical = historicalMarkets.length > 0

      return flattenedProducts.filter(a => {
        if (hasHistorical && historicalMarkets.indexOf(a.id) === -1) {
          return false
        }

        // only USD, USDT and USDC quoted markets
        if (!isAllowedQuote(a.quote)) {
          return false
        }

        if (!allQuotes && !searchQuotes[a.quote]) {
          return false
        }

        if (
          !exchanges[a.exchange] ||
          hiddenExchanges.indexOf(a.exchange) !== -1
        ) {
          return false
        }

        // dated (expiring) futures contracts are never listed
        if (a.type === 'future') {
          return false
        }

        if (
          hasTypeFilters &&
          ((!hasPerpetuals && a.type === 'perp') ||
            (!hasSpot && a.type === 'spot'))
        ) {
          return false
        }

        return true
      })
    },
    marketsByPair: function () {
      const searchTypes = this.searchTypes
      const selection = this.selection
      const queryFilter = this.queryFilter

      if (!searchTypes.normalize) {
        return {}
      }

      return this.filteredProducts
        .filter(
          product =>
            selection.indexOf(product.id) === -1 &&
            queryFilter.test(product.local)
        )
        .reduce((groups, product) => {
          let localPair

          if (product && searchTypes.mergeUsdt) {
            localPair = product.base + stripStableQuote(product.quote)
          } else {
            localPair = product.base + product.quote
          }

          if (!groups[localPair]) {
            groups[localPair] = []
          }

          groups[localPair].push(product.id)

          return groups
        }, {})
    },
    results: function () {
      const offset = this.page * RESULTS_PER_PAGE
      const selection = this.selection
      const queryFilter = this.queryFilter
      if (this.searchTypes.normalize) {
        const marketsByPair = this.marketsByPair

        return Object.keys(marketsByPair)
          .slice(offset, offset + RESULTS_PER_PAGE)
          .map(localPair => ({
            localPair,
            markets: marketsByPair[localPair],
            exchanges: marketsByPair[localPair].reduce((acc, market) => {
              const [exchange, pair] = parseMarket(market)

              const normalizedExchange = exchange.replace(/_.*/, '')

              if (!acc[normalizedExchange]) {
                acc[normalizedExchange] = []
              }

              acc[normalizedExchange].push(pair)

              return acc
            }, {})
          }))
      } else {
        return this.filteredProducts.filter(
          product =>
            selection.indexOf(product.id) === -1 && queryFilter.test(product.id)
        )
      }
    },
    slicedResults() {
      if (this.searchTypes.normalize) {
        return this.results
      }

      const offset = this.page * RESULTS_PER_PAGE

      return this.results.slice(offset, offset + RESULTS_PER_PAGE)
    },
    pagesCount() {
      if (this.searchTypes.normalize) {
        return Math.ceil(
          Object.keys(this.marketsByPair).length / RESULTS_PER_PAGE
        )
      }
      return Math.ceil(this.results.length / RESULTS_PER_PAGE)
    },
    pagination() {
      let start, end

      const halfMax = Math.floor(this.maxPages / 2)

      if (this.pagesCount <= this.maxPages) {
        start = 0
        end = this.pagesCount - 1
      } else if (this.page < halfMax) {
        start = 0
        end = this.maxPages - 1
      } else if (this.page >= this.pagesCount - halfMax) {
        start = this.pagesCount - this.maxPages
        end = this.pagesCount - 1
      } else {
        // Center the current page
        start = this.page - halfMax
        end = this.page + (this.maxPages - halfMax - 1)
      }

      return Array.from({ length: end - start + 1 }, (_, i) => i + start)
    },
    selectedProducts: function () {
      return this.selection.map(
        market => selectedProducts[market] || { id: market }
      )
    },
    groupedSelection: function () {
      return this.selection.reduce((groups, market) => {
        const indexedProduct = selectedProducts[market]

        let localPair = market

        if (indexedProduct) {
          if (indexedProduct && this.searchTypes.mergeUsdt) {
            localPair =
              indexedProduct.base + stripStableQuote(indexedProduct.quote)
          } else {
            localPair = indexedProduct.base + indexedProduct.quote
          }
        }

        if (!groups[localPair]) {
          groups[localPair] = []
        }

        groups[localPair].push(market)

        return groups
      }, {})
    },
    groupsCount() {
      return Object.keys(this.groupedSelection).length
    },
    showNoResults() {
      return !this.isPreloading && !this.pagesCount
    }
  },

  watch: {
    '$store.state.app.showSearch': function (value) {
      if (!value) {
        this.close(false)
      }
    },
    async searchExchanges() {
      if (await this.ensureIndexedProducts()) {
        this.cacheProducts()
      }
    },
    showNoResults(value) {
      if (value) {
        this.noResultsMessage = this.getNoResultsMessage()
      }
    },
    pagesCount() {
      this.page = 0
    }
  },
  async created() {
    this.selectedPaneId = this.paneId

    this.initSelection()

    this.isPreloading = true
    await this.ensureIndexedProducts()
    this.isPreloading = false

    this.cacheProducts()
  },
  async mounted() {
    document.addEventListener('paste', this.onPaste)
    document.addEventListener('keydown', this.onKeydown)

    await this.$nextTick()

    this.maxPages = this.getMaxPages()

    if (!this.$refs.input) {
      return
    }

    if (
      this.input &&
      !window.event &&
      this.$refs.input.value.indexOf(this.input) !== 0
    ) {
      this.query = this.input + this.query
    }

    this.$refs.input.focus()
  },
  beforeDestroy() {
    document.removeEventListener('paste', this.onPaste)
    document.removeEventListener('keydown', this.onKeydown)
  },
  methods: {
    showInfo(event) {
      const tip = event.currentTarget._tippy

      if (tip) {
        tip.show()
      }
    },
    onInput(event) {
      this.page = 0
      this.query = event.target.value
      this.activeIndex = 0
    },
    onResize() {
      this.maxPages = this.getMaxPages()
    },
    getMaxPages() {
      return this.$refs.dialog.currentSize === 'small'
        ? 3
        : this.$refs.dialog.currentSize === 'medium'
          ? 5
          : 10
    },
    async ensureIndexedProducts() {
      const selectedExchanges = this.selection.reduce((acc, market) => {
        const [exchangeId] = parseMarket(market)

        if (!acc[exchangeId]) {
          acc[exchangeId] = true
        }

        return acc
      }, {})

      const requiredExchanges = {
        ...this.searchExchanges,
        ...selectedExchanges
      }

      const indexChanged = await ensureIndexedProducts(requiredExchanges)

      this.productsReady = true

      if (indexChanged) {
        return true
      }

      return false
    },
    async detargetPane() {
      this.$store.commit('app/SET_FOCUSED_PANE', null)
      this.selectedPaneId = null
      if (
        this.selection.join('') !== this.originalSelection.join('') &&
        !(await dialogService.confirm({
          title: `Override selection ?`,
          message: `Replace the existing selection<br>with the app's current active connections ?`,
          html: true
        }))
      ) {
        return
      }
      this.initSelection()
    },
    initSelection() {
      if (this.pristine) {
        return
      }

      if (this.selectedPaneId) {
        this.selection =
          this.$store.state.panes.panes[this.selectedPaneId].markets.slice()
      } else {
        this.selection = this.activeMarkets.slice()
      }

      this.originalSelection = this.selection.slice()
    },
    hasMultipleMarketsConfigurations() {
      return (
        Object.keys(this.$store.state.panes.panes)
          .map(id => getBucketId(this.$store.state.panes.panes[id].markets))
          .filter((v, i, a) => a.indexOf(v) === i).length > 1
      )
    },
    async toggleMarkets(markets) {
      const scrollTop = this.$refs.selection.scrollTop

      if (!Array.isArray(markets)) {
        markets = [markets]
      }
      for (const market of markets) {
        this.toggleMarket(market)
      }

      await this.$nextTick()

      this.$refs.input.focus()

      this.$refs.selection.scrollTop = scrollTop
    },
    toggleMarket(market) {
      const index = this.selection.indexOf(market)

      if (index === -1) {
        this.selection.push(market)
        this.cacheSelectedProducts(market)
      } else {
        this.selection.splice(index, 1)
        this.cacheSelectedProducts(market, true)
      }
    },
    async submit() {
      if (!this.selectedPaneId) {
        if (
          this.hasMultipleMarketsConfigurations() &&
          !(await dialogService.confirm(
            `Override the other panes market filters`
          ))
        ) {
          return
        }

        this.isLoading = true

        if (!Object.keys(this.$store.state.panes.panes).length) {
          await this.$store.dispatch('panes/addPane', { type: 'trades' })
        }

        await this.$store.dispatch('panes/setMarketsForAll', this.selection)
      } else {
        this.isLoading = true

        this.$store.dispatch('panes/setMarketsForPane', {
          id: this.selectedPaneId,
          markets: this.selection
        })
      }

      this.isLoading = false

      this.hide()
    },
    hide() {
      this.$store.dispatch('app/hideSearch')
    },
    toggleExchange(event, id) {
      if (event.shiftKey) {
        this.toggleAll(false)

        if (!event.target.checked) {
          event.target.checked = true
        }
      }

      this.$store.commit('settings/TOGGLE_SEARCH_EXCHANGE', id)
    },

    clearSelection() {
      this.selection.splice(0, this.selection.length)

      this.query = ''

      this.$refs.input.focus()

      this.cacheSelectedProducts(null, true)
    },

    copySelection() {
      copyTextToClipboard(this.selection.join(','))

      this.$store.dispatch('app/showNotice', {
        id: 'products-clipboard',
        title: `Copied ${this.selection.length} product(s) to clipboard`
      })
    },

    clearFilters() {
      this.$store.commit('settings/CLEAR_SEARCH_FILTERS')
      this.toggleAll(true)
    },

    onPaste(event) {
      if (document.activeElement) {
        if (document.activeElement.tagName === 'INPUT') {
          return
        }
      }

      const raw = event.clipboardData.getData('text/plain')
      const markets = raw.split(',').filter(a => /^.{3,}:.{4,32}$/.test(a))

      if (!markets.length) {
        return
      }

      this.selection = markets
    },

    onKeydown(event) {
      if (dialogService.isDialogOpened('prompt')) {
        return false
      }

      switch (event.key) {
        case 'Enter':
          event.preventDefault()
          if (this.slicedResults[this.activeIndex]) {
            if (this.searchTypes.normalize) {
              this.toggleMarkets(this.slicedResults[this.activeIndex].markets)
            } else {
              this.toggleMarkets([this.slicedResults[this.activeIndex].id])
            }

            if (this.activeIndex === 0) {
              this.activeIndex = -1
            }
          } else if (this.activeIndex === null || this.activeIndex === -1) {
            this.submit()
          }
          break

        case 'ArrowDown':
        case 'ArrowUp':
          if (this.pagesCount) {
            if (event.key === 'ArrowUp') {
              this.activeIndex = Math.max(-1, this.activeIndex - 1)
            } else {
              if (this.activeIndex === null) {
                this.activeIndex = 0
              } else {
                this.activeIndex = Math.min(
                  this.slicedResults.length - 1,
                  this.activeIndex + 1
                )
              }
            }
          }
          break

        case 'Backspace':
        case 'Delete':
          this.deleteLast()
          break

        case 'c':
          if (
            (event.ctrlKey || event.metaKey) &&
            !window.getSelection().toString().length
          ) {
            this.copySelection()
          }
          break
      }
    },

    deleteLast() {
      if (!this.query.length && this.selection.length) {
        if (this.searchTypes.normalize) {
          const lastPair = Object.keys(this.groupedSelection).pop()
          this.toggleMarkets(this.groupedSelection[lastPair])
        } else {
          this.selection.splice(this.selection.length - 1, 1)
        }
      }
    },

    goPage(i) {
      this.page = i
    },

    addAll() {
      const normalized = this.searchTypes.normalize
      const markets = []

      for (let i = 0; i < this.slicedResults.length; i++) {
        if (normalized) {
          for (const market of this.slicedResults[i].markets) {
            markets.push(market)
          }
        } else {
          markets.push(this.slicedResults[i].id)
        }
      }

      this.toggleMarkets(markets)
    },

    toggleAll(selectAll) {
      if (typeof selectAll !== 'boolean') {
        selectAll = Boolean(!this.allExchangesEnabled)
      }

      this.$set(
        this.$store.state.settings,
        'searchExchanges',
        this.exchanges.reduce((output, id) => {
          output[id] = selectAll ? true : false
          return output
        }, {})
      )
    },

    async refreshExchangeProducts(exchangeId) {
      if (!exchangeId) {
        if (
          await dialogService.confirm(
            `Download all exchange's products ?\n\nThis might take a while.`
          )
        ) {
          for (const exchange of this.exchanges) {
            await this.refreshExchangeProducts(exchange)
          }
        }

        return
      }

      if (this._refreshProductsTimeout) {
        clearTimeout(this._refreshProductsTimeout)
      }

      this.canRefreshProducts = false

      this.$store.dispatch('app/showNotice', {
        id: exchangeId,
        title: `Refreshing ${exchangeId}'s products...`
      })

      await workspacesService.deleteProducts(exchangeId)

      const count = (
        await indexProducts(
          exchangeId,
          await getExchangeSymbols(exchangeId, true)
        )
      ).length

      this.$store.dispatch('app/showNotice', {
        id: exchangeId,
        title: `Saved ${count} ${exchangeId}'s products`
      })

      await this.$store.dispatch('exchanges/disconnect', exchangeId)
      await this.$store.dispatch('exchanges/connect', exchangeId)

      this._refreshProductsTimeout = setTimeout(() => {
        this._refreshProductsTimeout = null
        this.canRefreshProducts = true
      }, 10000)

      this.cacheProducts()
    },

    cacheProducts() {
      flattenedProducts = Array.prototype.concat(
        ...Object.values(indexedProducts)
      )

      this.cacheSelectedProducts()

      this.selection = [...this.selection]
      this.cacheTimestamp = Date.now()
    },

    cacheSelectedProducts(id, clear = false) {
      for (const market of this.selection) {
        if (id && market !== id) {
          continue
        }

        if (clear) {
          delete selectedProducts[market]
          continue
        }

        const [exchange] = parseMarket(market)
        const index = indexedProducts[exchange]
        if (!index) {
          continue
        }

        const product = index.find(
          product => product.id === market
        )
        selectedProducts[market] = product

        if (id) {
          break
        }
      }
    },
    getNoResultsMessage() {
      const options = [
        "Oops! Looks like the market's playing hide and seek. <button>Try searching again</button>! 🐮🐻💰",
        'Bulls and bears are puzzled! No coins found.',
        "The market's taking a breather. <button>Try another search</button>!",
        "Even our bullish friend couldn't find that coin!",
        'Bear with us! No coins matched your search.',
        "Lost in the crypto maze? <button>Let's search again</button>!",
        'Coins in limbo! Adjust your filters or <button>try a new term</button>.',
        "Our bear's got the blues, no results found!",
        'Tales of the missing coins! <button>Refine your search</button>.',
        'Crypto hideout! Nothing turned up, <button>try again</button>.',
        "Coins playing hard to get? <button>Let's give it another shot</button>!"
      ]

      return options[Math.floor(Math.random() * options.length)]
    }
  }
}
</script>
<style lang="scss" scoped>
.search-dialog {
  ::v-deep .dialog__content {
    .dialog__body {
      padding: 0;
      flex-direction: row;
      align-items: stretch;
      overflow: hidden;
    }
  }

  &__side {
    width: 13.5rem;
    overflow-y: auto;
    border-right: 1px solid var(--theme-background-150);
    flex-shrink: 0;

    .dialog--small & {
      display: none;

      &.-show {
        display: block;
      }
    }

    &-toggle {
      .dialog:not(.dialog--small) & {
        display: none;
      }
    }
  }

  &__wrapper {
    flex-grow: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
    background-color: var(--theme-base-o25);
    position: relative;
  }

  &__results {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    min-height: 1px;
    position: relative;
    overflow: auto;

    table {
      border: 0;
      border-collapse: collapse;
      margin: 0;
      width: 100%;
    }

    tr {
      color: var(--theme-color-300);

      + tr > td {
        border-top: 1px solid var(--theme-background-100);
      }

      &:hover {
        background-color: transparent;
      }

      &.-active,
      &:hover {
        color: var(--theme-color-base);

        .search-dialog__exchange-logo {
          color: var(--theme-color-200);
        }
      }

      &.-active {
        background-color: var(--theme-background-100);
      }
    }

    td {
      padding: 0.5rem;
      line-height: 1;
      white-space: nowrap;
    }

    &-footer {
      position: sticky;
      bottom: 0;
      backdrop-filter: blur(0.25rem);
      background-color: var(--theme-background-o75);
      position: sticky;
      border-top: 1px solid var(--theme-background-150);
      align-items: center;
      padding: 0.5rem;
      gap: 0.25rem;
      margin-top: auto;

      &-page {
        opacity: 0.5;
        width: 1.75rem;
        justify-content: center;

        &.-active,
        &:hover {
          opacity: 1;
          background-color: var(--theme-background-150) !important;
        }
      }
    }

    &-empty {
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      font-size: 1.125rem;
      flex-grow: 1;
      gap: 1rem;
      max-height: 100%;
      position: relative;
      background-color: var(--theme-background-50);
      background-blend-mode: lighten;
      background-size: cover;
      background-position: center center;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 0;

      #app.-light & {
        background-blend-mode: darken;
      }

      p {
        max-width: 75%;
        text-align: center;
        margin: 0;
      }

      ::v-deep button {
        text-decoration: underline;
        cursor: pointer;
      }
    }
  }

  &__tags {
    &-item {
      padding: 0.25rem;

      .dialog--small & {
        padding: 0.125rem;
      }

      .dialog--large & {
        padding: 0.375rem;
      }
    }

    &-delete {
      position: absolute;
      top: 0;
      right: 0;
      margin: 0.375rem;
      z-index: 2;

      .dialog--small & {
        margin: 0.25rem;
      }

      .dialog--large & {
        margin: 0.5rem;
      }
    }

    input {
      border: 0;
      background: 0;
      color: inherit;
      font-family: inherit;
      padding: 0.25rem;
      flex-grow: 1;
      font-size: 1rem;
    }
  }

  &-selection {
    position: relative;
    min-width: 19rem;
    border: 0;
    max-height: 33%;
    overflow: auto;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: flex-start;
    justify-content: flex-start;
    flex-shrink: 0;
    padding-right: 1.5rem;

    &.-sticky {
      @media screen and (min-width: 550px) {
        backdrop-filter: blur(0.25rem);
        background-color: var(--theme-background-o75);
        border-bottom: 1px solid var(--theme-background-150);
        position: sticky;
        top: 0;
        z-index: 2;
        border-radius: 0;
      }
    }

    &__controls {
      position: absolute;
      top: 0;
      right: 0;
      display: flex;
      gap: 0.25rem;
      padding: 0.25rem;
    }
  }

  &__group-count {
    width: 2rem;
    display: inline-flex;
    justify-content: center;

    .badge {
      font-weight: 400;
      text-align: center;
      color: var(--theme-color-base);
      font-size: 1rem;
      line-height: 0;
      margin: 0;
    }
  }

  &__exchange-logo {
    font-size: 1rem;
    color: var(--theme-background-300);
  }

  .checkbox-control {
    a {
      visibility: hidden;
    }

    &:hover a {
      visibility: visible;
    }
  }
}
</style>
