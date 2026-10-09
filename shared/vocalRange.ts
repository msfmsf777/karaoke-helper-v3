import type { SongVocalRange } from './songTypes';

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export interface UserVocalRange {
  lowestMidi: number;
  highestMidi: number;
  lowestNote: string;
  highestNote: string;
  presetName?: 'soprano' | 'mezzo' | 'tenor' | 'baritone' | 'custom';
}

export interface VocalRangePreset {
  id: 'soprano' | 'mezzo' | 'tenor' | 'baritone';
  labelKey: string;
  defaultLabel: string;
  lowestMidi: number;
  highestMidi: number;
  lowestNote: string;
  highestNote: string;
}

export const VOCAL_RANGE_PRESETS: VocalRangePreset[] = [
  {
    id: 'soprano',
    labelKey: 'vocalRange.presets.soprano',
    defaultLabel: '女高音 (C4~A5)',
    lowestMidi: 60, // C4
    highestMidi: 81, // A5
    lowestNote: 'C4',
    highestNote: 'A5',
  },
  {
    id: 'mezzo',
    labelKey: 'vocalRange.presets.mezzo',
    defaultLabel: '女中音 (A3~F5)',
    lowestMidi: 57, // A3
    highestMidi: 77, // F5
    lowestNote: 'A3',
    highestNote: 'F5',
  },
  {
    id: 'tenor',
    labelKey: 'vocalRange.presets.tenor',
    defaultLabel: '男高音 (C3~A4)',
    lowestMidi: 48, // C3
    highestMidi: 69, // A4
    lowestNote: 'C3',
    highestNote: 'A4',
  },
  {
    id: 'baritone',
    labelKey: 'vocalRange.presets.baritone',
    defaultLabel: '男中音 (G2~E4)',
    lowestMidi: 43, // G2
    highestMidi: 64, // E4
    lowestNote: 'G2',
    highestNote: 'E4',
  },
];

export function midiToNoteName(midi: number): string {
  const rounded = Math.round(midi);
  const noteIndex = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export function noteNameToMidi(name: string): number | null {
  const trimmed = name.trim().toUpperCase();
  const match = trimmed.match(/^([A-G][#B]?)(-?\d+)$/);
  if (!match) return null;

  let note = match[1];
  const octave = parseInt(match[2], 10);

  // Normalize flat to sharp
  if (note === 'DB') note = 'C#';
  else if (note === 'EB') note = 'D#';
  else if (note === 'GB') note = 'F#';
  else if (note === 'AB') note = 'G#';
  else if (note === 'BB') note = 'A#';

  const noteIndex = NOTE_NAMES.indexOf(note as any);
  if (noteIndex === -1) return null;

  return (octave + 1) * 12 + noteIndex;
}

export interface KeyRecommendation {
  transposeOffset: number; // Semitone offset applied to playback (-12 to +12)
  mode: 'current_ok' | 'standard' | 'octave_lower' | 'octave_higher';
  label: string;
  effectiveHighMidi: number; // Singer's target high note after singing adjustment
  effectiveLowMidi: number;  // Singer's target low note after singing adjustment
  warning?: string;
}

/**
 * Calculates optimal transpose offset given a song's base range and user's vocal range.
 */
export function calculateKeyRecommendation(
  songRange: Pick<SongVocalRange, 'lowestMidi' | 'highestMidi'>,
  userRange?: UserVocalRange | null,
  currentTranspose: number = 0
): KeyRecommendation | null {
  if (!userRange) return null;

  const sLow = songRange.lowestMidi;
  const sHigh = songRange.highestMidi;
  const uLow = userRange.lowestMidi;
  const uHigh = userRange.highestMidi;

  // Check if current transpose is already within user's range
  const curHigh = sHigh + currentTranspose;
  const curLow = sLow + currentTranspose;
  if (curHigh <= uHigh && curLow >= uLow) {
    return {
      transposeOffset: currentTranspose,
      mode: 'current_ok',
      label: currentTranspose === 0 ? '✨ 適合原調 (±0)' : `✨ 目前調性合適 (${currentTranspose > 0 ? `+${currentTranspose}` : currentTranspose})`,
      effectiveHighMidi: curHigh,
      effectiveLowMidi: curLow,
    };
  }

  // Ideal shift to place song's high note at user's ceiling
  const rawShift = uHigh - sHigh;

  // Evaluate candidate 1: Direct Standard Shift
  // Clamped to sensible karaoke transpose [-6, +6]
  const candStandard = rawShift;

  // Evaluate candidate 2: Octave Lower Singing
  // Backing track is shifted by (rawShift + 12), and singer sings one octave lower (-12)
  const candOctaveLower = rawShift + 12;

  // Evaluate candidate 3: Octave Higher Singing
  // Backing track is shifted by (rawShift - 12), and singer sings one octave higher (+12)
  const candOctaveHigher = rawShift - 12;

  type Option = {
    offset: number;
    mode: 'standard' | 'octave_lower' | 'octave_higher';
    effectiveHigh: number;
    effectiveLow: number;
    score: number;
  };

  const options: Option[] = [];

  // 1. Standard option
  if (candStandard >= -8 && candStandard <= 8) {
    const effHigh = sHigh + candStandard;
    const effLow = sLow + candStandard;
    let score = Math.abs(candStandard); // Lower absolute shift preferred
    // Penalty if standard shift pushes below user's lowest note
    if (effLow < uLow) score += (uLow - effLow) * 2;
    // Heavy penalty for extreme downshifts > 5
    if (candStandard < -4) score += Math.abs(candStandard + 4) * 1.5;
    options.push({
      offset: Math.max(-12, Math.min(12, candStandard)),
      mode: 'standard',
      effectiveHigh: effHigh,
      effectiveLow: effLow,
      score,
    });
  }

  // 2. Octave Lower option (useful when song is too high, rawShift is negative e.g. -7, candOctaveLower is +5)
  if (candOctaveLower >= -4 && candOctaveLower <= 7) {
    const effHigh = sHigh + candOctaveLower - 12;
    const effLow = sLow + candOctaveLower - 12;
    let score = Math.abs(candOctaveLower);
    if (effLow < uLow) score += (uLow - effLow) * 2;
    // Reward octave lower if standard shift was severely negative (e.g. < -4)
    if (rawShift <= -5) score -= 2;
    options.push({
      offset: Math.max(-12, Math.min(12, candOctaveLower)),
      mode: 'octave_lower',
      effectiveHigh: effHigh,
      effectiveLow: effLow,
      score,
    });
  }

  // 3. Octave Higher option (useful when song is too low, rawShift is positive e.g. +7, candOctaveHigher is -5)
  if (candOctaveHigher >= -7 && candOctaveHigher <= 4) {
    const effHigh = sHigh + candOctaveHigher + 12;
    const effLow = sLow + candOctaveHigher + 12;
    let score = Math.abs(candOctaveHigher);
    if (effHigh > uHigh) score += (effHigh - uHigh) * 2;
    if (rawShift >= 5) score -= 2;
    options.push({
      offset: Math.max(-12, Math.min(12, candOctaveHigher)),
      mode: 'octave_higher',
      effectiveHigh: effHigh,
      effectiveLow: effLow,
      score,
    });
  }

  if (options.length === 0) {
    // Fallback to clamped standard shift
    const clamped = Math.max(-6, Math.min(6, rawShift));
    return {
      transposeOffset: clamped,
      mode: 'standard',
      label: `建議 ${clamped > 0 ? `+${clamped}` : clamped}`,
      effectiveHighMidi: sHigh + clamped,
      effectiveLowMidi: sLow + clamped,
    };
  }

  options.sort((a, b) => a.score - b.score);
  const best = options[0];

  const prefix = best.offset > 0 ? `+${best.offset}` : `${best.offset}`;
  let label = `⚡ 建議 ${prefix}`;
  if (best.mode === 'octave_lower') {
    label = `⚡ 建議 ${prefix} (低八度唱)`;
  } else if (best.mode === 'octave_higher') {
    label = `⚡ 建議 ${prefix} (高八度唱)`;
  }

  let warning: string | undefined;
  if (best.effectiveLow < uLow) {
    warning = `低音偏低 (最低 ${midiToNoteName(best.effectiveLow)})`;
  }

  return {
    transposeOffset: best.offset,
    mode: best.mode,
    label,
    effectiveHighMidi: best.effectiveHigh,
    effectiveLowMidi: best.effectiveLow,
    warning,
  };
}
