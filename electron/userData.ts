import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';

export interface UserData {
    favorites: string[];
    history: string[];
}

const FAVORITES_FILE = 'favorites.json';
const HISTORY_FILE = 'history.json';

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
