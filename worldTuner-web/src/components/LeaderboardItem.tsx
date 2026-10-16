'use client';

import { stationLanguageLabel, stationCountryLabel } from '@/lib/catalog-names';

import type { Station } from '@/types';
import type { PlayableStation } from '@/types/playable-station';
import { useLocale } from 'next-intl';
import { useStationStore } from '@/app/store/useStationStore';
import { useLibraryStore } from '@/app/store/useLibraryStore';
import Link from 'next/link';

interface LeaderboardItemProps {
  item: PlayableStation | Station;
  rank?: number;
}

/**
 * 统一绘制电台行；地图链接仅传公开 ID，收藏与全局播放互不影响。
 */
export default function LeaderboardItem({ item, rank }: LeaderboardItemProps) {
  const locale = useLocale();
  const playStation = useStationStore(
    /**
     * 只订阅选台动作，避免播放状态刷新整个列表。
     */
    (state) => state.playStation,
  );
  const favorite = useLibraryStore(
    /**
     * 只订阅此电台的收藏状态，其他电台变化不触发本行刷新。
     */
    (state) => state.favorites.some((station) => station.id === item.id),
  );
  const toggleFavorite = useLibraryStore(
    /**
     * 只订阅本地收藏动作。
     */
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
        {item.favicon ? (
          <img
            src={item.favicon}
            alt=""
            onError={
              /**
               * 外部图标失效时隐藏图片并显示占位背景。
               */
              (event) => {
                event.currentTarget.style.display = 'none';
              }
            }
          />
        ) : (
          <span className="iconfont icon-bofang" aria-hidden="true" />
        )}
      </div>
      <div className="station-row__info">
        <h3>{item.name}</h3>
        <p>
          {[stationCountryLabel(item, locale), stationLanguageLabel(item, locale)]
            .filter(Boolean)
            .join(' · ') || 'worldTuner'}
        </p>
      </div>
      <Link
        className="station-row__locate"
        href={`/player?station=${encodeURIComponent(item.id)}`}
        aria-label={locale === 'zh' ? `在地图上定位 ${item.name}` : `Show ${item.name} on map`}
        title={locale === 'zh' ? '在地图上定位' : 'Show on map'}
      >
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      </Link>
      <button
        className="station-row__favorite"
        type="button"
        aria-label={
          favorite
            ? locale === 'zh'
              ? `取消收藏 ${item.name}`
              : `Remove ${item.name} from favorites`
            : locale === 'zh'
              ? `收藏 ${item.name}`
              : `Add ${item.name} to favorites`
        }
        aria-pressed={favorite}
        onClick={
          /**
           * 收藏仅写入当前浏览器，不调用 API。
           */
          () => toggleFavorite(item)
        }
      >
        {favorite ? '♥' : '♡'}
      </button>
      <button
        className="station-row__play"
        type="button"
        onClick={play}
        aria-label={locale === 'zh' ? `播放 ${item.name}` : `Play ${item.name}`}
      >
        <span className="iconfont icon-bofang" aria-hidden="true" />
      </button>
    </article>
  );
}
