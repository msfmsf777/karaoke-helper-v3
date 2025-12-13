
import React, { useState, useRef } from 'react';
import ObsLinkIcon from '../assets/icons/obs_link.svg';

interface StreamControlDropdownProps {
    onCopy: (label: string) => void;
}

const StreamControlDropdown: React.FC<StreamControlDropdownProps> = ({ onCopy }) => {
    const [isOpen, setIsOpen] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 300); // Small delay to prevent flickering
    };

    const copyToClipboard = (path: string, label: string) => {
        const url = `http://localhost:10001${path}`;
        navigator.clipboard.writeText(url);
        onCopy(label);
        setIsOpen(false); // Close on click
    };

    // Traditional Chinese Labels
    const menuItems = [
        { label: '複製歌詞視窗連結', path: '/obs/lyrics' },
        { label: '複製歌單視窗連結', path: '/obs/setlist' },
    ];

    return (
        <div
            style={{ position: 'relative', zIndex: 50 }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                className="stream-control-btn"
                style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: isOpen ? 'var(--accent-color)' : 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(4px)',
                    transition: 'background-color 0.2s',
                }}
            >
                <img src={ObsLinkIcon} alt="OBS Link" style={{ width: '20px', height: '20px', filter: 'invert(1)' }} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    backgroundColor: '#222',
                    border: '1px solid #444',
                    borderRadius: '8px',
                    padding: '4px',
                    minWidth: '180px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                }}>
                    {menuItems.map((item) => (
                        <button
                            key={item.path}
                            onClick={() => copyToClipboard(item.path, item.label)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#eee',
                                padding: '8px 12px',
                                textAlign: 'left',
                                fontSize: '13px',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                transition: 'background-color 0.1s',
                                whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StreamControlDropdown;
