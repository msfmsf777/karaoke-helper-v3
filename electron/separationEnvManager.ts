import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn, exec, execFile, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { app } from 'electron';
import { getPythonPath } from './pythonRuntime';
import { detectGpuHardware, GpuDetectionResult } from './gpuDetector';
import { loadSettings, saveSettings } from './userData';
import type {
  SeparationEngineMode,
  SeparationEnvStatus,
  SeparationInstallProgress,
  SeparationStorageInfo,
  SeparationMigrationProgress,
  SeparationRuntimeMeta,
} from '../shared/separationTypes';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const RUNTIME_META_FILE = 'runtime_meta.json';

type ProgressSubscriber = (progress: SeparationInstallProgress) => void;
type MigrationSubscriber = (progress: SeparationMigrationProgress) => void;

class SeparationEnvManager {
  private activeProcess: ChildProcess | null = null;
  private currentProgress: SeparationInstallProgress | null = null;
  private subscribers = new Set<ProgressSubscriber>();
  private isInstalling = false;
  private lastError: string | null = null;
  private verifiedReady = false;

  private cachedCustomRuntimePath: string | null = null;
  private migrationSubscribers = new Set<MigrationSubscriber>();
  private currentMigrationProgress: SeparationMigrationProgress | null = null;
  private isMigrating = false;
  private migrationAbortController: AbortController | null = null;
  private cachedDiskUsage: { path: string; bytes: number } | null = null;
  private isCalculatingDiskUsage = false;

  getSeparationEnvDir(): string {
    if (this.cachedCustomRuntimePath) {
      return this.cachedCustomRuntimePath;
    }
    return this.getDefaultSeparationEnvDir();
  }

  getDefaultSeparationEnvDir(): string {
    return path.join(app.getPath('userData'), 'separation-runtime');
  }

  isCustomPath(): boolean {
    return path.resolve(this.getSeparationEnvDir()).toLowerCase() !== path.resolve(this.getDefaultSeparationEnvDir()).toLowerCase();
  }

  setCustomRuntimePath(customPath: string | null | undefined): void {
    if (customPath && typeof customPath === 'string' && customPath.trim().length > 0) {
      this.cachedCustomRuntimePath = path.resolve(customPath.trim());
    } else {
      this.cachedCustomRuntimePath = null;
    }
    this.verifiedReady = false;
  }

  async initFromSettings(): Promise<void> {
    const settings = await loadSettings();
    const customPath = settings.separationEngine?.customRuntimePath || settings.customRuntimePath;
    if (customPath) {
      this.setCustomRuntimePath(customPath);
    }
  }

  getSeparationPackagesDir(): string {
    return path.join(this.getSeparationEnvDir(), 'Lib', 'site-packages');
  }

  subscribeProgress(callback: ProgressSubscriber): () => void {
    this.subscribers.add(callback);
    if (this.currentProgress) {
      callback(this.currentProgress);
    }
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifyProgress(progress: SeparationInstallProgress) {
    this.currentProgress = progress;
    for (const sub of this.subscribers) {
      try {
        sub(progress);
      } catch (err) {
        console.error('[SeparationEnv] Subscriber error', err);
      }
    }
  }

  subscribeMigration(callback: MigrationSubscriber): () => void {
    this.migrationSubscribers.add(callback);
    if (this.currentMigrationProgress) {
      callback(this.currentMigrationProgress);
    }
    return () => {
      this.migrationSubscribers.delete(callback);
    };
  }

  private notifyMigration(progress: SeparationMigrationProgress) {
    this.currentMigrationProgress = progress;
    for (const sub of this.migrationSubscribers) {
      try {
        sub(progress);
      } catch (err) {
        console.error('[SeparationEnv] Migration subscriber error', err);
      }
    }
  }

  getRuntimeMetaPath(envDir?: string): string {
    return path.join(envDir || this.getSeparationEnvDir(), RUNTIME_META_FILE);
  }

  async readRuntimeMeta(envDir?: string): Promise<SeparationRuntimeMeta | null> {
    const metaPath = this.getRuntimeMetaPath(envDir);
    try {
      if (!existsSync(metaPath)) return null;
      const raw = await fs.readFile(metaPath, 'utf-8');
      return JSON.parse(raw) as SeparationRuntimeMeta;
    } catch (err) {
      console.warn('[SeparationEnv] Failed to read runtime_meta.json', err);
      return null;
    }
  }

  async writeRuntimeMeta(meta: SeparationRuntimeMeta, envDir?: string): Promise<void> {
    const targetDir = envDir || this.getSeparationEnvDir();
    const metaPath = path.join(targetDir, RUNTIME_META_FILE);
    try {
      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    } catch (err) {
      console.error('[SeparationEnv] Failed to write runtime_meta.json', err);
    }
  }

  /**
   * Returns current status of separation environment.
   */
  async getStatus(): Promise<SeparationEnvStatus> {
    await this.initFromSettings();

    if (this.isInstalling) {
      const settings = await loadSettings();
      return {
        status: 'installing',
        mode: settings.separationEngine?.mode || null,
        errorMessage: undefined,
        customRuntimePath: this.isCustomPath() ? this.getSeparationEnvDir() : undefined,
      };
    }

    const currentEnvDir = this.getSeparationEnvDir();
    const packagesDir = this.getSeparationPackagesDir();
    const hasAudioSeparator = existsSync(path.join(packagesDir, 'audio_separator'));

    if (!hasAudioSeparator) {
      this.verifiedReady = false;
      this.lastError = null;
      return {
        status: 'not_installed',
        mode: null,
        errorMessage: undefined,
        customRuntimePath: this.isCustomPath() ? currentEnvDir : undefined,
      };
    }

    // Check runtime_meta.json in runtime directory
    const meta = await this.readRuntimeMeta(currentEnvDir);
    const settings = await loadSettings();
    const activeMode: SeparationEngineMode = settings.separationEngine?.mode || meta?.mode || 'gpu';
    const supportedModes: SeparationEngineMode[] = meta?.mode === 'gpu' ? ['gpu', 'cpu'] : (meta?.mode ? ['cpu'] : ['gpu', 'cpu']);

    if (meta && meta.verified) {
      this.verifiedReady = true;
      this.lastError = null;

      // Cache totalBytes in memory if present in meta, otherwise calculate lazily in background
      if (typeof meta.totalBytes === 'number' && meta.totalBytes > 0) {
        this.cachedDiskUsage = { path: currentEnvDir, bytes: meta.totalBytes };
      } else if (!this.isCalculatingDiskUsage) {
        void this.updateDiskUsageInBackground(currentEnvDir);
      }

      // Auto-sync settings if missing or out-of-sync
      if (!settings.separationEngine || settings.separationEngine.mode !== activeMode || settings.separationEngine.customRuntimePath !== (this.isCustomPath() ? currentEnvDir : undefined)) {
        await saveSettings({
          ...settings,
          separationEngine: {
            mode: activeMode,
            installedAt: meta.installedAt,
            gpuModel: meta.gpuModel,
            vramMb: meta.vramMb,
            customRuntimePath: this.isCustomPath() ? currentEnvDir : undefined,
          },
        });
      }

      return {
        status: 'ready',
        mode: activeMode,
        supportedModes,
        installedAt: meta.installedAt,
        vramMb: meta.vramMb,
        gpuModel: meta.gpuModel,
        cudaKernelFunctional: activeMode === 'gpu' ? true : undefined,
        customRuntimePath: this.isCustomPath() ? currentEnvDir : undefined,
      };
    }

    // If verifiedReady this session, return ready
    if (this.verifiedReady && settings.separationEngine) {
      return {
        status: 'ready',
        mode: settings.separationEngine.mode,
        supportedModes: settings.separationEngine.mode === 'gpu' ? ['gpu', 'cpu'] : ['cpu'],
        installedAt: settings.separationEngine.installedAt ? new Date(settings.separationEngine.installedAt).toISOString() : undefined,
        vramMb: settings.separationEngine.vramMb,
        gpuModel: settings.separationEngine.gpuModel,
        cudaKernelFunctional: settings.separationEngine.mode === 'gpu' ? true : undefined,
        customRuntimePath: this.isCustomPath() ? currentEnvDir : undefined,
      };
    }

    // Fallback: run verification probe and generate runtime_meta.json upon success
    const probeMode = settings.separationEngine?.mode || 'gpu';
    const isProbeValid = await this.verifyEnvironmentFast(probeMode);
    if (isProbeValid) {
      this.verifiedReady = true;
      this.lastError = null;
      const gpuInfo = await detectGpuHardware();
      const newMeta: SeparationRuntimeMeta = {
        version: '1.0',
        mode: probeMode,
        verified: true,
        installedAt: new Date().toISOString(),
        gpuModel: gpuInfo.modelName,
        vramMb: gpuInfo.vramMb,
        torchCuda: probeMode === 'gpu',
      };
      await this.writeRuntimeMeta(newMeta, currentEnvDir);
      void this.updateDiskUsageInBackground(currentEnvDir);
      await saveSettings({
        ...settings,
        separationEngine: {
          mode: probeMode,
          installedAt: newMeta.installedAt,
          vramMb: newMeta.vramMb,
          gpuModel: newMeta.gpuModel,
          customRuntimePath: this.isCustomPath() ? currentEnvDir : undefined,
        },
      });

      return {
        status: 'ready',
        mode: probeMode,
        supportedModes: probeMode === 'gpu' ? ['gpu', 'cpu'] : ['cpu'],
        installedAt: newMeta.installedAt,
        vramMb: newMeta.vramMb,
        gpuModel: newMeta.gpuModel,
        cudaKernelFunctional: probeMode === 'gpu' ? true : undefined,
        customRuntimePath: this.isCustomPath() ? currentEnvDir : undefined,
      };
    }

    const probeExitCode = this.lastProbeResult?.code;
    let errorMessage: string;
    if (settings.separationEngine?.mode === 'gpu') {
      if (probeExitCode === 3) {
        errorMessage = '顯卡硬體或驅動程式與 PyTorch CUDA 核心不相容（CUDA kernel execution failed），建議更新顯卡驅動程式或切換至 CPU 模式。';
      } else {
        errorMessage = 'GPU 加速環境校驗失敗（未偵測到 CUDA 裝置），請確認顯卡驅動程式支援。';
      }
    } else {
      errorMessage = '分離環境檔案可能已損毀，請嘗試重新安裝。';
    }

    return {
      status: 'error',
      mode: settings.separationEngine?.mode || null,
      errorMessage,
      cudaKernelFunctional: false,
      customRuntimePath: this.isCustomPath() ? currentEnvDir : undefined,
    };
  }

  /**
   * Switches engine mode between GPU and CPU without re-downloading when runtime supports it.
   */
  async switchEngineMode(targetMode: SeparationEngineMode): Promise<{ success: boolean; mode?: SeparationEngineMode; requiresInstall?: boolean; error?: string }> {
    const envDir = this.getSeparationEnvDir();
    const meta = await this.readRuntimeMeta(envDir);
    const packagesDir = this.getSeparationPackagesDir();
    const hasAudioSeparator = existsSync(path.join(packagesDir, 'audio_separator'));

    if (!hasAudioSeparator) {
      return { success: false, requiresInstall: true, error: '尚未安裝分離環境' };
    }

    if (targetMode === 'cpu') {
      const settings = await loadSettings();
      await saveSettings({
        ...settings,
        separationEngine: settings.separationEngine ? {
          ...settings.separationEngine,
          mode: 'cpu',
        } : {
          mode: 'cpu',
          installedAt: meta?.installedAt || new Date().toISOString(),
          gpuModel: meta?.gpuModel,
          vramMb: meta?.vramMb,
          customRuntimePath: this.isCustomPath() ? envDir : undefined,
        },
      });
      return { success: true, mode: 'cpu' };
    }

    if (targetMode === 'gpu') {
      if (meta && meta.mode === 'gpu' && meta.verified) {
        const settings = await loadSettings();
        await saveSettings({
          ...settings,
          separationEngine: settings.separationEngine ? {
            ...settings.separationEngine,
            mode: 'gpu',
          } : {
            mode: 'gpu',
            installedAt: meta.installedAt,
            gpuModel: meta.gpuModel,
            vramMb: meta.vramMb,
            customRuntimePath: this.isCustomPath() ? envDir : undefined,
          },
        });
        return { success: true, mode: 'gpu' };
      }

      // Check if installed environment actually supports CUDA
      const isCudaReady = await this.verifyEnvironmentFast('gpu');
      if (isCudaReady) {
        const gpuInfo = await detectGpuHardware();
        const updatedMeta: SeparationRuntimeMeta = {
          version: '1.0',
          mode: 'gpu',
          verified: true,
          installedAt: meta?.installedAt || new Date().toISOString(),
          gpuModel: gpuInfo.modelName,
          vramMb: gpuInfo.vramMb,
          torchCuda: true,
        };
        await this.writeRuntimeMeta(updatedMeta, envDir);
        const settings = await loadSettings();
        await saveSettings({
          ...settings,
          separationEngine: {
            mode: 'gpu',
            installedAt: updatedMeta.installedAt,
            gpuModel: updatedMeta.gpuModel,
            vramMb: updatedMeta.vramMb,
            customRuntimePath: this.isCustomPath() ? envDir : undefined,
          },
        });
        return { success: true, mode: 'gpu' };
      }

      return {
        success: false,
        requiresInstall: true,
        error: '目前環境為 CPU 版本，若要啟用 GPU 加速需要下載 CUDA 核心套件。',
      };
    }

    return { success: false, error: '不支援的模式' };
  }

  /**
   * Rescans the separation runtime folder and refreshes detection status.
   */
  async rescanFolder(targetPath?: string): Promise<SeparationEnvStatus> {
    if (targetPath && typeof targetPath === 'string' && targetPath.trim().length > 0) {
      this.setCustomRuntimePath(targetPath);
      const settings = await loadSettings();
      await saveSettings({
        ...settings,
        separationEngine: settings.separationEngine ? {
          ...settings.separationEngine,
          customRuntimePath: this.isCustomPath() ? this.getSeparationEnvDir() : undefined,
        } : undefined,
        customRuntimePath: this.isCustomPath() ? this.getSeparationEnvDir() : undefined,
      });
    }
    this.verifiedReady = false;
    this.lastError = null;
    this.cachedDiskUsage = null;
    return await this.getStatus();
  }

  isReady(): boolean {
    return this.verifiedReady;
  }

  /**
   * Fast verify without spawning heavy ML tasks.
   */
  private lastProbeResult: { success: boolean; code?: number; error?: string } | null = null;

  async verifyEnvironmentFast(expectedMode?: SeparationEngineMode, targetDir?: string): Promise<boolean> {
    try {
      const pythonPath = await getPythonPath();
      const packagesDir = targetDir
        ? path.join(targetDir, 'Lib', 'site-packages')
        : this.getSeparationPackagesDir();

      if (!existsSync(packagesDir) || !existsSync(path.join(packagesDir, 'audio_separator'))) {
        return false;
      }

      const script = `
import site, sys, os
packages_dir = sys.argv[1]
site.addsitedir(packages_dir)
torch_lib = os.path.join(packages_dir, 'torch', 'lib')
if os.path.exists(torch_lib):
    os.environ['PATH'] = torch_lib + os.pathsep + os.environ.get('PATH', '')
    if hasattr(os, 'add_dll_directory'):
        try:
            os.add_dll_directory(torch_lib)
        except Exception:
            pass
import audio_separator
import torch
if sys.argv[2] == 'gpu':
    if not torch.cuda.is_available():
        sys.exit(2)
    try:
        t = torch.zeros(1, device='cuda') + 1
        _ = t.cpu()
    except Exception:
        sys.exit(3)
sys.exit(0)
`.trim();

      await execFileAsync(pythonPath, ['-c', script, packagesDir, expectedMode || ''], {
        timeout: 60000,
        windowsHide: true,
      });
      this.lastProbeResult = { success: true, code: 0 };
      return true;
    } catch (err: any) {
      const exitCode = typeof err?.code === 'number' ? err.code : undefined;
      this.lastProbeResult = { success: false, code: exitCode, error: err?.message };
      console.warn('[SeparationEnv] Quick verification probe failed', err);
      return false;
    }
  }

  /**
   * Validates available free disk space on target drive.
   */
  async getFreeDiskSpace(targetDir: string): Promise<number> {
    if (process.platform !== 'win32') return 100 * 1024 * 1024 * 1024;

    try {
      if (typeof fs.statfs === 'function') {
        const stats = await fs.statfs(targetDir);
        if (typeof stats.bavail === 'number' && typeof stats.bsize === 'number') {
          return stats.bavail * stats.bsize;
        }
      }
    } catch {
      // Fallback to powershell below if statfs is not supported
    }

    try {
      const driveLetter = path.parse(targetDir).root.replace('\\', '');
      const { stdout } = await execAsync(
        `powershell -NoProfile -Command "(Get-PSDrive -Name '${driveLetter.replace(':', '')}').Free"`,
        { timeout: 4000, windowsHide: true }
      );
      const freeBytes = parseInt(stdout.trim(), 10);
      if (!isNaN(freeBytes)) {
        return freeBytes;
      }
    } catch (err) {
      console.warn('[SeparationEnv] Could not check free disk space', err);
    }
    return 0;
  }

  /**
   * Returns storage info for the current separation runtime.
   */
  async getStorageInfo(): Promise<SeparationStorageInfo> {
    await this.initFromSettings();
    const envDir = this.getSeparationEnvDir();
    const isDefault = !this.isCustomPath();
    const totalBytes = await this.getDiskUsage();
    const freeDriveBytes = await this.getFreeDiskSpace(envDir);
    const driveLetter = path.parse(envDir).root.replace('\\', '');
    return {
      currentPath: envDir,
      isDefault,
      totalBytes,
      freeDriveBytes,
      driveLetter,
    };
  }

  /**
   * Preflights a target folder to ensure it is valid, writable, and has sufficient disk space.
   */
  async preflightTargetFolder(
    targetInputPath: string,
    options?: { forMigration?: boolean }
  ): Promise<{ valid: boolean; freeBytes: number; error?: string }> {
    if (!targetInputPath || typeof targetInputPath !== 'string' || targetInputPath.trim().length === 0) {
      return { valid: false, freeBytes: 0, error: '請選擇有效目錄' };
    }

    const targetPath = path.resolve(targetInputPath.trim());
    const currentDir = path.resolve(this.getSeparationEnvDir());

    if (options?.forMigration) {
      if (targetPath.toLowerCase() === currentDir.toLowerCase()) {
        return { valid: false, freeBytes: 0, error: '目標目錄不可與目前目錄相同' };
      }

      // Check if target is inside current or vice versa
      const relativeCurrentToTarget = path.relative(currentDir, targetPath);
      if (!relativeCurrentToTarget.startsWith('..') && !path.isAbsolute(relativeCurrentToTarget)) {
        return { valid: false, freeBytes: 0, error: '目標目錄不可位於目前環境目錄內' };
      }
      const relativeTargetToCurrent = path.relative(targetPath, currentDir);
      if (!relativeTargetToCurrent.startsWith('..') && !path.isAbsolute(relativeTargetToCurrent)) {
        return { valid: false, freeBytes: 0, error: '目標目錄不可包含目前的環境目錄' };
      }
    }

    // Test write permission
    try {
      await fs.mkdir(targetPath, { recursive: true });
      const testFile = path.join(targetPath, `.khelper-perm-test-${Date.now()}`);
      await fs.writeFile(testFile, 'test', 'utf-8');
      await fs.unlink(testFile);
    } catch (err) {
      return { valid: false, freeBytes: 0, error: `目標目錄無寫入權限: ${(err as Error).message}` };
    }

    const freeBytes = await this.getFreeDiskSpace(targetPath);
    const currentDiskUsage = await this.getDiskUsage();
    const requiredBytes = options?.forMigration && currentDiskUsage > 0
      ? currentDiskUsage
      : 1.5 * 1024 * 1024 * 1024;

    if (freeBytes > 0 && freeBytes < requiredBytes) {
      return { valid: false, freeBytes, error: '目標磁碟可用空間不足' };
    }

    return { valid: true, freeBytes };
  }


  /**
   * Helper to run pip command with streaming progress reporting.
   */
  private runPipCommand(
    pythonPath: string,
    args: string[],
    envDir: string,
    stageName: 'downloading' | 'installing',
    startPercent: number,
    endPercent: number,
    stageMessage: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.notifyProgress({
        stage: stageName,
        percent: startPercent,
        message: stageMessage,
      });

      const packagesDir = path.join(envDir, 'Lib', 'site-packages');
      const proc = spawn(pythonPath, args, {
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          PIP_NO_COLOR: '1',
          PYTHONPATH: packagesDir + (process.env.PYTHONPATH ? path.delimiter + process.env.PYTHONPATH : ''),
        },
      });

      this.activeProcess = proc;
      let outputBuffer = '';
      let errorBuffer = '';
      let currentPercent = startPercent;
      const percentRange = endPercent - startPercent;

      proc.stdout.on('data', (data) => {
        const text = data.toString();
        outputBuffer += text;

        if (text.includes('Collecting') || text.includes('Downloading')) {
          currentPercent = Math.min(
            currentPercent + Math.max(1, Math.round(percentRange * 0.05)),
            startPercent + Math.round(percentRange * 0.7)
          );
          this.notifyProgress({
            stage: 'downloading',
            percent: currentPercent,
            message: stageMessage,
            detail: text.trim().slice(0, 100),
          });
        } else if (text.includes('Installing collected packages') || text.includes('Running setup.py')) {
          currentPercent = Math.min(
            Math.max(currentPercent, startPercent + Math.round(percentRange * 0.7)) + Math.max(1, Math.round(percentRange * 0.08)),
            endPercent
          );
          this.notifyProgress({
            stage: 'installing',
            percent: currentPercent,
            message: '正在解壓縮並安裝套件...',
            detail: text.trim().slice(0, 100),
          });
        }
      });

      proc.stderr.on('data', (data) => {
        const text = data.toString();
        errorBuffer += text;
      });

      proc.on('close', (code) => {
        if (this.activeProcess === proc) {
          this.activeProcess = null;
        }

        if (code === 0) {
          resolve();
        } else {
          const detail = errorBuffer.slice(-400) || outputBuffer.slice(-400) || `Exit code ${code}`;
          reject(new Error(`安裝失敗 (代碼 ${code}): ${detail}`));
        }
      });

      proc.on('error', (err) => {
        if (this.activeProcess === proc) {
          this.activeProcess = null;
        }
        reject(err);
      });
    });
  }

  /**
   * Starts background or interactive installation of CPU or GPU separation engine.
   */
  async startInstallation(mode: SeparationEngineMode, customTargetDir?: string): Promise<void> {
    if (this.isInstalling || this.isMigrating) {
      throw new Error('安裝或搬移程序已在進行中');
    }

    if (customTargetDir) {
      const preflight = await this.preflightTargetFolder(customTargetDir, { forMigration: false });
      if (!preflight.valid) {
        throw new Error(preflight.error || '目標路徑無效');
      }
      this.setCustomRuntimePath(customTargetDir);
    }

    this.isInstalling = true;
    this.lastError = null;
    this.verifiedReady = false;

    const envDir = this.getSeparationEnvDir();
    const requiredDiskBytes = mode === 'gpu' ? 3.5 * 1024 * 1024 * 1024 : 1.5 * 1024 * 1024 * 1024;

    this.notifyProgress({
      stage: 'preparing',
      percent: 5,
      message: '正在檢查磁碟空間與環境...',
    });

    const freeBytes = await this.getFreeDiskSpace(envDir);
    if (freeBytes > 0 && freeBytes < requiredDiskBytes) {
      const neededGb = (requiredDiskBytes / (1024 * 1024 * 1024)).toFixed(1);
      const freeGb = (freeBytes / (1024 * 1024 * 1024)).toFixed(1);
      this.isInstalling = false;
      const errMsg = `磁碟可用空間不足（需要至少 ${neededGb} GB，目前僅剩 ${freeGb} GB）`;
      this.notifyProgress({
        stage: 'error',
        percent: 5,
        message: errMsg,
        error: errMsg,
      });
      throw new Error(errMsg);
    }

    // Ensure target folder exists
    try {
      await fs.mkdir(envDir, { recursive: true });
    } catch (err) {
      this.isInstalling = false;
      const errMsg = `無法建立安裝目錄: ${(err as Error).message}`;
      this.notifyProgress({
        stage: 'error',
        percent: 5,
        message: errMsg,
        error: errMsg,
      });
      throw err;
    }

    const pythonPath = await getPythonPath();
    const gpuInfo: GpuDetectionResult = await detectGpuHardware();

    try {
      if (mode === 'gpu') {
        // Step 1: Install PyTorch CUDA 12.6 explicitly from official PyTorch index so pip never defaults to CPU wheel from PyPI
        console.log('[SeparationEnv] Step 1: Installing PyTorch CUDA 12.6');
        await this.runPipCommand(
          pythonPath,
          [
            '-m',
            'pip',
            'install',
            '--no-warn-script-location',
            '--prefix',
            envDir,
            '--index-url',
            'https://download.pytorch.org/whl/cu126',
            'torch',
            'torchvision',
          ],
          envDir,
          'downloading',
          10,
          70,
          '正在下載 PyTorch CUDA 加速核心...'
        );

        // Step 2: Install audio-separator[gpu]
        console.log('[SeparationEnv] Step 2: Installing audio-separator[gpu]');
        await this.runPipCommand(
          pythonPath,
          [
            '-m',
            'pip',
            'install',
            '--no-warn-script-location',
            '--prefix',
            envDir,
            '--extra-index-url',
            'https://download.pytorch.org/whl/cu126',
            'audio-separator[gpu]',
          ],
          envDir,
          'downloading',
          70,
          92,
          '正在安裝音訊分離模型引擎與 ONNX GPU 依賴...'
        );
      } else {
        // CPU mode
        console.log('[SeparationEnv] Installing audio-separator[cpu]');
        await this.runPipCommand(
          pythonPath,
          [
            '-m',
            'pip',
            'install',
            '--no-warn-script-location',
            '--prefix',
            envDir,
            'audio-separator[cpu]',
          ],
          envDir,
          'downloading',
          10,
          92,
          '正在下載 CPU 人聲分離依賴套件...'
        );
      }

      this.notifyProgress({
        stage: 'verifying',
        percent: 95,
        message: '正在校驗分離環境完整性...',
      });

      const isProbeSuccess = await this.verifyEnvironmentFast(mode);
      if (!isProbeSuccess) {
        const exitCode = this.lastProbeResult?.code;
        const err = mode === 'gpu'
          ? (exitCode === 3
              ? '顯卡硬體或驅動程式與 PyTorch CUDA 核心不相容（CUDA kernel execution failed），建議更新顯卡驅動程式或切換至 CPU 模式。'
              : '環境校驗未通過：PyTorch 無法啟用 CUDA 硬體加速，請確認顯卡驅動程式支援。')
          : '環境校驗未通過，可能遺失必要模組。';
        this.lastError = err;
        this.notifyProgress({
          stage: 'error',
          percent: 95,
          message: '環境校驗未通過',
          error: err,
        });
        throw new Error(err);
      }

      this.verifiedReady = true;

      // Write runtime_meta.json with calculated totalBytes
      const diskUsage = await this.getDiskUsage(true);
      const meta: SeparationRuntimeMeta = {
        version: '1.0',
        mode,
        verified: true,
        installedAt: new Date().toISOString(),
        gpuModel: gpuInfo.modelName,
        vramMb: gpuInfo.vramMb,
        torchCuda: mode === 'gpu',
        totalBytes: diskUsage,
      };
      await this.writeRuntimeMeta(meta, envDir);

      // Save to User Settings
      const currentSettings = await loadSettings();
      await saveSettings({
        ...currentSettings,
        separationEngine: {
          mode,
          installedAt: meta.installedAt,
          vramMb: gpuInfo.vramMb,
          gpuModel: gpuInfo.modelName,
          customRuntimePath: this.isCustomPath() ? this.getSeparationEnvDir() : undefined,
        },
        customRuntimePath: this.isCustomPath() ? this.getSeparationEnvDir() : undefined,
      });

      this.notifyProgress({
        stage: 'completed',
        percent: 100,
        message: mode === 'gpu' ? 'GPU 加速分離引擎已安裝就緒！' : 'CPU 分離引擎已安裝就緒！',
      });
    } catch (err: unknown) {
      this.isInstalling = false;
      this.lastError = (err as Error).message || '安裝依賴套件失敗';
      this.notifyProgress({
        stage: 'error',
        percent: this.currentProgress?.percent || 0,
        message: '安裝依賴套件失敗',
        error: this.lastError,
      });
      throw err;
    } finally {
      this.isInstalling = false;
    }
  }

  /**
   * Cancel active pip installation process.
   */
  cancelInstallation(): void {
    if (!this.activeProcess || !this.activeProcess.pid) return;

    const pid = this.activeProcess.pid;
    console.log('[SeparationEnv] Cancelling installation, killing PID:', pid);

    if (process.platform === 'win32') {
      try {
        exec(`taskkill /F /T /PID ${pid}`, { windowsHide: true });
      } catch (err) {
        console.warn('[SeparationEnv] Could not kill process:', err);
      }
    } else {
      try {
        this.activeProcess.kill('SIGTERM');
      } catch (err) {
        console.warn('[SeparationEnv] Could not kill process:', err);
      }
    }

    this.activeProcess = null;
    this.isInstalling = false;
    this.notifyProgress({
      stage: 'error',
      percent: 0,
      message: '使用者已取消安裝',
      error: '使用者已取消安裝',
    });
  }

  /**
   * Cancels in-flight migration.
   */
  cancelMigration(): void {
    if (this.migrationAbortController) {
      this.migrationAbortController.abort();
    }
    this.isMigrating = false;
    this.notifyMigration({
      status: 'cancelled',
      transferredBytes: 0,
      totalBytes: 0,
      error: '使用者已取消搬移',
    });
  }

  /**
   * Migrates the separation runtime files to a new destination folder.
   */
  async startMigration(targetInputPath: string): Promise<SeparationMigrationProgress> {
    if (this.isMigrating || this.isInstalling) {
      throw new Error('已有安裝或搬移程序正在執行中');
    }

    const preflight = await this.preflightTargetFolder(targetInputPath, { forMigration: true });
    if (!preflight.valid) {
      throw new Error(preflight.error || '目標路徑檢查未通過');
    }

    const sourceDir = path.resolve(this.getSeparationEnvDir());
    const targetDir = path.resolve(targetInputPath.trim());
    const totalBytes = await this.getDiskUsage();

    this.isMigrating = true;
    this.migrationAbortController = new AbortController();
    const signal = this.migrationAbortController.signal;

    this.notifyMigration({
      status: 'preparing',
      transferredBytes: 0,
      totalBytes,
    });

    try {
      await fs.mkdir(targetDir, { recursive: true });

      // Collect all files to copy
      const filesToCopy: { src: string; dest: string; size: number }[] = [];
      const scan = async (dir: string, base: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullSrc = path.join(dir, entry.name);
          const rel = path.relative(base, fullSrc);
          const fullDest = path.join(targetDir, rel);
          if (entry.isDirectory()) {
            await scan(fullSrc, base);
          } else if (entry.isFile()) {
            const stat = await fs.stat(fullSrc);
            filesToCopy.push({ src: fullSrc, dest: fullDest, size: stat.size });
          }
        }
      }

      if (existsSync(sourceDir)) {
        await scan(sourceDir, sourceDir);
      }

      let transferred = 0;
      for (const item of filesToCopy) {
        if (signal.aborted) {
          throw new Error('Migration aborted by user');
        }

        await fs.mkdir(path.dirname(item.dest), { recursive: true });
        await fs.copyFile(item.src, item.dest);
        transferred += item.size;

        this.notifyMigration({
          status: 'copying',
          transferredBytes: transferred,
          totalBytes,
          currentFile: path.basename(item.dest),
        });
      }

      this.notifyMigration({
        status: 'verifying',
        transferredBytes: transferred,
        totalBytes,
      });

      // Probe target
      const currentSettings = await loadSettings();
      const expectedMode = currentSettings.separationEngine?.mode;
      const isTargetValid = await this.verifyEnvironmentFast(expectedMode, targetDir);
      if (!isTargetValid) {
        throw new Error('目標目錄環境校驗未通過');
      }

      // Success: update runtime metadata in target directory
      const existingMeta = await this.readRuntimeMeta(targetDir);
      const finalBytes = transferred > 0 ? transferred : totalBytes;
      const updatedMeta: SeparationRuntimeMeta = {
        version: '1.0',
        mode: expectedMode || existingMeta?.mode || 'gpu',
        verified: true,
        installedAt: existingMeta?.installedAt || new Date().toISOString(),
        gpuModel: existingMeta?.gpuModel || currentSettings.separationEngine?.gpuModel,
        vramMb: existingMeta?.vramMb || currentSettings.separationEngine?.vramMb,
        torchCuda: (expectedMode || existingMeta?.mode) === 'gpu',
        totalBytes: finalBytes,
      };
      await this.writeRuntimeMeta(updatedMeta, targetDir);
      this.cachedDiskUsage = { path: targetDir, bytes: finalBytes };

      // Success: update settings
      const isDefault = targetDir.toLowerCase() === path.resolve(this.getDefaultSeparationEnvDir()).toLowerCase();
      await saveSettings({
        ...currentSettings,
        separationEngine: currentSettings.separationEngine ? {
          ...currentSettings.separationEngine,
          customRuntimePath: isDefault ? undefined : targetDir,
        } : undefined,
        customRuntimePath: isDefault ? undefined : targetDir,
      });

      this.setCustomRuntimePath(isDefault ? null : targetDir);
      this.verifiedReady = true;

      // Clean old directory if distinct
      if (sourceDir.toLowerCase() !== targetDir.toLowerCase()) {
        try {
          await fs.rm(sourceDir, { recursive: true, force: true });
        } catch (cleanupErr) {
          console.warn('[SeparationEnv] Could not delete old directory after migration', cleanupErr);
        }
      }

      const completedProgress: SeparationMigrationProgress = {
        status: 'completed',
        transferredBytes: transferred,
        totalBytes,
      };
      this.notifyMigration(completedProgress);
      this.isMigrating = false;
      return completedProgress;
    } catch (err: unknown) {
      this.isMigrating = false;
      if (signal.aborted) {
        try {
          await fs.rm(targetDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors on cancellation
        }
        const cancelledProgress: SeparationMigrationProgress = {
          status: 'cancelled',
          transferredBytes: 0,
          totalBytes,
          error: '使用者已取消搬移',
        };
        this.notifyMigration(cancelledProgress);
        return cancelledProgress;
      }

      console.error('[SeparationEnv] Migration failed', err);
      // Clean up failed target
      try {
        await fs.rm(targetDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors on failure
      }
      const failedProgress: SeparationMigrationProgress = {
        status: 'failed',
        transferredBytes: 0,
        totalBytes,
        error: (err as Error).message || '搬移過程發生錯誤',
      };
      this.notifyMigration(failedProgress);
      return failedProgress;
    }
  }

  /**
   * Calculates total directory size.
   */
  async calculateDirectorySize(dirPath: string): Promise<number> {
    try {
      let total = 0;
      const walk = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile()) {
            const stat = await fs.stat(fullPath);
            total += stat.size;
          }
        }
      };
      await walk(dirPath);
      return total;
    } catch {
      return 0;
    }
  }

  /**
   * Calculates total disk usage of the separation environment.
   * Leverages cached totalBytes from runtime_meta.json or in-memory cache for instant returns (<1ms).
   */
  async getDiskUsage(forceRecalculate = false): Promise<number> {
    const envDir = this.getSeparationEnvDir();

    if (!forceRecalculate) {
      if (this.cachedDiskUsage && this.cachedDiskUsage.path.toLowerCase() === envDir.toLowerCase() && this.cachedDiskUsage.bytes > 0) {
        return this.cachedDiskUsage.bytes;
      }
      const meta = await this.readRuntimeMeta(envDir);
      if (meta && typeof meta.totalBytes === 'number' && meta.totalBytes > 0) {
        this.cachedDiskUsage = { path: envDir, bytes: meta.totalBytes };
        return meta.totalBytes;
      }
    }

    if (this.isCalculatingDiskUsage) {
      return this.cachedDiskUsage?.bytes || 0;
    }

    try {
      this.isCalculatingDiskUsage = true;
      const total = await this.calculateDirectorySize(envDir);
      this.cachedDiskUsage = { path: envDir, bytes: total };
      if (total > 0) {
        const meta = await this.readRuntimeMeta(envDir);
        if (meta) {
          meta.totalBytes = total;
          await this.writeRuntimeMeta(meta, envDir);
        }
      }
      return total;
    } catch {
      return 0;
    } finally {
      this.isCalculatingDiskUsage = false;
    }
  }

  /**
   * Asynchronously updates cached totalBytes in background if missing from runtime_meta.json.
   */
  async updateDiskUsageInBackground(envDir: string): Promise<void> {
    if (this.isCalculatingDiskUsage) return;
    try {
      this.isCalculatingDiskUsage = true;
      const total = await this.calculateDirectorySize(envDir);
      if (total > 0) {
        this.cachedDiskUsage = { path: envDir, bytes: total };
        const meta = await this.readRuntimeMeta(envDir);
        if (meta && (!meta.totalBytes || meta.totalBytes !== total)) {
          meta.totalBytes = total;
          await this.writeRuntimeMeta(meta, envDir);
        }
      }
    } catch (err) {
      console.warn('[SeparationEnv] Background disk usage calculation failed', err);
    } finally {
      this.isCalculatingDiskUsage = false;
    }
  }

  /**
   * Uninstalls/removes separation environment to reclaim disk space.
   */
  async uninstallEnvironment(): Promise<void> {
    if (this.isInstalling) {
      this.cancelInstallation();
    }
    if (this.isMigrating) {
      this.cancelMigration();
    }

    const envDir = this.getSeparationEnvDir();
    try {
      await fs.rm(envDir, { recursive: true, force: true });
    } catch (err) {
      console.warn('[SeparationEnv] Failed to remove env directory', err);
    }

    this.verifiedReady = false;
    this.lastError = null;
    this.currentProgress = null;
    this.cachedCustomRuntimePath = null;
    this.cachedDiskUsage = null;

    const currentSettings = await loadSettings();
    await saveSettings({
      ...currentSettings,
      separationEngine: undefined,
      customRuntimePath: undefined,
    });
  }
}

export const separationEnvManager = new SeparationEnvManager();
