import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { loadAllSongs, SongMeta } from '../library/songLibrary';
import { subscribeJobUpdates } from '../jobs/separationJobs';
import { DownloadJob } from '../../shared/songTypes';

interface LibraryContextType {
    songs: SongMeta[];
    loading: boolean;
    refreshSongs: () => Promise<void>;
    getSongById: (id: string) => SongMeta | undefined;
    deleteSong: (id: string) => Promise<boolean>;
    updateSong: (id: string, updates: Partial<SongMeta>) => Promise<void>;
}

const LibraryContext = createContext<LibraryContextType | null>(null);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [allSongs, setAllSongs] = useState<SongMeta[]>([]);
    const [loading, setLoading] = useState(false);
    const processedDownloadIds = React.useRef<Set<string>>(new Set());

    // The UI library view only sees non-streaming (local/downloaded) songs
    const librarySongs = React.useMemo(() => {
        return allSongs.filter(s => s.audio_status !== 'streaming');
    }, [allSongs]);

    const fetchSongs = useCallback(async () => {
        setLoading(true);
        try {
            const list = await loadAllSongs();
            setAllSongs(list);
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
            let needsFullRefresh = false;

            for (const job of jobs) {
                const prevStatus = prevJobStatuses.get(job.id);
                if (prevStatus !== job.status) {
                    prevJobStatuses.set(job.id, job.status);

                    if (job.status === 'succeeded' || job.status === 'failed') {
                        // Terminal state — file paths may have changed, need full reload
                        needsFullRefresh = true;
                    } else if (job.status === 'queued' || job.status === 'running') {
                        // Intermediate state — only audio_status changed, update in-place
                        // This avoids a full loadAllSongs() which would reset Virtuoso scroll position
                        const newAudioStatus = job.status === 'running' ? 'separating' as const : 'separation_pending' as const;
                        setAllSongs(prev => prev.map(s =>
                            s.id === job.songId ? { ...s, audio_status: newAudioStatus } : s
                        ));
                    }
                }
            }

            if (needsFullRefresh) {
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
        return allSongs.find((s) => s.id === id);
    }, [allSongs]);

    const deleteSong = useCallback(async (id: string) => {
        if (!window.khelper?.songLibrary?.deleteSong) {
            console.error('deleteSong API not available');
            return false;
        }
        try {
            const success = await window.khelper.songLibrary.deleteSong(id);
            if (success) {
                // Optimistic update or refresh
                setAllSongs(prev => prev.filter(s => s.id !== id));
                return true;
            }
            return false;
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
                setAllSongs(prev => prev.map(s => s.id === id ? updated : s));
            }
        } catch (err) {
            console.error('Failed to update song', err);
            throw err;
        }
    }, []);

    return (
        <LibraryContext.Provider value={{ songs: librarySongs, loading, refreshSongs: fetchSongs, getSongById, deleteSong, updateSong }}>
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
