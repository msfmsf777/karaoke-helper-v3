import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, normalizeLanguage } from '../../shared/i18n';
import en from './locales/en/translation.json';
import zhTW from './locales/zh-TW/translation.json';

export const resources = {
  'zh-TW': {
    translation: zhTW,
  },
  en: {
    translation: en,
  },
} as const;

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: normalizeLanguage(navigator.language),
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: ['zh-TW', 'en'],
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });
}

export default i18n;
