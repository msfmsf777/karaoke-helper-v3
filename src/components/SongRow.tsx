import React, { useState } from 'react';
import { SongMeta } from '../../shared/songTypes';
import { useQueue } from '../contexts/QueueContext';
import { useUserData } from '../contexts/UserDataContext';
import SongContextMenu from './SongContextMenu';
import FavoritesIcon from '../assets/icons/favorites.svg';
import FavoritesFilledIcon from '../assets/icons/favorites_filled.svg';
import AddIcon from '../assets/icons/add.svg';
import MoreIcon from '../assets/icons/more.svg';

interface SongRowProps {
    song: SongMeta;
    index: number;
    isActive: boolean;
    context: 'library' | 'favorites' | 'recent' | 'playlist';
    onEditLyrics?: (song: SongMeta) => void;
    showType?: boolean;
    showAudioStatus?: boolean;
    showLyricStatus?: boolean;
    showDuration?: boolean;
    customActions?: React.ReactNode;
}

const audioStatusLabels: Record<SongMeta['audio_status'], string> = {
    original_only: '未分離',
    separation_pending: '等待分離',
    separating: '分離中',
    separation_failed: '分離失敗',
    separated: '已分離',
    ready: '未分離',
    missing: '未分離',
    error: '錯誤',
};

const lyricsLabel = (status?: SongMeta['lyrics_status']) => {
    switch (status) {
        case 'text_only':
            return '純文字';
        case 'synced':
            return '已對齊';
        case 'none':
        default:
            return '無';
    }
};

const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const SongRow: React.FC<SongRowProps> = ({
    song,
    index,
    isActive,
    // context,
    onEditLyrics,
    showType = true,
    showAudioStatus = true,
    showLyricStatus = true,
    showDuration = true,
    customActions
}) => {
    const { playImmediate, addToQueue } = useQueue();
    const { isFavorite, toggleFavorite, playlists, addSongToPlaylist, createPlaylist } = useUserData();
    const [isHovered, setIsHovered] = useState(false);
    const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
    const [showAddToPlaylistMenu, setShowAddToPlaylistMenu] = useState<{ x: number; y: number } | null>(null);
    const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');

    const handleDoubleClick = () => {
        playImmediate(song.id);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenuPosition({ x: e.clientX, y: e.clientY });
    };

    const handleAddToPlaylistClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setShowAddToPlaylistMenu({ x: rect.left, y: rect.bottom + 5 });
    };

    const audioColor =
        song.audio_status === 'separated'
            ? '#8be28b'
            : song.audio_status === 'separation_failed' || song.audio_status === 'error'
                ? '#ff8b8b'
                : '#e0a040';

    return (
        <>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '40px minmax(200px, 1fr) 60px 160px 100px 220px 120px 80px', // Adjusted columns
                    padding: '10px 16px',
                    borderBottom: '1px solid #252525',
                    color: '#fff',
                    fontSize: '14px',
                    alignItems: 'center',
                    backgroundColor: isActive ? '#262626' : isHovered ? '#202020' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.1s',
                }}
                onDoubleClick={handleDoubleClick}
                onContextMenu={handleContextMenu}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* # Index */}
                <div style={{ color: '#b3b3b3', fontSize: '13px' }}>{index + 1}</div>

                {/* Title + Artist */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: '10px' }}>
                    <div style={{ fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--accent-color)' : '#fff', marginBottom: '2px' }}>
                        {song.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                        {song.artist || 'Unknown Artist'}
                    </div>
                </div>

                {/* Heart Icon */}
                <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
                    <img
                        src={isFavorite(song.id) ? FavoritesFilledIcon : FavoritesIcon}
                        alt="Favorite"
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(song.id);
                        }}
                        style={{
                            width: '20px',
                            height: '20px',
                            cursor: 'pointer',
                            display: 'block'
                        }}
                        title={isFavorite(song.id) ? '取消最愛' : '加入最愛'}
                    />
                </div>

                {/* Hover Actions */}
                <div style={{ display: 'flex', gap: '24px', paddingLeft: '12px', opacity: isHovered ? 1 : 0, transition: 'opacity 0.1s', alignItems: 'center' }}>
                    <button
                        onClick={handleAddToPlaylistClick}
                        title="加入歌單/播放隊列"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: 0.7,
                            transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                    >
                        <img src={AddIcon} alt="Add" style={{ width: '20px', height: '20px', display: 'block' }} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setContextMenuPosition({ x: e.clientX, y: e.clientY });
                        }}
                        title="更多"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: 0.7,
                            transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                    >
                        <img src={MoreIcon} alt="More" style={{ width: '20px', height: '20px', display: 'block' }} />
                    </button>
                    {customActions}
                </div>

                {/* Type */}
                <div style={{ color: '#b3b3b3', fontSize: '13px' }}>
                    {showType && song.type}
                </div>

                {/* Audio Status */}
                <div style={{ color: audioColor, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }} title={song.last_separation_error || undefined}>
                    {showAudioStatus && (
                        song.type === '伴奏' ? (
                            <span>-</span>
                        ) : (
                            <>
                                {audioStatusLabels[song.audio_status]}

                                {/* Quality Badge */}
                                {song.audio_status === 'separated' && song.separation_quality && (
                                    <span style={{
                                        fontSize: '10px',
                                        padding: '1px 4px',
                                        borderRadius: '4px',
                                        backgroundColor: song.separation_quality === 'high' ? '#4caf50' : song.separation_quality === 'fast' ? '#ff9800' : '#2196f3',
                                        color: '#fff',
                                        fontWeight: 'bold',
                                        marginLeft: '4px'
                                    }}>
                                        {song.separation_quality === 'high' ? 'HQ' : song.separation_quality === 'fast' ? '快速' : '標準'}
                                    </span>
                                )}

                                {song.audio_status === 'separating' && <span style={{ fontSize: '12px' }}>⋯</span>}

                                {/* Separation Button for Original Songs */}
                                {song.type === '原曲' && (
                                    (song.audio_status === 'original_only' || song.audio_status === 'separation_failed' || song.audio_status === 'ready') ? (
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                    const { queueSeparationJob } = await import('../jobs/separationJobs');
                                                    await queueSeparationJob(song.id);
                                                } catch (err) {
                                                    console.error('Failed to queue separation', err);
                                                }
                                            }}
                                            style={{
                                                padding: '2px 6px',
                                                backgroundColor: 'var(--accent-color)',
                                                color: '#000',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                marginLeft: '4px'
                                            }}
                                        >
                                            {song.audio_status === 'separation_failed' ? '重試' : '分離'}
                                        </button>
                                    ) : null
                                )}
                            </>
                        )
                    )}
                </div>

                {/* Lyric Status */}
                <div style={{
                    color: song.lyrics_status === 'synced' ? '#4caf50' : '#b3b3b3',
                    fontSize: '13px'
                }}>
                    {showLyricStatus && lyricsLabel(song.lyrics_status)}
                </div>

                {/* Duration */}
                <div style={{ color: '#b3b3b3', fontSize: '13px', textAlign: 'right', paddingRight: '32px' }}>
                    {showDuration && (song.duration ? formatDuration(song.duration) : '--:--')}
                </div>
            </div>

            {contextMenuPosition && (
                <SongContextMenu
                    song={song}
                    position={contextMenuPosition}
                    onClose={() => setContextMenuPosition(null)}
                    onEditLyrics={onEditLyrics}
                />
            )}

            {showAddToPlaylistMenu && (
                <div
                    style={{
                        position: 'fixed',
                        left: showAddToPlaylistMenu.x,
                        top: showAddToPlaylistMenu.y,
                        backgroundColor: '#2d2d2d',
                        border: '1px solid #3a3a3a',
                        borderRadius: '8px',
                        padding: '8px',
                        zIndex: 100,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        minWidth: '160px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Overlay to close when clicking outside */}
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: -1 }}
                        onClick={() => setShowAddToPlaylistMenu(null)}
                    />

                    <div
                        onClick={() => {
                            addToQueue(song.id);
                            setShowAddToPlaylistMenu(null);
                        }}
                        style={{
                            padding: '6px 8px',
                            cursor: 'pointer',
                            color: '#fff',
                            fontSize: '14px',
                            borderRadius: '4px',
                            marginBottom: '4px'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        加入播放隊列
                    </div>
                    <div style={{ height: '1px', backgroundColor: '#3a3a3a', margin: '4px 0' }}></div>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', padding: '0 8px' }}>加入歌單...</div>
                    {playlists.map(p => (
                        <div
                            key={p.id}
                            onClick={() => {
                                addSongToPlaylist(p.id, song.id);
                                setShowAddToPlaylistMenu(null);
                            }}
                            style={{
                                padding: '6px 8px',
                                cursor: 'pointer',
                                color: '#fff',
                                fontSize: '14px',
                                borderRadius: '4px',
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            {p.name}
                        </div>
                    ))}
                    <div style={{ height: '1px', backgroundColor: '#3a3a3a', margin: '4px 0' }}></div>
                    {isCreatingPlaylist ? (
                        <div style={{ padding: '4px' }}>
                            <input
                                autoFocus
                                type="text"
                                value={newPlaylistName}
                                onChange={(e) => setNewPlaylistName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        if (newPlaylistName.trim()) {
                                            const id = createPlaylist(newPlaylistName.trim());
                                            addSongToPlaylist(id, song.id);
                                            setShowAddToPlaylistMenu(null);
                                        }
                                    }
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
                            />
                        </div>
                    ) : (
                        <div
                            onClick={() => setIsCreatingPlaylist(true)}
                            style={{
                                padding: '6px 8px',
                                cursor: 'pointer',
                                color: 'var(--accent-color)',
                                fontSize: '14px',
                                borderRadius: '4px',
                                fontWeight: 600
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            ＋ 新建歌單
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default SongRow;
