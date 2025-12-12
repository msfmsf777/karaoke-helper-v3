import React, { useRef, useEffect } from 'react';
import { PlaybackMode } from '../contexts/QueueContext';
import ModeOrderIcon from '../assets/icons/mode_order.svg';
import ModeRepeatIcon from '../assets/icons/mode_repeat_one.svg';
import ModeRandomIcon from '../assets/icons/mode_random.svg';
import ModeStreamIcon from '../assets/icons/mode_stream.svg';

interface ModeSelectorProps {
    currentMode: PlaybackMode;
    onSelect: (mode: PlaybackMode) => void;
    onClose: () => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ currentMode, onSelect, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const options: { mode: PlaybackMode; label: string; icon: string }[] = [
        { mode: 'normal', label: '順序播放', icon: ModeOrderIcon },
        { mode: 'repeat_one', label: '單曲循環', icon: ModeRepeatIcon },
        { mode: 'random', label: '隨機播放', icon: ModeRandomIcon },
        { mode: 'stream', label: '直播模式', icon: ModeStreamIcon },
    ];

    return (
        <div
            ref={menuRef}
            style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginBottom: '8px',
                backgroundColor: '#1e1e1e', // Match theme
                border: '1px solid #444',
                borderRadius: '8px',
                padding: '0',
                gap: '0',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                zIndex: 1000,
                minWidth: '140px',
                display: 'flex',
                flexDirection: 'column',
                // @ts-ignore
                WebkitAppRegion: 'no-drag',
            }}
        >
            {options.map((option) => (
                <div
                    key={option.mode}
                    onClick={() => {
                        onSelect(option.mode);
                        onClose();
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        backgroundColor: currentMode === option.mode ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                        color: currentMode === option.mode ? '#fff' : '#ccc',
                        transition: 'background-color 0.2s',
                        fontSize: '13px',
                    }}
                    onMouseEnter={(e) => {
                        if (currentMode !== option.mode) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                        if (currentMode !== option.mode) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                >
                    <img
                        src={option.icon}
                        alt={option.label}
                        style={{
                            width: '16px',
                            height: '16px',
                            opacity: currentMode === option.mode ? 1 : 0.8,
                            filter: currentMode === 'stream' && option.mode === 'stream' ? 'sepia(1) saturate(500%) hue-rotate(-50deg)' : 'none' // Optional highlight for stream? Or just keep uniform.
                            // Keeping uniform for now unless stream icon needs specific color.
                            // The stream icon user uploaded has fill="#fe6262" inside it? Or fill="none" class?
                            // The uploaded icon has fill attributes. So "white" might filter poorly if not careful.
                            // But the user's uploaded icon IS colored: fill="#fe6262".
                            // So for Stream icon, we probably don't want to tint it unless inactive.
                        }}
                    />
                    {option.label}
                </div>
            ))}
        </div>
    );
};

export default ModeSelector;
