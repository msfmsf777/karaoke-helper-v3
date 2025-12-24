import { useEffect, useState, useRef, useMemo, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import LibraryView from './components/LibraryView';
import TopBar from './components/TopBar';
import QueuePanel from './components/QueuePanel';
import AddSongSidebar from './components/AddSongSidebar';
import audioEngine, { OutputRole } from './audio/AudioEngine';
import { loadOutputDevicePreferences, saveOutputDevicePreferences, getAudioOffset } from './settings/devicePreferences';
import './App.css';
import { LibraryProvider, useLibrary } from './contexts/LibraryContext';
import { QueueProvider, useQueue } from './contexts/QueueContext';
import { UserDataProvider } from './contexts/UserDataContext';
import { UpdaterProvider } from './contexts/UpdaterContext';
import SkeletonSongList from './components/skeletons/SkeletonSongList';

// Lazy load heavy components
const LyricEditorView = lazy(() => import('./components/LyricEditorView'));
const StreamModeView = lazy(() => import('./components/StreamModeView'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const ProcessingListModal = lazy(() => import('./components/ProcessingListModal'));
const FavoritesView = lazy(() => import('./components/FavoritesView'));
const HistoryView = lazy(() => import('./components/HistoryView'));
const PlaylistView = lazy(() => import('./components/PlaylistView'));
const DownloadManagerView = lazy(() => import('./components/DownloadManagerView'));
const SearchResultsView = lazy(() => import('./components/SearchResultsView'));

const AboutPopup = lazy(() => import('./components/AboutPopup'));
import MiniPlayerSync from './components/MiniPlayer/MiniPlayerSync';

type View = 'library' | 'lyrics' | 'stream' | 'favorites' | 'history' | 'download-manager' | 'settings' | string;

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('library');
  const [previousView, setPreviousView] = useState<View>('library');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showProcessingList, setShowProcessingList] = useState(false);
  const [showQueuePanel, setShowQueuePanel] = useState(false);
  const [showAddSongWizard, setShowAddSongWizard] = useState(false);
  const [showAboutPopup, setShowAboutPopup] = useState(false);
  const [outputDevices, setOutputDevices] = useState({
    streamDeviceId: null as string | null,
    headphoneDeviceId: null as string | null,
  });
  const [lyricsEditorSongId, setLyricsEditorSongId] = useState<string | null>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  const { currentSongId, playNext, queue, currentIndex, isStreamWaiting } = useQueue();
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
      playNext(true);
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


    // Apply saved offset
    const savedOffset = getAudioOffset(saved.streamDeviceId ?? null, saved.headphoneDeviceId ?? null);
    audioEngine.setOffset(savedOffset);

    // Apply saved stream enabled state
    const streamEnabled = saved.isStreamEnabled ?? true;
    audioEngine.setOutputVolume('stream', streamEnabled ? 1.0 : 0);
  }, []);

  // Always send update if state changes, even if no track is playing (e.g. waiting state)
  useEffect(() => {
    window.api.sendOverlayUpdate({
      songId: currentTrack?.id ?? '',
      currentTime,
      isPlaying,
      queue,
      currentIndex,
      isStreamWaiting
    });
  }, [currentTrack, currentTime, isPlaying, queue, currentIndex, isStreamWaiting]);

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

      // Update offset for the new pair
      const offset = getAudioOffset(next.streamDeviceId, next.headphoneDeviceId);
      audioEngine.setOffset(offset);
    } catch (err) {
      console.error(`[Settings] Failed to set output device for ${role}`, deviceId, err);
    }
  };

  const [isStreamMode, setIsStreamMode] = useState(false);
  // We keep track of whether we should render the stream view to save resources when hidden
  const [renderStreamView, setRenderStreamView] = useState(false);
  const [isMainLayerVisible, setIsMainLayerVisible] = useState(true);

  useEffect(() => {
    if (isStreamMode) {
      const timer = setTimeout(() => setIsMainLayerVisible(false), 500);
      return () => clearTimeout(timer);
    } else {
      setIsMainLayerVisible(true);
    }
  }, [isStreamMode]);

  const handleViewChange = (newView: View) => {
    if (newView === 'stream') {
      setRenderStreamView(true);
      // Small delay to allow render before fading in
      requestAnimationFrame(() => {
        setIsStreamMode(true);
      });
    } else {
      if (isStreamMode) {
        // Exiting stream mode
        setIsStreamMode(false);
        // Wait for transition to finish before unmounting
        setTimeout(() => {
          setRenderStreamView(false);
        }, 500); // Match CSS transition duration
      }
      setCurrentView(newView);
    }
  };

  const handleOpenSettings = () => {
    if (currentView === 'settings') {
      handleViewChange(previousView);
    } else {
      setPreviousView(currentView);
      handleViewChange('settings');
    }
  };

  // Listen for Tray navigation events
  useEffect(() => {
    const removeListener = window.khelper?.navigation.onNavigate((view) => {
      if (view === 'settings') {
        if (currentView !== 'settings') {
          setPreviousView(currentView);
          handleViewChange('settings');
        }
      } else {
        handleViewChange(view);
      }
    });
    return () => removeListener?.();
  }, [currentView]);

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
                    handleViewChange('lyrics');
                  }}
                  onOpenAddSong={() => setShowAddSongWizard(true)}
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
            case 'settings':
              return (
                <SettingsView
                  onBack={() => handleViewChange(previousView)}
                  streamDeviceId={outputDevices.streamDeviceId}
                  headphoneDeviceId={outputDevices.headphoneDeviceId}
                  onChangeDevice={handleDeviceChange}
                />
              );
            case 'favorites':
              return <FavoritesView />;
            case 'history':
              return <HistoryView />;
            default:
              return <LibraryView onOpenAddSong={() => setShowAddSongWizard(true)} />;
          }
        })()}
      </Suspense>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#121212' }}>

      {/* Upper Area (Fading Content) */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* Main App Layer */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: isMainLayerVisible ? 'flex' : 'none',
            flexDirection: 'column',
            opacity: isStreamMode ? 0 : 1,
            transition: 'opacity 0.5s ease-in-out',
            pointerEvents: isStreamMode ? 'none' : 'auto',
            zIndex: 1
          }}
        >
          <TopBar
            onOpenSettings={handleOpenSettings}
            onOpenProcessing={() => setShowProcessingList(true)}
            onOpenAbout={() => setShowAboutPopup(true)}
            onSearch={(term) => handleViewChange(`search-results:${encodeURIComponent(term)}`)}
          />

          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
            <Sidebar currentView={currentView} onViewChange={handleViewChange} />
            <div ref={mainContentRef} style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              {renderContent()}
            </div>
          </div>
        </div>

        {/* Stream Mode Overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: isStreamMode ? 1 : 0,
            transition: 'opacity 0.5s ease-in-out',
            pointerEvents: isStreamMode ? 'auto' : 'none',
            zIndex: 10,
            backgroundColor: '#000' // Ensure opaque background
          }}
        >
          {renderStreamView && (
            <Suspense fallback={null}>
              <StreamModeView
                currentTime={currentTime}
              />
            </Suspense>
          )}
        </div>

      </div>

      {/* Persistent Footer */}
      <PlayerBar
        currentView={isStreamMode ? 'stream' : currentView}
        onViewChange={handleViewChange}
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

      {/* Global Modals */}
      <QueuePanel isOpen={showQueuePanel} onClose={() => setShowQueuePanel(false)} />
      {showAddSongWizard && (
        <AddSongSidebar isOpen={showAddSongWizard} onClose={() => setShowAddSongWizard(false)} />
      )}
      <Suspense fallback={null}>
        <MiniPlayerSync />
        {showProcessingList && (
          <ProcessingListModal open={showProcessingList} onClose={() => setShowProcessingList(false)} />
        )}
        {showAboutPopup && (
          <AboutPopup open={showAboutPopup} onClose={() => setShowAboutPopup(false)} />
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
          <UpdaterProvider>
            <AppContent />
          </UpdaterProvider>
        </UserDataProvider>
      </QueueProvider>
    </LibraryProvider>
  );
}

export default App;
