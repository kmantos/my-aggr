import { parseMarket } from '@/services/productsService'
import { Pane } from '@/store/panes'
import Vue from 'vue'
import Component from 'vue-class-component'
import Tabs from '@/components/framework/Tabs.vue'
import Tab from '@/components/framework/Tab.vue'
import PaneGeneralSettings from '@/components/panes/PaneGeneralSettings.vue'
import PaneSources from '@/components/panes/PaneSources.vue'

@Component({
  components: {
    Tabs,
    Tab,
    PaneGeneralSettings,
    PaneSources
  },
  props: {
    paneId: {
      required: true,
      type: String
    }
  }
})
export default class PaneDialogMixin extends Vue {
  paneId: string

  // pane settings dialogs are split in tabs (general, sources...)
  tab = 'general'

  get pane(): Pane {
    return this.$store.state.panes.panes[this.paneId]
  }

  get name() {
    const name = this.$store.state.panes.panes[this.paneId].name

    if (!name) {
      if (!name && this.$store.state.panes.panes[this.paneId].markets.length) {
        const [, pair] = parseMarket(
          this.$store.state.panes.panes[this.paneId].markets[0]
        )
        return pair + ' - ' + this.$store.state.panes.panes[this.paneId].type
      } else {
        return this.paneId
      }
    }

    return name
  }

  set name(value: string) {
    this.$store.commit('panes/SET_PANE_NAME', { id: this.paneId, name: value })
  }
}
