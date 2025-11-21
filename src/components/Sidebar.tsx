import React, { useState } from 'react';
import { useUserData } from '../contexts/UserDataContext';

type View = 'library' | 'lyrics' | 'stream' | 'favorites' | 'history' | string;

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  const { playlists, createPlaylist } = useUserData();
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

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

  const navItemStyle = (isActive: boolean) => ({
    padding: '10px 16px',
    cursor: 'pointer',
    backgroundColor: isActive ? '#282828' : 'transparent',
    color: isActive ? '#fff' : '#b3b3b3',
    borderRadius: '6px',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    transition: 'background-color 0.2s',
    fontSize: '14px',
    fontWeight: isActive ? 700 : 500,
  });

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
      style={{
        width: '240px',
        height: '100%',
        backgroundColor: 'var(--bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border-color)',
      }}
    >
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px' }}>
        <div style={sectionTitleStyle}>瀏覽</div>
        <div style={navItemStyle(currentView === 'library')} onClick={() => onViewChange('library')}>
          歌曲庫
        </div>
        <div style={navItemStyle(currentView === 'lyrics')} onClick={() => onViewChange('lyrics')}>
          歌詞編輯
        </div>

        <div style={{ height: '1px', backgroundColor: '#282828', margin: '16px 8px' }}></div>

        <div style={sectionTitleStyle}>我的音樂</div>
        <div style={navItemStyle(currentView === 'favorites')} onClick={() => onViewChange('favorites')}>
          我的最愛
        </div>
        <div style={navItemStyle(currentView === 'history')} onClick={() => onViewChange('history')}>
          最近播放
        </div>

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
          <div style={{ padding: '0 16px 8px' }}>
            <input
              autoFocus
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateConfirm();
                if (e.key === 'Escape') handleCreateCancel();
              }}
              onBlur={handleCreateCancel}
              placeholder="歌單名稱"
              style={{
                width: '100%',
                padding: '4px 8px',
                backgroundColor: '#333',
                border: '1px solid #555',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '12px'
              }}
            />
          </div>
        )}

        {playlists.map(playlist => (
          <div
            key={playlist.id}
            style={navItemStyle(currentView === `playlist:${playlist.id}`)}
            onClick={() => onViewChange(`playlist:${playlist.id}`)}
          >
            {playlist.name}
          </div>
        ))}

        <div style={{ height: '1px', backgroundColor: '#282828', margin: '16px 8px' }}></div>

        <div style={sectionTitleStyle}>快速存取</div>
        <div style={navItemStyle(false)}>下載管理</div>
      </div>
    </div>
  );
};

export default Sidebar;
