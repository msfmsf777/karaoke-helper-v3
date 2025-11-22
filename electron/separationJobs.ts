import fs from 'node:fs/promises';
import path from 'node:path';
import { getSongMeta, getSongsBaseDir, updateSongMeta } from './songLibrary';
import type { SongMeta } from '../shared/songTypes';
import type { SeparationJob } from '../shared/separationTypes';

type JobSubscriber = (jobs: SeparationJob[]) => void;

function generateJobId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

import { spawn } from 'node:child_process';

import { loadSettings } from './userData';

async function runDemucsSeparation(
  originalPath: string,
  songFolder: string,
  quality: 'high' | 'normal' | 'fast',
  onProgress?: (percent: number) => void
): Promise<{ instrumentalPath: string; vocalPath: string }> {
  console.log('[Separation] Starting MDX separation', { originalPath, songFolder, quality });

  const scriptPath = path.join(process.cwd(), 'resources', 'separation', 'separate.py');

  return new Promise((resolve, reject) => {
    const python = spawn('python', [
      scriptPath,
      '--input', originalPath,
      '--output-dir', songFolder,
      '--quality', quality,
      '--cache-dir', path.join(process.env.APPDATA || '', 'KHelperLive', 'models')
    ]);

    let result: { instrumental?: string; vocal?: string; error?: string } | null = null;
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.status === 'success') {
            result = msg;
          } else if (msg.status === 'progress' && typeof msg.progress === 'number') {
            onProgress?.(msg.progress);
          } else if (msg.error) {
            reject(new Error(`${msg.error} ${msg.details || ''}`));
          }
        } catch (e) {
        }
      }
    });

    python.stderr.on('data', (data) => {
      const str = data.toString();
      errorOutput += str;
    });

    python.on('close', (code) => {
      if (code === 0 && result && result.instrumental && result.vocal) {
        resolve({
          instrumentalPath: result.instrumental,
          vocalPath: result.vocal
        });
      } else {
        const msg = result?.error || 'Separation process failed';
        reject(new Error(`${msg} (Exit code ${code}). Details: ${errorOutput.slice(-500)}`));
      }
    });
  });
}

class SeparationJobManager {
  private jobs: SeparationJob[] = [];
  private runningJobId: string | null = null;
  private subscribers = new Set<JobSubscriber>();

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
      this.updateJob(job.id, { status: 'running', errorMessage: undefined });
      this.notify();

      const { songDir, originalPath } = await this.ensureOriginalPath(meta);

      // Use job quality or default to normal
      const quality = job.quality || 'normal';

      const { instrumentalPath, vocalPath } = await runDemucsSeparation(originalPath, songDir, quality, (progress) => {
        this.updateJob(job.id, { progress });
        this.notify();
      });

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
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Separation] Job failed', { jobId: job.id, songId: job.songId, message, err });
      await updateSongMeta(job.songId, (current) => ({
        ...current,
        audio_status: 'separation_failed',
        last_separation_error: message,
      }));
      this.updateJob(job.id, { status: 'failed', errorMessage: message });
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

  async queueJob(songId: string): Promise<SeparationJob> {
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

    // Load quality setting
    const settings = await loadSettings();
    const quality = settings.separationQuality || 'normal';

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

  async getAllJobs(): Promise<SeparationJob[]> {
    return this.snapshot();
  }

  subscribe(subscriber: JobSubscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.snapshot());
    return () => this.subscribers.delete(subscriber);
  }
}

const jobManager = new SeparationJobManager();

export function queueSeparationJob(songId: string): Promise<SeparationJob> {
  return jobManager.queueJob(songId);
}

export function getAllJobs(): Promise<SeparationJob[]> {
  return jobManager.getAllJobs();
}

export function subscribeJobUpdates(callback: JobSubscriber): () => void {
  return jobManager.subscribe(callback);
}
