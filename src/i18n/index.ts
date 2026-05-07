import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, GENERAL_FALLBACK_LANGUAGE, SUPPORTED_LANGUAGES, normalizeLanguage } from '../../shared/i18n';

const localeModules = import.meta.glob<Record<string, unknown>>('./locales/*/translation.json', {
  eager: true,
  import: 'default',
});

export const resources = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((language) => [
    language,
    {
      translation: localeModules[`./locales/${language}/translation.json`] ?? {},
    },
  ]),
);

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: normalizeLanguage(navigator.language),
      fallbackLng: [GENERAL_FALLBACK_LANGUAGE, DEFAULT_LANGUAGE],
      supportedLngs: [...SUPPORTED_LANGUAGES],
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });
}

export default i18n;
