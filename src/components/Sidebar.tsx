import React from 'react';

type View = 'library' | 'lyrics' | 'stream';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
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

        <div style={sectionTitleStyle}>快速存取</div>
        <div style={navItemStyle(false)}>最近播放</div>
        <div style={navItemStyle(false)}>當前歌單</div>
        <div style={navItemStyle(false)}>歌詞草稿</div>
        <div style={navItemStyle(false)}>下載管理</div>
      </div>
    </div>
  );
};

export default Sidebar;
