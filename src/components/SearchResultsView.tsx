import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useLibrary } from '../contexts/LibraryContext';
import { useQueue } from '../contexts/QueueContext';
import SongList from './SongList';
import PlayIcon from '../assets/icons/play.svg';
import DownloadIcon from '../assets/icons/download.svg';

interface SearchResultsViewProps {
    searchTerm: string;
    onOpenLyrics?: (song: any) => void;
}

type DurationFilter = 'any' | 'under5' | '5to10' | 'over10';
type DateFilter = 'any' | 'week' | 'month' | 'year';
type SortFilter = 'relevance' | 'popularity';

const SearchResultsView: React.FC<SearchResultsViewProps> = ({ searchTerm, onOpenLyrics }) => {
    const { songs, refreshSongs } = useLibrary();
    const { playSongList } = useQueue();
    const [ytResults, setYtResults] = useState<any[]>([]);
    const [ytLoading, setYtLoading] = useState(false);
    const [ytFetchingMore, setYtFetchingMore] = useState(false);
    const [hasMoreYtResults, setHasMoreYtResults] = useState(true);
    const [visibleYtLimit, setVisibleYtLimit] = useState(20);
    const fetchingRef = useRef(false);

    const [durationFilter, setDurationFilter] = useState<DurationFilter>('any');
    const [dateFilter, setDateFilter] = useState<DateFilter>('any');
    const [sortFilter, setSortFilter] = useState<SortFilter>('relevance');

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
        setVisibleYtLimit(20);
        setHasMoreYtResults(true);
        fetchingRef.current = false;
        setDurationFilter('any');
        setDateFilter('any');
        setSortFilter('relevance');
        if (searchTerm.trim()) {
            setYtLoading(true);
            window.khelper?.youtube.search(searchTerm).then(res => {
                setYtResults(res || []);
                setHasMoreYtResults((res || []).length > 0);
                setYtLoading(false);
            }).catch(e => {
                console.error(e);
                setYtLoading(false);
            });
        }
    }, [searchTerm]);

    const filteredYtResults = useMemo(() => {
        let results = [...ytResults];

        if (durationFilter !== 'any') {
            results = results.filter(yt => {
                const secs = yt.duration?.seconds || 0;
                if (durationFilter === 'under5') return secs < 300;
                if (durationFilter === '5to10') return secs >= 300 && secs <= 600;
                if (durationFilter === 'over10') return secs > 600;
                return true;
            });
        }

        if (dateFilter !== 'any') {
            results = results.filter(yt => {
                if (!yt.ago) return true;
                const text = yt.ago.toLowerCase();
                const has = (words: string[]) => words.some(w => text.includes(w));
                
                if (dateFilter === 'week') {
                    return has(['second', 'minute', 'hour', 'day']) || text === '1 week ago';
                }
                if (dateFilter === 'month') {
                    return has(['second', 'minute', 'hour', 'day', 'week']) || text === '1 month ago';
                }
                if (dateFilter === 'year') {
                    return has(['second', 'minute', 'hour', 'day', 'week', 'month']) || text === '1 year ago';
                }
                return true;
            });
        }

        if (sortFilter === 'popularity') {
            results.sort((a, b) => (b.views || 0) - (a.views || 0));
        }

        return results;
    }, [ytResults, durationFilter, dateFilter, sortFilter]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const bottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop <= e.currentTarget.clientHeight + 100;
        if (bottom) {
            if (filteredYtResults.length > visibleYtLimit) {
                setVisibleYtLimit(prev => Math.min(prev + 10, filteredYtResults.length));
            } else if (!fetchingRef.current && hasMoreYtResults && ytResults.length >= 20) {
                fetchingRef.current = true;
                setYtFetchingMore(true);
                window.khelper?.youtube.searchMore().then(moreResults => {
                    if (moreResults && moreResults.length > 0) {
                        setYtResults(prev => {
                            const existingIds = new Set(prev.map(r => r.videoId));
                            const uniqueMore = moreResults.filter(r => !existingIds.has(r.videoId));
                            return [...prev, ...uniqueMore];
                        });
                        setVisibleYtLimit(prev => prev + 20);
                    } else {
                        setHasMoreYtResults(false);
                    }
                    fetchingRef.current = false;
                    setYtFetchingMore(false);
                }).catch(err => {
                    console.error("Failed to fetch more results:", err);
                    setHasMoreYtResults(false);
                    fetchingRef.current = false;
                    setYtFetchingMore(false);
                });
            }
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
                        <div className="local-scroll" style={{ height: Math.min(filteredSongs.length * 55 + 160, 230) + 'px', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px', overflowX: 'hidden', boxSizing: 'border-box' }}>
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
                    <div style={{ 
                        display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
                        position: 'sticky', top: '-24px', zIndex: 5,
                        backgroundColor: 'var(--bg-sidebar)',
                        padding: '16px 24px',
                        margin: '-16px -24px 0 -24px'
                    }}>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#88aaff' }}>YouTube 串流結果</div>
                        
                        <div style={{ flex: 1 }} />

                        <div style={{ display: 'flex', gap: '8px', opacity: ytResults.length > 0 ? 1 : 0.5, pointerEvents: ytResults.length > 0 ? 'auto' : 'none' }}>
                            <select 
                                value={durationFilter} onChange={e => setDurationFilter(e.target.value as any)}
                                style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 8px', outline: 'none', cursor: 'pointer', fontSize: '13px' }}
                            >
                                <option value="any" style={{ color: '#000' }}>任何時長</option>
                                <option value="under5" style={{ color: '#000' }}>5 分鐘以內</option>
                                <option value="5to10" style={{ color: '#000' }}>5 - 10 分鐘</option>
                                <option value="over10" style={{ color: '#000' }}>超過 10 分鐘</option>
                            </select>

                            <select 
                                value={dateFilter} onChange={e => setDateFilter(e.target.value as any)}
                                style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 8px', outline: 'none', cursor: 'pointer', fontSize: '13px' }}
                            >
                                <option value="any" style={{ color: '#000' }}>任何時間</option>
                                <option value="week" style={{ color: '#000' }}>本週上傳</option>
                                <option value="month" style={{ color: '#000' }}>本月上傳</option>
                                <option value="year" style={{ color: '#000' }}>今年上傳</option>
                            </select>

                            <select 
                                value={sortFilter} onChange={e => setSortFilter(e.target.value as any)}
                                style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 8px', outline: 'none', cursor: 'pointer', fontSize: '13px' }}
                            >
                                <option value="relevance" style={{ color: '#000' }}>關聯性排序</option>
                                <option value="popularity" style={{ color: '#000' }}>觀看次數排序</option>
                            </select>
                        </div>
                    </div>
                    
                    {ytLoading ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#888' }}>
                            搜尋 YouTube 中...
                        </div>
                    ) : filteredYtResults.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {filteredYtResults.slice(0, visibleYtLimit).map(yt => (
                                <div key={yt.videoId} style={{
                                    display: 'flex', alignItems: 'center', gap: '16px', padding: '12px',
                                    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px',
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                                >
                                    <div style={{ position: 'relative', width: '120px', height: '90px', flexShrink: 0 }}>
                                        <img src={yt.thumbnailUrl} alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                                        {yt.duration?.timestamp && (
                                            <div style={{
                                                position: 'absolute', bottom: '4px', right: '4px',
                                                background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: '11px', fontWeight: 600,
                                                padding: '2px 4px', borderRadius: '4px'
                                            }}>
                                                {yt.duration.timestamp}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {yt.title}
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#aaa', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <span>{yt.artist}</span>
                                            {yt.views && <span style={{ fontSize: '11px', color: '#666' }}>•</span>}
                                            {yt.views && <span>{`${(yt.views / 10000).toFixed(1)}萬次觀看`}</span>}
                                            {yt.ago && <span style={{ fontSize: '11px', color: '#666' }}>•</span>}
                                            {yt.ago && <span>{yt.ago}</span>}
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
                            {visibleYtLimit < filteredYtResults.length && !ytFetchingMore && hasMoreYtResults && (
                                <div style={{ padding: '16px', textAlign: 'center', color: '#888', fontStyle: 'italic' }}>
                                    向下捲動以載入更多...
                                </div>
                            )}
                            {visibleYtLimit >= filteredYtResults.length && !hasMoreYtResults && ytResults.length > 0 && (
                                <div style={{ padding: '16px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
                                    沒有更多 YouTube 結果了
                                </div>
                            )}
                            {ytFetchingMore && (
                                <div style={{ padding: '24px', textAlign: 'center', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '20px', height: '20px', border: '3px solid rgba(255,255,255,0.1)',
                                        borderTopColor: '#88aaff', borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                    }}></div>
                                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                                    載入更多 YouTube 結果中...
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#666', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                            {ytResults.length > 0 ? `找不到符合目前篩選條件的 YouTube 結果` : `找不到來自 YouTube 的結果`}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchResultsView;
