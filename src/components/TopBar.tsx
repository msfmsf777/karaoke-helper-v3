import React from 'react';

const TopBar: React.FC = () => {
    const buttonStyle = {
        backgroundColor: '#282828',
        color: '#fff',
        border: '1px solid #3e3e3e',
        borderRadius: '4px',
        padding: '6px 12px',
        fontSize: '13px',
        cursor: 'pointer',
        marginLeft: '8px',
    };

    return (
        <div style={{
            height: '64px',
            backgroundColor: 'var(--bg-sidebar)', // Match sidebar or slightly different
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            flexShrink: 0, // Prevent shrinking
        }}>
            {/* Left: Logo (Fixed Width to match Sidebar) */}
            <div style={{
                width: '240px',
                flexShrink: 0,
                fontSize: '18px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderRight: '1px solid transparent' // Optional visual separator
            }}>
                <div style={{ width: '24px', height: '24px', background: 'linear-gradient(135deg, #1db954, #1ed760)', borderRadius: '50%' }}></div>
                KHelperLive
            </div>

            {/* Center: Search Bar (Aligned Left) */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: '16px' }}>
                <input
                    type="text"
                    placeholder="搜尋歌曲或歌單…"
                    style={{
                        backgroundColor: '#282828',
                        border: '1px solid #3e3e3e',
                        borderRadius: '16px',
                        padding: '6px 12px',
                        color: '#fff',
                        fontSize: '13px',
                        width: '300px', // Slightly wider
                        outline: 'none'
                    }}
                />
            </div>

            {/* Right: Actions */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <button style={buttonStyle}>＋ 新增歌曲</button>
                <button style={buttonStyle}>處理中任務</button>
                <button style={buttonStyle}>設定</button>
            </div>
        </div>
    );
};

export default TopBar;
