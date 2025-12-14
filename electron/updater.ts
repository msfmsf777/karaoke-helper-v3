
import { app, ipcMain, BrowserWindow } from 'electron';
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import { loadSettings, saveSettings } from './userData';

// Configure AutoUpdater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.allowPrerelease = true; // Support beta releases

// State Definition
type UpdaterStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';

interface UpdaterState {
    status: UpdaterStatus;
    updateInfo: UpdateInfo | null;
    progress: ProgressInfo | null;
    error: string | null;
    lastCheckTime: number | null;
}

let currentState: UpdaterState = {
    status: 'idle',
    updateInfo: null,
    progress: null,
    error: null,
    lastCheckTime: null,
};

// Internal Guards
let isChecking = false;
let isDownloading = false;

// Broadcast helper
function broadcastStatus() {
    const windows = BrowserWindow.getAllWindows();
    // Sanitize state for IPC
    const payload = {
        status: currentState.status,
        updateInfo: currentState.updateInfo, // UpdateInfo is generally safe JSON
        progress: currentState.progress,
        error: currentState.error,
        lastCheckTime: currentState.lastCheckTime,
    };

    windows.forEach(win => {
        if (!win.isDestroyed()) {
            win.webContents.send('updater:status', payload);
        }
    });
}

function setState(newState: Partial<UpdaterState>) {
    currentState = { ...currentState, ...newState };
    broadcastStatus();
}

export async function initUpdater() {
    // 1. Setup Listeners
    setupAutoUpdaterEvents();
    setupIpcHandlers();

    // 2. Initial Auto-Check (Packaged Only)
    if (app.isPackaged) {
        // Delay slightly to ensure window is ready or just let it run
        setTimeout(() => {
            checkForUpdates({ manual: false });
        }, 3000);
    }
}

function setupAutoUpdaterEvents() {
    autoUpdater.on('checking-for-update', () => {
        // Only set status if we initiated it (handled in checkForUpdates)
        // But autoUpdater might retry? simpler to just log or ignore UI update here if we manage state manually.
        // Actually best to sync state here.
        setState({ status: 'checking', error: null });
    });

    autoUpdater.on('update-available', async (info: UpdateInfo) => {
        const settings = await loadSettings();
        const ignoredVersion = settings.ignoredVersion;

        // If manual check, we always show it. If auto check, filter ignored.
        // Problem: 'update-available' event doesn't tell us if it was manual or auto.
        // Solution: We can track `isManualParams` in memory scope of checkForUpdates? 
        // Or clearer: we always go to 'available' state, but the UI decides to show/hide based on ignore?
        // NO. "MUST-1 — Persist ... Main reads/writes + filters."

        // We need to know if the current check was manual.
        // Let's store a flag "lastCheckWasManual".

        if (!lastCheckWasManual && ignoredVersion === info.version) {
            console.log('[Updater] Skipping ignored version:', info.version);
            setState({ status: 'idle', updateInfo: null }); // Reset to idle effectively hiding it
            return;
        }

        setState({ status: 'available', updateInfo: info });
    });

    autoUpdater.on('update-not-available', () => {
        setState({ status: 'idle', updateInfo: null });
        // If manual, we might want to tell user "No updates".
        // The UI observes state 'idle'. 
        // We can emit a specific one-off event for "no-update-found" if needed, 
        // but typically "checking" -> "idle" implies no update found if no "available" happened.
        // Let's stick to status.
    });

    autoUpdater.on('error', (err) => {
        console.error('[Updater] Error:', err);
        setState({ status: 'error', error: err.message });
        isChecking = false;
        isDownloading = false;
    });

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
        setState({ status: 'downloading', progress });
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
        isDownloading = false;
        setState({ status: 'downloaded', updateInfo: info });
    });
}

let lastCheckWasManual = false;

async function checkForUpdates({ manual }: { manual: boolean }) {
    if (isChecking) {
        console.log('[Updater] Check already in progress');
        return;
    }
    if (isDownloading) {
        console.log('[Updater] Download in progress, skipping check');
        return;
    }

    // Dev Guard
    if (!app.isPackaged && !process.env.FORCE_UPDATER) {
        console.log('[Updater] Skipping update check in DEV mode');
        return;
    }

    isChecking = true;
    lastCheckWasManual = manual;
    setState({ status: 'checking', error: null });

    try {
        await autoUpdater.checkForUpdates();
        // Determine if we should update lastCheckTime here? 
        // autoUpdater events will fire.
        // Let's rely on events, or just set it here if we want "attempted check" time.
        // Better: update it on completion.
        setState({ lastCheckTime: Date.now() });
    } catch (e: any) {
        console.error('[Updater] Failed to check:', e);
        setState({ status: 'error', error: e.message });
    } finally {
        isChecking = false;
    }
}

async function downloadUpdate() {
    if (isDownloading) return;
    if (currentState.status !== 'available') return;

    isDownloading = true;
    setState({ status: 'downloading', error: null, progress: null });

    try {
        await autoUpdater.downloadUpdate();
    } catch (e: any) {
        isDownloading = false;
        setState({ status: 'error', error: e.message });
    }
}

function setupIpcHandlers() {
    ipcMain.handle('updater:check', () => {
        checkForUpdates({ manual: true });
    });

    ipcMain.handle('updater:download', () => {
        downloadUpdate();
    });

    ipcMain.handle('updater:install', () => {
        if (currentState.status === 'downloaded') {
            autoUpdater.quitAndInstall();
        }
    });

    ipcMain.handle('updater:ignore', async (_event, version: string) => {
        const settings = await loadSettings();
        settings.ignoredVersion = version;
        await saveSettings(settings);

        // If we are currently showing this version, we should probably go back to idle?
        // "If user ignores version X, hide the green icon (for that X)"
        if (currentState.updateInfo?.version === version) {
            setState({ status: 'idle', updateInfo: null });
        }
    });

    ipcMain.handle('updater:get-status', () => {
        return {
            status: currentState.status,
            updateInfo: currentState.updateInfo,
            progress: currentState.progress,
            error: currentState.error,
        };
    });
}
