
import React, { useEffect, useState, useRef } from 'react';

interface SongMetadata {
    id: string;
    title: string;
    artist?: string;
}

const SetlistOverlayWindow: React.FC = () => {
    const [queue, setQueue] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState<number>(-1);
    const [songs, setSongs] = useState<Record<string, SongMetadata>>({});
    const [isStreamWaiting, setIsStreamWaiting] = useState(false);

    // Refs for adaptive scrolling
    const upNextListRef = useRef<HTMLDivElement>(null);
    const upNextContainerRef = useRef<HTMLDivElement>(null);
    const [upNextScrollDistance, setUpNextScrollDistance] = useState(0);

    // Environment detection
    const isElectron = !!window.api;
    const baseUrl = !isElectron && window.location.port === '5173' ? 'http://localhost:10001' : '';

    useEffect(() => {
        const handleUpdate = (payload: any) => {
            // payload: { songId, currentTime, isPlaying, queue, currentIndex, isStreamWaiting }
            if (payload.queue) setQueue(payload.queue);
            if (typeof payload.currentIndex === 'number') setCurrentIndex(payload.currentIndex);
            if (typeof payload.isStreamWaiting === 'boolean') setIsStreamWaiting(payload.isStreamWaiting);
        };

        if (isElectron) {
            const removeListener = window.api.subscribeOverlayUpdates(handleUpdate);
            return () => removeListener();
        } else {
            const eventSource = new EventSource(`${baseUrl}/events`);
            eventSource.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data);
                    if (payload.type === 'connected') return;
                    if (payload.queue) handleUpdate(payload);
                } catch (e) {
                    console.error('SSE Error', e);
                }
            };
            return () => eventSource.close();
        }
    }, [isElectron, baseUrl]);

    // Fetch Metadata
    useEffect(() => {
        const missingIds = queue.filter(id => !songs[id]);
        if (missingIds.length === 0) return;

        const fetchMeta = async () => {
            try {
                const endpoint = isElectron ? 'http://localhost:10001/batch-metadata' : `${baseUrl}/batch-metadata`;
                const res = await fetch(endpoint, {
                    method: 'POST',
                    body: JSON.stringify({ ids: missingIds }),
                    headers: { 'Content-Type': 'application/json' }
                });
                if (res.ok) {
                    const data: SongMetadata[] = await res.json();
                    setSongs(prev => {
                        const next = { ...prev };
                        data.forEach(s => {
                            if (s) next[s.id] = s;
                        });
                        return next;
                    });
                }
            } catch (e) {
                console.error('Failed to fetch metadata', e);
            }
        };

        fetchMeta();
    }, [queue, songs, isElectron, baseUrl]);

    // Derived Lists
    const currentSong = queue[currentIndex] ? songs[queue[currentIndex]] : null;

    // Logic for Stream Waiting
    const nowPlayingTitle = isStreamWaiting ? '...' : (currentSong?.title || 'Waiting...');
    const nowPlayingArtist = isStreamWaiting ? '' : (currentSong?.artist || 'Unknown Artist');
    const showNowPlaying = !isStreamWaiting && !!currentSong;

    const nextStartIndex = isStreamWaiting ? currentIndex : currentIndex + 1;
    const upNextIds = queue.slice(nextStartIndex);

    const historyEndIndex = currentIndex; // Always exclusive of current/next
    const historyIds = queue.slice(0, historyEndIndex).reverse(); // Newest first

    // Calculate scroll distance for Up Next
    useEffect(() => {
        if (upNextListRef.current && upNextContainerRef.current) {
            const listHeight = upNextListRef.current.scrollHeight;
            const containerHeight = upNextContainerRef.current.clientHeight;
            // Only scroll if list is taller than container
            if (listHeight > containerHeight) {
                setUpNextScrollDistance(listHeight - containerHeight);
            } else {
                setUpNextScrollDistance(0);
            }
        }
    }, [upNextIds, songs]); // Re-calc on data change, use window.innerHeight if needed but usually container flex handles it

    // Styles (Setlista-ish)
    const containerStyle: React.CSSProperties = {
        fontFamily: '"Outfit", "Roboto", sans-serif',
        color: '#fff',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        height: '100vh',
        boxSizing: 'border-box',
        background: 'transparent',
        overflow: 'hidden'
    };

    const sectionHeaderStyle: React.CSSProperties = {
        fontSize: '14px',
        fontWeight: 900,
        color: 'var(--accent-color, #00e5ff)', // Cyan neon default
        textTransform: 'uppercase',
        letterSpacing: '2px',
        marginBottom: '8px',
        borderBottom: '2px solid var(--accent-color, #00e5ff)',
        paddingBottom: '4px',
        display: 'inline-block',
        textShadow: '0 0 10px rgba(0, 229, 255, 0.5)'
    };

    const songTitleStyle: React.CSSProperties = {
        fontWeight: 700,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    };

    const artistStyle: React.CSSProperties = {
        fontWeight: 400,
        opacity: 0.8,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    };

    return (
        <div style={containerStyle}>
            {/* NOW PLAYING - Fixed Height Block */}
            <div style={{ flexShrink: 0 }}>
                <div style={sectionHeaderStyle}>Now Playing</div>
                <div style={{ height: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {showNowPlaying ? (
                        <div>
                            <div style={{ ...songTitleStyle, fontSize: '32px', marginBottom: '4px' }}>
                                {nowPlayingTitle}
                            </div>
                            <div style={{ ...artistStyle, fontSize: '20px' }}>
                                {nowPlayingArtist}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div style={{ ...songTitleStyle, fontSize: '32px', marginBottom: '4px' }}>
                                ...
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* UP NEXT - Flexible Area */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={sectionHeaderStyle}>Up Next</div>

                {/* Lazy Empty State Check for list */}
                {upNextIds.length === 0 && null}

                {upNextIds.length > 0 && (
                    <>
                        {/* Sticky Next Song */}
                        {(() => {
                            const id = upNextIds[0];
                            const song = songs[id];
                            if (!song) return null;
                            const globalIdx = nextStartIndex + 1; // 1-based index from queue
                            return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        background: 'var(--accent-color, #00e5ff)',
                                        color: '#000',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '14px',
                                        fontWeight: 'bold'
                                    }}>
                                        {globalIdx}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ ...songTitleStyle, fontSize: '22px', color: '#fff' }}>{song.title}</div>
                                        <div style={{ ...artistStyle, fontSize: '16px', color: '#ccc' }}>{song.artist}</div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Scrolling Remaining (Adaptive) */}
                        <div ref={upNextContainerRef} style={{ position: 'relative', flex: 1, overflow: 'hidden', maskImage: 'linear-gradient(to bottom, black 80%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent)' }}>
                            <div
                                ref={upNextListRef}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px',
                                    // Fixed speed: 20px/sec, minimum 10s if scrolling
                                    animation: upNextScrollDistance > 0 ? `autoScrollAdaptive ${Math.max(10, upNextScrollDistance / 20)}s linear infinite alternate` : 'none',
                                    paddingBottom: '24px' // Space for mask
                                }}
                            >
                                <style>{`
                                    @keyframes autoScrollAdaptive {
                                        0% { transform: translateY(0); }
                                        20% { transform: translateY(0); } /* Pause at top */
                                        100% { transform: translateY(-${upNextScrollDistance}px); }
                                    }
                                `}</style>
                                {upNextIds.slice(1).map((id, idx) => {
                                    const song = songs[id];
                                    if (!song) return null;
                                    const globalIdx = nextStartIndex + 2 + idx;
                                    return (
                                        <div key={`${id}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{
                                                width: '24px',
                                                height: '24px',
                                                background: 'rgba(255,255,255,0.1)',
                                                borderRadius: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                opacity: 0.7
                                            }}>
                                                {globalIdx}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ ...songTitleStyle, fontSize: '18px', opacity: 0.9 }}>{song.title}</div>
                                                <div style={{ ...artistStyle, fontSize: '14px', opacity: 0.7 }}>{song.artist}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* HISTORY - Fixed Height Block */}
            <div style={{ flexShrink: 0 }}>
                <div style={sectionHeaderStyle}>History</div>
                <div style={{ height: '140px', position: 'relative' }}>
                    {historyIds.length === 0 && null}
                    {historyIds.length > 0 && (
                        <div style={{
                            position: 'relative',
                            overflow: 'hidden',
                            height: '100%',
                            maskImage: 'linear-gradient(to bottom, black 80%, transparent)',
                            WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent)'
                        }}>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                opacity: 0.6,
                                animation: historyIds.length > 3 ? 'autoScrollHistory 15s linear infinite alternate' : 'none',
                                paddingBottom: '24px'
                            }}>
                                <style>{`
                                        @keyframes autoScrollHistory {
                                            0% { transform: translateY(0); }
                                            20% { transform: translateY(0); } /* Pause at top */
                                            100% { transform: translateY(-${Math.max(0, (historyIds.length - 3) * 40)}px); }
                                        }
                                    `}</style>
                                {historyIds.map((id, idx) => {
                                    const song = songs[id];
                                    if (!song) return null;
                                    return (
                                        <div key={`hist-${id}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ ...songTitleStyle, fontSize: '16px' }}>{song.title}</div>
                                                <div style={{ ...artistStyle, fontSize: '12px' }}>{song.artist}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SetlistOverlayWindow;
