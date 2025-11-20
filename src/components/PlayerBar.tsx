import React, { useState } from 'react';

type View = 'library' | 'lyrics' | 'stream';

interface PlayerBarProps {
    currentView: View;
    onViewChange: (view: View) => void;
    onPlayPause: () => void;
    onSeek: (seconds: number) => void;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    currentTrackName?: string;
}

const PlayerBar: React.FC<PlayerBarProps> = ({
    currentView,
    onViewChange,
    onPlayPause,
    onSeek,
    isPlaying,
    currentTime,
    duration,
    currentTrackName,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [backingVolume, setBackingVolume] = useState(80);
    const [vocalVolume, setVocalVolume] = useState(100);

    const iconStyle = {
        cursor: 'pointer',
        fontSize: '14px',
        color: '#b3b3b3',
        margin: '0 10px',
        userSelect: 'none' as const,
    };

    const formatTime = (value: number) => {
        if (!Number.isFinite(value) || value < 0) return '0:00';
        const minutes = Math.floor(value / 60);
        const seconds = Math.floor(value % 60)
            .toString()
            .padStart(2, '0');
        return `${minutes}:${seconds}`;
    };

    const progressValue = duration > 0 ? Math.min(currentTime, duration) : 0;
    const progressMax = duration > 0 ? duration : 0;

    const handleLiveToggle = () => {
        if (currentView === 'stream') {
            onViewChange('library');
        } else {
            onViewChange('stream');
        }
    };

    const handleSeekChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const nextTime = Number(event.target.value);
        onSeek(nextTime);
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
            flexShrink: 0,
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
                        color: currentView === 'stream' ? '#ff4444' : '#ccc',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        border: currentView === 'stream' ? '1px solid #ff4444' : '1px solid #444',
                        fontWeight: 700,
                        fontSize: '14px',
                        textAlign: 'center' as const,
                        lineHeight: 1.2,
                    }}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={handleLiveToggle}
                >
                    {currentView === 'stream' ? (
                        <span>LIVE</span>
                    ) : isHovered ? (
                        <div>
                            Stream<br />Mode
                        </div>
                    ) : (
                        <span>音樂</span>
                    )}
                </div>
                <div>
                    <div style={{ color: '#fff', fontSize: '14px', marginBottom: '4px' }}>
                        {currentTrackName || '尚未載入音檔'}
                    </div>
                    <div style={{ color: '#b3b3b3', fontSize: '12px' }}>
                        {currentView === 'stream' ? '直播模式' : '系統預設輸出'}
                    </div>
                </div>
            </div>

            {/* Center: Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40%' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={iconStyle}>Prev</span>
                    <button
                        style={{
                            ...iconStyle,
                            padding: '6px 14px',
                            borderRadius: '20px',
                            backgroundColor: '#fff',
                            color: '#000',
                            fontWeight: 700,
                            border: 'none',
                            fontSize: '14px',
                        }}
                        onClick={onPlayPause}
                    >
                        {isPlaying ? 'Pause' : 'Play'}
                    </button>
                    <span style={iconStyle}>Next</span>
                </div>
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#b3b3b3', minWidth: '42px', textAlign: 'right' }}>
                        {formatTime(progressValue)}
                    </span>
                    <input
                        type="range"
                        min={0}
                        max={progressMax}
                        value={progressValue}
                        step={0.1}
                        onChange={handleSeekChange}
                        style={{ flex: 1, accentColor: 'var(--accent-color)' }}
                    />
                    <span style={{ fontSize: '11px', color: '#b3b3b3', minWidth: '42px' }}>
                        {formatTime(duration)}
                    </span>
                </div>
            </div>

            {/* Right: Volume */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '30%', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '120px' }}>
                    <label style={{ fontSize: '12px', color: '#b3b3b3', marginBottom: '4px' }}>伴奏音量</label>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={backingVolume}
                        onChange={(e) => setBackingVolume(Number(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '120px' }}>
                    <label style={{ fontSize: '12px', color: '#b3b3b3', marginBottom: '4px' }}>人聲音量</label>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={vocalVolume}
                        onChange={(e) => setVocalVolume(Number(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                    />
                </div>
            </div>
        </div>
    );
};

export default PlayerBar;
