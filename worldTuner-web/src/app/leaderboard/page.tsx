'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import AetherHeader from '@/components/AetherHeader';
import StationList from '@/components/StationList';
import { useStations } from '@/app/store/useStations';
import { useStationStore } from '@/app/store/useStationStore';
import { getTopLanguages, getTopTags } from '@/app/actions/actions';
import type { Languages, Station, Tags } from '@/types';

type Scope = 'all' | 'languages' | 'genres';

/** 榜单沿用安卓端的三强台座、筛选胶囊和带排名的列表。 */
export default function LeaderboardPage() {
  const t = useTranslations('charts');
  const [scope, setScope] = useState<Scope>('all');
  const [languageId, setLanguageId] = useState<number>();
  const [tagId, setTagId] = useState<number>();
  const [languages, setLanguages] = useState<Languages[]>([]);
  const [tags, setTags] = useState<Tags[]>([]);
  const playStation = useStationStore(
    /** 只订阅选台动作，榜单不随播放器状态重渲染。 */
    (state) => state.playStation,
  );
  const { stations, loading, hasMore, error, loadMore } = useStations({
    languagesId: scope === 'languages' ? languageId : undefined,
    tagsId: scope === 'genres' ? tagId : undefined,
  }, 20);

  useEffect(
    /** 榜单过滤项来自 API，失败时全球榜单仍可使用。 */
    () => {
      // 字典请求失败时保留不依赖分类的全球榜单。
      void getTopLanguages().then(setLanguages).catch(() => undefined);
      void getTopTags().then(setTags).catch(() => undefined);
    },
    [],
  );

  // 点击台座后使用全局播放器打开对应真实电台。
  function play(station: Station) {
    playStation(station);
  }

  return (
    <div className="page-shell">
      <AetherHeader />
      <div className="aether-content">
        <h1 className="page-title">{t('title')}</h1>
        <p className="page-subtitle">{t('subtitle')}</p>
        <div className="aether-chip-row charts-scopes">
          {(['all', 'languages', 'genres'] as const).map(
            /** 切换榜单维度时只应用当前可见的过滤条件。 */
            (value) => <button key={value} className="aether-chip" type="button" aria-pressed={scope === value} onClick={() => setScope(value)}>{t(value)}</button>,
          )}
        </div>
        {scope === 'languages' && <div className="aether-chip-row">
          {languages.map(
            /** 语言 id 用于重载真实榜单。 */
            (item) => <button key={item.id} className="aether-chip" type="button" aria-pressed={languageId === item.id} onClick={() => setLanguageId(item.id)}>{item.name}</button>,
          )}
        </div>}
        {scope === 'genres' && <div className="aether-chip-row">
          {tags.map(
            /** 标签 id 用于重载真实榜单。 */
            (item) => <button key={item.id} className="aether-chip" type="button" aria-pressed={tagId === item.id} onClick={() => setTagId(item.id)}>{item.name}</button>,
          )}
        </div>}
        {stations.length >= 3 && <div className="podium" aria-label={t('topThree')}>
          {[1, 0, 2].map(
            /** 视觉顺序为 2-1-3，排名仍与 API 顺序对应。 */
            (index) => {
              const station = stations[index];
              return <button key={station.id} type="button" className={`podium__item aether-card${index === 0 ? ' podium__item--first' : ''}`} onClick={() => play(station)}>
                <div className="podium__art">
                  {station.favicon ? <img src={station.favicon} alt="" onError={
                    /** 外部封面失效时保留底色。 */
                    (event) => { event.currentTarget.style.display = 'none'; }
                  } /> : <span className="iconfont icon-bofang" aria-hidden="true" />}
                  <span className="podium__rank">{index + 1}</span>
                </div>
                <strong>{station.name}</strong>
                <small>{station.country || 'worldTuner'}</small>
                <em>{station.votes ?? 0} {t('votes')}</em>
              </button>;
            },
          )}
        </div>}
        <section>
          <div className="section-heading"><h2>{t('topStations')}</h2><span>4–50</span></div>
          {error && <button className="aether-chip" type="button" onClick={loadMore}>{t('retry')}</button>}
          <StationList stations={stations.slice(3)} loading={loading} hasMore={hasMore} onLoadMore={loadMore} rankOffset={3} />
        </section>
      </div>
    </div>
  );
}
