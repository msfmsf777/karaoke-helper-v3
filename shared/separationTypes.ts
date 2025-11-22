export type SeparationJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface SeparationJob {
  id: string;
  songId: string;
  createdAt: string;
  updatedAt: string;
  status: SeparationJobStatus;
  errorMessage?: string;
  progress?: number;
}
