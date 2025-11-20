import { useEffect, useState } from 'react';
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
import type { SongMeta } from '../shared/songTypes';

type View = 'library' | 'lyrics' | 'stream';
type TrackInfo = { id: string; path: string; title: string; artist?: string };

function App() {
  const [currentView, setCurrentView] = useState<View>('library');
  const [currentTrack, setCurrentTrack] = useState<TrackInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showProcessingList, setShowProcessingList] = useState(false);
  const [outputDevices, setOutputDevices] = useState({
    streamDeviceId: null as string | null,
    headphoneDeviceId: null as string | null,
  });

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
      {currentView !== 'stream' && (
        <TopBar onOpenSettings={() => setShowSettings(true)} onOpenProcessing={() => setShowProcessingList(true)} />
      )}

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

export default App;
