<template>
  <div class="form-group toggable-group">
    <label class="checkbox-control" :class="[small && '-small']">
      <input
        type="checkbox"
        class="form-control"
        :checked="value"
        @change="$emit('change', $event)"
      />
      <div></div>
      <span>
        {{ label }}
        <i
          v-if="info"
          class="icon-info info-tap"
          v-tippy="infoTippy"
          :title="info"
          @click.stop.prevent="showInfo"
        ></i>
      </span>
    </label>
    <transition-height name="toggable-group">
      <div class="toggable-group__collapse" v-if="value" key="content-on">
        <div class="pt8">
          <slot />
        </div>
      </div>
      <div
        class="toggable-group__collapse"
        v-if="$slots.off && !value"
        key="content-off"
      >
        <div class="pt8">
          <slot name="off" />
        </div>
      </div>
    </transition-height>
  </div>
</template>

<script lang="ts">
import { isTouchSupported } from '@/utils/touchevent'
import { Component, Vue } from 'vue-property-decorator'
import TransitionHeight from './TransitionHeight.vue'

@Component({
  name: 'ToggableGroup',
  components: {
    TransitionHeight
  },
  props: {
    label: {
      type: String,
      required: true
    },
    // optional explanation shown with an info icon next to the label
    info: {
      type: String,
      default: null
    },
    small: {
      type: Boolean,
      default: false
    },
    value: {
      required: true
    }
  }
})
export default class TogglableGroup extends Vue {
  // info icons: hover on desktop; on touch screens tippy is manual (its touch
  // handling hides it right away) and a tap shows it without toggling the checkbox
  infoTippy = isTouchSupported() ? { trigger: 'manual' } : {}

  showInfo(event: Event) {
    const tip = (event.currentTarget as any)._tippy

    if (tip) {
      tip.show()
    }
  }
}
</script>
<style lang="scss" scoped>
.toggable-group {
  &__collapse {
    margin-left: 2.625rem;

    &.toggable-group-leave-active,
    &.toggable-group-enter-active {
      overflow: hidden;
      transition: all 0.52s $ease-out-expo;
    }

    &.toggable-group-enter,
    &.toggable-group-leave-to {
      transform: translateX(-20%);
      opacity: 0;
    }
  }
}
</style>
