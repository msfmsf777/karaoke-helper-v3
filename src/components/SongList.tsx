import React from 'react';
import { Virtuoso } from 'react-virtuoso';
import { SongMeta } from '../../shared/songTypes';
import { useQueue } from '../contexts/QueueContext';
import SongRow from './SongRow';

interface SongListProps {
    songs: SongMeta[];
    context: 'library' | 'favorites' | 'recent' | 'playlist';
    onEditLyrics?: (song: SongMeta) => void;
    emptyMessage?: string;
    showType?: boolean;
    showAudioStatus?: boolean;
    showLyricStatus?: boolean;
    showDuration?: boolean;
    renderCustomActions?: (song: SongMeta) => React.ReactNode;
}

const SongList: React.FC<SongListProps> = ({
    songs,
    context,
    onEditLyrics,
    emptyMessage = '沒有歌曲',
    showType = true,
    showAudioStatus = true,
    showLyricStatus = true,
    showDuration = true,
    renderCustomActions
}) => {
    const { currentSongId } = useQueue();

    if (songs.length === 0) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
                {emptyMessage}
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '40px minmax(200px, 1fr) 60px 160px 100px 220px 120px 80px', // Must match SongRow
                    padding: '8px 16px',
                    borderBottom: '1px solid #333',
                    color: '#888',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: '#1a1a1a',
                    zIndex: 1,
                }}
            >
                <div>#</div>
                <div>標題 / 歌手</div>
                <div style={{ textAlign: 'center' }}>最愛</div>
                <div></div>
                <div>{showType ? '類型' : ''}</div>
                <div>{showAudioStatus ? '音訊狀態' : ''}</div>
                <div>{showLyricStatus ? '歌詞' : ''}</div>
                <div style={{ textAlign: 'right', paddingRight: '32px' }}>{showDuration ? '時長' : ''}</div>
            </div>

            {/* Virtualized List */}
            <div style={{ flex: 1 }}>
                <Virtuoso
                    style={{ height: '100%' }}
                    totalCount={songs.length}
                    components={{
                        Footer: () => <div style={{ height: '120px' }} />
                    }}
                    itemContent={(index) => {
                        const song = songs[index];
                        return (
                            <SongRow
                                key={song.id}
                                song={song}
                                index={index}
                                isActive={song.id === currentSongId}
                                context={context}
                                onEditLyrics={onEditLyrics}
                                showType={showType}
                                showAudioStatus={showAudioStatus}
                                showLyricStatus={showLyricStatus}
                                showDuration={showDuration}
                                customActions={renderCustomActions ? renderCustomActions(song) : undefined}
                            />
                        );
                    }}
                />
            </div>
        </div>
    );
};

export default SongList;
