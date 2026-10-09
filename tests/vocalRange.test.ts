import { describe, it, expect } from 'vitest';
import {
  midiToNoteName,
  noteNameToMidi,
  calculateKeyRecommendation,
  UserVocalRange,
} from '../shared/vocalRange';

describe('Vocal Range Math & Recommendation Logic', () => {
  it('converts between MIDI numbers and note names accurately', () => {
    expect(midiToNoteName(60)).toBe('C4');
    expect(midiToNoteName(69)).toBe('A4');
    expect(midiToNoteName(55)).toBe('G3');
    expect(midiToNoteName(76)).toBe('E5');
    expect(midiToNoteName(61)).toBe('C#4');

    expect(noteNameToMidi('C4')).toBe(60);
    expect(noteNameToMidi('A4')).toBe(69);
    expect(noteNameToMidi('Db4')).toBe(61);
    expect(noteNameToMidi('C#4')).toBe(61);
    expect(noteNameToMidi('G3')).toBe(55);
  });

  it('detects when current key is already suitable', () => {
    const song = { lowestMidi: 55, highestMidi: 72 }; // G3 ~ C5
    const user: UserVocalRange = {
      lowestMidi: 53,
      highestMidi: 74,
      lowestNote: 'F3',
      highestNote: 'D5',
    };

    const rec = calculateKeyRecommendation(song, user, 0);
    expect(rec).not.toBeNull();
    expect(rec?.mode).toBe('current_ok');
    expect(rec?.transposeOffset).toBe(0);
    expect(rec?.label).toContain('適合原調');
  });

  it('recommends standard downward transpose for moderate high songs', () => {
    const song = { lowestMidi: 57, highestMidi: 76 }; // A3 ~ E5
    const user: UserVocalRange = {
      lowestMidi: 53,
      highestMidi: 74, // F3 ~ D5 (ceiling is D5, 2 semitones lower than E5)
      lowestNote: 'F3',
      highestNote: 'D5',
    };

    const rec = calculateKeyRecommendation(song, user, 0);
    expect(rec).not.toBeNull();
    expect(rec?.transposeOffset).toBe(-2);
    expect(rec?.mode).toBe('standard');
    expect(rec?.label).toContain('建議 -2');
  });

  it('recommends octave-lower singing when a song is too high to drop directly', () => {
    // E.g., Male singer (Ceiling A4, 69) singing Female song (Ceiling G5, 79).
    // Direct drop would be -10 semitones (makes backing track muddy and unnatural).
    // Octave shift: -10 + 12 = +2.
    // Transpose +2, singer sings one octave lower -> effective high is 79 + 2 - 12 = 69 (A4).
    const song = { lowestMidi: 60, highestMidi: 79 }; // C4 ~ G5
    const user: UserVocalRange = {
      lowestMidi: 48,
      highestMidi: 69, // C3 ~ A4 (Tenor)
      lowestNote: 'C3',
      highestNote: 'A4',
    };

    const rec = calculateKeyRecommendation(song, user, 0);
    expect(rec).not.toBeNull();
    expect(rec?.mode).toBe('octave_lower');
    expect(rec?.transposeOffset).toBe(2);
    expect(rec?.label).toContain('低八度唱');
  });
});
