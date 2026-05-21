import React, { useEffect, useState } from 'react';
import { SongMeta, EnrichedLyricLine } from '../../shared/songTypes';
import { EditableLyricLine, linesFromRawText, parseLrc, readRawLyrics, readSyncedLyrics } from '../library/lyrics';
import { DEFAULT_OVERLAY_DESIGN_ID, findLyricsOverlayDesign, getLyricsOverlayDesignById, LyricsOverlayDesign, OverlayTemplatesConfig } from '../../shared/overlayTemplates';
import { TemplatedLyricsOverlay } from './overlayTemplates/OverlayTemplateRenderers';
import MissingOverlayTemplateNotice from './MissingOverlayTemplateNotice';
import i18n from '../i18n';
import { subscribeOverlayServerUpdates } from '../utils/overlayUpdateTransport';

interface LyricsOverlayUpdatePayload {
    type?: string;
    status?: 'ok' | 'missing';
    language?: string;
    overlayTemplates?: OverlayTemplatesConfig;
    kind?: 'lyrics' | 'setlist';
    requestedDesignId?: string;
    designId?: string;
    design?: LyricsOverlayDesign;
    prefs?: {
        furiganaEnabled: boolean;
        romajiEnabled: boolean;
    };
    songId?: string;
    currentTime?: number;
}

const OverlayWindow: React.FC = () => {
    const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [lines, setLines] = useState<EditableLyricLine[]>([]);
    const [lyricsStatus, setLyricsStatus] = useState<SongMeta['lyrics_status']>('none');
    const [design, setDesign] = useState<LyricsOverlayDesign | null>(null);

    // Japanese Enrichment
    const [enrichedLines, setEnrichedLines] = useState<EnrichedLyricLine[] | null>(null);
    const [furiganaEnabled, setFuriganaEnabled] = useState(false);
    const [romajiEnabled, setRomajiEnabled] = useState(false);
    const [missingDesignId, setMissingDesignId] = useState<string | null>(null);
    const designId = new URLSearchParams(window.location.search).get('design');
    const baseUrl = window.location.port === '5173' ? 'http://localhost:10001' : '';

    useEffect(() => {
        const loadConfig = async () => {
            try {
                const response = await fetch(`${baseUrl}/overlay-config?kind=lyrics${designId ? `&design=${encodeURIComponent(designId)}` : ''}`);
                if (!response.ok) throw new Error('Failed to fetch overlay config');
                const payload = await response.json();
                if (payload.language) void i18n.changeLanguage(payload.language);
                if (payload.status === 'missing') {
                    setMissingDesignId(payload.requestedDesignId ?? designId);
                    setDesign(null);
                    return;
                }
                setMissingDesignId(null);
                setDesign(payload.design);
            } catch (err) {
                console.error('[Overlay] Failed to load template config', err);
            }
        };
        loadConfig();
    }, [baseUrl, designId]);

    useEffect(() => {
        // Check if we are in Electron or Browser
        // In Electron, window.api is defined.
        const isElectron = !!window.api;

        if (isElectron) {
            // Listen for updates from the main window via IPC
            const removeListener = window.api.subscribeOverlayUpdates((payload) => {
                if (payload.type === 'overlay-template-config') {
                    if (payload.language) void i18n.changeLanguage(payload.language);
                    if (payload.overlayTemplates) {
                        if (designId) {
                            const nextDesign = getLyricsOverlayDesignById(payload.overlayTemplates, designId);
                            setMissingDesignId(nextDesign ? null : designId);
                            setDesign(nextDesign ?? null);
                        } else {
                            setMissingDesignId(null);
                            setDesign(findLyricsOverlayDesign(payload.overlayTemplates, DEFAULT_OVERLAY_DESIGN_ID));
                        }
                    } else if (payload.status === 'missing' && payload.kind === 'lyrics' && payload.requestedDesignId === designId) {
                        setMissingDesignId(payload.requestedDesignId);
                        setDesign(null);
                    } else if (payload.kind === 'lyrics' && (!payload.designId || payload.designId === designId)) {
                        setMissingDesignId(null);
                        setDesign(payload.design);
                    }
                    return;
                }
                if (payload.type === 'setlist') return;
                const { songId, currentTime: time } = payload;
                if (typeof time === 'number') setCurrentTime(time);
                if (songId !== currentTrackId) {
                    setCurrentTrackId(songId || null);
                }
            });

            const removePrefListener = window.api.subscribeOverlayPreferenceUpdates((prefs) => {
                setFuriganaEnabled(prefs.furiganaEnabled);
                setRomajiEnabled(prefs.romajiEnabled);
            });

            return () => {
                removeListener();
                removePrefListener();
            };
        }

        return subscribeOverlayServerUpdates<LyricsOverlayUpdatePayload>(baseUrl, (payload) => {
            if (payload.type === 'preference' && payload.prefs) {
                setFuriganaEnabled(payload.prefs.furiganaEnabled);
                setRomajiEnabled(payload.prefs.romajiEnabled);
                return;
            }

            if (payload.type === 'overlay-template-config') {
                if (payload.language) void i18n.changeLanguage(payload.language);
                if (payload.overlayTemplates) {
                    if (designId) {
                        const nextDesign = getLyricsOverlayDesignById(payload.overlayTemplates, designId);
                        setMissingDesignId(nextDesign ? null : designId);
                        setDesign(nextDesign ?? null);
                    } else {
                        setMissingDesignId(null);
                        setDesign(findLyricsOverlayDesign(payload.overlayTemplates, DEFAULT_OVERLAY_DESIGN_ID));
                    }
                } else if (payload.status === 'missing' && payload.kind === 'lyrics' && payload.requestedDesignId === designId) {
                    setMissingDesignId(payload.requestedDesignId);
                    setDesign(null);
                } else if (payload.kind === 'lyrics' && (!payload.designId || payload.designId === designId)) {
                    setMissingDesignId(null);
                    setDesign(payload.design ?? null);
                }
                return;
            }

            if (payload.type === 'setlist') return;

            const { songId, currentTime: time } = payload;
            if (typeof time === 'number') setCurrentTime(time);
            if (songId !== currentTrackId) {
                setCurrentTrackId(songId || null);
            }
        });
    }, [currentTrackId, baseUrl, designId]);

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

            {missingDesignId ? (
                <MissingOverlayTemplateNotice requestedDesignId={missingDesignId} />
            ) : design && (
                <TemplatedLyricsOverlay
                    design={design}
                    status={lyricsStatus}
                    lines={lines}
                    currentTime={currentTime}
                    enrichedLines={enrichedLines}
                    furiganaEnabled={furiganaEnabled}
                    romajiEnabled={romajiEnabled}
                />
            )}
        </div>
    );
};

export default OverlayWindow;
