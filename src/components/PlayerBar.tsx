import React, { useEffect, useState } from 'react';
import audioEngine from '../audio/AudioEngine';
import { loadVolumePreferences, saveVolumePreferences } from '../settings/volumePreferences';
import { useQueue } from '../contexts/QueueContext';

type View = 'library' | 'lyrics' | 'stream' | 'favorites' | 'history';

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
  const { playNext, playPrev } = useQueue();
  const initialVolumes = loadVolumePreferences() ?? { streamVolume: 0.8, headphoneVolume: 1 };
  const [isHovered, setIsHovered] = useState(false);
  const [backingVolume, setBackingVolume] = useState(() => Math.round(initialVolumes.streamVolume * 100));
  const [vocalVolume, setVocalVolume] = useState(() => Math.round(initialVolumes.headphoneVolume * 100));



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
    audioEngine.setOutputVolume('stream', backingVolume / 100);
    saveVolumePreferences({ streamVolume: backingVolume / 100, headphoneVolume: vocalVolume / 100 });
  }, [backingVolume]);

  useEffect(() => {
    audioEngine.setOutputVolume('headphone', vocalVolume / 100);
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
        >
          {currentView === 'stream' ? (
            <span>LIVE</span>
          ) : isHovered ? (
            <div>
              Stream<br />Mode
            </div>
          ) : (
            <span>音樂</span>
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '120px' }}>
          <label style={{ fontSize: '12px', color: '#b3b3b3', marginBottom: '4px' }}>伴奏音量</label>
          <input
            type="range"
            min="0"
            max="100"
            value={backingVolume}
            onChange={(e) => setBackingVolume(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-color)' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '120px' }}>
          <label style={{ fontSize: '12px', color: '#b3b3b3', marginBottom: '4px' }}>人聲音量</label>
          <input
            type="range"
            min="0"
            max="100"
            value={vocalVolume}
            onChange={(e) => setVocalVolume(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-color)' }}
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
