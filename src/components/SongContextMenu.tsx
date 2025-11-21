import React, { useState, useEffect, useRef } from 'react';
import { SongMeta } from '../../shared/songTypes';
import { useQueue } from '../contexts/QueueContext';
import { useUserData } from '../contexts/UserDataContext';

interface SongContextMenuProps {
    song: SongMeta;
    position: { x: number; y: number };
    onClose: () => void;
    onEditLyrics?: (song: SongMeta) => void;
}

const SongContextMenu: React.FC<SongContextMenuProps> = ({ song, position, onClose, onEditLyrics }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const { playImmediate, addToQueue } = useQueue();
    const { isFavorite, toggleFavorite, playlists, createPlaylist, addSongToPlaylist } = useUserData();

    const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
    const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');

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

    // Adjust position if it goes off screen (basic)
    const style: React.CSSProperties = {
        position: 'fixed',
        left: position.x,
        top: position.y,
        backgroundColor: '#2d2d2d',
        border: '1px solid #3a3a3a',
        borderRadius: '8px',
        padding: '6px 0',
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        minWidth: '180px',
        color: '#fff',
        fontSize: '14px',
    };

    const itemStyle: React.CSSProperties = {
        padding: '8px 16px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
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
        // Placeholder for future implementation
        alert('編輯歌曲資訊功能尚未實作');
        onClose();
    };

    const handleDeleteSong = () => {
        // Placeholder for future implementation
        if (window.confirm(`確定要刪除「${song.title}」嗎？(此功能尚未實作)`)) {
            console.log('Delete song requested', song.id);
        }
        onClose();
    };

    return (
        <div ref={menuRef} style={style} onClick={(e) => e.stopPropagation()}>
            <div
                style={itemStyle}
                onClick={handlePlay}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                播放
            </div>
            <div
                style={itemStyle}
                onClick={handleAddToQueue}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                加入播放隊列
            </div>

            <div style={separatorStyle} />

            <div
                style={itemStyle}
                onClick={handleToggleFavorite}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                {isFavorite(song.id) ? '取消最愛' : '加入最愛'}
            </div>

            <div
                style={{ ...itemStyle, position: 'relative' }}
                onMouseEnter={() => setShowPlaylistSubmenu(true)}
                onMouseLeave={() => setShowPlaylistSubmenu(false)}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <span>加入歌單...</span>
                <span>▶</span>

                {showPlaylistSubmenu && (
                    <div style={{
                        position: 'absolute',
                        left: '100%',
                        top: 0,
                        backgroundColor: '#2d2d2d',
                        border: '1px solid #3a3a3a',
                        borderRadius: '8px',
                        padding: '6px 0',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        minWidth: '160px',
                        marginLeft: '4px',
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
                                style={{ ...itemStyle }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                {p.name}
                            </div>
                        ))}
                        <div style={separatorStyle} />
                        {isCreatingPlaylist ? (
                            <div style={{ padding: '4px 8px' }}>
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
                                        width: '100%',
                                        padding: '4px',
                                        backgroundColor: '#1f1f1f',
                                        border: '1px solid #3a3a3a',
                                        color: '#fff',
                                        borderRadius: '4px',
                                        fontSize: '12px'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                />
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
                                ＋ 新建歌單
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={separatorStyle} />

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
                編輯歌詞
            </div>
            <div
                style={itemStyle}
                onClick={handleEditDetails}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                編輯詳情
            </div>
            <div
                style={{ ...itemStyle, color: '#ff8080' }}
                onClick={handleDeleteSong}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                刪除歌曲
            </div>
        </div>
    );
};

export default SongContextMenu;
