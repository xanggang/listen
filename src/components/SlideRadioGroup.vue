
<script setup lang="ts">import { ref, computed } from 'vue'

interface Props {
  modelValue?: string | number
  options: Array<{
    label: string
    value: string | number
  }>
  disabled?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string | number): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  disabled: false,
  options: () => []
})

const emit = defineEmits<Emits>()

const activeIndex = computed(() => {
  return props.options.findIndex(option => option.value === props.modelValue)
})

const handleSelect = (value: string | number) => {
  if (props.disabled) return
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="slide-radio-group" :class="{ disabled }">
    <div
        v-for="(option, index) in options"
        :key="option.value"
        class="radio-item"
        :class="{ active: option.value === modelValue }"
        @click="handleSelect(option.value)"
    >
      {{ option.label }}
    </div>
    <div class="active-slider-wrap">
      <div class="active-slider" :style="{
      width: options.length > 1 ? `${100 / props.options.length}%` : '100%',
      left: activeIndex * (100 / props.options.length) + '%'
    }"></div>
    </div>

  </div>
</template>

<style scoped lang="less">
.slide-radio-group {
  display: flex;
  position: relative;
  border-radius: 8px;
  background-color: var(--bg-base-1);
  box-sizing: border-box;
  height: 3rem;
  padding: 0 0.2rem;

  &.disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .radio-item {
    flex: 1;
    height: 100%;
    line-height: 3rem;
    text-align: center;
    //padding: 12px 16px;
    cursor: pointer;
    position: relative;
    z-index: 2;
    transition: color 0.3s ease;
    border-radius: 6px;

    &.active {
      color: var(--text-black);
      font-weight: 500;
    }

    &:not(.active) {
      color: var(--text-sub);
    }
  }

  .active-slider-wrap {
    width: calc(100% - 0.4rem);
    height: 100%;
    position: absolute;
    left: 0.2rem;

    .active-slider {
      position: absolute;
      //width: 33%;
      height: calc(3rem - 0.4rem);
      top: 0.2rem;
      border-radius: 6px;
      z-index: 1;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      background: white;
    }
  }
}

</style>
