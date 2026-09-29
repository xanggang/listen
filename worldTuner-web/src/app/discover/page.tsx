'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import AetherHeader from '@/components/AetherHeader';
import SearchInput from '@/components/SearchInput';
import StationList from '@/components/StationList';
import { useStations } from '@/app/store/useStations';
import { useStationStore } from '@/app/store/useStationStore';
import { getTopCountries, getTopLanguages, getTopTags } from '@/app/actions/actions';
import type { Countries, Languages, Tags } from '@/types';

type Scope = 'all' | 'genres' | 'countries' | 'languages';

/** 按安卓端发现页组织搜索、精选、流派卡片与真实电台列表。 */
export default function DiscoverPage() {
  const t = useTranslations('discover');
  const [keyword, setKeyword] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [tagId, setTagId] = useState<number>();
  const [languageId, setLanguageId] = useState<number>();
  const [countryId, setCountryId] = useState<number>();
  const [tags, setTags] = useState<Tags[]>([]);
  const [languages, setLanguages] = useState<Languages[]>([]);
  const [countries, setCountries] = useState<Countries[]>([]);
  const playStation = useStationStore(
    /** 只订阅选台动作，避免发现页随播放状态重渲染。 */
    (state) => state.playStation,
  );
  const { stations, loading, hasMore, error, loadMore } = useStations({
    keyword: searchTerm || undefined,
    tagsId: scope === 'genres' ? tagId : undefined,
    languagesId: scope === 'languages' ? languageId : undefined,
    countriesId: scope === 'countries' ? countryId : undefined,
  }, 20);

  useEffect(
    /** 分类字典只用于真实过滤项，失败时保留搜索与电台列表。 */
    () => {
      // 分类读取失败时不显示该维度的选项，其余页面仍可使用。
      void getTopTags().then(setTags).catch(() => undefined);
      void getTopLanguages().then(setLanguages).catch(() => undefined);
      void getTopCountries().then(setCountries).catch(() => undefined);
    },
    [],
  );

  useEffect(
    /** 搜索输入 500ms 后应用，提交按钮仍可立即查询。 */
    () => {
      const timer = setTimeout(
        /** 输入稳定后应用过滤词。 */
        () => setSearchTerm(keyword.trim()),
        500,
      );
      /** 输入变化或页面卸载时取消旧计时器。 */
      return () => clearTimeout(timer);
    },
    [keyword],
  );

  // 精选卡片与列表共用真实的首条 API 电台。
  function playFeatured() {
    if (!stations[0]) return;
    playStation(stations[0]);
  }

  const featured = !searchTerm && scope === 'all' ? stations[0] : undefined;
  const list = featured ? stations.slice(1) : stations;

  return (
    <div className="page-shell">
      <AetherHeader />
      <div className="aether-content">
        <SearchInput keyword={keyword} onKeywordChange={setKeyword} onSearch={setSearchTerm} placeholder={t('placeholder')} />
        <div className="aether-chip-row discover-scopes" aria-label={t('browseCategories')}>
          {(['all', 'genres', 'countries', 'languages'] as const).map(
            /** 切换分类时保留各类别的当前选择，列表条件随之变化。 */
            (value) => <button key={value} className="aether-chip" type="button" aria-pressed={scope === value} onClick={() => setScope(value)}>{t(value)}</button>,
          )}
        </div>
        {scope === 'genres' && <div className="aether-chip-row" aria-label={t('genres')}>
          {tags.map(
            /** 使用标签 id 过滤 API 列表，名称只用于展示。 */
            (tag) => <button key={tag.id} className="aether-chip" type="button" aria-pressed={tagId === tag.id} onClick={() => setTagId(tag.id)}>{tag.name}</button>,
          )}
        </div>}
        {scope === 'languages' && <div className="aether-chip-row" aria-label={t('languages')}>
          {languages.map(
            /** 使用语言 id 过滤 API 列表。 */
            (language) => <button key={language.id} className="aether-chip" type="button" aria-pressed={languageId === language.id} onClick={() => setLanguageId(language.id)}>{language.name}</button>,
          )}
        </div>}
        {scope === 'countries' && <div className="aether-chip-row" aria-label={t('countries')}>
          {countries.map(
            /** 使用国家 id 过滤 API 列表，与安卓端分类一致。 */
            (country) => <button key={country.id} className="aether-chip" type="button" aria-pressed={countryId === country.id} onClick={() => setCountryId(country.id)}>{country.name}</button>,
          )}
        </div>}
        {featured && <section className="discover-feature" aria-label={t('editorPick')}>
          <div className="discover-feature__eyebrow">✦ {t('editorPick')}</div>
          <div className="discover-feature__card">
            <span className="discover-feature__live">● {t('live')}</span>
            <div className="discover-feature__details">
              <h2>{featured.name}</h2>
              <p>{[featured.country, featured.language].filter(Boolean).join(' · ')}</p>
            </div>
            <button type="button" onClick={playFeatured} aria-label={`${t('listenNow')} ${featured.name}`}>
              <span className="iconfont icon-bofang" aria-hidden="true" />
            </button>
          </div>
        </section>}
        {!searchTerm && scope === 'all' && tags.length > 0 && <section>
          <div className="section-heading"><h2>{t('chooseGenre')}</h2><span>{t('genres')}</span></div>
          <div className="genre-grid">
            {tags.slice(0, 6).map(
              /** 热门流派卡片直接切换真实标签过滤。 */
              (tag, index) => <button key={tag.id} className="genre-card aether-card" type="button" onClick={() => { setTagId(tag.id); setScope('genres'); }}>
                <span className={`genre-card__icon genre-card__icon--${index % 3}`} aria-hidden="true">♫</span>
                <strong>{tag.name}</strong>
                <small>{tag.stationcount} {t('stations')}</small>
              </button>,
            )}
          </div>
        </section>}
        <section>
          <div className="section-heading"><h2>{searchTerm ? t('searchResults') : t('popularStations')}</h2><span>{t('live')}</span></div>
          {error && <button className="aether-chip" type="button" onClick={loadMore}>{t('retry')}</button>}
          <StationList stations={list} loading={loading} hasMore={hasMore} onLoadMore={loadMore} />
        </section>
      </div>
    </div>
  );
}
