import { useEffect, useState, useRef, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import LibraryView from './components/LibraryView';
import LyricEditorView from './components/LyricEditorView';
import StreamModeView from './components/StreamModeView';
import TopBar from './components/TopBar';
import SettingsModal from './components/SettingsModal';
import ProcessingListModal from './components/ProcessingListModal';
import audioEngine, { OutputRole } from './audio/AudioEngine';
import { loadOutputDevicePreferences, saveOutputDevicePreferences } from './settings/devicePreferences';
import './App.css';
import { LibraryProvider, useLibrary } from './contexts/LibraryContext';
import { QueueProvider, useQueue } from './contexts/QueueContext';

type View = 'library' | 'lyrics' | 'stream';

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('library');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showProcessingList, setShowProcessingList] = useState(false);
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

    // Poll for play state changes that might happen outside of React (e.g. audio engine internals)
    // Or better, add a listener to AudioEngine if it supported it. 
    // For now, we hook into play/pause methods or rely on timeupdate.
    // Actually, let's just rely on the fact that we control play/pause via the UI mostly.
    // But to be safe, we can update isPlaying on timeupdate too.

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
      case 'lyrics':
        return (
          <LyricEditorView
            onSongLoad={async () => { /* No-op, handled by queue now */ }}
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
      default:
        return <LibraryView />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* 1. Top Header (Hidden in Stream Mode) */}
      {currentView !== 'stream' && (
        <TopBar onOpenSettings={() => setShowSettings(true)} onOpenProcessing={() => setShowProcessingList(true)} />
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
      />
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        streamDeviceId={outputDevices.streamDeviceId}
        headphoneDeviceId={outputDevices.headphoneDeviceId}
        onChangeDevice={handleDeviceChange}
      />
      <ProcessingListModal open={showProcessingList} onClose={() => setShowProcessingList(false)} />
    </div>
  );
}

function App() {
  return (
    <LibraryProvider>
      <QueueProvider>
        <AppContent />
      </QueueProvider>
    </LibraryProvider>
  );
}

export default App;
