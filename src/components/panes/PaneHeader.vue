<template>
  <div
    class="pane-header hide-scrollbar d-flex"
    :class="[split && 'pane-header--split']"
  >
    <div v-if="showName && name" class="btn -cases pane-header__highlight">
      <slot name="title">{{ name }}</slot>
    </div>
    <slot>
      <hr />
    </slot>
    <btn
      v-if="settings"
      type="button"
      @click="openSettings"
      class="pane-overlay -text"
      title="Settings"
      :loading="isLoading"
    >
      <i class="icon-cog"></i>
    </btn>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'

import Btn from '@/components/framework/Btn.vue'
import dialogService from '@/services/dialogService'
import { Prop } from 'vue-property-decorator'

/**
 * pane top bar: name, pane specific controls (default slot) and the
 * settings button (everything else lives in the pane settings dialog)
 */
@Component({
  name: 'PaneHeader',
  components: {
    Btn
  }
})
export default class PaneHeader extends Vue {
  isLoading = false

  @Prop(String) readonly paneId: string
  @Prop({ default: null }) readonly settings?: () => Promise<any>
  @Prop({ default: true }) readonly showName: boolean
  @Prop({ default: true }) readonly split: boolean

  get type() {
    return this.$store.state.panes.panes[this.paneId].type
  }

  get name() {
    const name = this.$store.state.panes.panes[this.paneId].name
    const market =
      this.$store.state.panes.marketsListeners[
        this.$store.state.panes.panes[this.paneId].markets[0]
      ]

    if (name) {
      return name.trim()
    } else if (market) {
      return market.local
    } else {
      return this.type
    }
  }

  async openSettings() {
    if (!this.settings) {
      return
    }

    this.isLoading = true
    dialogService.open((await this.settings()).default, {
      paneId: this.paneId
    })
    this.isLoading = false
  }
}
</script>
