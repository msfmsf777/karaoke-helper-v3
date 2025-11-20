import fs from 'node:fs/promises';
import path from 'node:path';
import { getSongMeta, getSongsBaseDir, updateSongMeta } from './songLibrary';
import type { SongMeta } from '../shared/songTypes';
import type { SeparationJob } from '../shared/separationTypes';

type JobSubscriber = (jobs: SeparationJob[]) => void;

function generateJobId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function runStubSeparation(
  originalPath: string,
  songFolder: string,
): Promise<{ instrumentalPath: string; vocalPath: string }> {
  console.log('[Separation] Stub separation start', { originalPath, songFolder });

  const ext = path.extname(originalPath) || '.wav';
  const instrumentalPath = path.join(songFolder, `Instrumental${ext}`);
  const vocalPath = path.join(songFolder, `Vocals${ext}`);

  // TODO: Replace this stub with a real Demucs/demucs.cpp pipeline (spawn process, await outputs).
  await fs.copyFile(originalPath, instrumentalPath);
  await fs.copyFile(originalPath, vocalPath);

  console.log('[Separation] Stub separation finished', { instrumentalPath, vocalPath });
  return { instrumentalPath, vocalPath };
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
      const { instrumentalPath, vocalPath } = await runStubSeparation(originalPath, songDir);

      await updateSongMeta(job.songId, (current) => ({
        ...current,
        audio_status: 'separated',
        instrumental_path: instrumentalPath,
        vocal_path: vocalPath,
        last_separation_error: null,
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

    const now = new Date().toISOString();
    const job: SeparationJob = {
      id: generateJobId(),
      songId,
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
