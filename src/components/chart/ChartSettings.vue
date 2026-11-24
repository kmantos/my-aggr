<template>
  <div class="settings-chart">
    <template v-if="tab !== 'general'">
      <AlertsSettings />
      <template v-if="alertsEnabled">
        <div class="form-group mb8 mt16">
          <label class="checkbox-control">
            <input
              type="checkbox"
              class="form-control"
              :checked="showAlerts"
              @change="$store.commit(paneId + '/TOGGLE_ALERTS')"
            />
            <div></div>
            <span class="-inline">Show alerts on this chart</span>
          </label>
        </div>
        <div class="form-group mb8">
          <label class="checkbox-control">
            <input
              type="checkbox"
              class="form-control"
              :checked="showAlertsLabel"
              :disabled="!showAlerts"
              @change="$store.commit(paneId + '/TOGGLE_ALERTS_LABEL')"
            />
            <div></div>
            <span class="-inline">Show alert labels</span>
          </label>
        </div>
        <button
          type="button"
          class="btn -text -arrow"
          @click="showAlertsList = !showAlertsList"
        >
          Manage alerts
        </button>
        <alerts-list v-if="showAlertsList" :query="market" class="mt8" />
      </template>
    </template>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import Slider from '@/components/framework/picker/Slider.vue'
import ToggableGroup from '@/components/framework/ToggableGroup.vue'
import DropdownButton from '@/components/framework/DropdownButton.vue'
import AlertsSettings from '@/components/alerts/AlertsSettings.vue'
import AlertsList from '@/components/alerts/AlertsList.vue'
import { stripStablePair } from '@/services/productsService'

@Component({
  components: {
    AlertsSettings,
    AlertsList,
    Slider,
    ToggableGroup,
    DropdownButton
  },
  name: 'ChartSettings',
  props: {
    paneId: {
      type: String,
      required: true
    },
    // only show one tab of the pane dialog (general / alerts)
    tab: {
      type: String,
      default: null
    }
  }
})
export default class ChartSettings extends Vue {
  paneId: string
  tab: string
  showAlertsList = false

  get alertsEnabled() {
    return this.$store.state.settings.alerts
  }

  get showAlerts() {
    return this.$store.state[this.paneId].showAlerts
  }

  get showAlertsLabel() {
    return this.$store.state[this.paneId].showAlertsLabel
  }

  // alerts are stored by local pair (ex: BTCUSD), same as the chart's main index
  get market() {
    const markets: string[] = this.$store.state.panes.panes[this.paneId].markets
    const listeners = this.$store.state.panes.marketsListeners

    for (const marketKey of markets) {
      if (listeners[marketKey]) {
        return stripStablePair(listeners[marketKey].local)
      }
    }

    return ''
  }
}
</script>
