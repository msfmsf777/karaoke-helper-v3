import React, { useMemo } from 'react';
import { useLibrary } from '../contexts/LibraryContext';
import { useUserData } from '../contexts/UserDataContext';
import { useQueue } from '../contexts/QueueContext';
import SongList from './SongList';
import { SongMeta } from '../../shared/songTypes';

interface HistoryViewProps {
    onOpenLyrics?: (song: SongMeta) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ onOpenLyrics }) => {
    const { getSongById } = useLibrary();
    const { history, clearHistory } = useUserData();
    const { playSongList, replaceQueue } = useQueue();

    const historySongs = useMemo(() => {
        return history
            .map(id => getSongById(id))
            .filter(song => song !== undefined) as any[];
    }, [history, getSongById]);

    const handlePlayAll = () => {
        if (historySongs.length === 0) return;
        playSongList(historySongs.map(s => s.id));
    };

    const handleReplaceAndPlay = () => {
        if (historySongs.length === 0) return;
        replaceQueue(historySongs.map(s => s.id));
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: '#fff', padding: '32px' }}>
            <div style={{ marginBottom: '20px', flexShrink: 0 }}>
                <h1 style={{ margin: '0 0 10px 0', fontSize: '32px', fontWeight: 'bold' }}>最近播放</h1>
                <div style={{ fontSize: '14px', color: '#888', marginBottom: '16px' }}>
                    顯示最近 {historySongs.length} 首播放的歌曲
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
                    <button
                        onClick={() => {
                            if (confirm('確定要清除播放記錄嗎？')) {
                                clearHistory();
                            }
                        }}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#333',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#fff',
                            cursor: 'pointer',
                            marginLeft: 'auto'
                        }}
                    >
                        清除播放記錄
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, overflow: 'hidden' }}>
                <SongList
                    songs={historySongs}
                    context="recent"
                    onEditLyrics={onOpenLyrics}
                    emptyMessage="尚未有播放記錄"
                // Maybe hide type/audio status for recent? Prompt said "e.g., 類型 might be hidden for 最近播放 if you prefer".
                // I'll keep them for consistency as requested "Unify...".
                />
            </div>
        </div>
    );
};

export default HistoryView;
