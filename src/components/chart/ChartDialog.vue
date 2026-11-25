<template>
  <Dialog @clickOutside="close" class="pane-dialog" size="medium">
    <template v-slot:header>
      <div class="dialog__title" v-text="name"></div>
      <div class="column -center"></div>
    </template>
    <template v-slot:subheader>
      <tabs :value="tab" @input="tab = $event">
        <tab name="general">General</tab>
        <tab name="sources">Sources</tab>
        <tab name="indicators">Indicators</tab>
        <tab name="alerts">Alerts</tab>
      </tabs>
    </template>
    <pane-general-settings
      v-if="tab === 'general'"
      :pane-id="paneId"
      @close="close"
    >
      <div class="form-group mb16">
        <label class="chart-zoom__label">
          <span>
            Zoom
            <code class="text-color-base" v-text="zoomLabel"></code>
          </span>
          <button
            type="button"
            class="btn -text -small"
            title="Candle width of a new chart, back to the latest candle"
            v-tippy
            @click="resetZoom"
          >
            Reset to 1x
          </button>
        </label>
        <slider
          class="mt8"
          :min="0.1"
          :max="50"
          :step="0.1"
          log
          :value="zoom"
          @input="setZoom"
          @reset="resetZoom"
        ></slider>
      </div>
      <template v-slot:actions>
        <button type="button" class="btn -text" @click="arrange">
          <i class="icon-resize-height"></i>
          <span class="ml8">Arrange price scales</span>
        </button>
        <button type="button" class="btn -text" @click="paneAction('restart')">
          <i class="icon-refresh"></i>
          <span class="ml8">Restart</span>
        </button>
      </template>
    </pane-general-settings>
    <pane-sources v-else-if="tab === 'sources'" :pane-id="paneId" />
    <chart-indicators-settings
      v-else-if="tab === 'indicators'"
      :pane-id="paneId"
    />
    <chart-settings v-else :pane-id="paneId" tab="alerts" />
  </Dialog>
</template>

<script>
import DialogMixin from '../../mixins/dialogMixin'
import PaneDialogMixin from '../../mixins/paneDialogMixin'
import ChartSettings from './ChartSettings.vue'
import ChartIndicatorsSettings from './ChartIndicatorsSettings.vue'
import Slider from '@/components/framework/picker/Slider.vue'
import paneActions from '@/utils/paneActions'
import { DEFAULT_BAR_SPACING } from './options'

export default {
  components: { ChartSettings, ChartIndicatorsSettings, Slider },
  mixins: [DialogMixin, PaneDialogMixin],
  computed: {
    // candle width relative to a new chart's (1x)
    zoom() {
      return (
        (this.$store.state[this.paneId].barSpacing || DEFAULT_BAR_SPACING) /
        DEFAULT_BAR_SPACING
      )
    },
    zoomLabel() {
      const zoom = this.zoom
      return (zoom < 10 ? Math.round(zoom * 10) / 10 : Math.round(zoom)) + 'x'
    }
  },
  methods: {
    setZoom(zoom) {
      paneActions.emit('zoom', this.paneId, { zoom })
    },
    resetZoom() {
      paneActions.emit('zoom', this.paneId, { zoom: 1, scrollToLatest: true })
    },
    arrange() {
      this.$store.commit(this.paneId + '/TOGGLE_LAYOUTING')
      this.close()
    },
    paneAction(name, event) {
      paneActions.emit(name, this.paneId, event)
    }
  }
}
</script>

<style lang="scss" scoped>
.chart-zoom__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
