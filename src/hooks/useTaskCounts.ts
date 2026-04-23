import { useState, useEffect, useRef, useCallback } from 'react';
import type { SeparationJob } from '../jobs/separationJobs';
import { getAllJobs, subscribeJobUpdates } from '../jobs/separationJobs';
import { DownloadJob } from '../../shared/songTypes';

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
  const [showCompletionCheck, setShowCompletionCheck] = useState(false);
  const [badgeJustUpdated, setBadgeJustUpdated] = useState(false);

  const prevActiveRef = useRef<number>(0);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseBatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Separation subscription
  useEffect(() => {
    getAllJobs().then(setSepJobs).catch(() => {});
    const unsub = subscribeJobUpdates((jobs) => setSepJobs(jobs));
    return () => unsub();
  }, []);

  // Download subscription
  useEffect(() => {
    window.khelper?.downloads.getAllJobs().then(setDlJobs);
    const unsub = window.khelper?.downloads.subscribeUpdates((jobs) => setDlJobs(jobs));
    return () => { unsub?.(); };
  }, []);

  // Compute counts
  const activeCount =
    sepJobs.filter(j => j.status === 'queued' || j.status === 'running').length +
    dlJobs.filter(j => ['queued', 'downloading', 'processing'].includes(j.status)).length;

  const failedCount =
    sepJobs.filter(j => j.status === 'failed').length +
    dlJobs.filter(j => j.status === 'failed').length;

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
