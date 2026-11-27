<template>
  <div id="menu" class="menu" :class="{ '-idle': idle && !menuOpened }">
    <button
      class="menu__button btn"
      @click="$refs.menuDropdown.toggle($event.currentTarget)"
    >
      <i class="icon-menu"></i>
    </button>
    <dropdown
      ref="menuDropdown"
      @opened="menuOpened = true"
      @closed="menuOpened = false"
    >
      <button
        type="button"
        class="dropdown-item dropdown-item--space-between"
        @click.stop="$refs.panesDropdown.toggle($event.currentTarget)"
      >
        <span class="mr4">Pane</span>
        <i class="icon-dashboard"></i>
      </button>
      <dropdown
        ref="panesDropdown"
        @mousedown.native.stop
        @touchstart.native.stop
      >
        <button
          class="dropdown-item dropdown-item--space-between"
          @click="addPane('chart')"
        >
          <span class="mr4">Chart</span>
          <i class="icon-plus" />
        </button>
        <button
          class="dropdown-item dropdown-item--space-between"
          @click="addPane('trades-lite')"
        >
          <span class="mr4">Trade</span>
          <i class="icon-plus" />
        </button>
      </dropdown>

      <button
        type="button"
        class="dropdown-item dropdown-item--space-between"
        @click="toggleFullscreen"
      >
        <span class="mr4">{{
          isFullscreen ? 'Exit\xa0fullscreen' : 'Fullscreen'
        }}</span>
        <i class="icon-enlarge"></i>
      </button>
      <button
        type="button"
        class="dropdown-item dropdown-item--space-between"
        @click="showSettings"
      >
        <span class="mr4">Settings</span>
        <i class="icon-cog"></i>
      </button>
    </dropdown>
  </div>
</template>

<script lang="ts">
import dialogService from '@/services/dialogService'
import { PaneType } from '@/store/panes'
import { Component, Vue } from 'vue-property-decorator'
import SettingsDialog from './settings/SettingsDialog.vue'

@Component({
  name: 'Menu'
})
export default class Menu extends Vue {
  isFullscreen = false

  // the button hides after 5s without mouse / touch activity
  idle = false
  menuOpened = false
  private idleTimeout: number

  mounted() {
    document.addEventListener(
      'webkitfullscreenchange',
      this.handleFullScreenChange
    )
    document.addEventListener('fullscreenchange', this.handleFullScreenChange)

    for (const event of ['mousemove', 'touchstart', 'keydown']) {
      document.addEventListener(event, this.wakeUp, { passive: true })
    }

    this.wakeUp()
  }

  beforeDestroy() {
    for (const event of ['mousemove', 'touchstart', 'keydown']) {
      document.removeEventListener(event, this.wakeUp)
    }

    clearTimeout(this.idleTimeout)
  }

  wakeUp() {
    this.idle = false

    clearTimeout(this.idleTimeout)

    this.idleTimeout = window.setTimeout(() => {
      this.idle = true
    }, 5000)
  }

  showSettings() {
    dialogService.open(SettingsDialog)
  }

  async toggleFullscreen() {
    const doc = document as any
    const body = doc.body

    body.requestFullscreen =
      body.requestFullscreen ||
      body.webkitRequestFullscreen ||
      function () {
        return false
      }
    doc.cancelFullscreen =
      doc.exitFullscreen ||
      doc.webkitExitFullscreen ||
      doc.cancelFullScreen ||
      doc.webkitCancelFullScreen ||
      doc.mozCancelFullScreen ||
      function () {
        return false
      }

    if (this.isFullscreen) {
      doc.cancelFullscreen()
      this.isFullscreen = false
    } else {
      body.requestFullscreen()
      this.isFullscreen = true
    }
  }

  handleFullScreenChange() {
    if (
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement
    ) {
      this.isFullscreen = true
    } else {
      this.isFullscreen = false
    }
  }

  addPane(type: PaneType) {
    this.$store.dispatch('panes/addPane', { type })
  }
}
</script>

<style lang="scss">
.menu {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 10;

  &.-idle .menu__button {
    opacity: 0;
    pointer-events: none;
  }

  .menu__button {
    transition: opacity 0.3s ease-out;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    justify-content: center;
    background-color: var(--theme-background-100);
    color: var(--theme-accent-color);
    z-index: 1;
    position: relative;

    background-color: var(--theme-accent-50);
    border: 1px solid var(--theme-accent-base);

    &:hover {
      background-color: var(--theme-accent-base);
      border-color: var(--theme-accent-100);
    }
  }
}
</style>
