import React, { useMemo } from 'react';
import { useLibrary } from '../contexts/LibraryContext';
import SongList from './SongList';

interface SearchResultsViewProps {
    searchTerm: string;
}

const SearchResultsView: React.FC<SearchResultsViewProps> = ({ searchTerm }) => {
    const { songs } = useLibrary();

    const filteredSongs = useMemo(() => {
        if (!searchTerm.trim()) return [];
        const lowerTerm = searchTerm.toLowerCase();
        return songs.filter(song =>
            song.title.toLowerCase().includes(lowerTerm) ||
            (song.artist && song.artist.toLowerCase().includes(lowerTerm))
        );
    }, [songs, searchTerm]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border-color)',
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#fff'
            }}>
                搜尋結果: "{searchTerm}"
                <span style={{ fontSize: '14px', color: '#aaa', marginLeft: '12px', fontWeight: 'normal' }}>
                    ({filteredSongs.length} 首歌曲)
                </span>
            </div>

            <div style={{ flex: 1, overflow: 'hidden', padding: '0 24px' }}>
                {filteredSongs.length > 0 ? (
                    <SongList songs={filteredSongs} context="library" />
                ) : (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: '#888',
                        flexDirection: 'column',
                        gap: '12px'
                    }}>
                        <div style={{ fontSize: '48px' }}>🔍</div>
                        <div>找不到符合 "{searchTerm}" 的歌曲</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchResultsView;
