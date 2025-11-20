import type { SeparationJob } from '../../shared/separationTypes';

const getApi = () => {
  if (window.khelper?.jobs) return window.khelper.jobs;
  throw new Error('Jobs API is not available on window.khelper.jobs');
};

export async function queueSeparationJob(songId: string): Promise<SeparationJob> {
  const job = await getApi().queueSeparationJob(songId);
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

export type { SeparationJob };
