'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

/** 展示与安卓端一致的 VIP 规划内容，不提供购买或开通操作。 */
export default function VipPage() {
  const t = useTranslations('vip');

  return (
    <div className="page-shell vip-page">
      <header className="vip-header aether-header">
        <Link href="/settings" className="vip-back" aria-label={t('back')}>←</Link>
        <span className="aether-header__spacer" />
        <strong>worldTuner</strong><span className="vip-badge">VIP</span>
      </header>
      <div className="vip-hero">
        <div className="vip-globe" aria-hidden="true"><span>◉</span></div>
        <span className="vip-badge">{t('comingSoon')}</span>
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
        <a href="#benefits" className="vip-cta">{t('learnMore')} ↓</a>
      </div>
      <section id="benefits" className="vip-benefits">
        <div className="section-heading"><h2>{t('benefits')}</h2></div>
        {(['sync', 'groups', 'schedule'] as const).map(
          /** 每张权益卡只描述规划能力，不暗示当前可以开通。 */
          (key, index) => <div className="vip-benefit aether-card" key={key}>
            <span className={`vip-benefit__icon vip-benefit__icon--${index}`} aria-hidden="true">{['↻', '▣', '◷'][index]}</span>
            <div><strong>{t(`${key}Title`)}</strong><p>{t(`${key}Description`)}</p></div>
          </div>,
        )}
      </section>
    </div>
  );
}
