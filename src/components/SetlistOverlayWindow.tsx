import React, { useEffect, useMemo, useState } from 'react';
import { DEFAULT_OVERLAY_DESIGN_ID, findSetlistOverlayDesign, OverlayPlaybackMode, SetlistOverlayDesign } from '../../shared/overlayTemplates';
import {
    OverlaySongMetadata,
    OverlaySetlistState,
    TemplatedSetlistOverlay,
} from './overlayTemplates/OverlayTemplateRenderers';

const SetlistOverlayWindow: React.FC = () => {
    const [queue, setQueue] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState<number>(-1);
    const [songs, setSongs] = useState<Record<string, OverlaySongMetadata>>({});
    const [isStreamWaiting, setIsStreamWaiting] = useState(false);
    const [playbackMode, setPlaybackMode] = useState<OverlayPlaybackMode>('normal');
    const [design, setDesign] = useState<SetlistOverlayDesign | null>(null);

    const isElectron = !!window.api;
    const baseUrl = window.location.port === '5173' ? 'http://localhost:10001' : '';
    const designId = new URLSearchParams(window.location.search).get('design');

    useEffect(() => {
        const loadConfig = async () => {
            try {
                const response = await fetch(`${baseUrl}/overlay-config?kind=setlist${designId ? `&design=${encodeURIComponent(designId)}` : ''}`);
                if (!response.ok) throw new Error('Failed to fetch overlay config');
                const payload = await response.json();
                setDesign(payload.design);
            } catch (err) {
                console.error('[SetlistOverlay] Failed to load template config', err);
            }
        };
        loadConfig();
    }, [baseUrl, designId]);

    useEffect(() => {
        const handleUpdate = (payload: any) => {
            if (payload.type === 'overlay-template-config') {
                if (payload.overlayTemplates) {
                    setDesign(findSetlistOverlayDesign(payload.overlayTemplates, designId ?? DEFAULT_OVERLAY_DESIGN_ID));
                } else if (payload.kind === 'setlist' && (!payload.designId || payload.designId === designId)) {
                    setDesign(payload.design);
                }
                return;
            }

            if (payload.type && payload.type !== 'setlist') return;
            if (payload.queue) setQueue(payload.queue);
            if (typeof payload.currentIndex === 'number') setCurrentIndex(payload.currentIndex);
            if (typeof payload.isStreamWaiting === 'boolean') setIsStreamWaiting(payload.isStreamWaiting);
            if (payload.playbackMode) setPlaybackMode(payload.playbackMode);
        };

        if (isElectron) {
            const removeListener = window.api.subscribeOverlayUpdates(handleUpdate);
            return () => removeListener();
        }

        const eventSource = new EventSource(`${baseUrl}/events`);
        eventSource.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.type === 'connected') return;
                handleUpdate(payload);
            } catch (e) {
                console.error('SSE Error', e);
            }
        };
        return () => eventSource.close();
    }, [isElectron, baseUrl, designId]);

    useEffect(() => {
        const missingIds = queue.filter(id => !songs[id]);
        if (missingIds.length === 0) return;

        const fetchMeta = async () => {
            try {
                const endpoint = `${baseUrl}/batch-metadata`;
                const res = await fetch(endpoint, {
                    method: 'POST',
                    body: JSON.stringify({ ids: missingIds }),
                    headers: { 'Content-Type': 'application/json' }
                });
                if (res.ok) {
                    const data: (OverlaySongMetadata | null)[] = await res.json();
                    setSongs(prev => {
                        const next = { ...prev };
                        data.forEach(s => {
                            if (s) next[s.id] = {
                                ...s,
                                thumbnailUrl: s.thumbnailUrl?.startsWith('/')
                                    ? `${baseUrl}${s.thumbnailUrl}`
                                    : s.thumbnailUrl,
                            };
                        });
                        return next;
                    });
                }
            } catch (e) {
                console.error('Failed to fetch metadata', e);
            }
        };

        fetchMeta();
    }, [queue, songs, baseUrl]);

    const state = useMemo<OverlaySetlistState>(() => ({
        queue,
        currentIndex,
        songs,
        isStreamWaiting,
        playbackMode,
    }), [queue, currentIndex, songs, isStreamWaiting, playbackMode]);

    return (
        <div style={{ height: '100vh', width: '100vw', background: 'transparent', overflow: 'hidden' }}>
            {design && <TemplatedSetlistOverlay design={design} state={state} />}
        </div>
    );
};

export default SetlistOverlayWindow;
