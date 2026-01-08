import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useUserData } from '../contexts/UserDataContext';
import { SongMeta } from '../../shared/songTypes';
import { useLibrary } from '../contexts/LibraryContext';
import { useQueue } from '../contexts/QueueContext';
import LogoImage from '../assets/images/logo.png';
import TasksIcon from '../assets/icons/tasks.svg';
import SettingsIcon from '../assets/icons/settings.svg';
import AboutIcon from '../assets/icons/about.svg';
import MiniPlayerIcon from '../assets/icons/mini_player.svg';
import WindowControls from './WindowControls';

interface TopBarProps {
  onOpenSettings?: () => void;
  onOpenProcessing?: () => void;
  onOpenAbout?: () => void;
  onSearch?: (term: string) => void;
}

import { useUpdater } from '../contexts/UpdaterContext';
import UpdatePopup from './UpdatePopup';

import UpdateIconBase from '../assets/icons/update_base.svg';

import SongContextMenu from './SongContextMenu';
import AddToPlaylistMenu from './AddToPlaylistMenu';
import AddIcon from '../assets/icons/add.svg';
import MoreIcon from '../assets/icons/more.svg';

// Search Result Item Component
const SearchResultItem: React.FC<{
  song: SongMeta;
  isActive: boolean;
  onPlay: () => void;
  onContextMenu: (e: React.MouseEvent, song: SongMeta) => void;
  onAddToPlaylist: (e: React.MouseEvent, song: SongMeta) => void;
  onMore: (e: React.MouseEvent, song: SongMeta) => void;
}> = ({ song, isActive, onPlay, onContextMenu, onAddToPlaylist, onMore }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onPlay}
      onContextMenu={(e) => onContextMenu(e, song)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '8px 12px',
        cursor: 'pointer',
        backgroundColor: isActive ? 'rgba(255, 255, 255, 0.1)' : (isHovered ? 'rgba(255, 255, 255, 0.05)' : 'transparent'),
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
      }}
    >
      {/* Removed placeholder box to left align text */
        /* Text Container with Smart Truncation */
      }

      {/* Text Container with Smart Truncation */}
      <div style={{
        flex: 1,
        minWidth: 0, // Critical for flex truncation
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color: isActive ? 'var(--accent-color)' : '#fff'
        }}>
          {song.title}
        </div>
        <div style={{
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.6)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {song.artist}
        </div>
      </div>

      {/* Hover Actions */}
      {isHovered && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          paddingLeft: '8px', // Visual separation
          backgroundColor: 'transparent',
          flexShrink: 0
        }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToPlaylist(e, song);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              opacity: 0.6,
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
            title="加入歌單"
          >
            <img src={AddIcon} alt="Add" style={{ width: '16px', height: '16px', filter: 'brightness(0) invert(1)' }} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMore(e, song);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              opacity: 0.6,
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
            title="更多"
          >
            <img src={MoreIcon} alt="More" style={{ width: '16px', height: '16px', filter: 'brightness(0) invert(1)' }} />
          </button>
        </div>
      )}
    </div>
  );
};

const UpdateIndicator: React.FC = () => {
  const { status } = useUpdater();
  const [showPopup, setShowPopup] = useState(false);

  // Show if available OR error
  // Note: we removed 'downloading' and 'downloaded' states
  const isVisible = ['available', 'error'].includes(status);

  if (!isVisible) return null;

  return (
    <>
      <button
        onClick={() => setShowPopup(true)}
        title={status === 'error' ? '更新檢查失敗' : '有新版本可用'}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: status === 'error' ? 1 : 0.8, // Full opacity for error
          transition: 'opacity 0.2s',
          position: 'relative',
          gap: '0px',
          // @ts-ignore
          WebkitAppRegion: 'no-drag',
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = status === 'error' ? '1' : '0.8'}
      >
        <div style={{ position: 'relative', display: 'flex' }}>
          {/* Base Icon - Use imported SVG */}
          <img
            src={UpdateIconBase}
            alt="Update"
            style={{
              width: '24px',
              height: '24px',
              display: 'block',
              // Tint red if error (using filter because it's an img tag)
              filter: status === 'error'
                ? 'sepia(1) saturate(10000%) hue-rotate(0deg) brightness(80%) saturate(1000%)' // Attempt to make it red
                : 'none'
            }}
          />
        </div>
      </button>
      {showPopup && <UpdatePopup onClose={() => setShowPopup(false)} />}
    </>
  );
};


const TopBar: React.FC<TopBarProps> = ({ onOpenSettings, onOpenProcessing, onOpenAbout, onSearch }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const { recentSearches, addRecentSearch, clearRecentSearches } = useUserData();
  const { songs } = useLibrary();
  const { playSongList, currentSongId } = useQueue();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isMiniPlayerOpen, setIsMiniPlayerOpen] = useState(false);

  // Context Menu States
  const [contextMenu, setContextMenu] = useState<{ song: SongMeta; position: { x: number; y: number } } | null>(null);
  const [addToPlaylistMenu, setAddToPlaylistMenu] = useState<{ songId: string; position: { x: number; y: number } } | null>(null);

  useEffect(() => {
    window.khelper?.miniPlayer?.getVisibility().then(setIsMiniPlayerOpen);
    const cleanup = window.khelper?.miniPlayer?.onVisibilityChange?.(setIsMiniPlayerOpen);
    return cleanup;
  }, []);

  // Listen for backend Title Bar clicks (Windows Only)
  useEffect(() => {
    // @ts-ignore
    const cleanup = window.khelper?.windowOps?.onTitleBarClick?.(() => {
      setIsFocused(false);
    });
    return cleanup;
  }, []);



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

  // Force blur when isFocused becomes false (e.g. caused by Top Bar click)
  useEffect(() => {
    if (!isFocused && inputRef.current) {
      inputRef.current.blur();
    }
  }, [isFocused]);

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
        // @ts-ignore
        WebkitAppRegion: 'drag',
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
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '16px',
          position: 'relative',
        }}
      >
        <div
          ref={searchContainerRef}
          style={{
            position: 'relative',
            width: '300px',
            // @ts-ignore
            WebkitAppRegion: 'no-drag'
          }}
        >
          <input
            ref={inputRef}
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
                      <SearchResultItem
                        key={song.id}
                        song={song}
                        isActive={currentSongId === song.id}
                        onPlay={() => {
                          // Play this song immediately or add to queue? 
                          // User said "replace... with results". 
                          // Usually quick result click -> play.
                          // Let's play it as a single song list.
                          playSongList([song.id]);
                          // Or use queue.playImmediate(song)?
                          // queue context usually has playImmediate.
                          addRecentSearch(searchTerm); // Also save term
                          setSearchTerm(''); // Clear after action
                          setIsFocused(false);
                        }}
                        onContextMenu={(e, song) => {
                          e.preventDefault();
                          setContextMenu({ song, position: { x: e.clientX, y: e.clientY } });
                        }}
                        onAddToPlaylist={(e, song) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setAddToPlaylistMenu({ songId: song.id, position: { x: rect.left, y: rect.bottom + 5 } });
                        }}
                        onMore={(e, song) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setContextMenu({ song, position: { x: rect.left, y: rect.bottom + 5 } });
                        }}
                      />
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
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <UpdateIndicator />
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
            // @ts-ignore
            WebkitAppRegion: 'no-drag',
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
            // @ts-ignore
            WebkitAppRegion: 'no-drag',
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
            // @ts-ignore
            WebkitAppRegion: 'no-drag',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
        >
          <img src={AboutIcon} alt="About" style={{ width: '24px', height: '24px', display: 'block' }} />
        </button>

        <button
          onClick={() => window.khelper?.miniPlayer?.toggle()}
          title="迷你播放器"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isMiniPlayerOpen ? 1 : 0.8,
            transition: 'opacity 0.2s',
            // @ts-ignore
            WebkitAppRegion: 'no-drag',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = isMiniPlayerOpen ? '1' : '0.8'}
        >
          <img
            src={MiniPlayerIcon}
            alt="Mini Player"
            style={{
              width: '26px',
              height: '26px',
              display: 'block',
              filter: isMiniPlayerOpen ? 'brightness(0) saturate(100%) invert(86%) sepia(21%) saturate(958%) hue-rotate(69deg) brightness(97%) contrast(89%)' : 'none',
              transition: 'filter 0.2s'
            }}
          />
        </button>

        <div style={{ width: '1px', height: '24px', backgroundColor: '#3e3e3e', margin: '0 8px' }}></div>

        <WindowControls />
      </div>
      {/* Menus */}
      {contextMenu && (
        <SongContextMenu
          song={contextMenu.song}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onEditLyrics={() => {
            setContextMenu(null);
            setIsFocused(false); // Close search logic handled via navigation usually
          }}
        />
      )}
      {addToPlaylistMenu && (
        <AddToPlaylistMenu
          songId={addToPlaylistMenu.songId}
          position={addToPlaylistMenu.position}
          onClose={() => setAddToPlaylistMenu(null)}
        />
      )}
    </div >
  );
};

export default TopBar;
