import React, { useState } from 'react';

type View = 'library' | 'lyrics' | 'stream';

interface PlayerBarProps {
    currentView: View;
    onViewChange: (view: View) => void;
}

const PlayerBar: React.FC<PlayerBarProps> = ({ currentView, onViewChange }) => {
    const [isHovered, setIsHovered] = useState(false);

    const iconStyle = {
        cursor: 'pointer',
        fontSize: '20px',
        color: '#b3b3b3',
        margin: '0 10px',
    };

    const handleLiveToggle = () => {
        if (currentView === 'stream') {
            onViewChange('library'); // Return to library
        } else {
            onViewChange('stream');
        }
    };

    return (
        <div style={{
            height: '90px',
            backgroundColor: 'var(--bg-player)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            flexShrink: 0, // Prevent shrinking
            zIndex: 100,
        }}>
            {/* Left: Song Info & Live Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', width: '30%' }}>
                <div
                    style={{
                        width: '56px',
                        height: '56px',
                        backgroundColor: currentView === 'stream' ? '#330000' : '#333',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '12px',
                        color: currentView === 'stream' ? '#ff4444' : '#555',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={handleLiveToggle}
                >
                    {currentView === 'stream' ? (
                        <span style={{ fontSize: '24px' }}>❌</span>
                    ) : isHovered ? (
                        <div style={{ fontSize: '10px', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>
                            <div>🔴</div>
                            直播模式
                        </div>
                    ) : (
                        <span style={{ fontSize: '24px' }}>🎵</span>
                    )}
                </div>
                <div>
                    <div style={{ color: '#fff', fontSize: '14px', marginBottom: '4px' }}>未選擇歌曲</div>
                    <div style={{ color: '#b3b3b3', fontSize: '12px' }}>--</div>
                </div>
            </div>

            {/* Center: Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40%' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={iconStyle}>⏮</span>
                    <span style={{ ...iconStyle, color: '#fff', fontSize: '32px' }}>▶</span>
                    <span style={iconStyle}>⏭</span>
                </div>
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#b3b3b3' }}>0:00</span>
                    <div style={{ flex: 1, height: '4px', backgroundColor: '#404040', borderRadius: '2px', position: 'relative' }}>
                        <div style={{ width: '0%', height: '100%', backgroundColor: '#b3b3b3', borderRadius: '2px' }}></div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#b3b3b3' }}>0:00</span>
                </div>
            </div>

            {/* Right: Volume */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '30%', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '80px' }}>
                    <label style={{ fontSize: '10px', color: '#b3b3b3', marginBottom: '4px' }}>伴奏音量</label>
                    <input type="range" min="0" max="100" defaultValue="80" style={{ width: '100%', accentColor: 'var(--accent-color)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '80px' }}>
                    <label style={{ fontSize: '10px', color: '#b3b3b3', marginBottom: '4px' }}>人聲音量</label>
                    <input type="range" min="0" max="100" defaultValue="100" style={{ width: '100%', accentColor: 'var(--accent-color)' }} />
                </div>
            </div>
        </div>
    );
};

export default PlayerBar;
