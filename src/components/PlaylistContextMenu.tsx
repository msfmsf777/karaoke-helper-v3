import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';
import PlayMenuIcon from '../assets/icons/play_menu.svg';
import EditIcon from '../assets/icons/edit.svg';
import DeleteIcon from '../assets/icons/delete.svg';

interface PlaylistContextMenuProps {
    position: { x: number; y: number };
    onClose: () => void;
    onPlay: () => void;
    onRename: () => void;
    onDelete: () => void;
}

const PlaylistContextMenu: React.FC<PlaylistContextMenuProps> = ({ position, onClose, onPlay, onRename, onDelete }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [adjustedPosition, setAdjustedPosition] = useState(position);

    // Smart Positioning
    useLayoutEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const { innerHeight, innerWidth } = window;
            let { x, y } = position;

            // Vertical adjustment
            if (y + rect.height > innerHeight) {
                y = y - rect.height;
                if (y < 0) y = 10;
            }

            // Horizontal adjustment
            if (x + rect.width > innerWidth) {
                x = innerWidth - rect.width - 10;
            }

            setAdjustedPosition({ x, y });
        }
    }, [position]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    const style: React.CSSProperties = {
        position: 'fixed',
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        backgroundColor: '#2d2d2d',
        border: '1px solid #3a3a3a',
        borderRadius: '8px',
        padding: '6px 0',
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        minWidth: '160px',
        color: '#fff',
        fontSize: '14px',
    };

    const itemStyle: React.CSSProperties = {
        padding: '8px 12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    };

    const iconStyle: React.CSSProperties = {
        width: '20px',
        height: '20px',
        opacity: 0.8,
        display: 'block'
    };

    return (
        <div ref={menuRef} style={style} onClick={(e) => e.stopPropagation()}>
            <div
                style={itemStyle}
                onClick={() => { onPlay(); onClose(); }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <img src={PlayMenuIcon} alt="" style={iconStyle} />
                <span>播放</span>
            </div>
            <div
                style={itemStyle}
                onClick={() => { onRename(); onClose(); }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <img src={EditIcon} alt="" style={iconStyle} />
                <span>重新命名</span>
            </div>
            <div
                style={{ ...itemStyle, color: '#ff8080' }}
                onClick={() => { onDelete(); onClose(); }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <img src={DeleteIcon} alt="" style={{ ...iconStyle, filter: 'sepia(1) saturate(5) hue-rotate(-50deg)' }} />
                <span>刪除歌單</span>
            </div>
        </div>
    );
};

export default PlaylistContextMenu;
