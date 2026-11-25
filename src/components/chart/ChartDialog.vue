<template>
  <Dialog
    @clickOutside="close"
    class="pane-dialog"
    :size="tab === 'sources' ? 'wide' : 'medium'"
  >
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
            title="Default candle width, back to the latest candle"
            v-tippy
            @click="resetZoom"
          >
            Reset to {{ defaultZoom }}x
          </button>
        </label>
        <slider
          class="mt8"
          :min="minZoom"
          :max="maxZoom"
          :step="0.5"
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
    <chart-alerts v-else :pane-id="paneId" />
  </Dialog>
</template>

<script>
import DialogMixin from '../../mixins/dialogMixin'
import PaneDialogMixin from '../../mixins/paneDialogMixin'
import ChartAlerts from './ChartAlerts.vue'
import ChartIndicatorsSettings from './ChartIndicatorsSettings.vue'
import Slider from '@/components/framework/picker/Slider.vue'
import paneActions from '@/utils/paneActions'
import {
  DEFAULT_BAR_SPACING,
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM
} from './options'

export default {
  components: { ChartAlerts, ChartIndicatorsSettings, Slider },
  mixins: [DialogMixin, PaneDialogMixin],
  data: () => ({
    defaultZoom: DEFAULT_ZOOM,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM
  }),
  computed: {
    // candle width relative to DEFAULT_BAR_SPACING (1x)
    zoom() {
      const barSpacing = this.$store.state[this.paneId].barSpacing

      return barSpacing ? barSpacing / DEFAULT_BAR_SPACING : DEFAULT_ZOOM
    },
    zoomLabel() {
      return Math.round(this.zoom * 10) / 10 + 'x'
    }
  },
  methods: {
    setZoom(zoom) {
      paneActions.emit('zoom', this.paneId, { zoom })
    },
    resetZoom() {
      paneActions.emit('zoom', this.paneId, {
        zoom: DEFAULT_ZOOM,
        scrollToLatest: true
      })
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
