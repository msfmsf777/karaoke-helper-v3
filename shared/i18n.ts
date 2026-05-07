import { LOCALE_ALIAS_MAP, LOCALE_REGISTRY, SUPPORTED_LANGUAGES as GENERATED_SUPPORTED_LANGUAGES } from './generated/i18nRegistry';

export const SUPPORTED_LANGUAGES = GENERATED_SUPPORTED_LANGUAGES;

export type SupportedLanguage = (typeof GENERATED_SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'zh-TW';
export const GENERAL_FALLBACK_LANGUAGE: SupportedLanguage = 'en';

export interface LanguageOption {
  code: SupportedLanguage;
  nativeName: string;
  englishName: string;
  flag: string;
  direction: 'ltr' | 'rtl';
  enabled: boolean;
  aliases: readonly string[];
}

export const LANGUAGE_OPTIONS: LanguageOption[] = LOCALE_REGISTRY
  .filter((locale) => locale.enabled)
  .map((locale) => ({
    code: locale.code,
    nativeName: locale.nativeName,
    englishName: locale.englishName,
    flag: locale.flag,
    direction: locale.direction,
    enabled: locale.enabled,
    aliases: locale.aliases,
  }));

export function isSupportedLanguage(language: unknown): language is SupportedLanguage {
  return typeof language === 'string'
    && (SUPPORTED_LANGUAGES as readonly string[]).includes(language);
}

export function normalizeLanguage(language: unknown): SupportedLanguage {
  if (isSupportedLanguage(language)) return language;

  const value = typeof language === 'string' ? language.toLowerCase() : '';
  const aliased = LOCALE_ALIAS_MAP[value as keyof typeof LOCALE_ALIAS_MAP];
  if (aliased) return aliased;

  const baseLanguage = value.split('-')[0];
  const baseMatch = LOCALE_ALIAS_MAP[baseLanguage as keyof typeof LOCALE_ALIAS_MAP];
  if (baseMatch) return baseMatch;

  return DEFAULT_LANGUAGE;
}
