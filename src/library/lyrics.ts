import type { SongMeta } from '../../shared/songTypes';
export type {
  AlignedEnrichedLyricLine,
  EditableLyricLine,
} from '../../shared/lyrics';
export {
  alignEnrichedLyricLines,
  compactLyricLinesForEnrichment,
  detectLyricsCutConflict,
  formatLrc,
  formatTimeTag,
  linesFromRawText,
  parseLrc,
  shiftLyricLines,
} from '../../shared/lyrics';

const getApi = () => {
  if (window.khelper?.lyrics) return window.khelper.lyrics;
  throw new Error('Lyrics API is not available on window.khelper.lyrics');
};

export async function readRawLyrics(songId: string) {
  return getApi().readRawLyrics(songId);
}

export async function readSyncedLyrics(songId: string) {
  return getApi().readSyncedLyrics(songId);
}

export async function writeRawLyrics(songId: string, content: string): Promise<{ path: string; meta: SongMeta }> {
  return getApi().writeRawLyrics({ songId, content });
}

export async function writeSyncedLyrics(songId: string, content: string): Promise<{ path: string; meta: SongMeta }> {
  return getApi().writeSyncedLyrics({ songId, content });
}
