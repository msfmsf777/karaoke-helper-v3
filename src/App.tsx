import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import LibraryView from './components/LibraryView';
import LyricEditorView from './components/LyricEditorView';
import StreamModeView from './components/StreamModeView';
import TopBar from './components/TopBar';
import audioEngine from './audio/AudioEngine';
import './App.css';
import type { SongMeta } from '../shared/songTypes';

type View = 'library' | 'lyrics' | 'stream';
type TrackInfo = { id: string; path: string; title: string; artist?: string };

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

  const handleSongSelect = async (song: SongMeta, filePath: string) => {
    try {
      await audioEngine.loadFile(filePath);
      setCurrentTrack({ id: song.id, path: filePath, title: song.title, artist: song.artist });
      setDuration(audioEngine.getDuration());
      setCurrentTime(0);
      setIsPlaying(false);
      console.log('[AudioEngine] Loaded file', song.id, filePath);
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
        return <LibraryView onSongSelect={handleSongSelect} selectedSongId={currentTrack?.id} />;
      case 'lyrics':
        return <LyricEditorView />;
      case 'stream':
        return <StreamModeView />;
      default:
        return <LibraryView onSongSelect={handleSongSelect} selectedSongId={currentTrack?.id} />;
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
        currentTrackName={
          currentTrack
            ? currentTrack.artist
              ? `${currentTrack.title} – ${currentTrack.artist}`
              : currentTrack.title
            : undefined
        }
      />
    </div>
  );
}

export default App;
