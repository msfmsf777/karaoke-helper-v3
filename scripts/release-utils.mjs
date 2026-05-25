import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const rootDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export const productName = 'KHelperV3';
export const githubRepo = 'msfmsf777/karaoke-helper-v3';

const isWindows = process.platform === 'win32';

export function getPackageJson() {
  return JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
}

export function getVersion() {
  return getPackageJson().version;
}

export function getReleaseDir(version = getVersion()) {
  return path.join(rootDir, 'release', version);
}

export function getReleasePaths(version = getVersion()) {
  const releaseDir = getReleaseDir(version);
  const installerName = `${productName}-Setup-${version}.exe`;
  return {
    releaseDir,
    installer: path.join(releaseDir, installerName),
    blockmap: path.join(releaseDir, `${installerName}.blockmap`),
    latest: path.join(releaseDir, 'latest.yml'),
    notes: path.join(releaseDir, 'release-notes.json'),
    githubBody: path.join(releaseDir, 'GITHUB_RELEASE_BODY.md'),
  };
}

export function run(command, args = [], options = {}) {
  const resolvedCommand = resolveCommand(command);
  const commandArgs = getSpawnCommand(resolvedCommand, args);
  const result = spawnSync(commandArgs.command, commandArgs.args, {
    cwd: rootDir,
    env: { ...process.env, ...options.env },
    stdio: options.stdio ?? 'inherit',
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !options.allowFailure) {
    process.exit(result.status ?? 1);
  }

  return result;
}

export function capture(command, args = [], options = {}) {
  return run(command, args, {
    ...options,
    stdio: 'pipe',
    allowFailure: true,
  });
}

function getSpawnCommand(command, args) {
  if (!isWindows || !/\.(cmd|bat)$/i.test(command)) {
    return { command, args };
  }

  return {
    command: process.env.ComSpec ?? 'cmd.exe',
    args: ['/d', '/s', '/c', [quoteCmdArg(command), ...args.map(quoteCmdArg)].join(' ')],
  };
}

function quoteCmdArg(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=@-]+$/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function resolveCommand(command) {
  if (path.isAbsolute(command) || command.includes('/') || command.includes('\\')) {
    return command;
  }

  if (isWindows && command === 'gh') {
    const candidates = [
      path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'GitHub CLI', 'gh.exe'),
      path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'GitHub CLI', 'gh.exe'),
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'GitHub CLI', 'gh.exe') : '',
    ].filter(Boolean);

    const candidate = candidates.find((filePath) => fs.existsSync(filePath));
    if (candidate) return candidate;
  }

  return command;
}

export function runNodeScript(scriptPath, args = [], options = {}) {
  return run(process.execPath, [scriptPath, ...args], options);
}

export function runPackageBinary(binaryName, args = [], options = {}) {
  const nodeEntry = getNodePackageEntry(binaryName);
  if (nodeEntry) {
    return run(process.execPath, [nodeEntry, ...args], options);
  }

  const binaryPath = path.join(rootDir, 'node_modules', '.bin', `${binaryName}${isWindows ? '.cmd' : ''}`);
  return run(binaryPath, args, options);
}

function getNodePackageEntry(binaryName) {
  const entries = {
    tsc: path.join(rootDir, 'node_modules', 'typescript', 'bin', 'tsc'),
    vite: path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js'),
    'electron-builder': path.join(rootDir, 'node_modules', 'electron-builder', 'cli.js'),
  };

  const entry = entries[binaryName];
  return entry && fs.existsSync(entry) ? entry : null;
}

export function runBuildPipeline({ signed }) {
  const env = signed
    ? {
        KH_SIGN_RELEASE: '1',
        CSC_IDENTITY_AUTO_DISCOVERY: 'false',
      }
    : {
        KH_SIGN_RELEASE: '0',
        CSC_IDENTITY_AUTO_DISCOVERY: 'false',
      };

  runNodeScript('scripts/generate-i18n-registry.mjs', [], { env });
  runNodeScript('scripts/clean-build.mjs', [], { env });
  runPackageBinary('tsc', [], { env });
  runPackageBinary('vite', ['build'], { env });
  runPackageBinary('electron-builder', ['--win', '--config', 'electron-builder.config.mjs', '--publish', 'never'], { env });
  runNodeScript('scripts/generate-release-notes.mjs', [], { env });
  runNodeScript('scripts/validate-release-artifacts.mjs', [], { env });
}

export function loadEnvFile(fileName = '.env.release.local') {
  const envPath = path.join(rootDir, fileName);
  if (!fs.existsSync(envPath)) {
    return { loaded: false, path: envPath };
  }

  const text = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    value = value.replace(/^(['"])(.*)\1$/, '$2');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  return { loaded: true, path: envPath };
}

export function requireEnv(keys) {
  const missing = keys.filter((key) => !process.env[key] || process.env[key]?.includes('PASTE_'));
  if (missing.length > 0) {
    console.error(`Missing required release environment values: ${missing.join(', ')}`);
    console.error('Fill .env.release.local or set the values in your shell, then retry.');
    process.exit(1);
  }
}

export function requireFiles(files) {
  const missing = files.filter((filePath) => !fs.existsSync(filePath));
  if (missing.length > 0) {
    console.error('Missing required release files:');
    for (const filePath of missing) {
      console.error(`- ${path.relative(rootDir, filePath)}`);
    }
    process.exit(1);
  }
}

export function releaseTag(version = getVersion()) {
  return `v${version}`;
}
