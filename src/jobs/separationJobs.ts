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

/* ── Separation Environment Helpers ────────────────────────── */

const getEnvApi = () => {
  if (window.khelper?.separationEnv) return window.khelper.separationEnv;
  throw new Error('SeparationEnv API is not available on window.khelper.separationEnv');
};

export async function getSeparationEnvStatus() {
  return getEnvApi().getStatus();
}

export async function getGpuInfo() {
  return getEnvApi().getGpuInfo();
}

export async function startInstallSeparationEnv(
  mode: import('../../shared/separationTypes').SeparationEngineMode,
  customTargetDir?: string
) {
  return getEnvApi().startInstall(mode, customTargetDir);
}

export async function cancelInstallSeparationEnv() {
  return getEnvApi().cancelInstall();
}

export async function getSeparationDiskUsage() {
  return getEnvApi().getDiskUsage();
}

export async function uninstallSeparationEnv() {
  return getEnvApi().uninstall();
}

export async function pickSeparationFolder(): Promise<string | null> {
  return getEnvApi().pickFolder();
}

export async function getSeparationStorageInfo() {
  return getEnvApi().getStorageInfo();
}

export async function preflightSeparationTarget(targetPath: string, options?: { forMigration?: boolean }) {
  return getEnvApi().preflightTarget(targetPath, options);
}

export async function startSeparationMigration(targetPath: string) {
  return getEnvApi().startMigration(targetPath);
}

export async function cancelSeparationMigration() {
  return getEnvApi().cancelMigration();
}

export async function switchSeparationEngineMode(mode: import('../../shared/separationTypes').SeparationEngineMode) {
  return getEnvApi().switchMode(mode);
}

export async function rescanSeparationFolder(targetPath?: string) {
  return getEnvApi().rescanFolder(targetPath);
}

export function subscribeSeparationEnvProgress(
  callback: (progress: import('../../shared/separationTypes').SeparationInstallProgress) => void
) {
  return getEnvApi().subscribeProgress(callback);
}

export function subscribeSeparationMigrationProgress(
  callback: (progress: import('../../shared/separationTypes').SeparationMigrationProgress) => void
) {
  return getEnvApi().subscribeMigrationProgress(callback);
}

export type { SeparationJob };

