import React, { useEffect, useRef } from 'react';
import { EditableLyricLine } from '../library/lyrics';
import { SongMeta } from '../../shared/songTypes';

interface LyricsOverlayProps {
    status: SongMeta['lyrics_status'];
    lines: EditableLyricLine[];
    currentTime: number;
    className?: string;
}

const LyricsOverlay: React.FC<LyricsOverlayProps> = ({ status, lines, currentTime, className }) => {
    const activeLineRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll for synced lyrics
    useEffect(() => {
        if (status === 'synced' && activeLineRef.current) {
            activeLineRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, [currentTime, status]);

    if (status === 'none') {
        return (
            <div
                className={className}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: '#666',
                    fontSize: '24px',
                    fontWeight: 500,
                }}
            >
                此歌曲沒有歌詞
            </div>
        );
    }

    if (status === 'text_only') {
        return (
            <div className={className} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '32px',
                        textAlign: 'center',
                        fontSize: '28px',
                        lineHeight: 1.8,
                        color: '#ddd',
                        whiteSpace: 'pre-wrap',
                    }}
                >
                    {lines.map((line) => (
                        <div key={line.id} style={{ marginBottom: '16px' }}>
                            {line.text}
                        </div>
                    ))}
                </div>
                <div
                    style={{
                        padding: '8px',
                        textAlign: 'center',
                        fontSize: '14px',
                        color: '#666',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                    }}
                >
                    此歌曲目前只有純文字歌詞，未對齊時間
                </div>
            </div>
        );
    }

    // Synced Lyrics
    return (
        <div
            className={className}
            ref={containerRef}
            style={{
                height: '100%',
                overflowY: 'hidden', // Hide scrollbar for karaoke feel
                padding: '0 32px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                // We use a large padding top/bottom so the first/last lines can be centered
                paddingTop: '40vh',
                paddingBottom: '40vh',
            }}
        >
            {(() => {
                // Find current line index
                let currentIdx = -1;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].timeSeconds !== null && lines[i].timeSeconds! <= currentTime) {
                        currentIdx = i;
                    } else if (lines[i].timeSeconds !== null && lines[i].timeSeconds! > currentTime) {
                        break;
                    }
                }

                return lines.map((line, idx) => {
                    const isActive = idx === currentIdx;
                    const isPast = idx < currentIdx;

                    return (
                        <div
                            key={line.id}
                            ref={isActive ? activeLineRef : null}
                            style={{
                                fontSize: isActive ? '48px' : '32px',
                                fontWeight: isActive ? 800 : 500,
                                color: isActive ? 'var(--accent-color, #ff4444)' : isPast ? '#444' : '#888',
                                textAlign: 'center',
                                marginBottom: '24px',
                                transition: 'all 0.3s ease-out',
                                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                                opacity: isActive ? 1 : isPast ? 0.4 : 0.6,
                                textShadow: isActive ? '0 0 20px rgba(255, 68, 68, 0.4)' : 'none',
                            }}
                        >
                            {line.text}
                        </div>
                    );
                });
            })()}
        </div>
    );
};

export default LyricsOverlay;
