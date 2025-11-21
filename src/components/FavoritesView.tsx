import React, { useMemo } from 'react';
import { useLibrary } from '../contexts/LibraryContext';
import { useUserData } from '../contexts/UserDataContext';
import { useQueue } from '../contexts/QueueContext';

const FavoritesView: React.FC = () => {
    const { getSongById } = useLibrary();
    const { favorites, toggleFavorite, isFavorite } = useUserData();
    const { playImmediate, playSongList, replaceQueue } = useQueue();

    const favoriteSongs = useMemo(() => {
        return favorites
            .map(id => getSongById(id))
            .filter(song => song !== undefined) as any[];
    }, [favorites, getSongById]);

    const handlePlayAll = () => {
        if (favoriteSongs.length === 0) return;
        playSongList(favoriteSongs.map(s => s.id));
    };

    const handleReplaceAndPlay = () => {
        if (favoriteSongs.length === 0) return;
        replaceQueue(favoriteSongs.map(s => s.id));
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: '#fff', padding: '20px' }}>
            <div style={{ marginBottom: '20px' }}>
                <h1 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>我的最愛</h1>
                <div style={{ fontSize: '14px', color: '#888', marginBottom: '16px' }}>
                    共 {favoriteSongs.length} 首歌曲
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
                {favoriteSongs.length === 0 ? (
                    <div style={{ color: '#666', marginTop: '20px' }}>尚未加入任何最愛歌曲</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #333', color: '#888', fontSize: '12px' }}>
                                <th style={{ padding: '8px', width: '40px' }}></th>
                                <th style={{ padding: '8px' }}>歌曲標題</th>
                                <th style={{ padding: '8px' }}>歌手</th>
                                <th style={{ padding: '8px' }}>狀態</th>
                            </tr>
                        </thead>
                        <tbody>
                            {favoriteSongs.map((song) => (
                                <tr
                                    key={song.id}
                                    onDoubleClick={() => playImmediate(song.id)}
                                    style={{
                                        borderBottom: '1px solid #222',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}
                                    className="song-row" // Assuming global CSS for hover effect
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
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default FavoritesView;
