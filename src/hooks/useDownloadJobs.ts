import { useEffect, useState } from 'react';
import type { DownloadJob } from '../../shared/songTypes';

export const useDownloadJobs = () => {
    const [downloadJobs, setDownloadJobs] = useState<DownloadJob[]>([]);

    useEffect(() => {
        window.khelper?.downloads.getAllJobs().then(setDownloadJobs).catch(() => setDownloadJobs([]));
        const unsubscribe = window.khelper?.downloads.subscribeUpdates((jobs) => {
            setDownloadJobs(jobs);
        });
        return () => unsubscribe?.();
    }, []);

    return downloadJobs;
};
