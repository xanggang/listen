'use client';
import { useCallback } from 'react';
import Map from '@/components/Map'
import { getStationById } from '@/app/actions/actions'
import { Station } from '@/types'
import { useStationStore } from '@/app/store/useStationStore';

export default function PlayerPage() {
  const setCurrentStation = useStationStore((state) => state.setCurrentStation);
  const setIsPlaying = useStationStore((state) => state.setIsPlaying);

  const onChange = useCallback(async (data: Station) => {
    const station: Station = await getStationById(data.id)

    if (station) {
      setCurrentStation(station)
      setIsPlaying(true);
    } else {
      console.log('站点不存在',data)
    }
  }, [setCurrentStation, setIsPlaying]);

  return (
    <div className="w-full h-full">
      <Map onChange={onChange}></Map>
    </div>
  )
}
