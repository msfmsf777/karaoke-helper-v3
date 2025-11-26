import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useUserData } from '../contexts/UserDataContext';
import { useLibrary } from '../contexts/LibraryContext';
import { useQueue } from '../contexts/QueueContext';
import LogoImage from '../assets/images/logo.png';
import TasksIcon from '../assets/icons/tasks.svg';
import SettingsIcon from '../assets/icons/settings.svg';
import AboutIcon from '../assets/icons/about.svg';

interface TopBarProps {
  onOpenSettings?: () => void;
  onOpenProcessing?: () => void;
  onOpenAbout?: () => void;
  onSearch?: (term: string) => void;
}

const TopBar: React.FC<TopBarProps> = ({ onOpenSettings, onOpenProcessing, onOpenAbout, onSearch }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const { recentSearches, addRecentSearch, clearRecentSearches } = useUserData();
  const { songs } = useLibrary();
  const { playSongList } = useQueue();
  const searchContainerRef = useRef<HTMLDivElement>(null);



  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearch = (term: string) => {
    if (!term.trim()) return;
    addRecentSearch(term);
    setIsFocused(false);
    if (onSearch) onSearch(term);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(searchTerm);
      setSearchTerm('');
    }
  };

  // Live search results for dropdown
  const liveResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const lowerTerm = searchTerm.toLowerCase();
    return songs.filter(song =>
      song.title.toLowerCase().includes(lowerTerm) ||
      (song.artist && song.artist.toLowerCase().includes(lowerTerm))
    ).slice(0, 5);
  }, [searchTerm, songs]);

  return (
    <div
      style={{
        height: '64px',
        backgroundColor: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
        zIndex: 100, // Ensure dropdown is on top
      }}
    >
      {/* Left: Logo (Fixed Width to match Sidebar) */}
      <div
        style={{
          width: '218px',
          flexShrink: 0,
          fontSize: '18px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <img
          src={LogoImage}
          alt="Logo"
          style={{
            width: '32px',
            height: '32px',
            objectFit: 'contain',
          }}
        />
        KHelper V3
      </div>

      {/* Center: Search Bar */}
      <div
        ref={searchContainerRef}
        style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: '16px', position: 'relative' }}
      >
        <div style={{ position: 'relative', width: '300px' }}>
          <input
            type="text"
            placeholder="搜尋歌曲 / 歌手"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
            style={{
              backgroundColor: '#282828',
              border: '1px solid #3e3e3e',
              borderRadius: '16px',
              padding: '6px 36px 6px 16px', // Right padding for icon
              color: '#fff',
              fontSize: '13px',
              width: '100%',
              boxSizing: 'border-box', // Ensure padding doesn't affect width
              outline: 'none',
            }}
          />
          <div
            onClick={() => {
              handleSearch(searchTerm);
              setSearchTerm(''); // Clear after search
            }}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              cursor: 'pointer',
              color: '#aaa',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>

          {/* Dropdown */}
          {isFocused && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              width: '100%',
              backgroundColor: '#282828',
              border: '1px solid #3e3e3e',
              borderRadius: '8px',
              marginTop: '4px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              zIndex: 1000
            }}>
              {searchTerm.trim() === '' ? (
                // Recent Searches
                <div>
                  <div style={{
                    padding: '8px 12px',
                    fontSize: '12px',
                    color: '#aaa',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>最近搜尋</span>
                    {recentSearches.length > 0 && (
                      <span
                        onClick={(e) => { e.stopPropagation(); clearRecentSearches(); }}
                        style={{ cursor: 'pointer', color: '#888' }}
                      >
                        清除
                      </span>
                    )}
                  </div>
                  {recentSearches.length > 0 ? (
                    recentSearches.map((term, index) => (
                      <div
                        key={index}
                        onClick={() => {
                          setSearchTerm(term);
                          handleSearch(term);
                          // Note: handleSearch doesn't clear term immediately here because we just set it.
                          // But user wants to clear it after action. 
                          // Actually, if we navigate to search results, maybe we want to keep the term?
                          // User said: "clear the text in the search box so it is easier to search again."
                          // So yes, clear it.
                          setSearchTerm('');
                        }}
                        className="search-item"
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: '#eee',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3e3e3e'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span style={{ color: '#aaa' }}>🕒</span>
                        {term}
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '12px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
                      無最近搜尋紀錄
                    </div>
                  )}
                </div>
              ) : (
                // Live Results
                <div>
                  <div style={{ padding: '8px 12px', fontSize: '12px', color: '#aaa' }}>
                    搜尋結果
                  </div>
                  {liveResults.length > 0 ? (
                    liveResults.map(song => (
                      <div
                        key={song.id}
                        onClick={() => {
                          // Play this song immediately or add to queue? 
                          // User said "replace... with results". 
                          // Usually quick result click -> play.
                          // Let's play it as a single song list.
                          playSongList([song.id]);
                          addRecentSearch(searchTerm); // Also save term
                          setSearchTerm(''); // Clear after action
                          setIsFocused(false);
                        }}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: '#eee',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3e3e3e'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div style={{ fontWeight: '500' }}>{song.title}</div>
                        <div style={{ fontSize: '11px', color: '#aaa' }}>{song.artist || 'Unknown Artist'}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '12px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
                      找不到相符歌曲
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={onOpenProcessing}
          title="處理中任務"
          style={{
            background: 'none',
            border: 'none',
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
          <img src={TasksIcon} alt="Tasks" style={{ width: '24px', height: '24px', display: 'block' }} />
        </button>
        <button
          onClick={onOpenSettings}
          title="設定"
          style={{
            background: 'none',
            border: 'none',
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
          <img src={SettingsIcon} alt="Settings" style={{ width: '24px', height: '24px', display: 'block' }} />
        </button>
        <button
          onClick={onOpenAbout}
          title="關於"
          style={{
            background: 'none',
            border: 'none',
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
          <img src={AboutIcon} alt="About" style={{ width: '24px', height: '24px', display: 'block' }} />
        </button>
      </div>
    </div>
  );
};

export default TopBar;
