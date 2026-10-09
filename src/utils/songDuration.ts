import type { SongMeta } from '../../shared/songTypes';

/**
 * Returns the effective virtual duration of a song (in seconds),
 * accounting for non-destructive trimStart and trimEnd markers.
 */
export function getEffectiveSongDuration(song: SongMeta): number | undefined {
  if (song.trimStart !== undefined || song.trimEnd !== undefined) {
    const raw = song.duration ?? 0;
    const start = song.trimStart ?? 0;
    const end = song.trimEnd ?? raw;
    return Math.max(0, end - start);
  }
  return song.duration;
}
