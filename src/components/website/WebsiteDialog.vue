<template>
  <Dialog
    @clickOutside="close"
    class="pane-dialog"
    @mousedown="clickOutsideClose = false"
    @mouseup="clickOutsideClose = true"
  >
    <template v-slot:header>
      <div class="dialog__title" v-text="name"></div>
      <div class="column -center"></div>
    </template>
    <pane-general-settings :pane-id="paneId" @close="close">
      <website-settings :pane-id="paneId" />
      <div class="form-group mb16">
        <label class="checkbox-control">
          <input
            type="checkbox"
            class="form-control"
            :checked="$store.state[paneId].interactive"
            @change="$store.commit(paneId + '/TOGGLE_INTERACTIVE')"
          />
          <div></div>
          <span>Interactive</span>
        </label>
      </div>
      <template v-slot:actions>
        <button type="button" class="btn -text" @click="reload">
          <i class="icon-refresh"></i>
          <span class="ml8">Reload</span>
        </button>
      </template>
    </pane-general-settings>
  </Dialog>
</template>

<script>
import DialogMixin from '../../mixins/dialogMixin'
import PaneDialogMixin from '../../mixins/paneDialogMixin'
import WebsiteSettings from './WebsiteSettings.vue'
import paneActions from '@/utils/paneActions'

export default {
  components: { WebsiteSettings },
  mixins: [DialogMixin, PaneDialogMixin],
  methods: {
    reload() {
      paneActions.emit('reload', this.paneId)
    }
  }
}
</script>
