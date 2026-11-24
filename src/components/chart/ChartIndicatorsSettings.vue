<template>
  <div class="chart-indicators-settings">
    <div class="chart-indicators-settings__header">
      <span class="chart-indicators-settings__count">{{ label }}</span>
      <button type="button" class="btn -green mlauto" @click="addIndicator">
        <i class="icon-plus"></i>
        <span class="ml8">Add indicator</span>
      </button>
    </div>

    <p v-if="!order.length" class="text-color-50">No indicators yet.</p>

    <div
      v-for="(id, index) of order"
      :key="id"
      class="chart-indicators-settings__indicator"
      :class="{ '-error': !!errors[id] }"
    >
      <label class="checkbox-control -small" :title="errors[id]" v-tippy>
        <input
          type="checkbox"
          class="form-control"
          :checked="isVisible(id)"
          @change="$store.dispatch(paneId + '/toggleSerieVisibility', id)"
        />
        <div></div>
        <span>
          <i v-if="errors[id]" class="icon-warning mr4"></i>
          {{ getName(id) }}
        </span>
      </label>
      <div class="chart-indicators-settings__controls">
        <button
          type="button"
          class="btn -text -small"
          title="Move up"
          v-tippy
          :disabled="index === 0"
          @click="move(id, index - 1)"
        >
          <i class="icon-up-thin"></i>
        </button>
        <button
          type="button"
          class="btn -text -small"
          title="Move down"
          v-tippy
          :disabled="index === order.length - 1"
          @click="move(id, index + 1)"
        >
          <i class="icon-down-thin"></i>
        </button>
        <button
          type="button"
          class="btn -text -small"
          title="Edit"
          v-tippy
          @click="editIndicator(id)"
        >
          <i class="icon-edit"></i>
        </button>
        <button
          type="button"
          class="btn -text -small"
          title="Remove"
          v-tippy
          @click="removeIndicator(id)"
        >
          <i class="icon-cross"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import dialogService from '@/services/dialogService'
import { ChartPaneState } from '@/store/panesSettings/chart'

/**
 * "Indicators" tab of the chart settings dialog
 */
@Component({
  name: 'ChartIndicatorsSettings',
  props: {
    paneId: {
      type: String,
      required: true
    }
  }
})
export default class ChartIndicatorsSettings extends Vue {
  paneId: string

  get paneState() {
    return this.$store.state[this.paneId] as ChartPaneState
  }

  get order(): string[] {
    const ids = Object.keys(this.paneState.indicators)
    const order = (this.paneState.indicatorOrder || []).filter(
      id => ids.indexOf(id) !== -1
    )

    return order.concat(ids.filter(id => order.indexOf(id) === -1))
  }

  get errors() {
    return this.paneState.indicatorsErrors || {}
  }

  get label() {
    const count = this.order.length

    return `${count} indicator${count === 1 ? '' : 's'}`
  }

  getName(id: string) {
    const indicator = this.paneState.indicators[id]

    return indicator.displayName || indicator.name || id
  }

  isVisible(id: string) {
    const options = this.paneState.indicators[id].options

    return !options || options.visible !== false
  }

  move(id: string, position: number) {
    this.$store.commit(this.paneId + '/UPDATE_INDICATOR_ORDER', {
      id,
      position
    })
  }

  async editIndicator(id: string) {
    dialogService.open(
      (await import('@/components/indicators/IndicatorDialog.vue')).default,
      { paneId: this.paneId, indicatorId: id },
      'indicator'
    )
  }

  removeIndicator(id: string) {
    this.$store.dispatch(this.paneId + '/removeIndicator', { id })
  }

  async addIndicator() {
    // the indicator library adds to the focused pane
    this.$store.commit('app/SET_FOCUSED_PANE', this.paneId)

    dialogService.open(
      (await import('@/components/indicators/IndicatorLibraryDialog.vue'))
        .default,
      {},
      'indicator-library'
    )
  }
}
</script>

<style lang="scss" scoped>
.chart-indicators-settings {
  &__header {
    display: flex;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  &__count {
    opacity: 0.75;
  }

  &__indicator {
    display: flex;
    align-items: center;
    min-height: 2rem;

    &:hover {
      background-color: var(--theme-background-150);
    }

    &.-error {
      color: $red;
    }
  }

  &__controls {
    margin-left: auto;
    display: flex;
  }
}
</style>
