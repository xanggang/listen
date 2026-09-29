import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toPlayableStation } from '@/lib/saved-station';
import type { PlayableStation } from '@/types/playable-station';
import { useLibraryStore } from './useLibraryStore';

interface StationState {
  currentStation: PlayableStation | null;
  isPlaying: boolean;
  playStation: (station: PlayableStation) => void;
  setIsPlaying: (isPlaying: boolean) => void;
}

/** 唯一播放器状态；选台时同步记录本地历史，播放标记不跨页面刷新持久化。 */
export const useStationStore = create<StationState>()(
  persist(
    (set) => ({
      currentStation: null,
      isPlaying: false,
      /** 验证站点后设为当前电台，并将其移到本地历史顶部。 */
      playStation: (station) => {
        const saved = toPlayableStation(station);
        if (!saved) return;
        set({ currentStation: saved, isPlaying: true });
        useLibraryStore.getState().recordPlayed(saved);
      },
      /** 音频元素和用户操作共同更新当前播放标记。 */
      setIsPlaying: (isPlaying) => set({ isPlaying }),
    }),
    {
      name: 'station-storage',
      skipHydration: true,
      /** 仅恢复当前电台，刷新页面时不自动播放音频。 */
      partialize: (state) => ({ currentStation: state.currentStation }),
      /** 兼容旧版本曾保存的完整电台与播放标记，并丢弃不合法记录。 */
      merge: (persisted, current) => {
        const value = typeof persisted === 'object' && persisted !== null
          ? persisted as Record<string, unknown>
          : {};
        return {
          ...current,
          currentStation: toPlayableStation(value.currentStation),
          isPlaying: false,
        };
      },
    },
  ),
);
