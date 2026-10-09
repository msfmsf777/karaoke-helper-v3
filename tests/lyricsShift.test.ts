import { describe, it, expect } from 'vitest';
import {
  parseLrc,
  shiftLyricLines,
  detectLyricsCutConflict,
} from '../shared/lyrics.ts';

describe('Lyrics Shift & Trim Conflict Resolution', () => {
  const sampleLrc = `[00:05.00]Line 1 - intro chatter
[00:10.00]Line 2 - second chatter
[00:20.00]Line 3 - song begins
[00:35.50]Line 4 - verse continues`;

  it('shifts timestamps backward by delta without conflicts', () => {
    const lines = parseLrc(sampleLrc);
    const { conflictCount, affectedLines } = detectLyricsCutConflict(lines, 4.0);
    expect(conflictCount).toBe(0);
    expect(affectedLines.length).toBe(0);

    const { lines: shifted, droppedCount, clampedCount } = shiftLyricLines(lines, 4.0, 'drop');
    expect(droppedCount).toBe(0);
    expect(clampedCount).toBe(0);
    expect(shifted.length).toBe(4);
    expect(shifted[0].timeSeconds).toBe(1.0);
    expect(shifted[1].timeSeconds).toBe(6.0);
    expect(shifted[2].timeSeconds).toBe(16.0);
    expect(shifted[3].timeSeconds).toBe(31.5);
  });

  it('detects lines that fall into negative time when intro is cut', () => {
    const lines = parseLrc(sampleLrc);
    // Cut 12 seconds off the intro (lines at 5s and 10s fall into < 0)
    const { conflictCount, affectedLines } = detectLyricsCutConflict(lines, 12.0);
    expect(conflictCount).toBe(2);
    expect(affectedLines[0].text).toBe('Line 1 - intro chatter');
    expect(affectedLines[1].text).toBe('Line 2 - second chatter');
  });

  it('drops conflicting negative lines when user chooses "drop"', () => {
    const lines = parseLrc(sampleLrc);
    const { lines: shifted, droppedCount, clampedCount } = shiftLyricLines(lines, 12.0, 'drop');
    expect(droppedCount).toBe(2);
    expect(clampedCount).toBe(0);
    expect(shifted.length).toBe(2);
    expect(shifted[0].text).toBe('Line 3 - song begins');
    expect(shifted[0].timeSeconds).toBe(8.0); // 20 - 12
    expect(shifted[1].text).toBe('Line 4 - verse continues');
    expect(shifted[1].timeSeconds).toBe(23.5); // 35.5 - 12
  });

  it('clamps conflicting negative lines to 00:00 when user chooses "clamp"', () => {
    const lines = parseLrc(sampleLrc);
    const { lines: shifted, droppedCount, clampedCount } = shiftLyricLines(lines, 12.0, 'clamp');
    expect(droppedCount).toBe(0);
    expect(clampedCount).toBe(2);
    expect(shifted.length).toBe(4);
    expect(shifted[0].timeSeconds).toBe(0);
    expect(shifted[1].timeSeconds).toBe(0);
    expect(shifted[2].timeSeconds).toBe(8.0);
    expect(shifted[3].timeSeconds).toBe(23.5);
  });

  it('is completely reversible when restored (reset trim to 0)', () => {
    const lines = parseLrc(sampleLrc);
    // Shift by +10s
    const { lines: shiftedForward } = shiftLyricLines(lines, -10.0, 'drop');
    expect(shiftedForward[0].timeSeconds).toBe(15.0);

    // Shift back by -10s
    const { lines: restored } = shiftLyricLines(shiftedForward, 10.0, 'drop');
    expect(restored[0].timeSeconds).toBe(5.0);
    expect(restored[1].timeSeconds).toBe(10.0);
    expect(restored[2].timeSeconds).toBe(20.0);
    expect(restored[3].timeSeconds).toBe(35.5);
  });
});
