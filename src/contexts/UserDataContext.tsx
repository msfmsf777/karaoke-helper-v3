import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useQueue } from './QueueContext';
import { useLibrary } from './LibraryContext';

interface UserDataContextType {
    favorites: string[];
    history: string[];
    toggleFavorite: (songId: string) => void;
    isFavorite: (songId: string) => boolean;
    addToHistory: (songId: string) => void;
    clearHistory: () => void;
}

const UserDataContext = createContext<UserDataContextType | null>(null);

export const UserDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [favorites, setFavorites] = useState<string[]>([]);
    const [history, setHistory] = useState<string[]>([]);
    const { currentSongId } = useQueue();
    const { getSongById } = useLibrary();
    const isInitialized = useRef(false);

    // Load data on startup
    useEffect(() => {
        if (isInitialized.current) return;

        const load = async () => {
            try {
                const [favs, hist] = await Promise.all([
                    window.khelper?.userData.loadFavorites() || [],
                    window.khelper?.userData.loadHistory() || []
                ]);
                setFavorites(Array.from(new Set(favs)));
                setHistory(Array.from(new Set(hist)));
                console.log('[UserData] Loaded', favs.length, 'favorites and', hist.length, 'history items');
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

    // Listen to currentSongId changes to update history
    useEffect(() => {
        if (currentSongId) {
            // Verify song exists in library (optional, but good practice)
            // Actually, we might want to keep history even if song is temporarily missing?
            // But requirement says "Remove entries that refer to missing songs... on startup".
            // For runtime, let's just add it.
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

    return (
        <UserDataContext.Provider value={{
            favorites,
            history,
            toggleFavorite,
            isFavorite,
            addToHistory,
            clearHistory
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
