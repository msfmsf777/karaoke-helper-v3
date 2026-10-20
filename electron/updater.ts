import { app, ipcMain, BrowserWindow, shell } from 'electron';
import { autoUpdater, ProgressInfo, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { loadSettings, saveSettings } from './userData';
import { trackAnalytics } from './analytics';
import { categorizeAnalyticsFailure } from '../shared/analytics';
import { launchUpdateSplash } from './updateSplash';

// Configure AutoUpdater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.allowPrerelease = true;

export type UpdaterStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error';
export type UpdaterErrorCode = 'disk_full' | 'network' | 'install_failed' | 'unknown';

export interface UpdaterProgress {
    percent: number;
    transferred: number;
    total: number;
    bytesPerSecond: number;
}

export interface UpdaterState {
    status: UpdaterStatus;
    updateInfo: UpdateInfo | null;
    progress: UpdaterProgress | null;
    error: string | null;
    errorCode?: UpdaterErrorCode | null;
    lastCheckTime: number | null;
}

export interface JustUpdatedPayload {
    version: string;
    releaseNotes?: string | Array<{ version?: string; note?: string | null }> | null;
}

let currentState: UpdaterState = {
    status: 'idle',
    updateInfo: null,
    progress: null,
    error: null,
    errorCode: null,
    lastCheckTime: null,
};

// Internal Guards
let isChecking = false;
let isDownloading = false;
let lastCheckWasManual = false;
let lastFailureSignal: { stage: 'check' | 'download' | 'install'; at: number } | null = null;
let pendingJustUpdatedNotice: JustUpdatedPayload | null = null;

// Dev Simulation State
let debugSimulationActive = false;
let debugSimulatedOutcome: 'success' | 'fail' = 'success';

// Lifecycle hooks registered by main.ts
let onPrepareForUpdateInstall: (() => void) | null = null;
let onSimulateWindowVisibility: ((visible: boolean) => void) | null = null;

export function registerUpdaterLifecycleHooks(hooks: {
    prepareForInstall: () => void;
    setMainWindowVisible: (visible: boolean) => void;
}) {
    onPrepareForUpdateInstall = hooks.prepareForInstall;
    onSimulateWindowVisibility = hooks.setMainWindowVisible;
}

function getUpdaterPendingDir(): string {
    const localAppData = process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local');
    return path.join(localAppData, 'khelper-live-updater', 'pending');
}

export async function cleanupPartialUpdateDownloads(options?: { removeAll?: boolean }): Promise<void> {
    const pendingDir = getUpdaterPendingDir();
    try {
        if (!fs.existsSync(pendingDir)) return;
        const entries = await fsp.readdir(pendingDir);

        if (options?.removeAll) {
            await Promise.all(
                entries.map(name => fsp.rm(path.join(pendingDir, name), { recursive: true, force: true }).catch(() => {}))
            );
            return;
        }

        // 1. Delete any partial temp-* or .tmp/.part files left by an interrupted download
        for (const name of entries) {
            const lower = name.toLowerCase();
            if (lower.startsWith('temp-') || lower.endsWith('.tmp') || lower.endsWith('.part')) {
                await fsp.rm(path.join(pendingDir, name), { force: true }).catch(() => {});
            }
        }

        // 2. Validate update-info.json if present; if corrupt or missing its target binary, clean up
        const updateInfoPath = path.join(pendingDir, 'update-info.json');
        if (fs.existsSync(updateInfoPath)) {
            try {
                const raw = await fsp.readFile(updateInfoPath, 'utf-8');
                const parsed = JSON.parse(raw) as { fileName?: string };
                const fileName = parsed?.fileName;
                if (!fileName || !fs.existsSync(path.join(pendingDir, fileName))) {
                    await fsp.rm(updateInfoPath, { force: true }).catch(() => {});
                }
            } catch {
                await fsp.rm(updateInfoPath, { force: true }).catch(() => {});
            }
        }
    } catch (err) {
        console.warn('[Updater] Failed to clean partial update downloads:', err);
    }
}

export function cleanupUpdaterOnQuit(): void {
    if (!isDownloading) return;
    const pendingDir = getUpdaterPendingDir();
    try {
        if (!fs.existsSync(pendingDir)) return;
        const entries = fs.readdirSync(pendingDir);
        for (const name of entries) {
            const lower = name.toLowerCase();
            if (lower.startsWith('temp-') || lower.endsWith('.tmp') || lower.endsWith('.part')) {
                try {
                    fs.rmSync(path.join(pendingDir, name), { force: true });
                } catch {
                    // Ignore locked file errors on exit
                }
            }
        }
    } catch {
        // Ignore cleanup errors on exit
    }
}

function isDiskFullError(error: unknown): boolean {
    const msg = getErrorMessage(error);
    return /ENOSPC|no space left|disk full|not enough space|0x80070070|There is not enough space on the disk/i.test(msg);
}

async function checkSufficientDiskSpace(info: UpdateInfo | null): Promise<{ ok: boolean; freeBytes?: number; requiredBytes: number }> {
    const installerBytes =
        (Array.isArray(info?.files) && typeof info.files[0]?.size === 'number' && info.files[0].size > 0)
            ? info.files[0].size
            : 180 * 1024 * 1024;
    const extractionHeadroomBytes = 350 * 1024 * 1024;
    const requiredBytes = installerBytes + extractionHeadroomBytes;

    const dirsToCheck = new Set<string>();
    const localAppData = process.env.LOCALAPPDATA || app.getPath('userData');
    dirsToCheck.add(localAppData);
    dirsToCheck.add(path.dirname(process.execPath));

    let minFreeBytes: number | undefined;
    for (const dir of dirsToCheck) {
        try {
            const stats = await fsp.statfs(dir);
            const freeBytes = Number(stats.bavail) * Number(stats.bsize);
            if (Number.isFinite(freeBytes)) {
                minFreeBytes = minFreeBytes === undefined ? freeBytes : Math.min(minFreeBytes, freeBytes);
                if (freeBytes < requiredBytes) {
                    return { ok: false, freeBytes, requiredBytes };
                }
            }
        } catch {
            // Ignore statfs errors on unsupported paths
        }
    }

    return { ok: true, freeBytes: minFreeBytes, requiredBytes };
}

function trackUpdateFailure(stage: 'check' | 'download' | 'install', error: unknown) {
    const now = Date.now();
    if (lastFailureSignal?.stage === stage && now - lastFailureSignal.at < 1000) return;
    lastFailureSignal = { stage, at: now };
    void trackAnalytics({
        type: 'Update.Result',
        stage,
        result: 'failure',
        failureCategory: categorizeAnalyticsFailure(error),
    });
}

function broadcastStatus() {
    const windows = BrowserWindow.getAllWindows();
    const payload: UpdaterState = {
        status: currentState.status,
        updateInfo: currentState.updateInfo,
        progress: currentState.progress,
        error: currentState.error,
        errorCode: currentState.errorCode ?? null,
        lastCheckTime: currentState.lastCheckTime,
    };

    windows.forEach(win => {
        if (!win.isDestroyed()) {
            win.webContents.send('updater:status', payload);
        }
    });

    internalListeners.forEach(cb => cb(currentState));
}

function broadcastOpenPopup() {
    BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
            win.webContents.send('updater:open-popup');
        }
    });
}

export function broadcastJustUpdatedIfPending(targetWindow?: BrowserWindow | null) {
    if (!pendingJustUpdatedNotice) return;
    const payload = pendingJustUpdatedNotice;
    pendingJustUpdatedNotice = null;

    if (targetWindow && !targetWindow.isDestroyed()) {
        targetWindow.webContents.send('updater:just-updated', payload);
        return;
    }

    BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
            win.webContents.send('updater:just-updated', payload);
        }
    });
}

function emitJustUpdatedNow(payload: JustUpdatedPayload) {
    const windows = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed());
    if (windows.length === 0) {
        pendingJustUpdatedNotice = payload;
        return;
    }
    windows.forEach(win => {
        win.webContents.send('updater:just-updated', payload);
    });
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
    setupAutoUpdaterEvents();
    setupIpcHandlers();

    await cleanupPartialUpdateDownloads();
    await handleStartupPostUpdateCheck();

    if (app.isPackaged) {
        setTimeout(() => {
            void checkForUpdates({ manual: false });
        }, 3000);
    }
}

async function handleStartupPostUpdateCheck() {
    try {
        const settings = await loadSettings();
        const currentVersion = app.getVersion();
        const hasUpdatedArg = process.argv.includes('--updated');
        const targetVersion = settings.pendingUpdateTargetVersion;
        const fromVersion = settings.pendingUpdateFromVersion;
        const savedReleaseNotes = settings.pendingUpdateReleaseNotes;

        if (hasUpdatedArg || (targetVersion && targetVersion === currentVersion)) {
            if (targetVersion || fromVersion || savedReleaseNotes) {
                delete settings.pendingUpdateTargetVersion;
                delete settings.pendingUpdateFromVersion;
                delete settings.pendingUpdateReleaseNotes;
                await saveSettings(settings);
            }
            await cleanupPartialUpdateDownloads({ removeAll: true });
            pendingJustUpdatedNotice = {
                version: currentVersion,
                releaseNotes: savedReleaseNotes,
            };
            return;
        }

        if (targetVersion && targetVersion !== currentVersion && (!fromVersion || fromVersion === currentVersion)) {
            console.warn(`[Updater] Previous update install to v${targetVersion} did not complete (still on v${currentVersion}).`);
            delete settings.pendingUpdateTargetVersion;
            delete settings.pendingUpdateFromVersion;
            delete settings.pendingUpdateReleaseNotes;
            await saveSettings(settings);

            setState({
                status: 'error',
                errorCode: 'install_failed',
                error: `Update to v${targetVersion} could not be completed.`,
                updateInfo: {
                    version: targetVersion,
                    files: [],
                    path: '',
                    sha512: '',
                    releaseDate: new Date().toISOString(),
                    releaseNotes: savedReleaseNotes as UpdateInfo['releaseNotes'],
                },
                progress: null,
            });
        }
    } catch (err) {
        console.warn('[Updater] Failed to inspect post-update state on startup:', err);
    }
}

function setupAutoUpdaterEvents() {
    autoUpdater.on('checking-for-update', () => {
        if (!isDownloading && currentState.status !== 'downloaded') {
            setState({ status: 'checking', error: null, errorCode: null, progress: null });
        }
    });

    autoUpdater.on('update-available', async (info: UpdateInfo) => {
        debugSimulationActive = false;
        const settings = await loadSettings();
        const ignoredVersion = settings.ignoredVersion;
        if (!lastCheckWasManual && ignoredVersion === info.version) {
            console.log('[Updater] Skipping ignored version:', info.version);
            setState({ status: 'idle', updateInfo: null, error: null, errorCode: null });
            return;
        }

        setState({
            status: 'available',
            updateInfo: info,
            progress: null,
            error: null,
            errorCode: null,
            lastCheckTime: Date.now(),
        });

        // Immediately start silent pre-download in background
        void downloadUpdate();
    });

    autoUpdater.on('update-not-available', () => {
        setState({
            status: 'idle',
            updateInfo: null,
            progress: null,
            error: null,
            errorCode: null,
            lastCheckTime: Date.now(),
        });
    });

    autoUpdater.on('download-progress', (info: ProgressInfo) => {
        setState({ status: 'downloading', progress: toProgress(info), error: null, errorCode: null });
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
            errorCode: null,
        });
        void trackAnalytics({ type: 'Update.Result', stage: 'download', result: 'success' });
    });

    autoUpdater.on('error', (err) => {
        const stage = isDownloading ? 'download' : currentState.status === 'installing' ? 'install' : 'check';
        console.error('[Updater] Error:', err);
        const errorCode: UpdaterErrorCode = isDiskFullError(err)
            ? 'disk_full'
            : stage === 'install'
                ? 'install_failed'
                : 'network';
        setState({ status: 'error', error: err.message, errorCode });
        trackUpdateFailure(stage, err);
        isChecking = false;
        isDownloading = false;
    });
}

async function checkForUpdates({ manual }: { manual: boolean }) {
    if (isChecking) {
        console.log('[Updater] Check already in progress');
        return;
    }

    if (currentState.status === 'installing') {
        console.log('[Updater] Skipping update check while installing');
        return;
    }

    // If update is already pre-downloaded and ready, keep it ready
    if (currentState.status === 'downloaded') {
        setState({ lastCheckTime: Date.now() });
        if (manual) {
            broadcastOpenPopup();
        }
        return;
    }

    // If already pre-downloading in background and user clicks manual check,
    // show brief checking feedback then return to silent background downloading ("Up to date")
    if (isDownloading) {
        if (manual) {
            const savedProgress = currentState.progress;
            setState({ status: 'checking' });
            await new Promise(resolve => setTimeout(resolve, 500));
            if (isDownloading && (currentState.status as UpdaterStatus) !== 'downloaded') {
                setState({
                    status: 'downloading',
                    progress: savedProgress,
                    lastCheckTime: Date.now(),
                });
            }
        }
        return;
    }

    // If an update was found earlier (e.g. failed network download) and not yet downloaded, resume pre-download
    if (currentState.updateInfo && (currentState.status === 'available' || currentState.status === 'error') && !debugSimulationActive) {
        if (manual) {
            setState({ status: 'checking', error: null, errorCode: null });
            await new Promise(resolve => setTimeout(resolve, 450));
            setState({ lastCheckTime: Date.now() });
        }
        void downloadUpdate();
        return;
    }

    // Dev Guard
    if (!app.isPackaged && !process.env.FORCE_UPDATER) {
        console.log('[Updater] Skipping network update check in DEV mode');
        if (manual) {
            setState({ status: 'checking', error: null, errorCode: null });
            await new Promise(resolve => setTimeout(resolve, 500));
            setState({ status: 'idle', lastCheckTime: Date.now() });
        }
        return;
    }

    isChecking = true;
    lastCheckWasManual = manual;
    setState({ status: 'checking', error: null, errorCode: null, progress: null });

    try {
        await autoUpdater.checkForUpdates();
        setState({ lastCheckTime: Date.now() });
        void trackAnalytics({ type: 'Update.Result', stage: 'check', result: 'success' });
    } catch (e: unknown) {
        console.error('[Updater] Failed to check:', e);
        const errorCode: UpdaterErrorCode = isDiskFullError(e) ? 'disk_full' : 'network';
        setState({ status: 'error', error: getErrorMessage(e), errorCode, lastCheckTime: Date.now() });
        trackUpdateFailure('check', e);
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

    // Pre-check disk space before downloading
    const spaceCheck = await checkSufficientDiskSpace(currentState.updateInfo);
    if (!spaceCheck.ok) {
        console.warn('[Updater] Insufficient disk space for update pre-download:', spaceCheck);
        setState({
            status: 'error',
            errorCode: 'disk_full',
            error: 'Insufficient disk space to download and install the update.',
            progress: null,
        });
        return;
    }

    if (debugSimulationActive) {
        // In dev simulation mode, if user retries from simulated disk_full error, transition to downloaded
        setState({
            status: 'downloaded',
            progress: { percent: 100, transferred: 100 * 1024 * 1024, total: 100 * 1024 * 1024, bytesPerSecond: 0 },
            error: null,
            errorCode: null,
        });
        return;
    }

    if (!app.isPackaged && !process.env.FORCE_UPDATER) {
        console.log('[Updater] Skipping update download in DEV mode');
        return;
    }

    isDownloading = true;
    setState({ status: 'downloading', progress: null, error: null, errorCode: null });

    try {
        await autoUpdater.downloadUpdate();
    } catch (e: unknown) {
        console.error('[Updater] Failed to download:', e);
        const errorCode: UpdaterErrorCode = isDiskFullError(e) ? 'disk_full' : 'network';
        setState({ status: 'error', error: getErrorMessage(e), errorCode });
        trackUpdateFailure('download', e);
        await cleanupPartialUpdateDownloads();
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

async function runSimulatedInstallFlow(outcome: 'success' | 'fail', customVersion?: string) {
    const targetVersion = customVersion || currentState.updateInfo?.version || '3.4.2';
    const releaseNotes = currentState.updateInfo?.releaseNotes || (
        '### ✨ KHelper v' + targetVersion + ' 更新重點\n' +
        '- 全新 Discord 風格無縫背景預載與一鍵自動重啟更新體驗\n' +
        '- 支援 NVIDIA RTX 50 系列 (Blackwell sm_120) CUDA 12.8 硬體加速分離\n' +
        '- 改善磁碟空間不足預檢機制與安裝保護'
    );

    setState({
        status: 'installing',
        error: null,
        errorCode: null,
    });

    await new Promise(resolve => setTimeout(resolve, 180));
    onSimulateWindowVisibility?.(false);

    const splashChild = launchUpdateSplash({
        mode: 'simulate',
        durationMs: 3600,
    });

    await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            resolve();
        };

        const timer = setTimeout(finish, 4500);
        if (splashChild) {
            splashChild.once('exit', () => {
                clearTimeout(timer);
                finish();
            });
            splashChild.once('error', () => {
                clearTimeout(timer);
                setTimeout(finish, 3000);
            });
        } else {
            clearTimeout(timer);
            setTimeout(finish, 3000);
        }
    });

    onSimulateWindowVisibility?.(true);

    if (outcome === 'success') {
        debugSimulationActive = false;
        setState({
            status: 'idle',
            updateInfo: null,
            progress: null,
            error: null,
            errorCode: null,
            lastCheckTime: Date.now(),
        });
        emitJustUpdatedNow({
            version: targetVersion,
            releaseNotes,
        });
    } else {
        debugSimulationActive = true;
        setState({
            status: 'error',
            errorCode: 'install_failed',
            error: `Failed to apply update v${targetVersion}.`,
            updateInfo: {
                version: targetVersion,
                files: [],
                path: 'mock-path',
                sha512: 'mock-sha',
                releaseDate: new Date().toISOString(),
                releaseNotes,
            },
            progress: null,
        });
        setTimeout(() => {
            broadcastOpenPopup();
        }, 150);
    }
}

async function installDownloadedUpdate() {
    if (currentState.status !== 'downloaded') {
        console.log('[Updater] No downloaded update is ready to install');
        return;
    }

    // Check disk space before running installer extraction
    const spaceCheck = await checkSufficientDiskSpace(currentState.updateInfo);
    if (!spaceCheck.ok) {
        setState({
            status: 'error',
            errorCode: 'disk_full',
            error: 'Insufficient disk space to install the update.',
        });
        return;
    }

    // If triggered in DEV simulation mode, run the full simulated splash + reopen flow
    if (debugSimulationActive || (!app.isPackaged && !process.env.FORCE_UPDATER)) {
        await runSimulatedInstallFlow(debugSimulatedOutcome);
        return;
    }

    setState({ status: 'installing', error: null, errorCode: null });

    try {
        if (currentState.updateInfo?.version) {
            const settings = await loadSettings();
            settings.pendingUpdateTargetVersion = currentState.updateInfo.version;
            settings.pendingUpdateFromVersion = app.getVersion();
            settings.pendingUpdateReleaseNotes = currentState.updateInfo.releaseNotes as string | Array<{ note?: string }> | undefined;
            await saveSettings(settings);
        }
    } catch (err) {
        console.warn('[Updater] Failed to persist pending update version:', err);
    }

    // Launch standalone Discord-style splash window from %TEMP%
    launchUpdateSplash({
        mode: 'real',
        parentPid: process.pid,
        appExe: process.execPath,
        timeoutSec: 180,
    });

    // Brief delay so the splash window appears smoothly before the main window closes
    setTimeout(() => {
        try {
            onPrepareForUpdateInstall?.();
            autoUpdater.quitAndInstall(true, true);
        } catch (err) {
            console.error('[Updater] quitAndInstall failed:', err);
            trackUpdateFailure('install', err);
            setState({
                status: 'error',
                errorCode: 'install_failed',
                error: getErrorMessage(err),
            });
            onSimulateWindowVisibility?.(true);
        }
    }, 350);
}

async function openReleasePage() {
    const version = currentState.updateInfo?.version;
    const url = version
        ? `https://github.com/msfmsf777/karaoke-helper-v3/releases/tag/v${version}`
        : 'https://github.com/msfmsf777/karaoke-helper-v3/releases/latest';
    await shell.openExternal(url);
}

function setupIpcHandlers() {
    ipcMain.handle('updater:check', () => {
        return checkForUpdates({ manual: true });
    });

    ipcMain.handle('updater:open-release-page', () => {
        return openReleasePage();
    });

    ipcMain.handle('updater:download', () => {
        return downloadUpdate();
    });

    ipcMain.handle('updater:install', () => {
        return installDownloadedUpdate();
    });

    ipcMain.handle('updater:ignore', async (_event, version: string) => {
        const settings = await loadSettings();
        settings.ignoredVersion = version;
        await saveSettings(settings);

        console.log('[Updater] User ignored version:', version);
        debugSimulationActive = false;
        setState({ status: 'idle', updateInfo: null, error: null, errorCode: null });
    });

    ipcMain.handle('updater:get-status', () => {
        return {
            status: currentState.status,
            updateInfo: currentState.updateInfo,
            progress: currentState.progress,
            error: currentState.error,
            errorCode: currentState.errorCode ?? null,
            lastCheckTime: currentState.lastCheckTime,
        };
    });

    // Dev-only debug simulation handlers
    ipcMain.handle('updater:debug-set-state', (_event, payload: Partial<UpdaterState> & { simulatedOutcome?: 'success' | 'fail' }) => {
        if (app.isPackaged) return;
        const { simulatedOutcome, ...rest } = payload;
        debugSimulationActive = rest.status !== 'idle';
        if (simulatedOutcome) {
            debugSimulatedOutcome = simulatedOutcome;
        }
        setState(rest);
    });

    ipcMain.handle('updater:debug-simulate-flow', async (_event, payload: { outcome: 'success' | 'fail'; version?: string }) => {
        if (app.isPackaged) return;
        debugSimulationActive = true;
        debugSimulatedOutcome = payload.outcome;
        await runSimulatedInstallFlow(payload.outcome, payload.version);
    });
}

// Export for Main Process usage (Tray)
export { checkForUpdates };

export function onStatusChange(callback: (status: UpdaterState) => void) {
    internalListeners.push(callback);
    return () => {
        const idx = internalListeners.indexOf(callback);
        if (idx !== -1) internalListeners.splice(idx, 1);
    };
}

const internalListeners: ((status: UpdaterState) => void)[] = [];
