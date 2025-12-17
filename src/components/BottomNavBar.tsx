'use client';

import { useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl'

export default function BottomNavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('nav');

  const activeNav = useMemo(() => {
    if (pathname === '/player') return 'player';
    if (pathname === '/discover') return 'discover';
    if (pathname === '/leaderboard') return 'leaderboard';
    if (pathname === '/settings') return 'settings';
    return 'player'; // Default
  }, [pathname]);

  const navigateTo = (page: string) => {
    router.push(`/${page}`);
  };

  return (
    <div className="fixed bottom-0 left-0 w-full h-16 bg-white border border-gray-100 flex items-center justify-around px-2 z-50">
      <div
        className={`flex flex-col items-center justify-center w-16 h-full cursor-pointer ${
          activeNav !== 'player' ? 'opacity-50' : ''
        }`}
        onClick={() => navigateTo('player')}
      >
        <div
          className={`iconfont icon-reqiqiu text-2xl ${
            activeNav === 'player' ? 'border-black' : ''
          }`}
        ></div>
        <span
          className={`text-[10px] font-medium text-black leading-tight ${
            activeNav === 'player' ? 'font-bold' : ''
          }`}
        >
          {t('player')}
        </span>
      </div>

      <div
        className={`flex flex-col items-center justify-center w-16 h-full cursor-pointer ${
          activeNav !== 'discover' ? 'opacity-50' : ''
        }`}
        onClick={() => navigateTo('discover')}
      >
        <div
          className={`iconfont icon-sousuo3 text-2xl ${
            activeNav === 'discover' ? 'border-black' : ''
          }`}
        ></div>
        <span
          className={`text-[10px] font-medium text-black leading-tight ${
            activeNav === 'discover' ? 'font-bold' : ''
          }`}
        >
          {t('discover')}
        </span>
      </div>

      <div
        className={`flex flex-col items-center justify-center w-16 h-full cursor-pointer ${
          activeNav !== 'leaderboard' ? 'opacity-50' : ''
        }`}
        onClick={() => navigateTo('leaderboard')}
      >
        <div
          className={`iconfont icon-paixing text-2xl ${
            activeNav === 'leaderboard' ? 'border-black' : ''
          }`}
        ></div>
        <span
          className={`text-[10px] font-medium text-black leading-tight ${
            activeNav === 'leaderboard' ? 'font-bold' : ''
          }`}
        >
          {t('leaderboard')}
        </span>
      </div>

      <div
        className={`flex flex-col items-center justify-center w-16 h-full cursor-pointer ${
          activeNav !== 'settings' ? 'opacity-50' : ''
        }`}
        onClick={() => navigateTo('settings')}
      >
        <div
          className={`iconfont icon-shezhi1 text-2xl ${
            activeNav === 'settings' ? 'border-black' : ''
          }`}
        ></div>
        <span
          className={`text-[10px] font-medium text-black leading-tight ${
            activeNav === 'settings' ? 'font-bold' : ''
          }`}
        >
          {t('settings')}
        </span>
      </div>
    </div>
  );
}
