<template>
  <div class="settings-audio">
    <label class="settings-audio__label">
      Volume
      <code class="text-color-base">{{ volumePercent }}%</code>
    </label>
    <slider
      class="mt8"
      :min="0"
      :max="3"
      :step="0.01"
      :value="audioVolume"
      :tooltip="false"
      @input="$store.dispatch('settings/setAudioVolume', $event)"
      @reset="$store.dispatch('settings/setAudioVolume', 1)"
      log
    ></slider>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import Slider from '../framework/picker/Slider.vue'

/**
 * main volume (every sound), in settings
 */
@Component({
  components: { Slider },
  name: 'AudioSettings'
})
export default class AudioSettings extends Vue {
  get audioVolume() {
    return this.$store.state.settings.audioVolume
  }

  get volumePercent() {
    return Math.round(this.audioVolume * 100)
  }
}
</script>
