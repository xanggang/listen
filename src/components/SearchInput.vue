<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

const keyword = defineModel('keyword')
const emit = defineEmits(['search'])

const inputRef = useTemplateRef('inputRef')


withDefaults(defineProps<{
  placeholder: string
}>(), {
  placeholder: 'search'
})

const isFocus = ref(false)

function handleFocus() {
  inputRef.value?.focus?.()
  isFocus.value = true
}

function onFocus() {
  isFocus.value = true
}
function onBlur() {
  isFocus.value = true
}

function handleReset() {
  keyword.value = ''
}

function handleSearch() {
  emit('search', keyword.value)
}
</script>

<template>
  <div class="search-form">
    <div class="rounded-xl label" :class="{ 'is-focus': isFocus }">
      <input
          ref="inputRef"
          autocomplete="off"
          :placeholder="placeholder"
          id="search"
          v-model="keyword"
          @blur="onBlur"
          @focus="onFocus"
          @keyup.enter="handleSearch"
          @search="handleSearch"
          type="search"
      />
      <div class="icon">
        <!--        <div class="icon-array">1</div>-->
        <!--        <div class="icon-search">2</div>-->
        <svg
            stroke-width="2"
            stroke="currentColor"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class="icon-array"
        >
          <path
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              stroke-linejoin="round"
              stroke-linecap="round"
          ></path>
        </svg>
        <svg
            stroke-width="2"
            stroke="currentColor"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class="icon-search"
        >
          <path
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
              stroke-linejoin="round"
              stroke-linecap="round"
          ></path>
        </svg>
      </div>
      <button @click="handleReset" type="reset" class="close-btn">
        <svg viewBox="0 0 20 20" class="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
          <path
              clip-rule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              fill-rule="evenodd"
          ></path>
        </svg>
      </button>
    </div>
  </div>

</template>

<style scoped lang="less">

// 定义变量
@input-bg: #FFf;
@padding: var(--gap);
@rotate: 80deg;
@gap: 2em;
@icon-change-color: var(--primary);
@height: 4rem;

.search-form {
  --input-bg: @input-bg; /* background of input */
  --padding: @padding;
  --rotate: @rotate; /* rotation degree of input*/
  --gap: @gap; /* gap of items in input */
  --icon-change-color: @icon-change-color; /* when rotating changed icon color */
  --height: @height; /* height */

  width: 100%;
  background: var(--input-bg);
  position: relative;
  border-radius: 4px;

  .label {
    display: flex;
    align-items: center;
    width: 100%;
    height: var(--height);
    background: var(--bg-base);
    padding-right: var(--text-size-base);
  }

  input {
    width: 100%;
    padding-inline-start: 3em;
    outline: none;
    background: none;
    border: 0;
    font-size: var(--text-size-xl);
  }

  /* style for both icons -- search,close */
  svg {
    color: #111;
    transition: 0.3s cubic-bezier(.4,0,.2,1);
    position: absolute;
    height: 15px;
  }

  /* search icon */
  .icon {
    position: absolute;
    left: var(--padding);
    transition: 0.3s cubic-bezier(.4,0,.2,1);
    display: flex;
    justify-content: center;
    align-items: center;
  }

  /* arrow-icon*/
  .icon-search {
    transform: rotate(-80deg);
    opacity: 1;
    visibility: hidden;
  }

  /* close button */
  .close-btn {
    /* removing default bg of button */
    background: none;
    border: none;
    right: calc(var(--padding) - var(--gap));
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #111;
    padding: 0.1em;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    transition: 0.3s;
    opacity: 0;
    transform: scale(0);
    visibility: hidden;
  }

  // 焦点状态
  input {

    &:focus ~ .icon {
      transform: rotate(var(--rotate)) scale(1.3);

      .icon-search {
        opacity: 1;
        transform: rotate(-80deg);
        visibility: visible;
        color: var(--icon-change-color);
      }

      .icon-array {
        opacity: 0;
        visibility: visible;
      }
    }

    //// 有效输入状态
    //&:valid ~ .icon {
    //  transform: scale(1.3) rotate(var(--rotate));
    //
    //  .icon-search {
    //    opacity: 1;
    //    visibility: visible;
    //    color: var(--icon-change-color);
    //  }
    //
    //  .icon-array {
    //    opacity: 0;
    //    visibility: visible;
    //  }
    //}

    &:valid ~ .close-btn {
      opacity: 1;
      visibility: visible;
      transform: scale(1);
      transition: 0s;
    }
  }
}

#search {

  &::placeholder {
    color: var(--oc-gray-5); // Custom placeholder color
    opacity: 0.5;
  }
}

input[type="search"] {
  /* 隐藏WebKit浏览器的搜索取消按钮 */
  &::-webkit-search-cancel-button {
    -webkit-appearance: none;
    appearance: none;
  }

  /* 隐藏WebKit浏览器的搜索装饰 */
  &::-webkit-search-decoration {
    -webkit-appearance: none;
    appearance: none;
  }

  /* 隐藏Microsoft浏览器的搜索清除按钮 */
  &::-ms-clear {
    display: none;
  }

  /* 隐藏Microsoft浏览器的搜索装饰 */
  &::-ms-reveal {
    display: none;
  }
}
</style>
