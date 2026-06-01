import type { SongMeta } from './songTypes';
import type { EditableLyricLine } from './lyrics';

export interface LyricTimingState {
  timingAnchorIndex: number;
  activeTextIndex: number;
}

export function getActiveLineIndex(lines: EditableLyricLine[], currentTime: number): number {
  let currentIdx = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const time = lines[index].timeSeconds;
    if (time !== null && time <= currentTime) {
      currentIdx = index;
    } else if (time !== null && time > currentTime) {
      break;
    }
  }
  return currentIdx;
}

export function resolveLyricTimingState(
  status: SongMeta['lyrics_status'],
  lines: EditableLyricLine[],
  currentTime: number
): LyricTimingState {
  if (status !== 'synced') {
    return { timingAnchorIndex: -1, activeTextIndex: -1 };
  }

  const timingAnchorIndex = getActiveLineIndex(lines, currentTime);
  const activeLine = timingAnchorIndex >= 0 ? lines[timingAnchorIndex] : null;
  const activeTextIndex = activeLine && activeLine.text.trim().length > 0
    ? timingAnchorIndex
    : -1;

  return { timingAnchorIndex, activeTextIndex };
}

export function shouldRenderLyricsOverlayContent(
  status: SongMeta['lyrics_status'],
  lines: EditableLyricLine[]
): boolean {
  return status !== 'none' && lines.length > 0;
}
