import { DEFAULT_LANGUAGE, GENERAL_FALLBACK_LANGUAGE, SupportedLanguage, normalizeLanguage } from '../shared/i18n'
import { ELECTRON_TEXT, ElectronTextKey } from '../shared/generated/electronText'

let currentLanguage: SupportedLanguage = DEFAULT_LANGUAGE

export function setElectronLanguage(language: unknown) {
  currentLanguage = normalizeLanguage(typeof language === 'string' ? language : undefined)
}

export function getElectronLanguage() {
  return currentLanguage
}

export function tElectron(key: ElectronTextKey) {
  return ELECTRON_TEXT[currentLanguage]?.[key]
    ?? ELECTRON_TEXT[GENERAL_FALLBACK_LANGUAGE]?.[key]
    ?? ELECTRON_TEXT[DEFAULT_LANGUAGE]?.[key]
    ?? key
}
