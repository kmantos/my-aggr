<template>
  <Dialog
    @clickOutside="close"
    class="pane-dialog"
    size="medium"
    @mousedown="clickOutsideClose = false"
    @mouseup="clickOutsideClose = true"
  >
    <template v-slot:header>
      <div class="dialog__title" v-text="name"></div>
      <div class="column -center"></div>
    </template>
    <pane-general-settings :pane-id="paneId" @close="close">
      <AlertsSettings />
    </pane-general-settings>
  </Dialog>
</template>

<script>
import DialogMixin from '../../mixins/dialogMixin'
import PaneDialogMixin from '../../mixins/paneDialogMixin'
import AlertsSettings from './AlertsSettings.vue'

export default {
  components: { AlertsSettings },
  mixins: [DialogMixin, PaneDialogMixin]
}
</script>
