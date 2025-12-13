import type { OutputRole } from '../audio/AudioEngine';

export interface OutputDevicePreferences {
  streamDeviceId: string | null;
  headphoneDeviceId: string | null;
  // stored as "streamId_headphoneId": offsetMs
  deviceOffsets?: Record<string, number>;
}

const STORAGE_KEY = 'khelper.audio.outputDevices';

export function loadOutputDevicePreferences(): OutputDevicePreferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OutputDevicePreferences>;
    return {
      streamDeviceId: typeof parsed.streamDeviceId === 'string' ? parsed.streamDeviceId : null,
      headphoneDeviceId: typeof parsed.headphoneDeviceId === 'string' ? parsed.headphoneDeviceId : null,
      deviceOffsets: parsed.deviceOffsets || {},
    };
  } catch (err) {
    console.warn('[Settings] Failed to load output device preferences', err);
    return null;
  }
}

export function saveOutputDevicePreferences(preferences: OutputDevicePreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (err) {
    console.warn('[Settings] Failed to save output device preferences', err);
  }
}

export function updateOutputDevicePreference(role: OutputRole, deviceId: string | null): OutputDevicePreferences {
  const current = loadOutputDevicePreferences() ?? { streamDeviceId: null, headphoneDeviceId: null, deviceOffsets: {} };
  const next: OutputDevicePreferences =
    role === 'stream'
      ? { ...current, streamDeviceId: deviceId }
      : { ...current, headphoneDeviceId: deviceId };
  saveOutputDevicePreferences(next);
  return next;
}

function getPairKey(streamId: string | null, headphoneId: string | null): string {
  return `${streamId || 'default'}_${headphoneId || 'default'}`;
}

export function getAudioOffset(streamId: string | null, headphoneId: string | null): number {
  const prefs = loadOutputDevicePreferences();
  if (!prefs || !prefs.deviceOffsets) return 0;
  const key = getPairKey(streamId, headphoneId);
  return prefs.deviceOffsets[key] || 0;
}

export function saveAudioOffset(streamId: string | null, headphoneId: string | null, offsetMs: number): void {
  const prefs = loadOutputDevicePreferences() || { streamDeviceId: null, headphoneDeviceId: null, deviceOffsets: {} };
  if (!prefs.deviceOffsets) prefs.deviceOffsets = {};

  const key = getPairKey(streamId, headphoneId);
  prefs.deviceOffsets[key] = offsetMs;

  saveOutputDevicePreferences(prefs);
}
