import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserData } from '../contexts/UserDataContext';
import audioEngine from '../audio/AudioEngine';
import { playSynthNote } from '../audio/synthTone';
import {
  midiToNoteName,
  VOCAL_RANGE_PRESETS,
  UserVocalRange,
} from '../../shared/vocalRange';

interface VocalRangeSetupModalProps {
  onClose: () => void;
}

// 4 Octaves: C2 (36) to C6 (84)
const START_MIDI = 36;
const END_MIDI = 84;

const IS_BLACK_KEY = [
  false, true, false, true, false, false, true, false, true, false, true, false
];

export const VocalRangeSetupModal: React.FC<VocalRangeSetupModalProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { vocalRange, setVocalRange } = useUserData();

  const wasPlayingRef = useRef(false);

  // Default to Mezzo or Tenor if none set
  const [lowestMidi, setLowestMidi] = useState<number>(() => vocalRange?.lowestMidi ?? 53); // F3
  const [highestMidi, setHighestMidi] = useState<number>(() => vocalRange?.highestMidi ?? 74); // D5
  const [activeTarget, setActiveTarget] = useState<'low' | 'high'>('low');
  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(vocalRange?.presetName);

  // Pause playback when modal opens
  useEffect(() => {
    if (audioEngine.isPlaying()) {
      wasPlayingRef.current = true;
      audioEngine.pause();
    }
    return () => {
      if (wasPlayingRef.current) {
        audioEngine.play();
      }
    };
  }, []);

  const handleKeyClick = (midi: number) => {
    playSynthNote(midi);
    setSelectedPreset('custom');

    if (activeTarget === 'low') {
      if (midi > highestMidi) {
        setLowestMidi(highestMidi);
        setHighestMidi(midi);
        setActiveTarget('low');
      } else {
        setLowestMidi(midi);
        setActiveTarget('high'); // Guided: auto-switch to highest note next
      }
    } else {
      if (midi < lowestMidi) {
        setHighestMidi(lowestMidi);
        setLowestMidi(midi);
        setActiveTarget('high');
      } else {
        setHighestMidi(midi);
      }
    }
  };

  const handleApplyPreset = (preset: typeof VOCAL_RANGE_PRESETS[0]) => {
    setLowestMidi(preset.lowestMidi);
    setHighestMidi(preset.highestMidi);
    setSelectedPreset(preset.id);
    playSynthNote(preset.highestMidi);
  };

  const handleSave = () => {
    const payload: UserVocalRange = {
      lowestMidi,
      highestMidi,
      lowestNote: midiToNoteName(lowestMidi),
      highestNote: midiToNoteName(highestMidi),
      presetName: selectedPreset as any,
    };
    setVocalRange(payload);
    onClose();
  };

  const handleClear = () => {
    setVocalRange(null);
    onClose();
  };

  // Build piano key layout
  const whiteKeyWidth = 24;
  const blackKeyWidth = 14;
  const keyboardHeight = 110;
  const blackKeyHeight = 68;

  const whiteKeys: { midi: number; noteName: string; index: number }[] = [];
  const blackKeys: { midi: number; noteName: string; whiteKeyIndexBefore: number }[] = [];

  let whiteCount = 0;
  for (let m = START_MIDI; m <= END_MIDI; m++) {
    const noteInOct = ((m % 12) + 12) % 12;
    const isBlack = IS_BLACK_KEY[noteInOct];
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

  const totalWidth = whiteCount * whiteKeyWidth;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2500,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#202022',
          borderRadius: '12px',
          width: '760px',
          maxWidth: '95vw',
          padding: '24px 28px',
          color: '#f3f4f6',
          boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              🎤 {t('vocalRange.modal.title', '個人音域設定 (Vocal Range)')}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#9ca3af' }}>
              {t('vocalRange.modal.subtitle', '點擊琴鍵或選擇範本以設定您的安全演唱音域，點擊時僅耳機發聲。')}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Preset Pills */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
          {VOCAL_RANGE_PRESETS.map((preset) => {
            const isSelected = selectedPreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleApplyPreset(preset)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '16px',
                  border: isSelected ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.12)',
                  backgroundColor: isSelected ? 'rgba(34, 197, 94, 0.2)' : '#2a2a2e',
                  color: isSelected ? '#4ade80' : '#d1d5db',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {t(preset.labelKey, preset.defaultLabel)}
              </button>
            );
          })}
        </div>

        {/* Current Active Target Cards */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div
            onClick={() => setActiveTarget('low')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              border: activeTarget === 'low' ? '2px solid #3b82f6' : '1px solid #374151',
              backgroundColor: activeTarget === 'low' ? 'rgba(59, 130, 246, 0.15)' : '#18181b',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>
                {t('vocalRange.modal.lowestNote', '最低音 (Lowest Note)')}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#60a5fa' }}>
                {midiToNoteName(lowestMidi)}
              </div>
            </div>
            {activeTarget === 'low' && (
              <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: 500 }}>
                ● {t('vocalRange.modal.selecting', '選取中')}
              </span>
            )}
          </div>

          <div
            onClick={() => setActiveTarget('high')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              border: activeTarget === 'high' ? '2px solid #f97316' : '1px solid #374151',
              backgroundColor: activeTarget === 'high' ? 'rgba(249, 115, 22, 0.15)' : '#18181b',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>
                {t('vocalRange.modal.highestNote', '最高音 (Highest Note)')}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fb923c' }}>
                {midiToNoteName(highestMidi)}
              </div>
            </div>
            {activeTarget === 'high' && (
              <span style={{ fontSize: '12px', color: '#fb923c', fontWeight: 500 }}>
                ● {t('vocalRange.modal.selecting', '選取中')}
              </span>
            )}
          </div>
        </div>

        {/* Interactive Piano Keyboard Visualizer */}
        <div
          style={{
            overflowX: 'auto',
            padding: '12px 4px',
            backgroundColor: '#121214',
            borderRadius: '8px',
            border: '1px solid #27272a',
            marginBottom: '16px',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: `${totalWidth}px`,
              height: `${keyboardHeight}px`,
              margin: '0 auto',
            }}
          >
            {/* White Keys */}
            <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0, height: '100%' }}>
              {whiteKeys.map((k) => {
                const inRange = k.midi >= lowestMidi && k.midi <= highestMidi;
                const isLowest = k.midi === lowestMidi;
                const isHighest = k.midi === highestMidi;

                let bg = inRange ? '#bbf7d0' : '#ffffff';
                if (isLowest) bg = '#93c5fd';
                if (isHighest) bg = '#fed7aa';

                return (
                  <div
                    key={k.midi}
                    onClick={() => handleKeyClick(k.midi)}
                    style={{
                      width: `${whiteKeyWidth}px`,
                      height: `${keyboardHeight}px`,
                      backgroundColor: bg,
                      border: '1px solid #374151',
                      borderTop: 'none',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      paddingBottom: '4px',
                      color: '#1f2937',
                      fontSize: '10px',
                      fontWeight: 600,
                      transition: 'background-color 0.1s',
                      position: 'relative',
                    }}
                    title={`${k.noteName} (MIDI ${k.midi})`}
                  >
                    {/* Octave label on C notes */}
                    {k.noteName.startsWith('C') && (
                      <span style={{ fontSize: '9px', opacity: 0.7 }}>{k.noteName}</span>
                    )}
                    {isLowest && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '16px',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: '#2563eb',
                        }}
                      />
                    )}
                    {isHighest && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '16px',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: '#ea580c',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Black Keys */}
            {blackKeys.map((k) => {
              const inRange = k.midi >= lowestMidi && k.midi <= highestMidi;
              const isLowest = k.midi === lowestMidi;
              const isHighest = k.midi === highestMidi;

              const leftOffset = (k.whiteKeyIndexBefore + 1) * whiteKeyWidth - blackKeyWidth / 2;

              let bg = inRange ? '#14532d' : '#1f2937';
              let borderColor = inRange ? '#22c55e' : '#111827';
              if (isLowest) {
                bg = '#1e40af';
                borderColor = '#3b82f6';
              }
              if (isHighest) {
                bg = '#9a3412';
                borderColor = '#f97316';
              }

              return (
                <div
                  key={k.midi}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleKeyClick(k.midi);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${leftOffset}px`,
                    top: 0,
                    width: `${blackKeyWidth}px`,
                    height: `${blackKeyHeight}px`,
                    backgroundColor: bg,
                    border: `1px solid ${borderColor}`,
                    boxSizing: 'border-box',
                    borderRadius: '0 0 3px 3px',
                    zIndex: 2,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    paddingBottom: '4px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                  }}
                  title={`${k.noteName} (MIDI ${k.midi})`}
                >
                  {isLowest && (
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#60a5fa' }} />
                  )}
                  {isHighest && (
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#fdba74' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {vocalRange ? (
            <button
              onClick={handleClear}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#ef4444',
                fontSize: '13px',
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: '6px',
              }}
            >
              {t('vocalRange.modal.clear', '清除設定 (Clear)')}
            </button>
          ) : <div />}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid #374151',
                backgroundColor: '#27272a',
                color: '#d1d5db',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {t('common.cancel', '取消')}
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '8px 20px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#22c55e',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(34, 197, 94, 0.4)',
              }}
            >
              {t('common.save', '儲存')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
