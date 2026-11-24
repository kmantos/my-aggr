<template>
  <div class="settings-charts">
    <div class="form-group mb16">
      <label>
        Refresh charts every
        <code v-text="refreshRateHms" class="text-color-base"></code>
      </label>
      <slider
        :min="0"
        :max="10000"
        :step="100"
        :show-completion="true"
        class="mt8"
        :value="refreshRate"
        @input="$store.commit('settings/SET_CHART_REFRESH_RATE', $event)"
        @reset="$store.commit('settings/SET_CHART_REFRESH_RATE', 1000)"
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
          @change="$store.commit('settings/TOGGLE_COUNTDOWN')"
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
    <div class="form-group mb8">
      <label class="checkbox-control">
        <input
          type="checkbox"
          class="form-control"
          :checked="flipCharts"
          @change="$store.commit('settings/TOGGLE_CHART_FLIP')"
        />
        <div></div>
        <span class="-inline" title="Turn the price scale upside down" v-tippy
          >Flip</span
        >
      </label>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import Slider from '@/components/framework/picker/Slider.vue'
import { getHms } from '@/utils/helpers'

/**
 * chart options shared by every chart (main settings > Charts)
 */
@Component({
  name: 'ChartsSettings',
  components: {
    Slider
  }
})
export default class ChartsSettings extends Vue {
  get refreshRate() {
    return this.$store.state.settings.chartRefreshRate
  }

  get refreshRateHms() {
    return getHms(this.refreshRate)
  }

  get showCountdown() {
    return this.$store.state.settings.showCountdown
  }

  get flipCharts() {
    return this.$store.state.settings.flipCharts
  }
}
</script>
