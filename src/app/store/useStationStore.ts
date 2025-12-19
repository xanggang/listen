import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Station } from '@/types';

interface StationState {
  currentStation: Station | null;
  isPlaying: boolean;
  setCurrentStation: (station: Station | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
}

export const useStationStore = create<StationState>()(
  persist(
    (set) => ({
      currentStation: null,
      isPlaying: false,
      setCurrentStation: (station) => {
        set({ currentStation: station });
      },
      setIsPlaying: (isPlaying) => set({ isPlaying }),
    }),
    {
      name: 'station-storage',
    }
  )
);
