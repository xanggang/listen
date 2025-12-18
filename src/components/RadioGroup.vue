<script setup lang="ts">

const emits = defineEmits(['change'])
const value = defineModel('value', { type: String, default: '1' })

const props = withDefaults(defineProps<{
  options: Options[]
}>(), {
  options: () => [
    { label: 'Global', value: '1' },
    { label: 'Language', value: '2' },
    { label: 'Genre', value: '3' },
  ]
})

interface Options {
  label: string
  value: string
}

// const config: Options[] = [
//   { label: 'Global', value: '1' },
//   { label: 'Language', value: '1' },
//   { label: 'Genre', value: '1' },
// ]

function handleChange(item: Options) {
 emits('change', item)
  value.value = item.value
}
</script>

<template>
  <!-- 子过滤器 -->
  <div class="flex space-x-4 overflow-x-auto pb-2">
    <div
      v-for="(item, index) in options" :key="index"
      class="radio-item"
      :class="value === item.value ? 'active' : ''"
      @click="handleChange(item)"
    > {{ item.label }}</div>
  </div>
</template>

<style scoped lang="less">

.radio-item {
  display: inline-block;
  padding: var(--text-size-xs) var(--text-size-xs);
  background: var(--bg-base);
  color: var(--text-black);
  font-size: var(--text-size-base);
  border-radius: calc(var(--text-size-xs) / 2);
  font-weight: bold;
  flex-shrink: 0;

  &.active {
    background: var(--primary);
    color: var(--text-base-inv);
  }
}
</style>
