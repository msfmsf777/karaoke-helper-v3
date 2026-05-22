import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_LOCALES = ['zh-TW', 'en', 'zh-CN', 'ja', 'ko', 'id', 'th'];
const DISPLAY_ORDER = ['zh-TW', 'en', 'zh-CN', 'ja', 'ko', 'id', 'th'];
const LOCALE_LABELS = {
  'zh-TW': '繁體中文',
  en: 'English',
  'zh-CN': '简体中文',
  ja: '日本語',
  ko: '한국어',
  id: 'Bahasa Indonesia',
  th: 'ไทย',
};

const rootDir = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = process.argv[2] || packageJson.version;
const sourcePath = path.join(rootDir, 'release-notes', `v${version}.json`);
const outputDir = path.join(rootDir, 'release', version);

if (!fs.existsSync(sourcePath)) {
  fail(`Missing release notes source: ${path.relative(rootDir, sourcePath)}`);
}

const catalog = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
validateCatalog(catalog, version);

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'release-notes.json'), `${JSON.stringify(catalog, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'GITHUB_RELEASE_BODY.md'), renderGithubBody(catalog));

console.log(`Generated localized release notes for v${version}`);

function validateCatalog(catalog, expectedVersion) {
  const errors = [];
  if (!catalog || typeof catalog !== 'object') {
    errors.push('catalog must be an object');
  }
  if (catalog.version !== expectedVersion) {
    errors.push(`catalog.version must be "${expectedVersion}"`);
  }
  if (!catalog.locales || typeof catalog.locales !== 'object') {
    errors.push('catalog.locales must be an object');
  } else {
    for (const locale of REQUIRED_LOCALES) {
      const notes = catalog.locales[locale];
      if (!notes) {
        errors.push(`missing locale: ${locale}`);
        continue;
      }
      if (!notes.title || typeof notes.title !== 'string') errors.push(`${locale}.title is required`);
      if (notes.summary !== undefined && typeof notes.summary !== 'string') errors.push(`${locale}.summary must be a string`);
      if (!Array.isArray(notes.sections) || notes.sections.length === 0) {
        errors.push(`${locale}.sections must be a non-empty array`);
      } else {
        notes.sections.forEach((section, index) => {
          if (!section.title || typeof section.title !== 'string') errors.push(`${locale}.sections[${index}].title is required`);
          if (section.body !== undefined && typeof section.body !== 'string') errors.push(`${locale}.sections[${index}].body must be a string`);
          if (section.items !== undefined && (!Array.isArray(section.items) || section.items.some((item) => typeof item !== 'string'))) {
            errors.push(`${locale}.sections[${index}].items must be an array of strings`);
          }
          if (section.body === undefined && section.items === undefined) {
            errors.push(`${locale}.sections[${index}] must include body or items`);
          }
        });
      }
    }
  }

  if (errors.length > 0) {
    fail(errors.join('\n'));
  }
}

function renderGithubBody(catalog) {
  const parts = [`# KHelper V${catalog.version}`, ''];

  for (const locale of DISPLAY_ORDER) {
    const notes = catalog.locales[locale];
    if (!notes) continue;

    const body = renderLocale(notes);
    if (locale === 'zh-TW' || locale === 'en') {
      parts.push(`## ${LOCALE_LABELS[locale]}`, '', body, '');
      continue;
    }

    parts.push(
      `<details>`,
      `<summary>${LOCALE_LABELS[locale]}</summary>`,
      '',
      body,
      '',
      `</details>`,
      '',
    );
  }

  return `${parts.join('\n').trim()}\n`;
}

function renderLocale(notes) {
  const lines = [`### ${notes.title}`];
  if (notes.summary) {
    lines.push('', notes.summary);
  }

  for (const section of notes.sections) {
    lines.push('', `#### ${section.title}`);
    if (section.body) {
      lines.push('', section.body);
    }
    if (section.items) {
      lines.push('', ...section.items.map((item) => `- ${item}`));
    }
  }

  return lines.join('\n');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
