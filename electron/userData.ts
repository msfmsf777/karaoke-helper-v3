import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';

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

export async function saveFavorites(songIds: string[]): Promise<void> {
    try {
        const filePath = getUserDataPath(FAVORITES_FILE);
        await fs.writeFile(filePath, JSON.stringify(songIds, null, 2), 'utf-8');
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
        if (err.code !== 'ENOENT') {
            console.error('[UserData] Failed to load favorites', err);
        }
        return [];
    }
}

export async function saveHistory(songIds: string[]): Promise<void> {
    try {
        const filePath = getUserDataPath(HISTORY_FILE);
        await fs.writeFile(filePath, JSON.stringify(songIds, null, 2), 'utf-8');
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
        if (err.code !== 'ENOENT') {
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
    ignoredVersion?: string;
    lyricStyles?: LyricStyleConfig;
}

export async function saveSettings(settings: UserSettings): Promise<void> {
    try {
        const filePath = getUserDataPath(SETTINGS_FILE);
        await fs.writeFile(filePath, JSON.stringify(settings, null, 2), 'utf-8');
    } catch (err) {
        console.error('[UserData] Failed to save settings', err);
    }
}

export async function loadSettings(): Promise<UserSettings> {
    try {
        const filePath = getUserDataPath(SETTINGS_FILE);
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    } catch (err: any) {
        if (err.code !== 'ENOENT') {
            console.error('[UserData] Failed to load settings', err);
        }
        return { separationQuality: 'normal' };
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
        const filePath = getUserDataPath(PLAYLISTS_FILE);
        await fs.writeFile(filePath, JSON.stringify(playlists, null, 2), 'utf-8');
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
        if (err.code !== 'ENOENT') {
            console.error('[UserData] Failed to load playlists', err);
        }
        return [];
    }
}
