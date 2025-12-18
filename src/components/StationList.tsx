import React, { useRef, useCallback } from 'react';
import LeaderboardItem from './LeaderboardItem';
import type { Station } from '@/types';

interface StationListProps {
  stations: Station[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  className?: string;
}

const StationList: React.FC<StationListProps> = ({
  stations,
  loading,
  hasMore,
  onLoadMore,
  className = '',
}) => {
  const observer = useRef<IntersectionObserver | null>(null);

  const lastElementRef = useCallback(
    (node: HTMLDivElement) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          onLoadMore();
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore, onLoadMore]
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {stations.map((item, index) => {
        if (stations.length === index + 1) {
          return (
            <div ref={lastElementRef} key={item.id}>
              <LeaderboardItem item={item} />
            </div>
          );
        } else {
          return <LeaderboardItem key={item.id} item={item} />;
        }
      })}
      {loading && <div className="py-2 text-center text-gray-500 dark:text-gray-400">Loading...</div>}
      {!hasMore && stations.length > 0 && (
        <div className="py-2 text-center text-gray-500 dark:text-gray-400">No more stations</div>
      )}
      {!loading && stations.length === 0 && (
        <div className="py-2 text-center text-gray-500 dark:text-gray-400">No stations found</div>
      )}
    </div>
  );
};

export default StationList;
