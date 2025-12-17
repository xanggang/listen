'use client';

import { useState } from 'react';
import SearchInput from '@/components/SearchInput';
import { useTranslations } from 'next-intl';
import LeaderboardItem from '@/components/LeaderboardItem'
import type { Station } from '@/types';

export default function DiscoverPage() {
  const t = useTranslations('discover');
  const [keyword, setKeyword] = useState('');

  const handleSearch = (value: string) => {
    console.log('Search:', value);
  };

  const data: any[] = [
    {
      "id": 1,
      "url": "http://stream.gal.io/arrow",
      "name": "\tArrow Classic Rock",
      "geoLat": 52.07963259545092,
      "geoLong": 4.303894042968751,
      country: 'chinma',
      language: 'chinens',
      votes: 996,
      favicon: ''
    },
    {
      "id": 4,
      "url": "http://67.249.184.45:8015/listen.pls",
      "name": "\tHard Rock Radio FM",
      "geoLat": 43.064015622124,
      "geoLong": -74.90702480077745
    },
  ]

  return (
    <div className="phone-container w-full h-full bg-white overflow-hidden relative">
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
          <h2 className="text-lg font-bold text-black">Trending Worldwide</h2>
          <div className="space-y-4 overflow-y-auto h-[calc(100%-11.5rem)]">
             {/* StationSList equivalent would go here */}
             <div className="text-gray-500 text-center py-4 space-y-4">

               {
                 data.map(item => <LeaderboardItem item={item}></LeaderboardItem>)
               }
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
