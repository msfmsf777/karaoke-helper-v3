import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseFile } from 'music-metadata';
import type { AudioStatus, LyricsStatus, SongMeta, SongType } from '../shared/songTypes';

const APP_FOLDER_NAME = 'KHelperLive';
const SONGS_FOLDER_NAME = 'songs';
const AUDIO_STATUS_VALUES: AudioStatus[] = ['original_only', 'separation_pending', 'separating', 'separation_failed', 'separated'];
const DEFAULT_AUDIO_STATUS: AudioStatus = 'original_only';
const LYRICS_STATUS_VALUES: LyricsStatus[] = ['none', 'text_only', 'synced'];
const DEFAULT_LYRICS_STATUS: LyricsStatus = 'none';
export const RAW_LYRICS_FILENAME = 'lyrics_raw.txt';
export const SYNCED_LYRICS_FILENAME = 'lyrics_synced.lrc';

function getAppDataRoot() {
  const userData = app.getPath('userData');
  return path.join(userData, APP_FOLDER_NAME);
}

function getSongsDir() {
  return path.join(getAppDataRoot(), SONGS_FOLDER_NAME);
}

export function getSongDirById(id: string) {
  return path.join(getSongsDir(), id);
}

async function ensureSongsDir() {
  const base = getSongsDir();
  await fs.mkdir(base, { recursive: true });
  return base;
}

async function getAudioDuration(filePath: string): Promise<number | undefined> {
  try {
    const metadata = await parseFile(filePath);
    return metadata.format.duration;
  } catch (error) {
    console.warn('[Library] Failed to parse audio duration:', filePath, error);
    return undefined;
  }
}

function normalizeAudioStatus(status: AudioStatus | undefined): AudioStatus {
  if (status && AUDIO_STATUS_VALUES.includes(status as AudioStatus)) {
    return status;
  }
  // Legacy Phase 2/3 states map to original_only so they still play back.
  if (status === 'ready' || status === 'missing' || status === 'error') {
    return DEFAULT_AUDIO_STATUS;
  }
  return DEFAULT_AUDIO_STATUS;
}

function normalizeLyricsStatus(status: LyricsStatus | 'ready' | 'missing' | undefined | null): LyricsStatus {
  if (status && LYRICS_STATUS_VALUES.includes(status as LyricsStatus)) {
    return status as LyricsStatus;
  }
  if (status === 'ready') return 'synced';
  if (status === 'missing') return 'none';
  return DEFAULT_LYRICS_STATUS;
}

function getOriginalFilename(meta: SongMeta) {
  return meta.stored_filename || `Original${path.extname(meta.source.originalPath) || '.mp3'}`;
}

function getOriginalPath(meta: SongMeta, songDir: string) {
  return path.join(songDir, getOriginalFilename(meta));
}

function normalizeMeta(meta: SongMeta): SongMeta {
  const normalized: SongMeta = {
    ...meta,
    audio_status: normalizeAudioStatus(meta.audio_status),
    lyrics_status: normalizeLyricsStatus(meta.lyrics_status),
    stored_filename: getOriginalFilename(meta),
    lyrics_raw_path: meta.lyrics_raw_path ?? undefined,
    lyrics_lrc_path: meta.lyrics_lrc_path ?? undefined,
    instrumental_path: meta.instrumental_path ?? undefined,
    vocal_path: meta.vocal_path ?? undefined,
    last_separation_error: meta.last_separation_error ?? null,
    separation_quality: meta.separation_quality ?? undefined,
    duration: meta.duration ?? undefined,
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

// Cache for loaded songs
let cachedSongs: SongMeta[] | null = null;
let loadPromise: Promise<SongMeta[]> | null = null;

export function invalidateCache() {
  cachedSongs = null;
  loadPromise = null;
  console.log('[Library] Cache invalidated');
}

export async function addLocalSong(params: {
  sourcePath: string;
  title: string;
  artist?: string;
  type: SongType;
  lyricsText?: string;
  lyricsLrc?: string;
}): Promise<SongMeta> {
  const { sourcePath, title, artist, type, lyricsText, lyricsLrc } = params;
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

  // Calculate duration
  const duration = await getAudioDuration(targetPath);

  const rawLyrics = (lyricsText ?? '').replace(/\r\n/g, '\n');
  const hasRawLyrics = rawLyrics.trim().length > 0;
  const lyricsRawPath = hasRawLyrics ? path.join(songDir, RAW_LYRICS_FILENAME) : undefined;
  if (hasRawLyrics && lyricsRawPath) {
    await fs.writeFile(lyricsRawPath, rawLyrics, 'utf-8');
  }

  const lrcContent = (lyricsLrc ?? '').replace(/\r\n/g, '\n');
  const hasLrc = lrcContent.trim().length > 0;
  const lyricsLrcPath = hasLrc ? path.join(songDir, SYNCED_LYRICS_FILENAME) : undefined;
  if (hasLrc && lyricsLrcPath) {
    await fs.writeFile(lyricsLrcPath, lrcContent, 'utf-8');
  }

  // Determine lyrics status: 'synced' > 'text_only' > 'none'
  let lyricsStatus: LyricsStatus = 'none';
  if (hasLrc) lyricsStatus = 'synced';
  else if (hasRawLyrics) lyricsStatus = 'text_only';

  const now = new Date().toISOString();
  const meta: SongMeta = {
    id,
    title,
    artist: artist?.trim() || undefined,
    type,
    audio_status: DEFAULT_AUDIO_STATUS,
    lyrics_status: lyricsStatus,
    lyrics_raw_path: lyricsRawPath,
    lyrics_lrc_path: lyricsLrcPath,
    source: {
      kind: 'file',
      originalPath: sourcePath,
    },
    stored_filename: storedFilename,
    instrumental_path: undefined,
    vocal_path: undefined,
    last_separation_error: null,
    separation_quality: undefined,
    duration,
    created_at: now,
    updated_at: now,
  };

  await writeMeta(songDir, meta);
  console.log('[Library] Saved meta.json', { id, path: path.join(songDir, 'meta.json') });

  invalidateCache();
  return meta;
}

export function loadAllSongs(): Promise<SongMeta[]> {
  if (cachedSongs) {
    console.log('[Library] Returning cached songs', cachedSongs.length);
    return Promise.resolve(cachedSongs);
  }

  if (loadPromise) {
    console.log('[Library] Joining existing load request');
    return loadPromise;
  }

  console.log('[Library] Starting fresh load from disk');
  loadPromise = (async () => {
    try {
      const songsDir = await ensureSongsDir();
      const entries = await fs.readdir(songsDir, { withFileTypes: true });

      // Filter for directories first
      const songDirs = entries
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(songsDir, entry.name));

      // Simple concurrency limiter
      const CONCURRENCY_LIMIT = 50;
      const metas: SongMeta[] = [];

      // Process in chunks to limit concurrency
      for (let i = 0; i < songDirs.length; i += CONCURRENCY_LIMIT) {
        const chunk = songDirs.slice(i, i + CONCURRENCY_LIMIT);
        const results = await Promise.all(chunk.map(async (dir) => {
          const meta = await readMeta(dir);
          if (!meta) return null;

          let changed = false;

          // 1. Check Lyrics Status
          const lrcPath = path.join(dir, SYNCED_LYRICS_FILENAME);
          const txtPath = path.join(dir, RAW_LYRICS_FILENAME);
          let newLyricsStatus: LyricsStatus = 'none';

          try {
            await fs.access(lrcPath);
            newLyricsStatus = 'synced';
          } catch {
            try {
              await fs.access(txtPath);
              newLyricsStatus = 'text_only';
            } catch {
              newLyricsStatus = 'none';
            }
          }

          if (meta.lyrics_status !== newLyricsStatus) {
            meta.lyrics_status = newLyricsStatus;
            changed = true;
          }

          // 2. Check Duration
          if (meta.duration === undefined) {
            const originalPath = getOriginalPath(meta, dir);
            try {
              // Only check if file exists
              await fs.access(originalPath);
              const duration = await getAudioDuration(originalPath);
              if (duration !== undefined) {
                meta.duration = duration;
                changed = true;
              }
            } catch {
              // Original file missing, can't measure
            }
          }

          if (changed) {
            await writeMeta(dir, meta);
          }

          return meta;
        }));

        for (const meta of results) {
          if (meta) {
            metas.push(meta);
          }
        }
      }

      console.log('[Library] Loaded songs from disk', { count: metas.length, songsDir });
      const sorted = metas.sort((a, b) => Number(b.id) - Number(a.id));
      cachedSongs = sorted;
      return sorted;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

export async function getSongMeta(id: string): Promise<SongMeta | null> {
  if (!id) return null;
  // Try cache first
  if (cachedSongs) {
    const found = cachedSongs.find(s => s.id === id);
    if (found) return found;
  }

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
  invalidateCache();
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
  candidates.push(getOriginalPath(meta, songDir));

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

export async function getOriginalSongFilePath(id: string): Promise<string | null> {
  if (!id) return null;
  const songsDir = await ensureSongsDir();
  const songDir = path.join(songsDir, id);
  const meta = await readMeta(songDir);
  if (!meta) return null;

  const originalPath = getOriginalPath(meta, songDir);
  try {
    await fs.access(originalPath);
    return originalPath;
  } catch {
    console.warn('[Library] Original audio file missing', { id, originalPath });
    return null;
  }
}

export async function getSeparatedSongPaths(id: string): Promise<{ instrumental: string; vocal: string | null }> {
  if (!id) return { instrumental: '', vocal: null };
  const songsDir = await ensureSongsDir();
  const songDir = path.join(songsDir, id);
  const meta = await readMeta(songDir);
  if (!meta) return { instrumental: '', vocal: null };

  const originalPath = getOriginalPath(meta, songDir);

  // Logic:
  // If type is '伴奏' (Accompaniment), ALWAYS use Original for both (effectively unseparated behavior).
  // If Not Separated, use Original.
  // If Separated, use Instr and Vocal stems.

  const isAccompaniment = meta.type === '伴奏';
  const isSeparated = meta.audio_status === 'separated' && meta.instrumental_path && meta.vocal_path;

  if (!isAccompaniment && isSeparated) {
    // Verify files exist
    try {
      await Promise.all([
        fs.access(meta.instrumental_path!),
        fs.access(meta.vocal_path!)
      ]);
      return {
        instrumental: meta.instrumental_path!,
        vocal: meta.vocal_path!
      };
    } catch (err) {
      console.warn('[Library] Separated files missing, falling back to original', { id, err });
    }
  }

  // Fallback to Original
  try {
    await fs.access(originalPath);
    return { instrumental: originalPath, vocal: null };
  } catch {
    console.warn('[Library] Original audio file missing', { id, originalPath });
    return { instrumental: '', vocal: null };
  }
}

export async function deleteSong(id: string): Promise<void> {
  if (!id) return;
  const songsDir = await ensureSongsDir();
  const songDir = path.join(songsDir, id);

  try {
    await fs.rm(songDir, { recursive: true, force: true });
    console.log('[Library] Deleted song folder', { id, songDir });
    invalidateCache();
  } catch (err) {
    console.error('[Library] Failed to delete song folder', { id, songDir }, err);
    throw err;
  }
}

export async function updateSong(id: string, updates: Partial<SongMeta>): Promise<SongMeta | null> {
  return updateSongMeta(id, (current) => ({
    ...current,
    ...updates,
  }));
}

export function getSongsBaseDir() {
  return getSongsDir();
}
