import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { SongMeta, SongType } from '../shared/songTypes';

const APP_FOLDER_NAME = 'KHelperLive';
const SONGS_FOLDER_NAME = 'songs';

function getAppDataRoot() {
  const userData = app.getPath('userData');
  return path.join(userData, APP_FOLDER_NAME);
}

function getSongsDir() {
  return path.join(getAppDataRoot(), SONGS_FOLDER_NAME);
}

async function ensureSongsDir() {
  const base = getSongsDir();
  await fs.mkdir(base, { recursive: true });
  return base;
}

async function readMeta(songDir: string): Promise<SongMeta | null> {
  try {
    const metaRaw = await fs.readFile(path.join(songDir, 'meta.json'), 'utf-8');
    return JSON.parse(metaRaw) as SongMeta;
  } catch (err) {
    console.warn('[Library] Failed to read meta.json from', songDir, err);
    return null;
  }
}

function generateSongId(): string {
  return `${Date.now()}`;
}

export async function addLocalSong(params: {
  sourcePath: string;
  title: string;
  artist?: string;
  type: SongType;
}): Promise<SongMeta> {
  const { sourcePath, title, artist, type } = params;
  if (!sourcePath || !title) {
    throw new Error('sourcePath and title are required');
  }

  const songsDir = await ensureSongsDir();
  const id = generateSongId();
  const songDir = path.join(songsDir, id);
  await fs.mkdir(songDir, { recursive: true });

  const ext = path.extname(sourcePath) || '.mp3';
  const storedFilename = `Original${ext}`;
  const targetPath = path.join(songDir, storedFilename);

  console.log('[Library] Adding song', { sourcePath, songDir, id });
  await fs.copyFile(sourcePath, targetPath);

  const now = new Date().toISOString();
  const meta: SongMeta = {
    id,
    title,
    artist: artist?.trim() || undefined,
    type,
    audio_status: 'ready',
    lyrics_status: 'none',
    source: {
      kind: 'file',
      originalPath: sourcePath,
    },
    stored_filename: storedFilename,
    created_at: now,
    updated_at: now,
  };

  await fs.writeFile(path.join(songDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');
  console.log('[Library] Saved meta.json', { id, path: path.join(songDir, 'meta.json') });

  return meta;
}

export async function loadAllSongs(): Promise<SongMeta[]> {
  const songsDir = await ensureSongsDir();
  const entries = await fs.readdir(songsDir, { withFileTypes: true });
  const metas: SongMeta[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const songDir = path.join(songsDir, entry.name);
    const meta = await readMeta(songDir);
    if (meta) {
      metas.push(meta);
    }
  }

  console.log('[Library] Loaded songs', { count: metas.length, songsDir });
  return metas.sort((a, b) => Number(b.id) - Number(a.id));
}

export async function getSongFilePath(id: string): Promise<string | null> {
  if (!id) return null;
  const songsDir = await ensureSongsDir();
  const songDir = path.join(songsDir, id);
  const meta = await readMeta(songDir);
  if (!meta) return null;

  const candidate = path.join(songDir, meta.stored_filename || `Original${path.extname(meta.source.originalPath)}`);
  try {
    await fs.access(candidate);
    return candidate;
  } catch (err) {
    console.warn('[Library] Stored audio file missing', { id, candidate, err });
    return null;
  }
}

export function getSongsBaseDir() {
  return getSongsDir();
}
