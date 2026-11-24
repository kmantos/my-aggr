<template>
  <div class="settings-chart">
    <div class="form-group mb16">
      <label>
        Refresh chart every
        <code v-text="refreshRateHms" class="text-color-base"></code>
      </label>

      <slider
        :min="0"
        :max="10000"
        :step="100"
        :show-completion="true"
        class="mt8"
        :value="refreshRate"
        @input="$store.commit(paneId + '/SET_REFRESH_RATE', $event)"
        @reset="$store.commit(paneId + '/SET_REFRESH_RATE', 500)"
      ></slider>
    </div>
    <p v-if="refreshRate < 500" class="form-feedback">
      <i class="icon-warning"></i> Low refresh rate can be <u>very</u> CPU
      intensive
    </p>
    <div class="form-group mb8">
      <label class="checkbox-control">
        <input
          type="checkbox"
          class="form-control"
          :checked="showCountdown"
          @change="$store.commit(paneId + '/TOGGLE_COUNTDOWN')"
        />
        <div></div>
        <span
          class="-inline"
          title="Time left before the candle closes (or progress for tick, volume and bps bars), under the price label"
          v-tippy
          >Show candle countdown</span
        >
      </label>
    </div>
    <div class="divider" />
    <AlertsSettings />
  </div>
</template>

<script lang="ts">
import { getHms } from '@/utils/helpers'
import { Component, Vue } from 'vue-property-decorator'
import Slider from '@/components/framework/picker/Slider.vue'
import ToggableGroup from '@/components/framework/ToggableGroup.vue'
import DropdownButton from '@/components/framework/DropdownButton.vue'
import AlertsSettings from '@/components/alerts/AlertsSettings.vue'

@Component({
  components: {
    AlertsSettings,
    Slider,
    ToggableGroup,
    DropdownButton
  },
  name: 'ChartSettings',
  props: {
    paneId: {
      type: String,
      required: true
    }
  }
})
export default class ChartSettings extends Vue {
  paneId: string

  get showCountdown() {
    return this.$store.state[this.paneId].showCountdown
  }

  get refreshRate() {
    return this.$store.state[this.paneId].refreshRate
  }

  get refreshRateHms() {
    return getHms(this.refreshRate)
  }
}
</script>
