<template>
  <div>
    <ToggableSection
      v-if="!tab || tab === 'thresholds'"
      :auto-open="!!tab"
      class="thresholds"
      title="Thresholds"
      id="trades-thresholds"
      :badge="thresholds.length"
      :disabled="!showTrades"
      inset
    >
      <template #title>
        <label class="checkbox-control -small mr0" @click.stop>
          <input
            type="checkbox"
            class="form-control"
            :checked="showTrades"
            @change="$store.commit(paneId + '/TOGGLE_PREFERENCE', 'showTrades')"
          />
          <div></div>
        </label>
        <div class="toggable-section__title ml16">Trades</div>
        <span class="badge -outline ml8 mrauto">{{ thresholds.length }}</span>
        <ThresholdColor :pane-id="paneId" type="thresholds" side="buy" />
        <ThresholdColor :pane-id="paneId" type="thresholds" side="sell" />
      </template>
      <div class="form-group">
        <thresholds
          :paneId="paneId"
          :thresholds="thresholds"
          label="Trades"
          type="thresholds"
        />
      </div>

      <div v-if="displayGifWarning" class="d-flex help-text">
        <p class="mt0 mb0 text-success">
          <i class="icon-info mr8"></i>
          <a
            href="javascript:void(0);"
            @click="$store.commit('settings/TOGGLE_ANIMATIONS')"
            >Enable animations to show gifs</a
          >
        </p>
      </div>
    </ToggableSection>
    <ToggableSection
      v-if="!tab || tab === 'thresholds'"
      :auto-open="!!tab"
      class="thresholds"
      id="trades-liquidations"
      :badge="liquidations.length"
      :disabled="!showLiquidations"
      inset
    >
      <template #title>
        <label class="checkbox-control -small mr0" @click.stop>
          <input
            type="checkbox"
            class="form-control"
            :checked="showLiquidations"
            @change="
              $store.commit(paneId + '/TOGGLE_PREFERENCE', 'showLiquidations')
            "
            @click.stop
          />
          <div></div>
        </label>
        <div class="toggable-section__title ml16">Liquidations</div>
        <span class="badge -outline ml8 mrauto">{{ liquidations.length }}</span>
        <ThresholdColor :pane-id="paneId" type="liquidations" side="buy" />
        <ThresholdColor :pane-id="paneId" type="liquidations" side="sell" />
      </template>
      <div class="form-group">
        <thresholds
          :paneId="paneId"
          :thresholds="liquidations"
          label="Liquidations"
          type="liquidations"
        />
      </div>

      <div v-if="displayGifWarning" class="d-flex help-text">
        <p class="mt0 mb0 text-success">
          <i class="icon-info mr8"></i>
          <a
            href="javascript:void(0);"
            @click="$store.commit('settings/TOGGLE_ANIMATIONS')"
            >Enable animations to show gifs</a
          >
        </p>
      </div>
    </ToggableSection>

    <ToggableSection
      v-if="!tab || tab === 'audio'"
      :auto-open="!!tab"
      title="Audio"
      id="trades-audio"
      inset
    >
      <div class="column mb16">
        <div class="form-group text-nowrap">
          <label class="checkbox-control">
            <input
              type="checkbox"
              class="form-control"
              :disabled="!useAudio"
              :checked="muted"
              @change="$store.commit(paneId + '/TOGGLE_MUTED')"
            />
            <div></div>
            <span>Mute pane</span>
          </label>
        </div>
        <div class="-fill ml16">
          <label class="mt8 d-block text-color-base">Pane volume</label>
          <div class="column">
            <slider
              class="mrauto -fill mt8 mb8"
              :min="0"
              :max="400"
              :step="1"
              :label="true"
              :disabled="muted"
              :value="audioVolume * 100"
              @input="
                $store.commit(
                  paneId + '/SET_AUDIO_VOLUME',
                  +($event / 100).toFixed(2)
                )
              "
              @reset="$store.commit(paneId + '/SET_AUDIO_VOLUME', null)"
              log
            >
              <template v-slot:tooltip>
                {{ audioVolume > 1 ? '+' : '' }}
                {{ +(audioVolume * 100).toFixed(2) }}%
              </template>
            </slider>
            <editable
              class="-center text-nowrap ml8"
              style="line-height: 1"
              :value="'× ' + audioVolume"
              @input="$store.commit(paneId + '/SET_AUDIO_VOLUME', $event)"
            ></editable>
          </div>
          <label class="mt16 d-block text-color-base">Transpose</label>
          <div class="column">
            <slider
              class="mrauto -fill mt8 mb8"
              :min="0.001"
              :max="5"
              :step="0.01"
              :showCompletion="false"
              :disabled="muted"
              :value="audioPitch"
              @input="$store.commit(paneId + '/SET_AUDIO_PITCH', $event)"
              @reset="$store.commit(paneId + '/SET_AUDIO_PITCH', null)"
              log
            >
              <template v-slot:tooltip>× {{ audioPitch }} </template>
            </slider>
            <editable
              class="-center text-nowrap ml8"
              style="line-height: 1"
              :value="'× ' + audioPitch"
              @input="$store.commit(paneId + '/SET_AUDIO_PITCH', $event)"
            ></editable>
          </div>
        </div>
      </div>
      <div class="form-group" v-if="useAudio && !muted">
        <label>
          Minimum for a trade to trigger a sound
          <i
            class="icon-info mr8"
            v-tippy
            title="Enter the absolute amount<br>or % of significant amount"
          ></i>
        </label>
        <editable
          class="form-control"
          :value="audioThreshold"
          placeholder="10%"
          @input="$store.commit(paneId + '/SET_AUDIO_THRESHOLD', $event)"
        />
      </div>

      <button
        v-if="!useAudio"
        type="button"
        class="btn -text -small -cases"
        @click="$store.commit('settings/TOGGLE_AUDIO', true)"
        title="Click to enable audio"
        v-tippy
      >
        <i class="icon-info mr8 -lower"></i>Audio is currently disabled
      </button>
    </ToggableSection>

    <template v-if="!tab || tab === 'general'">
      <div class="form-group column mb8">
        <label class="-fill -center -inline">Lines count</label>
        <input
          id="trades-limit"
          v-model="rowsInput"
          type="number"
          min="1"
          max="1000"
          step="1"
          class="form-control"
          @change="setMaxRows"
          @keydown.enter="setMaxRows"
        />
      </div>

      <div
        v-if="!isLegacy"
        class="form-group column mb8"
        @click.stop="
          $store.commit(paneId + '/TOGGLE_PREFERENCE', 'showHistograms')
        "
      >
        <label class="-fill -center -inline">Histogram</label>
        <div
          class="checkbox-control checkbox-control-input"
          title="Rolling delta histogram"
          v-tippy
          @click.stop
        >
          <input
            type="checkbox"
            class="form-control"
            :checked="showHistograms"
          />
          <div
            @click="
              $store.commit(paneId + '/TOGGLE_PREFERENCE', 'showHistograms')
            "
          ></div>
        </div>
      </div>
    </template>

    <ToggableSection
      v-if="!tab || tab === 'general'"
      :auto-open="!!tab"
      title="Formats"
      id="trades-columns"
      inset
    >
      <div class="form-group mb8">
        <label class="checkbox-control -small">
          <input
            type="checkbox"
            class="form-control"
            :checked="showPairs"
            @change="$store.commit(paneId + '/TOGGLE_PREFERENCE', 'showPairs')"
          />
          <div></div>
          <span>
            Show pairs
            <i
              class="icon-info"
              v-tippy
              title="Show the market's symbol on each trade<br>(ex: BTC-USD)"
            ></i>
          </span>
        </label>
      </div>

      <toggable-group
        class="mb8 mt16"
        :value="showPrices"
        label="Show prices"
        info="Show the price each trade was filled at"
        @change="$store.commit(paneId + '/TOGGLE_PREFERENCE', 'showPrices')"
        small
      >
        <div class="form-group">
          <label class="checkbox-control -small">
            <input
              type="checkbox"
              class="form-control"
              :checked="showAvgPrice"
              @change="
                $store.commit(paneId + '/TOGGLE_PREFERENCE', 'showAvgPrice')
              "
            />
            <div></div>
            <span>
              Weighted average
              <i
                class="icon-info"
                v-tippy
                title="Show the weighted average price instead of the last price for aggregated trade results"
              ></i>
            </span>
          </label>
        </div>
      </toggable-group>
      <div v-if="isLegacy" class="form-group mb8 mt16">
        <label class="checkbox-control -small">
          <input
            type="checkbox"
            class="form-control"
            :checked="showLogos"
            @change="$store.commit(paneId + '/TOGGLE_PREFERENCE', 'showLogos')"
          />
          <div></div>
          <span>
            Show logos
            <i
              class="icon-info"
              v-tippy
              title="Show the exchange's logo on each trade instead of its name"
            ></i>
          </span>
        </label>
      </div>
    </ToggableSection>
  </div>
</template>

<script lang="ts">
import { TradesPaneState } from '@/store/panesSettings/trades'
import { Component, Vue, Watch } from 'vue-property-decorator'
import Slider from '@/components/framework/picker/Slider.vue'
import Thresholds from '@/components/settings/Thresholds.vue'
import { formatAmount } from '@/services/productsService'
import ToggableSection from '@/components/framework/ToggableSection.vue'
import ColorPickerControl from '@/components/framework/picker/ColorPickerControl.vue'
import ThresholdColor from '@/components/trades/ThresholdColor.vue'
import ToggableGroup from '@/components/framework/ToggableGroup.vue'

@Component({
  components: {
    Thresholds,
    Slider,
    ThresholdColor,
    ToggableSection,
    ColorPickerControl,
    ToggableGroup
  },
  name: 'TradesSettings',
  props: {
    paneId: {
      type: String,
      required: true
    },
    // only show one tab of the pane dialog (general / thresholds / audio)
    tab: {
      type: String,
      default: null
    }
  }
})
export default class TradesSettings extends Vue {
  paneId: string
  tab: string
  // local copy so typing isn't reset by re-renders, saved on change / enter
  rowsInput: number | string = null

  get useAudio() {
    return this.$store.state.settings.useAudio
  }

  get markets() {
    return this.$store.state.panes.panes[this.paneId].markets
  }

  get maxRows() {
    return (this.$store.state[this.paneId] as TradesPaneState).maxRows
  }

  get thresholds() {
    return (this.$store.state[this.paneId] as TradesPaneState).thresholds
  }

  get liquidations() {
    return (this.$store.state[this.paneId] as TradesPaneState).liquidations
  }

  get showLogos() {
    return (this.$store.state[this.paneId] as TradesPaneState).showLogos
  }

  get showAvgPrice() {
    return (this.$store.state[this.paneId] as TradesPaneState).showAvgPrice
  }

  get showPrices() {
    return (this.$store.state[this.paneId] as TradesPaneState).showPrices
  }

  get showTrades() {
    return (this.$store.state[this.paneId] as TradesPaneState).showTrades
  }

  get showLiquidations() {
    return (this.$store.state[this.paneId] as TradesPaneState).showLiquidations
  }

  get showPairs() {
    return (this.$store.state[this.paneId] as TradesPaneState).showPairs
  }

  get showHistograms() {
    return (this.$store.state[this.paneId] as TradesPaneState).showHistograms
  }

  get audioThreshold() {
    return (this.$store.state[this.paneId] as TradesPaneState).audioThreshold
  }

  get muted() {
    return (this.$store.state[this.paneId] as TradesPaneState).muted
  }

  get audioPitch() {
    return (this.$store.state[this.paneId] as TradesPaneState).audioPitch || 1
  }

  get audioVolume() {
    const volume = (this.$store.state[this.paneId] as TradesPaneState)
      .audioVolume

    if (volume === null) {
      return this.$store.state.settings.audioVolume
    }
    return volume
  }

  get disableAnimations() {
    return this.$store.state.settings.disableAnimations
  }

  get isLegacy() {
    return this.$store.state.panes.panes[this.paneId].type === 'trades'
  }

  get displayGifWarning() {
    return (
      this.isLegacy &&
      this.disableAnimations &&
      (this.thresholds.filter(t => !!t.buyGif && !!t.sellGif).length ||
        this.liquidations.filter(t => !!t.buyGif && !!t.sellGif).length)
    )
  }

  get thresholdsBuyColor() {
    return this.thresholds[1].buyColor
  }

  get thresholdsSellColor() {
    return this.thresholds[1].sellColor
  }

  get liquidationsBuyColor() {
    return this.liquidations[1].buyColor
  }

  get liquidationsSellColor() {
    return this.liquidations[1].sellColor
  }

  created() {
    this.rowsInput = this.maxRows
  }

  @Watch('maxRows')
  onMaxRowsChange(value: number) {
    this.rowsInput = value
  }

  setMaxRows() {
    this.$store.commit(this.paneId + '/SET_MAX_ROWS', this.rowsInput)

    // invalid values are ignored by the store: show the current value again
    this.rowsInput = this.maxRows
  }

  formatAmount(amount) {
    return formatAmount(amount)
  }
}
</script>
<style scoped lang="scss">
.thresholds {
  pointer-events: all;
}
</style>
