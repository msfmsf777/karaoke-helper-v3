import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueue } from '../contexts/QueueContext';
import { useLibrary } from '../contexts/LibraryContext';
import { useUserData } from '../contexts/UserDataContext';
import audioEngine from '../audio/AudioEngine';
import { loadVolumePreferences, saveVolumePreferences } from '../settings/volumePreferences';
import PlaybackControlPopup from './PlaybackControlPopup';
import VolumeControlPopup from './VolumeControlPopup';
import ScrollingText from './ScrollingText';
import FitText from './FitText';
import AddToPlaylistMenu from './AddToPlaylistMenu';
import ModeSelector from './ModeSelector';
import ArtworkTile from './ArtworkTile';
import { useEnsureYoutubeThumbnail } from '../hooks/useEnsureYoutubeThumbnail';

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
  const { t } = useTranslation();
  const { playNext, playPrev, currentSongId, playbackMode, setPlaybackMode, isStreamWaiting, isPlaybackLoading, queue, currentIndex } = useQueue();
  const { getSongById, updateSong } = useLibrary();
  const initialVolumes = loadVolumePreferences() ?? { streamVolume: 0.8, headphoneVolume: 1 };

  let displayText = currentTrackName || t('shell.player.noSong');
  let isWaiting = false;
  let nextSongTitle = '';
  
  const currentSong = currentSongId ? getSongById(currentSongId) : null;
  const isStreaming = currentSong?.audio_status === 'streaming';
  const isControlsDisabled = !currentSongId || isStreaming;
  const remoteArtworkUrl = (() => {
    if (!isStreaming || currentSong?.source.kind !== 'youtube') return undefined;
    return currentSong.thumbnailUrl || `https://i.ytimg.com/vi/${currentSong.source.youtubeId}/hqdefault.jpg`;
  })();
  useEnsureYoutubeThumbnail(currentSong);

  if (playbackMode === 'stream' && isStreamWaiting) {
    isWaiting = true;
    const nextId = queue[currentIndex]; // In waiting state, currentIndex is the next song
    if (nextId) {
      const nextSong = getSongById(nextId);
      nextSongTitle = nextSong ? nextSong.title : t('shell.player.unknownSong');
      displayText = t('shell.player.nextSong', { title: nextSongTitle });
    } else {
      displayText = t('shell.player.emptySetlist');
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
    if (isPlaybackLoading) return;
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

  const progressValue = isPlaybackLoading ? 0 : (duration > 0 ? Math.min(currentTime, duration) : 0);
  const progressMax = isPlaybackLoading ? 0 : (duration > 0 ? duration : 0);

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

  // Two-way Sync: Listen for external volume changes (e.g. Mini Player)
  useEffect(() => {
    const cleanup = audioEngine.onVolumeChange((track, vol) => {
      const volInt = Math.round(vol * 100);
      if (track === 'instrumental') {
        setBackingVolume(prev => (prev !== volInt ? volInt : prev));
      } else {
        setVocalVolume(prev => (prev !== volInt ? volInt : prev));
      }
    });
    return cleanup;
  }, []);

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
      case 'repeat_one': return t('shell.player.repeatOne');
      case 'random': return t('shell.player.random');
      case 'stream': return t('shell.player.stream');
      default: return t('shell.player.order');
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
      <style>{`
        @keyframes khelperPlaybackLoadingRing {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      {/* Left: Song Info & Live Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', width: '30%', minWidth: 0 }}>
        <ArtworkTile
          thumbnailPath={currentSong?.thumbnail_path}
          remoteUrl={remoteArtworkUrl}
          size={56}
          title={currentView === 'stream' ? t('shell.player.closeStream') : t('shell.player.enterStream')}
          onClick={handleLiveToggle}
          overlayVisible={isHovered}
          dimmed={isHovered}
          overlay={currentView === 'stream' ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 14L4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
            </svg>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <img src={LiveModeIcon} alt="Live Mode" style={{ width: '20px', height: '20px', marginBottom: currentSong?.thumbnail_path ? 0 : '2px', display: 'block' }} />
              {!currentSong?.thumbnail_path && <span style={{ fontSize: '10px', color: '#ff4444', lineHeight: 1 }}>{t('shell.player.stream')}</span>}
            </div>
          )}
          badge={currentView === 'stream' && currentSong?.thumbnail_path ? (
            <span style={{
              position: 'absolute',
              right: '4px',
              bottom: '4px',
              padding: '1px 4px',
              borderRadius: '3px',
              background: 'rgba(255, 68, 68, 0.88)',
              color: '#fff',
              fontSize: '9px',
              fontWeight: 800,
              letterSpacing: 0,
            }}>
              LIVE
            </span>
          ) : null}
          placeholder={currentView === 'stream' && !isHovered ? <span>LIVE</span> : undefined}
          style={{
            marginRight: '12px',
            backgroundColor: currentView === 'stream' ? '#330000' : '#333',
            color: currentView === 'stream' ? '#ff4444' : '#ccc',
            border: currentView === 'stream' ? '1px solid #ff4444' : '1px solid #444',
            fontWeight: 700,
            fontSize: '14px',
            lineHeight: 1.2,
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        />
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
                {isStreaming && (
                  <div
                    title={t('shell.player.cloudStreamingTooltip')}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: 'rgba(68, 102, 170, 0.2)', color: '#88aaff',
                      fontSize: '10px', fontWeight: 600, padding: '2px 6px',
                      borderRadius: '4px', border: '1px solid rgba(68, 102, 170, 0.5)'
                    }}
                  >
                    {t('shell.player.cloudStreaming')}
                  </div>
                )}
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
                  title={isFavorite(currentSongId) ? t('shell.player.removeFavorite') : t('shell.player.addFavorite')}
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
                    title={t('shell.topBar.addToPlaylist')}
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
              <div style={{ fontSize: '12px', color: '#666' }}>
                {currentView === 'stream' ? t('shell.player.stream') : t('shell.player.switchModeHint')}
              </div>
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
              title={t('shell.player.previous')}
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
            <div style={{ position: 'relative', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isPlaybackLoading && (
                <div
                  style={{
                    position: 'absolute',
                    inset: '1px',
                    borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.16)',
                    borderTopColor: 'var(--accent-color)',
                    borderRightColor: 'rgba(255,255,255,0.45)',
                    animation: 'khelperPlaybackLoadingRing 0.8s linear infinite',
                    pointerEvents: 'none',
                  }}
                />
              )}
              <button
                onClick={handlePlayClick}
                disabled={isPlaybackLoading}
                title={isPlaybackLoading ? t('common.loading') : undefined}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '18px', // Circle
                  backgroundColor: '#fff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isPlaybackLoading ? 'wait' : 'pointer',
                  color: '#1e1e1e', // Soft black (matches app bg)
                  transition: 'transform 0.1s',
                  opacity: isPlaybackLoading ? 0.94 : 1,
                }}
                onMouseDown={(e) => { if (!isPlaybackLoading) e.currentTarget.style.transform = 'scale(0.95)'; }}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {isPlaying ? (
                  <img src={PauseIcon} alt="Pause" style={{ width: '16px', height: '16px', display: 'block' }} />
                ) : (
                  <img src={PlayIcon} alt="Play" style={{ width: '16px', height: '16px', display: 'block', marginLeft: '1px' }} />
                )}
              </button>
            </div>
            <button
              onClick={() => playNext(false)}
              title={t('shell.player.next')}
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
            title={isStreaming ? t('shell.player.speedDisabledTooltip') : t('shell.player.speedTooltip')}
            style={{
              background: showSpeedPopup ? '#333' : 'transparent',
              border: 'none',
              borderRadius: '4px',
              color: '#ccc',
              cursor: isControlsDisabled ? 'not-allowed' : 'pointer',
              width: '48px', // Slightly wider for comfort
              height: '48px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              transition: 'background-color 0.2s',
              opacity: isControlsDisabled ? 0.4 : 1,
              filter: isControlsDisabled ? 'grayscale(100%)' : 'none',
            }}
            disabled={isControlsDisabled}
          >
            <img src={SpeedIcon} alt="Speed" style={{ width: '24px', height: '24px', marginBottom: '2px', display: 'block' }} />
            <FitText
              text={t('shell.player.speed')}
              baseFontSize={10}
              minFontSize={8}
              style={{
                lineHeight: 1,
                textAlign: 'center',
                width: '44px',
              }}
            />
          </button>
          {showSpeedPopup && (
            <PlaybackControlPopup
              kind="speed"
              title={t('shell.player.speed')}
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
            title={isStreaming ? t('shell.player.pitchDisabledTooltip') : t('shell.player.pitchTooltip')}
            style={{
              background: showPitchPopup ? '#333' : 'transparent',
              border: 'none',
              borderRadius: '4px',
              color: '#ccc',
              cursor: isControlsDisabled ? 'not-allowed' : 'pointer',
              width: '48px',
              height: '48px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              transition: 'background-color 0.2s',
              opacity: isControlsDisabled ? 0.4 : 1,
              filter: isControlsDisabled ? 'grayscale(100%)' : 'none',
            }}
            disabled={isControlsDisabled}
          >
            <img src={PitchIcon} alt="Pitch" style={{ width: '24px', height: '24px', marginBottom: '2px', display: 'block' }} />
            <FitText
              text={t('shell.player.pitch')}
              baseFontSize={10}
              minFontSize={8}
              style={{
                lineHeight: 1,
                textAlign: 'center',
                width: '44px',
              }}
            />
          </button>
          {showPitchPopup && (
            <PlaybackControlPopup
              kind="pitch"
              title={t('shell.player.pitch')}
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
            label={t('shell.player.instrumental')}
            volume={backingVolume}
            onChange={(val) => setBackingVolume(val)}
          />
          <VolumeControlPopup
            label={t('shell.player.vocal')}
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
          title={t('shell.player.queue')}
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
