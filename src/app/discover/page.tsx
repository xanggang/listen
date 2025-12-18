'use client';

import { useState, useEffect } from 'react';
import SearchInput from '@/components/SearchInput';
import { useTranslations } from 'next-intl';
import StationList from '@/components/StationList';
import type { Station } from '@/types';

// Mock data generator
const generateMockData = (startIndex: number, count: number): Station[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `station-${startIndex + i}`,
    url: `http://example.com/station/${startIndex + i}`,
    name: `Station ${startIndex + i}`,
    geoLat: 0,
    geoLong: 0,
    country: 'Country',
    language: 'Language',
    votes: Math.floor(Math.random() * 1000),
    favicon: '',
    state: ''
  }) as any as Station);
};

export default function DiscoverPage() {
  const t = useTranslations('discover');
  const [keyword, setKeyword] = useState('');
  const [stations, setStations] = useState<Station[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchStations = async (pageNum: number, searchKeyword: string) => {
    setLoading(true);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // In a real app, you would fetch from your API here using pageNum and searchKeyword
    const newStations = generateMockData((pageNum - 1) * 10, 10);

    setStations(prev => {
        if (pageNum === 1) return newStations;
        return [...prev, ...newStations];
    });
    setHasMore(newStations.length > 0 && pageNum < 5); // Mock limit 5 pages
    setLoading(false);
  };

  useEffect(() => {
    setPage(1);
    fetchStations(1, keyword);
  }, [keyword]);

  useEffect(() => {
    if (page > 1) {
      fetchStations(page, keyword);
    }
  }, [page]); // keyword dependency removed here to avoid double fetch on keyword change since page reset triggers fetch

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
