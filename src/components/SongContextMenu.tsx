import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { SongMeta } from '../../shared/songTypes';
import { useQueue } from '../contexts/QueueContext';
import { useUserData } from '../contexts/UserDataContext';
import { useLibrary } from '../contexts/LibraryContext';
import EditSongDialog from './EditSongDialog';

// Icons
import PlayMenuIcon from '../assets/icons/play_menu.svg';
import QueueAddIcon from '../assets/icons/queue_add.svg';
import FavoritesIcon from '../assets/icons/favorites.svg';
import FavoritesFilledIcon from '../assets/icons/favorites_filled.svg';
import PlaylistItemIcon from '../assets/icons/playlist_item.svg'; // Using this for submenu parent
import PlaylistAddIcon from '../assets/icons/playlist_add.svg'; // Or maybe use this for submenu parent? User said "use the songlist svg used in left sidebar" which is PlaylistItemIcon. But for "Add to playlist" generic icon? Let's use PlaylistAddIcon for the menu item.
import LyricsIcon from '../assets/icons/lyrics.svg';
import EditIcon from '../assets/icons/edit.svg';
import DeleteIcon from '../assets/icons/delete.svg';
import SeparateIcon from '../assets/icons/separate.svg';
import CheckIcon from '../assets/icons/check.svg';

interface SongContextMenuProps {
    song: SongMeta;
    position: { x: number; y: number };
    onClose: () => void;
    onEditLyrics?: (song: SongMeta) => void;
}

const SongContextMenu: React.FC<SongContextMenuProps> = ({ song, position, onClose, onEditLyrics }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const { playImmediate, addToQueue, queue, removeFromQueue } = useQueue();
    const { isFavorite, toggleFavorite, playlists, createPlaylist, addSongToPlaylist, cleanupSong } = useUserData();
    const { deleteSong } = useLibrary();

    const [activeSubmenu, setActiveSubmenu] = useState<'playlist' | 'separation' | null>(null);
    const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [adjustedPosition, setAdjustedPosition] = useState(position);

    const openTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Smart Positioning
    useLayoutEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const { innerHeight, innerWidth } = window;
            let { x, y } = position;

            // Vertical adjustment
            if (y + rect.height > innerHeight) {
                // If not enough space below, try to position it above the click
                // But we need to know the height. We have rect.height.
                // Let's shift it up so the bottom is at the click Y (or slightly above)
                y = y - rect.height;
                // Ensure it doesn't go off top
                if (y < 0) y = 10;
            }

            // Horizontal adjustment
            if (x + rect.width > innerWidth) {
                x = innerWidth - rect.width - 10;
            }

            setAdjustedPosition({ x, y });
        }
    }, [position, activeSubmenu, isCreatingPlaylist]); // Re-calc when submenu opens/closes or playlist input shows

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                if (!showEditDialog) {
                    onClose();
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
            if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
        };
    }, [onClose, showEditDialog]);

    const handleSubmenuEnter = (menu: 'playlist' | 'separation') => {
        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
        if (activeSubmenu === menu) return;

        if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
        openTimeoutRef.current = setTimeout(() => {
            setActiveSubmenu(menu);
        }, 250); // 250ms delay to open
    };

    const handleSubmenuLeave = () => {
        if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);

        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = setTimeout(() => {
            setActiveSubmenu(null);
        }, 300); // 300ms delay to close
    };

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
        minWidth: '200px', // Slightly wider for icons
        color: '#fff',
        fontSize: '14px',
    };

    const itemStyle: React.CSSProperties = {
        padding: '8px 12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center', // Align icon and text
        gap: '12px', // Space between icon and text
        position: 'relative', // For submenu positioning
    };

    const iconStyle: React.CSSProperties = {
        width: '20px',
        height: '20px',
        opacity: 0.8,
        display: 'block'
    };

    const separatorStyle: React.CSSProperties = {
        height: '1px',
        backgroundColor: '#3a3a3a',
        margin: '4px 0',
    };

    const handlePlay = () => {
        playImmediate(song.id);
        onClose();
    };

    const handleAddToQueue = () => {
        addToQueue(song.id);
        onClose();
    };

    const handleToggleFavorite = () => {
        toggleFavorite(song.id);
        onClose();
    };

    const handleAddToPlaylist = (playlistId: string) => {
        addSongToPlaylist(playlistId, song.id);
        onClose();
    };

    const handleCreatePlaylist = () => {
        if (newPlaylistName.trim()) {
            const id = createPlaylist(newPlaylistName.trim());
            addSongToPlaylist(id, song.id);
            onClose();
        }
    };

    const handleEditDetails = () => {
        setShowEditDialog(true);
    };

    const handleDeleteSong = async () => {
        try {
            const index = queue.indexOf(song.id);
            if (index !== -1) {
                removeFromQueue(index);
            }
            cleanupSong(song.id);
            await deleteSong(song.id);
            onClose();
        } catch (err) {
            console.error('Failed to delete song', err);
        }
    };

    if (showEditDialog) {
        return (
            <EditSongDialog
                song={song}
                onClose={() => {
                    setShowEditDialog(false);
                    onClose();
                }}
            />
        );
    }

    return (
        <div ref={menuRef} style={style} onClick={(e) => e.stopPropagation()}>
            <div
                style={itemStyle}
                onClick={handlePlay}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <img src={PlayMenuIcon} alt="" style={iconStyle} />
                <span>播放</span>
            </div>
            <div
                style={itemStyle}
                onClick={handleAddToQueue}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <img src={QueueAddIcon} alt="" style={iconStyle} />
                <span>加入播放隊列</span>
            </div>

            <div style={separatorStyle} />

            <div
                style={itemStyle}
                onClick={handleToggleFavorite}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <img src={isFavorite(song.id) ? FavoritesFilledIcon : FavoritesIcon} alt="" style={{ ...iconStyle, color: isFavorite(song.id) ? 'var(--primary-color)' : undefined }} />
                <span>{isFavorite(song.id) ? '取消最愛' : '加入最愛'}</span>
            </div>

            <div
                style={itemStyle}
                onMouseEnter={() => handleSubmenuEnter('playlist')}
                onMouseLeave={handleSubmenuLeave}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <img src={PlaylistItemIcon} alt="" style={iconStyle} />
                <span style={{ flex: 1 }}>加入歌單...</span>
                <span style={{ fontSize: '10px', opacity: 0.5 }}>▶</span>

                {activeSubmenu === 'playlist' && (
                    <div style={{
                        position: 'absolute',
                        left: '100%',
                        top: -4, // Align slightly higher
                        backgroundColor: '#2d2d2d',
                        border: '1px solid #3a3a3a',
                        borderRadius: '8px',
                        padding: '6px 0',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        minWidth: '180px',
                        marginLeft: '4px',
                        zIndex: 1001
                    }}>
                        {playlists.length === 0 && !isCreatingPlaylist && (
                            <div style={{ padding: '8px 16px', color: '#888', fontSize: '12px' }}>無歌單</div>
                        )}
                        {playlists.map(p => (
                            <div
                                key={p.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddToPlaylist(p.id);
                                }}
                                style={itemStyle}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <img src={PlaylistItemIcon} alt="" style={{ ...iconStyle, width: '16px', height: '16px' }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                            </div>
                        ))}
                        <div style={separatorStyle} />
                        {isCreatingPlaylist ? (
                            <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                    autoFocus
                                    type="text"
                                    value={newPlaylistName}
                                    onChange={(e) => setNewPlaylistName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCreatePlaylist();
                                        if (e.key === 'Escape') setIsCreatingPlaylist(false);
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
                                        handleCreatePlaylist();
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
                                    title="確認"
                                >
                                    <img src={CheckIcon} alt="OK" style={{ width: '14px', height: '14px', filter: 'brightness(0)' }} />
                                </button>
                            </div>
                        ) : (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsCreatingPlaylist(true);
                                }}
                                style={{ ...itemStyle, color: 'var(--accent-color)' }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <img src={PlaylistAddIcon} alt="" style={{ ...iconStyle, width: '18px', height: '18px' }} />
                                ＋ 新建歌單
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={separatorStyle} />

            {song.type === '原曲' && (
                <>
                    {(() => {
                        const isSeparated = song.audio_status === 'separated';
                        const isSeparating = song.audio_status === 'separating' || song.audio_status === 'separation_pending';
                        const currentQuality = song.separation_quality;

                        if (isSeparating) return null;

                        const qualityValue = { 'fast': 1, 'normal': 2, 'high': 3 };
                        const currentVal = currentQuality ? qualityValue[currentQuality] : 0;

                        if (isSeparated && currentVal === 3) return null;

                        const label = isSeparated ? '重新分離' : '開始分離';

                        return (
                            <div
                                style={itemStyle}
                                onMouseEnter={() => handleSubmenuEnter('separation')}
                                onMouseLeave={handleSubmenuLeave}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <img src={SeparateIcon} alt="" style={iconStyle} />
                                <span style={{ flex: 1 }}>{label}</span>
                                <span style={{ fontSize: '10px', opacity: 0.5 }}>▶</span>

                                {activeSubmenu === 'separation' && (
                                    <div style={{
                                        position: 'absolute',
                                        left: '100%',
                                        top: -4,
                                        backgroundColor: '#2d2d2d',
                                        border: '1px solid #3a3a3a',
                                        borderRadius: '8px',
                                        padding: '6px 0',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                        minWidth: '160px',
                                        marginLeft: '4px',
                                        zIndex: 1001
                                    }}>
                                        {[
                                            { id: 'fast', label: '快速 (Fast)', val: 1 },
                                            { id: 'normal', label: '標準 (Normal)', val: 2 },
                                            { id: 'high', label: '高品質 (High)', val: 3 }
                                        ].map((option) => {
                                            const isDisabled = isSeparated && option.val <= currentVal;
                                            return (
                                                <div
                                                    key={option.id}
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (isDisabled) return;
                                                        try {
                                                            const { queueSeparationJob } = await import('../jobs/separationJobs');
                                                            await queueSeparationJob(song.id, option.id as 'high' | 'normal' | 'fast');
                                                            onClose();
                                                        } catch (err) {
                                                            console.error('Failed to queue separation', err);
                                                        }
                                                    }}
                                                    style={{
                                                        ...itemStyle,
                                                        color: isDisabled ? '#666' : '#fff',
                                                        cursor: isDisabled ? 'not-allowed' : 'pointer'
                                                    }}
                                                    onMouseOver={(e) => !isDisabled && (e.currentTarget.style.backgroundColor = '#3d3d3d')}
                                                    onMouseOut={(e) => !isDisabled && (e.currentTarget.style.backgroundColor = 'transparent')}
                                                >
                                                    {option.label}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </>
            )}

            <div
                style={itemStyle}
                onClick={() => {
                    if (onEditLyrics) {
                        onEditLyrics(song);
                        onClose();
                    }
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <img src={LyricsIcon} alt="" style={iconStyle} />
                <span>編輯歌詞</span>
            </div>
            <div
                style={itemStyle}
                onClick={handleEditDetails}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <img src={EditIcon} alt="" style={iconStyle} />
                <span>編輯詳情</span>
            </div>
            <div
                style={{ ...itemStyle, color: '#ff8080' }}
                onClick={handleDeleteSong}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <img src={DeleteIcon} alt="" style={{ ...iconStyle, filter: 'sepia(1) saturate(5) hue-rotate(-50deg)' }} />
                {/* Simple filter to tint red, or just let it inherit color if SVG uses currentColor */}
                <span>刪除歌曲</span>
            </div>
        </div >
    );
};

export default SongContextMenu;
