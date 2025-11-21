import React, { useMemo, useState } from 'react';
import { useLibrary } from '../contexts/LibraryContext';
import { useUserData } from '../contexts/UserDataContext';
import { useQueue } from '../contexts/QueueContext';
import SongList from './SongList';

interface PlaylistViewProps {
    playlistId: string;
    onOpenLyrics?: (song: any) => void; // Using any to match SongMeta if needed, or just SongMeta
}

const PlaylistView: React.FC<PlaylistViewProps> = ({ playlistId, onOpenLyrics }) => {
    const { getSongById } = useLibrary();
    const { playlists, renamePlaylist, deletePlaylist, removeSongFromPlaylist } = useUserData();
    const { playSongList, replaceQueue } = useQueue();
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
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: '#fff', padding: '32px' }}>
            <div style={{ marginBottom: '20px', flexShrink: 0 }}>
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
                            style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', cursor: 'pointer' }}
                            onClick={startRename}
                            title="點擊重新命名"
                        >
                            {playlist.name}
                        </h1>
                    )}
                    <span style={{ fontSize: '16px', color: '#666', cursor: 'pointer' }} onClick={startRename}>✎</span>
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

            <div style={{ flex: 1, overflow: 'hidden' }}>
                <SongList
                    songs={playlistSongs}
                    context="playlist"
                    onEditLyrics={onOpenLyrics}
                    emptyMessage="此歌單目前沒有歌曲，可從歌曲庫或其他列表使用「加入歌單…」新增。"
                    renderCustomActions={(song) => (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                removeSongFromPlaylist(playlistId, song.id);
                            }}
                            title="從歌單移除"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#d32f2f',
                                cursor: 'pointer',
                                fontSize: '16px',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                            }}
                            onMouseOver={(e) => e.currentTarget.style.color = '#ff5555'}
                            onMouseOut={(e) => e.currentTarget.style.color = '#d32f2f'}
                        >
                            ✕
                        </button>
                    )}
                />
            </div>
        </div>
    );
};

export default PlaylistView;
