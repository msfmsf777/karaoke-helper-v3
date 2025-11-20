export interface VolumePreferences {
  streamVolume: number; // 0-1
  headphoneVolume: number; // 0-1
}

const STORAGE_KEY = 'khelper.audio.outputVolumes';
const DEFAULTS: VolumePreferences = { streamVolume: 0.8, headphoneVolume: 1 };

const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function loadVolumePreferences(): VolumePreferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VolumePreferences>;
    return {
      streamVolume: Number.isFinite(Number(parsed.streamVolume))
        ? clamp(Number(parsed.streamVolume))
        : DEFAULTS.streamVolume,
      headphoneVolume: Number.isFinite(Number(parsed.headphoneVolume))
        ? clamp(Number(parsed.headphoneVolume))
        : DEFAULTS.headphoneVolume,
    };
  } catch (err) {
    console.warn('[Settings] Failed to load volume preferences', err);
    return null;
  }
}

export function saveVolumePreferences(pref: VolumePreferences): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        streamVolume: clamp(pref.streamVolume),
        headphoneVolume: clamp(pref.headphoneVolume),
      }),
    );
  } catch (err) {
    console.warn('[Settings] Failed to save volume preferences', err);
  }
}
