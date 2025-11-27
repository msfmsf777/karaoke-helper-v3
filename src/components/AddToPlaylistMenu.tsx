import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { useUserData } from '../contexts/UserDataContext';
import PlaylistItemIcon from '../assets/icons/playlist_item.svg';
import PlaylistAddIcon from '../assets/icons/playlist_add.svg';
import CheckIcon from '../assets/icons/check.svg';

interface AddToPlaylistMenuProps {
    songId: string;
    position: { x: number; y: number };
    onClose: () => void;
}

const AddToPlaylistMenu: React.FC<AddToPlaylistMenuProps> = ({ songId, position, onClose }) => {
    const { playlists, addSongToPlaylist, removeSongFromPlaylist, createPlaylist } = useUserData();
    const [isCreating, setIsCreating] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
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
                // If it was a submenu (opening to right), we might want to align bottom-to-bottom
                // But since we just get x/y, we assume y is top.
                // If we want to flip upwards, we subtract height.

                // However, for the footer, y is "bottom" of the button usually.
                // Let's try to keep it simple: if it goes off bottom, shift up.
                if (y < 0) y = 10;
            }

            // Horizontal adjustment
            if (x + rect.width > innerWidth) {
                x = innerWidth - rect.width - 10;
            }

            setAdjustedPosition({ x, y });
        }
    }, [position, isCreating]); // Re-calc if size changes (e.g. creating input)

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

    const handleTogglePlaylist = (playlistId: string, currentSongIds: string[]) => {
        if (currentSongIds.includes(songId)) {
            removeSongFromPlaylist(playlistId, songId);
        } else {
            addSongToPlaylist(playlistId, songId);
        }
        // Do not close, allow multiple toggles? 
        // User said: "clicking again would remove it". Usually menus stay open for multiple actions or close?
        // "Make sure the footer, hover button in songlist, and more menu add to playlist menus are applied."
        // Usually "Add to playlist" closes after action. But with toggle (checkbox style), it might stay open.
        // Let's keep it open for better UX if it acts like a checkbox menu.
        // But if user expects standard "Add to" behavior, it usually closes.
        // However, since we added "remove" capability, it implies a state toggle.
        // Let's keep it open.
    };

    const handleCreateConfirm = () => {
        if (newPlaylistName.trim()) {
            const id = createPlaylist(newPlaylistName.trim());
            addSongToPlaylist(id, songId);
            setIsCreating(false);
            setNewPlaylistName('');
        }
    };

    const style: React.CSSProperties = {
        position: 'fixed',
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        backgroundColor: '#2d2d2d',
        border: '1px solid #3a3a3a',
        borderRadius: '8px',
        padding: '6px 0',
        zIndex: 10000, // High z-index to be on top
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        minWidth: '200px',
        color: '#fff',
        fontSize: '14px',
        maxHeight: '300px',
        overflowY: 'auto',
    };

    const itemStyle: React.CSSProperties = {
        padding: '8px 12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    };

    const iconStyle: React.CSSProperties = {
        width: '16px',
        height: '16px',
        opacity: 0.8,
        display: 'block',
        flexShrink: 0
    };

    return (
        <div ref={menuRef} style={style} onClick={(e) => e.stopPropagation()}>
            {playlists.length === 0 && !isCreating && (
                <div style={{ padding: '8px 12px', color: '#888', fontSize: '12px' }}>無歌單</div>
            )}

            {playlists.map(p => {
                const isPresent = p.songIds.includes(songId);
                return (
                    <div
                        key={p.id}
                        onClick={() => handleTogglePlaylist(p.id, p.songIds)}
                        style={itemStyle}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title={p.name}
                    >
                        <img src={PlaylistItemIcon} alt="" style={iconStyle} />
                        <span style={{
                            flex: 1,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginRight: '8px'
                        }}>
                            {p.name}
                        </span>
                        {isPresent && (
                            <img
                                src={CheckIcon}
                                alt="Selected"
                                style={{
                                    width: '16px',
                                    height: '16px',
                                    // filter: 'drop-shadow(0 0 0 var(--accent-color))', // Optional: if we want to colorize it
                                }}
                            />
                        )}
                    </div>
                );
            })}

            <div style={{ height: '1px', backgroundColor: '#3a3a3a', margin: '4px 0' }}></div>

            {isCreating ? (
                <div style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                        autoFocus
                        type="text"
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateConfirm();
                            if (e.key === 'Escape') setIsCreating(false);
                        }}
                        placeholder="新歌單名稱"
                        style={{
                            flex: 1,
                            padding: '4px',
                            backgroundColor: '#1f1f1f',
                            border: '1px solid #3a3a3a',
                            color: '#fff',
                            borderRadius: '4px',
                            fontSize: '12px',
                            minWidth: 0
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleCreateConfirm();
                        }}
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
                    >
                        <img src={CheckIcon} alt="OK" style={{ width: '14px', height: '14px', filter: 'brightness(0)' }} />
                    </button>
                </div>
            ) : (
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsCreating(true);
                    }}
                    style={{ ...itemStyle, color: 'var(--accent-color)' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                    <img src={PlaylistAddIcon} alt="" style={{ ...iconStyle, width: '18px', height: '18px' }} />
                    <span>新建歌單</span>
                </div>
            )}
        </div>
    );
};

export default AddToPlaylistMenu;
