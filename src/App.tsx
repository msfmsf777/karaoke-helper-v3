import { useEffect, useState, useRef, useMemo, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import LibraryView from './components/LibraryView';
import TopBar from './components/TopBar';
import QueuePanel from './components/QueuePanel';
import audioEngine, { OutputRole } from './audio/AudioEngine';
import { loadOutputDevicePreferences, saveOutputDevicePreferences } from './settings/devicePreferences';
import './App.css';
import { LibraryProvider, useLibrary } from './contexts/LibraryContext';
import { QueueProvider, useQueue } from './contexts/QueueContext';
import { UserDataProvider } from './contexts/UserDataContext';
import SkeletonSongList from './components/skeletons/SkeletonSongList';

// Lazy load heavy components
const LyricEditorView = lazy(() => import('./components/LyricEditorView'));
const StreamModeView = lazy(() => import('./components/StreamModeView'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const ProcessingListModal = lazy(() => import('./components/ProcessingListModal'));
const FavoritesView = lazy(() => import('./components/FavoritesView'));
const HistoryView = lazy(() => import('./components/HistoryView'));
const PlaylistView = lazy(() => import('./components/PlaylistView'));
const DownloadManagerView = lazy(() => import('./components/DownloadManagerView'));
const SearchResultsView = lazy(() => import('./components/SearchResultsView'));

type View = 'library' | 'lyrics' | 'stream' | 'favorites' | 'history' | 'download-manager' | string;

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('library');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showProcessingList, setShowProcessingList] = useState(false);
  const [showQueuePanel, setShowQueuePanel] = useState(false);
  const [outputDevices, setOutputDevices] = useState({
    streamDeviceId: null as string | null,
    headphoneDeviceId: null as string | null,
  });
  const [lyricsEditorSongId, setLyricsEditorSongId] = useState<string | null>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  const { currentSongId, playNext } = useQueue();
  const { getSongById } = useLibrary();

  const currentTrack = useMemo(() => {
    if (!currentSongId) return null;
    const song = getSongById(currentSongId);
    if (!song) return null;
    return { id: song.id, title: song.title, artist: song.artist };
  }, [currentSongId, getSongById]);

  // Reset scroll when view changes
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }
  }, [currentView]);

  useEffect(() => {
    const unsubscribeTime = audioEngine.onTimeUpdate((time) => {
      setCurrentTime(time);
      setDuration((prev) => {
        const next = audioEngine.getDuration();
        return next !== prev ? next : prev;
      });
    });
    const unsubscribeEnded = audioEngine.onEnded(() => {
      // Auto-play next song
      playNext();
    });

    // Sync initial state
    setIsPlaying(audioEngine.isPlaying());

    return () => {
      unsubscribeTime();
      unsubscribeEnded();
    };
  }, [playNext]);

  // A simple way to keep isPlaying in sync if we don't have explicit events for it
  useEffect(() => {
    const interval = setInterval(() => {
      if (audioEngine.isPlaying() !== isPlaying) {
        setIsPlaying(audioEngine.isPlaying());
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    const saved = loadOutputDevicePreferences();
    if (!saved) return;

    setOutputDevices(saved);
    audioEngine.setOutputDevice('stream', saved.streamDeviceId ?? null).catch((err) => {
      console.warn('[AudioEngine] Failed to apply saved stream device', saved.streamDeviceId, err);
    });
    audioEngine.setOutputDevice('headphone', saved.headphoneDeviceId ?? null).catch((err) => {
      console.warn('[AudioEngine] Failed to apply saved headphone device', saved.headphoneDeviceId, err);
    });
  }, []);

  // Send updates to overlay window
  useEffect(() => {
    if (currentTrack) {
      window.api.sendOverlayUpdate({
        songId: currentTrack.id,
        currentTime,
        isPlaying,
      });
    }
  }, [currentTrack, currentTime, isPlaying]);

  const handlePlayPause = () => {
    if (!currentTrack) {
      // If no track loaded, maybe try to play the first one in queue?
      // For now, just warn.
      console.warn('[AudioEngine] Play requested but no track is loaded');
      return;
    }

    if (audioEngine.isPlaying()) {
      audioEngine.pause();
      setIsPlaying(false);
    } else {
      audioEngine.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (seconds: number) => {
    audioEngine.seek(seconds);
    setCurrentTime(seconds);
  };

  const handleDeviceChange = async (role: OutputRole, deviceId: string | null) => {
    const next = {
      ...outputDevices,
      [role === 'stream' ? 'streamDeviceId' : 'headphoneDeviceId']: deviceId ?? null,
    };
    setOutputDevices(next);
    saveOutputDevicePreferences(next);

    try {
      await audioEngine.setOutputDevice(role, deviceId);
    } catch (err) {
      console.error(`[Settings] Failed to set output device for ${role}`, deviceId, err);
    }
  };

  const renderContent = () => {
    return (
      <Suspense fallback={
        <div style={{ padding: '0 32px', marginTop: '32px' }}>
          <SkeletonSongList count={8} />
        </div>
      }>
        {(() => {
          if (currentView.startsWith('playlist:')) {
            const playlistId = currentView.split(':')[1];
            return <PlaylistView playlistId={playlistId} />;
          }

          if (currentView.startsWith('search-results:')) {
            const term = currentView.split(':')[1];
            return <SearchResultsView searchTerm={decodeURIComponent(term)} />;
          }

          switch (currentView) {
            case 'library':
              return (
                <LibraryView
                  onOpenLyrics={(song) => {
                    setLyricsEditorSongId(song.id);
                    setCurrentView('lyrics');
                  }}
                />
              );
            case 'download-manager':
              return <DownloadManagerView />;
            case 'lyrics':
              return (
                <LyricEditorView
                  activeSongId={currentTrack?.id}
                  initialSongId={lyricsEditorSongId}
                  onSongSelectedChange={(songId) => setLyricsEditorSongId(songId)}
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  duration={duration}
                  onPlayPause={handlePlayPause}
                  onSeek={handleSeek}
                />
              );
            case 'stream':
              return (
                <StreamModeView
                  currentTrack={currentTrack}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  onExit={() => setCurrentView('library')}
                  onOpenOverlayWindow={() => window.api.openOverlayWindow()}
                />
              );

            case 'favorites':
              return <FavoritesView />;
            case 'history':
              return <HistoryView />;
            default:
              return <LibraryView />;
          }
        })()}
      </Suspense>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* 1. Top Header (Hidden in Stream Mode) */}
      {currentView !== 'stream' && (
        <TopBar
          onOpenSettings={() => setShowSettings(true)}
          onOpenProcessing={() => setShowProcessingList(true)}
          onSearch={(term) => setCurrentView(`search-results:${encodeURIComponent(term)}`)}
        />
      )}

      {/* 2. Middle Region (Sidebar + Content) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Sidebar (Hidden in Stream Mode) */}
        {currentView !== 'stream' && (
          <Sidebar currentView={currentView} onViewChange={setCurrentView} />
        )}

        <div ref={mainContentRef} style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {renderContent()}
        </div>
      </div>

      {/* 3. Bottom Footer */}
      <PlayerBar
        currentView={currentView}
        onViewChange={setCurrentView}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        currentTrackName={
          currentTrack
            ? currentTrack.artist
              ? `${currentTrack.title} - ${currentTrack.artist}`
              : currentTrack.title
            : undefined
        }
        onToggleQueue={() => setShowQueuePanel((prev) => !prev)}
      />
      <QueuePanel isOpen={showQueuePanel} onClose={() => setShowQueuePanel(false)} />
      <Suspense fallback={null}>
        {showSettings && (
          <SettingsModal
            open={showSettings}
            onClose={() => setShowSettings(false)}
            streamDeviceId={outputDevices.streamDeviceId}
            headphoneDeviceId={outputDevices.headphoneDeviceId}
            onChangeDevice={handleDeviceChange}
          />
        )}
        {showProcessingList && (
          <ProcessingListModal open={showProcessingList} onClose={() => setShowProcessingList(false)} />
        )}
      </Suspense>

    </div>
  );
}

function App() {
  return (
    <LibraryProvider>
      <QueueProvider>
        <UserDataProvider>
          <AppContent />
        </UserDataProvider>
      </QueueProvider>
    </LibraryProvider>
  );
}

export default App;
