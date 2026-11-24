<template>
  <Dialog
    @clickOutside="close"
    class="pane-dialog"
    size="small"
    @mousedown="clickOutsideClose = false"
    @mouseup="clickOutsideClose = true"
  >
    <template v-slot:header>
      <div
        class="dialog__title -editable"
        @dblclick="renamePane"
        v-text="name"
      ></div>
      <div class="column -center"></div>
    </template>
    <prices-settings :paneId="paneId" />
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
