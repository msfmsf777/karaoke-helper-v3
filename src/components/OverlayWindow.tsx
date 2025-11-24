import React, { useEffect, useState } from 'react';
import LyricsOverlay from './LyricsOverlay';
import { SongMeta, EnrichedLyricLine } from '../../shared/songTypes';
import { EditableLyricLine, linesFromRawText, parseLrc, readRawLyrics, readSyncedLyrics } from '../library/lyrics';
import { LyricStyleConfig, DEFAULT_LYRIC_STYLES } from '../contexts/UserDataContext';

const OverlayWindow: React.FC = () => {
    const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [lines, setLines] = useState<EditableLyricLine[]>([]);
    const [lyricsStatus, setLyricsStatus] = useState<SongMeta['lyrics_status']>('none');
    const [styleConfig, setStyleConfig] = useState<LyricStyleConfig>(DEFAULT_LYRIC_STYLES);

    // Japanese Enrichment
    const [enrichedLines, setEnrichedLines] = useState<EnrichedLyricLine[] | null>(null);
    const [furiganaEnabled, setFuriganaEnabled] = useState(false);
    const [romajiEnabled, setRomajiEnabled] = useState(false);
    const [externalScrollTop, setExternalScrollTop] = useState<number | null>(null);

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

            const removeStyleListener = window.api.subscribeOverlayStyleUpdates((style) => {
                setStyleConfig(style);
            });

            const removePrefListener = window.api.subscribeOverlayPreferenceUpdates((prefs) => {
                setFuriganaEnabled(prefs.furiganaEnabled);
                setRomajiEnabled(prefs.romajiEnabled);
            });

            const removeScrollListener = window.api.subscribeOverlayScrollUpdates((scrollTop) => {
                setExternalScrollTop(scrollTop);
            });

            // Load initial styles
            window.khelper?.userData.loadSettings().then(settings => {
                if (settings.lyricStyles) {
                    setStyleConfig({ ...DEFAULT_LYRIC_STYLES, ...settings.lyricStyles });
                }
            });

            return () => {
                removeListener();
                removeStyleListener();
                removePrefListener();
                removeScrollListener();
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

                    if (payload.type === 'style') {
                        setStyleConfig(payload.style);
                        return;
                    }

                    if (payload.type === 'preference') {
                        setFuriganaEnabled(payload.prefs.furiganaEnabled);
                        setRomajiEnabled(payload.prefs.romajiEnabled);
                        return;
                    }

                    if (payload.type === 'scroll') {
                        setExternalScrollTop(payload.scrollTop);
                        return;
                    }

                    const { songId, currentTime: time } = payload;
                    setCurrentTime(time);
                    if (songId !== currentTrackId) {
                        setCurrentTrackId(songId);
                    }
                } catch (e) {
                    console.error('Failed to parse SSE message', e);
                }
            };

            // Fetch initial styles
            fetch(`${baseUrl}/styles`)
                .then(res => {
                    if (res.ok) return res.json();
                    return null;
                })
                .then(styles => {
                    if (styles) setStyleConfig({ ...DEFAULT_LYRIC_STYLES, ...styles });
                })
                .catch(err => console.error('Failed to fetch styles', err));

            return () => {
                eventSource.close();
            };
        }
    }, [currentTrackId]);

    useEffect(() => {
        if (!currentTrackId) {
            setLines([]);
            setLyricsStatus('none');
            setEnrichedLines(null);
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

                    let parsedLines: EditableLyricLine[] = [];
                    let status: SongMeta['lyrics_status'] = 'none';
                    let rawText = '';

                    if (synced?.content) {
                        parsedLines = parseLrc(synced.content);
                        status = 'synced';
                        rawText = parsedLines.map(l => l.text).join('\n');
                    } else if (raw?.content && raw.content.trim().length > 0) {
                        parsedLines = linesFromRawText(raw.content);
                        status = 'text_only';
                        rawText = raw.content;
                    }

                    setLines(parsedLines);
                    setLyricsStatus(status);

                    // Enrich if Japanese (Electron Mode)
                    // We import isJapanese dynamically or use a simple check?
                    // Since we are in renderer, we can use the util if imported.
                    // But OverlayWindow imports might be limited.
                    // Let's use a simple regex check here to avoid dependencies if possible,
                    // OR rely on the fact that StreamModeView likely cached it.
                    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(rawText);
                    if (hasJapanese && window.khelper.lyrics.enrichLyrics) {
                        window.khelper.lyrics.enrichLyrics(parsedLines.map(l => l.text))
                            .then(enriched => {
                                if (active) setEnrichedLines(enriched);
                            })
                            .catch(e => console.error('[Overlay] Enrichment failed', e));
                    } else {
                        setEnrichedLines(null);
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

                    if (data.enriched) {
                        setEnrichedLines(data.enriched);
                    } else {
                        setEnrichedLines(null);
                    }
                }
            } catch (err) {
                console.error('[Overlay] Failed to load lyrics', err);
                if (active) {
                    setLines([]);
                    setLyricsStatus('none');
                    setEnrichedLines(null);
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
                styleConfig={styleConfig}
                enrichedLines={enrichedLines}
                furiganaEnabled={furiganaEnabled}
                romajiEnabled={romajiEnabled}
                externalScrollTop={externalScrollTop}
            />
        </div>
    );
};

export default OverlayWindow;
