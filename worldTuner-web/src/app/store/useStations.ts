'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getStations } from '@/app/actions/actions';
import type { Station } from '@/types';

type Filters = { keyword?: string; languagesId?: string; tagsId?: string; countriesId?: string };
/**
 * 管理筛选与分页请求，丢弃过期响应并为加载失败提供手动重试入口。
 */
export function useStations(filters: Filters, pageSize: number) {
  const key = JSON.stringify({ ...filters, pageSize });
  const generation = useRef(0);
  const busy = useRef(false);
  const nextPage = useRef<number | null>(1);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(
    /**
 * 加载指定页；generation 防止旧筛选结果覆盖新列表。
 */
    async (page: number, version: number) => {
      busy.current = true;
      setLoading(true);
      setError(false);
      try {
        const query: Filters & { pageSize: number } = JSON.parse(key);
        const result = await getStations({ ...query, page });
        if (version !== generation.current) return;
        setStations(
          /**
 * 第一页替换列表，后续页追加已获取的电台。
 */
          (prev) => (page === 1 ? result.list : [...prev, ...result.list]),
        );
        nextPage.current = result.nextPage;
        setHasMore(result.hasMore);
      } catch {
        if (version === generation.current) setError(true);
      } finally {
        if (version === generation.current) {
          busy.current = false;
          setLoading(false);
        }
      }
    },
    [key],
  );
  useEffect(
    /**
 * 筛选变化时开启新请求代次并重置分页。
 */
    () => {
      const version = ++generation.current;
      const activeGeneration = generation;
      nextPage.current = 1;
      setStations([]);
      setHasMore(true);
      void load(1, version);
      /**
 * 卸载或切换筛选时使仍在途的响应失效。
 */
      return () => {
        activeGeneration.current = version + 1;
      };
    },
    [load],
  );
  const loadMore =
    /**
 * 仅在没有请求进行且存在下一页时加载；失败时可重试同一页。
 */
    () => {
      if (!busy.current && nextPage.current !== null)
        void load(nextPage.current, generation.current);
    };
  return { stations, loading, hasMore: hasMore && !error, error, loadMore };
}
