import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SongMeta } from '../../shared/songTypes';
import { useUserData } from '../contexts/UserDataContext';
import { useLibrary } from '../contexts/LibraryContext';
import { analyzeSongVocalRange } from '../library/songLibrary';
import audioEngine from '../audio/AudioEngine';
import {
  midiToNoteName,
  calculateKeyRecommendation,
  KeyRecommendation,
} from '../../shared/vocalRange';

interface VocalRangePillProps {
  song: SongMeta | null;
  onOpenSetupModal: () => void;
}

const IS_BLACK_KEY = [
  false, true, false, true, false, false, true, false, true, false, true, false
];

export const VocalRangePill: React.FC<VocalRangePillProps> = ({ song, onOpenSetupModal }) => {
  const { t } = useTranslation();
  const { vocalRange } = useUserData();
  const { updateSong } = useLibrary();

  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnalyzedSongIdRef = useRef<string | null>(null);

  // Active transpose: read from song playback or audioEngine
  const currentTranspose = song?.playback?.transpose ?? audioEngine.getPlaybackTransform().transpose ?? 0;
  const lastTransposeRef = useRef(currentTranspose);

  const isSeparated = song?.audio_status === 'separated';
  const songRange = song?.vocal_range;

  // Background analysis trigger for separated songs lacking vocal_range
  useEffect(() => {
    if (song && isSeparated && !songRange && lastAnalyzedSongIdRef.current !== song.id) {
      lastAnalyzedSongIdRef.current = song.id;
      analyzeSongVocalRange(song.id).catch((err: unknown) => {
        console.warn('[VocalRangePill] Auto-analysis error:', err);
      });
    }
  }, [song?.id, isSeparated, songRange]);

  // Auto-dismiss helper
  const scheduleDismiss = (delayMs: number = 5000) => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      if (!isHovered) {
        setIsVisible(false);
      }
    }, delayMs);
  };

  // Trigger 1: Show on song load/change
  useEffect(() => {
    if (isSeparated && songRange) {
      setIsVisible(true);
      scheduleDismiss(5000);
    } else {
      setIsVisible(false);
    }
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [song?.id, isSeparated, Boolean(songRange)]);

  // Trigger 2: Show on pitch change
  useEffect(() => {
    if (currentTranspose !== lastTransposeRef.current) {
      lastTransposeRef.current = currentTranspose;
      if (isSeparated && songRange) {
        setIsVisible(true);
        scheduleDismiss(4000);
      }
    }
  }, [currentTranspose, isSeparated, songRange]);

  // Handle hover freeze
  useEffect(() => {
    if (isHovered) {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    } else if (isVisible) {
      scheduleDismiss(3000);
    }
  }, [isHovered]);

  // Shifted song range according to playback transpose
  const shiftedLow = (songRange?.lowestMidi ?? 60) + currentTranspose;
  const shiftedHigh = (songRange?.highestMidi ?? 72) + currentTranspose;
  const songLowNote = midiToNoteName(shiftedLow);
  const songHighNote = midiToNoteName(shiftedHigh);

  // Recommendation logic
  const recommendation: KeyRecommendation | null = useMemo(() => {
    if (!songRange) return null;
    return calculateKeyRecommendation(songRange, vocalRange, currentTranspose);
  }, [songRange, vocalRange, currentTranspose]);

  const handleApplyRecommendation = () => {
    if (!song || !recommendation) return;
    const targetOffset = recommendation.transposeOffset;
    const currentSpeed = audioEngine.getPlaybackTransform().speed;
    audioEngine.setPlaybackTransform({ speed: currentSpeed, transpose: targetOffset });
    void updateSong(song.id, {
      playback: {
        speed: currentSpeed,
        transpose: targetOffset,
      },
    });
  };

  // Determine keyboard window bounds
  // Must start and end on white key, with 1-2 unhighlighted keys of padding
  const keyBounds = useMemo(() => {
    const minMidi = Math.min(shiftedLow, vocalRange ? vocalRange.lowestMidi : shiftedLow);
    const maxMidi = Math.max(shiftedHigh, vocalRange ? vocalRange.highestMidi : shiftedHigh);

    // Step back to nearest white key + 1 extra white key padding
    let start = minMidi;
    while (IS_BLACK_KEY[((start % 12) + 12) % 12]) start--;
    start -= 1;
    while (IS_BLACK_KEY[((start % 12) + 12) % 12]) start--;

    // Step forward to nearest white key + 1 extra white key padding
    let end = maxMidi;
    while (IS_BLACK_KEY[((end % 12) + 12) % 12]) end++;
    end += 1;
    while (IS_BLACK_KEY[((end % 12) + 12) % 12]) end++;

    // Clamp to valid 88-key piano range (21 to 108)
    start = Math.max(21, start);
    end = Math.min(108, end);

    return { start, end };
  }, [shiftedLow, shiftedHigh, vocalRange]);

  // Build piano layout
  const whiteKeyWidth = 13;
  const blackKeyWidth = 8;
  const keyHeight = 36;
  const blackKeyHeight = 22;

  const whiteKeys: { midi: number; noteName: string; index: number }[] = [];
  const blackKeys: { midi: number; noteName: string; whiteKeyIndexBefore: number }[] = [];

  let whiteCount = 0;
  for (let m = keyBounds.start; m <= keyBounds.end; m++) {
    const isBlack = IS_BLACK_KEY[((m % 12) + 12) % 12];
    const name = midiToNoteName(m);

    if (isBlack) {
      blackKeys.push({
        midi: m,
        noteName: name,
        whiteKeyIndexBefore: whiteCount - 1,
      });
    } else {
      whiteKeys.push({
        midi: m,
        noteName: name,
        index: whiteCount,
      });
      whiteCount++;
    }
  }

  const pianoWidth = whiteCount * whiteKeyWidth;

  if (!isSeparated || !songRange) {
    return null;
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: isVisible
          ? 'translateX(-50%) translateY(0)'
          : 'translateX(-50%) translateY(-120%)',
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'rgba(24, 24, 27, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '20px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05)',
        padding: '10px 18px',
        userSelect: 'none',
        minWidth: '320px',
      }}
    >
      {/* Top Header: Title + Dismiss */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#9ca3af',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>🎤</span>
          <span>{t('vocalRange.pill.title', '歌曲音域 (Vocal Range)')}</span>
          {currentTranspose !== 0 && (
            <span
              style={{
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '8px',
                backgroundColor: currentTranspose > 0 ? '#1e3a8a' : '#451a03',
                color: currentTranspose > 0 ? '#93c5fd' : '#fed7aa',
                fontWeight: 600,
              }}
            >
              {currentTranspose > 0 ? `+${currentTranspose}` : currentTranspose}
            </span>
          )}
        </span>

        <button
          onClick={() => setIsVisible(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#6b7280',
            fontSize: '14px',
            cursor: 'pointer',
            padding: '0 4px',
            lineHeight: 1,
          }}
          title={t('common.close', '關閉')}
        >
          ✕
        </button>
      </div>

      {/* Middle: Left Badge + Dynamic Piano Roll + Right Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '8px',
        }}
      >
        {/* Lowest Note Badge */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '3px 7px',
            borderRadius: '6px',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            minWidth: '38px',
          }}
          title={t('vocalRange.pill.lowestNote', '最低音')}
        >
          <span style={{ fontSize: '9px', color: '#93c5fd', textTransform: 'uppercase' }}>LOW</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#60a5fa' }}>{songLowNote}</span>
        </div>

        {/* Minimal Piano Roll SVG/HTML */}
        <div
          style={{
            position: 'relative',
            width: `${pianoWidth}px`,
            height: `${keyHeight}px`,
            backgroundColor: '#09090b',
            borderRadius: '4px',
            overflow: 'hidden',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* White keys */}
          <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0, height: '100%' }}>
            {whiteKeys.map((k) => {
              const inSingerRange = vocalRange && k.midi >= vocalRange.lowestMidi && k.midi <= vocalRange.highestMidi;
              const isLowest = k.midi === shiftedLow;
              const isHighest = k.midi === shiftedHigh;

              let bg = inSingerRange ? '#bbf7d0' : '#e4e4e7';
              if (isLowest) bg = '#93c5fd';
              if (isHighest) bg = '#fed7aa';

              return (
                <div
                  key={k.midi}
                  style={{
                    width: `${whiteKeyWidth}px`,
                    height: `${keyHeight}px`,
                    backgroundColor: bg,
                    borderRight: '1px solid #71717a',
                    boxSizing: 'border-box',
                    position: 'relative',
                    transition: 'background-color 0.2s',
                  }}
                >
                  {isLowest && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '3px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        backgroundColor: '#2563eb',
                        boxShadow: '0 0 6px #3b82f6',
                      }}
                    />
                  )}
                  {isHighest && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '3px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        backgroundColor: '#ea580c',
                        boxShadow: '0 0 6px #f97316',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Black keys */}
          {blackKeys.map((k) => {
            const inSingerRange = vocalRange && k.midi >= vocalRange.lowestMidi && k.midi <= vocalRange.highestMidi;
            const isLowest = k.midi === shiftedLow;
            const isHighest = k.midi === shiftedHigh;

            const leftOffset = (k.whiteKeyIndexBefore + 1) * whiteKeyWidth - blackKeyWidth / 2;

            let bg = inSingerRange ? '#14532d' : '#18181b';
            let border = inSingerRange ? '1px solid #22c55e' : '1px solid #000';
            if (isLowest) {
              bg = '#1e40af';
              border = '1px solid #3b82f6';
            }
            if (isHighest) {
              bg = '#9a3412';
              border = '1px solid #f97316';
            }

            return (
              <div
                key={k.midi}
                style={{
                  position: 'absolute',
                  left: `${leftOffset}px`,
                  top: 0,
                  width: `${blackKeyWidth}px`,
                  height: `${blackKeyHeight}px`,
                  backgroundColor: bg,
                  border,
                  borderRadius: '0 0 2px 2px',
                  zIndex: 2,
                  boxSizing: 'border-box',
                }}
              >
                {isLowest && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '2px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '3px',
                      height: '3px',
                      borderRadius: '50%',
                      backgroundColor: '#60a5fa',
                    }}
                  />
                )}
                {isHighest && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '2px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '3px',
                      height: '3px',
                      borderRadius: '50%',
                      backgroundColor: '#fdba74',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Highest Note Badge */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '3px 7px',
            borderRadius: '6px',
            backgroundColor: 'rgba(249, 115, 22, 0.15)',
            border: '1px solid rgba(249, 115, 22, 0.3)',
            minWidth: '38px',
          }}
          title={t('vocalRange.pill.highestNote', '最高音')}
        >
          <span style={{ fontSize: '9px', color: '#fed7aa', textTransform: 'uppercase' }}>HIGH</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#fb923c' }}>{songHighNote}</span>
        </div>
      </div>

      {/* Bottom Action: Key Recommendation or Prompt to Setup */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        {vocalRange && recommendation ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleApplyRecommendation}
              disabled={recommendation.mode === 'current_ok'}
              style={{
                background: recommendation.mode === 'current_ok'
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'linear-gradient(135deg, #16a34a, #22c55e)',
                border: recommendation.mode === 'current_ok'
                  ? '1px solid rgba(34, 197, 94, 0.3)'
                  : 'none',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: '12px',
                cursor: recommendation.mode === 'current_ok' ? 'default' : 'pointer',
                boxShadow: recommendation.mode === 'current_ok'
                  ? 'none'
                  : '0 2px 8px rgba(34, 197, 94, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{recommendation.label}</span>
              {recommendation.mode !== 'current_ok' && (
                <span style={{ fontSize: '10px', opacity: 0.85 }}>• 點擊套用</span>
              )}
            </button>
            {recommendation.warning && (
              <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 500 }}>
                ⚠️ {recommendation.warning}
              </span>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenSetupModal}
            style={{
              background: 'transparent',
              border: '1px dashed rgba(255, 255, 255, 0.25)',
              color: '#9ca3af',
              fontSize: '11px',
              fontWeight: 500,
              padding: '4px 12px',
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#22c55e';
              e.currentTarget.style.color = '#4ade80';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
              e.currentTarget.style.color = '#9ca3af';
            }}
          >
            <span>⚡ {t('vocalRange.pill.setupPrompt', '設定個人音域以取得推薦調性 ➔')}</span>
          </button>
        )}
      </div>
    </div>
  );
};
