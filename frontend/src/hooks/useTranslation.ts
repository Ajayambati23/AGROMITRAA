import { useApp } from '@/contexts/AppContext';
import { translations, TranslationKey } from '@/lib/translations';

export function useTranslation() {
  const { state } = useApp();
  const language = state.selectedLanguage as keyof typeof translations;
  
  const t = (key: TranslationKey): string => {
    const translation = translations[language] || translations.english;
    const value = translation[key] ?? translations.english[key];
    return typeof value === 'string' ? value : key;
  };
  
  return { t, language };
}
