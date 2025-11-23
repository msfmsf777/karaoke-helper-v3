import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useQueue } from './QueueContext';
// import { useLibrary } from './LibraryContext';

export interface Playlist {
    id: string;
    name: string;
    description?: string;
    songIds: string[];
}

export interface LyricStyleConfig {
    fontSize: number;
    inactiveColor: string;
    activeColor: string;
    activeGlowColor: string;
    strokeColor: string;
    strokeWidth: number;
}

export const DEFAULT_LYRIC_STYLES: LyricStyleConfig = {
    fontSize: 32,
    inactiveColor: '#888888',
    activeColor: '#ff4444',
    activeGlowColor: 'rgba(255, 68, 68, 0.4)',
    strokeColor: '#000000',
    strokeWidth: 0,
};

interface UserDataContextType {
    favorites: string[];
    history: string[];
    playlists: Playlist[];
    separationQuality: 'high' | 'normal' | 'fast';
    setSeparationQuality: (quality: 'high' | 'normal' | 'fast') => void;
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
    recentSearches: string[];
    addRecentSearch: (term: string) => void;
    clearRecentSearches: () => void;
    lyricStyles: LyricStyleConfig;
    setLyricStyles: (styles: LyricStyleConfig) => void;
}

const UserDataContext = createContext<UserDataContextType | null>(null);

export const UserDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [favorites, setFavorites] = useState<string[]>([]);
    const [history, setHistory] = useState<string[]>([]);
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [separationQuality, setSeparationQuality] = useState<'high' | 'normal' | 'fast'>('normal');
    const { currentSongId } = useQueue();
    const isInitialized = useRef(false);
    const styleUpdateTimeout = useRef<NodeJS.Timeout | null>(null);

    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [lyricStyles, setLyricStyles] = useState<LyricStyleConfig>(DEFAULT_LYRIC_STYLES);

    // Load data on startup
    useEffect(() => {
        if (isInitialized.current) return;

        const load = async () => {
            try {
                const [favs, hist, pl, settings] = await Promise.all([
                    window.khelper?.userData.loadFavorites() || [],
                    window.khelper?.userData.loadHistory() || [],
                    window.khelper?.userData.loadPlaylists() || [],
                    (window.khelper?.userData.loadSettings() || Promise.resolve({ separationQuality: 'normal' })) as Promise<{ separationQuality: 'high' | 'normal' | 'fast'; lyricStyles?: LyricStyleConfig }>
                ]);
                setFavorites(Array.from(new Set(favs)));
                setHistory(Array.from(new Set(hist)));
                setPlaylists(pl);
                setSeparationQuality((settings.separationQuality as 'high' | 'normal' | 'fast') || 'normal');
                const settingsWithStyles = settings as { separationQuality: string; lyricStyles?: LyricStyleConfig };
                if (settingsWithStyles.lyricStyles) {
                    setLyricStyles({ ...DEFAULT_LYRIC_STYLES, ...settingsWithStyles.lyricStyles });
                }

                // Load recent searches from localStorage
                const savedRecent = localStorage.getItem('khelper_recent_searches');
                if (savedRecent) {
                    try {
                        setRecentSearches(JSON.parse(savedRecent));
                    } catch (e) {
                        console.warn('Failed to parse recent searches', e);
                    }
                }

                console.log('[UserData] Loaded', favs.length, 'favorites,', hist.length, 'history items,', pl.length, 'playlists, quality:', settings.separationQuality);
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

    // Save settings on change
    // Save settings (quality + styles) on change
    useEffect(() => {
        if (!isInitialized.current) return;
        window.khelper?.userData.saveSettings({ separationQuality, lyricStyles }).catch(err =>
            console.error('[UserData] Failed to save settings', err)
        );

        // Sync styles to overlay with throttling (500ms)
        if (styleUpdateTimeout.current) {
            clearTimeout(styleUpdateTimeout.current);
        }
        styleUpdateTimeout.current = setTimeout(() => {
            window.api?.sendOverlayStyleUpdate(lyricStyles);
        }, 500);

    }, [separationQuality, lyricStyles]);

    // Save recent searches on change
    useEffect(() => {
        if (!isInitialized.current) return;
        localStorage.setItem('khelper_recent_searches', JSON.stringify(recentSearches));
    }, [recentSearches]);

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

    const addRecentSearch = useCallback((term: string) => {
        setRecentSearches(prev => {
            const filtered = prev.filter(t => t !== term);
            return [term, ...filtered].slice(0, 10);
        });
    }, []);

    const clearRecentSearches = useCallback(() => {
        setRecentSearches([]);
    }, []);

    return (
        <UserDataContext.Provider value={{
            favorites,
            history,
            playlists,
            separationQuality,
            setSeparationQuality,
            toggleFavorite,
            isFavorite,
            addToHistory,
            clearHistory,
            createPlaylist,
            deletePlaylist,
            renamePlaylist,
            addSongToPlaylist,
            removeSongFromPlaylist,
            cleanupSong,
            recentSearches,
            addRecentSearch,
            clearRecentSearches,
            lyricStyles,
            setLyricStyles
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
