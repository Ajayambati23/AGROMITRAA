'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { useTranslation } from '@/hooks/useTranslation';
import { Globe, Sprout } from 'lucide-react';

const languages = [
  { code: 'english', name: 'English', flag: '🇺🇸' },
  { code: 'hindi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'telugu', name: 'తెలుగు', flag: '🇮🇳' },
  { code: 'kannada', name: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'tamil', name: 'தமிழ்', flag: '🇮🇳' },
  { code: 'malayalam', name: 'മലയാളം', flag: '🇮🇳' },
];

export default function Header() {
  const { state, logout, setLanguage } = useApp();
  const { t } = useTranslation();
  const router = useRouter();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const currentLanguage = languages.find(lang => lang.code === state.selectedLanguage) || languages[0];

  if (state.isAuthenticated) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowLanguageMenu(!showLanguageMenu)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[#d9e4d9] bg-white/90 text-gray-800 hover:bg-white transition-all duration-300 min-h-[44px]"
        >
          <Globe className="w-4 h-4" />
          <span>{currentLanguage.flag}</span>
          <span className="text-sm font-medium">{currentLanguage.name}</span>
        </button>
        {showLanguageMenu && (
          <div className="absolute right-0 mt-2 w-48 glass-panel rounded-2xl shadow-lg z-50 py-2">
            {languages.map((language) => (
              <button
                key={language.code}
                onClick={() => {
                  setLanguage(language.code);
                  setShowLanguageMenu(false);
                }}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors rounded-xl mx-2 ${
                  state.selectedLanguage === language.code ? 'bg-green-600 text-white font-medium' : 'text-gray-800'
                }`}
              >
                <span>{language.flag}</span>
                <span>{language.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <header className="glass-panel border-b border-[#d9e4d9] shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div
            onClick={() => router.push('/')}
            className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
          >
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <span className="text-xl">🌾</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-green-700">{t('appName')}</h1>
              <p className="text-gray-500 text-xs">{t('tagline')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <button
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Globe className="w-4 h-4" />
                <span>{currentLanguage.flag}</span>
                <span className="hidden sm:inline text-sm">{currentLanguage.name}</span>
              </button>
              {showLanguageMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-2">
                  {languages.map((language) => (
                    <button
                      key={language.code}
                      onClick={() => {
                        setLanguage(language.code);
                        setShowLanguageMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 transition-colors rounded-lg mx-1 ${
                        state.selectedLanguage === language.code ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      <span>{language.flag}</span>
                      <span>{language.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {null}
          </div>
        </div>
      </div>

    </header>
  );
}
