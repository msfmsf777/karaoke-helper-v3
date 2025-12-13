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
    onToggleFurigana?: () => void;
    onToggleRomaji?: () => void;
    onScrollChange?: (scrollTop: number) => void;
    externalScrollTop?: number | null;
    showControls?: boolean;
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
    onToggleFurigana,
    onToggleRomaji,
    onScrollChange,
    externalScrollTop,
    showControls = false
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

    // Helper for buttons
    const SwitchButton = ({ label, active, onClick }: { label: string, active?: boolean, onClick?: () => void }) => (
        <div
            onClick={onClick}
            style={{
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? 'var(--accent-color, #00e5ff)' : 'rgba(255,255,255,0.1)',
                color: active ? '#000' : '#fff',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: onClick ? 'pointer' : 'default',
                fontWeight: 'bold',
                transition: 'all 0.2s',
                border: '1px solid rgba(255,255,255,0.1)',
                opacity: onClick ? 1 : 0.7
            }}
        >
            {label}
        </div>
    );

    if (status === 'none') {
        return null;
    }

    const maskStyle = {
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 75%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 75%, transparent 100%)',
    };

    // Render logic
    const content = (
        <div className={className} style={{ height: '100%', position: 'relative' }}>
            {/* Plain Text Badge */}
            {showControls && status === 'text_only' && (
                <div style={{
                    position: 'absolute',
                    top: '16px',
                    left: '16px',
                    padding: '4px 8px',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#aaa',
                    pointerEvents: 'none',
                    border: '1px solid rgba(255,255,255,0.1)',
                    zIndex: 10
                }}>
                    純文字
                </div>
            )}

            {/* Furigana/Romaji Switches (Bottom Right) */}
            {showControls && enrichedLines && (
                <div style={{
                    position: 'absolute',
                    bottom: '16px',
                    right: '16px',
                    display: 'flex',
                    gap: '8px',
                    zIndex: 10
                }}>
                    <SwitchButton
                        label="あ"
                        active={furiganaEnabled}
                        onClick={onToggleFurigana}
                    />
                    <SwitchButton
                        label="a"
                        active={romajiEnabled}
                        onClick={onToggleRomaji}
                    />
                </div>
            )}

            <div
                ref={containerRef}
                onScroll={status === 'text_only' ? (e) => onScrollChange?.(e.currentTarget.scrollTop) : undefined}
                onWheel={status === 'synced' ? handleUserScroll : undefined}
                onTouchMove={status === 'synced' ? handleUserScroll : undefined}
                style={{
                    height: '100%',
                    overflowY: 'auto',
                    padding: '0 32px',
                    textAlign: status === 'text_only' ? 'center' : undefined,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: status === 'synced' ? 'center' : undefined,
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    fontSize: status === 'text_only' ? `${styleConfig.fontSize}px` : undefined,
                    lineHeight: status === 'text_only' ? 1.8 : undefined,
                    color: status === 'text_only' ? styleConfig.inactiveColor : undefined,
                    whiteSpace: status === 'text_only' ? 'pre-wrap' : undefined,
                    textShadow: status === 'text_only' && styleConfig.strokeWidth > 0 ?
                        `-${styleConfig.strokeWidth}px -${styleConfig.strokeWidth}px 0 ${styleConfig.strokeColor}, 
                         ${styleConfig.strokeWidth}px -${styleConfig.strokeWidth}px 0 ${styleConfig.strokeColor}, 
                         -${styleConfig.strokeWidth}px ${styleConfig.strokeWidth}px 0 ${styleConfig.strokeColor}, 
                         ${styleConfig.strokeWidth}px ${styleConfig.strokeWidth}px 0 ${styleConfig.strokeColor}` : 'none',
                    ...maskStyle
                }}
            >
                <style>{`
                .${className}::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
                <div style={{ height: '50vh', flexShrink: 0 }} />
                {lines.map((line, idx) => (
                    <div key={line.id} ref={idx === currentIdx ? activeLineRef : null} style={{ marginBottom: status === 'text_only' ? '16px' : undefined, flexShrink: 0 }}>
                        <LyricLine
                            line={line}
                            enriched={enrichedLines?.[idx]}
                            isActive={idx === currentIdx}
                            isPast={idx < currentIdx}
                            styleConfig={styleConfig}
                            furiganaEnabled={furiganaEnabled}
                            romajiEnabled={romajiEnabled}
                            onLineClick={onLineClick}
                        />
                    </div>
                ))}
                <div style={{ height: '50vh', flexShrink: 0 }} />
            </div>
        </div>
    );

    return content;
};

export default LyricsOverlay;
