import React, { useMemo, useState } from 'react';
import { useLibrary } from '../contexts/LibraryContext';
import { useUserData } from '../contexts/UserDataContext';
import { useQueue } from '../contexts/QueueContext';

interface PlaylistViewProps {
    playlistId: string;
}

const PlaylistView: React.FC<PlaylistViewProps> = ({ playlistId }) => {
    const { getSongById } = useLibrary();
    const { playlists, renamePlaylist, deletePlaylist, removeSongFromPlaylist, toggleFavorite, isFavorite } = useUserData();
    const { playImmediate, playSongList, replaceQueue } = useQueue();
    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState('');

    const playlist = playlists.find(p => p.id === playlistId);

    const playlistSongs = useMemo(() => {
        if (!playlist) return [];
        return playlist.songIds
            .map(id => getSongById(id))
            .filter(song => song !== undefined) as any[];
    }, [playlist, getSongById]);

    if (!playlist) {
        return <div style={{ padding: '20px', color: '#fff' }}>Playlist not found</div>;
    }

    const handlePlayAll = () => {
        if (playlistSongs.length === 0) return;
        playSongList(playlistSongs.map(s => s.id));
    };

    const handleReplaceAndPlay = () => {
        if (playlistSongs.length === 0) return;
        replaceQueue(playlistSongs.map(s => s.id));
    };

    const handleDeletePlaylist = () => {
        if (window.confirm(`確定要刪除歌單「${playlist.name}」嗎？`)) {
            deletePlaylist(playlistId);
        }
    };

    const startRename = () => {
        setNewName(playlist.name);
        setIsRenaming(true);
    };

    const confirmRename = () => {
        if (newName.trim()) {
            renamePlaylist(playlistId, newName.trim());
        }
        setIsRenaming(false);
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: '#fff', padding: '20px' }}>
            <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    {isRenaming ? (
                        <input
                            autoFocus
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onBlur={confirmRename}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmRename();
                                if (e.key === 'Escape') setIsRenaming(false);
                            }}
                            style={{
                                fontSize: '24px',
                                backgroundColor: '#333',
                                border: '1px solid #555',
                                color: '#fff',
                                padding: '4px 8px',
                                borderRadius: '4px'
                            }}
                        />
                    ) : (
                        <h1
                            style={{ margin: 0, fontSize: '24px', cursor: 'pointer' }}
                            onClick={startRename}
                            title="點擊重新命名"
                        >
                            {playlist.name}
                        </h1>
                    )}
                    <span style={{ fontSize: '12px', color: '#666', cursor: 'pointer' }} onClick={startRename}>✎</span>
                </div>

                <div style={{ fontSize: '14px', color: '#888', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>共 {playlistSongs.length} 首歌曲</span>
                    <button
                        onClick={handleDeletePlaylist}
                        style={{
                            backgroundColor: 'transparent',
                            border: '1px solid #d32f2f',
                            color: '#d32f2f',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        刪除此歌單
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={handlePlayAll}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#333',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#fff',
                            cursor: 'pointer'
                        }}
                    >
                        全部加入播放隊列 (追加)
                    </button>
                    <button
                        onClick={handleReplaceAndPlay}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: 'var(--primary-color)',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#fff',
                            cursor: 'pointer'
                        }}
                    >
                        取代播放隊列並播放
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {playlistSongs.length === 0 ? (
                    <div style={{ color: '#666', marginTop: '20px' }}>
                        此歌單目前沒有歌曲，可從歌曲庫或其他列表使用「加入歌單…」新增。
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #333', color: '#888', fontSize: '12px' }}>
                                <th style={{ padding: '8px', width: '40px' }}></th>
                                <th style={{ padding: '8px' }}>歌曲標題</th>
                                <th style={{ padding: '8px' }}>歌手</th>
                                <th style={{ padding: '8px' }}>狀態</th>
                                <th style={{ padding: '8px', width: '80px' }}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {playlistSongs.map((song) => (
                                <tr
                                    key={song.id}
                                    onDoubleClick={() => playImmediate(song.id)}
                                    style={{
                                        borderBottom: '1px solid #222',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}
                                    className="song-row"
                                >
                                    <td style={{ padding: '8px', textAlign: 'center' }}>
                                        <span
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFavorite(song.id);
                                            }}
                                            style={{
                                                color: isFavorite(song.id) ? 'var(--primary-color)' : '#444',
                                                cursor: 'pointer',
                                                fontSize: '16px'
                                            }}
                                        >
                                            {isFavorite(song.id) ? '♥' : '♡'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '8px' }}>{song.title}</td>
                                    <td style={{ padding: '8px' }}>{song.artist || 'Unknown'}</td>
                                    <td style={{ padding: '8px' }}>
                                        {song.lyricsRaw ? '📝' : ''} {song.lyricsSynced ? '🎤' : ''}
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeSongFromPlaylist(playlistId, song.id);
                                            }}
                                            style={{
                                                backgroundColor: 'transparent',
                                                border: 'none',
                                                color: '#888',
                                                cursor: 'pointer',
                                                fontSize: '12px'
                                            }}
                                            title="從歌單移除"
                                        >
                                            ✕
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default PlaylistView;
