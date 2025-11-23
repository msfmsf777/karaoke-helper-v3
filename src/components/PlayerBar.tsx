import React, { useEffect, useState, useRef } from 'react';
import audioEngine from '../audio/AudioEngine';
import { loadVolumePreferences, saveVolumePreferences } from '../settings/volumePreferences';
import { useQueue } from '../contexts/QueueContext';
import { useLibrary } from '../contexts/LibraryContext';
import PlaybackControlPopup from './PlaybackControlPopup';
import VolumeControlPopup from './VolumeControlPopup';

type View = 'library' | 'lyrics' | 'stream' | 'favorites' | 'history' | string;

interface PlayerBarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  currentTrackName?: string;
  onToggleQueue: () => void;
}

const PlayerBar: React.FC<PlayerBarProps> = ({
  currentView,
  onViewChange,
  onPlayPause,
  onSeek,
  isPlaying,
  currentTime,
  duration,
  currentTrackName,
  onToggleQueue,
}) => {
  const { playNext, playPrev, currentSongId } = useQueue();
  const { getSongById, updateSong } = useLibrary();
  const initialVolumes = loadVolumePreferences() ?? { streamVolume: 0.8, headphoneVolume: 1 };
  const [isHovered, setIsHovered] = useState(false);
  const [backingVolume, setBackingVolume] = useState(() => Math.round(initialVolumes.streamVolume * 100));
  const [vocalVolume, setVocalVolume] = useState(() => Math.round(initialVolumes.headphoneVolume * 100));

  // Playback Transform State
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [showSpeedPopup, setShowSpeedPopup] = useState(false);
  const [showPitchPopup, setShowPitchPopup] = useState(false);

  // Refs for debounced saving
  const speedRef = useRef(1.0);
  const pitchRef = useRef(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync refs
  useEffect(() => {
    speedRef.current = speed;
    pitchRef.current = pitch;
  }, [speed, pitch]);

  // Sync with current song
  useEffect(() => {
    if (currentSongId) {
      const song = getSongById(currentSongId);
      if (song && song.playback) {
        setSpeed(song.playback.speed);
        setPitch(song.playback.transpose);
        // AudioEngine is updated by QueueContext on play, 
        // but if we just loaded the app or switched songs, we want UI to match.
      } else {
        setSpeed(1.0);
        setPitch(0);
      }
    }
  }, [currentSongId, getSongById]);

  const savePlaybackSettings = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (currentSongId) {
        updateSong(currentSongId, {
          playback: { speed: speedRef.current, transpose: pitchRef.current }
        });
      }
    }, 1000);
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    audioEngine.setPlaybackTransform({ speed: newSpeed, transpose: pitch });
    savePlaybackSettings();
  };

  const handlePitchChange = (newPitch: number) => {
    setPitch(newPitch);
    audioEngine.setPlaybackTransform({ speed: speed, transpose: newPitch });
    savePlaybackSettings();
  };



  const formatTime = (value: number) => {
    if (!Number.isFinite(value) || value < 0) return '0:00';
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60)
      .toString()
      .padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const progressValue = duration > 0 ? Math.min(currentTime, duration) : 0;
  const progressMax = duration > 0 ? duration : 0;

  const handleLiveToggle = () => {
    if (currentView === 'stream') {
      onViewChange('library');
    } else {
      onViewChange('stream');
    }
  };

  const handleSeekChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(event.target.value);
    onSeek(nextTime);
  };

  useEffect(() => {
    audioEngine.setTrackVolume('instrumental', backingVolume / 100);
    saveVolumePreferences({ streamVolume: backingVolume / 100, headphoneVolume: vocalVolume / 100 });
  }, [backingVolume]);

  useEffect(() => {
    audioEngine.setTrackVolume('vocal', vocalVolume / 100);
    saveVolumePreferences({ streamVolume: backingVolume / 100, headphoneVolume: vocalVolume / 100 });
  }, [vocalVolume]);

  return (
    <div
      style={{
        height: '90px',
        backgroundColor: 'var(--bg-player)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
        zIndex: 100,
      }}
    >
      {/* Left: Song Info & Live Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', width: '30%' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            backgroundColor: currentView === 'stream' ? '#330000' : '#333',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '12px',
            color: currentView === 'stream' ? '#ff4444' : '#ccc',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            border: currentView === 'stream' ? '1px solid #ff4444' : '1px solid #444',
            fontWeight: 700,
            fontSize: '14px',
            textAlign: 'center' as const,
            lineHeight: 1.2,
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleLiveToggle}
          title={currentView === 'stream' ? '關閉直播模式' : '進入直播模式'}
        >
          {currentView === 'stream' ? (
            isHovered ? (
              // Back Icon
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 14L4 9l5-5" />
                <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
              </svg>
            ) : (
              <span>LIVE</span>
            )
          ) : isHovered ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {/* Red Live Icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2" style={{ marginBottom: '2px' }}>
                <path d="M2 12h20" />
                <path d="M12 2v20" />
                <circle cx="12" cy="12" r="10" />
              </svg>
              <span style={{ fontSize: '10px', color: '#ff4444', lineHeight: 1 }}>直播模式</span>
            </div>
          ) : (
            // Music Icon
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          )}
        </div>
        <div>
          <div style={{ color: '#fff', fontSize: '14px', marginBottom: '4px' }}>
            {currentTrackName || '尚未選擇歌曲'}
          </div>
          <div style={{ color: '#b3b3b3', fontSize: '12px' }}>
            {currentView === 'stream' ? '直播模式' : '切換至直播模式'}
          </div>
        </div>
      </div>

      {/* Center Controls */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '600px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '4px' }}>
          <button
            onClick={playPrev}
            style={{
              background: 'none',
              border: 'none',
              color: '#b3b3b3',
              cursor: 'pointer',
              fontSize: '20px',
            }}
          >
            ⏮
          </button>
          <button
            onClick={onPlayPause}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#fff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '18px',
              color: '#000',
            }}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            onClick={playNext}
            style={{
              background: 'none',
              border: 'none',
              color: '#b3b3b3',
              cursor: 'pointer',
              fontSize: '20px',
            }}
          >
            ⏭
          </button>
        </div>
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#b3b3b3', minWidth: '42px', textAlign: 'right' }}>
            {formatTime(progressValue)}
          </span>
          <input
            type="range"
            min={0}
            max={progressMax}
            value={progressValue}
            step={0.1}
            onChange={handleSeekChange}
            style={{ flex: 1, accentColor: 'var(--accent-color)' }}
          />
          <span style={{ fontSize: '11px', color: '#b3b3b3', minWidth: '42px' }}>
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Right: Volume & Queue */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '30%', gap: '16px' }}>

        {/* Speed Control */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowSpeedPopup(!showSpeedPopup); setShowPitchPopup(false); }}
            style={{
              background: '#333',
              border: 'none',
              borderRadius: '4px',
              color: '#ccc',
              cursor: 'pointer',
              width: '40px',
              height: '40px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
            }}
            title="變速 (Speed)"
          >
            <span style={{ fontSize: '14px', marginBottom: '2px' }}>⚡</span>
            <span style={{ fontSize: '10px' }}>變速</span>
          </button>
          {showSpeedPopup && (
            <PlaybackControlPopup
              title="變速"
              value={speed}
              min={0.5}
              max={2.0}
              step={0.01}
              formatLabel={(val) => `${Math.round(val * 100)}%`}
              onChange={handleSpeedChange}
              onReset={() => handleSpeedChange(1.0)}
              onClose={() => setShowSpeedPopup(false)}
            />
          )}
        </div>

        {/* Pitch Control */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowPitchPopup(!showPitchPopup); setShowSpeedPopup(false); }}
            style={{
              background: '#333',
              border: 'none',
              borderRadius: '4px',
              color: '#ccc',
              cursor: 'pointer',
              width: '40px',
              height: '40px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
            }}
            title="變調 (Pitch)"
          >
            <span style={{ fontSize: '14px', marginBottom: '2px' }}>🎵</span>
            <span style={{ fontSize: '10px' }}>變調</span>
          </button>
          {showPitchPopup && (
            <PlaybackControlPopup
              title="變調"
              value={pitch}
              min={-12}
              max={12}
              step={1}
              formatLabel={(val) => (val > 0 ? `+${val}` : `${val}`)}
              onChange={handlePitchChange}
              onReset={() => handlePitchChange(0)}
              onClose={() => setShowPitchPopup(false)}
            />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <VolumeControlPopup
            label="伴奏"
            volume={backingVolume}
            onChange={(val) => setBackingVolume(val)}
          />
          <VolumeControlPopup
            label="人聲"
            volume={vocalVolume}
            onChange={(val) => setVocalVolume(val)}
          />
        </div>

        <div
          style={{
            width: '1px',
            height: '32px',
            backgroundColor: '#333',
            margin: '0 8px'
          }}
        />

        <button
          onClick={onToggleQueue}
          title="播放隊列"
          style={{
            background: 'none',
            border: 'none',
            color: '#b3b3b3',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ☰
        </button>
      </div>
    </div>
  );
};

export default PlayerBar;
