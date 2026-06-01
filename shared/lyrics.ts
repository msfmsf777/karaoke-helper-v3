import type { EnrichedLyricLine, SongMeta } from './songTypes';

export interface EditableLyricLine {
  id: string;
  text: string;
  timeSeconds: number | null;
}

export type AlignedEnrichedLyricLine = EnrichedLyricLine | null;

const createLineId = (() => {
  let counter = 0;
  return () => `line-${Date.now().toString(16)}-${counter++}`;
})();

export function linesFromRawText(raw: string): EditableLyricLine[] {
  const normalized = raw.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n');
  return parts.map((text) => ({
    id: createLineId(),
    text,
    timeSeconds: null,
  }));
}

export function parseLrc(content: string): EditableLyricLine[] {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines: EditableLyricLine[] = [];
  const rows = normalized.split('\n');

  for (const row of rows) {
    const match = row.match(/^\s*\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]\s*(.*)$/);
    if (match) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const hundredths = Number(match[3] || '0');
      const timeSeconds = minutes * 60 + seconds + hundredths / 100;
      lines.push({
        id: createLineId(),
        text: match[4] ?? '',
        timeSeconds: Number.isFinite(timeSeconds) ? timeSeconds : null,
      });
    } else if (row.trim().length > 0) {
      const isTag = /^\s*\[[^\]]+:/.test(row);
      if (!isTag) {
        lines.push({
          id: createLineId(),
          text: row,
          timeSeconds: null,
        });
      }
    }
  }

  return lines;
}

export function formatTimeTag(value: number): string {
  const clamped = Math.max(0, value);
  const minutes = Math.floor(clamped / 60);
  const secondsFloat = clamped - minutes * 60;
  let seconds = Math.floor(secondsFloat);
  let hundredths = Math.round((secondsFloat - seconds) * 100);

  if (hundredths === 100) {
    hundredths = 0;
    seconds += 1;
  }
  let mins = minutes;
  if (seconds === 60) {
    seconds = 0;
    mins += 1;
  }

  return `[${mins.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${hundredths
    .toString()
    .padStart(2, '0')}]`;
}

export function formatLrc(lines: EditableLyricLine[], meta?: { title?: string; artist?: string }): string {
  const output: string[] = [];
  if (meta?.title) output.push(`[ti:${meta.title}]`);
  if (meta?.artist) output.push(`[ar:${meta.artist}]`);

  lines.forEach((line) => {
    if (line.timeSeconds === null || Number.isNaN(line.timeSeconds)) return;
    output.push(`${formatTimeTag(line.timeSeconds)}${line.text ?? ''}`);
  });

  return output.join('\n');
}

export function compactLyricLinesForEnrichment(lines: EditableLyricLine[]): {
  texts: string[];
  sourceIndexes: number[];
} {
  const texts: string[] = [];
  const sourceIndexes: number[] = [];

  lines.forEach((line, index) => {
    if (line.text.trim().length === 0) return;
    texts.push(line.text);
    sourceIndexes.push(index);
  });

  return { texts, sourceIndexes };
}

export function alignEnrichedLyricLines(
  lines: EditableLyricLine[],
  enriched: EnrichedLyricLine[]
): AlignedEnrichedLyricLine[] {
  const aligned: AlignedEnrichedLyricLine[] = Array.from({ length: lines.length }, () => null);
  const { sourceIndexes } = compactLyricLinesForEnrichment(lines);

  sourceIndexes.forEach((sourceIndex, compactIndex) => {
    aligned[sourceIndex] = enriched[compactIndex] ?? null;
  });

  return aligned;
}

export function getLyricsStatusFromLines(lines: EditableLyricLine[], preferred: SongMeta['lyrics_status']): SongMeta['lyrics_status'] {
  if (lines.length === 0) return 'none';
  return preferred;
}
