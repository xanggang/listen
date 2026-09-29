'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const items = [
  { href: '/player', key: 'player', icon: 'icon-reqiqiu' },
  { href: '/discover', key: 'discover', icon: 'icon-sousuo3' },
  { href: '/leaderboard', key: 'leaderboard', icon: 'icon-paixing' },
  { href: '/settings', key: 'settings', icon: 'icon-shezhi1' },
] as const;

/** 以安卓端四栏导航的尺寸和选中态展示 Web 路由。 */
export default function BottomNavBar() {
  const pathname = usePathname();
  const t = useTranslations('nav');

  return (
    <nav className="aether-nav" aria-label="Main navigation">
      <div className="aether-nav__inner">
        {items.map(
          /** 固定路由与标签一一对应，当前页使用可访问的 aria-current。 */
          (item) => (
            <Link
              key={item.href}
              href={item.href}
              className="aether-nav__item"
              aria-current={pathname === item.href || (pathname === '/vip' && item.href === '/settings') ? 'page' : undefined}
            >
              <span className={`aether-nav__symbol iconfont ${item.icon}`} aria-hidden="true" />
              <span>{t(item.key)}</span>
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
