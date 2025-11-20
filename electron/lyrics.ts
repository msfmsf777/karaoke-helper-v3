import fs from 'node:fs/promises';
import path from 'node:path';
import { getSongMeta, getSongsBaseDir, RAW_LYRICS_FILENAME, SYNCED_LYRICS_FILENAME, updateSongMeta } from './songLibrary';
import type { SongMeta } from '../shared/songTypes';

async function ensureSongFolder(songId: string): Promise<{ songDir: string; meta: SongMeta }> {
  const base = getSongsBaseDir();
  const songDir = path.join(base, songId);
  const meta = await getSongMeta(songId);
  if (!meta) {
    throw new Error(`Song ${songId} not found for lyrics operation`);
  }
  await fs.mkdir(songDir, { recursive: true });
  return { songDir, meta };
}

export async function readRawLyrics(songId: string): Promise<{ path: string; content: string } | null> {
  const { songDir, meta } = await ensureSongFolder(songId);
  const filePath = meta.lyrics_raw_path || path.join(songDir, RAW_LYRICS_FILENAME);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    console.log('[Lyrics] Loaded raw lyrics', { songId, filePath });
    return { path: filePath, content };
  } catch (err) {
    console.warn('[Lyrics] No raw lyrics found', { songId, filePath, err });
    return null;
  }
}

export async function readSyncedLyrics(songId: string): Promise<{ path: string; content: string } | null> {
  const { songDir, meta } = await ensureSongFolder(songId);
  const filePath = meta.lyrics_lrc_path || path.join(songDir, SYNCED_LYRICS_FILENAME);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    console.log('[Lyrics] Loaded synced lyrics', { songId, filePath });
    return { path: filePath, content };
  } catch (err) {
    console.warn('[Lyrics] No synced lyrics found', { songId, filePath, err });
    return null;
  }
}

export async function writeRawLyrics(songId: string, content: string): Promise<{ path: string; meta: SongMeta }> {
  const { songDir } = await ensureSongFolder(songId);
  const normalized = content.replace(/\r\n/g, '\n');
  const filePath = path.join(songDir, RAW_LYRICS_FILENAME);
  await fs.writeFile(filePath, normalized, 'utf-8');
  console.log('[Lyrics] Saved raw lyrics', { songId, filePath });

  const updated = await updateSongMeta(songId, (current) => ({
    ...current,
    lyrics_status: normalized.trim().length > 0 ? 'text_only' : 'none',
    lyrics_raw_path: filePath,
  }));

  if (!updated) {
    throw new Error(`Failed to update meta after saving lyrics for ${songId}`);
  }

  return { path: filePath, meta: updated };
}

export async function writeSyncedLyrics(songId: string, content: string): Promise<{ path: string; meta: SongMeta }> {
  const { songDir } = await ensureSongFolder(songId);
  const normalized = content.replace(/\r\n/g, '\n');
  const filePath = path.join(songDir, SYNCED_LYRICS_FILENAME);
  await fs.writeFile(filePath, normalized, 'utf-8');
  console.log('[Lyrics] Saved synced lyrics', { songId, filePath });

  const updated = await updateSongMeta(songId, (current) => ({
    ...current,
    lyrics_status: 'synced',
    lyrics_lrc_path: filePath,
    lyrics_raw_path: current.lyrics_raw_path ?? path.join(songDir, RAW_LYRICS_FILENAME),
  }));

  if (!updated) {
    throw new Error(`Failed to update meta after saving synced lyrics for ${songId}`);
  }

  return { path: filePath, meta: updated };
}
