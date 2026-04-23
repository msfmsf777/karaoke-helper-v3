import fs from 'node:fs/promises';
import { app } from 'electron';
import path from 'node:path';
import { getSongMeta, getSongsBaseDir, updateSongMeta, loadAllSongs } from './songLibrary';
import type { SongMeta } from '../shared/songTypes';
import type { SeparationJob } from '../shared/separationTypes';
import { getPythonPath } from './pythonRuntime';
import { isModelAvailable, downloadModel, getModelCacheDir, QualityPreset } from './modelManager';
import { spawn, execSync, ChildProcess } from 'node:child_process';
import { loadSettings } from './userData';

type JobSubscriber = (jobs: SeparationJob[]) => void;

function generateJobId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

/* ── Separation runner (returns process handle + promise) ──── */

async function runDemucsSeparation(
  originalPath: string,
  songFolder: string,
  quality: QualityPreset,
  modelDir: string,
  onProgress?: (percent: number) => void,
  onProcess?: (proc: ChildProcess) => void
): Promise<{ instrumentalPath: string; vocalPath: string }> {
  const pythonPath = await getPythonPath();
  console.log('[Separation] Starting MDX separation', { originalPath, songFolder, quality, pythonPath, modelDir });

  let scriptPath: string;
  if (app.isPackaged) {
    scriptPath = path.join(process.resourcesPath, 'separation', 'separate.py');
  } else {
    scriptPath = path.join(process.cwd(), 'resources', 'separation', 'separate.py');
  }

  // Determine binaries path (ffmpeg)
  let binDir: string;
  if (app.isPackaged) {
    binDir = path.join(process.resourcesPath, 'bin');
  } else {
    binDir = path.join(process.cwd(), 'resources', 'bin');
  }

  // Inject binDir into PATH for the child process so Demucs can find ffmpeg
  const env = { ...process.env };
  const pathKey = process.platform === 'win32' ? 'Path' : 'PATH';
  env[pathKey] = `${binDir}${path.delimiter}${env[pathKey] || ''}`;

  return new Promise((resolve, reject) => {
    const python = spawn(pythonPath, [
      scriptPath,
      '--input', originalPath,
      '--output-dir', songFolder,
      '--quality', quality,
      '--model-dir', modelDir,
      '--output-format', 'mp3',
      '--bitrate', '320k'
    ], { env });

    // Notify caller of the actual process handle immediately after spawn
    onProcess?.(python);

    let parseResult: { instrumental?: string; vocal?: string; error?: string } | null = null;
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.status === 'success') {
            parseResult = msg;
          } else if (msg.status === 'progress' && typeof msg.progress === 'number') {
            onProgress?.(msg.progress);
          } else if (msg.error) {
            reject(new Error(`${msg.error} ${msg.details || ''}`));
          }
        } catch (e) {
          // Ignore non-JSON output (e.g. from libraries)
        }
      }
    });

    python.stderr.on('data', (data) => {
      const str = data.toString();
      errorOutput += str;
    });

    python.on('close', (code) => {
      if (code === 0 && parseResult && parseResult.instrumental && parseResult.vocal) {
        resolve({
          instrumentalPath: parseResult.instrumental,
          vocalPath: parseResult.vocal
        });
      } else {
        const msg = parseResult?.error || 'Separation process failed';
        reject(new Error(`${msg} (Exit code ${code}). Details: ${errorOutput.slice(-500)}`));
      }
    });
  });
}

/* ── Job Manager ────────────────────────────────────────────── */

class SeparationJobManager {
  private jobs: SeparationJob[] = [];
  private runningJobId: string | null = null;
  private subscribers = new Set<JobSubscriber>();
  private activeProcess: ChildProcess | null = null;
  private cancelledJobIds = new Set<string>();
  private initialized = false;

  async init() {
    if (this.initialized) return;
    this.initialized = true;
    await this.loadJobs();
    await this.recoverOrphanedSongs();
    // Auto-resume any queued jobs from previous session
    void this.processQueue();
  }

  /* ── Persistence ──────────────────────────────────────────── */

  private getJobsFilePath() {
    return path.join(app.getPath('userData'), 'separationJobs.json');
  }

  private saveScheduled = false;
  private async saveJobs() {
    if (this.saveScheduled) return; // Coalesce rapid saves
    this.saveScheduled = true;
    // Defer to next tick so multiple notify() calls in the same tick write only the latest state
    await new Promise(r => setTimeout(r, 0));
    this.saveScheduled = false;
    try {
      await fs.writeFile(this.getJobsFilePath(), JSON.stringify(this.jobs, null, 2));
    } catch (err) {
      console.error('[Separation] Failed to save jobs', err);
    }
  }

  private async loadJobs() {
    try {
      const data = await fs.readFile(this.getJobsFilePath(), 'utf-8');
      this.jobs = JSON.parse(data);

      // Reset interrupted 'running' jobs to 'queued' for auto-retry
      let changed = false;
      this.jobs = this.jobs.map(j => {
        if (j.status === 'running') {
          changed = true;
          return { ...j, status: 'queued' as const, progress: 0, errorMessage: undefined, updatedAt: new Date().toISOString() };
        }
        return j;
      });

      if (changed) {
        console.log('[Separation] Reset interrupted running jobs to queued for auto-retry');
        await this.saveJobs();
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error('[Separation] Failed to load jobs', err);
      }
      // No file = first run, jobs stays empty
    }
  }

  /* ── Startup Recovery ────────────────────────────────────── */

  private async recoverOrphanedSongs() {
    try {
      const allSongs = await loadAllSongs();
      for (const song of allSongs) {
        if (song.audio_status === 'separating' || song.audio_status === 'separation_pending') {
          // Check if there's an active job for this song
          const hasActiveJob = this.jobs.some(
            j => j.songId === song.id && (j.status === 'queued' || j.status === 'running')
          );

          if (!hasActiveJob) {
            // Orphaned — reset to original_only
            await updateSongMeta(song.id, (current) => ({
              ...current,
              audio_status: 'original_only',
              last_separation_error: '分離程序被中斷（程式重啟或系統休眠）',
            }));
            console.log(`[Separation] Recovered orphaned song: ${song.id} (${song.title})`);
          }
        }
      }
    } catch (err) {
      console.error('[Separation] Failed to recover orphaned songs', err);
    }
  }

  /* ── Internal helpers ────────────────────────────────────── */

  private snapshot(): SeparationJob[] {
    return [...this.jobs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  private notify() {
    const current = this.snapshot();
    this.subscribers.forEach((fn) => {
      try {
        fn(current);
      } catch (err) {
        console.warn('[Separation] subscriber threw', err);
      }
    });
    // Persist after every state change
    void this.saveJobs();
  }

  private async ensureOriginalPath(meta: SongMeta): Promise<{ songDir: string; originalPath: string }> {
    const songDir = path.join(getSongsBaseDir(), meta.id);
    await fs.mkdir(songDir, { recursive: true });
    const originalPath = path.join(songDir, meta.stored_filename || `Original${path.extname(meta.source.originalPath) || '.mp3'}`);
    try {
      await fs.access(originalPath);
    } catch {
      throw new Error(`Original audio missing at ${originalPath}`);
    }
    return { songDir, originalPath };
  }

  private updateJob(id: string, patch: Partial<SeparationJob>) {
    this.jobs = this.jobs.map((job) =>
      job.id === id
        ? {
          ...job,
          ...patch,
          updatedAt: new Date().toISOString(),
        }
        : job,
    );
  }

  /* ── Job Execution ───────────────────────────────────────── */

  private async executeJob(job: SeparationJob) {
    try {
      const meta = await getSongMeta(job.songId);
      if (!meta) {
        throw new Error(`Song ${job.songId} not found for separation`);
      }

      await updateSongMeta(job.songId, (current) => ({
        ...current,
        audio_status: 'separating',
        last_separation_error: null,
      }));
      this.updateJob(job.id, { status: 'running', progress: 0, errorMessage: undefined });
      this.notify();

      const { songDir, originalPath } = await this.ensureOriginalPath(meta);

      // Use job quality or default to normal
      const quality = (job.quality || 'normal') as QualityPreset;

      // Check and download model if needed
      if (!(await isModelAvailable(quality))) {
        console.log(`[Separation] Model for ${quality} missing, downloading...`);
        this.updateJob(job.id, { progress: 0 });

        await downloadModel(quality, (percent) => {
          console.log(`[Separation] Downloading model: ${percent.toFixed(1)}%`);
        });
      }

      const modelDir = getModelCacheDir();

      const { instrumentalPath, vocalPath } = await runDemucsSeparation(
        originalPath, songDir, quality, modelDir,
        (progress) => {
          this.updateJob(job.id, { progress });
          this.notify();
        },
        (proc) => {
          // Called synchronously right after spawn — guaranteed to have the real handle
          this.activeProcess = proc;
          console.log('[Separation] Process spawned, PID:', proc.pid);
        }
      );

      this.activeProcess = null;

      // Check if cancelled while running (process was killed, but we got here via a race)
      if (this.cancelledJobIds.has(job.id)) {
        throw new Error('使用者已取消');
      }

      await updateSongMeta(job.songId, (current) => ({
        ...current,
        audio_status: 'separated',
        instrumental_path: instrumentalPath,
        vocal_path: vocalPath,
        last_separation_error: null,
        separation_quality: quality,
      }));
      this.updateJob(job.id, { status: 'succeeded', errorMessage: undefined });
    } catch (err) {
      this.activeProcess = null;
      const wasCancelled = this.cancelledJobIds.delete(job.id);

      if (wasCancelled) {
        // Cancelled by user — clean up partial files and reset song
        console.log('[Separation] Job was cancelled by user', job.id);
        await this.cleanupPartialFiles(job.songId);
        await updateSongMeta(job.songId, (current) => ({
          ...current,
          audio_status: 'original_only',
          last_separation_error: '使用者已取消',
        }));
        this.updateJob(job.id, { status: 'failed', errorMessage: '使用者已取消' });
      } else {
        // Genuine failure
        const message = err instanceof Error ? err.message : String(err);
        console.error('[Separation] Job failed', { jobId: job.id, songId: job.songId, message, err });
        await updateSongMeta(job.songId, (current) => ({
          ...current,
          audio_status: 'separation_failed',
          last_separation_error: message,
        }));
        this.updateJob(job.id, { status: 'failed', errorMessage: message });
      }
    } finally {
      this.runningJobId = null;
      this.notify();
      void this.processQueue();
    }
  }

  private async processQueue() {
    if (this.runningJobId) return;
    const next = this.jobs.find((job) => job.status === 'queued');
    if (!next) return;
    this.runningJobId = next.id;
    await this.executeJob(next);
  }

  /* ── Public API ──────────────────────────────────────────── */

  async queueJob(songId: string, qualityOverride?: 'high' | 'normal' | 'fast'): Promise<SeparationJob> {
    await this.init();

    const meta = await getSongMeta(songId);
    if (!meta) {
      throw new Error(`Cannot queue separation: song ${songId} not found`);
    }
    if (meta.type !== '原曲') {
      throw new Error('Only 原曲 songs support separation');
    }

    const existing = this.jobs.find(
      (job) => job.songId === songId && (job.status === 'queued' || job.status === 'running'),
    );
    if (existing) {
      console.log('[Separation] Job already queued/running for song', songId, existing.id);
      return existing;
    }

    await updateSongMeta(songId, (current) => ({
      ...current,
      audio_status: 'separation_pending',
      last_separation_error: null,
    }));

    // Load quality setting or use override
    let quality = qualityOverride;
    if (!quality) {
      const settings = await loadSettings();
      quality = settings.separationQuality || 'normal';
    }

    const now = new Date().toISOString();
    const job: SeparationJob = {
      id: generateJobId(),
      songId,
      quality,
      createdAt: now,
      updatedAt: now,
      status: 'queued',
    };
    this.jobs = [job, ...this.jobs];
    this.notify();
    void this.processQueue();
    console.log('[Separation] Queued job', job);
    return job;
  }

  async cancelJob(jobId: string): Promise<void> {
    await this.init();

    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return;

    if (job.status === 'queued') {
      // Queued: just remove and reset song status
      this.jobs = this.jobs.filter(j => j.id !== jobId);
      await updateSongMeta(job.songId, (current) => ({
        ...current,
        audio_status: 'original_only',
        last_separation_error: null,
      }));
      this.notify();
      console.log('[Separation] Cancelled queued job', jobId);
    } else if (job.status === 'running') {
      // Signal cancellation — executeJob's catch block will handle cleanup
      this.cancelledJobIds.add(jobId);
      // Kill the entire process tree
      this.killProcessTree();
      console.log('[Separation] Cancel signal sent for running job', jobId);
      // executeJob's catch/finally will detect cancelledJobIds and handle:
      // - cleanupPartialFiles
      // - updateSongMeta
      // - updateJob status
      // - runningJobId reset
      // - processQueue
    }
  }

  async retryJob(jobId: string): Promise<void> {
    await this.init();

    const job = this.jobs.find(j => j.id === jobId);
    if (!job || job.status !== 'failed') return;

    // Reset song meta to separation_pending
    await updateSongMeta(job.songId, (current) => ({
      ...current,
      audio_status: 'separation_pending',
      last_separation_error: null,
    }));

    this.updateJob(jobId, { status: 'queued', progress: 0, errorMessage: undefined });
    this.notify();
    void this.processQueue();
    console.log('[Separation] Retried job', jobId);
  }

  async removeJob(jobId: string): Promise<void> {
    await this.init();

    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return;

    // Only allow removing completed or failed jobs
    if (job.status === 'succeeded' || job.status === 'failed') {
      this.jobs = this.jobs.filter(j => j.id !== jobId);
      this.notify();
      console.log('[Separation] Removed job', jobId);
    }
  }

  async getAllJobs(): Promise<SeparationJob[]> {
    await this.init();
    return this.snapshot();
  }

  subscribe(subscriber: JobSubscriber): () => void {
    this.subscribers.add(subscriber);
    // Only send snapshot if initialized; otherwise the init() call will trigger notify()
    if (this.initialized) {
      subscriber(this.snapshot());
    }
    return () => this.subscribers.delete(subscriber);
  }

  /* ── Cleanup helpers ─────────────────────────────────────── */

  private async cleanupPartialFiles(songId: string) {
    try {
      const meta = await getSongMeta(songId);
      if (!meta) return;

      const songDir = path.join(getSongsBaseDir(), songId);
      const storedFilename = meta.stored_filename || '';

      // List all files in the song directory
      const files = await fs.readdir(songDir);
      for (const file of files) {
        // Keep the original audio file, meta.json, and lyrics files
        if (
          file === storedFilename ||
          file === 'meta.json' ||
          file.endsWith('.lrc') ||
          file.endsWith('.txt') ||
          file.startsWith('Original')
        ) {
          continue;
        }

        // Remove separation output files (Instrumental.mp3, Vocal.mp3, temp files)
        const filePath = path.join(songDir, file);
        try {
          await fs.unlink(filePath);
          console.log(`[Separation] Cleaned up partial file: ${filePath}`);
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (err) {
      console.error('[Separation] Failed to cleanup partial files', err);
    }
  }

  /** Kill the active process tree (works on Windows with taskkill /T) */
  private killProcessTree() {
    const proc = this.activeProcess;
    if (!proc || !proc.pid) return;

    console.log('[Separation] Killing process tree, PID:', proc.pid);
    const pid = proc.pid;

    if (process.platform === 'win32') {
      // taskkill /F = force, /T = tree (kills all child processes)
      try {
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
      } catch {
        // Process may already be dead
      }
    } else {
      // On Unix, kill the process group
      try { process.kill(-pid, 'SIGTERM'); } catch { /* ignore */ }
      setTimeout(() => {
        try { process.kill(-pid, 'SIGKILL'); } catch { /* ignore */ }
      }, 3000);
    }

    this.activeProcess = null;
  }

  /** Kill any active process on app quit */
  killActiveProcess() {
    if (this.activeProcess) {
      console.log('[Separation] Killing active process on app quit');
      this.killProcessTree();
    }
  }
}

/* ── Singleton + exports ───────────────────────────────────── */

const jobManager = new SeparationJobManager();

export function queueSeparationJob(songId: string, quality?: 'high' | 'normal' | 'fast'): Promise<SeparationJob> {
  return jobManager.queueJob(songId, quality);
}

export function getAllJobs(): Promise<SeparationJob[]> {
  return jobManager.getAllJobs();
}

export function subscribeJobUpdates(callback: JobSubscriber): () => void {
  return jobManager.subscribe(callback);
}

export function cancelSeparationJob(jobId: string): Promise<void> {
  return jobManager.cancelJob(jobId);
}

export function retrySeparationJob(jobId: string): Promise<void> {
  return jobManager.retryJob(jobId);
}

export function removeSeparationJob(jobId: string): Promise<void> {
  return jobManager.removeJob(jobId);
}

export function killActiveSeparation() {
  jobManager.killActiveProcess();
}
