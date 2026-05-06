import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const defaultLanguage = 'zh-TW';
const localeRoot = path.join(root, 'src', 'i18n', 'locales');
const sourceRoots = ['src', 'shared', 'electron'];
const sourceExtensions = new Set(['.ts', '.tsx']);
const supportedLanguagesSource = fs.readFileSync(path.join(root, 'shared', 'i18n.ts'), 'utf8');
const supportedLanguagesMatch = supportedLanguagesSource.match(/SUPPORTED_LANGUAGES\s*=\s*\[([^\]]+)\]/);

if (!supportedLanguagesMatch) {
  throw new Error('Unable to read SUPPORTED_LANGUAGES from shared/i18n.ts');
}

const supportedLanguages = [...supportedLanguagesMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1]);

function readCatalog(language) {
  const filePath = path.join(localeRoot, language, 'translation.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing locale file: ${path.relative(root, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function flattenKeys(value, prefix = '') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key));
  }
  return [prefix];
}

function getValue(value, key) {
  return key.split('.').reduce((current, part) => (
    current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, part)
      ? current[part]
      : undefined
  ), value);
}

function walkFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'dist-electron' || entry.name === 'release') {
      continue;
    }
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(entryPath, files);
    } else if (sourceExtensions.has(path.extname(entry.name)) && !entry.name.startsWith('i18next.')) {
      files.push(entryPath);
    }
  }
  return files;
}

function collectStaticCodeKeys() {
  const keys = new Set();
  const callPattern = /\b(?:t|overlayText)\(\s*['"`]([^'"`$]+)['"`]/g;
  const memberCallPattern = /\b(?:i18n|i18nInstance)\.t\(\s*['"`]([^'"`$]+)['"`]/g;
  const catalogKeyLiteralPattern = /['"`]((?:about|common|domain|language|lyrics|miniPlayer|overlays|playbackControl|settings|shell|songList|songManagement|tasks|updatesPopup)\.[A-Za-z0-9_.-]+)['"`]/g;
  const addKey = (key) => {
    if (/\.(?:json|ts|tsx|js|mjs|cjs|png|svg)$/i.test(key)) return;
    keys.add(key);
  };

  for (const sourceRoot of sourceRoots) {
    for (const filePath of walkFiles(path.join(root, sourceRoot))) {
      const text = fs.readFileSync(filePath, 'utf8');
      for (const pattern of [callPattern, memberCallPattern, catalogKeyLiteralPattern]) {
        let match;
        while ((match = pattern.exec(text))) {
          addKey(match[1]);
        }
      }
    }
  }
  return keys;
}

const catalogs = Object.fromEntries(supportedLanguages.map(language => [language, readCatalog(language)]));
const defaultCatalog = catalogs[defaultLanguage];
const defaultKeys = new Set(flattenKeys(defaultCatalog));
const errors = [];

for (const language of supportedLanguages) {
  const languageKeys = new Set(flattenKeys(catalogs[language]));
  for (const key of defaultKeys) {
    if (!languageKeys.has(key)) errors.push(`${language} missing key: ${key}`);
  }
  for (const key of languageKeys) {
    if (!defaultKeys.has(key)) errors.push(`${language} has extra key not in ${defaultLanguage}: ${key}`);
    const value = getValue(catalogs[language], key);
    if (typeof value === 'string' && value.trim() === '') errors.push(`${language} has empty value: ${key}`);
  }
}

for (const key of collectStaticCodeKeys()) {
  if (!defaultKeys.has(key)) errors.push(`static source key missing from ${defaultLanguage}: ${key}`);
}

if (errors.length) {
  console.error(`i18n catalog check failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`i18n catalog check passed for ${supportedLanguages.join(', ')} (${defaultKeys.size} keys).`);
