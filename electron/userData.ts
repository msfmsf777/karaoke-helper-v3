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

function getUserDataPath(filename: string): string {
    return path.join(app.getPath('userData'), filename);
}

async function writeAtomic(filename: string, data: any) {
    const filePath = getUserDataPath(filename);
    const tmpPath = filePath + '.tmp';
    try {
        await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
        await fs.rename(tmpPath, filePath);
    } catch (err) {
        // If rename fails (e.g. file locked), try to unlink tmp
        try { await fs.unlink(tmpPath); } catch { }
        throw err;
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
    } catch (err: any) {
        if (err.code !== 'ENOENT' && !(err instanceof SyntaxError) && !err.message.includes('JSON')) {
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
    } catch (err: any) {
        if (err.code !== 'ENOENT' && !(err instanceof SyntaxError) && !err.message.includes('JSON')) {
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
    try {
        await writeAtomic(SETTINGS_FILE, {
            ...settings,
            language: settings.language ? normalizeLanguage(settings.language) : undefined,
            hotkeys: mergeHotkeyConfig(settings.hotkeys),
            songListViews: mergeSongListViewConfigs(settings.songListViews),
            overlayTemplates: mergeOverlayTemplatesConfig(settings.overlayTemplates, settings.lyricStyles),
        });
    } catch (err) {
        console.error('[UserData] Failed to save settings', err);
    }
}

export async function loadSettings(): Promise<UserSettings> {
    try {
        const filePath = getUserDataPath(SETTINGS_FILE);
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content) as UserSettings;
        return {
            ...parsed,
            separationQuality: parsed.separationQuality || 'normal',
            language: parsed.language ? normalizeLanguage(parsed.language) : undefined,
            hotkeys: mergeHotkeyConfig(parsed.hotkeys),
            songListViews: mergeSongListViewConfigs(parsed.songListViews),
            overlayTemplates: mergeOverlayTemplatesConfig(parsed.overlayTemplates, parsed.lyricStyles),
        };
    } catch (err: any) {
        if (err.code !== 'ENOENT' && !(err instanceof SyntaxError) && !err.message.includes('JSON')) {
            console.error('[UserData] Failed to load settings', err);
        }
        return {
            separationQuality: 'normal',
            hotkeys: mergeHotkeyConfig(),
            songListViews: {},
            overlayTemplates: mergeOverlayTemplatesConfig(),
        };
    }
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
    } catch (err: any) {
        if (err.code !== 'ENOENT' && !(err instanceof SyntaxError) && !err.message.includes('JSON')) {
            console.error('[UserData] Failed to load playlists', err);
        }
        return [];
    }
}
