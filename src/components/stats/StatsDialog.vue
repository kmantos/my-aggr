<template>
  <Dialog @clickOutside="close" class="pane-dialog">
    <template v-slot:header>
      <div class="dialog__title" v-text="name"></div>
      <div class="column -center"></div>
    </template>
    <template v-slot:subheader>
      <tabs :value="tab" @input="tab = $event">
        <tab name="general">General</tab>
        <tab name="sources">Sources</tab>
      </tabs>
    </template>
    <pane-general-settings
      v-if="tab === 'general'"
      :pane-id="paneId"
      @close="close"
    >
      <stats-settings :pane-id="paneId" />
    </pane-general-settings>
    <pane-sources v-else :pane-id="paneId" />
  </Dialog>
</template>

<script>
import DialogMixin from '../../mixins/dialogMixin'
import PaneDialogMixin from '../../mixins/paneDialogMixin'
import StatsSettings from './StatsSettings.vue'

export default {
  components: { StatsSettings },
  mixins: [DialogMixin, PaneDialogMixin]
}
</script>
