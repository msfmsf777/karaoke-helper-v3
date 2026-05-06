import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { EditableLyricLine } from '../../library/lyrics';
import { EnrichedLyricLine, SongMeta } from '../../../shared/songTypes';
import {
  LyricsOverlayDesign,
  LyricsOverlayTemplateConfig,
  OverlayPlaybackMode,
  SetlistOverlayDesign,
  SetlistOverlayTemplateConfig,
} from '../../../shared/overlayTemplates';
import i18nInstance from '../../i18n';

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

const overlayDefaultTextKeys: Record<string, string> = {
  '歌唱中': 'overlays.defaults.currentLabel',
  'Now Singing': 'overlays.defaults.currentLabel',
  '下一首': 'overlays.defaults.upcomingLabel',
  'Up Next': 'overlays.defaults.upcomingLabel',
  '已唱': 'overlays.defaults.historyLabel',
  'Sung': 'overlays.defaults.historyLabel',
  '等待下一首': 'overlays.defaults.waitingNext',
  'Waiting for next song': 'overlays.defaults.waitingNext',
  '尚未播放': 'overlays.defaults.notPlaying',
  'Nothing playing': 'overlays.defaults.notPlaying',
};

const localizeOverlayDefaultText = (t: TFunction, value?: string) => {
  if (!value) return value;
  const key = overlayDefaultTextKeys[value];
  return key ? t(key) : value;
};

const localizeSetlistConfig = (t: TFunction, config: SetlistOverlayTemplateConfig): SetlistOverlayTemplateConfig => ({
  ...config,
  currentLabel: localizeOverlayDefaultText(t, config.currentLabel) ?? config.currentLabel,
  upcomingLabel: localizeOverlayDefaultText(t, config.upcomingLabel) ?? config.upcomingLabel,
  historyLabel: localizeOverlayDefaultText(t, config.historyLabel) ?? config.historyLabel,
  waitingText: localizeOverlayDefaultText(t, config.waitingText) ?? config.waitingText,
});

const overlayText = (key: string) => i18nInstance.t(key);

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

const getOffsetTopWithin = (element: HTMLElement, ancestor: HTMLElement) => {
  let offsetTop = 0;
  let node: HTMLElement | null = element;

  while (node && node !== ancestor) {
    offsetTop += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }

  return node === ancestor ? offsetTop : null;
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
  const { t } = useTranslation();
  const config = design.config;
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const currentIdx = status === 'synced' ? getActiveLineIndex(lines, currentTime) : -1;
  const visibleRange = getVisibleLineRange(lines.length, currentIdx, config);
  const showFurigana = config.furiganaPolicy === 'show' || (config.furiganaPolicy === 'follow_app' && furiganaEnabled);
  const showRomaji = config.romajiPolicy === 'show' || (config.romajiPolicy === 'follow_app' && romajiEnabled);
  const usesEntranceAnimation = config.animation === 'fade' || config.animation === 'slide' || config.animation === 'scale';

  useLayoutEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer || status !== 'synced') return;
    if (currentIdx < 0) {
      scrollContainer.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    const centerActiveLine = () => {
      const activeLine = activeLineRef.current;
      if (!activeLine || scrollContainer.clientHeight <= 0 || activeLine.offsetHeight <= 0) return;

      const activeOffsetTop = getOffsetTopWithin(activeLine, scrollContainer);
      if (activeOffsetTop === null) return;

      const activeCenter = activeOffsetTop + activeLine.offsetHeight / 2;
      const targetTop = activeCenter - scrollContainer.clientHeight / 2;
      const maxTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
      const nextTop = Math.max(0, Math.min(maxTop, targetTop));

      if (trackRef.current) {
        const originY = Math.max(0, activeCenter - trackRef.current.offsetTop);
        trackRef.current.style.transformOrigin = `center ${originY}px`;
      }

      scrollContainer.scrollTo({
        top: nextTop,
        behavior: config.animation === 'scroll' ? 'smooth' : 'auto',
      });
    };

    centerActiveLine();
    const frame = requestAnimationFrame(centerActiveLine);
    const settleTimer = usesEntranceAnimation
      ? window.setTimeout(centerActiveLine, config.animationDurationMs + 60)
      : 0;

    return () => {
      cancelAnimationFrame(frame);
      if (settleTimer) window.clearTimeout(settleTimer);
    };
  }, [
    currentIdx,
    status,
    config.lineMode,
    config.activeFontSize,
    config.inactiveFontSize,
    config.lineGap,
    config.animation,
    config.animationDurationMs,
    config.letterSpacing,
    config.romajiLetterSpacing,
    config.romajiMarginTop,
    showFurigana,
    showRomaji,
    usesEntranceAnimation,
    lines.length,
  ]);

  if (status === 'none' || lines.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: config.inactiveColor, fontFamily: config.fontFamily }}>
        {t('domain.lyricsStatus.none')}
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
            position: 'relative',
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
            ref={trackRef}
            key={usesEntranceAnimation ? `${config.animation}-${currentIdx}` : 'lyric-scroll-track'}
            style={{
              width: '100%',
              transformOrigin: 'center center',
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
                    transition: config.animation === 'none' ? 'none' : 'color 180ms ease, opacity 180ms ease',
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
  const isLightPanel = config.presetId === 'clean_white';

  if (config.frameStyle === 'solid') {
    return {
      ...base,
      background: isLightPanel ? 'rgba(255,255,255,0.9)' : 'rgba(8, 12, 18, 0.86)',
      borderColor: isLightPanel ? 'rgba(17,24,39,0.18)' : 'rgba(255,255,255,0.12)',
      boxShadow: isLightPanel ? '0 18px 46px rgba(0,0,0,0.18)' : undefined,
    };
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
        animation: getSetlistChangeAnimation(config),
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

const SetlistAnimationStyles: React.FC = () => (
  <style>{`
    @keyframes khelperSetlistFade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes khelperSetlistSlide { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes khelperSetlistDiskSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes khelperSetlistTicker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    @keyframes khelperSetlistTextMarquee { 0%, 12% { transform: translateX(0); } 88%, 100% { transform: translateX(calc(-50% - 14px)); } }
    @keyframes khelperSetlistLightBreathe { 0%, 100% { opacity: .42; transform: scale(.92); } 50% { opacity: 1; transform: scale(1.08); } }
    @keyframes khelperSetlistLightFlash { 0%, 48%, 100% { opacity: .36; } 50%, 72% { opacity: 1; } }
    @keyframes khelperSetlistLightChase { 0% { filter: brightness(.72); } 35% { filter: brightness(1.75); } 70%, 100% { filter: brightness(.72); } }
    @keyframes khelperSetlistCardSlide { from { opacity: 0; transform: translateX(42px) rotate(-4deg); } to { opacity: 1; transform: translateX(0) rotate(var(--khelper-card-tilt, -1deg)); } }
  `}</style>
);

const getSetlistChangeAnimation = (config: SetlistOverlayTemplateConfig): React.CSSProperties['animation'] => {
  if (config.changeAnimation === 'none') return undefined;
  return `khelperSetlist${config.changeAnimation === 'fade' ? 'Fade' : 'Slide'} 260ms ease both`;
};

const getSetlistCurrentAnimationKey = (
  state: OverlaySetlistState,
  current: ReturnType<typeof getSetlistCurrentDisplay>
) => `${state.isStreamWaiting ? 'waiting' : 'playing'}-${current.song?.id ?? 'empty'}-${current.title}`;

const ScrollingText: React.FC<{
  text: string;
  threshold?: number;
  style?: React.CSSProperties;
}> = ({ text, threshold = 24, style }) => {
  const shouldScroll = Array.from(text || '').length > threshold;
  return (
    <div style={{ ...style, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: shouldScroll ? undefined : 'ellipsis' }}>
      {shouldScroll ? (
        <span style={{
          display: 'inline-flex',
          gap: 28,
          minWidth: 'max-content',
          animation: 'khelperSetlistTextMarquee 12s ease-in-out infinite',
        }}>
          <span>{text}</span>
          <span>{text}</span>
        </span>
      ) : text}
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

interface SetlistViewData {
  currentSong: OverlaySongMetadata | null;
  upcomingStart: number;
  upcomingSongs: OverlaySongMetadata[];
  historySongs: OverlaySongMetadata[];
  waitingSong: OverlaySongMetadata | null;
}

const getSetlistCurrentDisplay = (
  config: SetlistOverlayTemplateConfig,
  state: OverlaySetlistState,
  view: SetlistViewData
) => {
  const song = state.isStreamWaiting
    ? config.emptyState === 'waiting' && config.showWaitingSongTitle
      ? view.waitingSong
      : null
    : view.currentSong;
  const label = state.isStreamWaiting
    ? config.emptyState === 'waiting'
      ? config.waitingText || config.currentLabel
      : '...'
    : config.currentLabel;

  return {
    song,
    label,
    title: song?.title || '...',
    artist: song?.artist || 'Unknown Artist',
  };
};

const alphaHex = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0');

const getTickerDuration = (speed: number) => `${Math.max(10, 42 - Math.max(1, Math.min(10, speed)) * 3)}s`;

const getTextEffectStyle = (config: SetlistOverlayTemplateConfig): React.CSSProperties => {
  if (config.templateOptions.textEffect === 'lcd') {
    return {
      letterSpacing: 1,
      textShadow: `0 0 10px ${config.accentColor}66`,
      fontVariantNumeric: 'tabular-nums',
    };
  }
  if (config.templateOptions.textEffect === 'pixel') {
    return {
      letterSpacing: 1.4,
      textShadow: `1px 0 ${config.accentColor}55, 0 1px ${config.accentColor}44`,
      imageRendering: 'pixelated',
      fontVariantNumeric: 'tabular-nums',
    };
  }
  return {};
};

const getLightColor = (config: SetlistOverlayTemplateConfig, index: number) => {
  if (config.templateOptions.lightPalette === 'warm') {
    return ['#facc15', '#fb923c', '#fff7ad'][index % 3];
  }
  if (config.templateOptions.lightPalette === 'cool') {
    return ['#38bdf8', '#818cf8', '#a5f3fc'][index % 3];
  }
  if (config.templateOptions.lightPalette === 'rainbow' || config.templateOptions.lightAnimation === 'rainbow') {
    return ['#fb7185', '#facc15', '#34d399', '#38bdf8', '#a78bfa'][index % 5];
  }
  return config.accentColor;
};

export const TemplatedSetlistOverlay: React.FC<{
  design: SetlistOverlayDesign;
  state: OverlaySetlistState;
  preview?: boolean;
}> = ({ design, state, preview = false }) => {
  const { t } = useTranslation();
  const config = useMemo(() => localizeSetlistConfig(t, design.config), [design.config, t]);
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
  const view: SetlistViewData = {
    currentSong,
    upcomingStart,
    upcomingSongs,
    historySongs,
    waitingSong,
  };

  if (config.templateId === 'compact_strip') {
    return <CompactStripSetlist config={config} state={state} view={view} preview={preview} />;
  }

  if (config.templateId === 'neon_signboard') {
    return <NeonSignboardSetlist config={config} state={state} view={view} preview={preview} />;
  }

  if (config.templateId === 'countdown_counter') {
    return <CountdownCounterSetlist config={config} state={state} view={view} preview={preview} />;
  }

  if (config.templateId === 'index_grid') {
    return <IndexGridSetlist config={config} state={state} view={view} preview={preview} />;
  }

  if (config.templateId === 'pager_console') {
    return <PagerConsoleSetlist config={config} state={state} view={view} preview={preview} />;
  }

  if (config.templateId === 'cassette_deck') {
    return <CassetteDeckSetlist config={config} state={state} view={view} preview={preview} />;
  }

  if (config.templateId === 'stage_marquee') {
    return <StageMarqueeSetlist config={config} state={state} view={view} preview={preview} />;
  }

  if (config.templateId === 'photo_stack') {
    return <PhotoStackSetlist config={config} state={state} view={view} preview={preview} />;
  }

  if (config.templateId === 'vertical_column') {
    return <VerticalColumnSetlist config={config} state={state} view={view} preview={preview} />;
  }

  if (config.templateId === 'spinning_disk_list') {
    return <SpinningDiskListSetlist config={config} state={state} view={view} preview={preview} />;
  }

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
        padding: preview ? 26 : 0,
        background: 'transparent',
        color: config.textColor,
        fontFamily: config.fontFamily,
        overflow: 'hidden',
      }}
    >
      <SetlistAnimationStyles />
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          padding: preview ? 20 : 12,
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
                  ? (config.waitingText || (state.playbackMode === 'stream' ? overlayText('overlays.defaults.waitingNext') : overlayText('overlays.defaults.notPlaying')))
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
                  <EmptyText text={overlayText('overlays.defaults.noUpcoming')} color={config.secondaryColor} />
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
                  <EmptyText text={overlayText('overlays.defaults.noHistory')} color={config.secondaryColor} />
                ) : null}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const CompactStripSetlist: React.FC<{
  config: SetlistOverlayTemplateConfig;
  state: OverlaySetlistState;
  view: SetlistViewData;
  preview: boolean;
}> = ({ config, state, view, preview }) => {
  const current = getSetlistCurrentDisplay(config, state, view);
  const stripHeight = preview ? config.presetId === 'minimal_text' ? '24%' : '32%' : '100%';
  return (
    <div style={{
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      padding: preview ? 28 : 0,
      display: 'flex',
      alignItems: preview ? 'flex-end' : 'stretch',
      color: config.textColor,
      fontFamily: config.fontFamily,
      overflow: 'hidden',
    }}>
      <SetlistAnimationStyles />
      <div style={{
        width: '100%',
        height: stripHeight,
        minHeight: preview ? 132 : 0,
        boxSizing: 'border-box',
        padding: preview
          ? config.presetId === 'tag_queue' ? '18px 22px' : '16px 20px'
          : config.presetId === 'tag_queue' ? '14px 18px' : '12px 16px',
        display: 'grid',
        gridTemplateColumns: config.showUpcoming ? 'minmax(240px, 0.42fr) minmax(0, 1fr)' : 'minmax(0, 1fr)',
        gap: 18,
        ...getFrameStyle(config),
        borderRadius: config.outerRadius,
      }}>
        <div
          style={{
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          {config.showThumbnails && current.song?.thumbnailUrl && (
            <img src={current.song.thumbnailUrl} alt="" style={{
              width: 76,
              height: 76,
              borderRadius: Math.min(18, config.innerRadius),
              objectFit: 'cover',
              boxShadow: `0 0 18px ${config.accentColor}44`,
            }} />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ color: config.accentColor, fontSize: 13, fontWeight: 900, letterSpacing: 1.6 }}>
              {current.label}
            </div>
            <div style={{
              fontSize: 30,
              fontWeight: 900,
              lineHeight: 1.1,
              marginTop: 8,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {current.title}
            </div>
            {config.showArtist && current.song && (
              <div style={{ color: config.secondaryColor, fontSize: 14, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {current.artist}
              </div>
            )}
          </div>
        </div>
        {config.showUpcoming && (
          <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: config.accentColor, fontSize: 12, fontWeight: 900, letterSpacing: 1.2 }}>
              <span>{config.upcomingLabel}</span>
              {config.showCounts && <span>{view.upcomingSongs.length}</span>}
            </div>
            <AutoScrollArea enabled={config.autoScroll} speed={config.autoScrollSpeed} pauseMs={config.autoScrollPauseMs}>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignContent: 'flex-start',
                gap: 8,
              }}>
                {view.upcomingSongs.length ? view.upcomingSongs.map((song, index) => (
                  <div key={`${song.id}-${index}`} style={{
                    maxWidth: 220,
                    minWidth: 0,
                    padding: config.presetId === 'tag_queue' ? '8px 14px' : '7px 10px',
                    borderRadius: config.presetId === 'tag_queue' ? 999 : config.innerRadius,
                    background: state.isStreamWaiting && index === 0 ? `${config.accentColor}34` : 'rgba(255,255,255,0.08)',
                    border: state.isStreamWaiting && index === 0 ? `1px solid ${config.accentColor}aa` : '1px solid rgba(255,255,255,0.1)',
                    color: config.textColor,
                    fontSize: config.density === 'compact' ? 14 : 15,
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    animation: getSetlistChangeAnimation(config),
                  }}>
                    {config.showNumbering ? `${view.upcomingStart + index + 1}. ` : ''}{song.title}
                    {config.showDuration ? ` · ${formatDuration(song.duration)}` : ''}
                  </div>
                )) : (
                  <EmptyText text={overlayText('overlays.defaults.noUpcoming')} color={config.secondaryColor} />
                )}
              </div>
            </AutoScrollArea>
          </div>
        )}
      </div>
    </div>
  );
};

const NeonSignboardSetlist: React.FC<{
  config: SetlistOverlayTemplateConfig;
  state: OverlaySetlistState;
  view: SetlistViewData;
  preview: boolean;
}> = ({ config, state, view, preview }) => {
  const hasHistory = config.showHistory;
  const current = getSetlistCurrentDisplay(config, state, view);
  return (
    <div style={{
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      padding: preview ? 34 : 0,
      color: config.textColor,
      fontFamily: config.fontFamily,
      overflow: 'hidden',
      background: `radial-gradient(circle at 50% 0%, ${config.accentColor}22, transparent 42%)`,
    }}>
      <SetlistAnimationStyles />
      <div style={{
        width: preview ? '58%' : '100%',
        height: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
        padding: preview ? 22 : 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        transform: preview && config.presetId === 'pink_neon' ? 'rotate(-1deg)' : undefined,
        ...getFrameStyle(config),
        boxShadow: `0 0 28px ${config.accentColor}88, inset 0 0 24px ${config.accentColor}22`,
      }}>
        {config.showCurrent && (
          <div key={getSetlistCurrentAnimationKey(state, current)} style={{
            flex: '0 0 auto',
            border: `2px solid ${config.accentColor}`,
            borderRadius: config.innerRadius,
            padding: '14px 18px',
            background: `${config.accentColor}16`,
            boxShadow: `0 0 18px ${config.accentColor}66`,
            animation: getSetlistChangeAnimation(config),
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: config.accentColor, fontWeight: 900, fontSize: 13, letterSpacing: 2 }}>
              <span>{current.label}</span>
              {config.showCounts && <span>{view.upcomingSongs.length}</span>}
            </div>
            <div style={{ marginTop: 10, fontSize: 30, fontWeight: 900, textShadow: `0 0 14px ${config.accentColor}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {current.title}
            </div>
            {config.showArtist && current.song && (
              <div style={{ color: config.secondaryColor, fontSize: 14, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {current.artist}
              </div>
            )}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: hasHistory ? '2fr 1fr' : '1fr', gap: 14 }}>
          {config.showUpcoming && (
            <Section label={config.upcomingLabel} count={view.upcomingSongs.length} config={config} flex="1 1 0">
              <AutoScrollArea enabled={config.autoScroll} speed={config.autoScrollSpeed} pauseMs={config.autoScrollPauseMs}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {view.upcomingSongs.map((song, index) => (
                    <SetlistRow
                      key={`${song.id}-${index}`}
                      song={song}
                      index={view.upcomingStart + index + 1}
                      config={config}
                      waitingNext={state.isStreamWaiting && index === 0}
                    />
                  ))}
                </div>
              </AutoScrollArea>
            </Section>
          )}
          {hasHistory && (
            <Section label={config.historyLabel} count={view.historySongs.length} config={config} flex="1 1 0">
              <AutoScrollArea enabled={config.autoScroll} speed={config.autoScrollSpeed} pauseMs={config.autoScrollPauseMs}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {view.historySongs.map((song, index) => (
                    <SetlistRow key={`${song.id}-${index}`} song={song} config={config} />
                  ))}
                </div>
              </AutoScrollArea>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
};

const CountdownCounterSetlist: React.FC<{
  config: SetlistOverlayTemplateConfig;
  state: OverlaySetlistState;
  view: SetlistViewData;
  preview: boolean;
}> = ({ config, state, view, preview }) => {
  const reserveCount = config.showUpcoming ? view.upcomingSongs.length : 0;
  const current = getSetlistCurrentDisplay(config, state, view);
  return (
    <div style={{
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      padding: preview ? 36 : 0,
      display: 'grid',
      placeItems: 'center',
      color: config.textColor,
      fontFamily: config.fontFamily,
      overflow: 'hidden',
      background: config.presetId === 'gold_countdown'
        ? `radial-gradient(circle at 50% 40%, ${config.accentColor}22, transparent 42%)`
        : undefined,
    }}>
      <SetlistAnimationStyles />
      <div style={{
        width: preview ? '64%' : '100%',
        height: preview ? '74%' : '100%',
        boxSizing: 'border-box',
        padding: preview ? 24 : 16,
        display: 'grid',
        gridTemplateRows: 'auto auto minmax(0, 1fr)',
        gap: 14,
        textAlign: 'center',
        overflow: 'hidden',
        ...getFrameStyle(config),
      }}>
        <div style={{ color: config.secondaryColor, fontSize: 16, fontWeight: 800, letterSpacing: 3 }}>
          {config.upcomingLabel}
        </div>
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <div style={{
            width: 136,
            height: 136,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            border: `2px solid ${config.accentColor}`,
            color: config.accentColor,
            fontSize: 66,
            fontWeight: 950,
            lineHeight: 1,
            textShadow: `0 0 18px ${config.accentColor}88`,
            boxShadow: `0 0 24px ${config.accentColor}55, inset 0 0 20px ${config.accentColor}18`,
          }}>
            {reserveCount}
          </div>
        </div>
        <div style={{ minHeight: 0, overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: 12 }}>
          <div key={getSetlistCurrentAnimationKey(state, current)} style={{
            borderRadius: config.innerRadius,
            background: `${config.accentColor}12`,
            padding: '10px 16px',
            border: `1px solid ${config.accentColor}44`,
            animation: getSetlistChangeAnimation(config),
          }}>
            <div style={{ color: config.accentColor, fontSize: 12, fontWeight: 900, letterSpacing: 2 }}>
              {current.label}
            </div>
            <div style={{ marginTop: 6, fontSize: 26, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {current.title}
            </div>
            {config.showArtist && current.song && (
              <div style={{ color: config.secondaryColor, marginTop: 3, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {current.artist}
              </div>
            )}
          </div>
          {config.showUpcoming && (
            <AutoScrollArea enabled={config.autoScroll} speed={config.autoScrollSpeed} pauseMs={config.autoScrollPauseMs}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
                {view.upcomingSongs.map((song, index) => (
                  <SetlistRow
                    key={`${song.id}-${index}`}
                    song={song}
                    index={view.upcomingStart + index + 1}
                    config={config}
                    waitingNext={state.isStreamWaiting && index === 0}
                  />
                ))}
              </div>
            </AutoScrollArea>
          )}
        </div>
      </div>
    </div>
  );
};

const IndexGridSetlist: React.FC<{
  config: SetlistOverlayTemplateConfig;
  state: OverlaySetlistState;
  view: SetlistViewData;
  preview: boolean;
}> = ({ config, state, view, preview }) => {
  const allSongs = config.showUpcoming
    ? state.queue.map((id) => state.songs[id]).filter(Boolean)
    : [];
  const columns = Math.max(2, Math.min(6, config.gridColumns || 4));
  const current = getSetlistCurrentDisplay(config, state, view);
  return (
    <div style={{
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      padding: preview ? 34 : 0,
      color: config.textColor,
      fontFamily: config.fontFamily,
      overflow: 'hidden',
      background: config.presetId === 'rose_grid'
        ? `linear-gradient(135deg, ${config.accentColor}18, transparent 55%)`
        : undefined,
    }}>
      <SetlistAnimationStyles />
      <div style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: preview ? 22 : 12,
        display: 'grid',
        gridTemplateRows: config.showCurrent ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)',
        gap: 16,
        ...getFrameStyle(config),
      }}>
        {config.showCurrent && (
          <div key={getSetlistCurrentAnimationKey(state, current)} style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: 14,
            alignItems: 'center',
            padding: '12px 16px',
            borderRadius: config.innerRadius,
            border: `1px solid ${config.accentColor}55`,
            background: `${config.accentColor}12`,
            animation: getSetlistChangeAnimation(config),
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: config.accentColor, fontSize: 12, fontWeight: 900, letterSpacing: 2 }}>
                {current.label}
              </div>
              <div style={{ marginTop: 5, fontSize: 26, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {current.title}
              </div>
            </div>
            {config.showCounts && <div style={{ color: config.accentColor, fontSize: 34, fontWeight: 950 }}>{allSongs.length}</div>}
          </div>
        )}
        <AutoScrollArea enabled={config.autoScroll} speed={config.autoScrollSpeed} pauseMs={config.autoScrollPauseMs}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: config.density === 'compact' ? 8 : 10,
          }}>
            {allSongs.map((song, index) => {
              const active = !state.isStreamWaiting && index === state.currentIndex;
              const waitingNext = state.isStreamWaiting && index === state.currentIndex;
              return (
                <div key={`${song.id}-${index}`} style={{
                  minWidth: 0,
                  padding: config.density === 'compact' ? '7px 8px' : '9px 10px',
                  borderRadius: config.innerRadius,
                  background: active || waitingNext ? `${config.accentColor}24` : 'rgba(255,255,255,0.04)',
                  border: active || waitingNext ? `1px solid ${config.accentColor}88` : '1px solid rgba(255,255,255,0.08)',
                  animation: getSetlistChangeAnimation(config),
                  display: 'grid',
                  gridTemplateColumns: config.showNumbering ? '30px minmax(0,1fr)' : 'minmax(0,1fr)',
                  gap: 8,
                  alignItems: 'center',
                }}>
                  {config.showNumbering && (
                    <div style={{ color: active || waitingNext ? config.accentColor : config.secondaryColor, fontWeight: 900, fontSize: 13, textAlign: 'right' }}>
                      {index + 1}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: config.density === 'compact' ? 14 : 15, fontWeight: active || waitingNext ? 900 : 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {song.title}
                    </div>
                    {(config.showArtist || config.showDuration) && (
                      <div style={{ color: config.secondaryColor, fontSize: 11, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {config.showArtist ? (song.artist || 'Unknown Artist') : ''}
                        {config.showArtist && config.showDuration ? ' · ' : ''}
                        {config.showDuration ? formatDuration(song.duration) : ''}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </AutoScrollArea>
      </div>
    </div>
  );
};

const GraphicReserveList: React.FC<{
  config: SetlistOverlayTemplateConfig;
  state: OverlaySetlistState;
  view: SetlistViewData;
  compact?: boolean;
}> = ({ config, state, view, compact = false }) => (
  <AutoScrollArea enabled={config.autoScroll} speed={config.autoScrollSpeed} pauseMs={config.autoScrollPauseMs}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8 }}>
      {view.upcomingSongs.length ? view.upcomingSongs.map((song, index) => (
        <SetlistRow
          key={`${song.id}-${index}`}
          song={song}
          index={view.upcomingStart + index + 1}
          config={config}
          waitingNext={state.isStreamWaiting && index === 0}
        />
      )) : (
        <EmptyText text={overlayText('overlays.defaults.noUpcoming')} color={config.secondaryColor} />
      )}
    </div>
  </AutoScrollArea>
);

const PagerConsoleSetlist: React.FC<{
  config: SetlistOverlayTemplateConfig;
  state: OverlaySetlistState;
  view: SetlistViewData;
  preview: boolean;
}> = ({ config, state, view, preview }) => {
  const current = getSetlistCurrentDisplay(config, state, view);
  const lcdColor = config.presetId === 'lime_lcd' ? '#bdd3a5' : config.presetId === 'amber_lcd' ? '#2f2110' : '#0f172a';
  const shellColor = config.presetId === 'lime_lcd' ? '#49698a' : config.presetId === 'amber_lcd' ? '#5b3920' : '#1f2937';
  const tickerItems = config.templateOptions.tickerSource === 'history' ? view.historySongs : view.upcomingSongs;
  const tickerLabel = config.templateOptions.tickerSource === 'history' ? config.historyLabel : config.upcomingLabel;
  const tickerText = tickerItems.map((song) => `${song.title}${config.showArtist && song.artist ? ` / ${song.artist}` : ''}`).join('   ·   ');
  const lcdTextStyle = getTextEffectStyle(config);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      padding: preview ? 34 : 0,
      display: 'grid',
      placeItems: 'center',
      color: config.textColor,
      fontFamily: config.fontFamily,
      overflow: 'hidden',
      background: `radial-gradient(circle at 50% 18%, ${config.accentColor}${Math.round(config.templateOptions.textureOpacity * 80).toString(16).padStart(2, '0')}, transparent 50%)`,
    }}>
      <SetlistAnimationStyles />
      <div style={{
        width: preview ? '78%' : '100%',
        height: preview ? '76%' : '100%',
        maxWidth: preview ? 820 : undefined,
        boxSizing: 'border-box',
        padding: preview ? 28 : 22,
        borderRadius: config.outerRadius,
        border: '3px solid rgba(0,0,0,0.55)',
        background: `linear-gradient(145deg, ${shellColor}, rgba(255,255,255,0.18)), ${shellColor}`,
        boxShadow: `inset 0 0 0 2px rgba(255,255,255,0.18), 0 20px 48px rgba(0,0,0,0.35)`,
        display: 'grid',
        gridTemplateRows: 'minmax(0, 1fr) auto',
        gap: 18,
        overflow: 'hidden',
      }}>
        <div style={{
          minHeight: 0,
          display: 'grid',
          gridTemplateRows: config.showUpcoming ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)',
          gap: 14,
          padding: preview ? 18 : 14,
          borderRadius: config.innerRadius,
          background: lcdColor,
          color: config.presetId === 'lime_lcd' ? '#344234' : config.textColor,
          boxShadow: `inset 0 0 0 4px rgba(0,0,0,0.45), inset 0 0 28px rgba(0,0,0,${config.templateOptions.textureOpacity})`,
        }}>
          <div key={getSetlistCurrentAnimationKey(state, current)} style={{
            minWidth: 0,
            minHeight: 0,
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
            animation: getSetlistChangeAnimation(config),
          }}>
            <div style={{ width: '100%', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 2.5, opacity: 0.72, ...lcdTextStyle }}>{current.label}</div>
              <ScrollingText
                text={current.title}
                threshold={18}
                style={{
                  marginTop: 12,
                  fontSize: 'clamp(34px, 8vw, 82px)',
                  lineHeight: 1.02,
                  fontWeight: 950,
                  ...lcdTextStyle,
                }}
              />
              {config.showArtist && current.song && (
                <ScrollingText
                  text={current.artist}
                  threshold={28}
                  style={{ marginTop: 8, fontSize: 'clamp(14px, 2.1vw, 24px)', fontWeight: 800, opacity: 0.72, ...lcdTextStyle }}
                />
              )}
            </div>
          </div>
          {config.showUpcoming && tickerText && (
            <div style={{
              minWidth: 0,
              overflow: 'hidden',
              borderTop: `1px solid ${config.accentColor}${alphaHex(0.38)}`,
              background: 'rgba(0,0,0,0.16)',
              padding: '8px 10px',
              fontSize: 14,
              fontWeight: 850,
              whiteSpace: 'nowrap',
            }}>
              <div style={{
                display: 'inline-flex',
                gap: 32,
                minWidth: '200%',
                animation: `khelperSetlistTicker ${getTickerDuration(config.templateOptions.tickerSpeed)} linear infinite`,
                ...lcdTextStyle,
              }}>
                <span>{tickerLabel}: {tickerText}</span>
                <span>{tickerLabel}: {tickerText}</span>
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.9 }}>
          <div style={{ fontStyle: 'italic', fontWeight: 700, color: '#fff' }}>{config.templateOptions.footerLabel}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[0, 1, 2].map((item) => (
              <div key={item} style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(#fff, #bbb)', boxShadow: 'inset 0 -4px 8px rgba(0,0,0,0.22)' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const CassetteDeckSetlist: React.FC<{
  config: SetlistOverlayTemplateConfig;
  state: OverlaySetlistState;
  view: SetlistViewData;
  preview: boolean;
}> = ({ config, state, view, preview }) => {
  const current = getSetlistCurrentDisplay(config, state, view);
  const reelSpin = config.templateOptions.diskSpinMode !== 'off' && !state.isStreamWaiting;
  const reelDuration = `${Math.max(1.5, 10 - config.templateOptions.diskSpinSpeed * 0.7)}s`;
  const depth = config.templateOptions.cassetteDepth;
  const shellLight = config.presetId === 'cream_retro' ? 'rgba(255,247,220,0.92)' : config.presetId === 'noir_tape' ? 'rgba(26,28,32,0.96)' : 'rgba(34,36,48,0.88)';
  const labelBg = config.presetId === 'cream_retro' ? '#fff7d6' : config.presetId === 'noir_tape' ? '#111827' : `${config.accentColor}20`;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      padding: preview ? 36 : 0,
      color: config.textColor,
      fontFamily: config.fontFamily,
      overflow: 'hidden',
      background: `linear-gradient(135deg, ${config.accentColor}${Math.round(config.templateOptions.textureOpacity * 120).toString(16).padStart(2, '0')}, transparent 60%)`,
    }}>
      <SetlistAnimationStyles />
      <div style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: preview ? 42 : 22,
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
      }}>
        <div
          key={getSetlistCurrentAnimationKey(state, current)}
          style={{
            width: 'min(92%, 980px)',
            aspectRatio: '1.68',
            borderRadius: `clamp(18px, ${config.outerRadius}px, 42px)`,
            padding: 'clamp(18px, 4vw, 46px)',
            boxSizing: 'border-box',
            position: 'relative',
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr) auto',
            gap: 'clamp(12px, 2vw, 22px)',
            color: config.textColor,
            background: `
              linear-gradient(145deg, rgba(255,255,255,${0.1 + depth * 0.18}), transparent 28%),
              linear-gradient(315deg, rgba(0,0,0,${0.22 + depth * 0.35}), transparent 34%),
              ${shellLight}
            `,
            border: `2px solid rgba(255,255,255,${0.14 + depth * 0.18})`,
            boxShadow: `0 ${Math.round(18 + depth * 38)}px ${Math.round(32 + depth * 50)}px rgba(0,0,0,${0.22 + depth * 0.28}), inset 0 0 0 3px rgba(255,255,255,0.08), inset 0 -18px 40px rgba(0,0,0,${0.12 + depth * 0.22})`,
            animation: getSetlistChangeAnimation(config),
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: config.accentColor, fontWeight: 950, letterSpacing: 2, fontSize: 'clamp(12px, 1.5vw, 18px)' }}>
            <span>{current.label}</span>
            {config.showDuration && current.song && <span>{formatDuration(current.song.duration)}</span>}
          </div>

          <div style={{
            minHeight: 0,
            borderRadius: 'clamp(14px, 2vw, 24px)',
            border: `2px solid ${config.accentColor}55`,
            background: 'rgba(0,0,0,0.22)',
            display: 'grid',
            gridTemplateRows: 'minmax(0, 1fr) auto',
            gap: 'clamp(10px, 2vw, 18px)',
            padding: 'clamp(14px, 3vw, 34px)',
            boxShadow: 'inset 0 0 24px rgba(0,0,0,0.35)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(120px, 0.8fr) 1fr', alignItems: 'center', gap: 'clamp(12px, 3vw, 34px)' }}>
              <div style={{
                justifySelf: 'end',
                width: 'clamp(78px, 14vw, 152px)',
                aspectRatio: '1',
                borderRadius: '50%',
                border: `clamp(8px, 1.4vw, 16px) solid rgba(255,255,255,0.18)`,
                background: `repeating-conic-gradient(from 0deg, ${config.accentColor} 0 8deg, rgba(255,255,255,0.18) 8deg 16deg, rgba(0,0,0,0.28) 16deg 24deg)`,
                boxShadow: `0 0 24px ${config.accentColor}44, inset 0 0 22px rgba(0,0,0,0.42)`,
                animation: reelSpin ? `khelperSetlistDiskSpin ${reelDuration} linear infinite` : undefined,
              }} />
              <div style={{
                justifySelf: 'center',
                width: '100%',
                height: '56%',
                borderRadius: 999,
                border: `2px solid ${config.accentColor}55`,
                background: 'linear-gradient(90deg, rgba(0,0,0,0.45), rgba(255,255,255,0.12), rgba(0,0,0,0.45))',
              }} />
              <div style={{
                justifySelf: 'start',
                width: 'clamp(78px, 14vw, 152px)',
                aspectRatio: '1',
                borderRadius: '50%',
                border: `clamp(8px, 1.4vw, 16px) solid rgba(255,255,255,0.18)`,
                background: `repeating-conic-gradient(from 0deg, ${config.accentColor} 0 8deg, rgba(255,255,255,0.18) 8deg 16deg, rgba(0,0,0,0.28) 16deg 24deg)`,
                boxShadow: `0 0 24px ${config.accentColor}44, inset 0 0 22px rgba(0,0,0,0.42)`,
                animation: reelSpin ? `khelperSetlistDiskSpin ${reelDuration} linear infinite` : undefined,
              }} />
            </div>
            <div key={getSetlistCurrentAnimationKey(state, current)} style={{
              minWidth: 0,
              textAlign: 'center',
              padding: 'clamp(10px, 2vw, 18px) clamp(14px, 3vw, 28px)',
              borderRadius: 'clamp(8px, 1.5vw, 16px)',
              background: labelBg,
              border: `1px solid ${config.accentColor}55`,
              boxShadow: 'inset 0 0 18px rgba(0,0,0,0.18)',
              animation: getSetlistChangeAnimation(config),
            }}>
              <div style={{ fontSize: 'clamp(24px, 5vw, 56px)', lineHeight: 1.05, fontWeight: 950, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current.title}</div>
              {config.showArtist && current.song && <div style={{ color: config.secondaryColor, fontSize: 'clamp(13px, 1.8vw, 22px)', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current.artist}</div>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {[0, 1, 2, 3, 4].map((item) => <div key={item} style={{ flex: 1, height: 'clamp(7px, 1vw, 12px)', borderRadius: 999, background: `${config.accentColor}66`, boxShadow: `0 0 10px ${config.accentColor}22` }} />)}
          </div>
        </div>
      </div>
    </div>
  );
};

const StageMarqueeSetlist: React.FC<{
  config: SetlistOverlayTemplateConfig;
  state: OverlaySetlistState;
  view: SetlistViewData;
  preview: boolean;
}> = ({ config, state, view, preview }) => {
  const current = getSetlistCurrentDisplay(config, state, view);
  const bulbs = Array.from({ length: preview ? 18 : 24 });
  const lightsActive = !state.isStreamWaiting && config.templateOptions.lightAnimation !== 'off';
  const lightDuration = `${Math.max(0.65, 3.2 - config.templateOptions.tickerSpeed * 0.22)}s`;
  const lightAnimationName = config.templateOptions.lightAnimation === 'flash'
    ? 'khelperSetlistLightFlash'
    : config.templateOptions.lightAnimation === 'chase'
      ? 'khelperSetlistLightChase'
      : 'khelperSetlistLightBreathe';
  const waitingDim = state.isStreamWaiting ? 0.38 : 1;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      padding: preview ? 34 : 0,
      color: config.textColor,
      fontFamily: config.fontFamily,
      overflow: 'hidden',
      background: `radial-gradient(circle at 50% 0%, ${config.accentColor}${Math.round(config.templateOptions.textureOpacity * 120).toString(16).padStart(2, '0')}, transparent 45%)`,
    }}>
      <SetlistAnimationStyles />
      <div style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: preview ? 24 : 16,
        display: 'grid',
        gridTemplateRows: 'auto auto minmax(0, 1fr)',
        gap: 16,
        overflow: 'hidden',
        ...getFrameStyle(config),
        boxShadow: `0 0 ${Math.round(30 + config.templateOptions.decorationIntensity * 30)}px ${config.accentColor}66, inset 0 0 36px ${config.accentColor}1f`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          {bulbs.map((_, index) => (
            <div key={index} style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: getLightColor(config, index),
              opacity: lightsActive ? 0.68 + (index % 2) * 0.22 : 0.22,
              boxShadow: lightsActive ? `0 0 ${Math.round(9 + config.templateOptions.decorationIntensity * 15)}px ${getLightColor(config, index)}` : 'none',
              animation: lightsActive
                ? `${config.templateOptions.lightAnimation === 'rainbow' ? 'khelperSetlistLightBreathe' : lightAnimationName} ${lightDuration} ease-in-out infinite`
                : undefined,
              animationDelay: config.templateOptions.lightAnimation === 'chase' ? `${index * 70}ms` : undefined,
            }} />
          ))}
        </div>
        {config.showCurrent && (
          <div key={getSetlistCurrentAnimationKey(state, current)} style={{
            minWidth: 0,
            textAlign: 'center',
            padding: '18px 22px',
            borderRadius: config.innerRadius,
            border: `2px solid ${config.accentColor}${alphaHex(0.25 + waitingDim * 0.55)}`,
            background: `${config.accentColor}${alphaHex(state.isStreamWaiting ? 0.06 : 0.14)}`,
            boxShadow: state.isStreamWaiting ? `0 0 8px ${config.accentColor}22` : `0 0 22px ${config.accentColor}55`,
            opacity: state.isStreamWaiting ? 0.78 : 1,
            animation: getSetlistChangeAnimation(config),
          }}>
            <div style={{ color: config.accentColor, fontSize: 13, fontWeight: 950, letterSpacing: 3 }}>{current.label}</div>
            <div style={{ marginTop: 8, fontSize: 34, fontWeight: 950, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: `0 0 16px ${config.accentColor}88` }}>{current.title}</div>
            {config.showArtist && current.song && <div style={{ color: config.secondaryColor, marginTop: 4, fontSize: 15 }}>{current.artist}</div>}
          </div>
        )}
        <div style={{ minHeight: 0, display: 'grid', gridTemplateColumns: config.showHistory ? '2fr 1fr' : '1fr', gap: 14 }}>
          {config.showUpcoming && (
            <Section label={config.upcomingLabel} count={view.upcomingSongs.length} config={config} flex="1 1 0">
              <GraphicReserveList config={config} state={state} view={view} />
            </Section>
          )}
          {config.showHistory && (
            <Section label={config.historyLabel} count={view.historySongs.length} config={config} flex="1 1 0">
              <AutoScrollArea enabled={config.autoScroll} speed={config.autoScrollSpeed} pauseMs={config.autoScrollPauseMs}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {view.historySongs.map((song, index) => <SetlistRow key={`${song.id}-${index}`} song={song} config={config} />)}
                </div>
              </AutoScrollArea>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
};

const PhotoStackSetlist: React.FC<{
  config: SetlistOverlayTemplateConfig;
  state: OverlaySetlistState;
  view: SetlistViewData;
  preview: boolean;
}> = ({ config, state, view, preview }) => {
  const current = getSetlistCurrentDisplay(config, state, view);
  const currentSong = current.song;
  const cardTilt = config.templateOptions.decorationIntensity * -4;
  const paperColor = config.presetId === 'polaroid_white'
    ? 'rgba(255,255,255,0.95)'
    : config.presetId === 'sakura_cards'
      ? 'rgba(255,239,246,0.9)'
      : 'rgba(26,24,32,0.9)';
  const foreground = config.presetId === 'polaroid_white' || config.presetId === 'sakura_cards' ? '#111827' : config.textColor;
  const animation = config.templateOptions.cardTransition === 'slide'
    ? 'khelperSetlistCardSlide 360ms cubic-bezier(.2,.8,.2,1) both'
    : getSetlistChangeAnimation(config);
  const photoAnimationKey = state.isStreamWaiting
    ? view.waitingSong?.id ?? 'empty'
    : view.currentSong?.id ?? 'empty';
  const showWaitingLabel = state.isStreamWaiting && current.label && current.label !== '...';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      padding: preview ? 20 : 0,
      color: config.textColor,
      fontFamily: config.fontFamily,
      overflow: 'hidden',
      background: `linear-gradient(135deg, ${config.accentColor}${Math.round(config.templateOptions.textureOpacity * 110).toString(16).padStart(2, '0')}, transparent 55%)`,
    }}>
      <SetlistAnimationStyles />
      <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', boxSizing: 'border-box', padding: preview ? 8 : 12 }}>
        {config.showCurrent && (
          <div key={photoAnimationKey} style={{
            minWidth: 0,
            width: preview ? 'min(72%, 520px)' : 'min(82%, 620px)',
            padding: preview ? 'clamp(12px, 2vw, 24px)' : 'clamp(16px, 2.8vw, 34px)',
            paddingBottom: preview ? 'clamp(24px, 4vw, 54px)' : 'clamp(34px, 5vw, 76px)',
            borderRadius: `clamp(8px, ${Math.max(8, config.outerRadius)}px, 24px)`,
            background: paperColor,
            color: foreground,
            boxShadow: `0 28px 72px rgba(0,0,0,0.34), 0 0 ${Math.round(config.templateOptions.currentGlow * 34)}px ${config.accentColor}66, inset 0 0 0 1px rgba(255,255,255,0.52)`,
            transform: `rotate(${cardTilt}deg)`,
            ['--khelper-card-tilt' as any]: `${cardTilt}deg`,
            animation,
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute',
              top: -8,
              left: '12%',
              width: '24%',
              height: 26,
              transform: 'rotate(-5deg)',
              borderRadius: 4,
              background: `rgba(255,255,255,${0.32 + config.templateOptions.textureOpacity * 0.38})`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.16)',
            }} />
            <div style={{
              width: '100%',
              aspectRatio: '4/3',
              borderRadius: Math.max(6, config.innerRadius),
              overflow: 'hidden',
              position: 'relative',
              background: `${config.accentColor}22`,
              display: 'grid',
              placeItems: 'center',
              boxShadow: `inset 0 0 0 ${Math.max(4, Math.round(10 * config.templateOptions.textureOpacity))}px rgba(255,255,255,0.08)`,
            }}>
              {showWaitingLabel && (
                <div style={{
                  position: 'absolute',
                  top: 'clamp(10px, 2vw, 18px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  maxWidth: '82%',
                  padding: '6px 14px',
                  borderRadius: 999,
                  color: config.presetId === 'polaroid_white' || config.presetId === 'sakura_cards' ? '#111827' : config.textColor,
                  background: 'rgba(255,255,255,0.78)',
                  boxShadow: '0 8px 22px rgba(0,0,0,0.18)',
                  fontSize: 'clamp(11px, 1.7vw, 16px)',
                  fontWeight: 900,
                  letterSpacing: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  zIndex: 1,
                }}>
                  {current.label}
                </div>
              )}
              {config.showThumbnails && currentSong?.thumbnailUrl ? (
                <img src={currentSong.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ fontSize: 'clamp(34px, 5vw, 56px)', fontWeight: 900, color: config.templateOptions.noteColor }}>♪</div>
              )}
            </div>
            <div style={{ marginTop: 14, textAlign: 'center' }}>
              <div style={{ color: config.accentColor, fontSize: 12, fontWeight: 900, letterSpacing: 2 }}>{current.label}</div>
              <div style={{ marginTop: 8, fontSize: 'clamp(24px, 4.2vw, 54px)', fontWeight: 950, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current.title}</div>
              {config.showArtist && currentSong && <div style={{ color: config.presetId === 'polaroid_white' ? '#4b5563' : config.secondaryColor, fontSize: 'clamp(13px, 1.8vw, 21px)', marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current.artist}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const VerticalColumnSetlist: React.FC<{
  config: SetlistOverlayTemplateConfig;
  state: OverlaySetlistState;
  view: SetlistViewData;
  preview: boolean;
}> = ({ config, state, view, preview }) => {
  const options = config.templateOptions;
  const current = getSetlistCurrentDisplay(config, state, view);
  const sideInset = `${options.contentInset}%`;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      padding: preview ? 28 : 0,
      color: config.textColor,
      fontFamily: config.fontFamily,
      overflow: 'hidden',
      background: 'transparent',
    }}>
      <SetlistAnimationStyles />
      <div style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: `${options.topOffset}% ${sideInset} 18px`,
      }}>
        <div style={{
          width: '100%',
          height: `${Math.max(22, 92 - options.topOffset)}%`,
          minHeight: 0,
          display: 'grid',
          gridTemplateRows: config.showCurrent ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)',
          gap: Math.max(8, options.rowGap + 2),
        }}>
          {config.showCurrent && (
            <div key={getSetlistCurrentAnimationKey(state, current)} style={{
              minWidth: 0,
              width: '100%',
              padding: '8px 12px',
              boxSizing: 'border-box',
              color: config.textColor,
              background: `rgba(0, 0, 0, ${options.titleBarOpacity})`,
              borderBottom: `1px solid ${config.accentColor}${Math.round(options.dividerOpacity * 255).toString(16).padStart(2, '0')}`,
              animation: getSetlistChangeAnimation(config),
            }}>
              <div style={{
                fontSize: options.currentFontSize,
                fontWeight: 900,
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {current.title}
              </div>
              {(config.showArtist || config.showDuration) && current.song && (
                <div style={{ color: config.secondaryColor, fontSize: Math.max(10, options.reserveFontSize - 1), marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {config.showArtist ? current.artist : ''}
                  {config.showArtist && config.showDuration ? ' · ' : ''}
                  {config.showDuration ? formatDuration(current.song.duration) : ''}
                </div>
              )}
            </div>
          )}

          {config.showUpcoming && (
            <AutoScrollArea enabled={config.autoScroll} speed={config.autoScrollSpeed} pauseMs={config.autoScrollPauseMs}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: options.rowGap }}>
                {view.upcomingSongs.length ? view.upcomingSongs.map((song, index) => {
                  const waitingNext = state.isStreamWaiting && index === 0;
                  return (
                    <div key={`${song.id}-${index}`} style={{
                      minWidth: 0,
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '2px 8px',
                      borderLeft: waitingNext ? `3px solid ${config.accentColor}` : `1px solid ${config.accentColor}${Math.round(options.dividerOpacity * 120).toString(16).padStart(2, '0')}`,
                      color: waitingNext ? config.accentColor : config.textColor,
                      background: waitingNext ? `${config.accentColor}16` : 'transparent',
                      animation: getSetlistChangeAnimation(config),
                    }}>
                      <div style={{
                        fontSize: options.reserveFontSize,
                        fontWeight: waitingNext ? 850 : 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {song.title}
                      </div>
                      {(config.showArtist || config.showDuration) && (
                        <div style={{ color: config.secondaryColor, fontSize: Math.max(9, options.reserveFontSize - 3), marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {config.showArtist ? (song.artist || 'Unknown Artist') : ''}
                          {config.showArtist && config.showDuration ? ' · ' : ''}
                          {config.showDuration ? formatDuration(song.duration) : ''}
                        </div>
                      )}
                    </div>
                  );
                }) : (
                  <EmptyText text={overlayText('overlays.defaults.noUpcoming')} color={config.secondaryColor} />
                )}
              </div>
            </AutoScrollArea>
          )}
        </div>
      </div>
    </div>
  );
};

const DiskIcon: React.FC<{
  config: SetlistOverlayTemplateConfig;
  active: boolean;
  spin: boolean;
  song?: OverlaySongMetadata | null;
}> = ({ config, active, spin, song }) => {
  const options = config.templateOptions;
  const size = options.diskSize;
  const duration = `${Math.max(1.4, 9 - options.diskSpinSpeed * 0.65)}s`;
  const common: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    flex: '0 0 auto',
    position: 'relative',
    animation: spin ? `khelperSetlistDiskSpin ${duration} linear infinite` : undefined,
    boxShadow: active ? `0 0 14px ${config.accentColor}66` : undefined,
  };

  if (options.diskStyle === 'thumbnail' && song?.thumbnailUrl) {
    return (
      <div style={{
        ...common,
        overflow: 'hidden',
        border: `${options.diskBorderWidth}px solid ${active ? config.accentColor : `${config.secondaryColor}bb`}`,
        boxSizing: 'border-box',
        background: 'rgba(0,0,0,0.28)',
      }}>
        <img src={song.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    );
  }

  if (options.diskStyle === 'dot') {
    return <div style={{ ...common, background: active ? config.accentColor : `${config.secondaryColor}88` }} />;
  }

  if (options.diskStyle === 'ring') {
    return (
      <div style={{
        ...common,
        border: `${Math.max(2, Math.round(size * 0.12))}px solid ${active ? config.accentColor : `${config.secondaryColor}aa`}`,
        boxSizing: 'border-box',
      }}>
        <div style={{
          position: 'absolute',
          inset: '34%',
          borderRadius: '50%',
          background: active ? config.accentColor : `${config.secondaryColor}88`,
        }} />
      </div>
    );
  }

  return (
    <div style={{
      ...common,
      overflow: 'hidden',
      background: `
        radial-gradient(circle at 50% 50%, rgba(0,0,0,0.86) 0 14%, transparent 15%),
        repeating-radial-gradient(circle, ${active ? config.accentColor : config.secondaryColor} 0 1px, rgba(0,0,0,0.32) 1px 3px, rgba(255,255,255,0.1) 3px 5px),
        conic-gradient(from 28deg, rgba(255,255,255,0.18), rgba(0,0,0,0.15) 18%, rgba(255,255,255,0.08) 34%, rgba(0,0,0,0.35) 58%, rgba(255,255,255,0.16) 76%, rgba(0,0,0,0.18))
      `,
      border: `1px solid ${active ? config.accentColor : `${config.secondaryColor}99`}`,
    }}>
      <div style={{
        position: 'absolute',
        left: '57%',
        top: '16%',
        width: '28%',
        height: '10%',
        borderRadius: 999,
        background: active ? `${config.accentColor}dd` : 'rgba(255,255,255,0.42)',
        boxShadow: `0 0 8px ${config.accentColor}66`,
        transform: 'rotate(24deg)',
      }} />
      <div style={{
        position: 'absolute',
        left: '23%',
        top: '68%',
        width: '15%',
        height: '6%',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.35)',
        transform: 'rotate(-32deg)',
      }} />
      <div style={{
        position: 'absolute',
        inset: '34%',
        borderRadius: '50%',
        background: `radial-gradient(circle, rgba(0,0,0,0.52), ${active ? config.accentColor : config.secondaryColor} 72%)`,
        border: `1px solid ${active ? config.textColor : 'rgba(255,255,255,0.45)'}`,
      }} />
    </div>
  );
};

const SpinningDiskListSetlist: React.FC<{
  config: SetlistOverlayTemplateConfig;
  state: OverlaySetlistState;
  view: SetlistViewData;
  preview: boolean;
}> = ({ config, state, view, preview }) => {
  const options = config.templateOptions;
  const current = getSetlistCurrentDisplay(config, state, view);
  const historySongs = config.showHistory ? view.historySongs : [];
  const currentSpin = options.diskSpinMode === 'current' || options.diskSpinMode === 'all';
  const historySpin = options.diskSpinMode === 'all';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      padding: preview ? 32 : 0,
      color: config.textColor,
      fontFamily: config.fontFamily,
      overflow: 'hidden',
      background: 'transparent',
    }}>
      <SetlistAnimationStyles />
      <div style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        display: 'grid',
        gridTemplateRows: 'minmax(0, 1fr) auto',
        gap: options.rowGap,
        padding: preview ? '20px 30px' : `${options.contentInset}%`,
        overflow: 'hidden',
      }}>
        <AutoScrollArea enabled={config.autoScroll} speed={config.autoScrollSpeed} pauseMs={config.autoScrollPauseMs}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: '100%', gap: options.rowGap }}>
            {historySongs.length ? historySongs.map((song, index) => (
              <div key={`${song.id}-${index}`} style={{
                minWidth: 0,
                width: '86%',
                alignSelf: 'flex-start',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 10px',
                borderRadius: config.innerRadius,
                background: `rgba(12, 10, 18, ${options.rowOpacity})`,
                border: '1px solid rgba(255,255,255,0.1)',
                opacity: options.rowOpacity,
                animation: getSetlistChangeAnimation(config),
              }}>
                <DiskIcon config={config} active={false} spin={historySpin} song={song} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 750, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {song.title}
                  </div>
                  {(config.showArtist || config.showDuration) && (
                    <div style={{ color: config.secondaryColor, fontSize: 12, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {config.showArtist ? (song.artist || 'Unknown Artist') : ''}
                      {config.showArtist && config.showDuration ? ' · ' : ''}
                      {config.showDuration ? formatDuration(song.duration) : ''}
                    </div>
                  )}
                </div>
              </div>
            )) : null}
          </div>
        </AutoScrollArea>

        {config.showCurrent && (
          <div key={getSetlistCurrentAnimationKey(state, current)} style={{
            minWidth: 0,
            width: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 14px',
            borderRadius: config.innerRadius,
            background: `rgba(12, 10, 18, ${Math.min(0.96, options.rowOpacity + options.currentEmphasis * 0.24)})`,
            border: `1px solid ${config.accentColor}88`,
            boxShadow: `0 0 ${Math.round(options.currentGlow * 28)}px ${config.accentColor}66`,
            animation: getSetlistChangeAnimation(config),
          }}>
            <DiskIcon config={config} active spin={currentSpin && !state.isStreamWaiting} song={current.song} />
            <div style={{ minWidth: 0 }}>
              <div style={{
                color: config.accentColor,
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 1.4,
              }}>
                {current.label}
              </div>
              <div style={{
                fontSize: 18 + Math.round(options.currentEmphasis * 8),
                fontWeight: 950,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {current.title}
              </div>
              {(config.showArtist || config.showDuration) && current.song && (
                <div style={{ color: config.secondaryColor, fontSize: 12, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {config.showArtist ? current.artist : ''}
                  {config.showArtist && config.showDuration ? ' · ' : ''}
                  {config.showDuration ? formatDuration(current.song.duration) : ''}
                </div>
              )}
            </div>
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
