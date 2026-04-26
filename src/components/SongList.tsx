import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { SongMeta } from '../../shared/songTypes';
import {
    DEFAULT_SONG_LIST_VIEW_CONFIG,
    SongListFilters,
    SongListSortKey,
    mergeSongListViewConfig,
} from '../../shared/songListView';
import { useQueue } from '../contexts/QueueContext';
import { useUserData } from '../contexts/UserDataContext';
import SongRow from './SongRow';
import PlayIcon from '../assets/icons/play.svg';
import QueueAddIcon from '../assets/icons/queue_add.svg';
import MoreIcon from '../assets/icons/more.svg';
import SearchIcon from '../assets/icons/search.svg';
import FilterIcon from '../assets/icons/filter.svg';
import ModeRandomIcon from '../assets/icons/mode_random.svg';
import PlaylistIcon from '../assets/icons/playlist.svg';
import CheckIcon from '../assets/icons/check.svg';
import { coerceDurationSeconds } from '../utils/onlineSongs';
import { SONG_TABLE_GRID, SONG_TABLE_HEADER_PADDING } from './songTableLayout';

interface SongListMoreAction {
    label: string;
    danger?: boolean;
    onClick: () => void;
}

interface SongListProps {
    songs: SongMeta[];
    context: 'library' | 'favorites' | 'recent' | 'playlist';
    listKey?: string;
    onEditLyrics?: (song: SongMeta) => void;
    emptyMessage?: string;
    showType?: boolean;
    showAudioStatus?: boolean;
    showLyricStatus?: boolean;
    showDuration?: boolean;
    moreActions?: SongListMoreAction[];
    renderCustomActions?: (song: SongMeta) => React.ReactNode;
}

const audioFilterOptions: { value: SongListFilters['audio']; label: string }[] = [
    { value: 'all', label: '全部音訊' },
    { value: 'streaming', label: '線上' },
    { value: 'original_only', label: '未分離' },
    { value: 'separated', label: '已分離' },
    { value: 'separation_pending', label: '等待分離' },
    { value: 'separating', label: '分離中' },
    { value: 'separation_failed', label: '分離失敗' },
];

const lyricsFilterOptions: { value: SongListFilters['lyrics']; label: string }[] = [
    { value: 'all', label: '全部歌詞' },
    { value: 'none', label: '無歌詞' },
    { value: 'text_only', label: '純文字' },
    { value: 'synced', label: '已對齊' },
];

const sourceFilterOptions: { value: SongListFilters['source']; label: string }[] = [
    { value: 'all', label: '全部來源' },
    { value: 'file', label: '本機檔案' },
    { value: 'youtube', label: 'YouTube' },
];

const favoriteFilterOptions: { value: SongListFilters['favorite']; label: string }[] = [
    { value: 'all', label: '全部最愛' },
    { value: 'favorite', label: '最愛' },
    { value: 'not_favorite', label: '非最愛' },
];

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const iconFilter = 'brightness(0) invert(1)';

const getAudioSortRank = (song: SongMeta) => {
    const ranks: Record<SongMeta['audio_status'], number> = {
        streaming: 0,
        original_only: 1,
        ready: 1,
        missing: 1,
        separation_pending: 2,
        separating: 3,
        separated: 4,
        separation_failed: 5,
        error: 6,
    };
    return ranks[song.audio_status] ?? 99;
};

const getLyricsSortRank = (song: SongMeta) => {
    if (song.lyrics_status === 'synced') return 2;
    if (song.lyrics_status === 'text_only') return 1;
    return 0;
};

const matchesAudioFilter = (song: SongMeta, filter: SongListFilters['audio']) => {
    if (filter === 'all') return true;
    if (filter === 'original_only') return ['original_only', 'ready', 'missing'].includes(song.audio_status);
    return song.audio_status === filter;
};

const compareValues = (a: string | number | boolean, b: string | number | boolean) => {
    if (typeof a === 'string' && typeof b === 'string') return collator.compare(a, b);
    if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
    return Number(a) - Number(b);
};

const getSortValue = (song: SongMeta, key: SongListSortKey, favorite: boolean) => {
    switch (key) {
        case 'title':
            return song.title || '';
        case 'artist':
            return song.artist || '';
        case 'favorite':
            return favorite;
        case 'type':
            return song.type || '';
        case 'audio':
            return getAudioSortRank(song);
        case 'lyrics':
            return getLyricsSortRank(song);
        case 'duration':
            return coerceDurationSeconds(song.duration) ?? -1;
        case 'created':
            return Date.parse(song.created_at || '') || 0;
        case 'updated':
            return Date.parse(song.updated_at || '') || 0;
        default:
            return 0;
    }
};

const SongList: React.FC<SongListProps> = ({
    songs,
    context,
    listKey = context,
    onEditLyrics,
    emptyMessage = '沒有歌曲',
    showType = true,
    showAudioStatus = true,
    showLyricStatus = true,
    showDuration = true,
    moreActions = [],
    renderCustomActions
}) => {
    const { currentSongId, playVisibleList, addSongsToQueue } = useQueue();
    const { isFavorite, songListViews, setSongListViewConfig } = useUserData();
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [queueAdded, setQueueAdded] = useState(false);
    const moreMenuRef = useRef<HTMLDivElement>(null);
    const filterMenuRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const queueAddedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const viewConfig = mergeSongListViewConfig(songListViews[listKey]);
    const filters = viewConfig.filters;

    const updateView = (patch: Partial<typeof viewConfig>) => {
        setSongListViewConfig(listKey, patch);
    };

    const updateFilters = (patch: Partial<SongListFilters>) => {
        updateView({ filters: { ...filters, ...patch } });
    };

    const visibleSongs = useMemo(() => {
        const search = viewConfig.search.trim().toLowerCase();
        const filtered = songs
            .map((song, originalIndex) => ({ song, originalIndex, favorite: isFavorite(song.id) }))
            .filter(({ song, favorite }) => {
                const matchesSearch = !search
                    || song.title.toLowerCase().includes(search)
                    || (song.artist || '').toLowerCase().includes(search);
                if (!matchesSearch) return false;
                if (filters.type !== 'all' && song.type !== filters.type) return false;
                if (!matchesAudioFilter(song, filters.audio)) return false;
                if (filters.lyrics !== 'all' && (song.lyrics_status || 'none') !== filters.lyrics) return false;
                if (filters.source !== 'all' && song.source.kind !== filters.source) return false;
                if (filters.favorite === 'favorite' && !favorite) return false;
                if (filters.favorite === 'not_favorite' && favorite) return false;
                return true;
            });

        if (viewConfig.sortKey === 'original') return filtered.map(({ song }) => song);

        const direction = viewConfig.sortDirection === 'asc' ? 1 : -1;
        return filtered
            .sort((a, b) => {
                const primary = compareValues(
                    getSortValue(a.song, viewConfig.sortKey, a.favorite),
                    getSortValue(b.song, viewConfig.sortKey, b.favorite)
                );
                if (primary !== 0) return primary * direction;
                return a.originalIndex - b.originalIndex;
            })
            .map(({ song }) => song);
    }, [songs, viewConfig, filters, isFavorite]);

    const visibleSongIds = useMemo(() => visibleSongs.map(song => song.id), [visibleSongs]);
    const filterChips = [
        filters.type !== 'all' ? { key: 'type', label: `類型：${filters.type}`, clear: () => updateFilters({ type: 'all' }) } : null,
        filters.audio !== 'all' ? { key: 'audio', label: `音訊：${audioFilterOptions.find(o => o.value === filters.audio)?.label ?? filters.audio}`, clear: () => updateFilters({ audio: 'all' }) } : null,
        filters.lyrics !== 'all' ? { key: 'lyrics', label: `歌詞：${lyricsFilterOptions.find(o => o.value === filters.lyrics)?.label ?? filters.lyrics}`, clear: () => updateFilters({ lyrics: 'all' }) } : null,
        filters.source !== 'all' ? { key: 'source', label: `來源：${sourceFilterOptions.find(o => o.value === filters.source)?.label ?? filters.source}`, clear: () => updateFilters({ source: 'all' }) } : null,
        filters.favorite !== 'all' ? { key: 'favorite', label: favoriteFilterOptions.find(o => o.value === filters.favorite)?.label ?? filters.favorite, clear: () => updateFilters({ favorite: 'all' }) } : null,
    ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

    const hasActiveFilters = filterChips.length > 0;
    const hasActiveSearch = viewConfig.search.trim() !== '';
    const isFiltered = visibleSongs.length !== songs.length || hasActiveSearch || viewConfig.sortKey !== 'original';

    const setSort = (key: SongListSortKey) => {
        if (viewConfig.sortKey !== key) {
            updateView({ sortKey: key, sortDirection: 'asc' });
            return;
        }
        if (viewConfig.sortDirection === 'asc') {
            updateView({ sortKey: key, sortDirection: 'desc' });
            return;
        }
        updateView({ sortKey: 'original', sortDirection: 'asc' });
    };

    const clearFilters = () => {
        updateView({ filters: DEFAULT_SONG_LIST_VIEW_CONFIG.filters });
    };

    const resetView = () => {
        updateView(DEFAULT_SONG_LIST_VIEW_CONFIG);
        setIsSearchOpen(false);
    };

    const shuffleVisible = () => {
        const shuffled = [...visibleSongIds];
        for (let i = shuffled.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        playVisibleList(shuffled, 0);
        setShowMoreMenu(false);
    };

    const replaceQueueAndPlay = () => {
        playVisibleList(visibleSongIds, 0);
        setShowMoreMenu(false);
    };

    useEffect(() => {
        if (!isSearchOpen) return;
        requestAnimationFrame(() => searchInputRef.current?.focus());
    }, [isSearchOpen]);

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (showMoreMenu && moreMenuRef.current && !moreMenuRef.current.contains(target)) {
                setShowMoreMenu(false);
            }
            if (showFilterMenu && filterMenuRef.current && !filterMenuRef.current.contains(target)) {
                setShowFilterMenu(false);
            }
            if (isSearchOpen && searchRef.current && !searchRef.current.contains(target)) {
                setIsSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [showMoreMenu, showFilterMenu, isSearchOpen]);

    useEffect(() => {
        return () => {
            if (queueAddedTimeoutRef.current) clearTimeout(queueAddedTimeoutRef.current);
        };
    }, []);

    const handleAddVisibleToQueue = () => {
        addSongsToQueue(visibleSongIds);
        setQueueAdded(true);
        if (queueAddedTimeoutRef.current) clearTimeout(queueAddedTimeoutRef.current);
        queueAddedTimeoutRef.current = setTimeout(() => setQueueAdded(false), 1400);
    };

    const headerCell = (label: string, key?: SongListSortKey, enabled = true, align: 'left' | 'center' = 'center') => {
        const active = key && viewConfig.sortKey === key;
        return (
            <button
                type="button"
                disabled={!key || !enabled}
                onClick={() => key && enabled && setSort(key)}
                style={{
                    minWidth: 0,
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    background: 'transparent',
                    color: active ? '#fff' : '#888',
                    cursor: key && enabled ? 'pointer' : 'default',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: align === 'left' ? 'flex-start' : 'center',
                    gap: '4px',
                    padding: align === 'left' ? '0 0 0 8px' : 0,
                    overflow: 'hidden',
                }}
                title={key ? `依${label}排序` : undefined}
            >
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                {key && enabled && (
                    <span style={{ flexShrink: 0, color: active ? '#fff' : '#555', fontSize: active ? '12px' : '11px' }}>
                        {active ? (viewConfig.sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                )}
            </button>
        );
    };

    if (songs.length === 0) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
                {emptyMessage}
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <style>{searchAnimationStyle}</style>
            <div style={{ flexShrink: 0, paddingTop: '2px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <button
                        type="button"
                        disabled={visibleSongIds.length === 0}
                        onClick={() => playVisibleList(visibleSongIds, 0)}
                        style={primaryButtonStyle(visibleSongIds.length > 0)}
                        onMouseEnter={(e) => applyActionButtonHover(e.currentTarget, visibleSongIds.length > 0)}
                        onMouseLeave={(e) => clearActionButtonHover(e.currentTarget)}
                    >
                        <img src={PlayIcon} alt="" style={{ width: '14px', height: '14px', filter: visibleSongIds.length ? 'brightness(0)' : undefined }} />
                        播放顯示清單
                    </button>
                    <button
                        type="button"
                        disabled={visibleSongIds.length === 0}
                        onClick={handleAddVisibleToQueue}
                        style={secondaryButtonStyle(visibleSongIds.length > 0)}
                        onMouseEnter={(e) => applyActionButtonHover(e.currentTarget, visibleSongIds.length > 0)}
                        onMouseLeave={(e) => clearActionButtonHover(e.currentTarget)}
                    >
                        <img src={queueAdded ? CheckIcon : QueueAddIcon} alt="" style={{ width: '16px', height: '16px', filter: iconFilter, opacity: visibleSongIds.length ? 0.9 : 0.35 }} />
                        {queueAdded ? '已加入' : '加入佇列'}
                    </button>

                    <div ref={moreMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
                        <IconButton
                            icon={MoreIcon}
                            title="更多清單操作"
                            active={showMoreMenu}
                            onClick={() => setShowMoreMenu(prev => !prev)}
                        />
                        {showMoreMenu && (
                            <div style={menuPanelStyle('left')}>
                                <button
                                    type="button"
                                    disabled={visibleSongIds.length === 0}
                                    onClick={shuffleVisible}
                                    style={menuButtonStyle(false, visibleSongIds.length === 0)}
                                    onMouseEnter={(e) => applyMenuHover(e.currentTarget, visibleSongIds.length === 0)}
                                    onMouseLeave={(e) => clearMenuHover(e.currentTarget)}
                                >
                                    <img src={ModeRandomIcon} alt="" style={menuIconStyle} />
                                    隨機播放顯示清單
                                </button>
                                <button
                                    type="button"
                                    disabled={visibleSongIds.length === 0}
                                    onClick={replaceQueueAndPlay}
                                    style={menuButtonStyle(false, visibleSongIds.length === 0)}
                                    onMouseEnter={(e) => applyMenuHover(e.currentTarget, visibleSongIds.length === 0)}
                                    onMouseLeave={(e) => clearMenuHover(e.currentTarget)}
                                >
                                    <img src={PlaylistIcon} alt="" style={menuIconStyle} />
                                    取代目前佇列並播放
                                </button>
                                {moreActions.map(action => (
                                    <button
                                        key={action.label}
                                        type="button"
                                        onClick={() => {
                                            action.onClick();
                                            setShowMoreMenu(false);
                                        }}
                                        style={menuButtonStyle(Boolean(action.danger), false)}
                                        onMouseEnter={(e) => applyMenuHover(e.currentTarget, false, Boolean(action.danger))}
                                        onMouseLeave={(e) => clearMenuHover(e.currentTarget)}
                                    >
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }} />
                    <span style={{ color: '#888', fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {isFiltered ? `顯示 ${visibleSongs.length} / ${songs.length} 首` : `共 ${songs.length} 首`}
                    </span>

                    <div ref={searchRef} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {isSearchOpen || hasActiveSearch ? (
                            <div
                                style={{
                                    position: 'relative',
                                    width: '230px',
                                    animation: 'songListSearchExpand 0.18s ease-out',
                                    transformOrigin: 'right center',
                                }}
                            >
                                <img src={SearchIcon} alt="" style={{ position: 'absolute', left: '11px', top: '9px', width: '15px', height: '15px', filter: iconFilter, opacity: 0.45 }} />
                                <input
                                    ref={searchInputRef}
                                    value={viewConfig.search}
                                    onChange={(event) => updateView({ search: event.target.value })}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Escape' && !viewConfig.search.trim()) setIsSearchOpen(false);
                                    }}
                                    placeholder="在此列表搜尋"
                                    style={searchInputStyle}
                                />
                            </div>
                        ) : (
                            <BareIconButton
                                icon={SearchIcon}
                                title="搜尋此列表"
                                onClick={() => setIsSearchOpen(true)}
                            />
                        )}
                        <div ref={filterMenuRef} style={{ position: 'relative' }}>
                            <BareIconButton
                                icon={FilterIcon}
                                title="篩選"
                                active={showFilterMenu || hasActiveFilters}
                                onClick={() => setShowFilterMenu(prev => !prev)}
                                showDot={hasActiveFilters}
                            />
                            {showFilterMenu && (
                                <div style={menuPanelStyle('right', 292)}>
                                    <div style={{ color: '#fff', fontSize: '13px', fontWeight: 800, padding: '4px 4px 10px' }}>篩選</div>
                                    <FilterSelect label="類型" value={filters.type} onChange={(value) => updateFilters({ type: value as SongListFilters['type'] })}>
                                        <option value="all">全部類型</option>
                                        <option value="原曲">原曲</option>
                                        <option value="伴奏">伴奏</option>
                                    </FilterSelect>
                                    <FilterSelect label="音訊狀態" value={filters.audio} onChange={(value) => updateFilters({ audio: value as SongListFilters['audio'] })}>
                                        {audioFilterOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </FilterSelect>
                                    <FilterSelect label="歌詞" value={filters.lyrics} onChange={(value) => updateFilters({ lyrics: value as SongListFilters['lyrics'] })}>
                                        {lyricsFilterOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </FilterSelect>
                                    <FilterSelect label="來源" value={filters.source} onChange={(value) => updateFilters({ source: value as SongListFilters['source'] })}>
                                        {sourceFilterOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </FilterSelect>
                                    <FilterSelect label="最愛" value={filters.favorite} onChange={(value) => updateFilters({ favorite: value as SongListFilters['favorite'] })}>
                                        {favoriteFilterOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </FilterSelect>
                                    {filterChips.length > 0 && (
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '8px 2px 2px' }}>
                                            {filterChips.map(chip => (
                                                <button key={chip.key} type="button" onClick={chip.clear} style={chipStyle} title="點擊清除此條件">
                                                    {chip.label} ×
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <button type="button" onClick={clearFilters} style={{ ...chipResetStyle, width: '100%', marginTop: '10px' }}>
                                        清除篩選
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div style={headerStyle}>
                <div></div>
                {headerCell('標題 / 歌手', 'title', true, 'left')}
                {headerCell('最愛', 'favorite')}
                <div></div>
                {showType ? headerCell('類型', 'type') : <div />}
                {showAudioStatus ? headerCell('音訊狀態', 'audio') : <div />}
                {showLyricStatus ? headerCell('歌詞', 'lyrics') : <div />}
                {showDuration ? headerCell('時長', 'duration') : <div />}
            </div>

            {visibleSongs.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
                    沒有符合條件的歌曲
                    <div style={{ marginTop: '12px' }}>
                        <button type="button" onClick={resetView} style={chipResetStyle}>清除篩選</button>
                    </div>
                </div>
            ) : (
                <div style={{ flex: 1, minHeight: 0 }}>
                    <Virtuoso
                        style={{ height: '100%', overflowY: 'scroll', overflowX: 'hidden' }}
                        totalCount={visibleSongs.length}
                        computeItemKey={(index) => visibleSongs[index]?.id ?? index}
                        components={{ Footer: () => <div style={{ height: '120px' }} /> }}
                        itemContent={(index) => {
                            const song = visibleSongs[index];
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
                                    playContextSongIds={visibleSongIds}
                                    playContextIndex={index}
                                />
                            );
                        }}
                    />
                </div>
            )}
        </div>
    );
};

const BareIconButton: React.FC<{ icon: string; title: string; active?: boolean; showDot?: boolean; onClick: () => void }> = ({ icon, title, active, showDot, onClick }) => {
    const [hovered, setHovered] = useState(false);
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                width: '34px',
                height: '34px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                padding: 0,
                opacity: active || hovered ? 1 : 0.48,
                transition: 'opacity 0.16s ease, transform 0.16s ease',
                transform: hovered ? 'scale(1.06)' : 'scale(1)',
            }}
        >
            <img src={icon} alt="" style={{ width: '18px', height: '18px', filter: iconFilter }} />
            {showDot && <span style={activeDotStyle} />}
        </button>
    );
};

const IconButton: React.FC<{ icon: string; title: string; active?: boolean; showDot?: boolean; onClick: () => void }> = ({ icon, title, active, showDot, onClick }) => (
    <button type="button" onClick={onClick} title={title} style={iconButtonStyle(Boolean(active))}>
        <img src={icon} alt="" style={{ width: '17px', height: '17px', filter: iconFilter, opacity: active ? 1 : 0.78 }} />
        {showDot && <span style={activeDotStyle} />}
    </button>
);

const FilterSelect: React.FC<{ label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }> = ({ label, value, onChange, children }) => (
    <label style={{ display: 'grid', gridTemplateColumns: '76px minmax(0, 1fr)', alignItems: 'center', gap: '10px', padding: '6px 4px' }}>
        <span style={{ color: '#aaa', fontSize: '12px' }}>{label}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)} style={selectStyle}>
            {children}
        </select>
    </label>
);

const primaryButtonStyle = (enabled: boolean): React.CSSProperties => ({
    height: '34px',
    padding: '0 14px',
    borderRadius: '6px',
    border: 'none',
    background: enabled ? 'var(--accent-color)' : '#333',
    color: enabled ? '#000' : '#777',
    fontWeight: 800,
    cursor: enabled ? 'pointer' : 'not-allowed',
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    flexShrink: 0,
    transition: 'transform 0.16s ease',
});

const secondaryButtonStyle = (enabled: boolean): React.CSSProperties => ({
    height: '34px',
    padding: '0 12px',
    borderRadius: '6px',
    border: '1px solid #444',
    background: '#242424',
    color: enabled ? '#fff' : '#777',
    cursor: enabled ? 'pointer' : 'not-allowed',
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    flexShrink: 0,
    transition: 'transform 0.16s ease',
});

const applyActionButtonHover = (button: HTMLButtonElement, enabled: boolean) => {
    if (!enabled) return;
    button.style.transform = 'translateY(-1px)';
};

const clearActionButtonHover = (button: HTMLButtonElement) => {
    button.style.transform = 'translateY(0)';
};

const iconButtonStyle = (active: boolean): React.CSSProperties => ({
    width: '34px',
    height: '34px',
    borderRadius: '8px',
    border: `1px solid ${active ? 'var(--accent-color)' : '#444'}`,
    background: active ? 'rgba(255,255,255,0.09)' : '#242424',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
});

const activeDotStyle: React.CSSProperties = {
    position: 'absolute',
    right: '5px',
    top: '5px',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--accent-color)',
};

const searchInputStyle: React.CSSProperties = {
    width: '100%',
    height: '34px',
    borderRadius: '17px',
    border: '1px solid #3f3f3f',
    background: '#202020',
    color: '#fff',
    padding: '0 10px 0 34px',
    outline: 'none',
    boxSizing: 'border-box',
};

const headerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: SONG_TABLE_GRID,
    padding: SONG_TABLE_HEADER_PADDING,
    borderBottom: '1px solid #333',
    color: '#888',
    fontSize: '12px',
    fontWeight: 600,
    backgroundColor: '#1a1a1a',
    zIndex: 1,
    flexShrink: 0,
};

const searchAnimationStyle = `
@keyframes songListSearchExpand {
    from { width: 34px; opacity: 0.45; transform: scaleX(0.55); }
    to { width: 230px; opacity: 1; transform: scaleX(1); }
}
`;

const selectStyle: React.CSSProperties = {
    height: '30px',
    borderRadius: '6px',
    border: '1px solid #3f3f3f',
    background: '#202020',
    color: '#ddd',
    fontSize: '12px',
    padding: '0 8px',
    outline: 'none',
    minWidth: 0,
};

const chipStyle: React.CSSProperties = {
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    color: '#ddd',
    borderRadius: '999px',
    padding: '4px 9px',
    cursor: 'pointer',
    fontSize: '12px',
    flexShrink: 0,
};

const chipResetStyle: React.CSSProperties = {
    border: '1px solid #444',
    background: '#2b2b2b',
    color: '#ccc',
    borderRadius: '999px',
    padding: '4px 10px',
    cursor: 'pointer',
    fontSize: '12px',
};

const menuPanelStyle = (align: 'left' | 'right', width = 190): React.CSSProperties => ({
    position: 'absolute',
    top: '40px',
    ...(align === 'right' ? { right: 0 } : { left: 0 }),
    width,
    background: '#282828',
    border: '1px solid #444',
    borderRadius: '8px',
    padding: '8px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
    zIndex: 20,
});

const menuButtonStyle = (danger: boolean, disabled: boolean): React.CSSProperties => ({
    width: '100%',
    border: 'none',
    background: 'transparent',
    color: disabled ? '#666' : danger ? '#ff8b8b' : '#ddd',
    cursor: disabled ? 'not-allowed' : 'pointer',
    textAlign: 'left',
    borderRadius: '5px',
    padding: '8px 10px',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'background-color 0.14s ease, color 0.14s ease',
});

const menuIconStyle: React.CSSProperties = {
    width: '15px',
    height: '15px',
    filter: iconFilter,
    opacity: 0.78,
    flexShrink: 0,
};

const applyMenuHover = (button: HTMLButtonElement, disabled: boolean, danger = false) => {
    if (disabled) return;
    button.style.backgroundColor = danger ? 'rgba(255, 139, 139, 0.12)' : 'rgba(255,255,255,0.08)';
};

const clearMenuHover = (button: HTMLButtonElement) => {
    button.style.backgroundColor = 'transparent';
};

export default SongList;
