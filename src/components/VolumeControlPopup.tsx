import React, { useState, useEffect, useRef } from 'react';
import VolumeLowIcon from '../assets/icons/volume_low.svg';
import VolumeHighIcon from '../assets/icons/volume_high.svg';
import VolumeMuteIcon from '../assets/icons/volume_mute.svg';

interface VolumeControlPopupProps {
    label: string;
    volume: number; // 0-100
    onChange: (val: number) => void;
}

const VolumeControlPopup: React.FC<VolumeControlPopupProps> = ({
    label,
    volume,
    onChange,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [lastVolume, setLastVolume] = useState(volume > 0 ? volume : 50);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Update lastVolume when volume changes (if not muted)
    useEffect(() => {
        if (volume > 0) {
            setLastVolume(volume);
        }
    }, [volume]);

    const handleToggleMute = () => {
        if (volume > 0) {
            onChange(0);
        } else {
            onChange(lastVolume);
        }
    };

    const getIcon = () => {
        if (volume === 0) return <img src={VolumeMuteIcon} alt="Mute" style={{ width: '24px', height: '24px' }} />;
        if (volume > 50) return <img src={VolumeHighIcon} alt="High" style={{ width: '24px', height: '24px' }} />;
        return <img src={VolumeLowIcon} alt="Low" style={{ width: '24px', height: '24px' }} />;
    };

    const handleStartEdit = () => {
        setEditValue(volume.toString());
        setIsEditing(true);
    };

    const handleCommitEdit = () => {
        let num = parseInt(editValue, 10);
        if (!isNaN(num)) {
            const clamped = Math.max(0, Math.min(num, 100));
            onChange(clamped);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCommitEdit();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
        }
    };

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    return (
        <div
            ref={containerRef}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                position: 'relative',
                width: '48px',
                height: '40px', // Fixed height for layout reservation
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {/* Expanding Container */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    backgroundColor: isHovered ? '#2b2b2b' : 'transparent',
                    borderRadius: '8px',
                    boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.5)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    transition: 'all 0.2s ease-out',
                    paddingBottom: isHovered ? '4px' : '0',
                    zIndex: 1000, // Ensure it overlaps other elements when expanded
                    // @ts-ignore
                    WebkitAppRegion: 'no-drag',
                }}
            >
                {/* Slider Section (Hidden by default, expands up) */}
                <div
                    style={{
                        height: isHovered ? '140px' : '0px',
                        opacity: isHovered ? 1 : 0,
                        overflow: 'hidden',
                        transition: 'all 0.2s ease-out',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        width: '100%',
                        marginBottom: isHovered ? '4px' : '0',
                    }}
                >
                    {/* Numeric Display / Input */}
                    <div style={{ marginBottom: '8px', minHeight: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isEditing ? (
                            <input
                                ref={inputRef}
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleCommitEdit}
                                onKeyDown={handleKeyDown}
                                style={{
                                    width: '32px',
                                    background: '#1a1a1a',
                                    border: '1px solid #444',
                                    borderRadius: '4px',
                                    color: '#fff',
                                    fontSize: '12px',
                                    textAlign: 'center',
                                    padding: '2px',
                                }}
                            />
                        ) : (
                            <span
                                onClick={handleStartEdit}
                                style={{
                                    fontSize: '12px',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    borderBottom: '1px dashed #666',
                                }}
                                title="Click to edit"
                            >
                                {volume}%
                            </span>
                        )}
                    </div>

                    {/* Vertical Slider */}
                    <div style={{ height: '100px', display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={volume}
                            onChange={(e) => onChange(Number(e.target.value))}
                            style={{
                                writingMode: 'bt-lr' as any, /* IE/Edge */
                                WebkitAppearance: 'slider-vertical', /* WebKit */
                                width: '8px',
                                height: '100%',
                                accentColor: 'var(--accent-color, #1db954)',
                                cursor: 'pointer',
                            }}
                        />
                    </div>
                </div>

                {/* Main Button (Always visible at bottom) */}
                <button
                    onClick={handleToggleMute}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: isHovered ? '#fff' : '#ccc',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0',
                        width: '48px', // Match PlayerBar buttons
                        height: '48px',
                        transition: 'color 0.2s',
                    }}
                    title={`${label}: ${volume}%`}
                >
                    <span style={{ marginBottom: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24px' }}>{getIcon()}</span>
                    <span style={{ fontSize: '10px', lineHeight: 1 }}>{label}</span>
                </button>
            </div>
        </div>
    );
};

export default VolumeControlPopup;
