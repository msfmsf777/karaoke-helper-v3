export const SUPPORTED_LANGUAGES = ['zh-TW', 'en'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'zh-TW';

export interface LanguageOption {
  code: SupportedLanguage;
  nativeName: string;
  englishName: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'zh-TW', nativeName: '繁體中文', englishName: 'Traditional Chinese' },
  { code: 'en', nativeName: 'English', englishName: 'English' },
];

export function isSupportedLanguage(language: unknown): language is SupportedLanguage {
  return typeof language === 'string'
    && (SUPPORTED_LANGUAGES as readonly string[]).includes(language);
}

export function normalizeLanguage(language: unknown): SupportedLanguage {
  if (isSupportedLanguage(language)) return language;

  const value = typeof language === 'string' ? language.toLowerCase() : '';
  if (value.startsWith('en')) return 'en';
  if (value === 'zh' || value.startsWith('zh-tw') || value.startsWith('zh-hant')) return 'zh-TW';

  return DEFAULT_LANGUAGE;
}
