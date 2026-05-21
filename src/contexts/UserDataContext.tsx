import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useQueue } from './QueueContext';
import { HotkeyConfig, mergeHotkeyConfig } from '../../shared/hotkeys';
import { SongListViewConfig, SongListViewConfigs, mergeSongListViewConfig, mergeSongListViewConfigs } from '../../shared/songListView';
import { OverlayTemplatesConfig, mergeOverlayTemplatesConfig } from '../../shared/overlayTemplates';
import { SupportedLanguage, normalizeLanguage } from '../../shared/i18n';
import i18n from '../i18n';
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
    language: SupportedLanguage;
    setLanguage: (language: SupportedLanguage) => void;
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
    songPreferences: Record<string, { furigana?: boolean; romaji?: boolean }>;
    setSongPreference: (songId: string, prefs: { furigana?: boolean; romaji?: boolean }) => void;
    hotkeys: HotkeyConfig;
    setHotkeys: (hotkeys: HotkeyConfig) => void;
    songListViews: SongListViewConfigs;
    setSongListViewConfig: (key: string, config: Partial<SongListViewConfig>) => void;
    overlayTemplates: OverlayTemplatesConfig;
    setOverlayTemplates: (config: OverlayTemplatesConfig) => void;
}

type LoadedSettings = {
    separationQuality: 'high' | 'normal' | 'fast';
    language?: SupportedLanguage;
    lyricStyles?: LyricStyleConfig;
    songPreferences?: Record<string, { furigana?: boolean; romaji?: boolean }>;
    hotkeys?: HotkeyConfig;
    songListViews?: SongListViewConfigs;
    overlayTemplates?: OverlayTemplatesConfig;
};

type SettingsLoadResult = {
    settings: LoadedSettings;
    status: 'ok' | 'missing' | 'restored-from-backup' | 'corrupt-defaulted';
    sourcePath: string;
    backupPath?: string;
    quarantinedPath?: string;
    unsafeToAutoPersist: boolean;
};

const UserDataContext = createContext<UserDataContextType | null>(null);

export const UserDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [favorites, setFavorites] = useState<string[]>([]);
    const [history, setHistory] = useState<string[]>([]);
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [language, setLanguageState] = useState<SupportedLanguage>(() => normalizeLanguage(i18n.language));
    const [separationQuality, setSeparationQuality] = useState<'high' | 'normal' | 'fast'>('normal');
    const { currentSongId } = useQueue();
    const isInitialized = useRef(false);
    const loadedSettingsSnapshot = useRef<string | null>(null);
    const unsafeSettingsLoad = useRef(false);

    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [lyricStyles, setLyricStyles] = useState<LyricStyleConfig>(DEFAULT_LYRIC_STYLES);
    const [songPreferences, setSongPreferences] = useState<Record<string, { furigana?: boolean; romaji?: boolean }>>({});
    const [hotkeys, setHotkeys] = useState<HotkeyConfig>(() => mergeHotkeyConfig());
    const [songListViews, setSongListViews] = useState<SongListViewConfigs>({});
    const [overlayTemplates, setOverlayTemplates] = useState<OverlayTemplatesConfig>(() => mergeOverlayTemplatesConfig());

    const createSettingsPayload = useCallback(() => ({
        separationQuality,
        language,
        lyricStyles,
        songPreferences,
        hotkeys,
        songListViews,
        overlayTemplates,
    }), [separationQuality, language, lyricStyles, songPreferences, hotkeys, songListViews, overlayTemplates]);

    // Load data on startup
    useEffect(() => {
        if (isInitialized.current) return;

        const load = async () => {
            try {
                const [favs, hist, pl, settingsResult] = await Promise.all([
                    window.khelper?.userData.loadFavorites() || [],
                    window.khelper?.userData.loadHistory() || [],
                    window.khelper?.userData.loadPlaylists() || [],
                    (window.khelper?.userData.loadSettingsWithMeta
                        ? window.khelper.userData.loadSettingsWithMeta()
                        : (window.khelper?.userData.loadSettings() || Promise.resolve({ separationQuality: 'normal' }))
                            .then((settings: LoadedSettings) => ({
                                settings,
                                status: 'ok',
                                sourcePath: '',
                                unsafeToAutoPersist: false,
                            }))) as Promise<SettingsLoadResult>
                ]);
                const settings = settingsResult.settings;
                setFavorites(Array.from(new Set(favs)));
                setHistory(Array.from(new Set(hist)));
                setPlaylists(pl);
                const nextLanguage = normalizeLanguage(settings.language ?? i18n.language);
                const nextSeparationQuality = (settings.separationQuality as 'high' | 'normal' | 'fast') || 'normal';
                const nextLyricStyles = settings.lyricStyles ? { ...DEFAULT_LYRIC_STYLES, ...settings.lyricStyles } : DEFAULT_LYRIC_STYLES;
                const nextSongPreferences = settings.songPreferences ?? {};
                const nextHotkeys = mergeHotkeyConfig(settings.hotkeys);
                const nextSongListViews = mergeSongListViewConfigs(settings.songListViews);
                const nextOverlayTemplates = mergeOverlayTemplatesConfig(settings.overlayTemplates, settings.lyricStyles);
                loadedSettingsSnapshot.current = JSON.stringify({
                    separationQuality: nextSeparationQuality,
                    language: nextLanguage,
                    lyricStyles: nextLyricStyles,
                    songPreferences: nextSongPreferences,
                    hotkeys: nextHotkeys,
                    songListViews: nextSongListViews,
                    overlayTemplates: nextOverlayTemplates,
                });
                unsafeSettingsLoad.current = settingsResult.unsafeToAutoPersist;
                if (settingsResult.status === 'restored-from-backup') {
                    console.warn('[UserData] Restored settings from backup', {
                        sourcePath: settingsResult.sourcePath,
                        backupPath: settingsResult.backupPath,
                        quarantinedPath: settingsResult.quarantinedPath,
                    });
                } else if (settingsResult.unsafeToAutoPersist) {
                    console.warn('[UserData] Loaded default settings without auto-persist', {
                        status: settingsResult.status,
                        sourcePath: settingsResult.sourcePath,
                        quarantinedPath: settingsResult.quarantinedPath,
                    });
                }
                setLanguageState(nextLanguage);
                if (i18n.language !== nextLanguage) {
                    await i18n.changeLanguage(nextLanguage);
                }
                setSeparationQuality(nextSeparationQuality);
                setLyricStyles(nextLyricStyles);
                setSongPreferences(nextSongPreferences);
                setHotkeys(nextHotkeys);
                setSongListViews(nextSongListViews);
                setOverlayTemplates(nextOverlayTemplates);

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

    // Save settings (quality + in-app lyrics styles + songPrefs + hotkeys + song list views + overlay templates) on change
    useEffect(() => {
        if (!isInitialized.current) return;
        const payload = createSettingsPayload();
        const serializedPayload = JSON.stringify(payload);
        if (loadedSettingsSnapshot.current) {
            if (serializedPayload === loadedSettingsSnapshot.current) {
                loadedSettingsSnapshot.current = null;
                return;
            }
            loadedSettingsSnapshot.current = null;
        }
        if (unsafeSettingsLoad.current) {
            console.warn('[UserData] Persisting first explicit settings change after unsafe settings load');
            unsafeSettingsLoad.current = false;
        }
        window.khelper?.userData.saveSettings(payload).catch(err =>
            console.error('[UserData] Failed to save settings', err)
        );
    }, [createSettingsPayload]);

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

    const setLanguage = useCallback((nextLanguage: SupportedLanguage) => {
        const normalized = normalizeLanguage(nextLanguage);
        setLanguageState(normalized);
        if (i18n.language !== normalized) {
            void i18n.changeLanguage(normalized);
        }
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

    const setSongPreference = useCallback((songId: string, prefs: { furigana?: boolean; romaji?: boolean }) => {
        setSongPreferences(prev => ({
            ...prev,
            [songId]: { ...prev[songId], ...prefs }
        }));
    }, []);

    const setSongListViewConfig = useCallback((key: string, config: Partial<SongListViewConfig>) => {
        setSongListViews(prev => ({
            ...prev,
            [key]: mergeSongListViewConfig({
                ...(prev[key] ?? {}),
                ...config,
                filters: {
                    ...(prev[key]?.filters ?? {}),
                    ...(config.filters ?? {}),
                },
            }),
        }));
    }, []);

    return (
        <UserDataContext.Provider value={{
            favorites,
            history,
            playlists,
            language,
            setLanguage,
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
            setLyricStyles,
            songPreferences,
            setSongPreference,
            hotkeys,
            setHotkeys,
            songListViews,
            setSongListViewConfig,
            overlayTemplates,
            setOverlayTemplates
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
