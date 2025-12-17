<script setup lang="ts">
import { ref, watch } from 'vue';
import SearchInput from '@/components/SearchInput.vue'
import { useI18n } from 'vue-i18n'
import { showToast } from 'vant'
import { getStationPageByKeyWord, type Station } from '@/api'
import LeaderboardItem from '@/views/leaderboard/LeaderboardItem.vue'
import { debounce } from 'lodash-es';
import StationSList from '@/components/StationSList/index.vue'

const { t } = useI18n()

// 搜索关键词
const keyword = ref('');
const stationSList = ref()

function getData(data: any) {
  return getStationPageByKeyWord({
    keyword: keyword.value,
    ...data
  });
}

// 模糊搜索
const debouncedSearch = debounce(() => {
  stationSList.value?.refresh()
}, 300);

watch(keyword, debouncedSearch)
</script>

<template>
  <div class="phone-container w-full h-full bg-white overflow-hidden relative">
    <div class="p-6 pt-12 space-y-8 h-full">
      <!-- 标题 & 搜索框 -->
       <SearchInput  v-model:keyword="keyword" :placeholder="t('discover.placeholder')" />

      <!-- 推荐结果列表 -->
      <div class="space-y-4 h-[calc(100%-5rem)]">
        <h2 class="text-lg font-bold text-black">Trending Worldwide</h2>
        <div class="space-y-4 overflow-y-auto h-[calc(100%-11.5rem)]">
          <StationSList :getData="getData" ref="stationSList"></StationSList>
        </div>
      </div>

    </div>

  </div>
</template>

<style lang="less" scoped>

.phone-container {

}
</style>
