<template>
  <Dialog @clickOutside="close" class="pane-dialog" size="medium">
    <template v-slot:header>
      <div
        class="dialog__title -editable"
        @dblclick="renamePane"
        v-text="name"
      ></div>
      <div class="column -center"></div>
    </template>
    <trades-settings :paneId="paneId" />
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
