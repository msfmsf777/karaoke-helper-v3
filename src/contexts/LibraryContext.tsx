import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { loadAllSongs, SongMeta } from '../library/songLibrary';
import { subscribeJobUpdates } from '../jobs/separationJobs';

interface LibraryContextType {
    songs: SongMeta[];
    loading: boolean;
    refreshSongs: () => Promise<void>;
    getSongById: (id: string) => SongMeta | undefined;
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
        return () => unsubscribe();
    }, [fetchSongs]);

    const getSongById = useCallback((id: string) => {
        return songs.find((s) => s.id === id);
    }, [songs]);

    return (
        <LibraryContext.Provider value={{ songs, loading, refreshSongs: fetchSongs, getSongById }}>
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
