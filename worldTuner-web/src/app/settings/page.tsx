'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import AetherHeader from '@/components/AetherHeader';
import LeaderboardItem from '@/components/LeaderboardItem';
import { useLibraryStore } from '@/app/store/useLibraryStore';
import { setUserLocale } from '@/i18n/service';

type ThemeChoice = 'system' | 'light' | 'dark';

/** 个人页复用安卓端分组卡片，并保留真正可用的语言与主题设置。 */
export default function SettingsPage() {
  const t = useTranslations('settings');
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const favorites = useLibraryStore(
    /** 订阅本机收藏列表，供概览数字与电台行共用。 */
    (state) => state.favorites,
  );
  const recent = useLibraryStore(
    /** 订阅最近播放列表，顺序由选台动作更新。 */
    (state) => state.recent,
  );
  const [mounted, setMounted] = useState(false);
  useEffect(
    /** 本地存储只在客户端完成恢复后参与渲染，避免 SSR 水合不一致。 */
    () => setMounted(true),
    [],
  );
  const visibleFavorites = mounted ? favorites : [];
  const visibleRecent = mounted ? recent : [];
  const themes: { value: ThemeChoice; label: string; icon: string }[] = [
    { value: 'system', label: t('followSystem'), icon: '◐' },
    { value: 'light', label: t('lightMode'), icon: '☀' },
    { value: 'dark', label: t('darkMode'), icon: '☾' },
  ];

  return (
    <div className="page-shell">
      <AetherHeader />
      <div className="aether-content settings-content">
        <div className="aether-card profile-overview">
          <div className="profile-card">
            <div className="profile-card__avatar" aria-hidden="true">◎</div>
            <div><h1>{t('profile')}</h1><p>{t('localOnly')}</p></div>
          </div>
          <div className="profile-stats">
            <div><strong>{visibleFavorites.length}</strong><span>{t('favorites')}</span></div>
            <div><strong>{visibleRecent.length}</strong><span>{t('history')}</span></div>
          </div>
        </div>
        <Link className="settings-link aether-card" href="/vip">
          <span className="settings-link__icon" aria-hidden="true">✦</span>
          <span><strong>{t('vipMenu')}</strong><small>{t('vipComingSoon')}</small></span>
          <span className="settings-link__chevron" aria-hidden="true">›</span>
        </Link>
        <section>
          <div className="section-heading"><h2>{t('favorites')}</h2></div>
          {visibleFavorites.length === 0
            ? <p className="library-empty aether-card">{t('noFavorites')}</p>
            : <div className="station-list">{visibleFavorites.slice(0, 4).map(
              /** 本机收藏可直接播放或取消收藏。 */
              (station) => <LeaderboardItem key={station.id} item={station} />,
            )}</div>}
        </section>
        <section>
          <div className="section-heading"><h2>{t('history')}</h2></div>
          {visibleRecent.length === 0
            ? <p className="library-empty aether-card">{t('noHistory')}</p>
            : <div className="station-list">{visibleRecent.slice(0, 4).map(
              /** 本机历史电台可直接重新播放。 */
              (station) => <LeaderboardItem key={station.id} item={station} />,
            )}</div>}
        </section>
        <div className="section-heading"><h2>{t('appearance')}</h2></div>
        <div className="settings-group aether-card">
          {themes.map(
            /** 与安卓端一致提供跟随系统、浅色、深色三种选项。 */
            (choice) => <button key={choice.value} className="settings-option" type="button" aria-pressed={theme === choice.value} onClick={() => setTheme(choice.value)}>
              <span className="settings-option__icon" aria-hidden="true">{choice.icon}</span>
              <span>{choice.label}</span>
              <span className="settings-option__check" aria-hidden="true">{theme === choice.value ? '●' : '○'}</span>
            </button>,
          )}
        </div>
        <div className="section-heading"><h2>{t('localization')}</h2></div>
        <div className="settings-group aether-card">
          <div className="settings-option settings-option--label">
            <span className="settings-option__icon" aria-hidden="true">文</span>
            <span>{t('language')}</span>
          </div>
          <div className="language-options">
            {(['zh', 'en'] as const).map(
              /** 语言 cookie 修改后服务端页面会以新语言重新渲染。 */
              (value) => <button key={value} type="button" className="aether-chip" aria-pressed={locale === value} onClick={() => setUserLocale(value)}>{value === 'zh' ? '简体中文' : 'English'}</button>,
            )}
          </div>
        </div>
        <p className="settings-version">worldTuner · v1.0</p>
      </div>
    </div>
  );
}
