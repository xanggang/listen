'use client';

import { useCallback, useRef } from 'react';
import { useLocale } from 'next-intl';
import LeaderboardItem from './LeaderboardItem';
import type { Station } from '@/types';

interface StationListProps {
  stations: Station[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  rankOffset?: number;
  className?: string;
}

/** 复用列表、滚动续页和空状态，列表内容始终来自 API。 */
export default function StationList({ stations, loading, hasMore, onLoadMore, rankOffset, className = '' }: StationListProps) {
  const observer = useRef<IntersectionObserver | null>(null);
  const locale = useLocale();
  const lastElementRef = useCallback(
    /** 最后一行进入视口时请求下一页，加载期间先断开旧观察者。 */
    (node: HTMLDivElement | null) => {
      observer.current?.disconnect();
      if (!node || loading || !hasMore) return;
      observer.current = new IntersectionObserver(
        /** 仅在真实进入视口后触发一次分页。 */
        (entries) => { if (entries[0]?.isIntersecting) onLoadMore(); },
      );
      observer.current.observe(node);
    },
    [loading, hasMore, onLoadMore],
  );

  return (
    <div className={`station-list ${className}`}>
      {stations.map(
        /** 排名从当前列表偏移计算，避免静态占位数据。 */
        (item, index) => (
          <div key={item.id} ref={index === stations.length - 1 ? lastElementRef : undefined}>
            <LeaderboardItem item={item} rank={rankOffset === undefined ? undefined : rankOffset + index + 1} />
          </div>
        ),
      )}
      {loading && <p className="station-list__status">{locale === 'zh' ? '加载中…' : 'Loading…'}</p>}
      {!loading && stations.length === 0 && <p className="station-list__status">{locale === 'zh' ? '暂无电台' : 'No stations found'}</p>}
    </div>
  );
}
