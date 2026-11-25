<template>
  <div class="pane-sources">
    <div class="pane-sources__header">
      <span class="pane-sources__count">{{ label }}</span>
      <template v-if="canHide && markets.length">
        <button type="button" class="btn -text" @click="toggleType('spot')">
          spot
        </button>
        <button type="button" class="btn -text" @click="toggleType('perp')">
          perp
        </button>
        <button type="button" class="btn -text" @click="toggleType('all')">
          all
        </button>
      </template>
      <button type="button" class="btn -green mlauto" @click="addMarkets">
        <i class="icon-plus"></i>
        <span class="ml8">Add markets</span>
      </button>
    </div>

    <p v-if="!markets.length" class="text-color-50">No markets yet.</p>

    <div v-else class="pane-sources__grid">
      <button
        v-for="group of groups"
        :key="group.exchange"
        type="button"
        class="pane-sources__tile"
        :class="{
          '-hidden': group.visible === 0,
          '-active': selectedExchange === group.exchange && dropdownTrigger
        }"
        @click="openExchange(group.exchange, $event)"
      >
        <i class="pane-sources__logo" :class="'icon-' + group.exchange"></i>
        <span class="pane-sources__name">{{ group.name }}</span>
        <span class="pane-sources__badge">{{
          canHide && group.visible !== group.markets.length
            ? group.visible + '/' + group.markets.length
            : group.markets.length
        }}</span>
      </button>
    </div>

    <dropdown v-model="dropdownTrigger" interactive>
      <div v-if="selectedGroup" class="pane-sources__detail">
        <div class="pane-sources__detail-title">
          <i :class="'icon-' + selectedGroup.exchange"></i>
          <span>{{ selectedGroup.name }}</span>
        </div>
        <div
          v-for="market of selectedGroup.markets"
          :key="market.id"
          class="pane-sources__market"
        >
          <label
            v-if="canHide"
            class="checkbox-control -small"
            title="Show / hide (hold shift to show only this one)"
            v-tippy
            @click.prevent="toggleMarket($event, market.id)"
          >
            <input
              type="checkbox"
              class="form-control"
              :checked="!hiddenMarkets[market.id]"
            />
            <div></div>
            <span>{{ market.pair }}</span>
          </label>
          <span v-else>{{ market.pair }}</span>
          <small v-if="market.type" class="pane-sources__type">{{
            market.type
          }}</small>
          <button
            type="button"
            class="btn -text -small"
            title="Remove"
            v-tippy
            @click="removeMarkets([market.id])"
          >
            <i class="icon-cross"></i>
          </button>
        </div>
        <button
          type="button"
          class="btn -text -small text-danger mt8"
          @click="removeExchange"
        >
          <i class="icon-trash"></i>
          <span class="ml8">Remove {{ selectedGroup.name }}</span>
        </button>
      </div>
    </dropdown>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { getMarketProduct, parseMarket } from '@/services/productsService'

interface ExchangeGroup {
  exchange: string
  name: string
  markets: { id: string; pair: string; type: string }[]
  visible: number
}

/**
 * "Sources" tab shared by pane settings dialogs: the pane's markets as a grid
 * of exchanges (tap one to show / hide (charts) or remove its markets) and
 * add (opens market search)
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
  selectedExchange: string = null
  dropdownTrigger: HTMLElement = null

  get markets(): string[] {
    return this.$store.state.panes.panes[this.paneId].markets
  }

  // charts can hide markets without removing them
  get canHide() {
    return this.$store.state.panes.panes[this.paneId].type === 'chart'
  }

  get hiddenMarkets() {
    return (this.canHide && this.$store.state[this.paneId].hiddenMarkets) || {}
  }

  get groups(): ExchangeGroup[] {
    const groups: { [exchange: string]: ExchangeGroup } = {}

    for (const id of this.markets) {
      const [exchange, pair] = parseMarket(id)

      if (!groups[exchange]) {
        groups[exchange] = {
          exchange,
          name: exchange.replace(/_/g, ' '),
          markets: [],
          visible: 0
        }
      }

      const product = getMarketProduct(exchange, pair)

      groups[exchange].markets.push({
        id,
        pair: pair.toUpperCase(),
        type: product ? product.type : null
      })

      if (!this.hiddenMarkets[id]) {
        groups[exchange].visible++
      }
    }

    return Object.values(groups)
  }

  get selectedGroup() {
    return this.groups.find(group => group.exchange === this.selectedExchange)
  }

  get label() {
    const count = this.canHide
      ? this.markets.filter(market => !this.hiddenMarkets[market]).length
      : this.markets.length
    const exchanges = this.groups.length

    return `${count} market${count === 1 ? '' : 's'}${
      this.canHide && count !== this.markets.length
        ? ` (of ${this.markets.length})`
        : ''
    } · ${exchanges} exchange${exchanges === 1 ? '' : 's'}`
  }

  openExchange(exchange: string, event: MouseEvent) {
    if (this.dropdownTrigger && this.selectedExchange === exchange) {
      this.dropdownTrigger = null
      return
    }

    this.selectedExchange = exchange
    this.dropdownTrigger = event.currentTarget as HTMLElement
  }

  toggleMarket(event: MouseEvent, market: string) {
    this.$store.dispatch(this.paneId + '/toggleMarkets', {
      id: market,
      inverse: event.shiftKey
    })
  }

  toggleType(type: string) {
    this.$store.dispatch(this.paneId + '/toggleMarkets', { type })
  }

  removeMarkets(markets: string[]) {
    this.$store.dispatch('panes/setMarketsForPane', {
      id: this.paneId,
      markets: this.markets.filter(a => markets.indexOf(a) === -1)
    })

    if (!this.selectedGroup || !this.selectedGroup.markets.length) {
      this.dropdownTrigger = null
    }
  }

  removeExchange() {
    const markets = this.selectedGroup.markets.map(market => market.id)

    this.dropdownTrigger = null
    this.removeMarkets(markets)
  }

  addMarkets() {
    this.$store.dispatch('app/showSearch', { paneId: this.paneId })
  }
}
</script>

<style lang="scss" scoped>
.pane-sources {
  &__header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
  }

  &__count {
    margin-right: 0.5rem;
    opacity: 0.75;
    white-space: nowrap;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
    gap: 0.5rem;
  }

  &__tile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    min-width: 0;
    padding: 0.75rem 0.375rem 0.625rem;
    border: 1px solid transparent;
    border-radius: 0.375rem;
    background-color: var(--theme-background-150);
    color: var(--theme-color-base);
    font: inherit;
    cursor: pointer;
    transition:
      background-color 0.2s $ease-out-expo,
      opacity 0.2s $ease-out-expo;

    &:hover,
    &.-active {
      background-color: var(--theme-background-200);
    }

    &.-active {
      border-color: var(--theme-accent-base);
    }

    &.-hidden {
      opacity: 0.4;
    }
  }

  &__logo {
    font-size: 1.5rem;
    line-height: 1;
  }

  &__name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.75rem;
  }

  &__badge {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    min-width: 1.25rem;
    padding: 0.125rem 0.25rem;
    border-radius: 0.625rem;
    background-color: var(--theme-accent-base);
    color: var(--theme-accent-color);
    font-size: 0.6875rem;
    line-height: 1;
    text-align: center;
  }

  &__detail {
    min-width: 14rem;
    padding: 0.5rem 0.75rem;
  }

  &__detail-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  &__market {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2rem;
    font-family: $font-monospace;
    font-size: 0.875em;

    > label,
    > span {
      flex-grow: 1;
    }
  }

  &__type {
    opacity: 0.5;
    font-family: inherit;
    text-transform: uppercase;
  }
}
</style>
