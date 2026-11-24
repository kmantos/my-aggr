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
import paneActions from '@/utils/paneActions'

export default {
  components: { ChartSettings, ChartIndicatorsSettings },
  mixins: [DialogMixin, PaneDialogMixin],
  methods: {
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
