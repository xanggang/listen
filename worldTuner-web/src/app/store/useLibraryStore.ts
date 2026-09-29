import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { readSavedStations, toPlayableStation } from '@/lib/saved-station';
import type { PlayableStation } from '@/types/playable-station';

const maxFavorites = 200;
const maxRecent = 30;

interface LibraryState {
  favorites: PlayableStation[];
  recent: PlayableStation[];
  toggleFavorite: (station: PlayableStation) => void;
  recordPlayed: (station: PlayableStation) => void;
}

/** 无账户版本的本地收藏与最近播放；只持久化最小的公开电台字段。 */
export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      favorites: [],
      recent: [],
      /** 收藏操作以 id 为准，最多保存 200 台以限制浏览器存储占用。 */
      toggleFavorite: (station) => {
        const saved = toPlayableStation(station);
        if (!saved) return;
        set(
          /** 已收藏则移除，否则移到列表顶部。 */
          (state) => ({
            favorites: state.favorites.some((item) => item.id === saved.id)
              ? state.favorites.filter((item) => item.id !== saved.id)
              : [saved, ...state.favorites].slice(0, maxFavorites),
          }),
        );
      },
      /** 每次选台将其移到最近播放顶部，最多保留 30 台。 */
      recordPlayed: (station) => {
        const saved = toPlayableStation(station);
        if (!saved) return;
        set(
          /** 去除旧位置后插入顶部，不增加重复历史。 */
          (state) => ({
            recent: [saved, ...state.recent.filter((item) => item.id !== saved.id)].slice(0, maxRecent),
          }),
        );
      },
    }),
    {
      name: 'worldtuner-library-v1',
      skipHydration: true,
      /** 动作和临时状态不写入浏览器存储。 */
      partialize: (state) => ({ favorites: state.favorites, recent: state.recent }),
      /** 恢复时逐条验证，损坏记录不会使整个本地库无法读取。 */
      merge: (persisted, current) => {
        const value = typeof persisted === 'object' && persisted !== null
          ? persisted as Record<string, unknown>
          : {};
        return {
          ...current,
          favorites: readSavedStations(value.favorites, maxFavorites),
          recent: readSavedStations(value.recent, maxRecent),
        };
      },
    },
  ),
);
