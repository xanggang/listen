'use client';
import { useCallback } from 'react';
import Map from '@/components/Map';
import { getStationById } from '@/app/actions/actions';
import { useStationStore } from '@/app/store/useStationStore';

/**
 * 渲染地图播放器，点选后通过独立 API 查询电台详情。
 */
export default function PlayerPage() {
  const playStation = useStationStore(
    /**
 * 只订阅选台动作，避免无关状态更新。
 */
    (state) => state.playStation,
  );

  const onChange = useCallback(
    /**
 * 根据当前地图中的字符串 ID 获取详情，找到电台后更新全局播放器状态。
 */
    async (stationId: string) => {
      const station = await getStationById(stationId);

      if (station) {
        playStation(station);
      } else {
        console.log('站点不存在', stationId);
      }
    },
    [playStation],
  );

  return (
    <div className="w-full h-full">
      <Map onChange={onChange}></Map>
    </div>
  );
}
