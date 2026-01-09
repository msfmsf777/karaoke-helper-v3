import React, { useState, useEffect } from 'react';
import { LrcLibTrack, searchLyrics } from '../library/lyricsSearch';

interface LyricsSearchPaneProps {
    isOpen: boolean;
    onClose: () => void;
    initialQuery: string;
    onSelect: (content: string, type: 'lrc' | 'txt', name?: string, artist?: string) => void;
    mode?: 'sidebar' | 'overlay'; // sidebar: left of sidebar (default), overlay: right edge
}

const LyricsSearchPane: React.FC<LyricsSearchPaneProps> = ({ isOpen, onClose, initialQuery, onSelect, mode = 'sidebar' }) => {
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState<LrcLibTrack[]>([]);
    const [searching, setSearching] = useState(false);
    const [previewId, setPreviewId] = useState<number | null>(null);

    // Update query when initialQuery changes or pane opens
    useEffect(() => {
        if (isOpen && initialQuery) {
            setQuery(initialQuery);
            handleSearch(initialQuery);
        }
    }, [isOpen, initialQuery]); // Auto-search on open if query exists

    const handleSearch = async (q: string) => {
        if (!q.trim()) return;
        setSearching(true);
        setResults([]);
        setPreviewId(null);
        try {
            const data = await searchLyrics(q);
            setResults(data);
        } finally {
            setSearching(false);
        }
    };

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    if (!isOpen) return null;

    const positionStyles: React.CSSProperties = mode === 'sidebar' ? {
        right: '450px', // Sticks to the left of the main sidebar
        borderRight: '1px solid #333', // Border between panes
    } : {
        right: 0,
        borderLeft: '1px solid #333',
        zIndex: 1000 // Higher z-index for overlay
    };

    return (
        <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '400px',
            backgroundColor: '#1a1a1a', // Slightly darker to distinguish
            borderLeft: mode === 'sidebar' ? '1px solid #333' : undefined,
            zIndex: 300, // Ensure above sidebar (251)
            boxShadow: '-5px 0 30px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideInRight 0.3s ease-out',
            ...positionStyles
        }}>
            {/* Header */}
            <div style={{
                padding: '20px',
                borderBottom: '1px solid #333',
                backgroundColor: '#252525',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                // @ts-ignore
                WebkitAppRegion: 'no-drag'
            }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
                        placeholder="搜尋歌曲 / 歌手..."
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: '#1a1a1a',
                            border: '1px solid #333',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '14px',
                            boxSizing: 'border-box' // Fix padding overflow
                        }}
                    />
                </div>
                <button
                    onClick={() => handleSearch(query)}
                    disabled={searching}
                    style={{
                        padding: '8px 16px',
                        background: 'var(--accent-color)',
                        color: '#000',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: searching ? 'wait' : 'pointer',
                        fontWeight: 'bold',
                        fontSize: '13px'
                    }}
                >
                    搜尋
                </button>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#aaa',
                        cursor: 'pointer',
                        fontSize: '20px',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    ×
                </button>
            </div>

            {/* Results */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                {searching && <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>搜尋中...</div>}
                {!searching && results.length === 0 && <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>無結果</div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {results.map(track => (
                        <div key={track.id} style={{
                            background: '#252525',
                            borderRadius: '8px',
                            padding: '12px',
                            border: '1px solid #333'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <div style={{ overflow: 'hidden' }}>
                                    <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {track.name}
                                    </div>
                                    <div style={{ color: '#aaa', fontSize: '12px' }}>
                                        {track.artistName}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', minWidth: '60px' }}>
                                    <div style={{ color: '#888', fontSize: '12px' }}>{formatDuration(track.duration)}</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                {track.syncedLyrics && (
                                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'var(--accent-color)', color: '#000', fontWeight: 'bold' }}>LRC</span>
                                )}
                                {track.plainLyrics && !track.syncedLyrics && (
                                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#444', color: '#ccc' }}>TXT</span>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => setPreviewId(previewId === track.id ? null : track.id)}
                                    style={{
                                        flex: 1,
                                        padding: '6px',
                                        background: '#333',
                                        color: '#fff',
                                        border: '1px solid #444',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                    }}
                                >
                                    {previewId === track.id ? '隱藏預覽' : '預覽'}
                                </button>
                                <button
                                    onClick={() => {
                                        if (track.syncedLyrics) onSelect(track.syncedLyrics, 'lrc', track.name, track.artistName);
                                        else if (track.plainLyrics) onSelect(track.plainLyrics, 'txt', track.name, track.artistName);
                                    }}
                                    style={{
                                        flex: 2,
                                        padding: '6px',
                                        background: 'var(--accent-color)', // Highlight primary action
                                        color: '#000',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    使用此歌詞
                                </button>
                            </div>

                            {previewId === track.id && (
                                <div style={{
                                    marginTop: '12px',
                                    background: '#111',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    color: '#ccc',
                                    maxHeight: '150px',
                                    overflowY: 'auto',
                                    whiteSpace: 'pre-line',
                                    fontFamily: 'monospace'
                                }}>
                                    {track.syncedLyrics || track.plainLyrics}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LyricsSearchPane;
