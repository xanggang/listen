'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const visitorKey = 'worldtuner_anonymous_visitor_id';
let fallbackVisitorId: string | null = null;
let lastPath = '';
let lastSentAt = 0;

// 仅把已知页面映射为固定名称，不上报 URL 查询参数或用户输入。
function metricPage(pathname: string): string | null {
  const pages: Record<string, string> = {
    '/': 'map',
    '/discover': 'discover',
    '/leaderboard': 'charts',
    '/settings': 'settings',
    '/vip': 'vip',
    '/player': 'player',
  };
  return pages[pathname] ?? null;
}

// 浏览器本地保存随机 UUID；禁止访问存储时仅在当前页面会话复用。
function anonymousVisitorId(): string {
  try {
    const saved = window.localStorage.getItem(visitorKey);
    if (saved) return saved;
    const created = crypto.randomUUID();
    window.localStorage.setItem(visitorKey, created);
    return created;
  } catch {
    fallbackVisitorId ??= crypto.randomUUID();
    return fallbackVisitorId;
  }
}

// 路由变化时异步报告一次 PV；开发模式重复 effect 在短时间内合并。
export default function PageViewReporter() {
  const pathname = usePathname();

  useEffect(() => {
    const page = metricPage(pathname);
    if (!page) return;
    const now = Date.now();
    if (pathname === lastPath && now - lastSentAt < 1000) return;
    lastPath = pathname;
    lastSentAt = now;
    // 上报失败不影响页面显示，也不记录请求正文到控制台。
    void fetch('/api/metrics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId: anonymousVisitorId(), source: 'web', page }),
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
