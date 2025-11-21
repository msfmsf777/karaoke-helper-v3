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
        // In Electron, window.api is defined.
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
            // If running on port 5173 (Vite Dev), connect to port 10001
            const baseUrl = window.location.port === '5173' ? 'http://localhost:10001' : '';
            const eventSource = new EventSource(`${baseUrl}/events`);

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
                    // Browser Mode
                    const baseUrl = window.location.port === '5173' ? 'http://localhost:10001' : '';
                    const response = await fetch(`${baseUrl}/lyrics?id=${currentTrackId}`);
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
                backgroundColor: 'transparent', // Transparent background
                overflow: 'hidden',
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
