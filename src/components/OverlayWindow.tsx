import React, { useEffect, useState } from 'react';
import LyricsOverlay from './LyricsOverlay';
import { SongMeta } from '../../shared/songTypes';
import { EditableLyricLine, linesFromRawText, parseLrc, readRawLyrics, readSyncedLyrics } from '../library/lyrics';

const OverlayWindow: React.FC = () => {
    const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [lines, setLines] = useState<EditableLyricLine[]>([]);
    const [lyricsStatus, setLyricsStatus] = useState<SongMeta['lyrics_status']>('none');

    useEffect(() => {
        // Listen for updates from the main window via IPC
        const removeListener = window.api.subscribeOverlayUpdates((payload) => {
            const { songId, currentTime: time } = payload;
            setCurrentTime(time);
            if (songId !== currentTrackId) {
                setCurrentTrackId(songId);
            }
        });

        return () => {
            removeListener();
        };
    }, [currentTrackId]);

    useEffect(() => {
        if (!currentTrackId) {
            setLines([]);
            setLyricsStatus('none');
            return;
        }

        let active = true;
        const fetchLyrics = async () => {
            try {
                const [synced, raw] = await Promise.all([
                    readSyncedLyrics(currentTrackId),
                    readRawLyrics(currentTrackId),
                ]);

                if (!active) return;

                if (synced?.content) {
                    setLines(parseLrc(synced.content));
                    setLyricsStatus('synced');
                } else if (raw?.content && raw.content.trim().length > 0) {
                    setLines(linesFromRawText(raw.content));
                    setLyricsStatus('text_only');
                } else {
                    setLines([]);
                    setLyricsStatus('none');
                }
            } catch (err) {
                console.error('[Overlay] Failed to load lyrics', err);
                if (active) {
                    setLines([]);
                    setLyricsStatus('none');
                }
            }
        };

        fetchLyrics();
        return () => {
            active = false;
        };
    }, [currentTrackId]);

    return (
        <div
            style={{
                height: '100vh',
                width: '100vw',
                backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background for readability
                overflow: 'hidden',
                // Make the window drag region usually at the top, but here we might want it everywhere or specific spot?
                // For now, let's just make it transparent and assume the user can resize/move via OS controls if frame is present,
                // or we add a drag region. The requirement said "frameless", so we need a drag region.
            }}
        >
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '32px',
                WebkitAppRegion: 'drag', // Electron drag region
                zIndex: 1000,
                cursor: 'move',
            } as React.CSSProperties} />

            <LyricsOverlay
                status={lyricsStatus}
                lines={lines}
                currentTime={currentTime}
                className="overlay-lyrics-container"
            />
        </div>
    );
};

export default OverlayWindow;
