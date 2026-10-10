import { describe, expect, it } from 'vitest';
import {
  calculateAudioBufferLufs,
  calculateNormGain,
  getTargetLufs,
  DEFAULT_CUSTOM_LUFS,
  MIN_CUSTOM_LUFS,
  MAX_CUSTOM_LUFS,
} from '../src/audio/loudness';

describe('getTargetLufs', () => {
  it('returns standard preset value -14 LUFS', () => {
    expect(getTargetLufs('standard')).toBe(-14);
  });

  it('returns voice_priority preset value -16 LUFS', () => {
    expect(getTargetLufs('voice_priority')).toBe(-16);
  });

  it('returns gentle preset value -18 LUFS', () => {
    expect(getTargetLufs('gentle')).toBe(-18);
  });

  it('returns custom value within [MIN_CUSTOM_LUFS, MAX_CUSTOM_LUFS]', () => {
    expect(getTargetLufs('custom', -15.5)).toBe(-15.5);
    expect(getTargetLufs('custom', -25)).toBe(MIN_CUSTOM_LUFS); // clamped to -20
    expect(getTargetLufs('custom', -5)).toBe(MAX_CUSTOM_LUFS);   // clamped to -10
  });

  it('uses DEFAULT_CUSTOM_LUFS if customValue is omitted', () => {
    expect(getTargetLufs('custom')).toBe(DEFAULT_CUSTOM_LUFS);
  });
});

describe('calculateNormGain', () => {
  it('returns 1.0 when normalization is disabled', () => {
    expect(calculateNormGain(-20, -14, false)).toBe(1.0);
  });

  it('returns 1.0 when trackLufs is null, undefined, or NaN', () => {
    expect(calculateNormGain(null, -14, true)).toBe(1.0);
    expect(calculateNormGain(undefined, -14, true)).toBe(1.0);
    expect(calculateNormGain(NaN, -14, true)).toBe(1.0);
  });

  it('returns 1.0 when track is near silence (<= -50 LUFS)', () => {
    expect(calculateNormGain(-55, -14, true)).toBe(1.0);
    expect(calculateNormGain(-70, -14, true)).toBe(1.0);
  });

  it('calculates 1.0 linear gain when trackLufs equals targetLufs', () => {
    expect(calculateNormGain(-14, -14, true)).toBe(1.0);
  });

  it('boosts quiet track with +6 dB max clamp', () => {
    // Diff: -14 - (-18) = +4 dB -> 10^(4/20) ≈ 1.5849
    const gain4dB = calculateNormGain(-18, -14, true);
    expect(gain4dB).toBeCloseTo(Math.pow(10, 4 / 20), 4);

    // Diff: -14 - (-30) = +16 dB -> clamped to +6 dB -> 10^(6/20) ≈ 1.9953
    const gainClamped = calculateNormGain(-30, -14, true);
    expect(gainClamped).toBeCloseTo(Math.pow(10, 6 / 20), 4);
  });

  it('attenuates loud track with -12 dB min clamp', () => {
    // Diff: -14 - (-8) = -6 dB -> 10^(-6/20) ≈ 0.5012
    const gainMinus6 = calculateNormGain(-8, -14, true);
    expect(gainMinus6).toBeCloseTo(Math.pow(10, -6 / 20), 4);

    // Diff: -14 - (0) = -14 dB -> clamped to -12 dB -> 10^(-12/20) ≈ 0.2512
    const gainClamped = calculateNormGain(0, -14, true);
    expect(gainClamped).toBeCloseTo(Math.pow(10, -12 / 20), 4);
  });
});

describe('calculateAudioBufferLufs', () => {
  it('returns -14 if buffer is empty or missing', () => {
    expect(calculateAudioBufferLufs(null as unknown as AudioBuffer)).toBe(-14);
  });

  it('returns -70 for completely silent buffer', () => {
    const silentData = new Float32Array(4800);
    const mockBuffer = {
      length: 4800,
      numberOfChannels: 2,
      sampleRate: 48000,
      getChannelData: () => silentData,
    } as unknown as AudioBuffer;

    expect(calculateAudioBufferLufs(mockBuffer)).toBe(-70);
  });

  it('calculates finite LUFS value for a generated sine wave buffer', () => {
    const sampleRate = 48000;
    const length = 48000 * 2; // 2 seconds
    const sineData = new Float32Array(length);
    const freq = 1000; // 1kHz standard tone
    const amp = 0.5;

    for (let i = 0; i < length; i++) {
      sineData[i] = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate);
    }

    const mockBuffer = {
      length,
      numberOfChannels: 2,
      sampleRate,
      getChannelData: () => sineData,
    } as unknown as AudioBuffer;

    const lufs = calculateAudioBufferLufs(mockBuffer);
    expect(Number.isFinite(lufs)).toBe(true);
    // 0.5 amplitude sine tone should sit around -9 to -6 LUFS after K-weighting
    expect(lufs).toBeGreaterThan(-15);
    expect(lufs).toBeLessThan(-3);
  });
});
