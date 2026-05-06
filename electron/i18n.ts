import { DEFAULT_LANGUAGE, SupportedLanguage, normalizeLanguage } from '../shared/i18n'

type ElectronTextKey =
  | 'tray.checkingUpdates'
  | 'tray.checkUpdates'
  | 'tray.openMainWindow'
  | 'tray.settings'
  | 'tray.quit'
  | 'dialog.deleteSong.title'
  | 'dialog.deleteSong.message'
  | 'dialog.cancel'
  | 'dialog.delete'

const electronText: Record<SupportedLanguage, Record<ElectronTextKey, string>> = {
  'zh-TW': {
    'tray.checkingUpdates': '檢查更新中...',
    'tray.checkUpdates': '檢查更新',
    'tray.openMainWindow': '開啟主視窗',
    'tray.settings': '設定',
    'tray.quit': '退出',
    'dialog.deleteSong.title': '刪除歌曲',
    'dialog.deleteSong.message': '確定要刪除這首歌曲嗎？此操作無法復原。',
    'dialog.cancel': '取消',
    'dialog.delete': '刪除',
  },
  en: {
    'tray.checkingUpdates': 'Checking for updates...',
    'tray.checkUpdates': 'Check for Updates',
    'tray.openMainWindow': 'Open Main Window',
    'tray.settings': 'Settings',
    'tray.quit': 'Quit',
    'dialog.deleteSong.title': 'Delete Song',
    'dialog.deleteSong.message': 'Delete this song? This cannot be undone.',
    'dialog.cancel': 'Cancel',
    'dialog.delete': 'Delete',
  },
}

let currentLanguage: SupportedLanguage = DEFAULT_LANGUAGE

export function setElectronLanguage(language: unknown) {
  currentLanguage = normalizeLanguage(typeof language === 'string' ? language : undefined)
}

export function getElectronLanguage() {
  return currentLanguage
}

export function tElectron(key: ElectronTextKey) {
  return electronText[currentLanguage]?.[key] ?? electronText[DEFAULT_LANGUAGE][key]
}
