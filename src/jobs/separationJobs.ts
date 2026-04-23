import type { SeparationJob } from '../../shared/separationTypes';

const getApi = () => {
  if (window.khelper?.jobs) return window.khelper.jobs;
  throw new Error('Jobs API is not available on window.khelper.jobs');
};

export async function queueSeparationJob(songId: string, quality?: 'high' | 'normal' | 'fast'): Promise<SeparationJob> {
  const job = await getApi().queueSeparationJob(songId, quality);
  console.log('[Jobs] Queued separation job', job);
  return job;
}

export async function getAllJobs(): Promise<SeparationJob[]> {
  const jobs = await getApi().getAllJobs();
  return jobs;
}

export function subscribeJobUpdates(callback: (jobs: SeparationJob[]) => void): () => void {
  return getApi().subscribeJobUpdates(callback);
}

export async function cancelSeparationJob(jobId: string): Promise<void> {
  await getApi().cancelJob(jobId);
  console.log('[Jobs] Cancelled separation job', jobId);
}

export async function retrySeparationJob(jobId: string): Promise<void> {
  await getApi().retryJob(jobId);
  console.log('[Jobs] Retried separation job', jobId);
}

export async function removeSeparationJob(jobId: string): Promise<void> {
  await getApi().removeJob(jobId);
  console.log('[Jobs] Removed separation job', jobId);
}

export type { SeparationJob };
