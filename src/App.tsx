import { useState } from 'react';
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import LibraryView from './components/LibraryView';
import LyricEditorView from './components/LyricEditorView';
import StreamModeView from './components/StreamModeView';
import TopBar from './components/TopBar';
import './App.css';

type View = 'library' | 'lyrics' | 'stream';

function App() {
  const [currentView, setCurrentView] = useState<View>('library');

  const renderContent = () => {
    switch (currentView) {
      case 'library':
        return <LibraryView />;
      case 'lyrics':
        return <LyricEditorView />;
      case 'stream':
        return <StreamModeView />;
      default:
        return <LibraryView />;
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
      <PlayerBar currentView={currentView} onViewChange={setCurrentView} />
    </div>
  );
}

export default App;
