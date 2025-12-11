import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { loadAllSongs, SongMeta } from '../library/songLibrary';
import { subscribeJobUpdates } from '../jobs/separationJobs';
import { DownloadJob } from '../../shared/songTypes';

interface LibraryContextType {
    songs: SongMeta[];
    loading: boolean;
    refreshSongs: () => Promise<void>;
    getSongById: (id: string) => SongMeta | undefined;
    deleteSong: (id: string) => Promise<void>;
    updateSong: (id: string, updates: Partial<SongMeta>) => Promise<void>;
}

const LibraryContext = createContext<LibraryContextType | null>(null);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [songs, setSongs] = useState<SongMeta[]>([]);
    const [loading, setLoading] = useState(false);
    const processedDownloadIds = React.useRef<Set<string>>(new Set());

    const fetchSongs = useCallback(async () => {
        setLoading(true);
        try {
            const list = await loadAllSongs();
            setSongs(list);
            console.log('[LibraryContext] Loaded library list', list.length);
        } catch (err) {
            console.error('[LibraryContext] Failed to load songs', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSongs();
    }, [fetchSongs]);

    useEffect(() => {
        // Track previous job statuses to avoid unnecessary refreshes on progress updates
        let prevJobStatuses = new Map<string, string>();

        const unsubscribeSeparation = subscribeJobUpdates((jobs) => {
            let shouldRefresh = false;

            for (const job of jobs) {
                const prevStatus = prevJobStatuses.get(job.id);
                // Refresh if status changed (e.g. queued -> running -> succeeded)
                // New jobs also trigger refresh
                if (prevStatus !== job.status) {
                    shouldRefresh = true;
                    prevJobStatuses.set(job.id, job.status);
                }
            }

            // Also check for removed jobs? 
            // If a job finishes and is removed from the list (though they aren't removed immediately in separationJobs logic), we might miss it. 
            // But separationJobs currently keeps history.

            if (shouldRefresh) {
                // If status changed to success, we definitely need to reload to get new paths
                fetchSongs();
            }
        });

        // Listen for download updates to refresh library when a download completes
        let unsubscribeDownloads: (() => void) | undefined;
        if (window.khelper?.downloads?.subscribeUpdates) {
            unsubscribeDownloads = window.khelper.downloads.subscribeUpdates((jobs: DownloadJob[]) => {
                let shouldRefresh = false;
                jobs.forEach(job => {
                    if (job.status === 'completed' && !processedDownloadIds.current.has(job.id)) {
                        processedDownloadIds.current.add(job.id);
                        shouldRefresh = true;
                    }
                });

                if (shouldRefresh) {
                    console.log('[LibraryContext] Download completed, refreshing library...');
                    fetchSongs();
                }
            });
        }

        // Listen for library:changed event from main process
        const removeListener = window.ipcRenderer?.on('library:changed', () => {
            console.log('[LibraryContext] Received library:changed event, refreshing...');
            fetchSongs();
        });

        return () => {
            unsubscribeSeparation();
            unsubscribeDownloads?.();
            removeListener?.();
        };
    }, [fetchSongs]);

    const getSongById = useCallback((id: string) => {
        return songs.find((s) => s.id === id);
    }, [songs]);

    const deleteSong = useCallback(async (id: string) => {
        if (!window.khelper?.songLibrary?.deleteSong) {
            console.error('deleteSong API not available');
            return;
        }
        try {
            await window.khelper.songLibrary.deleteSong(id);
            // Optimistic update or refresh
            setSongs(prev => prev.filter(s => s.id !== id));
        } catch (err) {
            console.error('Failed to delete song', err);
            throw err;
        }
    }, []);

    const updateSong = useCallback(async (id: string, updates: Partial<SongMeta>) => {
        if (!window.khelper?.songLibrary?.updateSong) {
            console.error('updateSong API not available');
            return;
        }
        try {
            const updated = await window.khelper.songLibrary.updateSong(id, updates);
            if (updated) {
                setSongs(prev => prev.map(s => s.id === id ? updated : s));
            }
        } catch (err) {
            console.error('Failed to update song', err);
            throw err;
        }
    }, []);

    return (
        <LibraryContext.Provider value={{ songs, loading, refreshSongs: fetchSongs, getSongById, deleteSong, updateSong }}>
            {children}
        </LibraryContext.Provider>
    );
};

export const useLibrary = () => {
    const context = useContext(LibraryContext);
    if (!context) {
        throw new Error('useLibrary must be used within a LibraryProvider');
    }
    return context;
};
