import React, { useEffect, useMemo, useRef } from 'react';
import { EditableLyricLine } from '../../library/lyrics';
import { EnrichedLyricLine, SongMeta } from '../../../shared/songTypes';
import {
  LyricsOverlayDesign,
  LyricsOverlayTemplateConfig,
  OverlayPlaybackMode,
  SetlistOverlayDesign,
  SetlistOverlayTemplateConfig,
} from '../../../shared/overlayTemplates';

export interface OverlaySongMetadata {
  id: string;
  title: string;
  artist?: string;
  type?: string;
  source?: string;
  duration?: number;
  thumbnailUrl?: string;
}

export interface OverlaySetlistState {
  queue: string[];
  currentIndex: number;
  songs: Record<string, OverlaySongMetadata>;
  isStreamWaiting: boolean;
  playbackMode: OverlayPlaybackMode;
}

const SAMPLE_LINES: EditableLyricLine[] = [
  { id: 'sample-1', text: '夜明けのステージに光が差す', timeSeconds: 0 },
  { id: 'sample-2', text: '君の声が星空へ響いていく', timeSeconds: 1.2 },
  { id: 'sample-3', text: '夢の続きを今ここで歌おう', timeSeconds: 2.4 },
  { id: 'sample-4', text: '遠いメロディーも手を伸ばせば届く', timeSeconds: 3.6 },
  { id: 'sample-5', text: '最後のサビまで一緒に走ろう', timeSeconds: 4.8 },
  { id: 'sample-6', text: '明日の空へ拍手が舞い上がる', timeSeconds: 6 },
  { id: 'sample-7', text: 'また会える日を信じて笑う', timeSeconds: 7.2 },
];

const SAMPLE_ENRICHED_LINES: EnrichedLyricLine[] = [
  {
    original: '夜明けのステージに光が差す',
    romaji: 'yoake no suteeji ni hikari ga sasu',
    ruby: [
      { surface: '夜明け', furigana: 'よあけ' },
      { surface: 'のステージに', furigana: null },
      { surface: '光', furigana: 'ひかり' },
      { surface: 'が', furigana: null },
      { surface: '差す', furigana: 'さす' },
    ],
  },
  {
    original: '君の声が星空へ響いていく',
    romaji: 'kimi no koe ga hoshizora e hibiite iku',
    ruby: [
      { surface: '君', furigana: 'きみ' },
      { surface: 'の', furigana: null },
      { surface: '声', furigana: 'こえ' },
      { surface: 'が', furigana: null },
      { surface: '星空', furigana: 'ほしぞら' },
      { surface: 'へ', furigana: null },
      { surface: '響いて', furigana: 'ひびいて' },
      { surface: 'いく', furigana: null },
    ],
  },
  {
    original: '夢の続きを今ここで歌おう',
    romaji: 'yume no tsuzuki o ima koko de utaou',
    ruby: [
      { surface: '夢', furigana: 'ゆめ' },
      { surface: 'の', furigana: null },
      { surface: '続きを', furigana: 'つづきを' },
      { surface: '今', furigana: 'いま' },
      { surface: 'ここで', furigana: null },
      { surface: '歌おう', furigana: 'うたおう' },
    ],
  },
  {
    original: '遠いメロディーも手を伸ばせば届く',
    romaji: 'tooi merodii mo te o nobaseba todoku',
    ruby: [
      { surface: '遠い', furigana: 'とおい' },
      { surface: 'メロディーも', furigana: null },
      { surface: '手', furigana: 'て' },
      { surface: 'を', furigana: null },
      { surface: '伸ばせば', furigana: 'のばせば' },
      { surface: '届く', furigana: 'とどく' },
    ],
  },
  {
    original: '最後のサビまで一緒に走ろう',
    romaji: 'saigo no sabi made issho ni hashirou',
    ruby: [
      { surface: '最後', furigana: 'さいご' },
      { surface: 'のサビまで', furigana: null },
      { surface: '一緒', furigana: 'いっしょ' },
      { surface: 'に', furigana: null },
      { surface: '走ろう', furigana: 'はしろう' },
    ],
  },
  {
    original: '明日の空へ拍手が舞い上がる',
    romaji: 'ashita no sora e hakushu ga maiagaru',
    ruby: [
      { surface: '明日', furigana: 'あした' },
      { surface: 'の', furigana: null },
      { surface: '空', furigana: 'そら' },
      { surface: 'へ', furigana: null },
      { surface: '拍手', furigana: 'はくしゅ' },
      { surface: 'が', furigana: null },
      { surface: '舞い上がる', furigana: 'まいあがる' },
    ],
  },
  {
    original: 'また会える日を信じて笑う',
    romaji: 'mata aeru hi o shinjite warau',
    ruby: [
      { surface: 'また', furigana: null },
      { surface: '会える', furigana: 'あえる' },
      { surface: '日', furigana: 'ひ' },
      { surface: 'を', furigana: null },
      { surface: '信じて', furigana: 'しんじて' },
      { surface: '笑う', furigana: 'わらう' },
    ],
  },
];

export const SAMPLE_SETLIST_STATE: OverlaySetlistState = {
  queue: [
    'sample-current',
    'sample-next-1',
    'sample-next-2',
    'sample-next-3',
    'sample-next-4',
    'sample-next-5',
    'sample-next-6',
    'sample-history-1',
    'sample-history-2',
  ],
  currentIndex: 0,
  isStreamWaiting: false,
  playbackMode: 'normal',
  songs: {
    'sample-current': {
      id: 'sample-current',
      title: 'Signal - Demo Live',
      artist: 'KHelper',
      type: '原曲',
      source: 'youtube',
      duration: 226,
    },
    'sample-next-1': {
      id: 'sample-next-1',
      title: 'Blue Hour',
      artist: 'Sample Singer',
      type: '伴奏',
      source: 'file',
      duration: 241,
    },
    'sample-next-2': {
      id: 'sample-next-2',
      title: 'Midnight Request',
      artist: 'Guest',
      type: '原曲',
      source: 'youtube',
      duration: 208,
    },
    'sample-next-3': {
      id: 'sample-next-3',
      title: 'Encore Melody',
      artist: 'KHelper',
      type: '原曲',
      source: 'file',
      duration: 255,
    },
    'sample-next-4': {
      id: 'sample-next-4',
      title: 'Long Title Preview For Scrolling Reserve Area',
      artist: 'Viewer A',
      type: '原曲',
      source: 'youtube',
      duration: 198,
    },
    'sample-next-5': {
      id: 'sample-next-5',
      title: 'Next Stage',
      artist: 'Viewer B',
      type: '伴奏',
      source: 'file',
      duration: 232,
    },
    'sample-next-6': {
      id: 'sample-next-6',
      title: 'Final Request',
      artist: 'Viewer C',
      type: '原曲',
      source: 'youtube',
      duration: 215,
    },
    'sample-history-1': {
      id: 'sample-history-1',
      title: 'Opening Song',
      artist: 'KHelper',
      type: '原曲',
      source: 'file',
      duration: 189,
    },
    'sample-history-2': {
      id: 'sample-history-2',
      title: 'Warm Up Tune',
      artist: 'KHelper',
      type: '伴奏',
      source: 'file',
      duration: 203,
    },
  },
};

export function getSampleLyrics() {
  return {
    status: 'synced' as SongMeta['lyrics_status'],
    lines: SAMPLE_LINES,
    currentTime: 2.4,
    enrichedLines: SAMPLE_ENRICHED_LINES,
  };
}

const getActiveLineIndex = (lines: EditableLyricLine[], currentTime: number) => {
  let currentIdx = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const time = lines[index].timeSeconds;
    if (time !== null && time <= currentTime) {
      currentIdx = index;
    } else if (time !== null && time > currentTime) {
      break;
    }
  }
  return currentIdx;
};

const getVisibleLineRange = (
  lineCount: number,
  currentIdx: number,
  config: LyricsOverlayTemplateConfig
) => {
  if (config.lineMode === 'fill') {
    return { start: 0, end: Math.max(0, lineCount - 1) };
  }

  const fallbackIndex = currentIdx >= 0 ? currentIdx : 0;
  const count = Math.max(1, Math.min(15, Math.round(config.lineCount || 5)));
  const before = Math.floor((count - 1) / 2);
  const after = count - 1 - before;
  const start = Math.max(0, fallbackIndex - before);
  const end = Math.min(lineCount - 1, fallbackIndex + after);
  return { start, end };
};

const renderLyricContent = (
  line: EditableLyricLine,
  enriched: EnrichedLyricLine | null | undefined,
  showFurigana: boolean,
  showRomaji: boolean,
  config: LyricsOverlayTemplateConfig
) => {
  const mainContent = showFurigana && enriched
    ? enriched.ruby.map((segment, index) => (
      segment.furigana ? (
        <ruby key={`${segment.surface}-${index}`} style={{ rubyPosition: 'over' }}>
          {segment.surface}
          <rt style={{ fontSize: '0.46em', opacity: 0.88, paddingBottom: 4 }}>{segment.furigana}</rt>
        </ruby>
      ) : <span key={`${segment.surface}-${index}`}>{segment.surface}</span>
    ))
    : line.text;

  return (
    <>
      <div>{mainContent}</div>
      {showRomaji && enriched?.romaji && (
        <div style={{
          fontSize: '0.5em',
          opacity: 0.8,
          marginTop: config.romajiMarginTop,
          fontWeight: 500,
          letterSpacing: config.romajiLetterSpacing,
        }}>
          {enriched.romaji}
        </div>
      )}
    </>
  );
};

export const TemplatedLyricsOverlay: React.FC<{
  design: LyricsOverlayDesign;
  status: SongMeta['lyrics_status'];
  lines: EditableLyricLine[];
  currentTime: number;
  enrichedLines?: EnrichedLyricLine[] | null;
  furiganaEnabled: boolean;
  romajiEnabled: boolean;
}> = ({ design, status, lines, currentTime, enrichedLines, furiganaEnabled, romajiEnabled }) => {
  const config = design.config;
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const currentIdx = status === 'synced' ? getActiveLineIndex(lines, currentTime) : -1;
  const visibleRange = getVisibleLineRange(lines.length, currentIdx, config);
  const showFurigana = config.furiganaPolicy === 'show' || (config.furiganaPolicy === 'follow_app' && furiganaEnabled);
  const showRomaji = config.romajiPolicy === 'show' || (config.romajiPolicy === 'follow_app' && romajiEnabled);
  const usesEntranceAnimation = config.animation === 'fade' || config.animation === 'slide' || config.animation === 'scale';

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer || status !== 'synced') return;
    if (currentIdx < 0) {
      scrollContainer.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    if (!activeLineRef.current) return;
    const activeLine = activeLineRef.current;
    const scrollRect = scrollContainer.getBoundingClientRect();
    const lineRect = activeLine.getBoundingClientRect();
    if (scrollRect.height <= 0 || lineRect.height <= 0) return;
    const delta = (lineRect.top + lineRect.height / 2) - (scrollRect.top + scrollRect.height / 2);
    scrollContainer.scrollTo({
      top: scrollContainer.scrollTop + delta,
      behavior: config.animation === 'scroll' ? 'smooth' : 'auto',
    });
  }, [currentIdx, status, config.lineMode, config.activeFontSize, config.inactiveFontSize, config.lineGap, config.animation]);

  if (status === 'none' || lines.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: config.inactiveColor, fontFamily: config.fontFamily }}>
        無歌詞
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: config.fontFamily,
        color: config.inactiveColor,
        background: 'transparent',
      }}
    >
      <style>{`
        @keyframes khelperObsLyricFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes khelperObsLyricSlide { from { opacity: 0; transform: translateX(${Math.round(24 * config.animationIntensity)}px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes khelperObsLyricScale { from { opacity: 0; transform: scale(${Math.max(0.85, 1 - config.animationIntensity * 0.15)}); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: 'clamp(28px, 5vw, 72px)',
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      >
        <div
          ref={scrollRef}
          style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            textAlign: 'center',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            maskImage: config.lineMode === 'fill'
              ? 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)'
              : undefined,
            WebkitMaskImage: config.lineMode === 'fill'
              ? 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)'
              : undefined,
          }}
        >
          <div style={{ height: '50%', flexShrink: 0 }} />
          <div
            key={usesEntranceAnimation ? `${config.animation}-${currentIdx}` : 'lyric-scroll-track'}
            style={{
              width: '100%',
              animation: usesEntranceAnimation
                ? `khelperObsLyric${config.animation === 'fade' ? 'Fade' : config.animation === 'slide' ? 'Slide' : 'Scale'} ${config.animationDurationMs}ms ease both`
                : undefined,
            }}
          >
            {lines.map((line, index) => {
              const isActive = index === currentIdx || (status === 'text_only' && index === 0);
              const isPast = status === 'synced' && currentIdx >= 0 && index < currentIdx;
              const isVisible = status !== 'synced'
                || config.lineMode === 'fill'
                || (index >= visibleRange.start && index <= visibleRange.end);
              const textShadow = [
                config.strokeWidth > 0
                  ? `0 0 1px ${config.strokeColor}, -${config.strokeWidth}px 0 ${config.strokeColor}, ${config.strokeWidth}px 0 ${config.strokeColor}, 0 -${config.strokeWidth}px ${config.strokeColor}, 0 ${config.strokeWidth}px ${config.strokeColor}`
                  : '',
                isActive && config.glowStrength > 0
                  ? `0 0 ${Math.round(30 * config.glowStrength)}px ${config.glowColor}`
                  : '',
              ].filter(Boolean).join(', ');

              return (
                <div
                  key={line.id}
                  ref={isActive ? activeLineRef : null}
                  style={{
                    color: isActive ? config.activeColor : isPast ? config.passedColor : config.inactiveColor,
                    fontSize: isActive ? config.activeFontSize : config.inactiveFontSize,
                    fontWeight: isActive ? 850 : 600,
                    lineHeight: showFurigana ? 1.58 : 1.22,
                    marginBottom: index === lines.length - 1 ? 0 : config.lineGap,
                    visibility: isVisible ? 'visible' : 'hidden',
                    opacity: isVisible ? isActive ? 1 : isPast ? 0.48 : 0.72 : 0,
                    textShadow: textShadow || undefined,
                    transition: config.animation === 'none' ? 'none' : 'color 180ms ease, opacity 180ms ease, font-size 180ms ease',
                    overflowWrap: 'anywhere',
                    letterSpacing: config.letterSpacing,
                  }}
                >
                  {renderLyricContent(line, enrichedLines?.[index], showFurigana, showRomaji, config)}
                </div>
              );
            })}
          </div>
          <div style={{ height: '50%', flexShrink: 0 }} />
        </div>
      </div>
    </div>
  );
};

const getFrameStyle = (config: SetlistOverlayTemplateConfig): React.CSSProperties => {
  const base: React.CSSProperties = {
    borderRadius: config.outerRadius,
    border: '1px solid transparent',
  };

  if (config.frameStyle === 'solid') {
    return { ...base, background: 'rgba(8, 12, 18, 0.86)', borderColor: 'rgba(255,255,255,0.12)' };
  }
  if (config.frameStyle === 'glass') {
    return { ...base, background: 'rgba(8, 14, 22, 0.52)', borderColor: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)' };
  }
  if (config.frameStyle === 'neon') {
    return {
      ...base,
      background: 'rgba(0, 0, 0, 0.38)',
      borderColor: config.accentColor,
      boxShadow: `0 0 20px ${config.accentColor}66`,
    };
  }
  return base;
};

const formatDuration = (seconds?: number) => {
  if (!Number.isFinite(seconds) || !seconds || seconds <= 0) return '--:--';
  const safe = Math.floor(seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

const setlistScrollSpeedToPixels = (speed: number) => {
  const safeSpeed = Math.max(1, Math.min(10, Number(speed) || 1));
  return 42 + safeSpeed * 12;
};

const SetlistRow: React.FC<{
  song: OverlaySongMetadata;
  index?: number;
  config: SetlistOverlayTemplateConfig;
  active?: boolean;
  waitingNext?: boolean;
}> = ({ song, index, config, active, waitingNext }) => {
  const showNumber = Boolean(config.showNumbering && !active && index !== undefined);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${showNumber ? '34px ' : ''}${config.showThumbnails ? '42px ' : ''}minmax(0,1fr)${config.showDuration ? ' 54px' : ''}`,
        gap: 10,
        alignItems: 'center',
        padding: config.density === 'compact' ? '6px 8px' : '9px 10px',
        borderRadius: config.innerRadius,
        background: active || waitingNext ? `${config.accentColor}22` : 'rgba(255,255,255,0.04)',
        color: config.textColor,
        minWidth: 0,
        border: waitingNext ? `1px solid ${config.accentColor}66` : '1px solid transparent',
        animation: config.changeAnimation === 'none'
          ? undefined
          : `khelperSetlist${config.changeAnimation === 'fade' ? 'Fade' : 'Slide'} 260ms ease both`,
      }}
    >
    {showNumber && (
      <div style={{
        width: 26,
        height: 26,
        borderRadius: 8,
        display: 'grid',
        placeItems: 'center',
        background: active || waitingNext ? config.accentColor : 'rgba(255,255,255,0.1)',
        color: active || waitingNext ? '#071015' : config.secondaryColor,
        fontWeight: 800,
        fontSize: 12,
      }}>
        {index}
      </div>
    )}
    {config.showThumbnails && (
      <div style={{
        width: 38,
        height: 38,
        borderRadius: config.templateId === 'record_card' ? '50%' : Math.min(14, config.innerRadius),
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.1)',
      }}>
        {song.thumbnailUrl && (
          <img src={song.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
    )}
    <div style={{ minWidth: 0 }}>
      <div style={{
        fontSize: active ? 24 : config.density === 'compact' ? 15 : 17,
        fontWeight: active ? 850 : 700,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {song.title}
      </div>
      {config.showArtist && (
        <div style={{
          color: config.secondaryColor,
          fontSize: active ? 15 : 12,
          marginTop: 2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {song.artist || 'Unknown Artist'}
        </div>
      )}
    </div>
    {config.showDuration && (
      <div style={{
        color: config.accentColor,
        fontSize: 12,
        fontWeight: 800,
        textAlign: 'center',
      }}>
        {formatDuration(song.duration)}
      </div>
    )}
  </div>
  );
};

const AutoScrollArea: React.FC<{
  enabled: boolean;
  speed: number;
  pauseMs: number;
  children: React.ReactNode;
}> = ({ enabled, speed, pauseMs, children }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const speedRef = useRef(setlistScrollSpeedToPixels(speed));
  const pauseRef = useRef(pauseMs);
  const virtualScrollTopRef = useRef(0);
  const directionRef = useRef<1 | -1>(1);
  const pauseUntilRef = useRef(0);
  const lastMaxScrollRef = useRef(0);

  useEffect(() => {
    speedRef.current = setlistScrollSpeedToPixels(speed);
  }, [speed]);

  useEffect(() => {
    pauseRef.current = pauseMs;
  }, [pauseMs]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) {
      virtualScrollTopRef.current = 0;
      directionRef.current = 1;
      pauseUntilRef.current = 0;
      lastMaxScrollRef.current = 0;
      if (element) element.scrollTop = 0;
      return;
    }

    let frame = 0;
    let last = performance.now();
    virtualScrollTopRef.current = Math.max(0, element.scrollTop);
    directionRef.current = 1;
    pauseUntilRef.current = last + pauseRef.current;
    lastMaxScrollRef.current = Math.max(0, element.scrollHeight - element.clientHeight);

    const tick = (now: number) => {
      const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
      const previousMaxScroll = lastMaxScrollRef.current;
      lastMaxScrollRef.current = maxScroll;

      if (maxScroll <= 1) {
        virtualScrollTopRef.current = 0;
        element.scrollTop = 0;
        last = now;
        frame = requestAnimationFrame(tick);
        return;
      }

      if (previousMaxScroll !== maxScroll) {
        virtualScrollTopRef.current = Math.min(Math.max(0, virtualScrollTopRef.current), maxScroll);
      }

      if (now >= pauseUntilRef.current) {
        const delta = Math.min(Math.max((now - last) / 1000, 0), 0.1);
        let nextScrollTop = virtualScrollTopRef.current + directionRef.current * speedRef.current * delta;

        if (nextScrollTop >= maxScroll) {
          nextScrollTop = maxScroll;
          directionRef.current = -1;
          pauseUntilRef.current = now + pauseRef.current;
        } else if (nextScrollTop <= 0) {
          nextScrollTop = 0;
          directionRef.current = 1;
          pauseUntilRef.current = now + pauseRef.current;
        }

        virtualScrollTopRef.current = nextScrollTop;
        element.scrollTop = nextScrollTop;
      }

      last = now;
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled]);

  return (
    <div ref={ref} style={{ overflow: 'hidden', minHeight: 0, height: '100%' }}>
      {children}
    </div>
  );
};

export const TemplatedSetlistOverlay: React.FC<{
  design: SetlistOverlayDesign;
  state: OverlaySetlistState;
}> = ({ design, state }) => {
  const config = design.config;
  const currentSong = !state.isStreamWaiting && state.queue[state.currentIndex]
    ? state.songs[state.queue[state.currentIndex]]
    : null;
  const upcomingStart = state.isStreamWaiting ? state.currentIndex : state.currentIndex + 1;
  const upcomingSongs = state.queue.slice(Math.max(0, upcomingStart))
    .map((id) => state.songs[id])
    .filter(Boolean);
  const historySongs = state.queue.slice(0, Math.max(0, state.currentIndex)).reverse()
    .map((id) => state.songs[id])
    .filter(Boolean);
  const waitingSong = state.isStreamWaiting && state.queue[upcomingStart]
    ? state.songs[state.queue[upcomingStart]]
    : null;

  const hasUpcoming = config.showUpcoming;
  const hasHistory = config.templateId !== 'record_card' && config.showHistory;
  const reserveFlex = hasUpcoming && hasHistory ? 2 : 1;
  const historyFlex = hasUpcoming && hasHistory ? 1 : 1;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: 26,
        background: 'transparent',
        color: config.textColor,
        fontFamily: config.fontFamily,
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes khelperSetlistFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes khelperSetlistSlide { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: config.density === 'compact' ? 12 : 18,
          ...getFrameStyle(config),
        }}
      >
        {config.showCurrent && (
          <Section label={config.currentLabel} config={config} flex="0 0 auto" showCount={false}>
            {currentSong ? (
              <SetlistRow song={currentSong} config={config} active />
            ) : (
              <WaitingCurrent
                text={config.emptyState === 'waiting'
                  ? (config.waitingText || (state.playbackMode === 'stream' ? '等待下一首' : '尚未播放'))
                  : '...'}
                song={config.emptyState === 'waiting' && config.showWaitingSongTitle ? waitingSong : null}
                config={config}
              />
            )}
          </Section>
        )}

        {(hasUpcoming || hasHistory) && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: config.density === 'compact' ? 12 : 18 }}>
            {hasUpcoming && (
              <Section label={config.upcomingLabel} count={upcomingSongs.length} config={config} flex={`${reserveFlex} 1 0`}>
                {upcomingSongs.length ? (
                  <AutoScrollArea enabled={config.autoScroll} speed={config.autoScrollSpeed} pauseMs={config.autoScrollPauseMs}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: config.density === 'compact' ? 6 : 8 }}>
                      {upcomingSongs.map((song, index) => (
                        <SetlistRow
                          key={`${song.id}-${index}`}
                          song={song}
                          index={upcomingStart + index + 1}
                          config={config}
                          waitingNext={state.isStreamWaiting && index === 0}
                        />
                      ))}
                    </div>
                  </AutoScrollArea>
                ) : config.emptyState === 'waiting' ? (
                  <EmptyText text="尚無待播歌曲" color={config.secondaryColor} />
                ) : null}
              </Section>
            )}

            {hasHistory && (
              <Section label={config.historyLabel} count={historySongs.length} config={config} flex={`${historyFlex} 1 0`}>
                {historySongs.length ? (
                  <AutoScrollArea enabled={config.autoScroll} speed={config.autoScrollSpeed} pauseMs={config.autoScrollPauseMs}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: config.density === 'compact' ? 6 : 8 }}>
                      {historySongs.map((song, index) => (
                        <SetlistRow key={`${song.id}-${index}`} song={song} config={config} />
                      ))}
                    </div>
                  </AutoScrollArea>
                ) : config.emptyState === 'waiting' ? (
                  <EmptyText text="尚無已唱歌曲" color={config.secondaryColor} />
                ) : null}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const Section: React.FC<{
  label: string;
  count?: number;
  config: SetlistOverlayTemplateConfig;
  flex: React.CSSProperties['flex'];
  children: React.ReactNode;
  showCount?: boolean;
}> = ({ label, count = 0, config, flex, children, showCount = true }) => (
  <section style={{ flex, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{
      flex: '0 0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      color: config.accentColor,
      fontSize: 12,
      fontWeight: 900,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      borderBottom: `1px solid ${config.accentColor}66`,
      paddingBottom: 5,
    }}>
      <span>{label}</span>
      {showCount && config.showCounts && <span>{count}</span>}
    </div>
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: config.density === 'compact' ? 6 : 8,
      overflow: 'hidden',
      minHeight: 0,
    }}>
      {children}
    </div>
  </section>
);

const WaitingCurrent: React.FC<{ text: string; song: OverlaySongMetadata | null; config: SetlistOverlayTemplateConfig }> = ({ text, song, config }) => {
  const title = song?.title || '...';

  return (
    <div style={{
      borderRadius: config.innerRadius,
      border: `1px solid ${config.accentColor}55`,
      background: `${config.accentColor}12`,
      padding: config.density === 'compact' ? '10px 12px' : '14px 16px',
      color: config.textColor,
    }}>
      <div style={{ color: config.accentColor, fontSize: 12, fontWeight: 900, letterSpacing: 1.3 }}>{text}</div>
      <div style={{ marginTop: 6, minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 850, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: song ? 1 : 0.55 }}>{title}</div>
        {song && config.showArtist && <div style={{ color: config.secondaryColor, fontSize: 13, marginTop: 2 }}>{song.artist || 'Unknown Artist'}</div>}
      </div>
    </div>
  );
};

const EmptyText: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <div style={{ color, fontSize: 13, opacity: 0.75, padding: '8px 4px' }}>{text}</div>
);

export function useOverlayDesignFromConfig<T extends LyricsOverlayDesign | SetlistOverlayDesign>(design: T) {
  return useMemo(() => design, [design]);
}
