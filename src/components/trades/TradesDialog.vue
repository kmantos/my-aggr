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
        <tab name="thresholds">Thresholds</tab>
        <tab name="audio">Audio</tab>
      </tabs>
    </template>
    <pane-general-settings
      v-if="tab === 'general'"
      :pane-id="paneId"
      @close="close"
    >
      <trades-settings :pane-id="paneId" tab="general" />
    </pane-general-settings>
    <pane-sources v-else-if="tab === 'sources'" :pane-id="paneId" />
    <trades-settings v-else :pane-id="paneId" :tab="tab" />
  </Dialog>
</template>

<script>
import DialogMixin from '../../mixins/dialogMixin'
import PaneDialogMixin from '../../mixins/paneDialogMixin'
import TradesSettings from './TradesSettings.vue'

export default {
  components: { TradesSettings },
  mixins: [DialogMixin, PaneDialogMixin]
}
</script>
