import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AudioStatus, SongMeta, SongType } from '../shared/songTypes';

const APP_FOLDER_NAME = 'KHelperLive';
const SONGS_FOLDER_NAME = 'songs';
const AUDIO_STATUS_VALUES: AudioStatus[] = ['original_only', 'separation_pending', 'separating', 'separation_failed', 'separated'];
const DEFAULT_AUDIO_STATUS: AudioStatus = 'original_only';

function getAppDataRoot() {
  const userData = app.getPath('userData');
  return path.join(userData, APP_FOLDER_NAME);
}

function getSongsDir() {
  return path.join(getAppDataRoot(), SONGS_FOLDER_NAME);
}

function getSongDirById(id: string) {
  return path.join(getSongsDir(), id);
}

async function ensureSongsDir() {
  const base = getSongsDir();
  await fs.mkdir(base, { recursive: true });
  return base;
}

function normalizeAudioStatus(status: AudioStatus | undefined, type?: SongType): AudioStatus {
  if (status && AUDIO_STATUS_VALUES.includes(status as AudioStatus)) {
    return status;
  }
  // Legacy Phase 2/3 states map to original_only so they still play back.
  if (status === 'ready' || status === 'missing' || status === 'error') {
    return DEFAULT_AUDIO_STATUS;
  }
  if (type === '伴奏') {
    return DEFAULT_AUDIO_STATUS;
  }
  return DEFAULT_AUDIO_STATUS;
}

function normalizeMeta(meta: SongMeta): SongMeta {
  const normalized: SongMeta = {
    ...meta,
    audio_status: normalizeAudioStatus(meta.audio_status, meta.type),
    lyrics_status: meta.lyrics_status ?? 'none',
    stored_filename: meta.stored_filename ?? `Original${path.extname(meta.source.originalPath) || '.mp3'}`,
    instrumental_path: meta.instrumental_path ?? undefined,
    vocal_path: meta.vocal_path ?? undefined,
    last_separation_error: meta.last_separation_error ?? null,
  };
  return normalized;
}

async function writeMeta(songDir: string, meta: SongMeta) {
  await fs.writeFile(path.join(songDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');
}

async function readMeta(songDir: string): Promise<SongMeta | null> {
  try {
    const metaRaw = await fs.readFile(path.join(songDir, 'meta.json'), 'utf-8');
    const parsed = JSON.parse(metaRaw) as SongMeta;
    return normalizeMeta(parsed);
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
    audio_status: DEFAULT_AUDIO_STATUS,
    lyrics_status: 'none',
    source: {
      kind: 'file',
      originalPath: sourcePath,
    },
    stored_filename: storedFilename,
    instrumental_path: undefined,
    vocal_path: undefined,
    last_separation_error: null,
    created_at: now,
    updated_at: now,
  };

  await writeMeta(songDir, meta);
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

export async function getSongMeta(id: string): Promise<SongMeta | null> {
  if (!id) return null;
  const songsDir = await ensureSongsDir();
  const songDir = path.join(songsDir, id);
  return readMeta(songDir);
}

export async function updateSongMeta(id: string, mutate: (meta: SongMeta) => SongMeta): Promise<SongMeta | null> {
  if (!id) return null;
  const songsDir = await ensureSongsDir();
  const songDir = path.join(songsDir, id);
  const current = await readMeta(songDir);
  if (!current) return null;

  const nextRaw = mutate(current);
  const next: SongMeta = normalizeMeta({
    ...current,
    ...nextRaw,
    id: current.id,
    created_at: current.created_at,
    updated_at: new Date().toISOString(),
  } as SongMeta);

  await writeMeta(songDir, next);
  return next;
}

export async function getSongFilePath(id: string): Promise<string | null> {
  if (!id) return null;
  const songsDir = await ensureSongsDir();
  const songDir = path.join(songsDir, id);
  const meta = await readMeta(songDir);
  if (!meta) return null;

  const candidates = [];
  if (meta.audio_status === 'separated' && meta.instrumental_path) {
    candidates.push(meta.instrumental_path);
  }
  candidates.push(path.join(songDir, meta.stored_filename || `Original${path.extname(meta.source.originalPath)}`));

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      if (candidate !== candidates[candidates.length - 1]) {
        console.log('[Library] Using separated instrumental for playback', { id, candidate });
      }
      return candidate;
    } catch (err) {
      // Try the next candidate.
      continue;
    }
  }

  console.warn('[Library] Stored audio file missing', { id, candidates });
  return null;
}

export function getSongsBaseDir() {
  return getSongsDir();
}
