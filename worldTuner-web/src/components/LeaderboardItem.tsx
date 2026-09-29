'use client';

import type { PlayableStation } from '@/types/playable-station';
import { useLocale } from 'next-intl';
import { useStationStore } from '@/app/store/useStationStore';
import { useLibraryStore } from '@/app/store/useLibraryStore';

interface LeaderboardItemProps {
  item: PlayableStation;
  rank?: number;
}

/** 统一绘制发现页和榜单页的电台行，播放动作使用全局播放器。 */
export default function LeaderboardItem({ item, rank }: LeaderboardItemProps) {
  const locale = useLocale();
  const playStation = useStationStore(
    /** 只订阅选台动作，避免播放状态刷新整个列表。 */
    (state) => state.playStation,
  );
  const favorite = useLibraryStore(
    /** 只订阅此电台的收藏状态，其他电台变化不触发本行刷新。 */
    (state) => state.favorites.some((station) => station.id === item.id),
  );
  const toggleFavorite = useLibraryStore(
    /** 只订阅本地收藏动作。 */
    (state) => state.toggleFavorite,
  );

  // 选中电台并请求全局 audio 开始播放。
  function play() {
    playStation(item);
  }

  return (
    <article className="station-row aether-card">
      {rank !== undefined && <span className="station-row__rank">{rank}</span>}
      <div className="station-row__art">
        {item.favicon ? <img src={item.favicon} alt="" onError={
          /** 外部图标失效时隐藏图片并显示占位背景。 */
          (event) => { event.currentTarget.style.display = 'none'; }
        } /> : <span className="iconfont icon-bofang" aria-hidden="true" />}
      </div>
      <div className="station-row__info">
        <h3>{item.name}</h3>
        <p>{[item.country, item.language].filter(Boolean).join(' · ') || 'worldTuner'}</p>
      </div>
      <button
        className="station-row__favorite"
        type="button"
        aria-label={favorite
          ? (locale === 'zh' ? `取消收藏 ${item.name}` : `Remove ${item.name} from favorites`)
          : (locale === 'zh' ? `收藏 ${item.name}` : `Add ${item.name} to favorites`)}
        aria-pressed={favorite}
        onClick={
          /** 收藏仅写入当前浏览器，不调用 API。 */
          () => toggleFavorite(item)
        }
      >
        {favorite ? '♥' : '♡'}
      </button>
      <button className="station-row__play" type="button" onClick={play} aria-label={locale === 'zh' ? `播放 ${item.name}` : `Play ${item.name}`}>
        <span className="iconfont icon-bofang" aria-hidden="true" />
      </button>
    </article>
  );
}
