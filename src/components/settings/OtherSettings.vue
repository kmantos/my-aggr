<template>
  <div>
    <div class="form-group mb8">
      <label class="checkbox-control">
        <input
          type="checkbox"
          class="form-control"
          :checked="autoHideHeaders"
          @change="$store.commit('settings/TOGGLE_AUTO_HIDE_HEADERS')"
        />
        <div></div>
        <span>Floating headers</span>
      </label>
    </div>
    <transition-height :duration="5000">
      <div v-if="autoHideHeaders" key="a" class="form-group mb8">
        <label class="checkbox-control">
          <input
            type="checkbox"
            class="form-control"
            :checked="autoHideNames"
            @change="$store.commit('settings/TOGGLE_AUTO_HIDE_NAMES')"
          />
          <div></div>
          <span>Auto hide names</span>
        </label>
      </div>
    </transition-height>
    <div class="form-group mb8">
      <label class="checkbox-control -animations">
        <input
          type="checkbox"
          class="form-control"
          :checked="locked"
          @change="$store.commit('panes/TOGGLE_LAYOUT')"
        />
        <div></div>
        <span>
          {{ locked ? 'Layout is locked 🔒' : 'Layout is unlocked' }}
        </span>
      </label>
    </div>
    <div class="form-group mb8">
      <label class="checkbox-control flex-left">
        <input
          type="checkbox"
          class="form-control"
          :checked="!!timezoneOffset"
          @change="
            $store.commit(
              'settings/SET_TIMEZONE_OFFSET',
              !timezoneOffset ? new Date().getTimezoneOffset() * 60000 * -1 : 0
            )
          "
        />
        <div></div>
        <span>Use local time for charts</span>
      </label>
    </div>
    <div class="form-group mb8">
      <label class="checkbox-control flex-left">
        <input
          type="checkbox"
          class="form-control"
          :checked="showResolution"
          @change="$store.commit('settings/TOGGLE_RESOLUTION')"
        />
        <div></div>
        <span>Show screen resolution</span>
      </label>
    </div>
    <div class="form-group mb8">
      <label class="checkbox-control flex-left">
        <input
          type="checkbox"
          class="form-control"
          :checked="pauseTradesOnHover"
          @change="$store.commit('settings/TOGGLE_PAUSE_TRADES_ON_HOVER')"
        />
        <div></div>
        <span>Pause trades when hovering</span>
      </label>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import TransitionHeight from '@/components/framework/TransitionHeight.vue'

@Component({
  name: 'OtherSettings',
  components: {
    TransitionHeight
  }
})
export default class OtherSettings extends Vue {
  get autoHideHeaders() {
    return this.$store.state.settings.autoHideHeaders
  }

  get autoHideNames() {
    return this.$store.state.settings.autoHideNames
  }

  get locked() {
    return this.$store.state.panes.locked
  }

  get timezoneOffset() {
    return this.$store.state.settings.timezoneOffset
  }

  get pauseTradesOnHover() {
    return this.$store.state.settings.pauseTradesOnHover
  }

  get showResolution() {
    return this.$store.state.settings.showResolution
  }
}
</script>
