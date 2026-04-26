import React, { useMemo } from 'react';
import { useLibrary } from '../contexts/LibraryContext';
import { useUserData } from '../contexts/UserDataContext';
import SongList from './SongList';
import { SongMeta } from '../../shared/songTypes';
import FavoritesIcon from '../assets/icons/favorites.svg';

interface FavoritesViewProps {
    onOpenLyrics?: (song: SongMeta) => void;
}

const FavoritesView: React.FC<FavoritesViewProps> = ({ onOpenLyrics }) => {
    const { getSongById } = useLibrary();
    const { favorites } = useUserData();

    const favoriteSongs = useMemo(() => {
        return favorites
            .map(id => getSongById(id))
            .filter(song => song !== undefined) as SongMeta[];
    }, [favorites, getSongById]);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: '#fff', padding: '32px' }}>
            <div style={{ marginBottom: '20px', flexShrink: 0 }}>
                <h1 style={{ margin: '0 0 10px 0', fontSize: '28px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={FavoritesIcon} alt="" style={pageTitleIconStyle} />
                    我的最愛
                </h1>
                <div style={{ fontSize: '14px', color: '#888' }}>
                    收藏的歌曲會顯示在這裡，可直接篩選、排序並播放。
                </div>
            </div>

            <div style={{ flex: 1, overflow: 'hidden' }}>
                <SongList
                    songs={favoriteSongs}
                    context="favorites"
                    listKey="favorites"
                    onEditLyrics={onOpenLyrics}
                    emptyMessage="尚未加入任何最愛歌曲"
                />
            </div>
        </div>
    );
};

const pageTitleIconStyle: React.CSSProperties = {
    width: '26px',
    height: '26px',
    filter: 'brightness(0) invert(1)',
    opacity: 0.9,
    flexShrink: 0,
};

export default FavoritesView;
