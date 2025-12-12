import React, { useState, useEffect, useRef } from 'react';
import { useQueue } from '../contexts/QueueContext';
import { useLibrary } from '../contexts/LibraryContext';
import { useUserData } from '../contexts/UserDataContext';
import audioEngine from '../audio/AudioEngine';
import { loadVolumePreferences, saveVolumePreferences } from '../settings/volumePreferences';
import PlaybackControlPopup from './PlaybackControlPopup';
import VolumeControlPopup from './VolumeControlPopup';
import ScrollingText from './ScrollingText';
import AddToPlaylistMenu from './AddToPlaylistMenu';
import ModeSelector from './ModeSelector';

// Icons
import PlayIcon from '../assets/icons/play.svg';
import PauseIcon from '../assets/icons/pause.svg';
import NextIcon from '../assets/icons/next.svg';
import PrevIcon from '../assets/icons/prev.svg';
import LiveModeIcon from '../assets/icons/live_mode.svg';
import FavoritesIcon from '../assets/icons/favorites.svg';
import FavoritesFilledIcon from '../assets/icons/favorites_filled.svg';
import AddIcon from '../assets/icons/add.svg';
import PlaylistIcon from '../assets/icons/playlist.svg';
import SpeedIcon from '../assets/icons/speed.svg';
import PitchIcon from '../assets/icons/pitch.svg';
import ModeOrderIcon from '../assets/icons/mode_order.svg';
import ModeRepeatIcon from '../assets/icons/mode_repeat_one.svg';
import ModeRandomIcon from '../assets/icons/mode_random.svg';
import ModeStreamIcon from '../assets/icons/mode_stream.svg';


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
  const { playNext, playPrev, currentSongId, playbackMode, setPlaybackMode, isStreamWaiting, queue, currentIndex } = useQueue();
  const { getSongById, updateSong } = useLibrary();
  const initialVolumes = loadVolumePreferences() ?? { streamVolume: 0.8, headphoneVolume: 1 };

  // Logic to determine display text
  let displayText = currentTrackName || '尚未選擇歌曲';
  let isWaiting = false;
  let nextSongTitle = '';

  if (playbackMode === 'stream' && isStreamWaiting) {
    isWaiting = true;
    const nextId = queue[currentIndex]; // In waiting state, currentIndex is the next song
    if (nextId) {
      const nextSong = getSongById(nextId);
      nextSongTitle = nextSong ? nextSong.title : '未知歌曲';
      displayText = `下一首: ${nextSongTitle}`;
    } else {
      displayText = '待播清單已空';
    }
  }

  const [isHovered, setIsHovered] = useState(false);
  const [backingVolume, setBackingVolume] = useState(() => Math.round(initialVolumes.streamVolume * 100));
  const [vocalVolume, setVocalVolume] = useState(() => Math.round(initialVolumes.headphoneVolume * 100));
  const { isFavorite, toggleFavorite } = useUserData();
  const [showModeSelector, setShowModeSelector] = useState(false);

  // ... (rest of state logic)

  // Play Button Handler
  const handlePlayClick = () => {
    if (isWaiting) {
      // In Waiting State, Play button acts as "Start Next Song"
      playNext(false);
    } else {
      onPlayPause();
    }
  };

  // ... (rest of render logic)

  // Inside Return JSX for Play Button
  // replace onClick={onPlayPause} with onClick={handlePlayClick}
  // replace ScrollingText text={displayText}

  // To make replacement cleaner, I will replace the component start and specific Play button block.
  // Actually, I need to be careful with the ReplaceFileContent.
  // I will replace the start of component to add derived variables, and the ScrollingText, and the PlayButton.
  // But doing it consistently in one chunk is hard due to separation.
  // I will use multi-replace.

  // Wait, I only have replace_file_content tool available right now or I can switch to multi_replace.
  // I will use replace_file_content to update the Hook destructuring and insert the logic variables at the top.
  // Then another call for the usage.

  // Or I can replace the whole function body or larger chunk?
  // Let's replace from function start to `const [isHovered`.



  // Playlist Popup State
  const [showPlaylistPopup, setShowPlaylistPopup] = useState(false);
  const [playlistPopupPosition, setPlaylistPopupPosition] = useState({ x: 0, y: 0 });

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

  const getModeIcon = () => {
    switch (playbackMode) {
      case 'repeat_one': return ModeRepeatIcon;
      case 'random': return ModeRandomIcon;
      case 'stream': return ModeStreamIcon;
      default: return ModeOrderIcon;
    }
  };

  const getModeLabel = () => {
    switch (playbackMode) {
      case 'repeat_one': return '單曲循環';
      case 'random': return '隨機播放';
      case 'stream': return '直播模式';
      default: return '順序播放';
    }
  };

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
      <div style={{ display: 'flex', alignItems: 'center', width: '30%', minWidth: 0 }}>
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
            flexShrink: 0, // Prevent shrinking
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
              <img src={LiveModeIcon} alt="Live Mode" style={{ width: '20px', height: '20px', marginBottom: '2px', display: 'block' }} />
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
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, minWidth: 0 }}>
          {/* Song Title + Artist Marquee */}
          <div style={{ marginBottom: '4px', width: '100%' }}>
            <ScrollingText
              text={displayText}
              style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}
            />
          </div>

          {/* Action Icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '20px' }}>
            {currentSongId ? (
              <>
                <img
                  src={isFavorite(currentSongId) ? FavoritesFilledIcon : FavoritesIcon}
                  alt="Favorite"
                  style={{
                    width: '20px',
                    height: '20px',
                    cursor: 'pointer',
                    color: isFavorite(currentSongId) ? 'var(--primary-color)' : '#b3b3b3',
                    opacity: 0.8,
                    transition: 'opacity 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                  onClick={() => toggleFavorite(currentSongId)}
                  title={isFavorite(currentSongId) ? "取消最愛" : "加入最愛"}
                />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <img
                    src={AddIcon}
                    alt="Add to Playlist"
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer',
                      opacity: 0.8,
                      transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setPlaylistPopupPosition({ x: rect.left, y: rect.top });
                      setShowPlaylistPopup(true);
                    }}
                    title="加入歌單"
                  />
                  {showPlaylistPopup && currentSongId && (
                    <AddToPlaylistMenu
                      songId={currentSongId}
                      position={{
                        x: playlistPopupPosition.x,
                        y: playlistPopupPosition.y
                      }}
                      onClose={() => setShowPlaylistPopup(false)}
                    />
                  )}
                </div>
              </>
            ) : (
              <div style={{ fontSize: '12px', color: '#666' }}>直播模式</div>
            )}
          </div>
        </div>
      </div>

      {/* Center Controls */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '600px' }}>
        {/* Transport Row - Centered */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center', // Center content
          gap: '20px',
          marginBottom: '4px',
          width: '100%',
          position: 'relative' // For absolute positioning if needed, or just flex balance
        }}>

          {/* Left Balance: Mode Button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowModeSelector(!showModeSelector)}
              title={getModeLabel()} // Tooltip on hover
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                opacity: 0.8,
                transition: 'opacity 0.2s, transform 0.1s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.8';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            >
              <img src={getModeIcon()} alt={getModeLabel()} style={{ width: '20px', height: '20px', display: 'block' }} />
            </button>
            {showModeSelector && (
              <ModeSelector
                currentMode={playbackMode}
                onSelect={setPlaybackMode}
                onClose={() => setShowModeSelector(false)}
              />
            )}
          </div>

          {/* Center Group: Prev / Play / Next */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button
              onClick={playPrev}
              title="上一首"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                opacity: 0.8,
                transition: 'opacity 0.2s, transform 0.1s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.8';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            >
              <img src={PrevIcon} alt="Previous" style={{ width: '24px', height: '24px', display: 'block' }} />
            </button>
            <button
              onClick={handlePlayClick}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '18px', // Circle
                backgroundColor: '#fff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#1e1e1e', // Soft black (matches app bg)
                transition: 'transform 0.1s',
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              {isPlaying ? (
                <img src={PauseIcon} alt="Pause" style={{ width: '16px', height: '16px', display: 'block' }} />
              ) : (
                <img src={PlayIcon} alt="Play" style={{ width: '16px', height: '16px', display: 'block', marginLeft: '1px' }} />
              )}
            </button>
            <button
              onClick={() => playNext(false)}
              title="下一首"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                opacity: 0.8,
                transition: 'opacity 0.2s, transform 0.1s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.8';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            >
              <img src={NextIcon} alt="Next" style={{ width: '24px', height: '24px', display: 'block' }} />
            </button>
          </div>

          {/* Right Balance: Spacer */}
          <div style={{ width: '36px', height: '36px' }} />

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '30%', gap: '8px' }}>

        {/* Speed Control */}
        <div style={{ position: 'relative', top: '-4px' }}>
          <button
            onClick={() => { setShowSpeedPopup(!showSpeedPopup); setShowPitchPopup(false); }}
            style={{
              background: showSpeedPopup ? '#333' : 'transparent',
              border: 'none',
              borderRadius: '4px',
              color: '#ccc',
              cursor: 'pointer',
              width: '48px', // Slightly wider for comfort
              height: '48px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => { if (!showSpeedPopup) e.currentTarget.style.backgroundColor = '#333'; }}
            onMouseLeave={(e) => { if (!showSpeedPopup) e.currentTarget.style.backgroundColor = 'transparent'; }}
            title="變速 (Speed)"
          >
            <img src={SpeedIcon} alt="Speed" style={{ width: '24px', height: '24px', marginBottom: '2px', display: 'block' }} />
            <span style={{ fontSize: '10px', lineHeight: 1 }}>變速</span>
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
        <div style={{ position: 'relative', top: '-4px' }}>
          <button
            onClick={() => { setShowPitchPopup(!showPitchPopup); setShowSpeedPopup(false); }}
            style={{
              background: showPitchPopup ? '#333' : 'transparent',
              border: 'none',
              borderRadius: '4px',
              color: '#ccc',
              cursor: 'pointer',
              width: '48px',
              height: '48px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => { if (!showPitchPopup) e.currentTarget.style.backgroundColor = '#333'; }}
            onMouseLeave={(e) => { if (!showPitchPopup) e.currentTarget.style.backgroundColor = 'transparent'; }}
            title="變調 (Pitch)"
          >
            <img src={PitchIcon} alt="Pitch" style={{ width: '24px', height: '24px', marginBottom: '2px', display: 'block' }} />
            <span style={{ fontSize: '10px', lineHeight: 1 }}>變調</span>
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
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.8,
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
        >
          <img src={PlaylistIcon} alt="Queue" style={{ width: '28px', height: '28px', display: 'block' }} />
        </button>
      </div>
    </div>
  );
};

export default PlayerBar;
