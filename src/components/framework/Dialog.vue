<template>
  <div
    class="dialog"
    :class="[
      impliedSize && `dialog--size-${impliedSize}`,
      currentSize && `dialog--${currentSize}`,
      contrasted && `dialog--contrasted`,
      borderless && `dialog--borderless`,
      mask && 'dialog--mask'
    ]"
  >
    <div v-if="mask" class="dialog__mask" @click="clickOutside" />
    <div
      ref="content"
      class="dialog__content"
      :class="contentClass"
      @click.stop
      @mousedown="onMouseDown"
    >
      <header v-if="$slots.header" class="dialog__header-wrapper">
        <slot name="cover"></slot>
        <div class="dialog__header">
          <slot name="header"></slot>
          <button
            type="button"
            class="dialog__close btn -link -text"
            @click="close"
          >
            <i class="icon-cross"></i>
          </button>
        </div>
        <div class="dialog__subheader" v-if="$slots.subheader">
          <slot name="subheader" />
        </div>
      </header>
      <div ref="body" class="dialog__body hide-scrollbar" :class="bodyClass">
        <slot></slot>
      </div>
      <footer v-if="$slots.footer" class="dialog__footer d-flex">
        <slot name="footer"></slot>
      </footer>
    </div>
  </div>
</template>

<script lang="ts">
import dialogService from '@/services/dialogService'
import { Component, Vue, Watch } from 'vue-property-decorator'

/**
 * Popup frame: centered, fixed (not draggable, not resizable), its size comes
 * from the `size` prop (full screen on phones / car screens, see dialog.scss)
 */
@Component({
  name: 'Dialog',
  props: {
    mask: {
      type: Boolean,
      default: true
    },
    contrasted: {
      type: Boolean,
      default: false
    },
    borderless: {
      type: Boolean,
      default: false
    },
    size: {
      type: String,
      default: null
    },
    bodyClass: {
      type: String,
      required: false
    },
    contentClass: {
      type: String,
      required: false
    },
    closeOnEscape: {
      type: Boolean,
      default: true
    }
  }
})
export default class Dialog extends Vue {
  size: string
  closeOnEscape: boolean
  impliedSize = null
  // small / medium / large, from the rendered width (responsive layouts)
  currentSize = null

  private _deinteractionTimeout: number
  private _windowResizeTimeout: number
  private _handleEscKey: (event: any) => void
  private _handleWindowResize: (event: any) => void

  $refs!: {
    content: HTMLElement
    body: HTMLElement
  }

  created() {
    if (this.size) {
      this.impliedSize = this.size
    }
  }

  @Watch('size')
  onSizeChange(size: string) {
    this.impliedSize = size
  }

  async mounted() {
    if (this.closeOnEscape) {
      this.bindEscKey()
    }

    this.bindWindowResize()

    await this.$nextTick()
    this.detectSize(this.$refs.content.clientWidth)

    this.$emit('mounted')
  }

  beforeDestroy() {
    if (this._handleEscKey) {
      document.removeEventListener('keydown', this._handleEscKey)
    }

    if (this._handleWindowResize) {
      window.removeEventListener('resize', this._handleWindowResize)
    }
  }

  // a click that started inside the dialog (ex: text selection) and ended on
  // the mask doesn't close it
  onMouseDown() {
    if (this._deinteractionTimeout) {
      clearTimeout(this._deinteractionTimeout)
    }

    dialogService.isInteracting = true

    const handler = () => {
      document.removeEventListener('mouseup', handler)

      this._deinteractionTimeout = setTimeout(() => {
        dialogService.isInteracting = false
        this._deinteractionTimeout = null
      }, 100) as unknown as number
    }

    document.addEventListener('mouseup', handler)
  }

  clickOutside() {
    if (dialogService.isInteracting) {
      return false
    }

    this.$emit('clickOutside')
  }

  close() {
    this.$emit('clickOutside')
  }

  bindEscKey() {
    if (this._handleEscKey) {
      return
    }

    this._handleEscKey = event => {
      if (
        event.key === 'Escape' &&
        this.$el === this.$el.parentElement.querySelector('.dialog:last-child')
      ) {
        event.stopPropagation()
        this.close()
      }
    }

    document.addEventListener('keydown', this._handleEscKey)
  }

  bindWindowResize() {
    if (this._handleWindowResize) {
      return
    }

    this._handleWindowResize = () => {
      if (this._windowResizeTimeout) {
        clearTimeout(this._windowResizeTimeout)
      }
      this._windowResizeTimeout = setTimeout(() => {
        this.detectSize(this.$refs.content.clientWidth)
        this._windowResizeTimeout = null
      }) as unknown as number
    }

    window.addEventListener('resize', this._handleWindowResize)
  }

  detectSize(w) {
    if (w >= 840) {
      this.currentSize = 'large'
    } else if (w > 420) {
      this.currentSize = 'medium'
    } else {
      this.currentSize = 'small'
    }
  }
}
</script>
