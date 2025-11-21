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
        // Check if we are in Electron or Browser
        // In Electron, window.api is defined. In Browser, it might not be, or we check userAgent.
        const isElectron = !!window.api;

        if (isElectron) {
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
        } else {
            // Browser / OBS Mode: Use SSE
            const eventSource = new EventSource('/events');

            eventSource.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data);
                    if (payload.type === 'connected') return;

                    const { songId, currentTime: time } = payload;
                    setCurrentTime(time);
                    if (songId !== currentTrackId) {
                        setCurrentTrackId(songId);
                    }
                } catch (e) {
                    console.error('Failed to parse SSE message', e);
                }
            };

            return () => {
                eventSource.close();
            };
        }
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
                // Check if we are in Electron
                if (window.khelper) {
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
                } else {
                    // Browser Mode: We can't use IPC to read files.
                    // However, since the main process is serving the overlay, we could potentially expose lyrics via HTTP.
                    // BUT, for simplicity in this phase, we might rely on the fact that we don't have an easy way to fetch lyrics via HTTP yet without adding more endpoints.
                    // WAIT: The implementation plan didn't specify adding HTTP endpoints for lyrics content.
                    // Let's add a simple fetch to the main process via a new endpoint or just assume we need to add it.
                    // Actually, let's add a simple endpoint in main.ts to serve lyrics content, or pass lyrics content in the SSE update?
                    // Passing content in SSE is heavy. Better to fetch.
                    // Let's try to fetch from a new endpoint `/lyrics?id=...`

                    const response = await fetch(`/lyrics?id=${currentTrackId}`);
                    if (!response.ok) throw new Error('Failed to fetch lyrics');
                    const data = await response.json();

                    if (!active) return;

                    if (data.synced) {
                        setLines(parseLrc(data.synced));
                        setLyricsStatus('synced');
                    } else if (data.raw) {
                        setLines(linesFromRawText(data.raw));
                        setLyricsStatus('text_only');
                    } else {
                        setLines([]);
                        setLyricsStatus('none');
                    }
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
