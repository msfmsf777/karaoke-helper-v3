import { useState, useEffect, useRef, useCallback } from 'react';
import type { SeparationJob } from '../jobs/separationJobs';
import { getAllJobs, subscribeJobUpdates } from '../jobs/separationJobs';
import { DownloadJob, MigrationProgress } from '../../shared/songTypes';

interface TaskCounts {
  activeCount: number;
  failedCount: number;
  hasFailures: boolean;
  showCompletionCheck: boolean;
  dismissCompletion: () => void;
  badgeJustUpdated: boolean;
}

export function useTaskCounts(): TaskCounts {
  const [sepJobs, setSepJobs] = useState<SeparationJob[]>([]);
  const [dlJobs, setDlJobs] = useState<DownloadJob[]>([]);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [showCompletionCheck, setShowCompletionCheck] = useState(false);
  const [badgeJustUpdated, setBadgeJustUpdated] = useState(false);

  const prevActiveRef = useRef<number>(0);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseBatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Separation subscription
  useEffect(() => {
    const load = () => {
      getAllJobs()
        .then((jobs) => {
          const debugJobs = (import.meta.env.DEV && (window as any).__khelper_debug_sep_jobs) || [];
          setSepJobs([...debugJobs, ...jobs]);
        })
        .catch(() => {});
    };
    load();

    const unsub = subscribeJobUpdates((jobs) => {
      const debugJobs = (import.meta.env.DEV && (window as any).__khelper_debug_sep_jobs) || [];
      setSepJobs([...debugJobs, ...jobs]);
    });

    let handleDebugInject: ((e: Event) => void) | undefined;
    let handleDebugClear: (() => void) | undefined;
    if (import.meta.env.DEV) {
      handleDebugInject = (e: Event) => {
        const customEvent = e as CustomEvent<SeparationJob[]>;
        if (Array.isArray(customEvent.detail)) {
          setSepJobs((prev) => [...customEvent.detail, ...prev]);
        }
      };
      handleDebugClear = () => {
        load();
      };
      window.addEventListener('khelper:debug-inject-sep-jobs', handleDebugInject);
      window.addEventListener('khelper:debug-clear-sep-jobs', handleDebugClear);
    }

    return () => {
      unsub();
      if (handleDebugInject) window.removeEventListener('khelper:debug-inject-sep-jobs', handleDebugInject);
      if (handleDebugClear) window.removeEventListener('khelper:debug-clear-sep-jobs', handleDebugClear);
    };
  }, []);

  // Download subscription
  useEffect(() => {
    window.khelper?.downloads.getAllJobs().then(setDlJobs);
    const unsub = window.khelper?.downloads.subscribeUpdates((jobs) => setDlJobs(jobs));
    return () => { unsub?.(); };
  }, []);

  // Migration subscription
  useEffect(() => {
    const unsub = window.khelper?.storage?.subscribeProgress?.((p) => {
      setMigrationProgress(p);
    });
    return () => { unsub?.(); };
  }, []);

  // Separation environment installation subscription
  const [envProgress, setEnvProgress] = useState<import('../../shared/separationTypes').SeparationInstallProgress | null>(null);
  useEffect(() => {
    const unsub = window.khelper?.separationEnv?.subscribeProgress?.((p) => {
      setEnvProgress(p);
    });
    return () => { unsub?.(); };
  }, []);

  // Separation environment migration subscription
  const [sepMigrationProgress, setSepMigrationProgress] = useState<import('../../shared/separationTypes').SeparationMigrationProgress | null>(null);
  useEffect(() => {
    const unsub = window.khelper?.separationEnv?.subscribeMigrationProgress?.((p) => {
      setSepMigrationProgress(p);
    });
    return () => { unsub?.(); };
  }, []);

  // Compute counts
  const isMigrationActive = migrationProgress?.status === 'running' || migrationProgress?.status === 'verifying';
  const isMigrationFailed = migrationProgress?.status === 'failed';

  const isEnvActive = envProgress?.stage === 'preparing' || envProgress?.stage === 'downloading' || envProgress?.stage === 'installing' || envProgress?.stage === 'verifying';
  const isEnvFailed = envProgress?.stage === 'error';

  const isSepMigrationActive = sepMigrationProgress?.status === 'preparing' || sepMigrationProgress?.status === 'copying' || sepMigrationProgress?.status === 'verifying';
  const isSepMigrationFailed = sepMigrationProgress?.status === 'failed';

  const activeCount =
    sepJobs.filter(j => j.status === 'queued' || j.status === 'running' || j.status === 'waiting_for_engine').length +
    dlJobs.filter(j => ['queued', 'downloading', 'processing'].includes(j.status)).length +
    (isMigrationActive ? 1 : 0) +
    (isEnvActive ? 1 : 0) +
    (isSepMigrationActive ? 1 : 0);

  const failedCount =
    sepJobs.filter(j => j.status === 'failed').length +
    dlJobs.filter(j => j.status === 'failed').length +
    (isMigrationFailed ? 1 : 0) +
    (isEnvFailed ? 1 : 0) +
    (isSepMigrationFailed ? 1 : 0);

  const hasFailures = failedCount > 0;

  // Detect completion transition: active > 0 → active === 0 with no failures
  useEffect(() => {
    if (prevActiveRef.current > 0 && activeCount === 0 && !hasFailures) {
      setShowCompletionCheck(true);

      // Auto-dismiss after 5 minutes
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
      completionTimerRef.current = setTimeout(() => {
        setShowCompletionCheck(false);
      }, 5 * 60 * 1000);
    }

    // Clear completion check when new tasks start
    if (activeCount > 0) {
      setShowCompletionCheck(false);
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }
    }

    prevActiveRef.current = activeCount;
  }, [activeCount, hasFailures]);

  // Pulse animation on badge count changes (debounced for batch adds)
  const totalBadgeValue = activeCount + failedCount + (showCompletionCheck ? 1 : 0);
  const prevTotalRef = useRef<number>(totalBadgeValue);

  useEffect(() => {
    if (totalBadgeValue !== prevTotalRef.current && totalBadgeValue > 0) {
      // Debounce: wait 100ms to batch rapid updates (e.g., adding 5 songs from wizard)
      if (pulseBatchTimerRef.current) clearTimeout(pulseBatchTimerRef.current);
      pulseBatchTimerRef.current = setTimeout(() => {
        setBadgeJustUpdated(true);
        if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
        pulseTimerRef.current = setTimeout(() => setBadgeJustUpdated(false), 400);
      }, 100);
    }
    prevTotalRef.current = totalBadgeValue;
  }, [totalBadgeValue]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      if (pulseBatchTimerRef.current) clearTimeout(pulseBatchTimerRef.current);
    };
  }, []);

  const dismissCompletion = useCallback(() => {
    setShowCompletionCheck(false);
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
  }, []);

  return {
    activeCount,
    failedCount,
    hasFailures,
    showCompletionCheck,
    dismissCompletion,
    badgeJustUpdated,
  };
}
