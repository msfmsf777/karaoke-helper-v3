
import { app, ipcMain, BrowserWindow, shell } from 'electron';
import { autoUpdater, ProgressInfo, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater';
import { loadSettings, saveSettings } from './userData';

// Configure AutoUpdater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.allowPrerelease = true; // Support beta releases

// State Definition
type UpdaterStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error';

interface UpdaterProgress {
    percent: number;
    transferred: number;
    total: number;
    bytesPerSecond: number;
}

interface UpdaterState {
    status: UpdaterStatus;
    updateInfo: UpdateInfo | null;
    progress: UpdaterProgress | null;
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

    // Notify internal listeners (Tray)
    internalListeners.forEach(cb => cb(currentState));
}

function setState(newState: Partial<UpdaterState>) {
    currentState = { ...currentState, ...newState };
    broadcastStatus();
}

function toProgress(info: ProgressInfo): UpdaterProgress {
    return {
        percent: Number.isFinite(info.percent) ? Math.max(0, Math.min(100, info.percent)) : 0,
        transferred: Number.isFinite(info.transferred) ? info.transferred : 0,
        total: Number.isFinite(info.total) ? info.total : 0,
        bytesPerSecond: Number.isFinite(info.bytesPerSecond) ? info.bytesPerSecond : 0,
    };
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
        setState({ status: 'checking', error: null, progress: null });
    });

    autoUpdater.on('update-available', async (info: UpdateInfo) => {
        const settings = await loadSettings();
        const ignoredVersion = settings.ignoredVersion;
        // Check manual flag
        if (!lastCheckWasManual && ignoredVersion === info.version) {
            console.log('[Updater] Skipping ignored version:', info.version);
            setState({ status: 'idle', updateInfo: null });
            return;
        }

        setState({ status: 'available', updateInfo: info, progress: null, error: null });
    });

    autoUpdater.on('update-not-available', () => {
        setState({ status: 'idle', updateInfo: null, progress: null });
    });

    autoUpdater.on('download-progress', (info: ProgressInfo) => {
        setState({ status: 'downloading', progress: toProgress(info), error: null });
    });

    autoUpdater.on('update-downloaded', (event: UpdateDownloadedEvent) => {
        isDownloading = false;
        setState({
            status: 'downloaded',
            updateInfo: event,
            progress: {
                percent: 100,
                transferred: 0,
                total: 0,
                bytesPerSecond: 0,
            },
            error: null,
        });
    });

    autoUpdater.on('error', (err) => {
        console.error('[Updater] Error:', err);
        setState({ status: 'error', error: err.message });
        isChecking = false;
        isDownloading = false;
    });
}

let lastCheckWasManual = false;

async function checkForUpdates({ manual }: { manual: boolean }) {
    if (isChecking) {
        console.log('[Updater] Check already in progress');
        return;
    }

    if (isDownloading || currentState.status === 'installing') {
        console.log('[Updater] Skipping update check while updater is busy');
        return;
    }

    // Dev Guard
    if (!app.isPackaged && !process.env.FORCE_UPDATER) {
        console.log('[Updater] Skipping update check in DEV mode');
        return;
    }

    isChecking = true;
    lastCheckWasManual = manual;
    setState({ status: 'checking', error: null, progress: null });

    try {
        await autoUpdater.checkForUpdates();
        setState({ lastCheckTime: Date.now() });
    } catch (e: unknown) {
        console.error('[Updater] Failed to check:', e);
        setState({ status: 'error', error: getErrorMessage(e) });
    } finally {
        isChecking = false;
    }
}

async function downloadUpdate() {
    if (isDownloading) {
        console.log('[Updater] Download already in progress');
        return;
    }

    if (currentState.status === 'downloaded') {
        console.log('[Updater] Update already downloaded');
        return;
    }

    if (!currentState.updateInfo) {
        console.log('[Updater] No update info available to download');
        return;
    }

    if (!app.isPackaged && !process.env.FORCE_UPDATER) {
        console.log('[Updater] Skipping update download in DEV mode');
        return;
    }

    isDownloading = true;
    setState({ status: 'downloading', progress: null, error: null });

    try {
        await autoUpdater.downloadUpdate();
    } catch (e: unknown) {
        console.error('[Updater] Failed to download:', e);
        setState({ status: 'error', error: getErrorMessage(e) });
    } finally {
        const statusAfterDownload = currentState.status as UpdaterStatus;
        if (statusAfterDownload !== 'downloaded' && statusAfterDownload !== 'installing') {
            isDownloading = false;
        }
    }
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function installDownloadedUpdate() {
    if (currentState.status !== 'downloaded') {
        console.log('[Updater] No downloaded update is ready to install');
        return;
    }

    setState({ status: 'installing', error: null });
    setTimeout(() => {
        autoUpdater.quitAndInstall(true, true);
    }, 100);
}

async function openReleasePage() {
    if (!currentState.updateInfo) return;
    const version = currentState.updateInfo.version;
    // Construct GitHub release URL
    // We can allow user to click this anytime update is available
    const url = `https://github.com/msfmsf777/karaoke-helper-v3/releases/tag/v${version}`;
    await shell.openExternal(url);
}

function setupIpcHandlers() {
    ipcMain.handle('updater:check', () => {
        checkForUpdates({ manual: true });
    });

    ipcMain.handle('updater:open-release-page', () => {
        openReleasePage();
    });

    ipcMain.handle('updater:download', () => {
        return downloadUpdate();
    });

    ipcMain.handle('updater:install', () => {
        installDownloadedUpdate();
    });

    ipcMain.handle('updater:ignore', async (_event, version: string) => {
        const settings = await loadSettings();
        settings.ignoredVersion = version;
        await saveSettings(settings);

        console.log('[Updater] User ignored version:', version);
        setState({ status: 'idle', updateInfo: null });
    });

    ipcMain.handle('updater:get-status', () => {
        return {
            status: currentState.status,
            updateInfo: currentState.updateInfo,
            progress: currentState.progress,
            error: currentState.error,
            lastCheckTime: currentState.lastCheckTime,
        };
    });
}

// Export for Main Process usage (Tray)
export { checkForUpdates };

export function onStatusChange(callback: (status: UpdaterState) => void) {
    // Hook into broadcastStatus (we need to modify broadcastStatus or just poll/event emitter - 
    // actually, lighter touch: let's just make broadcastStatus emit an internal event if we wanted, 
    // OR just modify broadcastStatus to call a list of callbacks. 
    // Let's modify broadcastStatus below.
    internalListeners.push(callback);
    return () => {
        const idx = internalListeners.indexOf(callback);
        if (idx !== -1) internalListeners.splice(idx, 1);
    };
}

const internalListeners: ((status: UpdaterState) => void)[] = [];
