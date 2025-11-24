import React, { useEffect, useRef } from 'react';
import { EditableLyricLine } from '../library/lyrics';
import { SongMeta, EnrichedLyricLine } from '../../shared/songTypes';
import { LyricStyleConfig, DEFAULT_LYRIC_STYLES } from '../contexts/UserDataContext';

interface LyricsOverlayProps {
    status: SongMeta['lyrics_status'];
    lines: EditableLyricLine[];
    currentTime: number;
    className?: string;
    onLineClick?: (time: number) => void;
    styleConfig?: LyricStyleConfig;
    enrichedLines?: EnrichedLyricLine[] | null;
    furiganaEnabled?: boolean;
    romajiEnabled?: boolean;
    onScrollChange?: (scrollTop: number) => void;
    externalScrollTop?: number | null;
}

const LyricLine = React.memo(({
    line,
    enriched,
    isActive,
    isPast,
    styleConfig,
    furiganaEnabled,
    romajiEnabled,
    onLineClick
}: {
    line: EditableLyricLine;
    enriched?: EnrichedLyricLine | null;
    isActive: boolean;
    isPast: boolean;
    styleConfig: LyricStyleConfig;
    furiganaEnabled?: boolean;
    romajiEnabled?: boolean;
    onLineClick?: (time: number) => void;
}) => {
    let mainContent: React.ReactNode = line.text;

    if (furiganaEnabled && enriched) {
        mainContent = enriched.ruby.map((seg, i) => {
            if (seg.furigana) {
                return (
                    <ruby key={i} style={{ rubyPosition: 'over' }}>
                        {seg.surface}
                        <rt style={{
                            fontSize: '0.5em',
                            color: 'inherit',
                            opacity: 0.9,
                            userSelect: 'none',
                            paddingBottom: '3px'
                        }}>{seg.furigana}</rt>
                    </ruby>
                );
            }
            return <span key={i}>{seg.surface}</span>;
        });
    }

    return (
        <div
            onClick={() => {
                if (line.timeSeconds !== null && onLineClick) {
                    onLineClick(line.timeSeconds);
                }
            }}
            style={{
                fontSize: isActive ? `${styleConfig.fontSize * 1.25}px` : `${styleConfig.fontSize}px`,
                fontWeight: isActive ? 800 : 500,
                color: isActive ? styleConfig.activeColor : isPast ? '#444' : styleConfig.inactiveColor,
                textAlign: 'center',
                marginBottom: '24px',
                transition: 'all 0.3s ease-out',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                opacity: isActive ? 1 : isPast ? 0.4 : 0.6,
                textShadow: isActive
                    ? `0 0 20px ${styleConfig.activeGlowColor}`
                    : styleConfig.strokeWidth > 0
                        ? `-${styleConfig.strokeWidth}px -${styleConfig.strokeWidth}px 0 ${styleConfig.strokeColor}, 
                           ${styleConfig.strokeWidth}px -${styleConfig.strokeWidth}px 0 ${styleConfig.strokeColor}, 
                           -${styleConfig.strokeWidth}px ${styleConfig.strokeWidth}px 0 ${styleConfig.strokeColor}, 
                           ${styleConfig.strokeWidth}px ${styleConfig.strokeWidth}px 0 ${styleConfig.strokeColor}`
                        : 'none',
                WebkitTextStroke: isActive && styleConfig.strokeWidth > 0 ? `${styleConfig.strokeWidth}px ${styleConfig.strokeColor}` : 'none',
                cursor: onLineClick ? 'pointer' : 'default',
                flexShrink: 0,
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ lineHeight: furiganaEnabled ? 1.5 : 1.2 }}>
                    {mainContent}
                </div>
                {romajiEnabled && enriched && (
                    <div style={{
                        fontSize: '0.5em',
                        marginTop: '4px',
                        opacity: 0.8,
                        fontWeight: 'normal',
                        lineHeight: 1.2
                    }}>
                        {enriched.romaji}
                    </div>
                )}
            </div>
        </div>
    );
}, (prev, next) => {
    return (
        prev.line === next.line &&
        prev.enriched === next.enriched &&
        prev.isActive === next.isActive &&
        prev.isPast === next.isPast &&
        prev.styleConfig === next.styleConfig &&
        prev.furiganaEnabled === next.furiganaEnabled &&
        prev.romajiEnabled === next.romajiEnabled &&
        prev.onLineClick === next.onLineClick
    );
});

const LyricsOverlay: React.FC<LyricsOverlayProps> = ({
    status,
    lines,
    currentTime,
    className,
    onLineClick,
    styleConfig = DEFAULT_LYRIC_STYLES,
    enrichedLines,
    furiganaEnabled,
    romajiEnabled,
    onScrollChange,
    externalScrollTop
}) => {
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

    // External Scroll Sync (Text Only)
    useEffect(() => {
        if (status === 'text_only' && containerRef.current && externalScrollTop !== undefined && externalScrollTop !== null) {
            containerRef.current.scrollTop = externalScrollTop;
        }
    }, [externalScrollTop, status]);


    // Helper for text-only mode (reusing LyricLine but without click/active logic if desired, or just simple render)
    // For text-only, we can still use LyricLine but isActive is always false

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
                <div
                    ref={containerRef}
                    onScroll={(e) => {
                        if (onScrollChange) {
                            onScrollChange(e.currentTarget.scrollTop);
                        }
                    }}
                    style={{
                        height: '100%',
                        overflowY: 'auto',
                        padding: '0 32px',
                        textAlign: 'center',
                        fontSize: `${styleConfig.fontSize}px`,
                        lineHeight: 1.8,
                        color: styleConfig.inactiveColor,
                        whiteSpace: 'pre-wrap',
                        scrollbarWidth: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        textShadow: styleConfig.strokeWidth > 0 ?
                            `-${styleConfig.strokeWidth}px -${styleConfig.strokeWidth}px 0 ${styleConfig.strokeColor}, 
                             ${styleConfig.strokeWidth}px -${styleConfig.strokeWidth}px 0 ${styleConfig.strokeColor}, 
                             -${styleConfig.strokeWidth}px ${styleConfig.strokeWidth}px 0 ${styleConfig.strokeColor}, 
                             ${styleConfig.strokeWidth}px ${styleConfig.strokeWidth}px 0 ${styleConfig.strokeColor}` : 'none',
                    }}>
                    <div style={{ height: '50vh', flexShrink: 0 }} />
                    {lines.map((line, idx) => (
                        <div key={line.id} style={{ marginBottom: '16px', flexShrink: 0 }}>
                            <LyricLine
                                line={line}
                                enriched={enrichedLines?.[idx]}
                                isActive={false}
                                isPast={false}
                                styleConfig={styleConfig}
                                furiganaEnabled={furiganaEnabled}
                                romajiEnabled={romajiEnabled}
                                onLineClick={undefined}
                            />
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
                        <div key={line.id} ref={isActive ? activeLineRef : null}>
                            <LyricLine
                                line={line}
                                enriched={enrichedLines?.[idx]}
                                isActive={isActive}
                                isPast={isPast}
                                styleConfig={styleConfig}
                                furiganaEnabled={furiganaEnabled}
                                romajiEnabled={romajiEnabled}
                                onLineClick={onLineClick}
                            />
                        </div>
                    );
                })}
                <div style={{ height: '50vh', flexShrink: 0 }} />
            </div>
        </div>
    );
};

export default LyricsOverlay;
