
export interface ViewPreferences {
    isStreamMode: boolean;
}

const STORAGE_KEY = 'khelper.ui.viewPreferences';

export function loadViewPreferences(): ViewPreferences | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (err) {
        console.warn('[Settings] Failed to load view preferences', err);
        return null;
    }
}

export function saveViewPreferences(prefs: ViewPreferences): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (err) {
        console.warn('[Settings] Failed to save view preferences', err);
    }
}
