'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { setUserLocale } from '@/i18n/service';
import { locales } from '@/i18n/config';

// Helper to get language name
const getLanguageName = (locale: string) => {
  switch (locale) {
    case 'en':
      return 'English';
    case 'zh':
      return '简体中文';
    default:
      return locale;
  }
};

export default function SettingsPage() {
  const t = useTranslations('settings');
  const currentLocale = useLocale();
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [nightMode, setNightMode] = useState(false);
  const [autoCenterOnPlay, setAutoCenterOnPlay] = useState(true);

  const toggleNightMode = () => {
    setNightMode(!nightMode);
    // In a real app, you'd update a theme context or similar here
  };

  const toggleAutoCenter = () => {
    setAutoCenterOnPlay(!autoCenterOnPlay);
  };

  const handleLanguageSelect = (locale: string) => {
    setUserLocale(locale);
    setShowLanguageModal(false);
  };

  const handleClearCacheClick = () => {
    console.log('Clear cache clicked');
  };

  const handleAboutClick = () => {
    console.log('About clicked');
  };

  return (
    <div className="phone-container w-full h-full bg-white overflow-hidden relative pb-16">
      <div className="p-6 pt-12 space-y-8">
        {/* Title */}
        <h1 className="text-3xl font-extrabold text-black tracking-tight">
          {t('setting')}
        </h1>

        {/* Settings Groups */}
        <div className="space-y-6">
          {/* Group 1: Preferences */}
          <div>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 px-2">
              {t('preferences')}
            </h2>
            <div className="bg-gray-50 rounded-2xl overflow-hidden">
              {/* Language Item */}
              <div
                className="flex items-center justify-between p-5 border-b border-gray-200 cursor-pointer active:bg-gray-100"
                onClick={() => setShowLanguageModal(true)}
              >
                <span className="text-lg font-medium text-black">
                  {t('language')}
                </span>
                <div className="flex items-center text-gray-500">
                  <span className="mr-3">{getLanguageName(currentLocale)}</span>
                  {/* Chevron Right Icon */}
                  <div className="w-2 h-2 border-t-2 border-r-2 border-gray-400 transform rotate-45"></div>
                </div>
              </div>
              {/* Night Mode Item */}
              <div
                className="flex items-center justify-between p-5 cursor-pointer"
                onClick={toggleNightMode}
              >
                <span className="text-lg font-medium text-black">
                  {t('nightMode')}
                </span>
                {/* Toggle Switch */}
                <div
                  className={`w-12 h-6 rounded-full relative transition-colors duration-200 ease-in-out ${
                    nightMode ? 'bg-black' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out ${
                      nightMode ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Group 2: Map Settings (Hidden in Vue code, but implemented here for completeness if needed) */}
          {/*
          <div>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 px-2">Map Options</h2>
            <div className="bg-gray-50 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-gray-200" onClick={toggleAutoCenter}>
                <span className="text-lg font-medium text-black">Auto-Center on Play</span>
                <div className={`w-12 h-6 rounded-full relative transition-colors duration-200 ease-in-out ${autoCenterOnPlay ? 'bg-black' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out ${autoCenterOnPlay ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </div>
              </div>
              <div className="flex items-center justify-between p-5 cursor-pointer active:bg-gray-100" onClick={handleClearCacheClick}>
                <span className="text-lg font-medium text-black">Clear Map Cache</span>
                <div className="w-2 h-2 border-t-2 border-r-2 border-gray-400 transform rotate-45"></div>
              </div>
            </div>
          </div>
          */}

          {/* Group 3: About */}
          <div>
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mt-8">
              <div
                className="flex items-center justify-center p-5 cursor-pointer active:bg-gray-50 text-black font-medium"
                onClick={handleAboutClick}
              >
                About GeoRadio v1.0
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Language Selection Modal */}
      {showLanguageModal && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-end justify-center">
          <div className="w-full bg-white rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-black">{t('language')}</h3>
              <button
                onClick={() => setShowLanguageModal(false)}
                className="text-gray-500 hover:text-black p-2"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              {locales.map((locale) => (
                <div
                  key={locale}
                  className={`flex items-center justify-between p-4 rounded-xl cursor-pointer ${
                    currentLocale === locale
                      ? 'bg-gray-100 text-black font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                  onClick={() => handleLanguageSelect(locale)}
                >
                  <span>{getLanguageName(locale)}</span>
                  {currentLocale === locale && (
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
