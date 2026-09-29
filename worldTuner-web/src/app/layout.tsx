import type { Metadata } from 'next';
import { getLocale, getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import BottomNavBar from '@/components/BottomNavBar';
import PlayerCard from '@/components/PlayerCard';
import PageViewReporter from '@/components/PageViewReporter';
import '../styles/global.scss';

export const metadata: Metadata = {
  title: 'worldTuner',
  description: '世界调谐器，探索世界的声音',
  icons: {
    icon: { url: '/favicon.png', sizes: '64x64', type: 'image/png' },
    apple: { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
  },
};

/** 注入双语、深浅主题与安卓端一致的常驻播放器和四栏导航。 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <PageViewReporter />
            <div className="app-root">
              <main className="app-center">{children}</main>
              <PlayerCard />
              <BottomNavBar />
            </div>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
