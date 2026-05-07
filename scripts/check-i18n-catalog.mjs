import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const defaultLanguage = 'zh-TW';
const generalFallbackLanguage = 'en';
const localeRoot = path.join(root, 'src', 'i18n', 'locales');
const flagsRoot = path.join(root, 'src', 'assets', 'flags');
const sourceRoots = ['src', 'shared', 'electron'];
const sourceExtensions = new Set(['.ts', '.tsx']);
const errors = [];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`Invalid JSON: ${path.relative(root, filePath)} (${error.message})`);
    return {};
  }
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

function placeholderSet(value) {
  if (typeof value !== 'string') return new Set();
  return new Set([...value.matchAll(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g)].map(match => match[1]));
}

function sameSet(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
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
  const catalogKeyLiteralPattern = /['"`]((?:about|common|domain|electron|language|lyrics|miniPlayer|overlays|playbackControl|settings|shell|songList|songManagement|tasks|updatesPopup)\.[A-Za-z0-9_.-]+)['"`]/g;
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

function loadLocales() {
  if (!fs.existsSync(localeRoot)) {
    errors.push('Missing locale root: src/i18n/locales');
    return [];
  }

  const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  return fs.readdirSync(localeRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map((entry) => {
      const code = entry.name;
      const metaPath = path.join(localeRoot, code, 'meta.json');
      const translationPath = path.join(localeRoot, code, 'translation.json');

      if (!fs.existsSync(metaPath)) {
        errors.push(`${code} missing meta.json`);
      }
      if (!fs.existsSync(translationPath)) {
        errors.push(`${code} missing translation.json`);
      }

      const meta = fs.existsSync(metaPath) ? readJson(metaPath) : {};
      const catalog = fs.existsSync(translationPath) ? readJson(translationPath) : {};

      if (meta.code !== code) errors.push(`${code}/meta.json code must match folder name`);
      for (const field of ['nativeName', 'englishName', 'flag', 'direction']) {
        if (typeof meta[field] !== 'string' || meta[field].trim() === '') {
          errors.push(`${code}/meta.json missing string field: ${field}`);
        }
      }
      if (meta.enabled !== true) errors.push(`${code}/meta.json enabled must be true`);
      if (meta.direction !== 'ltr' && meta.direction !== 'rtl') errors.push(`${code}/meta.json direction must be "ltr" or "rtl"`);
      if (!Array.isArray(meta.aliases) || meta.aliases.some(alias => typeof alias !== 'string')) {
        errors.push(`${code}/meta.json aliases must be an array of strings`);
      }
      if (typeof meta.flag === 'string' && !fs.existsSync(path.join(flagsRoot, `${meta.flag}.svg`))) {
        errors.push(`${code}/meta.json references missing flag: src/assets/flags/${meta.flag}.svg`);
      }

      return { code, meta, catalog };
    })
    .sort((a, b) => collator.compare(a.code, b.code));
}

const locales = loadLocales();
const supportedLanguages = locales.map(locale => locale.code);

if (!supportedLanguages.includes(defaultLanguage)) errors.push(`Missing default locale: ${defaultLanguage}`);
if (!supportedLanguages.includes(generalFallbackLanguage)) errors.push(`Missing general fallback locale: ${generalFallbackLanguage}`);

const catalogs = Object.fromEntries(locales.map(locale => [locale.code, locale.catalog]));
const defaultCatalog = catalogs[defaultLanguage] ?? {};
const fallbackCatalog = catalogs[generalFallbackLanguage] ?? {};
const defaultKeys = new Set(flattenKeys(defaultCatalog));
const fallbackKeys = new Set(flattenKeys(fallbackCatalog));

for (const key of defaultKeys) {
  if (!fallbackKeys.has(key)) {
    errors.push(`${generalFallbackLanguage} missing fallback key: ${key}`);
  }
}

for (const language of supportedLanguages) {
  const languageKeys = new Set(flattenKeys(catalogs[language]));
  const mustBeComplete = language === defaultLanguage || language === generalFallbackLanguage;

  for (const key of languageKeys) {
    if (!defaultKeys.has(key)) {
      errors.push(`${language} has extra key not in ${defaultLanguage}: ${key}`);
      continue;
    }

    const value = getValue(catalogs[language], key);
    if (typeof value === 'string' && value.trim() === '') errors.push(`${language} has empty value: ${key}`);

    const defaultValue = getValue(defaultCatalog, key);
    if (typeof value === 'string' && typeof defaultValue === 'string' && !sameSet(placeholderSet(value), placeholderSet(defaultValue))) {
      errors.push(`${language} placeholder mismatch: ${key}`);
    }
  }

  if (mustBeComplete) {
    for (const key of defaultKeys) {
      if (!languageKeys.has(key)) errors.push(`${language} missing required key: ${key}`);
    }
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

console.log(`i18n catalog check passed for ${supportedLanguages.join(', ')} (${defaultKeys.size} source keys, fallback via ${generalFallbackLanguage} -> ${defaultLanguage}).`);
