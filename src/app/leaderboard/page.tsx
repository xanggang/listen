'use client';
import SlideRadioGroup from '@/components/SlideRadioGroup';
import RadioGroup from '@/components/RadioGroup'
import { useEffect, useState } from 'react'
import { FilterEnums, type Station } from '@/types/index'
import { useTranslations } from 'next-intl'
import StationList from '@/components/StationList'

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

export default function LeaderboardPage() {
  const t = useTranslations('discover')

  // 过滤器状态
  const typeOptions = [
    { label: t('global'), value: FilterEnums.ALL },
    { label: t('byLanguage'), value: FilterEnums.By_Language },
    { label: t('byGenre'), value: FilterEnums.By_Genre },
  ]

  const [type, setType] = useState(FilterEnums.ALL)

  const [tag, setTag] = useState('')
  const [tagOptions, setTagOptions] = useState([
    { label: t('global'), value: FilterEnums.ALL as string },
    { label: t('byLanguage'), value: FilterEnums.By_Language as string },
    { label: t('byGenre'), value: FilterEnums.By_Genre as string },
  ])

  const [languages, setLanguages] = useState('')
  const [languageOptions, setLanguageOptions] = useState([
    { label: t('global'), value: FilterEnums.ALL as string },
    { label: t('byLanguage'), value: FilterEnums.By_Language as string },
    { label: t('byGenre'), value: FilterEnums.By_Genre as string },
  ])

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
    <div className='p-6 w-full h-full bg-white overflow-hidden relative flex! flex-col'>
      <div className='mt-12 space-y-6 shrink-0'>
        <h1 className="text-3xl font-extrabold text-black tracking-tight">Leaderboard</h1>
        <SlideRadioGroup value={type} options={typeOptions} onChange={v => setType(v)} />
        {
          type ===  FilterEnums.By_Genre && <RadioGroup value={tag} options={tagOptions} onChange={v => setTag(v)} />
        }
        {
          type ===  FilterEnums.By_Language && <RadioGroup value={languages} options={languageOptions} onChange={v => setLanguages(v)} />
        }


      </div>
      <div className="h-[calc(100%-16rem)] overflow-y-auto space-y-2">
        <StationList
          stations={stations}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          className="py-4"
        />
      </div>
    </div>
  )
}
