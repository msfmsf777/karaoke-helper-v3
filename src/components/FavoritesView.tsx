import React, { useMemo } from 'react';
import { useLibrary } from '../contexts/LibraryContext';
import { useUserData } from '../contexts/UserDataContext';
import { useQueue } from '../contexts/QueueContext';
import SongList from './SongList';
import { SongMeta } from '../../shared/songTypes';

interface FavoritesViewProps {
    onOpenLyrics?: (song: SongMeta) => void;
}

const FavoritesView: React.FC<FavoritesViewProps> = ({ onOpenLyrics }) => {
    const { getSongById } = useLibrary();
    const { favorites } = useUserData();
    const { playSongList, replaceQueue } = useQueue();

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
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: '#fff', padding: '32px' }}>
            <div style={{ marginBottom: '20px', flexShrink: 0 }}>
                <h1 style={{ margin: '0 0 10px 0', fontSize: '28px', fontWeight: 'bold' }}>我的最愛</h1>
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

            <div style={{ flex: 1, overflow: 'hidden' }}>
                <SongList
                    songs={favoriteSongs}
                    context="favorites"
                    onEditLyrics={onOpenLyrics}
                    emptyMessage="尚未加入任何最愛歌曲"
                />
            </div>
        </div>
    );
};

export default FavoritesView;
