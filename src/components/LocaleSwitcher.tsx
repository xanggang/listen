'use client';

import { useLocale } from 'next-intl';
import { setUserLocale } from '@/i18n/service';
import { locales } from '@/i18n/config';

export default function LocaleSwitcher() {
  const locale = useLocale();

  const onChange = (value: string) => {
    const nextLocale = value;
    setUserLocale(nextLocale);
  };

  return (
    <div className="flex gap-2">
      {locales.map((cur) => (
        <button
          key={cur}
          onClick={() => onChange(cur)}
          className={`px-3 py-1 rounded border ${
            locale === cur
              ? 'bg-blue-500 text-white border-blue-500'
              : 'bg-white text-black border-gray-300 hover:bg-gray-50'
          }`}
        >
          {cur === 'en' ? 'English' : '中文'}
        </button>
      ))}
    </div>
  );
}
