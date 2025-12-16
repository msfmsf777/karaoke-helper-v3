import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import audioEngine from '../audio/AudioEngine';
import { getSeparatedSongPaths } from '../library/songLibrary';
import { useLibrary } from './LibraryContext';

interface QueueContextType {
    queue: string[];
    currentIndex: number;
    currentSongId: string | null;
    playbackMode: PlaybackMode;
    isStreamWaiting: boolean;
    setPlaybackMode: (mode: PlaybackMode) => void;
    playSong: (songId: string) => Promise<void>;
    addToQueue: (songId: string) => void;
    playNext: (auto?: boolean) => void;
    playPrev: () => void;
    playQueueIndex: (index: number) => void;
    removeFromQueue: (index: number) => void;
    moveQueueItem: (fromIndex: number, toIndex: number) => void;
    playSongList: (songIds: string[]) => void;
    playImmediate: (songId: string) => void;
    loadImmediate: (songId: string) => void;
    clearQueue: () => void;
    replaceQueue: (songIds: string[]) => void;
    resetStream: () => void;
    togglePlayPause: () => void;
}

export type PlaybackMode = 'normal' | 'repeat_one' | 'random' | 'stream';

const QueueContext = createContext<QueueContextType | null>(null);

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [queue, setQueue] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState<number>(-1);
    const [, setHistoryStack] = useState<number[]>([]);
    const [isStreamWaiting, setIsStreamWaiting] = useState(false);
    const { getSongById, loading: libraryLoading } = useLibrary();
    const isInitialized = useRef(false);
    const shouldAutoPlay = useRef(true);
    const shouldEnterStreamWait = useRef(false);

    const [playbackModeState, setPlaybackModeState] = useState<PlaybackMode>(() => {
        try {
            return (localStorage.getItem('khelper_playback_mode') as PlaybackMode) || 'normal';
        } catch {
            return 'normal';
        }
    });

    // Custom setter for mode to handle side effects
    const setPlaybackMode = useCallback((mode: PlaybackMode) => {
        setPlaybackModeState(prevMode => {
            if (prevMode === 'stream' && mode !== 'stream' && isStreamWaiting) {
                // Leaving Stream Mode while waiting -> Load the song but don't play
                setIsStreamWaiting(false);
                shouldAutoPlay.current = false;
            }
            return mode;
        });
    }, [isStreamWaiting]);

    // Derived value for context
    const playbackMode = playbackModeState;

    // Load queue from disk on startup
    useEffect(() => {
        if (isInitialized.current || libraryLoading) return;

        const load = async () => {
            try {
                const saved = await window.khelper?.queue.load();
                if (saved) {
                    setQueue(saved.songIds);
                    setCurrentIndex(-1); // Always unload on startup as requested

                    console.log('[QueueContext] Restored queue', saved.songIds.length, 'Current index reset to -1');
                }
            } catch (err) {
                console.error('[QueueContext] Failed to load queue', err);
            } finally {
                isInitialized.current = true;
            }
        };
        load();
    }, [libraryLoading, getSongById]);

    // Persist playback mode
    useEffect(() => {
        localStorage.setItem('khelper_playback_mode', playbackMode);
    }, [playbackMode]);

    // Save queue to disk on change
    useEffect(() => {
        if (!isInitialized.current) return;

        const save = async () => {
            try {
                await window.khelper?.queue.save({ songIds: queue, currentIndex });
            } catch (err) {
                console.error('[QueueContext] Failed to save queue', err);
            }
        };
        save();
    }, [queue, currentIndex]);

    const playSongInternal = async (songId: string, autoPlay = true) => {
        setIsStreamWaiting(false); // Reset waiting state explicitly
        console.debug('[QueueContext] playSongInternal', songId);
        const song = getSongById(songId);
        if (!song) {
            console.warn('[QueueContext] Song not found in library', songId);
            return;
        }

        try {
            const paths = await getSeparatedSongPaths(songId);

            if (!paths.instrumental) {
                throw new Error('File path not found');
            }
            // paths.instrumental = Instrumental Stem (if sep) OR Original (if not)
            // paths.vocal = Vocal Stem (if sep) OR null (if not)

            // If vocal is null, AudioEngine will play silence for vocal channel.
            // Since instrumental is Original in that case, we get:
            // Stream: Original (Instr Vol)
            // Headphone: Original (Instr Vol) + Silence (Vocal Vol) -> Original

            await audioEngine.loadFile(paths);

            // Apply saved playback transform or defaults
            const transform = {
                speed: Number(song.playback?.speed ?? 1.0),
                transpose: Number(song.playback?.transpose ?? 0)
            };
            audioEngine.setPlaybackTransform(transform);

            // Force seek to 0 to ensure SoundTouch filter is cleared/primed with new settings
            // This fixes the desync issue on start
            audioEngine.seek(0);

            // Wait for seek/clear to propagate and stabilize
            await new Promise(resolve => setTimeout(resolve, 100));

            if (autoPlay) {
                await audioEngine.play();
            }
        } catch (err) {
            console.error('[QueueContext] Failed to play song', songId, err);
        }
    };

    const playSong = useCallback(async (songId: string) => {
        setQueue((prev) => {
            const existingIndex = prev.indexOf(songId);
            if (existingIndex !== -1) {
                setCurrentIndex(existingIndex);
                return prev;
            } else {
                const newQueue = [...prev, songId];
                setCurrentIndex(newQueue.length - 1);
                return newQueue;
            }
        });
    }, []);

    // React to currentIndex changes to trigger playback
    // We use a ref to track the last played index/song to avoid double plays or loops if not intended
    const lastPlayedIndex = useRef<number>(-1);
    const lastPlayedSongId = useRef<string | null>(null);

    useEffect(() => {
        // Guard: Transitioning to Stream Wait
        // Prioritize this ref check over isStreamWaiting state to prevent race conditions
        if (shouldEnterStreamWait.current) {
            shouldEnterStreamWait.current = false;
            if (!isStreamWaiting) setIsStreamWaiting(true); // Ensure state catches up
            // Update references so we don't trigger playback later
            // logic removed to fix resumption issue
            audioEngine.stop();
            return;
        }

        if (isStreamWaiting) {
            // If waiting, ensure player is stopped
            audioEngine.stop();
            return;
        }

        if (currentIndex >= 0 && currentIndex < queue.length) {
            const songId = queue[currentIndex];
            // Play if index changed OR song ID changed (e.g. replaced song at same index)
            if (currentIndex !== lastPlayedIndex.current || songId !== lastPlayedSongId.current) {
                playSongInternal(songId, shouldAutoPlay.current);
                lastPlayedIndex.current = currentIndex;
                lastPlayedSongId.current = songId;
                // Reset auto-play to true for subsequent normal interactions
                shouldAutoPlay.current = true;
            }
        }
    }, [currentIndex, queue, getSongById, isStreamWaiting]);

    const addToQueue = useCallback((songId: string) => {
        // Use current state to calculate new state
        const currentSongId = queue[currentIndex];

        // Remove existing instance if any
        const newQueue = queue.filter(id => id !== songId);
        // Append to end
        newQueue.push(songId);

        setQueue(newQueue);

        // Update currentIndex if current song moved
        if (currentSongId) {
            const newIndex = newQueue.indexOf(currentSongId);
            if (newIndex !== -1 && newIndex !== currentIndex) {
                setCurrentIndex(newIndex);
            }
        }
    }, [queue, currentIndex]);



    const playNext = useCallback((auto: boolean = false) => {
        // Handle Repeat One Auto explicitly: Simply replay
        if (playbackMode === 'repeat_one' && auto) {
            audioEngine.seek(0);
            audioEngine.play();
            return;
        }

        // Manual Next in Stream Mode (Resume)
        if (playbackMode === 'stream' && !auto && isStreamWaiting) {
            setIsStreamWaiting(false);
            return;
        }

        setCurrentIndex(prev => {
            // Mode Logic
            if (playbackMode === 'repeat_one') {
                return (prev < queue.length - 1) ? prev + 1 : prev;
            }

            if (playbackMode === 'random') {
                if (queue.length === 0) return prev;
                if (prev >= 0) setHistoryStack(h => [...h, prev]);

                // Ensure unique next index
                let nextIndex = prev;
                let attempts = 0;
                while (nextIndex === prev && attempts < 5 && queue.length > 1) {
                    nextIndex = Math.floor(Math.random() * queue.length);
                    attempts++;
                }

                if (nextIndex === prev) {
                    // Force replay if same index (queue length 1 or collision)
                    audioEngine.seek(0);
                    audioEngine.play();
                    // Return prev so currentIndex doesn't change -> Effect won't double play
                    return prev;
                }
                return nextIndex;
            }

            if (playbackMode === 'stream') {
                // Determine next index first
                const nextIndex = prev < queue.length ? prev + 1 : prev;

                // Signal wait transition
                shouldEnterStreamWait.current = true;

                return nextIndex;
            }

            // Normal
            return (prev < queue.length - 1) ? prev + 1 : prev;
        });

        if (playbackMode === 'stream') {
            setIsStreamWaiting(true);
        }

    }, [queue.length, playbackMode, isStreamWaiting]);

    const playPrev = useCallback(() => {
        if (playbackMode === 'random') {
            setHistoryStack(h => {
                if (h.length === 0) return h;
                const prev = h[h.length - 1];
                setCurrentIndex(prev);
                return h.slice(0, -1);
            });
            // Also reset waiting if moving back?
            setIsStreamWaiting(false);
            return;
        }

        setCurrentIndex((prev) => {
            if (prev > 0) {
                return prev - 1;
            }
            return prev;
        });
        setIsStreamWaiting(false);
    }, [playbackMode]);

    const playQueueIndex = useCallback((index: number) => {
        if (index >= 0 && index < queue.length) {
            setCurrentIndex(index);
        }
    }, [queue.length]);

    const removeFromQueue = useCallback((index: number) => {
        setQueue((prev) => {
            const newQueue = [...prev];
            newQueue.splice(index, 1);
            return newQueue;
        });
        setCurrentIndex((prev) => {
            if (index < prev) {
                return prev - 1;
            } else if (index === prev) {
                if (prev >= queue.length - 1) {
                    return prev - 1;
                }
                return prev;
            }
            return prev;
        });
    }, [queue.length]);

    const moveQueueItem = useCallback((fromIndex: number, toIndex: number) => {
        if (fromIndex < 0 || fromIndex >= queue.length || toIndex < 0 || toIndex >= queue.length) return;

        setQueue((prev) => {
            const newQueue = [...prev];
            const [movedItem] = newQueue.splice(fromIndex, 1);
            newQueue.splice(toIndex, 0, movedItem);
            return newQueue;
        });

        setCurrentIndex((prev) => {
            // In Stream Waiting mode, we want currentIndex to represent the "Next Slot"
            // So we generally stay on the "Slot" unless the slot itself shifts due to insertions/deletions before it.
            if (isStreamWaiting) {
                let adjustment = 0;
                if (fromIndex < prev) adjustment -= 1;
                if (toIndex < prev) adjustment += 1;
                return prev + adjustment;
            }

            if (prev === fromIndex) return toIndex;
            if (fromIndex < prev && toIndex >= prev) return prev - 1;
            if (fromIndex > prev && toIndex <= prev) return prev + 1;
            return prev;
        });
    }, [queue.length, isStreamWaiting]);

    const playSongList = useCallback((songIds: string[]) => {
        if (songIds.length === 0) return;

        const uniqueNewIds = Array.from(new Set(songIds));

        // Filter existing from current queue
        const filteredQueue = queue.filter(id => !uniqueNewIds.includes(id));
        const newQueue = [...filteredQueue, ...uniqueNewIds];

        setQueue(newQueue);

        // Jump to the first of the new songs
        const firstNewId = uniqueNewIds[0];
        const newIndex = newQueue.indexOf(firstNewId);
        setCurrentIndex(newIndex);
    }, [queue]);

    const playImmediate = useCallback(async (songId: string) => {
        // Stop any currently playing song first
        await audioEngine.stop();

        // We need to access the current state to make decisions.
        // Since we are inside a callback, we can't easily get the fresh state without adding it to deps.
        // But adding 'queue' to deps is fine.

        const existingIndex = queue.indexOf(songId);

        if (existingIndex !== -1) {
            if (existingIndex === currentIndex) {
                // If it's the same song, force replay manually because state won't change
                playSongInternal(songId);
                // Ensure we don't double play if state somehow updates later
                lastPlayedIndex.current = existingIndex;
                lastPlayedSongId.current = songId;
            } else {
                // Different song in queue, jump to it. Effect will handle playback.
                setCurrentIndex(existingIndex);
            }
        } else {
            // New song, insert at front and play. Effect will handle playback.
            setQueue((prev) => [songId, ...prev]);
            setCurrentIndex(0);
        }
    }, [queue, currentIndex]);

    const loadImmediate = useCallback(async (songId: string) => {
        // Stop any currently playing song first
        await audioEngine.stop();

        // Set flag to skip auto-play in the effect
        shouldAutoPlay.current = false;

        // Reuse playImmediate logic to handle queue updates
        // We can't call playImmediate directly because it's a dependency of this callback
        // So we duplicate the queue logic here.

        // Note: We need to access the current state to make decisions.
        // Since we are inside a callback, we can't easily get the fresh state without adding it to deps.
        // But adding 'queue' to deps is fine.

        const existingIndex = queue.indexOf(songId);

        if (existingIndex !== -1) {
            if (existingIndex === currentIndex) {
                // If it's the same song, force load manually because state won't change
                playSongInternal(songId, false);
                // Ensure we don't double play if state somehow updates later
                lastPlayedIndex.current = existingIndex;
                lastPlayedSongId.current = songId;
                shouldAutoPlay.current = true; // Reset
            } else {
                // Different song in queue, jump to it. Effect will handle loading (and skip play).
                setCurrentIndex(existingIndex);
            }
        } else {
            // New song, insert at front and load. Effect will handle loading (and skip play).
            setQueue((prev) => [songId, ...prev]);
            setCurrentIndex(0);
        }
    }, [queue, currentIndex]);

    const clearQueue = useCallback(() => {
        setQueue([]);
        setCurrentIndex(-1);
        audioEngine.stop();
    }, []);

    const replaceQueue = useCallback((songIds: string[]) => {
        if (songIds.length === 0) return;
        const uniqueIds = Array.from(new Set(songIds));
        setQueue(uniqueIds);
        setCurrentIndex(0);
        // The useEffect [currentIndex, queue] will handle the playback trigger
        // because queue changed (so songId at index 0 likely changed)
    }, []);

    const resetStream = useCallback(() => {
        // Reset to first song but in waiting state
        shouldEnterStreamWait.current = true;
        setCurrentIndex(0);
        if (playbackMode === 'stream') {
            setIsStreamWaiting(true);
        } else {
            audioEngine.stop();
        }
    }, [playbackMode]);

    const togglePlayPause = useCallback(() => {
        if (audioEngine.isPlaying()) {
            audioEngine.pause();
        } else {
            audioEngine.play();
        }
    }, []);

    return (
        <QueueContext.Provider
            value={{
                queue,
                currentIndex,
                currentSongId: isStreamWaiting ? null : (queue[currentIndex] || null),
                playbackMode,
                isStreamWaiting,
                setPlaybackMode,
                playSong,
                addToQueue,
                playNext,
                playPrev,
                playQueueIndex,
                removeFromQueue,
                moveQueueItem,
                playSongList,
                playImmediate,
                loadImmediate,
                clearQueue,
                replaceQueue,
                resetStream,
                togglePlayPause,
            }}
        >
            {children}
        </QueueContext.Provider>
    );
};

export const useQueue = () => {
    const context = useContext(QueueContext);
    if (!context) {
        throw new Error('useQueue must be used within a QueueProvider');
    }
    return context;
};
