<template>
  <Dialog
    @clickOutside="close"
    class="pane-dialog"
    size="small"
    @mousedown="clickOutsideClose = false"
    @mouseup="clickOutsideClose = true"
  >
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
      <prices-settings :pane-id="paneId" />
    </pane-general-settings>
    <pane-sources v-else :pane-id="paneId" />
  </Dialog>
</template>

<script>
import DialogMixin from '../../mixins/dialogMixin'
import PaneDialogMixin from '../../mixins/paneDialogMixin'
import PricesSettings from './PricesSettings.vue'

export default {
  components: { PricesSettings },
  mixins: [DialogMixin, PaneDialogMixin]
}
</script>
