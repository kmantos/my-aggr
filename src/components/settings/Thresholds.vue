<template>
  <div class="thresholds">
    <table class="table thresholds-table">
      <transition-group name="flip-list" tag="tbody">
        <tr v-for="(threshold, index) in thresholds" :key="threshold.id">
          <td class="table-input table-min">
            <label
              class="checkbox-control -extra-small mb4"
              v-if="index === thresholds.length - 1"
              title="Set as maximum amount"
              v-tippy
            >
              <input
                type="checkbox"
                class="form-control"
                :checked="capToLastThreshold"
                @change="toggleMaximumThreshold(threshold)"
              />
              <div></div>
            </label>
          </td>
          <td class="table-input">
            <div class="thresholds-table__threshold">
              <i class="icon icon-currency"></i>
              <editable
                placeholder="Amount*"
                class="w-100"
                :value="formatAmount(threshold.amount)"
                @input="
                  $store.commit(paneId + '/SET_THRESHOLD_AMOUNT', {
                    id: threshold.id,
                    value: $event
                  })
                "
              />
              <small
                class="text-danger"
                v-if="index === thresholds.length - 1 && threshold.max"
                title="Will only show trades below that amount"
              >
                <strong>MAX</strong>
              </small>
            </div>
          </td>
          <td class="table-action">
            <color-picker-control
              label="Buy color"
              :value="threshold.buyColor"
              @input="
                $store.commit(paneId + '/SET_THRESHOLD_COLOR', {
                  id: threshold.id,
                  side: 'buyColor',
                  value: $event
                })
              "
            ></color-picker-control>
          </td>
          <td class="table-action">
            <color-picker-control
              label="Sell color"
              :value="threshold.sellColor"
              @input="
                $store.commit(paneId + '/SET_THRESHOLD_COLOR', {
                  id: threshold.id,
                  side: 'sellColor',
                  value: $event
                })
              "
            ></color-picker-control>
          </td>
          <td
            v-if="useAudio"
            class="thresholds-table__audio table-action"
            @click="openThresholdAudio(threshold.id)"
            title="Configure threshold audio"
            v-tippy
          >
            <button class="btn -text"><i class="icon-music-note"></i></button>
          </td>
          <td
            class="table-action"
            @click="selectThreshold(threshold.id, $event)"
          >
            <button class="btn -text">
              <i class="icon-more"></i>
            </button>
          </td>
        </tr>
      </transition-group>
    </table>

    <div class="d-flex mt8">
      <button
        type="button"
        class="btn -nowrap -text -start mlauto"
        v-tippy
        title="Add a threshold"
        @click="$store.commit(paneId + '/ADD_THRESHOLD', type)"
      >
        <i class="icon-plus"></i>
      </button>
    </div>
    <dropdown v-model="thresholdPanelTrigger" interactive>
      <threshold-dropdown
        :threshold="selectedThreshold"
        :pane-id="paneId"
        :can-delete="thresholds.length > 2"
        @input="thresholdPanelTrigger = $event"
      />
    </dropdown>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import { formatAmount } from '@/services/productsService'

import dialogService from '@/services/dialogService'
import ThresholdAudioDialog from '../trades/audio/ThresholdAudioDialog.vue'
import ColorPickerControl from '../framework/picker/ColorPickerControl.vue'
import { Threshold } from '@/store/panesSettings/trades'
import ThresholdDropdown from './ThresholdDropdown.vue'

@Component({
  name: 'Thresholds',
  components: {
    ColorPickerControl,
    ThresholdDropdown
  },
  props: {
    paneId: {
      type: String,
      required: true
    },
    label: {
      type: String,
      default: null
    },
    thresholds: {
      required: true
    },
    type: {
      type: String,
      default: 'thresholds'
    }
  }
})
export default class Thresholds extends Vue {
  paneId: string
  thresholds: Threshold[]
  type: string

  selectedThresholdId = null
  thresholdPanelTrigger = null

  private _onStoreMutation: () => void

  get selectedThreshold() {
    return this.$store.getters[this.paneId + '/getThreshold'](
      this.selectedThresholdId
    )
  }

  get useAudio() {
    return this.$store.state.settings.useAudio
  }

  get capToLastThreshold() {
    return this.thresholds[this.thresholds.length - 1].max
  }

  created() {
    this._onStoreMutation = this.$store.subscribe(mutation => {
      switch (mutation.type) {
        case this.paneId + '/SET_THRESHOLD_AMOUNT':
        case this.paneId + '/DELETE_THRESHOLD':
        case this.paneId + '/ADD_THRESHOLD':
          this.reorderThresholds()
          break
      }
    })
  }

  beforeDestroy() {
    this._onStoreMutation()
  }

  selectThreshold(id, event) {
    if (this.thresholdPanelTrigger && this.selectedThresholdId === id) {
      return
    }

    this.selectedThresholdId = id

    if (this.selectedThresholdId) {
      this.thresholdPanelTrigger = event.target
    }
  }

  reorderThresholds() {
    this.thresholds.sort((a, b) => a.amount - b.amount)
  }

  openThresholdAudio(thresholdId) {
    dialogService.open(ThresholdAudioDialog, {
      paneId: this.paneId,
      thresholds: this.thresholds,
      thresholdId
    })
  }

  formatAmount(amount, precision?) {
    return formatAmount(amount, precision)
  }

  toggleMaximumThreshold(threshold) {
    this.$store.commit(this.paneId + '/TOGGLE_THRESHOLD_MAX', threshold.id)
  }
}
</script>

<style lang="scss">
.thresholds {
  position: relative;
  z-index: 1;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

.thresholds-table {
  &__threshold {
    display: flex;
    align-items: center;
    gap: 0.25rem;

    i {
      color: var(--theme-buy-100);
      top: 0;
    }
  }
}
</style>
