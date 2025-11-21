import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import audioEngine from '../audio/AudioEngine';
import { getSongFilePath } from '../library/songLibrary';
import { useLibrary } from './LibraryContext';

interface QueueContextType {
    queue: string[];
    currentIndex: number;
    currentSongId: string | null;
    playSong: (songId: string) => Promise<void>;
    addToQueue: (songId: string) => void;
    playNext: () => void;
    playPrev: () => void;
    playQueueIndex: (index: number) => void;
    removeFromQueue: (index: number) => void;
    moveQueueItem: (fromIndex: number, toIndex: number) => void;
    playSongList: (songIds: string[]) => void;
    playImmediate: (songId: string) => void;
    clearQueue: () => void;
}

const QueueContext = createContext<QueueContextType | null>(null);

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [queue, setQueue] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState<number>(-1);
    const { getSongById, loading: libraryLoading } = useLibrary();
    const isInitialized = useRef(false);

    // Load queue from disk on startup
    useEffect(() => {
        if (isInitialized.current || libraryLoading) return;

        const load = async () => {
            try {
                const saved = await window.khelper?.queue.load();
                if (saved) {
                    setQueue(saved.songIds);
                    setCurrentIndex(saved.currentIndex);

                    // Prevent autoplay on startup by syncing lastPlayedIndex with saved index
                    lastPlayedIndex.current = saved.currentIndex;

                    // Load the current song into audio engine so it's ready to play
                    if (saved.currentIndex >= 0 && saved.currentIndex < saved.songIds.length) {
                        const songId = saved.songIds[saved.currentIndex];
                        lastPlayedSongId.current = songId; // Sync song ID too

                        const song = getSongById(songId);
                        if (song) {
                            try {
                                const filePath = await getSongFilePath(songId);
                                if (filePath) {
                                    await audioEngine.loadFile(filePath);
                                }
                            } catch (e) {
                                console.warn('[QueueContext] Failed to preload song on startup', songId, e);
                            }
                        }
                    }

                    console.log('[QueueContext] Restored queue', saved.songIds.length, saved.currentIndex);
                }
            } catch (err) {
                console.error('[QueueContext] Failed to load queue', err);
            } finally {
                isInitialized.current = true;
            }
        };
        load();
    }, [libraryLoading, getSongById]);

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

    const playSongInternal = async (songId: string) => {
        const song = getSongById(songId);
        if (!song) {
            console.warn('[QueueContext] Song not found in library', songId);
            return;
        }

        try {
            const filePath = await getSongFilePath(songId);
            if (!filePath) {
                throw new Error('File path not found');
            }
            await audioEngine.loadFile(filePath);
            await audioEngine.play();
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
        if (currentIndex >= 0 && currentIndex < queue.length) {
            const songId = queue[currentIndex];
            // Play if index changed OR song ID changed (e.g. replaced song at same index)
            if (currentIndex !== lastPlayedIndex.current || songId !== lastPlayedSongId.current) {
                playSongInternal(songId);
                lastPlayedIndex.current = currentIndex;
                lastPlayedSongId.current = songId;
            }
        }
    }, [currentIndex, queue, getSongById]);

    const addToQueue = useCallback((songId: string) => {
        setQueue((prev) => [...prev, songId]);
    }, []);

    const playNext = useCallback(() => {
        setCurrentIndex((prev) => {
            if (prev < queue.length - 1) {
                return prev + 1;
            }
            return prev; // No loop for now
        });
    }, [queue.length]);

    const playPrev = useCallback(() => {
        setCurrentIndex((prev) => {
            if (prev > 0) {
                return prev - 1;
            }
            return prev;
        });
    }, []);

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
                // If removing current song, what to do?
                // Option 1: Move to next (keep index same, but check bounds)
                // Option 2: Stop (set to -1)
                // Let's go with Option 1: Keep index same unless it was the last one
                if (prev >= queue.length - 1) { // queue.length is old length
                    return prev - 1; // Move back if we removed the last one
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
            if (prev === fromIndex) return toIndex;
            if (prev === toIndex) return prev + (fromIndex > toIndex ? 1 : -1); // This logic is tricky
            // Let's simplify: if current was between from and to, it shifts
            if (fromIndex < prev && toIndex >= prev) return prev - 1;
            if (fromIndex > prev && toIndex <= prev) return prev + 1;
            return prev;
        });
    }, [queue.length]);

    const playSongList = useCallback((songIds: string[]) => {
        if (songIds.length === 0) return;
        setQueue((prev) => {
            const startIndex = prev.length;
            setCurrentIndex(startIndex);
            return [...prev, ...songIds];
        });
    }, []);

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

    const clearQueue = useCallback(() => {
        setQueue([]);
        setCurrentIndex(-1);
        audioEngine.stop();
    }, []);

    return (
        <QueueContext.Provider
            value={{
                queue,
                currentIndex,
                currentSongId: queue[currentIndex] || null,
                playSong,
                addToQueue,
                playNext,
                playPrev,
                playQueueIndex,
                removeFromQueue,
                moveQueueItem,
                playSongList,
                playImmediate,
                clearQueue,
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
