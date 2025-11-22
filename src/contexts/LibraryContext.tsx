import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { loadAllSongs, SongMeta } from '../library/songLibrary';
import { subscribeJobUpdates } from '../jobs/separationJobs';

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
        const unsubscribe = subscribeJobUpdates(() => {
            fetchSongs();
        });

        // Listen for library:changed event from main process
        const removeListener = window.ipcRenderer?.on('library:changed', () => {
            console.log('[LibraryContext] Received library:changed event, refreshing...');
            fetchSongs();
        });

        return () => {
            unsubscribe();
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
