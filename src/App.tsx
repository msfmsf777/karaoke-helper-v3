import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import LibraryView from './components/LibraryView';
import LyricEditorView from './components/LyricEditorView';
import StreamModeView from './components/StreamModeView';
import TopBar from './components/TopBar';
import audioEngine from './audio/AudioEngine';
import './App.css';

type View = 'library' | 'lyrics' | 'stream';
type TrackInfo = { path: string; name: string };

function App() {
  const [currentView, setCurrentView] = useState<View>('library');
  const [currentTrack, setCurrentTrack] = useState<TrackInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const unsubscribeTime = audioEngine.onTimeUpdate((time) => {
      setCurrentTime(time);
      setDuration((prev) => {
        const next = audioEngine.getDuration();
        return next !== prev ? next : prev;
      });
    });
    const unsubscribeEnded = audioEngine.onEnded(() => {
      setIsPlaying(false);
      setCurrentTime(audioEngine.getDuration());
    });

    return () => {
      unsubscribeTime();
      unsubscribeEnded();
    };
  }, []);

  const getFileName = (filePath: string) => {
    const segments = filePath.split(/[/\\]/);
    return segments[segments.length - 1] || filePath;
  };

  const handleTrackSelect = async (filePath: string) => {
    try {
      await audioEngine.loadFile(filePath);
      const name = getFileName(filePath);
      setCurrentTrack({ path: filePath, name });
      setDuration(audioEngine.getDuration());
      setCurrentTime(0);
      setIsPlaying(false);
      console.log('[AudioEngine] Loaded file', filePath);
    } catch (err) {
      console.error('[AudioEngine] Failed to load file', filePath, err);
    }
  };

  const handlePlayPause = () => {
    if (!currentTrack) {
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

  const renderContent = () => {
    switch (currentView) {
      case 'library':
        return <LibraryView onSelectFile={handleTrackSelect} selectedTrackName={currentTrack?.name} />;
      case 'lyrics':
        return <LyricEditorView />;
      case 'stream':
        return <StreamModeView />;
      default:
        return <LibraryView onSelectFile={handleTrackSelect} selectedTrackName={currentTrack?.name} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* 1. Top Header (Hidden in Stream Mode) */}
      {currentView !== 'stream' && <TopBar />}

      {/* 2. Middle Region (Sidebar + Content) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Sidebar (Hidden in Stream Mode) */}
        {currentView !== 'stream' && (
          <Sidebar currentView={currentView} onViewChange={setCurrentView} />
        )}

        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
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
        currentTrackName={currentTrack?.name}
      />
    </div>
  );
}

export default App;
