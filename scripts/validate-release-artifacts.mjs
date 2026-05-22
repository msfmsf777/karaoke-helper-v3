import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_LOCALES = ['zh-TW', 'en', 'zh-CN', 'ja', 'ko', 'id', 'th'];
const rootDir = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = process.argv[2] || packageJson.version;
const releaseDir = path.join(rootDir, 'release', version);
const errors = [];

if (!fs.existsSync(releaseDir)) {
  fail([`Missing release directory: ${path.relative(rootDir, releaseDir)}`]);
}

validateLatestYml();
validateReleaseNotes();
validateGithubBody();

if (errors.length > 0) {
  fail(errors);
}

console.log(`Release artifacts for v${version} are valid.`);

function validateLatestYml() {
  const latestPath = path.join(releaseDir, 'latest.yml');
  if (!fs.existsSync(latestPath)) {
    errors.push('missing latest.yml');
    return;
  }

  const latest = fs.readFileSync(latestPath, 'utf8');
  const latestVersion = matchValue(latest, /^version:\s*(.+)$/m);
  if (latestVersion !== version) {
    errors.push(`latest.yml version "${latestVersion ?? 'missing'}" does not match package version "${version}"`);
  }

  const references = new Set();
  for (const match of latest.matchAll(/^\s*-\s*url:\s*(.+)$/gm)) references.add(cleanYamlValue(match[1]));
  for (const match of latest.matchAll(/^\s*path:\s*(.+)$/gm)) references.add(cleanYamlValue(match[1]));

  if (references.size === 0) {
    errors.push('latest.yml does not reference an installer');
  }

  for (const reference of references) {
    const filePath = resolveReleaseFile(reference);
    if (!filePath) {
      errors.push(`latest.yml references missing file: ${reference}`);
      continue;
    }

    if (filePath.toLowerCase().endsWith('.exe')) {
      const blockmapPath = `${filePath}.blockmap`;
      if (!fs.existsSync(blockmapPath)) {
        errors.push(`missing blockmap for installer: ${path.basename(filePath)}.blockmap`);
      }
    }
  }
}

function validateReleaseNotes() {
  const notesPath = path.join(releaseDir, 'release-notes.json');
  if (!fs.existsSync(notesPath)) {
    errors.push('missing release-notes.json');
    return;
  }

  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(notesPath, 'utf8'));
  } catch (error) {
    errors.push(`release-notes.json is invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  if (catalog.version !== version) {
    errors.push(`release-notes.json version "${catalog.version ?? 'missing'}" does not match package version "${version}"`);
  }

  for (const locale of REQUIRED_LOCALES) {
    const notes = catalog.locales?.[locale];
    if (!notes) {
      errors.push(`release-notes.json missing locale: ${locale}`);
      continue;
    }
    if (!notes.title || typeof notes.title !== 'string') errors.push(`${locale}.title is required`);
    if (!Array.isArray(notes.sections) || notes.sections.length === 0) errors.push(`${locale}.sections must be a non-empty array`);
  }
}

function validateGithubBody() {
  const bodyPath = path.join(releaseDir, 'GITHUB_RELEASE_BODY.md');
  if (!fs.existsSync(bodyPath)) {
    errors.push('missing GITHUB_RELEASE_BODY.md');
    return;
  }

  const body = fs.readFileSync(bodyPath, 'utf8').trim();
  if (!body) errors.push('GITHUB_RELEASE_BODY.md is empty');
}

function matchValue(text, pattern) {
  const match = text.match(pattern);
  return match ? cleanYamlValue(match[1]) : null;
}

function cleanYamlValue(value) {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function resolveReleaseFile(reference) {
  const direct = path.join(releaseDir, reference);
  if (fs.existsSync(direct)) return direct;

  try {
    const decoded = path.join(releaseDir, decodeURIComponent(reference));
    if (fs.existsSync(decoded)) return decoded;
  } catch {
    // Keep the original missing-file error.
  }

  return null;
}

function fail(messages) {
  for (const message of messages) console.error(message);
  process.exit(1);
}
