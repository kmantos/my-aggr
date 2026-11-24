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

    <div v-for="market of markets" :key="market" class="pane-sources__market">
      <label
        v-if="canHide"
        class="checkbox-control -small"
        title="Show / hide (hold shift to show only this one)"
        v-tippy
        @click.prevent="toggleMarket($event, market)"
      >
        <input
          type="checkbox"
          class="form-control"
          :checked="!hiddenMarkets[market]"
        />
        <div></div>
        <span>{{ market }}</span>
      </label>
      <span v-else>{{ market }}</span>
      <button
        type="button"
        class="btn -text -small mlauto"
        title="Remove"
        v-tippy
        @click="removeMarket(market)"
      >
        <i class="icon-cross"></i>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'

/**
 * "Sources" tab shared by pane settings dialogs: the pane's markets
 * (with show / hide for charts), remove and add (opens market search)
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

  get label() {
    const count = this.canHide
      ? this.markets.filter(market => !this.hiddenMarkets[market]).length
      : this.markets.length

    return `${count} market${count === 1 ? '' : 's'}${
      this.canHide && count !== this.markets.length
        ? ` (of ${this.markets.length})`
        : ''
    }`
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

  removeMarket(market: string) {
    this.$store.dispatch('panes/setMarketsForPane', {
      id: this.paneId,
      markets: this.markets.filter(a => a !== market)
    })
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

  &__market {
    display: flex;
    align-items: center;
    min-height: 2rem;
    font-family: $font-monospace;
    font-size: 0.875em;

    &:hover {
      background-color: var(--theme-background-150);
    }
  }
}
</style>
