import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { HotkeyConfig, mergeHotkeyConfig } from '../shared/hotkeys';
import { SongListViewConfigs, mergeSongListViewConfigs } from '../shared/songListView';
import { OverlayTemplatesConfig, mergeOverlayTemplatesConfig } from '../shared/overlayTemplates';
import { SupportedLanguage, normalizeLanguage } from '../shared/i18n';

export interface UserData {
    favorites: string[];
    history: string[];
    separationQuality: 'high' | 'normal' | 'fast';
}

const FAVORITES_FILE = 'favorites.json';
const HISTORY_FILE = 'history.json';
const SETTINGS_FILE = 'settings.json';
const SETTINGS_BACKUP_DIR = 'settings-backups';
const SETTINGS_PRE_SAVE_PREFIX = 'settings-pre-save-';
const SETTINGS_CORRUPT_PREFIX = 'settings-corrupt-';
const MAX_PRE_SAVE_BACKUPS = 50;
const MAX_CORRUPT_BACKUPS = 10;

export type SettingsLoadStatus = 'ok' | 'missing' | 'restored-from-backup' | 'corrupt-defaulted';

export interface SettingsLoadResult {
    settings: UserSettings;
    status: SettingsLoadStatus;
    sourcePath: string;
    backupPath?: string;
    quarantinedPath?: string;
    unsafeToAutoPersist: boolean;
}

let settingsTempCounter = 0;
let settingsBackupCounter = 0;
let didCreatePreSaveBackup = false;
let settingsSaveInFlight: Promise<void> | null = null;
let pendingSettings: UserSettings | null = null;

function getUserDataPath(filename: string): string {
    return path.join(app.getPath('userData'), filename);
}

function getSettingsBackupDir(): string {
    return path.join(app.getPath('userData'), SETTINGS_BACKUP_DIR);
}

function isMissingFileError(err: unknown): boolean {
    return Boolean(err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'ENOENT');
}

function isExpectedMissingOrJsonError(err: unknown): boolean {
    return isMissingFileError(err) || err instanceof SyntaxError || (err instanceof Error && err.message.includes('JSON'));
}

function createTimestamp(): string {
    return `${new Date().toISOString().replace(/\D/g, '')}${String(settingsBackupCounter += 1).padStart(3, '0')}`;
}

function createDefaultSettings(): UserSettings {
    return {
        separationQuality: 'normal',
        hotkeys: mergeHotkeyConfig(),
        songListViews: {},
        overlayTemplates: mergeOverlayTemplatesConfig(),
    };
}

function normalizeSettings(settings: Partial<UserSettings> | null | undefined): UserSettings {
    const parsed = settings ?? {};
    return {
        ...parsed,
        separationQuality: parsed.separationQuality || 'normal',
        language: parsed.language ? normalizeLanguage(parsed.language) : undefined,
        hotkeys: mergeHotkeyConfig(parsed.hotkeys),
        songListViews: mergeSongListViewConfigs(parsed.songListViews),
        overlayTemplates: mergeOverlayTemplatesConfig(parsed.overlayTemplates, parsed.lyricStyles),
    };
}

async function writeAtomic(filename: string, data: unknown) {
    const filePath = getUserDataPath(filename);
    const tmpPath = filePath + '.tmp';
    try {
        await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
        await fs.rename(tmpPath, filePath);
    } catch (err) {
        // If rename fails (e.g. file locked), try to unlink tmp
        try { await fs.unlink(tmpPath); } catch { /* ignore tmp cleanup errors */ }
        throw err;
    }
}

async function writeSettingsAtomic(data: UserSettings) {
    const filePath = getUserDataPath(SETTINGS_FILE);
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${settingsTempCounter += 1}.tmp`;
    let handle: fs.FileHandle | null = null;

    try {
        handle = await fs.open(tmpPath, 'w');
        await handle.writeFile(JSON.stringify(data, null, 2), 'utf-8');
        try {
            await handle.sync();
        } catch (err) {
            console.warn('[UserData] Failed to flush settings temp file before rename', err);
        }
        await handle.close();
        handle = null;
        await fs.rename(tmpPath, filePath);
    } catch (err) {
        if (handle) {
            try { await handle.close(); } catch { /* ignore close errors during cleanup */ }
        }
        try { await fs.unlink(tmpPath); } catch { /* ignore tmp cleanup errors */ }
        throw err;
    }
}

async function readSettingsFile(filePath: string): Promise<UserSettings> {
    const content = await fs.readFile(filePath, 'utf-8');
    return normalizeSettings(JSON.parse(content) as UserSettings);
}

async function pruneBackupsByPrefix(prefix: string, keep: number) {
    const backupDir = getSettingsBackupDir();

    try {
        const entries = await fs.readdir(backupDir, { withFileTypes: true });
        const files = await Promise.all(
            entries
                .filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith('.json'))
                .map(async (entry) => {
                    const filePath = path.join(backupDir, entry.name);
                    const stat = await fs.stat(filePath);
                    return { filePath, name: entry.name, mtimeMs: stat.mtimeMs };
                }),
        );

        files
            .sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name))
            .slice(keep)
            .forEach((file) => {
                void fs.unlink(file.filePath).catch((err) => {
                    console.warn('[UserData] Failed to prune settings backup', file.filePath, err);
                });
            });
    } catch (err) {
        if (!isMissingFileError(err)) {
            console.warn('[UserData] Failed to prune settings backups', err);
        }
    }
}

async function pruneSettingsBackups() {
    await Promise.all([
        pruneBackupsByPrefix(SETTINGS_PRE_SAVE_PREFIX, MAX_PRE_SAVE_BACKUPS),
        pruneBackupsByPrefix(SETTINGS_CORRUPT_PREFIX, MAX_CORRUPT_BACKUPS),
    ]);
}

async function createPreSaveBackupIfNeeded() {
    if (didCreatePreSaveBackup) return;
    didCreatePreSaveBackup = true;

    const filePath = getUserDataPath(SETTINGS_FILE);
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        JSON.parse(content);
        const backupDir = getSettingsBackupDir();
        await fs.mkdir(backupDir, { recursive: true });
        const backupPath = path.join(backupDir, `${SETTINGS_PRE_SAVE_PREFIX}${createTimestamp()}.json`);
        await fs.writeFile(backupPath, content, 'utf-8');
        await pruneSettingsBackups();
    } catch (err) {
        if (!isMissingFileError(err)) {
            console.warn('[UserData] Skipping pre-save settings backup because current settings are not readable', err);
        }
    }
}

async function quarantineCorruptSettings(filePath: string): Promise<string | undefined> {
    try {
        const backupDir = getSettingsBackupDir();
        await fs.mkdir(backupDir, { recursive: true });
        const quarantinedPath = path.join(backupDir, `${SETTINGS_CORRUPT_PREFIX}${createTimestamp()}.json`);
        await fs.copyFile(filePath, quarantinedPath);
        await pruneSettingsBackups();
        return quarantinedPath;
    } catch (err) {
        console.warn('[UserData] Failed to quarantine corrupt settings', err);
        return undefined;
    }
}

async function findNewestValidSettingsBackup(): Promise<{ filePath: string; settings: UserSettings } | null> {
    const backupDir = getSettingsBackupDir();

    try {
        const entries = await fs.readdir(backupDir, { withFileTypes: true });
        const candidates = await Promise.all(
            entries
                .filter((entry) => entry.isFile() && entry.name.startsWith(SETTINGS_PRE_SAVE_PREFIX) && entry.name.endsWith('.json'))
                .map(async (entry) => {
                    const filePath = path.join(backupDir, entry.name);
                    const stat = await fs.stat(filePath);
                    return { filePath, name: entry.name, mtimeMs: stat.mtimeMs };
                }),
        );

        candidates.sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name));
        for (const candidate of candidates) {
            try {
                return {
                    filePath: candidate.filePath,
                    settings: await readSettingsFile(candidate.filePath),
                };
            } catch (err) {
                console.warn('[UserData] Ignoring invalid settings backup', candidate.filePath, err);
            }
        }
    } catch (err) {
        if (!isMissingFileError(err)) {
            console.warn('[UserData] Failed to inspect settings backups', err);
        }
    }

    return null;
}

async function saveSettingsNow(settings: UserSettings): Promise<void> {
    const normalized = normalizeSettings(settings);
    await createPreSaveBackupIfNeeded();
    await writeSettingsAtomic(normalized);
    await pruneSettingsBackups();
}

async function runSettingsSaveQueue(): Promise<void> {
    while (pendingSettings) {
        const nextSettings = pendingSettings;
        pendingSettings = null;
        await saveSettingsNow(nextSettings);
    }
}

export async function saveFavorites(songIds: string[]): Promise<void> {
    try {
        await writeAtomic(FAVORITES_FILE, songIds);
    } catch (err) {
        console.error('[UserData] Failed to save favorites', err);
    }
}

export async function loadFavorites(): Promise<string[]> {
    try {
        const filePath = getUserDataPath(FAVORITES_FILE);
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content) as string[];
    } catch (err) {
        if (!isExpectedMissingOrJsonError(err)) {
            console.error('[UserData] Failed to load favorites', err);
        }
        return [];
    }
}

export async function saveHistory(songIds: string[]): Promise<void> {
    try {
        await writeAtomic(HISTORY_FILE, songIds);
    } catch (err) {
        console.error('[UserData] Failed to save history', err);
    }
}

export async function loadHistory(): Promise<string[]> {
    try {
        const filePath = getUserDataPath(HISTORY_FILE);
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content) as string[];
    } catch (err) {
        if (!isExpectedMissingOrJsonError(err)) {
            console.error('[UserData] Failed to load history', err);
        }
        return [];
    }
}

export interface LyricStyleConfig {
    fontSize: number;
    inactiveColor: string;
    activeColor: string;
    activeGlowColor: string;
    strokeColor: string;
    strokeWidth: number;
}

export interface UserSettings {
    separationQuality: 'high' | 'normal' | 'fast';
    language?: SupportedLanguage;
    ignoredVersion?: string;
    lyricStyles?: LyricStyleConfig;
    songPreferences?: Record<string, { furigana?: boolean; romaji?: boolean }>;
    hotkeys?: HotkeyConfig;
    songListViews?: SongListViewConfigs;
    overlayTemplates?: OverlayTemplatesConfig;
}

export async function saveSettings(settings: UserSettings): Promise<void> {
    pendingSettings = settings;
    if (!settingsSaveInFlight) {
        settingsSaveInFlight = runSettingsSaveQueue()
            .catch((err) => {
                console.error('[UserData] Failed to save settings', err);
            })
            .finally(async () => {
                settingsSaveInFlight = null;
                if (pendingSettings) {
                    const latestSettings = pendingSettings;
                    pendingSettings = null;
                    await saveSettings(latestSettings);
                }
            });
    }
    await settingsSaveInFlight;
}

export async function loadSettingsWithMeta(): Promise<SettingsLoadResult> {
    const sourcePath = getUserDataPath(SETTINGS_FILE);

    try {
        return {
            settings: await readSettingsFile(sourcePath),
            status: 'ok',
            sourcePath,
            unsafeToAutoPersist: false,
        };
    } catch (err) {
        if (isMissingFileError(err)) {
            console.warn('[UserData] settings.json is missing; using defaults without auto-persist');
            return {
                settings: createDefaultSettings(),
                status: 'missing',
                sourcePath,
                unsafeToAutoPersist: true,
            };
        }

        console.warn('[UserData] Failed to load settings.json; attempting backup restore', err);
        const quarantinedPath = await quarantineCorruptSettings(sourcePath);
        const backup = await findNewestValidSettingsBackup();
        if (backup) {
            await writeSettingsAtomic(backup.settings);
            console.warn('[UserData] Restored settings.json from backup', backup.filePath);
            return {
                settings: backup.settings,
                status: 'restored-from-backup',
                sourcePath,
                backupPath: backup.filePath,
                quarantinedPath,
                unsafeToAutoPersist: false,
            };
        }

        console.warn('[UserData] No valid settings backup found; using defaults without auto-persist');
        return {
            settings: createDefaultSettings(),
            status: 'corrupt-defaulted',
            sourcePath,
            quarantinedPath,
            unsafeToAutoPersist: true,
        };
    }
}

export async function loadSettings(): Promise<UserSettings> {
    const result = await loadSettingsWithMeta();
    return result.settings;
}

export function __resetSettingsPersistenceForTests(): void {
    settingsTempCounter = 0;
    settingsBackupCounter = 0;
    didCreatePreSaveBackup = false;
    settingsSaveInFlight = null;
    pendingSettings = null;
}

export interface Playlist {
    id: string;
    name: string;
    description?: string;
    songIds: string[];
}

const PLAYLISTS_FILE = 'playlists.json';

export async function savePlaylists(playlists: Playlist[]): Promise<void> {
    try {
        await writeAtomic(PLAYLISTS_FILE, playlists);
    } catch (err) {
        console.error('[UserData] Failed to save playlists', err);
    }
}

export async function loadPlaylists(): Promise<Playlist[]> {
    try {
        const filePath = getUserDataPath(PLAYLISTS_FILE);
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content) as Playlist[];
    } catch (err) {
        if (!isExpectedMissingOrJsonError(err)) {
            console.error('[UserData] Failed to load playlists', err);
        }
        return [];
    }
}
