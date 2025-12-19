'use client';

import { useState, useEffect } from 'react';
import SearchInput from '@/components/SearchInput';
import { useTranslations } from 'next-intl';
import StationList from '@/components/StationList';
import type { Station } from '@/types';
import { getStations } from '@/app/actions/actions';

const PAGE_SIZE = 20;

export default function DiscoverPage() {
  const t = useTranslations('discover');
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [stations, setStations] = useState<Station[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchStations = async (pageNum: number, searchKeyword: string) => {
    setLoading(true);
    try {
      const { list } = await getStations({
        page: pageNum,
        pageSize: PAGE_SIZE,
        keyword: searchKeyword
      });

      setStations(prev => {
        if (pageNum === 1) return list;
        return [...prev, ...list];
      });
      setHasMore(list.length <= PAGE_SIZE);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword);
    }, 500);

    return () => clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    setPage(1);
    fetchStations(1, debouncedKeyword);
  }, [debouncedKeyword]);

  useEffect(() => {
    if (page > 1) {
      fetchStations(page, debouncedKeyword);
    }
  }, [page]);

  const handleSearch = (value: string) => {
    console.log('Search:', value);
    // Keyword change is handled by useEffect
  };

  const handleLoadMore = () => {
    setPage((prevPage) => prevPage + 1);
  };

  return (
    <div className="phone-container w-full h-full bg-white dark:bg-gray-800 overflow-hidden relative">
      <div className="p-6 pt-12 space-y-8 h-full">
        {/* Title & Search Box */}
        <SearchInput
          keyword={keyword}
          onKeywordChange={setKeyword}
          onSearch={handleSearch}
          placeholder={t('placeholder')}
        />

        {/* Recommended Results List */}
        <div className="space-y-4 h-[calc(100%-5rem)]">
          <h2 className="text-lg font-bold text-black dark:text-white">Trending Worldwide</h2>
          <div className="h-[calc(100%-11.5rem)] overflow-y-auto">
            <StationList
              stations={stations}
              loading={loading}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
              className="py-4"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
