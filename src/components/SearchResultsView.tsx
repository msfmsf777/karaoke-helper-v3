import React, { useMemo, useState, useEffect, useRef } from 'react';
import { SongMeta } from '../../shared/songTypes';
import { useLibrary } from '../contexts/LibraryContext';
import { useQueue } from '../contexts/QueueContext';
import { useUserData } from '../contexts/UserDataContext';
import { useDownloadJobs } from '../hooks/useDownloadJobs';
import SongList from './SongList';
import AddToPlaylistMenu from './AddToPlaylistMenu';
import OnlineSongContextMenu from './OnlineSongContextMenu';
import OnlineDownloadPanel from './OnlineDownloadPanel';
import YouTubeDownloadControl, { YouTubeDownloadTarget } from './YouTubeDownloadControl';
import FavoritesIcon from '../assets/icons/favorites.svg';
import FavoritesFilledIcon from '../assets/icons/favorites_filled.svg';
import AddIcon from '../assets/icons/add.svg';
import MoreIcon from '../assets/icons/more.svg';
import {
    DownloadState,
    ensureOnlineSong,
    findSongByYoutubeId,
    formatDuration,
    formatViewCount,
    getDownloadState,
    getYtDurationSeconds,
    getYtDurationTimestamp,
    lyricsLabel,
    YouTubeResultLike,
} from '../utils/onlineSongs';

interface SearchResultsViewProps {
    searchTerm: string;
    onOpenLyrics?: (song: SongMeta) => void;
}

type DurationFilter = 'any' | 'under5' | '5to10' | 'over10';
type DateFilter = 'any' | 'week' | 'month' | 'year';
type SortFilter = 'relevance' | 'popularity';

interface YouTubeRowProps {
    yt: YouTubeResultLike;
    index: number;
    cachedSong?: SongMeta;
    downloadState: DownloadState;
    isActive: boolean;
    onPlay: (yt: YouTubeResultLike) => void;
    onFavorite: (yt: YouTubeResultLike) => void;
    onAddToPlaylist: (event: React.MouseEvent, yt: YouTubeResultLike) => void;
    onMore: (event: React.MouseEvent, yt: YouTubeResultLike) => void;
    onContextMenu: (event: React.MouseEvent, yt: YouTubeResultLike) => void;
    onDownloadQueued: () => void;
    onCustomDownload: (target: YouTubeDownloadTarget) => void;
}

const YouTubeSearchRow: React.FC<YouTubeRowProps> = ({
    yt,
    cachedSong,
    downloadState,
    isActive,
    onPlay,
    onFavorite,
    onAddToPlaylist,
    onMore,
    onContextMenu,
    onDownloadQueued,
    onCustomDownload,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const { isFavorite } = useUserData();
    const favorite = cachedSong ? isFavorite(cachedSong.id) : false;
    const duration = getYtDurationSeconds(yt);
    const viewText = formatViewCount(yt.views);

    return (
        <div
            onDoubleClick={() => onPlay(yt)}
            onContextMenu={(e) => onContextMenu(e, yt)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                display: 'grid',
                gridTemplateColumns: '56px minmax(220px, 1fr) 60px 120px 118px 75px 80px',
                padding: '8px 16px',
                borderBottom: '1px solid #252525',
                color: '#fff',
                fontSize: '14px',
                alignItems: 'center',
                backgroundColor: isActive ? '#262626' : isHovered ? '#202020' : 'transparent',
                cursor: 'pointer',
                transition: 'background-color 0.1s',
                minHeight: '54px',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '5px', overflow: 'hidden', background: '#252525', flexShrink: 0 }}>
                    {yt.thumbnailUrl ? (
                        <img
                            src={yt.thumbnailUrl}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                    ) : null}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, paddingRight: '10px' }}>
                <div
                    title={yt.title}
                    style={{
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? 'var(--accent-color)' : '#fff',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginBottom: '2px',
                    }}
                >
                    {yt.title}
                </div>
                <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: '6px', color: '#888', fontSize: '12px' }}>
                    <span
                        title={yt.artist || 'Unknown Artist'}
                        style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                        {yt.artist || 'Unknown Artist'}
                    </span>
                    {viewText && <span style={{ color: '#666', flexShrink: 0 }}>•</span>}
                    {viewText && <span style={{ color: '#888', flexShrink: 0 }}>{viewText}</span>}
                    {yt.ago && <span style={{ color: '#666', flexShrink: 0 }}>•</span>}
                    {yt.ago && <span style={{ color: '#888', flexShrink: 0 }}>{yt.ago}</span>}
                </div>
            </div>

            <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
                <img
                    src={favorite ? FavoritesFilledIcon : FavoritesIcon}
                    alt=""
                    title={favorite ? '取消最愛' : '加入最愛'}
                    onClick={(e) => {
                        e.stopPropagation();
                        onFavorite(yt);
                    }}
                    style={{ width: '20px', height: '20px', cursor: 'pointer', display: 'block' }}
                />
            </div>

            <div style={{ display: 'flex', gap: '24px', paddingLeft: '6px', opacity: isHovered ? 1 : 0, transition: 'opacity 0.1s', alignItems: 'center' }}>
                <button
                    onClick={(e) => onAddToPlaylist(e, yt)}
                    title="加入歌單"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', opacity: 0.7 }}
                >
                    <img src={AddIcon} alt="" style={{ width: '20px', height: '20px', display: 'block' }} />
                </button>
                <button
                    onClick={(e) => onMore(e, yt)}
                    title="更多"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', opacity: 0.7 }}
                >
                    <img src={MoreIcon} alt="" style={{ width: '20px', height: '20px', display: 'block' }} />
                </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <YouTubeDownloadControl
                    target={{ youtubeId: yt.videoId, title: yt.title, artist: yt.artist }}
                    state={downloadState}
                    variant="search"
                    rowHovered={isHovered}
                    onQueued={onDownloadQueued}
                    onCustomDownload={onCustomDownload}
                />
            </div>

            <div style={{ color: cachedSong?.lyrics_status === 'synced' ? '#4caf50' : '#b3b3b3', fontSize: '13px', textAlign: 'center' }}>
                {lyricsLabel(cachedSong?.lyrics_status)}
            </div>

            <div style={{ color: '#b3b3b3', fontSize: '13px', textAlign: 'center' }}>
                {duration ? formatDuration(duration) : getYtDurationTimestamp(yt)}
            </div>
        </div>
    );
};

const SearchResultsView: React.FC<SearchResultsViewProps> = ({ searchTerm, onOpenLyrics }) => {
    const { songs, allSongs, refreshSongs } = useLibrary();
    const { playSongList, currentSongId } = useQueue();
    const { toggleFavorite } = useUserData();
    const downloadJobs = useDownloadJobs();
    const [ytResults, setYtResults] = useState<YouTubeResultLike[]>([]);
    const [ytLoading, setYtLoading] = useState(false);
    const [ytFetchingMore, setYtFetchingMore] = useState(false);
    const [hasMoreYtResults, setHasMoreYtResults] = useState(true);
    const [visibleYtLimit, setVisibleYtLimit] = useState(20);
    const fetchingRef = useRef(false);

    const [durationFilter, setDurationFilter] = useState<DurationFilter>('any');
    const [dateFilter, setDateFilter] = useState<DateFilter>('any');
    const [sortFilter, setSortFilter] = useState<SortFilter>('relevance');
    const [contextMenu, setContextMenu] = useState<{ song: SongMeta; position: { x: number; y: number } } | null>(null);
    const [addToPlaylistMenu, setAddToPlaylistMenu] = useState<{ songId: string; position: { x: number; y: number } } | null>(null);
    const [customDownloadTarget, setCustomDownloadTarget] = useState<YouTubeDownloadTarget | null>(null);

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
            window.khelper?.youtube.search(searchTerm).then((res: YouTubeResultLike[]) => {
                setYtResults(res || []);
                setHasMoreYtResults((res || []).length > 0);
                setYtLoading(false);
            }).catch((err: unknown) => {
                console.error(err);
                setYtLoading(false);
            });
        }
    }, [searchTerm]);

    const filteredYtResults = useMemo(() => {
        let results = [...ytResults];

        if (durationFilter !== 'any') {
            results = results.filter(yt => {
                const secs = getYtDurationSeconds(yt) || 0;
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
                window.khelper?.youtube.searchMore().then((moreResults: YouTubeResultLike[]) => {
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
                }).catch((err: unknown) => {
                    console.error('Failed to fetch more results:', err);
                    setHasMoreYtResults(false);
                    fetchingRef.current = false;
                    setYtFetchingMore(false);
                });
            }
        }
    };

    const getExistingOrEnsure = async (yt: YouTubeResultLike) => {
        return findSongByYoutubeId(allSongs, yt.videoId) || await ensureOnlineSong(yt, refreshSongs);
    };

    const handlePlayYt = async (yt: YouTubeResultLike) => {
        const meta = await getExistingOrEnsure(yt);
        if (meta) {
            playSongList([meta.id]);
        }
    };

    const handleFavoriteYt = async (yt: YouTubeResultLike) => {
        const meta = await getExistingOrEnsure(yt);
        if (meta) toggleFavorite(meta.id);
    };

    const handleAddToPlaylist = async (event: React.MouseEvent, yt: YouTubeResultLike) => {
        event.stopPropagation();
        const meta = await getExistingOrEnsure(yt);
        if (!meta) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setAddToPlaylistMenu({ songId: meta.id, position: { x: rect.left, y: rect.bottom + 5 } });
    };

    const openOnlineContextMenu = async (position: { x: number; y: number }, yt: YouTubeResultLike) => {
        const meta = await getExistingOrEnsure(yt);
        if (!meta) return;
        setContextMenu({ song: meta, position });
    };

    const visibleRows = filteredYtResults.slice(0, visibleYtLimit);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-sidebar)',
                display: 'flex',
                alignItems: 'center',
                zIndex: 10,
            }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>
                    搜尋結果: "{searchTerm}"
                </div>
            </div>

            <div
                onScroll={handleScroll}
                style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#aaaaaa' }}>
                        本地庫相符歌曲 <span style={{ fontSize: '14px', fontWeight: 'normal', opacity: 0.6 }}>({filteredSongs.length})</span>
                    </div>
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
                        position: 'sticky', top: '-24px', zIndex: 5,
                        backgroundColor: 'var(--bg-sidebar)',
                        padding: '16px 24px',
                        margin: '-16px -24px 0 -24px',
                    }}>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#88aaff' }}>YouTube 串流結果</div>
                        <div style={{ flex: 1 }} />
                        <div style={{ display: 'flex', gap: '8px', opacity: ytResults.length > 0 ? 1 : 0.5, pointerEvents: ytResults.length > 0 ? 'auto' : 'none' }}>
                            <select value={durationFilter} onChange={e => setDurationFilter(e.target.value as DurationFilter)} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 8px', outline: 'none', cursor: 'pointer', fontSize: '13px' }}>
                                <option value="any" style={{ color: '#000' }}>任何時長</option>
                                <option value="under5" style={{ color: '#000' }}>5 分鐘以內</option>
                                <option value="5to10" style={{ color: '#000' }}>5 - 10 分鐘</option>
                                <option value="over10" style={{ color: '#000' }}>超過 10 分鐘</option>
                            </select>
                            <select value={dateFilter} onChange={e => setDateFilter(e.target.value as DateFilter)} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 8px', outline: 'none', cursor: 'pointer', fontSize: '13px' }}>
                                <option value="any" style={{ color: '#000' }}>任何時間</option>
                                <option value="week" style={{ color: '#000' }}>本週上傳</option>
                                <option value="month" style={{ color: '#000' }}>本月上傳</option>
                                <option value="year" style={{ color: '#000' }}>今年上傳</option>
                            </select>
                            <select value={sortFilter} onChange={e => setSortFilter(e.target.value as SortFilter)} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 8px', outline: 'none', cursor: 'pointer', fontSize: '13px' }}>
                                <option value="relevance" style={{ color: '#000' }}>關聯性排序</option>
                                <option value="popularity" style={{ color: '#000' }}>觀看次數排序</option>
                            </select>
                        </div>
                    </div>

                    {ytLoading ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#888' }}>搜尋 YouTube 中...</div>
                    ) : visibleRows.length > 0 ? (
                        <div style={{ width: '100%', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'visible', background: 'rgba(255,255,255,0.01)' }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '56px minmax(220px, 1fr) 60px 120px 118px 75px 80px',
                                padding: '8px 24px 8px 16px',
                                borderBottom: '1px solid #333',
                                color: '#888',
                                fontSize: '12px',
                                fontWeight: 600,
                                backgroundColor: '#1a1a1a',
                                alignItems: 'center',
                            }}>
                                <div></div>
                                <div>標題 / 頻道</div>
                                <div style={{ textAlign: 'center' }}>最愛</div>
                                <div></div>
                                <div style={{ textAlign: 'center' }}>下載</div>
                                <div style={{ textAlign: 'center' }}>歌詞</div>
                                <div style={{ textAlign: 'center' }}>時長</div>
                            </div>
                            {visibleRows.map((yt, index) => {
                                const cachedSong = findSongByYoutubeId(allSongs, yt.videoId);
                                return (
                                    <YouTubeSearchRow
                                        key={yt.videoId}
                                        yt={yt}
                                        index={index}
                                        cachedSong={cachedSong}
                                        downloadState={getDownloadState(allSongs, downloadJobs, yt.videoId)}
                                        isActive={cachedSong?.id === currentSongId}
                                        onPlay={handlePlayYt}
                                        onFavorite={handleFavoriteYt}
                                        onAddToPlaylist={handleAddToPlaylist}
                                        onMore={(event, item) => {
                                            event.stopPropagation();
                                            const rect = event.currentTarget.getBoundingClientRect();
                                            openOnlineContextMenu({ x: rect.left, y: rect.bottom + 5 }, item);
                                        }}
                                        onContextMenu={(event, item) => {
                                            event.preventDefault();
                                            openOnlineContextMenu({ x: event.clientX, y: event.clientY }, item);
                                        }}
                                        onDownloadQueued={refreshSongs}
                                        onCustomDownload={setCustomDownloadTarget}
                                    />
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#666', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                            {ytResults.length > 0 ? '找不到符合目前篩選條件的 YouTube 結果' : '找不到來自 YouTube 的結果'}
                        </div>
                    )}

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
                            <div style={{ width: '20px', height: '20px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#88aaff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                            載入更多 YouTube 結果中...
                        </div>
                    )}
                </div>
            </div>

            {contextMenu && (
                <OnlineSongContextMenu
                    song={contextMenu.song}
                    position={contextMenu.position}
                    onClose={() => setContextMenu(null)}
                    onEditLyrics={(song) => {
                        onOpenLyrics?.(song);
                        setContextMenu(null);
                    }}
                    onDownloadQueued={refreshSongs}
                    onCustomDownload={setCustomDownloadTarget}
                />
            )}

            {customDownloadTarget && (
                <OnlineDownloadPanel
                    target={customDownloadTarget}
                    onClose={() => setCustomDownloadTarget(null)}
                    onQueued={refreshSongs}
                />
            )}

            {addToPlaylistMenu && (
                <AddToPlaylistMenu
                    songId={addToPlaylistMenu.songId}
                    position={addToPlaylistMenu.position}
                    onClose={() => setAddToPlaylistMenu(null)}
                />
            )}
        </div>
    );
};

export default SearchResultsView;
