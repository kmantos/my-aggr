<template>
  <div class="pane-general-settings">
    <div class="form-group mb16">
      <label for="pane-name">Name</label>
      <input
        id="pane-name"
        type="text"
        class="form-control w-100"
        :value="paneName"
        :placeholder="defaultName"
        @change="setName($event.target.value)"
      />
    </div>
    <div v-if="isInFrame" class="form-group mb16">
      <label class="checkbox-control">
        <input
          type="checkbox"
          class="form-control"
          :checked="syncedWithParent"
          @change="$store.commit('panes/TOGGLE_SYNC_WITH_PARENT_FRAME', paneId)"
        />
        <div></div>
        <span>Sync with parent page</span>
      </label>
    </div>

    <slot />

    <div class="divider" />
    <div class="pane-general-settings__actions">
      <slot name="actions" />
      <button type="button" class="btn -text" @click="duplicatePane">
        <i class="icon-copy-paste"></i>
        <span class="ml8">Duplicate pane</span>
      </button>
      <button type="button" class="btn -text text-danger" @click="removePane">
        <i class="icon-trash"></i>
        <span class="ml8">Remove pane</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import dialogService from '@/services/dialogService'
import { INFRAME } from '@/utils/constants'

/**
 * "General" tab shared by every pane settings dialog:
 * name, pane specific settings (default slot),
 * pane specific actions ("actions" slot), duplicate and remove
 */
@Component({
  name: 'PaneGeneralSettings',
  props: {
    paneId: {
      type: String,
      required: true
    }
  }
})
export default class PaneGeneralSettings extends Vue {
  paneId: string
  isInFrame = INFRAME

  get pane() {
    return this.$store.state.panes.panes[this.paneId]
  }

  get paneName() {
    return this.pane.name || ''
  }

  get defaultName() {
    const market =
      this.$store.state.panes.marketsListeners[this.pane.markets[0]]

    return market ? market.local : this.pane.type
  }

  get syncedWithParent() {
    return (
      this.$store.state.panes.syncedWithParentFrame.indexOf(this.paneId) !== -1
    )
  }

  setName(name: string) {
    this.$store.commit('panes/SET_PANE_NAME', {
      id: this.paneId,
      name: name.trim()
    })
  }

  duplicatePane() {
    this.$store.dispatch('panes/duplicatePane', this.paneId)
  }

  async removePane() {
    const name = this.paneName || this.defaultName

    if (await dialogService.confirm(`Delete pane "${name}" ?`)) {
      this.$emit('close')
      this.$store.dispatch('panes/removePane', this.paneId)
    }
  }
}
</script>

<style lang="scss" scoped>
.pane-general-settings {
  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
    margin-top: 0.5rem;
  }
}
</style>
