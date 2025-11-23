import React, { useEffect, useRef } from 'react';
import { EditableLyricLine } from '../library/lyrics';
import { SongMeta } from '../../shared/songTypes';

interface LyricsOverlayProps {
    status: SongMeta['lyrics_status'];
    lines: EditableLyricLine[];
    currentTime: number;
    className?: string;
    onLineClick?: (time: number) => void;
}

const LyricsOverlay: React.FC<LyricsOverlayProps> = ({ status, lines, currentTime, className, onLineClick }) => {
    const activeLineRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isUserScrolling = useRef(false);
    const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

    // Find current line index
    let currentIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].timeSeconds !== null && lines[i].timeSeconds! <= currentTime) {
            currentIdx = i;
        } else if (lines[i].timeSeconds !== null && lines[i].timeSeconds! > currentTime) {
            break;
        }
    }

    // Handle user scroll interactions
    const handleUserScroll = () => {
        isUserScrolling.current = true;
        if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
        scrollTimeout.current = setTimeout(() => {
            isUserScrolling.current = false;
        }, 3000); // Resume auto-scroll after 3 seconds of no scrolling
    };

    // Auto-scroll for synced lyrics
    useEffect(() => {
        if (status === 'synced' && activeLineRef.current && containerRef.current && !isUserScrolling.current) {
            const container = containerRef.current;
            const activeLine = activeLineRef.current;

            const containerRect = container.getBoundingClientRect();
            const activeLineRect = activeLine.getBoundingClientRect();

            // Calculate the center of the container relative to the viewport
            const containerCenter = containerRect.top + (containerRect.height / 2);
            // Calculate the center of the active line relative to the viewport
            const activeLineCenter = activeLineRect.top + (activeLineRect.height / 2);

            // The distance we need to scroll is the difference between the line center and the container center
            const scrollDelta = activeLineCenter - containerCenter;

            if (Math.abs(scrollDelta) > 5) { // Only scroll if difference is significant to avoid jitter
                container.scrollTo({
                    top: container.scrollTop + scrollDelta,
                    behavior: 'smooth'
                });
            }
        }
    }, [currentIdx, status]); // Only scroll when the active line changes

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

    const maskStyle = {
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 75%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 75%, transparent 100%)',
    };

    if (status === 'text_only') {
        return (
            <div className={className} style={{ height: '100%', position: 'relative', ...maskStyle }}>
                <div style={{
                    height: '100%',
                    overflowY: 'auto',
                    padding: '0 32px',
                    textAlign: 'center',
                    fontSize: '28px',
                    lineHeight: 1.8,
                    color: '#ddd',
                    whiteSpace: 'pre-wrap',
                    scrollbarWidth: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    <div style={{ height: '50vh', flexShrink: 0 }} />
                    {lines.map((line) => (
                        <div key={line.id} style={{ marginBottom: '16px', flexShrink: 0 }}>
                            {line.text}
                        </div>
                    ))}
                    <div style={{ height: '50vh', flexShrink: 0 }} />
                </div>
            </div>
        );
    }

    // Synced Lyrics
    return (
        <div className={className} style={{ height: '100%', position: 'relative', ...maskStyle }}>
            <div
                ref={containerRef}
                onWheel={handleUserScroll}
                onTouchMove={handleUserScroll}
                style={{
                    height: '100%',
                    overflowY: 'auto', // Enable manual scrolling
                    padding: '0 32px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    scrollbarWidth: 'none', // Firefox
                    msOverflowStyle: 'none', // IE/Edge
                }}
            >
                <style>{`
                .${className}::-webkit-scrollbar {
                    display: none; /* Chrome/Safari/Opera */
                }
            `}</style>
                <div style={{ height: '50vh', flexShrink: 0 }} />
                {lines.map((line, idx) => {
                    const isActive = idx === currentIdx;
                    const isPast = idx < currentIdx;

                    return (
                        <div
                            key={line.id}
                            ref={isActive ? activeLineRef : null}
                            onClick={() => {
                                if (line.timeSeconds !== null && onLineClick) {
                                    onLineClick(line.timeSeconds);
                                }
                            }}
                            style={{
                                fontSize: isActive ? `${32 * 1.25}px` : '32px',
                                fontWeight: isActive ? 800 : 500,
                                color: isActive ? 'var(--accent-color, #ff4444)' : isPast ? '#444' : '#888',
                                textAlign: 'center',
                                marginBottom: '24px',
                                transition: 'all 0.3s ease-out',
                                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                                opacity: isActive ? 1 : isPast ? 0.4 : 0.6,
                                textShadow: isActive ? '0 0 20px rgba(255, 68, 68, 0.4)' : 'none',
                                cursor: onLineClick ? 'pointer' : 'default',
                                flexShrink: 0,
                            }}
                        >
                            {line.text}
                        </div>
                    );
                })}
                <div style={{ height: '50vh', flexShrink: 0 }} />
            </div>
        </div>
    );
};

export default LyricsOverlay;
