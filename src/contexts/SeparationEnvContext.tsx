import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type {
  SeparationEngineMode,
  SeparationEnvStatus,
  SeparationInstallProgress,
  GpuDeviceInfo,
} from '../../shared/separationTypes';
import {
  getSeparationEnvStatus,
  getGpuInfo,
  startInstallSeparationEnv,
  cancelInstallSeparationEnv,
  subscribeSeparationEnvProgress,
  queueSeparationJob,
  switchSeparationEngineMode,
  rescanSeparationFolder,
} from '../jobs/separationJobs';

interface PendingSeparation {
  songId: string;
  quality?: 'high' | 'normal' | 'fast';
}

interface SeparationEnvContextType {
  envStatus: SeparationEnvStatus | null;
  gpuInfo: GpuDeviceInfo | null;
  installProgress: SeparationInstallProgress | null;
  isSetupModalOpen: boolean;
  pendingJob: PendingSeparation | null;
  isReady: boolean;
  isInstalling: boolean;
  openSetupModal: () => void;
  closeSetupModal: () => void;
  requestSeparation: (songId: string, quality?: 'high' | 'normal' | 'fast') => Promise<void>;
  startInstall: (mode: SeparationEngineMode, customTargetDir?: string) => Promise<void>;
  cancelInstall: () => Promise<void>;
  switchMode: (mode: SeparationEngineMode) => Promise<{ success: boolean; mode?: SeparationEngineMode; requiresInstall?: boolean; error?: string }>;
  rescanFolder: (targetPath?: string) => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const SeparationEnvContext = createContext<SeparationEnvContextType | null>(null);

export const SeparationEnvProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [envStatus, setEnvStatus] = useState<SeparationEnvStatus | null>(null);
  const [gpuInfo, setGpuInfo] = useState<GpuDeviceInfo | null>(null);
  const [installProgress, setInstallProgress] = useState<SeparationInstallProgress | null>(null);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [pendingJob, setPendingJob] = useState<PendingSeparation | null>(null);

  const pendingJobRef = useRef<PendingSeparation | null>(null);
  pendingJobRef.current = pendingJob;

  const refreshStatus = useCallback(async () => {
    try {
      const status = await getSeparationEnvStatus();
      setEnvStatus(status);
    } catch (err) {
      console.error('[SeparationEnvContext] Failed to get status', err);
    }
  }, []);

  const refreshGpuInfo = useCallback(async () => {
    try {
      const info = await getGpuInfo();
      setGpuInfo(info);
    } catch (err) {
      console.error('[SeparationEnvContext] Failed to get GPU info', err);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    void refreshGpuInfo();

    const unsubscribe = subscribeSeparationEnvProgress((progress) => {
      setInstallProgress(progress);
      if (progress.stage === 'completed') {
        void refreshStatus();
        // If there was a pending separation requested by the user, trigger it now!
        const pending = pendingJobRef.current;
        if (pending) {
          console.log('[SeparationEnvContext] Auto-triggering pending separation', pending);
          void queueSeparationJob(pending.songId, pending.quality);
          setPendingJob(null);
        }
      } else if (progress.stage === 'error') {
        void refreshStatus();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [refreshStatus, refreshGpuInfo]);

  const openSetupModal = useCallback(() => {
    void refreshGpuInfo();
    setIsSetupModalOpen(true);
  }, [refreshGpuInfo]);

  const closeSetupModal = useCallback(() => {
    setIsSetupModalOpen(false);
  }, []);

  const requestSeparation = useCallback(async (songId: string, quality?: 'high' | 'normal' | 'fast') => {
    // Check if environment is already ready
    const status = await getSeparationEnvStatus();
    setEnvStatus(status);

    if (status.status === 'ready') {
      await queueSeparationJob(songId, quality);
      return;
    }

    // Engine is either not installed or currently installing
    setPendingJob({ songId, quality });

    if (status.status === 'installing') {
      // It's already installing in background, queue the job (it will wait for engine)
      await queueSeparationJob(songId, quality);
    } else {
      // First time: prompt user with setup guide
      await refreshGpuInfo();
      setIsSetupModalOpen(true);
    }
  }, [refreshGpuInfo]);

  const startInstall = useCallback(async (mode: SeparationEngineMode, customTargetDir?: string) => {
    try {
      await startInstallSeparationEnv(mode, customTargetDir);
    } catch (err) {
      console.error('[SeparationEnvContext] Install failed', err);
    }
  }, []);

  const cancelInstall = useCallback(async () => {
    try {
      await cancelInstallSeparationEnv();
      setPendingJob(null);
    } catch (err) {
      console.error('[SeparationEnvContext] Cancel failed', err);
    }
  }, []);

  const switchMode = useCallback(async (mode: SeparationEngineMode) => {
    try {
      const res = await switchSeparationEngineMode(mode);
      await refreshStatus();
      return res;
    } catch (err: unknown) {
      console.error('[SeparationEnvContext] Switch mode failed', err);
      return { success: false, error: (err as Error).message || '切換模式失敗' };
    }
  }, [refreshStatus]);

  const rescanFolder = useCallback(async (targetPath?: string) => {
    try {
      const status = await rescanSeparationFolder(targetPath);
      setEnvStatus(status);
    } catch (err) {
      console.error('[SeparationEnvContext] Rescan folder failed', err);
      await refreshStatus();
    }
  }, [refreshStatus]);

  const isReady = envStatus?.status === 'ready';
  const isInstalling = installProgress?.stage === 'downloading' || installProgress?.stage === 'installing' || installProgress?.stage === 'verifying' || envStatus?.status === 'installing';

  return (
    <SeparationEnvContext.Provider
      value={{
        envStatus,
        gpuInfo,
        installProgress,
        isSetupModalOpen,
        pendingJob,
        isReady,
        isInstalling,
        openSetupModal,
        closeSetupModal,
        requestSeparation,
        startInstall,
        cancelInstall,
        switchMode,
        rescanFolder,
        refreshStatus,
      }}
    >
      {children}
    </SeparationEnvContext.Provider>
  );
};

export const useSeparationEnv = () => {
  const context = useContext(SeparationEnvContext);
  if (!context) {
    throw new Error('useSeparationEnv must be used within a SeparationEnvProvider');
  }
  return context;
};
