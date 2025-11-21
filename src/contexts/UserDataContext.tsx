import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useQueue } from './QueueContext';
import { useLibrary } from './LibraryContext';

export interface Playlist {
    id: string;
    name: string;
    description?: string;
    songIds: string[];
}

interface UserDataContextType {
    favorites: string[];
    history: string[];
    playlists: Playlist[];
    toggleFavorite: (songId: string) => void;
    isFavorite: (songId: string) => boolean;
    addToHistory: (songId: string) => void;
    clearHistory: () => void;
    createPlaylist: (name: string) => string;
    deletePlaylist: (id: string) => void;
    renamePlaylist: (id: string, name: string) => void;
    addSongToPlaylist: (playlistId: string, songId: string) => void;
    removeSongFromPlaylist: (playlistId: string, songId: string) => void;
    cleanupSong: (songId: string) => void;
}

const UserDataContext = createContext<UserDataContextType | null>(null);

export const UserDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [favorites, setFavorites] = useState<string[]>([]);
    const [history, setHistory] = useState<string[]>([]);
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const { currentSongId } = useQueue();
    const { getSongById } = useLibrary();
    const isInitialized = useRef(false);

    // Load data on startup
    useEffect(() => {
        if (isInitialized.current) return;

        const load = async () => {
            try {
                const [favs, hist, pl] = await Promise.all([
                    window.khelper?.userData.loadFavorites() || [],
                    window.khelper?.userData.loadHistory() || [],
                    window.khelper?.userData.loadPlaylists() || []
                ]);
                setFavorites(Array.from(new Set(favs)));
                setHistory(Array.from(new Set(hist)));
                setPlaylists(pl);
                console.log('[UserData] Loaded', favs.length, 'favorites,', hist.length, 'history items, and', pl.length, 'playlists');
            } catch (err) {
                console.error('[UserData] Failed to load user data', err);
            } finally {
                isInitialized.current = true;
            }
        };
        load();
    }, []);

    // Save favorites on change
    useEffect(() => {
        if (!isInitialized.current) return;
        window.khelper?.userData.saveFavorites(favorites).catch(err =>
            console.error('[UserData] Failed to save favorites', err)
        );
    }, [favorites]);

    // Save history on change
    useEffect(() => {
        if (!isInitialized.current) return;
        window.khelper?.userData.saveHistory(history).catch(err =>
            console.error('[UserData] Failed to save history', err)
        );
    }, [history]);

    // Save playlists on change
    useEffect(() => {
        if (!isInitialized.current) return;
        window.khelper?.userData.savePlaylists(playlists).catch(err =>
            console.error('[UserData] Failed to save playlists', err)
        );
    }, [playlists]);

    // Listen to currentSongId changes to update history
    useEffect(() => {
        if (currentSongId) {
            addToHistory(currentSongId);
        }
    }, [currentSongId]);

    const toggleFavorite = useCallback((songId: string) => {
        setFavorites(prev => {
            if (prev.includes(songId)) {
                return prev.filter(id => id !== songId);
            } else {
                return [...prev, songId];
            }
        });
    }, []);

    const isFavorite = useCallback((songId: string) => {
        return favorites.includes(songId);
    }, [favorites]);

    const addToHistory = useCallback((songId: string) => {
        setHistory(prev => {
            // Remove existing if present
            const filtered = prev.filter(id => id !== songId);
            // Add to front
            const newHistory = [songId, ...filtered];
            // Limit to 100
            return newHistory.slice(0, 100);
        });
    }, []);

    const clearHistory = useCallback(() => {
        setHistory([]);
    }, []);

    const createPlaylist = useCallback((name: string) => {
        const newPlaylist: Playlist = {
            id: crypto.randomUUID(),
            name,
            songIds: []
        };
        setPlaylists(prev => [...prev, newPlaylist]);
        return newPlaylist.id;
    }, []);

    const deletePlaylist = useCallback((id: string) => {
        setPlaylists(prev => prev.filter(p => p.id !== id));
    }, []);

    const renamePlaylist = useCallback((id: string, name: string) => {
        setPlaylists(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    }, []);

    const addSongToPlaylist = useCallback((playlistId: string, songId: string) => {
        setPlaylists(prev => prev.map(p => {
            if (p.id !== playlistId) return p;
            if (p.songIds.includes(songId)) return p; // No duplicate
            return { ...p, songIds: [...p.songIds, songId] };
        }));
    }, []);

    const removeSongFromPlaylist = useCallback((playlistId: string, songId: string) => {
        setPlaylists(prev => prev.map(p => {
            if (p.id !== playlistId) return p;
            return { ...p, songIds: p.songIds.filter(id => id !== songId) };
        }));
    }, []);

    const cleanupSong = useCallback((songId: string) => {
        setFavorites(prev => prev.filter(id => id !== songId));
        setHistory(prev => prev.filter(id => id !== songId));
        setPlaylists(prev => prev.map(p => ({
            ...p,
            songIds: p.songIds.filter(id => id !== songId)
        })));
    }, []);

    return (
        <UserDataContext.Provider value={{
            favorites,
            history,
            playlists,
            toggleFavorite,
            isFavorite,
            addToHistory,
            clearHistory,
            createPlaylist,
            deletePlaylist,
            renamePlaylist,
            addSongToPlaylist,
            removeSongFromPlaylist,
            cleanupSong
        }}>
            {children}
        </UserDataContext.Provider>
    );
};

export const useUserData = () => {
    const context = useContext(UserDataContext);
    if (!context) {
        throw new Error('useUserData must be used within a UserDataProvider');
    }
    return context;
};
