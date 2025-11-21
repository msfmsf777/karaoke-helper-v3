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
    clearQueue: () => void;
}

const QueueContext = createContext<QueueContextType | null>(null);

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [queue, setQueue] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState<number>(-1);
    const { getSongById } = useLibrary();
    const isInitialized = useRef(false);

    // Load queue from disk on startup
    useEffect(() => {
        if (isInitialized.current) return;

        const load = async () => {
            try {
                const saved = await window.khelper?.queue.load();
                if (saved) {
                    setQueue(saved.songIds);
                    setCurrentIndex(saved.currentIndex);
                    console.log('[QueueContext] Restored queue', saved.songIds.length, saved.currentIndex);
                }
            } catch (err) {
                console.error('[QueueContext] Failed to load queue', err);
            } finally {
                isInitialized.current = true;
            }
        };
        load();
    }, []);

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
    // We use a ref to track the last played index to avoid double plays or loops if not intended
    const lastPlayedIndex = useRef<number>(-1);

    useEffect(() => {
        if (currentIndex >= 0 && currentIndex < queue.length) {
            const songId = queue[currentIndex];
            // Only play if the index actually changed or if it's a forced replay (logic can be refined)
            if (currentIndex !== lastPlayedIndex.current) {
                playSongInternal(songId);
                lastPlayedIndex.current = currentIndex;
            }
        }
    }, [currentIndex, queue, getSongById]); // Dependencies need care to avoid loops

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
