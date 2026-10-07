import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import {
  getDefaultSongsDir,
  getSongsDir,
  setCustomSongsDir,
  invalidateCache,
  loadAllSongs,
} from './songLibrary';
import { loadSettings, saveSettings } from './userData';
import { getAllJobs as getSeparationJobs } from './separationJobs';
import { downloadManager } from './downloadJobs';
import type {
  MigrationProgress,
  StorageInfo,
  StoragePreflightResult,
  SongMeta,
} from '../shared/songTypes';

const MIGRATING_MARKER = '.khelper_migrating';
const PROBE_PREFIX = '.khelper_probe_';

type MigrationSubscriber = (progress: MigrationProgress) => void;

class MigrationManager {
  private activeProgress: MigrationProgress = {
    status: 'idle',
    sourcePath: '',
    targetPath: '',
    totalSongs: 0,
    copiedSongs: 0,
    currentSongTitle: '',
    totalBytes: 0,
    copiedBytes: 0,
    percent: 0,
  };

  private subscribers = new Set<MigrationSubscriber>();
  private abortController: AbortController | null = null;
  private isMigrating = false;
  private lastSourcePath: string | null = null;

  subscribe(callback: MigrationSubscriber): () => void {
    this.subscribers.add(callback);
    callback(this.getProgress());
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify() {
    const progress = this.getProgress();
    for (const sub of this.subscribers) {
      try {
        sub(progress);
      } catch (err) {
        console.error('[MigrationManager] Subscriber error', err);
      }
    }
  }

  getProgress(): MigrationProgress {
    return { ...this.activeProgress };
  }

  private async calculateDirectoryStats(dirPath: string): Promise<{ totalSongs: number; totalBytes: number }> {
    let totalSongs = 0;
    let totalBytes = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subDir = path.join(dirPath, entry.name);
          const metaPath = path.join(subDir, 'meta.json');
          try {
            await fs.access(metaPath);
            totalSongs += 1;
            // Sum all files in this song directory
            const files = await fs.readdir(subDir, { withFileTypes: true });
            for (const file of files) {
              if (file.isFile()) {
                const stat = await fs.stat(path.join(subDir, file.name));
                totalBytes += stat.size;
              }
            }
          } catch {
            // Not a song folder, ignore
          }
        }
      }
    } catch (err) {
      // If directory doesn't exist yet, return 0
    }

    return { totalSongs, totalBytes };
  }

  private async getDiskFreeBytes(dirPath: string): Promise<number> {
    try {
      // Ensure path exists for statfs
      let checkPath = path.resolve(dirPath);
      while (checkPath && checkPath !== path.dirname(checkPath)) {
        try {
          await fs.access(checkPath);
          break;
        } catch {
          checkPath = path.dirname(checkPath);
        }
      }
      const stat = await fs.statfs(checkPath);
      return Number(stat.bavail) * Number(stat.bsize);
    } catch (err) {
      console.warn('[MigrationManager] Failed to query disk free space', dirPath, err);
      // Fallback: 50 GB estimate if unsupported
      return 50 * 1024 * 1024 * 1024;
    }
  }

  async getStorageInfo(): Promise<StorageInfo> {
    const currentPath = path.resolve(getSongsDir());
    const defaultPath = path.resolve(getDefaultSongsDir());
    const isDefault = currentPath.toLowerCase() === defaultPath.toLowerCase();

    const { totalSongs, totalBytes } = await this.calculateDirectoryStats(currentPath);
    const freeBytes = await this.getDiskFreeBytes(currentPath);

    return {
      currentPath,
      isDefault,
      totalSongs,
      totalBytes,
      freeBytes,
    };
  }

  async preflightCheck(targetInputPath: string): Promise<StoragePreflightResult> {
    if (!targetInputPath || typeof targetInputPath !== 'string' || !targetInputPath.trim()) {
      return {
        valid: false,
        canDirectSwitch: false,
        totalSongs: 0,
        totalBytes: 0,
        targetFreeBytes: 0,
        error: 'Invalid target path',
      };
    }

    const currentPath = path.resolve(getSongsDir());
    const targetPath = path.resolve(targetInputPath.trim());

    // 1. Check if same folder
    if (currentPath.toLowerCase() === targetPath.toLowerCase()) {
      return {
        valid: false,
        canDirectSwitch: false,
        totalSongs: 0,
        totalBytes: 0,
        targetFreeBytes: 0,
        error: 'Target folder is the same as the current library folder',
      };
    }

    // 2. Check if nested
    const currentWithSep = currentPath.endsWith(path.sep) ? currentPath : `${currentPath}${path.sep}`;
    const targetWithSep = targetPath.endsWith(path.sep) ? targetPath : `${targetPath}${path.sep}`;

    if (
      targetPath.toLowerCase().startsWith(currentWithSep.toLowerCase()) ||
      currentPath.toLowerCase().startsWith(targetWithSep.toLowerCase())
    ) {
      return {
        valid: false,
        canDirectSwitch: false,
        totalSongs: 0,
        totalBytes: 0,
        targetFreeBytes: 0,
        error: 'Target folder cannot be nested inside the current songs directory or vice-versa',
      };
    }

    // 3. Check for active background processes
    const sepJobsList = await getSeparationJobs();
    const activeSeparations = sepJobsList.some(
      (j) => j.status === 'running' || j.status === 'queued'
    );
    if (activeSeparations) {
      return {
        valid: false,
        canDirectSwitch: false,
        totalSongs: 0,
        totalBytes: 0,
        targetFreeBytes: 0,
        error: 'Cannot migrate while AI vocal separation jobs are running or queued. Please wait or cancel them.',
      };
    }

    const activeDownloads = downloadManager.getAll().some(
      (j) => ['queued', 'downloading', 'processing'].includes(j.status)
    );
    if (activeDownloads) {
      return {
        valid: false,
        canDirectSwitch: false,
        totalSongs: 0,
        totalBytes: 0,
        targetFreeBytes: 0,
        error: 'Cannot migrate while YouTube downloads are in progress. Please wait or cancel downloads.',
      };
    }

    // 4. Test write permissions
    try {
      await fs.mkdir(targetPath, { recursive: true });
      const probeFile = path.join(targetPath, `${PROBE_PREFIX}${Date.now()}`);
      await fs.writeFile(probeFile, 'khelper', 'utf-8');
      await fs.unlink(probeFile);
    } catch (err: unknown) {
      return {
        valid: false,
        canDirectSwitch: false,
        totalSongs: 0,
        totalBytes: 0,
        targetFreeBytes: 0,
        error: `Target folder is not writeable: ${(err as Error)?.message || 'Access denied'}`,
      };
    }

    // 5. Source stats
    const { totalSongs, totalBytes } = await this.calculateDirectoryStats(currentPath);

    // 6. Target stats
    const targetStats = await this.calculateDirectoryStats(targetPath);
    const targetFreeBytes = await this.getDiskFreeBytes(targetPath);

    // 7. Check if target drive has enough disk space
    // Buffer: source size + 500 MB headroom
    const BUFFER = 500 * 1024 * 1024;
    if (totalSongs > 0 && targetFreeBytes < totalBytes + BUFFER) {
      return {
        valid: false,
        canDirectSwitch: targetStats.totalSongs > 0,
        existingSongCountInTarget: targetStats.totalSongs,
        totalSongs,
        totalBytes,
        targetFreeBytes,
        error: `Insufficient disk space on destination drive. Required: ${Math.ceil((totalBytes + BUFFER) / (1024 * 1024))} MB, Available: ${Math.floor(targetFreeBytes / (1024 * 1024))} MB`,
      };
    }

    return {
      valid: true,
      canDirectSwitch: targetStats.totalSongs > 0,
      existingSongCountInTarget: targetStats.totalSongs,
      totalSongs,
      totalBytes,
      targetFreeBytes,
    };
  }

  async startMigration(targetInputPath: string, mode: 'move' | 'switch'): Promise<MigrationProgress> {
    if (this.isMigrating) {
      throw new Error('A migration is already in progress');
    }

    const preflight = await this.preflightCheck(targetInputPath);
    if (!preflight.valid && !(mode === 'switch' && preflight.canDirectSwitch)) {
      throw new Error(preflight.error || 'Preflight check failed');
    }

    const sourcePath = path.resolve(getSongsDir());
    const targetPath = path.resolve(targetInputPath.trim());
    this.lastSourcePath = sourcePath;

    if (mode === 'switch') {
      console.log('[MigrationManager] Switching active songs directory directly to:', targetPath);
      this.activeProgress = {
        status: 'running',
        sourcePath,
        targetPath,
        totalSongs: preflight.existingSongCountInTarget || 0,
        copiedSongs: 0,
        currentSongTitle: '',
        totalBytes: 0,
        copiedBytes: 0,
        percent: 50,
        startedAt: new Date().toISOString(),
      };
      this.notify();

      try {
        const settings = await loadSettings();
        await saveSettings({
          ...settings,
          customSongsPath: targetPath,
        });
        setCustomSongsDir(targetPath);
        invalidateCache();
        await loadAllSongs();

        this.activeProgress = {
          status: 'completed',
          sourcePath,
          targetPath,
          totalSongs: preflight.existingSongCountInTarget || 0,
          copiedSongs: preflight.existingSongCountInTarget || 0,
          currentSongTitle: '',
          totalBytes: 0,
          copiedBytes: 0,
          percent: 100,
          startedAt: this.activeProgress.startedAt,
        };
        this.notify();
        return this.getProgress();
      } catch (err: unknown) {
        console.error('[MigrationManager] Direct switch failed', err);
        const errMsg = err instanceof Error ? err.message : String(err);
        this.activeProgress = {
          status: 'failed',
          sourcePath,
          targetPath,
          totalSongs: 0,
          copiedSongs: 0,
          currentSongTitle: '',
          totalBytes: 0,
          copiedBytes: 0,
          percent: 0,
          error: errMsg || 'Failed to switch library',
          startedAt: this.activeProgress.startedAt,
        };
        this.notify();
        throw err;
      }
    }

    // Mode: 'move'
    this.isMigrating = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.activeProgress = {
      status: 'running',
      sourcePath,
      targetPath,
      totalSongs: preflight.totalSongs,
      copiedSongs: 0,
      currentSongTitle: '',
      totalBytes: preflight.totalBytes,
      copiedBytes: 0,
      percent: 0,
      startedAt: new Date().toISOString(),
    };
    this.notify();

    const markerPath = path.join(targetPath, MIGRATING_MARKER);

    try {
      await fs.mkdir(targetPath, { recursive: true });
      await fs.writeFile(markerPath, JSON.stringify({ sourcePath, startedAt: new Date().toISOString() }));

      if (preflight.totalSongs === 0) {
        // Empty library — instant switch!
        this.activeProgress.percent = 100;
        this.activeProgress.status = 'completed';
        this.notify();

        try { await fs.unlink(markerPath); } catch { /* ignore */ }
        const settings = await loadSettings();
        await saveSettings({ ...settings, customSongsPath: targetPath });
        setCustomSongsDir(targetPath);
        invalidateCache();
        await loadAllSongs();
        return this.getProgress();
      }

      // Read all song folders from source
      const entries = await fs.readdir(sourcePath, { withFileTypes: true });
      const songFolderNames: string[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const metaPath = path.join(sourcePath, entry.name, 'meta.json');
          try {
            await fs.access(metaPath);
            songFolderNames.push(entry.name);
          } catch {
            /* not a song folder */
          }
        }
      }

      let copiedSongs = 0;
      let copiedBytes = 0;

      for (const folderName of songFolderNames) {
        if (signal.aborted) {
          throw new Error('Migration was cancelled by the user');
        }

        const srcSongDir = path.join(sourcePath, folderName);
        const dstSongDir = path.join(targetPath, folderName);

        // Read song title for progress reporting
        let songTitle = folderName;
        try {
          const metaRaw = await fs.readFile(path.join(srcSongDir, 'meta.json'), 'utf-8');
          const meta = JSON.parse(metaRaw) as SongMeta;
          if (meta.title) songTitle = meta.title;
        } catch {
          /* ignore unreadable meta */
        }

        this.activeProgress.currentSongTitle = songTitle;
        this.notify();

        await fs.mkdir(dstSongDir, { recursive: true });

        // Copy all files in song folder
        const files = await fs.readdir(srcSongDir, { withFileTypes: true });
        for (const file of files) {
          if (signal.aborted) {
            throw new Error('Migration was cancelled by the user');
          }

          if (file.isFile()) {
            const srcFile = path.join(srcSongDir, file.name);
            const dstFile = path.join(dstSongDir, file.name);

            if (file.name === 'meta.json') {
              // Read, rewrite any absolute paths that point to old sourcePath, and write
              try {
                const metaContent = await fs.readFile(srcFile, 'utf-8');
                const meta = JSON.parse(metaContent) as SongMeta;

                // Rewrite paths to point to new dstSongDir
                if (meta.instrumental_path) {
                  meta.instrumental_path = path.join(dstSongDir, path.basename(meta.instrumental_path));
                }
                if (meta.vocal_path) {
                  meta.vocal_path = path.join(dstSongDir, path.basename(meta.vocal_path));
                }
                if (meta.lyrics_raw_path) {
                  meta.lyrics_raw_path = path.join(dstSongDir, path.basename(meta.lyrics_raw_path));
                }
                if (meta.lyrics_lrc_path) {
                  meta.lyrics_lrc_path = path.join(dstSongDir, path.basename(meta.lyrics_lrc_path));
                }
                if (meta.thumbnail_path) {
                  meta.thumbnail_path = path.join(dstSongDir, path.basename(meta.thumbnail_path));
                }

                await fs.writeFile(dstFile, JSON.stringify(meta, null, 2), 'utf-8');
              } catch (err) {
                // Fallback copy
                await fs.copyFile(srcFile, dstFile);
              }
            } else {
              await fs.copyFile(srcFile, dstFile);
            }

            const stat = await fs.stat(srcFile);
            copiedBytes += stat.size;
          }
        }

        copiedSongs += 1;
        this.activeProgress.copiedSongs = copiedSongs;
        this.activeProgress.copiedBytes = copiedBytes;
        this.activeProgress.percent = Math.min(
          99,
          Math.round((copiedSongs / preflight.totalSongs) * 100)
        );
        this.notify();
      }

      // Verification Phase
      this.activeProgress.status = 'verifying';
      this.notify();

      for (const folderName of songFolderNames) {
        const dstMeta = path.join(targetPath, folderName, 'meta.json');
        await fs.access(dstMeta);
      }

      // Remove in-progress marker
      try {
        await fs.unlink(markerPath);
      } catch {
        /* ignore */
      }

      // Atomic settings update
      const settings = await loadSettings();
      await saveSettings({
        ...settings,
        customSongsPath: targetPath,
      });

      setCustomSongsDir(targetPath);
      invalidateCache();
      await loadAllSongs();

      this.activeProgress.percent = 100;
      this.activeProgress.status = 'completed';
      this.notify();
      console.log('[MigrationManager] Migration finished successfully to:', targetPath);
    } catch (err: unknown) {
      console.error('[MigrationManager] Migration failed or cancelled', err);

      try {
        await fs.unlink(markerPath);
      } catch {
        /* ignore */
      }

      const errMsg = err instanceof Error ? err.message : String(err);
      if (signal.aborted || errMsg.includes('cancelled')) {
        this.activeProgress.status = 'cancelled';
        this.activeProgress.error = 'Migration was cancelled';
      } else {
        this.activeProgress.status = 'failed';
        this.activeProgress.error = errMsg || 'Unknown migration error';
      }
      this.notify();
    } finally {
      this.isMigrating = false;
      this.abortController = null;
    }
    return this.getProgress();
  }

  cancelMigration() {
    if (this.abortController && this.isMigrating) {
      console.log('[MigrationManager] Cancelling in-flight migration...');
      this.abortController.abort();
    }
  }

  getLastSourcePath(): string | null {
    return this.lastSourcePath;
  }

  async cleanOldAppDataFolder(customOldPath?: string): Promise<{ success: boolean; freedBytes: number; error?: string }> {
    const defaultPath = path.resolve(getDefaultSongsDir());
    const currentActivePath = path.resolve(getSongsDir());
    const folderToClean = customOldPath
      ? path.resolve(customOldPath)
      : (this.lastSourcePath ? path.resolve(this.lastSourcePath) : defaultPath);

    // Safety checks:
    // 1. Never delete currently active path!
    if (folderToClean.toLowerCase() === currentActivePath.toLowerCase()) {
      return {
        success: false,
        freedBytes: 0,
        error: 'Cannot clean currently active songs folder',
      };
    }

    // 2. Never delete userData directly or drive root!
    const userData = path.resolve(app.getPath('userData'));
    if (folderToClean.toLowerCase() === userData.toLowerCase() || folderToClean === path.dirname(folderToClean)) {
      return {
        success: false,
        freedBytes: 0,
        error: 'Cannot clean protected system or root directory',
      };
    }

    try {
      const stats = await this.calculateDirectoryStats(folderToClean);
      await fs.rm(folderToClean, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      console.log('[MigrationManager] Cleaned old folder successfully:', folderToClean);
      return {
        success: true,
        freedBytes: stats.totalBytes,
      };
    } catch (err: unknown) {
      console.error('[MigrationManager] Failed to clean old folder', folderToClean, err);
      return {
        success: false,
        freedBytes: 0,
        error: (err instanceof Error ? err.message : String(err)) || 'Failed to clean old directory',
      };
    }
  }
}

export const migrationManager = new MigrationManager();
