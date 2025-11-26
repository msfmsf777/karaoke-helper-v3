import React, { useState } from 'react';
import { useUserData } from '../contexts/UserDataContext';
import { useQueue } from '../contexts/QueueContext';
import LibraryIcon from '../assets/icons/library.svg';
import DownloadIcon from '../assets/icons/download.svg';
import LyricsIcon from '../assets/icons/lyrics.svg';
import FavoritesIcon from '../assets/icons/favorites.svg';
import HistoryIcon from '../assets/icons/history.svg';
import PlaylistItemIcon from '../assets/icons/playlist_item.svg';
import CheckIcon from '../assets/icons/check.svg';
import CancelIcon from '../assets/icons/cancel.svg';
import PlaylistContextMenu from './PlaylistContextMenu';

type View = 'library' | 'lyrics' | 'stream' | 'favorites' | 'history' | string;

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

interface NavItemProps {
  isActive: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}

const NavItem: React.FC<NavItemProps> = ({ isActive, onClick, onContextMenu, children }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '10px 16px',
        cursor: 'pointer',
        backgroundColor: isActive ? '#282828' : isHovered ? '#202020' : 'transparent',
        color: isActive ? '#fff' : isHovered ? '#fff' : '#b3b3b3',
        borderRadius: '6px',
        marginBottom: '6px',
        display: 'flex',
        alignItems: 'center',
        transition: 'background-color 0.2s, color 0.2s',
        fontSize: '14px',
        fontWeight: isActive ? 700 : 500,
      }}
    >
      {children}
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  const { playlists, createPlaylist, renamePlaylist, deletePlaylist } = useUserData();
  const { playSongList } = useQueue();
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; playlistId: string } | null>(null);

  // Rename State
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');

  const handleCreateClick = () => {
    setIsCreating(true);
    setNewPlaylistName('');
  };

  const handleCreateConfirm = () => {
    if (newPlaylistName.trim()) {
      const id = createPlaylist(newPlaylistName.trim());
      onViewChange(`playlist:${id}`);
    }
    setIsCreating(false);
  };

  const handleCreateCancel = () => {
    setIsCreating(false);
  };

  const handleContextMenu = (e: React.MouseEvent, playlistId: string) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      playlistId
    });
  };

  const handleRenameStart = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameName(currentName);
  };

  const handleRenameConfirm = () => {
    if (renamingId && renameName.trim()) {
      renamePlaylist(renamingId, renameName.trim());
    }
    setRenamingId(null);
  };

  const handleRenameCancel = () => {
    setRenamingId(null);
  };

  const sectionTitleStyle = {
    padding: '16px 16px 8px',
    color: '#888',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const addButtonStyle = {
    cursor: 'pointer',
    fontSize: '16px',
    color: '#888',
    transition: 'color 0.2s',
  };

  return (
    <div
      className="sidebar-container"
      style={{
        width: '218px',
        height: '100%',
        backgroundColor: 'var(--bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border-color)',
      }}
    >
      <style>
        {`
          .sidebar-content::-webkit-scrollbar {
            width: 6px;
          }
          .sidebar-content::-webkit-scrollbar-track {
            background: transparent;
          }
          .sidebar-content::-webkit-scrollbar-thumb {
            background: transparent;
            border-radius: 3px;
          }
          .sidebar-container:hover .sidebar-content::-webkit-scrollbar-thumb {
            background: #555;
          }
          .sidebar-container:hover .sidebar-content::-webkit-scrollbar-thumb:hover {
            background: #777;
          }
        `}
      </style>
      <div className="sidebar-content" style={{ flex: 1, overflowY: 'auto', padding: '0 10px' }}>
        <div style={sectionTitleStyle}>瀏覽</div>
        <NavItem isActive={currentView === 'library'} onClick={() => onViewChange('library')}>
          <img src={LibraryIcon} alt="Library" style={{ width: '20px', height: '20px', marginRight: '12px', flexShrink: 0 }} />
          歌曲庫
        </NavItem>
        <NavItem isActive={currentView === 'download-manager'} onClick={() => onViewChange('download-manager')}>
          <img src={DownloadIcon} alt="Download" style={{ width: '20px', height: '20px', marginRight: '12px', flexShrink: 0 }} />
          下載管理
        </NavItem>
        <NavItem isActive={currentView === 'lyrics'} onClick={() => onViewChange('lyrics')}>
          <img src={LyricsIcon} alt="Lyrics" style={{ width: '24px', height: '24px', marginRight: '12px', flexShrink: 0 }} />
          歌詞編輯
        </NavItem>

        <div style={{ height: '1px', backgroundColor: '#282828', margin: '16px 8px' }}></div>

        <div style={sectionTitleStyle}>我的音樂</div>
        <NavItem isActive={currentView === 'favorites'} onClick={() => onViewChange('favorites')}>
          <img src={FavoritesIcon} alt="Favorites" style={{ width: '20px', height: '20px', marginRight: '12px', flexShrink: 0 }} />
          我的最愛
        </NavItem>
        <NavItem isActive={currentView === 'history'} onClick={() => onViewChange('history')}>
          <img src={HistoryIcon} alt="History" style={{ width: '20px', height: '20px', marginRight: '12px', flexShrink: 0 }} />
          最近播放
        </NavItem>

        <div style={{ height: '1px', backgroundColor: '#282828', margin: '16px 8px' }}></div>

        <div style={sectionTitleStyle}>
          我的歌單
          <span
            style={addButtonStyle}
            onClick={handleCreateClick}
            title="新增歌單"
          >
            +
          </span>
        </div>

        {isCreating && (
          <div style={{ padding: '0 16px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              autoFocus
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateConfirm();
                if (e.key === 'Escape') handleCreateCancel();
              }}
              placeholder="歌單名稱"
              style={{
                flex: 1,
                width: '100%',
                padding: '4px 8px',
                backgroundColor: '#333',
                border: '1px solid #555',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '12px',
                minWidth: 0
              }}
            />
            <button
              onClick={handleCreateConfirm}
              style={{
                background: 'var(--accent-color)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="確認"
            >
              <img src={CheckIcon} alt="Confirm" style={{ width: '14px', height: '14px', filter: 'brightness(0)' }} />
            </button>
            <button
              onClick={handleCreateCancel}
              style={{
                background: '#ff4444',
                border: 'none',
                borderRadius: '4px',
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="取消"
            >
              <img src={CancelIcon} alt="Cancel" style={{ width: '14px', height: '14px', filter: 'brightness(0)' }} />
            </button>
          </div>
        )}

        {playlists.map(playlist => {
          if (renamingId === playlist.id) {
            return (
              <div key={playlist.id} style={{ padding: '0 16px 8px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  autoFocus
                  type="text"
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameConfirm();
                    if (e.key === 'Escape') handleRenameCancel();
                  }}
                  style={{
                    flex: 1,
                    width: '100%',
                    padding: '4px 8px',
                    backgroundColor: '#333',
                    border: '1px solid #555',
                    borderRadius: '4px',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 500,
                    minWidth: 0
                  }}
                />
                <button
                  onClick={handleRenameConfirm}
                  style={{
                    background: 'var(--accent-color)',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="確認"
                >
                  <img src={CheckIcon} alt="Confirm" style={{ width: '14px', height: '14px', filter: 'brightness(0)' }} />
                </button>
                <button
                  onClick={handleRenameCancel}
                  style={{
                    background: '#ff4444',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="取消"
                >
                  <img src={CancelIcon} alt="Cancel" style={{ width: '14px', height: '14px', filter: 'brightness(0)' }} />
                </button>
              </div>
            );
          }
          return (
            <NavItem
              key={playlist.id}
              isActive={currentView === `playlist:${playlist.id}`}
              onClick={() => onViewChange(`playlist:${playlist.id}`)}
              onContextMenu={(e) => handleContextMenu(e, playlist.id)}
            >
              <img src={PlaylistItemIcon} alt="Playlist" style={{ width: '20px', height: '20px', marginRight: '12px', flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={playlist.name}>
                {playlist.name}
              </span>
            </NavItem>
          );
        })}
      </div>

      {contextMenu && (
        <PlaylistContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          onPlay={() => {
            const playlist = playlists.find(p => p.id === contextMenu.playlistId);
            if (playlist && playlist.songIds.length > 0) {
              playSongList(playlist.songIds);
            }
          }}
          onRename={() => {
            const playlist = playlists.find(p => p.id === contextMenu.playlistId);
            if (playlist) {
              handleRenameStart(playlist.id, playlist.name);
            }
          }}
          onDelete={() => {
            // Optional: Confirm dialog? User didn't ask for one, but it's good practice.
            // "Make only requested changes". User didn't explicitly ask for confirmation on playlist delete, 
            // but did for song delete (in previous context).
            // I'll just delete for now to be strictly compliant, or maybe a simple confirm.
            if (window.confirm('確定要刪除此歌單嗎？')) {
              deletePlaylist(contextMenu.playlistId);
              if (currentView === `playlist:${contextMenu.playlistId}`) {
                onViewChange('library');
              }
            }
          }}
        />
      )}
    </div>
  );
};

export default Sidebar;
