import React, { useMemo } from 'react';
import { useLibrary } from '../contexts/LibraryContext';
import { useUserData } from '../contexts/UserDataContext';
import SongList from './SongList';
import { SongMeta } from '../../shared/songTypes';
import HistoryIcon from '../assets/icons/history.svg';

interface HistoryViewProps {
    onOpenLyrics?: (song: SongMeta) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ onOpenLyrics }) => {
    const { getSongById } = useLibrary();
    const { history, clearHistory } = useUserData();

    const historySongs = useMemo(() => {
        return history
            .map(id => getSongById(id))
            .filter(song => song !== undefined) as SongMeta[];
    }, [history, getSongById]);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: '#fff', padding: '32px' }}>
            <div style={{ marginBottom: '20px', flexShrink: 0 }}>
                <h1 style={{ margin: '0 0 10px 0', fontSize: '28px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={HistoryIcon} alt="" style={pageTitleIconStyle} />
                    最近播放
                </h1>
                <div style={{ fontSize: '14px', color: '#888' }}>
                    最近播放的歌曲會顯示在這裡，可依目前篩選結果直接播放。
                </div>
            </div>

            <div style={{ flex: 1, overflow: 'hidden' }}>
                <SongList
                    songs={historySongs}
                    context="recent"
                    listKey="recent"
                    onEditLyrics={onOpenLyrics}
                    emptyMessage="尚未有播放記錄"
                    moreActions={[
                        {
                            label: '清除播放記錄',
                            danger: true,
                            onClick: () => {
                                if (confirm('確定要清除播放記錄嗎？')) {
                                    clearHistory();
                                }
                            },
                        },
                    ]}
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

export default HistoryView;
