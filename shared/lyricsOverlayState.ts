import type { SongMeta } from './songTypes';
import type { EditableLyricLine } from './lyrics';

export interface LyricTimingState {
  timingAnchorIndex: number;
  activeTextIndex: number;
}

export interface LyricVisibleLineRange {
  start: number;
  end: number;
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

export function getTextOnlyVisibleLineRange({
  lineCount,
  anchorLineIndex,
  maxVisibleLines,
}: {
  lineCount: number;
  anchorLineIndex: number;
  maxVisibleLines: number;
}): LyricVisibleLineRange {
  if (lineCount <= 0) {
    return { start: 0, end: -1 };
  }

  const visibleCount = Math.max(1, Math.min(lineCount, Math.round(maxVisibleLines || 1)));
  const safeAnchor = Math.min(lineCount - 1, Math.max(0, Math.round(anchorLineIndex)));
  const before = Math.floor((visibleCount - 1) / 2);
  const start = Math.max(0, Math.min(lineCount - visibleCount, safeAnchor - before));

  return {
    start,
    end: Math.min(lineCount - 1, start + visibleCount - 1),
  };
}
