export type SeparationJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'waiting_for_engine';

export interface SeparationJob {
  id: string;
  songId: string;
  createdAt: string;
  updatedAt: string;
  status: SeparationJobStatus;
  errorMessage?: string;
  progress?: number;
  quality?: 'high' | 'normal' | 'fast';
}

export type SeparationEngineMode = 'gpu' | 'cpu';

export type SeparationEnvStatusStage = 'not_installed' | 'installing' | 'ready' | 'error';

export interface SeparationRuntimeMeta {
  version: string;
  mode: SeparationEngineMode;
  verified: boolean;
  installedAt: string;
  gpuModel?: string;
  vramMb?: number;
  torchCuda?: boolean;
}

export interface SeparationEnvStatus {
  status: SeparationEnvStatusStage;
  mode: SeparationEngineMode | null;
  supportedModes?: SeparationEngineMode[];
  installedAt?: string;
  vramMb?: number;
  gpuModel?: string;
  errorMessage?: string;
  diskUsageBytes?: number;
  customRuntimePath?: string;
}

export interface SeparationInstallProgress {
  stage: 'preparing' | 'downloading' | 'installing' | 'verifying' | 'completed' | 'error';
  percent: number;
  message: string;
  detail?: string;
  error?: string;
}

export interface GpuDeviceInfo {
  hasCapableGpu: boolean;
  vendor: 'nvidia' | 'amd' | 'intel' | 'other';
  modelName: string;
  vramMb?: number;
  driverVersion?: string;
  recommendation: 'gpu' | 'cpu';
  recommendationReason: string;
}

export interface SeparationStorageInfo {
  currentPath: string;
  isDefault: boolean;
  totalBytes: number;
  freeDriveBytes: number;
  driveLetter: string;
}

export interface SeparationMigrationProgress {
  status: 'idle' | 'preparing' | 'copying' | 'verifying' | 'completed' | 'failed' | 'cancelled';
  transferredBytes: number;
  totalBytes: number;
  currentFile?: string;
  error?: string;
}
