import React, { useMemo, useState, useEffect } from 'react';
import { useLibrary } from '../contexts/LibraryContext';
import { useQueue } from '../contexts/QueueContext';
import SongList from './SongList';
import PlayIcon from '../assets/icons/play.svg';
import DownloadIcon from '../assets/icons/download.svg';

interface SearchResultsViewProps {
    searchTerm: string;
    onOpenLyrics?: (song: any) => void;
}

const SearchResultsView: React.FC<SearchResultsViewProps> = ({ searchTerm, onOpenLyrics }) => {
    const { songs, refreshSongs } = useLibrary();
    const { playSongList } = useQueue();
    const [ytResults, setYtResults] = useState<any[]>([]);
    const [ytLoading, setYtLoading] = useState(false);
    const [visibleYtLimit, setVisibleYtLimit] = useState(10);

    const filteredSongs = useMemo(() => {
        if (!searchTerm.trim()) return [];
        const lowerTerm = searchTerm.toLowerCase();
        return songs.filter(song =>
            song.title.toLowerCase().includes(lowerTerm) ||
            (song.artist && song.artist.toLowerCase().includes(lowerTerm))
        );
    }, [songs, searchTerm]);

    useEffect(() => {
        setYtResults([]);
        setVisibleYtLimit(10);
        if (searchTerm.trim()) {
            setYtLoading(true);
            window.khelper?.youtube.search(searchTerm).then(res => {
                setYtResults(res || []);
                setYtLoading(false);
            });
        }
    }, [searchTerm]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const bottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop <= e.currentTarget.clientHeight + 100;
        if (bottom && ytResults.length > visibleYtLimit) {
            setVisibleYtLimit(prev => Math.min(prev + 10, ytResults.length));
        }
    };

    const handlePlayYt = async (yt: any) => {
        const meta = await window.khelper?.songLibrary.addOnlineSong({
             youtubeId: yt.videoId,
             title: yt.title,
             artist: yt.artist,
             thumbnailUrl: yt.thumbnailUrl,
             duration: yt.duration
        });
        if (meta) {
             await refreshSongs();
             playSongList([meta.id]);
        }
    };

    const handleDownloadYt = async (yt: any) => {
        await window.khelper?.downloads.queueDownload(
            `https://www.youtube.com/watch?v=${yt.videoId}`,
            'best',
            yt.title,
            yt.artist,
            '原曲'
        );
        
        await window.khelper?.songLibrary.addOnlineSong({
             youtubeId: yt.videoId,
             title: yt.title,
             artist: yt.artist,
             thumbnailUrl: yt.thumbnailUrl,
             duration: yt.duration
        });
        await refreshSongs();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-sidebar)',
                display: 'flex',
                alignItems: 'center',
                zIndex: 10
            }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>
                    搜尋結果: "{searchTerm}"
                </div>
            </div>

            <div 
                onScroll={handleScroll} 
                style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}
            >
                {/* Local Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#aaaaaa' }}>本地庫相符歌曲 <span style={{ fontSize: '14px', fontWeight: 'normal', opacity: 0.6 }}>({filteredSongs.length})</span></div>
                    {filteredSongs.length > 0 ? (
                        <div className="local-scroll" style={{ height: Math.min(filteredSongs.length * 55 + 160, 230) + 'px', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px' }}>
                            <style>{`.local-scroll::-webkit-scrollbar { width: 6px; } .local-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }`}</style>
                            <SongList songs={filteredSongs} context="library" onEditLyrics={onOpenLyrics} />
                        </div>
                    ) : (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#666', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                            找不到符合 "{searchTerm}" 的本地歌曲
                        </div>
                    )}
                </div>

                {/* YouTube Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#88aaff' }}>YouTube 串流結果</div>
                    
                    {ytLoading ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#888' }}>
                            搜尋 YouTube 中...
                        </div>
                    ) : ytResults.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {ytResults.slice(0, visibleYtLimit).map(yt => (
                                <div key={yt.videoId} style={{
                                    display: 'flex', alignItems: 'center', gap: '16px', padding: '12px',
                                    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px',
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                                >
                                    <img src={yt.thumbnailUrl} alt="thumb" style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '4px' }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {yt.title}
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#aaa' }}>
                                            {yt.artist}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => handlePlayYt(yt)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                padding: '8px 16px', background: 'var(--accent-color)', color: '#fff',
                                                border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 600
                                            }}
                                        >
                                            <img src={PlayIcon} alt="play" style={{ width: '16px', height: '16px', filter: 'brightness(0) invert(1)' }} />
                                            串流播放
                                        </button>
                                        <button
                                            onClick={() => handleDownloadYt(yt)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                padding: '8px 16px', background: 'rgba(255,255,255,0.1)', color: '#fff',
                                                border: '1px solid rgba(255,255,255,0.2)', borderRadius: '20px', cursor: 'pointer'
                                            }}
                                        >
                                            <img src={DownloadIcon} alt="dl" style={{ width: '16px', height: '16px', filter: 'brightness(0) invert(1)' }} />
                                            下載並處理
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {visibleYtLimit < ytResults.length && (
                                <div style={{ padding: '16px', textAlign: 'center', color: '#888', fontStyle: 'italic' }}>
                                    向下捲動以載入更多...
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#666', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                            找不到來自 YouTube 的結果
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchResultsView;
