import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLibrary } from '../contexts/LibraryContext';
import { useUserData } from '../contexts/UserDataContext';
import SongList from './SongList';
import RemoveIcon from '../assets/icons/remove.svg';
import PlaylistIcon from '../assets/icons/playlist_item.svg';
import { SongMeta } from '../../shared/songTypes';

interface PlaylistViewProps {
    playlistId: string;
    onOpenLyrics?: (song: SongMeta) => void;
}

const PlaylistView: React.FC<PlaylistViewProps> = ({ playlistId, onOpenLyrics }) => {
    const { t } = useTranslation();
    const { getSongById } = useLibrary();
    const { playlists, renamePlaylist, deletePlaylist, removeSongFromPlaylist } = useUserData();
    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState('');

    const playlist = playlists.find(p => p.id === playlistId);

    const playlistSongs = useMemo(() => {
        if (!playlist) return [];
        return playlist.songIds
            .map(id => getSongById(id))
            .filter(song => song !== undefined) as SongMeta[];
    }, [playlist, getSongById]);

    if (!playlist) {
        return <div style={{ padding: '20px', color: '#fff' }}>{t('songManagement.playlistNotFound')}</div>;
    }

    const handleDeletePlaylist = () => {
        if (window.confirm(t('songManagement.deletePlaylistConfirm', { name: playlist.name }))) {
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
                    <img src={PlaylistIcon} alt="" style={pageTitleIconStyle} />
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
                            style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', cursor: 'pointer' }}
                            onClick={startRename}
                            title={t('songManagement.renameHint')}
                        >
                            {playlist.name}
                        </h1>
                    )}
                    <span style={{ fontSize: '16px', color: '#666', cursor: 'pointer' }} onClick={startRename}>✎</span>
                </div>

                <div style={{ fontSize: '14px', color: '#888' }}>
                    {t('songManagement.playlistDescription')}
                </div>
            </div>

            <div style={{ flex: 1, overflow: 'hidden' }}>
                <SongList
                    songs={playlistSongs}
                    context="playlist"
                    listKey={`playlist:${playlistId}`}
                    onEditLyrics={onOpenLyrics}
                    emptyMessage={t('songManagement.playlistEmpty')}
                    moreActions={[
                        {
                            label: t('songManagement.deletePlaylist'),
                            danger: true,
                            onClick: handleDeletePlaylist,
                        },
                    ]}
                    renderCustomActions={(song) => (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                removeSongFromPlaylist(playlistId, song.id);
                            }}
                            title={t('songManagement.removeFromPlaylist')}
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
                            <img src={RemoveIcon} alt="Remove" style={{ width: '20px', height: '20px', display: 'block' }} />
                        </button>
                    )}
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

export default PlaylistView;
