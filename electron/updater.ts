
import { app, ipcMain, BrowserWindow, shell } from 'electron';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import { loadSettings, saveSettings } from './userData';

// Configure AutoUpdater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.allowPrerelease = true; // Support beta releases

// State Definition
type UpdaterStatus = 'idle' | 'checking' | 'available' | 'error';

interface UpdaterState {
    status: UpdaterStatus;
    updateInfo: UpdateInfo | null;
    error: string | null;
    lastCheckTime: number | null;
}

let currentState: UpdaterState = {
    status: 'idle',
    updateInfo: null,
    error: null,
    lastCheckTime: null,
};

// Internal Guards
let isChecking = false;

// Broadcast helper
function broadcastStatus() {
    const windows = BrowserWindow.getAllWindows();
    // Sanitize state for IPC
    const payload = {
        status: currentState.status,
        updateInfo: currentState.updateInfo, // UpdateInfo is generally safe JSON
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
        setState({ status: 'checking', error: null });
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

        setState({ status: 'available', updateInfo: info });
    });

    autoUpdater.on('update-not-available', () => {
        setState({ status: 'idle', updateInfo: null });
    });

    autoUpdater.on('error', (err) => {
        console.error('[Updater] Error:', err);
        setState({ status: 'error', error: err.message });
        isChecking = false;
    });
}

let lastCheckWasManual = false;

async function checkForUpdates({ manual }: { manual: boolean }) {
    if (isChecking) {
        console.log('[Updater] Check already in progress');
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
        setState({ lastCheckTime: Date.now() });
    } catch (e: any) {
        console.error('[Updater] Failed to check:', e);
        setState({ status: 'error', error: e.message });
    } finally {
        isChecking = false;
    }
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
            error: currentState.error,
        };
    });
}
