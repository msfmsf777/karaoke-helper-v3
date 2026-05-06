import { defineConfig } from 'i18next-cli';

export default defineConfig({
  locales: ['zh-TW', 'en'],
  extract: {
    input: [
      'src/**/*.{ts,tsx}',
      'shared/**/*.ts',
      'electron/**/*.ts',
    ],
    ignore: [
      'node_modules/**',
      'dist/**',
      'dist-electron/**',
      'release/**',
      'src/i18n/i18next*.d.ts',
    ],
    output: 'src/i18n/locales/{{language}}/{{namespace}}.json',
    defaultNS: 'translation',
    keySeparator: '.',
    nsSeparator: ':',
    functions: ['t', '*.t', 'i18n.t', 'i18nInstance.t'],
    primaryLanguage: 'zh-TW',
    secondaryLanguages: ['en'],
    removeUnusedKeys: false,
    disablePlurals: true,
    sort: false,
    indentation: 2,
    preservePatterns: [
      'common.*',
      'domain.*',
      'language.*',
      'lyrics.*',
      'miniPlayer.*',
      'overlays.*',
      'settings.*',
      'shell.*',
      'songList.*',
      'songManagement.*',
    ],
  },
  lint: {
    ignore: [
      'node_modules/**',
      'dist/**',
      'dist-electron/**',
      'release/**',
      'src/i18n/i18next*.d.ts',
    ],
  },
  types: {
    input: 'src/i18n/locales/zh-TW/*.json',
    output: 'scripts/generated/i18n/i18next.d.ts',
    resourcesFile: 'scripts/generated/i18n/i18next-resources.d.ts',
  },
});
