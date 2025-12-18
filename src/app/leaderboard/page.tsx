'use client';
import SlideRadioGroup from '@/components/SlideRadioGroup';
import RadioGroup from '@/components/RadioGroup'
import { useEffect, useState } from 'react'
import { FilterEnums, type Station } from '@/types/index'
import { useTranslations } from 'next-intl'
import StationList from '@/components/StationList'
import { getStations, getTopTags, getTopLanguages } from '@/app/actions/actions'

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

  const [tag, setTag] = useState<number>()
  const [tagOptions, setTagOptions] = useState<{ label: string, value: number}[]>([])

  const [languages, setLanguages] = useState<number>()
  const [languageOptions, setLanguageOptions] = useState<{ label: string, value: number}[]>([])

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
    const newStations = await getStations({
      page: (pageNum - 1) * 10,
      pageSize: 10,
      languagesId: languages,
      tagsId: tag,
    });

    console.log(newStations)
    setStations(prev => {
      if (pageNum === 1) return newStations.list;
      return [...prev, ...newStations.list];
    });
    setHasMore(newStations.list.length > 0); // Mock limit 5 pages
    setLoading(false);
  };

  useEffect(() => {
    getTopTags()
      .then(res => {
        console.log('getTopTags')
        const options  = res.map(item => ({ label: item.name, value: item.id }))
        setTagOptions(options)
      })
    getTopLanguages()
      .then(res => {
        const options  = res.map(item => ({ label: item.name, value: item.id }))
        setLanguageOptions(options)
      })
  }, [])

  useEffect(() => {
    setPage(1);
    fetchStations(1, keyword);
  }, [keyword, languages, tag]);

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
    <div className='p-6 w-full h-full bg-white dark:bg-gray-800 overflow-hidden relative flex! flex-col'>
      <div className='mt-12 space-y-6 shrink-0'>
        <h1 className="text-3xl font-extrabold text-black dark:text-white tracking-tight">Leaderboard</h1>
        <SlideRadioGroup value={type} options={typeOptions} onChange={v => setType(v)} />
        {
          type ===  FilterEnums.By_Genre && <RadioGroup value={tag} options={tagOptions} onChange={v => setTag(v)} />
        }
        {
          type ===  FilterEnums.By_Language && <RadioGroup value={languages} options={languageOptions} onChange={v => setLanguages(v)} />
        }


      </div>
      <div className="h-[calc(100%-16rem)] overflow-y-auto space-y-2 mt-2">
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
