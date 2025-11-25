import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getOriginalSongFilePath, getSongFilePath, loadAllSongs, SongMeta } from '../library/songLibrary';
import {
    EditableLyricLine,
    formatLrc,
    linesFromRawText,
    parseLrc,
    readRawLyrics,
    readSyncedLyrics,
    writeRawLyrics,
    writeSyncedLyrics,
} from '../library/lyrics';

import TapModeIcon from '../assets/icons/tap_mode.svg';
import SaveLrcIcon from '../assets/icons/save_lrc.svg';

interface LyricEditorViewProps {
    onSongLoad: (song: SongMeta, filePath: string) => Promise<void>;
    activeSongId?: string;
    initialSongId?: string | null;
    onSongSelectedChange?: (songId: string) => void;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    onPlayPause: () => void;
    onSeek: (seconds: number) => void;
}

const formatDisplayTime = (seconds: number | null) => {
    if (seconds === null || Number.isNaN(seconds)) return '--:--.--';
    const total = Math.max(0, seconds);
    const mins = Math.floor(total / 60)
        .toString()
        .padStart(2, '0');
    const secs = Math.floor(total % 60)
        .toString()
        .padStart(2, '0');
    const hundredths = Math.round((total - Math.floor(total)) * 100)
        .toString()
        .padStart(2, '0');
    return `${mins}:${secs}.${hundredths}`;
};

const audioStatusLabels: Record<SongMeta['audio_status'], string> = {
    original_only: '未分離',
    separation_pending: '等待分離',
    separating: '分離中',
    separation_failed: '分離失敗',
    separated: '已分離',
    ready: '未分離',
    missing: '未分離',
    error: '錯誤',
};

const LyricEditorView: React.FC<LyricEditorViewProps> = ({
    onSongLoad,
    activeSongId,
    initialSongId,
    onSongSelectedChange,
    isPlaying,
    currentTime,
    duration,
    onPlayPause,
    onSeek,
}) => {
    const [songs, setSongs] = useState<SongMeta[]>([]);
    const [loadingSongs, setLoadingSongs] = useState(false);
    const [loadingLyrics, setLoadingLyrics] = useState(false);
    const [selectedSongId, setSelectedSongId] = useState<string | null>(initialSongId ?? null);
    const [searchQuery, setSearchQuery] = useState('');
    const [lines, setLines] = useState<EditableLyricLine[]>([]);
    const [rawTextDraft, setRawTextDraft] = useState('');
    const [lastSavedRawText, setLastSavedRawText] = useState('');
    const [tapIndex, setTapIndex] = useState(0);
    const [tapMode, setTapMode] = useState(true);

    const [headerTitle, setHeaderTitle] = useState('歌詞編輯');
    const headerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [savingRaw, setSavingRaw] = useState(false);
    const [savingLrc, setSavingLrc] = useState(false);
    const initialSelectDone = useRef(false);
    const lineRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const selectedSong = useMemo(() => songs.find((s) => s.id === selectedSongId) ?? null, [songs, selectedSongId]);

    const showTempMessage = useCallback((msg: string) => {
        if (headerTimeoutRef.current) clearTimeout(headerTimeoutRef.current);
        setHeaderTitle(msg);
        headerTimeoutRef.current = setTimeout(() => {
            setHeaderTitle('歌詞編輯');
        }, 3000);
    }, []);

    const refreshSongs = useCallback(async () => {
        setLoadingSongs(true);
        try {
            const list = await loadAllSongs();
            setSongs(list);
            console.log('[Lyrics] Loaded songs for editor', list.length);
        } catch (err) {
            console.error('[Lyrics] Failed to load songs', err);
        } finally {
            setLoadingSongs(false);
        }
    }, []);

    useEffect(() => {
        refreshSongs();
    }, [refreshSongs]);

    useEffect(() => {
        if (initialSongId) {
            setSelectedSongId(initialSongId);
        }
    }, [initialSongId]);

    useEffect(() => {
        if (activeSongId && !selectedSongId) {
            setSelectedSongId(activeSongId);
        }
    }, [activeSongId, selectedSongId]);

    useEffect(() => {
        const idx = lines.findIndex((line) => line.timeSeconds === null);
        setTapIndex(idx === -1 ? lines.length : idx);
    }, [lines]);

    const updateSongMetaInList = useCallback((meta: SongMeta) => {
        setSongs((prev) => prev.map((s) => (s.id === meta.id ? meta : s)));
    }, []);

    const loadLyricsForSong = useCallback(async (song: SongMeta) => {
        setLoadingLyrics(true);
        setErrorMessage(null);
        try {
            const [synced, raw] = await Promise.all([readSyncedLyrics(song.id), readRawLyrics(song.id)]);
            let nextLines: EditableLyricLine[] = [];
            let computedStatus: SongMeta['lyrics_status'] = 'none';

            if (synced?.content) {
                nextLines = parseLrc(synced.content);
                computedStatus = 'synced';
                console.log('[Lyrics] Loaded synced LRC', { songId: song.id, path: synced.path });
            } else if (raw?.content) {
                nextLines = linesFromRawText(raw.content);
                if (raw.content.trim()) computedStatus = 'text_only';
                console.log('[Lyrics] Loaded raw lyrics', { songId: song.id, path: raw.path });
            }

            // Always update status based on what we found
            if (song.lyrics_status !== computedStatus) {
                updateSongMetaInList({ ...song, lyrics_status: computedStatus });
            }

            if (nextLines.length === 0) {
                nextLines = [{ id: `line-${Date.now()}`, text: '', timeSeconds: null }];
            }
            setLines(nextLines);
            setRawTextDraft(nextLines.map((l) => l.text).join('\n'));
            setLastSavedRawText(nextLines.map((l) => l.text).join('\n'));

            showTempMessage(synced ? '已載入 LRC' : raw ? '已載入純文字' : '無歌詞');

        } catch (err) {
            console.error('[Lyrics] Failed to load lyrics', song.id, err);
            setErrorMessage('讀取失敗');
            setLines([{ id: `line-${Date.now()}`, text: '', timeSeconds: null }]);
            setRawTextDraft('');
            setLastSavedRawText('');
        } finally {
            setLoadingLyrics(false);
        }
    }, [updateSongMetaInList, showTempMessage]);

    const handleSelectSong = useCallback(
        async (song: SongMeta) => {
            setSelectedSongId(song.id);
            onSongSelectedChange?.(song.id);
            setErrorMessage(null);
            setTapMode(true);

            try {
                const originalPath = (await getOriginalSongFilePath(song.id)) ?? (await getSongFilePath(song.id));
                if (originalPath) {
                    await onSongLoad(song, originalPath);
                } else {
                    console.warn('[Lyrics] No audio path found for song', song.id);
                }
                await loadLyricsForSong(song);
            } catch (err) {
                console.error('[Lyrics] Failed to load song for lyrics', song.id, err);
                setErrorMessage('載入錯誤');
            }
        },
        [loadLyricsForSong, onSongLoad, onSongSelectedChange],
    );

    useEffect(() => {
        if (initialSelectDone.current) return;
        if (!songs.length) return;
        const targetId = selectedSongId ?? initialSongId ?? songs[0]?.id;
        const target = targetId ? songs.find((s) => s.id === targetId) : null;
        if (target) {
            initialSelectDone.current = true;
            void handleSelectSong(target);
        }
    }, [handleSelectSong, initialSongId, selectedSongId, songs]);

    const applyDraftToLines = useCallback(
        (resetTimes = false) => {
            const normalized = rawTextDraft.replace(/\r\n/g, '\n');
            const texts = normalized.split('\n');
            setLines((prev) =>
                texts.map((text, idx) => ({
                    id: prev[idx]?.id ?? `line-${Date.now()}-${idx}`,
                    text,
                    timeSeconds: resetTimes ? null : prev[idx]?.timeSeconds ?? null,
                })),
            );
            showTempMessage(resetTimes ? '已套用並重設' : '已套用文字');
        },
        [rawTextDraft, showTempMessage],
    );

    const updateLineText = useCallback((lineId: string, text: string) => {
        setLines((prev) => {
            const next = prev.map((line) => (line.id === lineId ? { ...line, text } : line));
            setRawTextDraft(next.map((l) => l.text).join('\n'));
            return next;
        });
    }, []);

    const updateLineTime = useCallback((index: number, time: number | null) => {
        setLines((prev) =>
            prev.map((line, idx) => {
                if (idx !== index) return line;
                return { ...line, timeSeconds: time };
            }),
        );
    }, []);

    const adjustLineTime = useCallback((index: number, delta: number) => {
        setLines((prev) =>
            prev.map((line, idx) => {
                if (idx !== index || line.timeSeconds === null) return line;
                const nextTime = Math.max(0, line.timeSeconds + delta);
                return { ...line, timeSeconds: nextTime };
            }),
        );
    }, []);

    const handleTap = useCallback(() => {
        if (!selectedSongId) return;
        if (tapIndex >= lines.length) {
            console.log('[Lyrics] Tap ignored: all lines aligned');
            return;
        }
        const timestamp = currentTime;
        setLines((prev) =>
            prev.map((line, idx) => (idx === tapIndex ? { ...line, timeSeconds: timestamp } : line)),
        );
        setTapIndex((idx) => Math.min(idx + 1, lines.length));
        console.log('[Lyrics] Tap captured', { lineIndex: tapIndex, time: timestamp, text: lines[tapIndex]?.text });
    }, [currentTime, lines, selectedSongId, tapIndex]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!tapMode) return;
            // Changed from Space to KeyJ
            if (event.code === 'KeyJ') {
                const target = event.target as HTMLElement | null;
                if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                    return;
                }
                event.preventDefault();
                handleTap();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [handleTap, tapMode]);

    const currentLineIndex = useMemo(() => {
        if (lines.length === 0) return -1;
        let idx = -1;
        for (let i = 0; i < lines.length; i++) {
            const t = lines[i].timeSeconds;
            if (t !== null && t <= currentTime) {
                idx = i;
            }
        }
        if (idx !== -1) return idx;
        const firstTimed = lines.findIndex((l) => l.timeSeconds !== null);
        if (firstTimed !== -1) return firstTimed;
        const firstUntimed = lines.findIndex((l) => l.timeSeconds === null);
        return firstUntimed;
    }, [currentTime, lines]);

    useEffect(() => {
        if (currentLineIndex < 0) return;
        const line = lines[currentLineIndex];
        if (!line) return;
        const el = lineRefs.current[line.id];
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentLineIndex, lines]);

    const handleResetAlignment = useCallback(() => {
        if (!window.confirm('確定要重設所有時間標記嗎？此動作無法復原。')) return;
        if (isPlaying) {
            onPlayPause();
        }
        onSeek(0);
        setLines((prev) => prev.map((line) => ({ ...line, timeSeconds: null })));
        setTapIndex(0);
        showTempMessage('已重置時間');
    }, [isPlaying, onPlayPause, onSeek, showTempMessage]);

    const handleSaveRawLyrics = useCallback(async (isAuto = false) => {
        if (!selectedSongId) return;

        // Only save if content changed
        if (rawTextDraft === lastSavedRawText) return;

        setSavingRaw(true);
        if (!isAuto) setErrorMessage(null);
        try {
            const result = await writeRawLyrics(selectedSongId, rawTextDraft);
            // if (!isAuto) showTempMessage('已儲存純文字'); // Removed to avoid flashing

            let newStatus = result.meta.lyrics_status;
            if (selectedSong?.lyrics_status === 'synced') {
                newStatus = 'synced';
            } else if (rawTextDraft.trim().length > 0) {
                newStatus = 'text_only';
            } else {
                newStatus = 'none';
            }

            updateSongMetaInList({ ...result.meta, lyrics_status: newStatus });
            setLastSavedRawText(rawTextDraft);
        } catch (err) {
            console.error('[Lyrics] Failed to save raw lyrics', err);
            if (!isAuto) setErrorMessage('儲存失敗');
        } finally {
            setSavingRaw(false);
        }
    }, [rawTextDraft, lastSavedRawText, selectedSongId, updateSongMetaInList, selectedSong]);

    // Auto-save effect
    useEffect(() => {
        if (!selectedSongId || !rawTextDraft) return;
        const timer = setTimeout(() => {
            handleSaveRawLyrics(true);
        }, 1000);
        return () => clearTimeout(timer);
    }, [rawTextDraft, selectedSongId, handleSaveRawLyrics]);

    const handleClearEmptyLines = useCallback(() => {
        const normalized = rawTextDraft.replace(/\r\n/g, '\n');
        const nonEmpty = normalized
            .split('\n')
            .filter((line) => line.trim().length > 0)
            .join('\n');
        setRawTextDraft(nonEmpty);
        const texts = nonEmpty.split('\n');
        setLines(() => {
            return texts.map((text, idx) => ({
                id: `line-${Date.now()}-${idx}`,
                text,
                timeSeconds: null,
            }));
        });
        showTempMessage('已清除空白行');
    }, [rawTextDraft, showTempMessage]);

    const handleSaveLrc = useCallback(async () => {
        if (!selectedSongId || !selectedSong) return;
        const hasTimed = lines.some((line) => line.timeSeconds !== null);
        if (!hasTimed) {
            setErrorMessage('請先敲擊對齊');
            return;
        }
        setSavingLrc(true);
        setErrorMessage(null);
        try {
            const lrcText = formatLrc(lines, { title: selectedSong.title, artist: selectedSong.artist });
            const result = await writeSyncedLyrics(selectedSongId, lrcText);
            showTempMessage('已儲存 LRC');
            updateSongMetaInList({ ...result.meta, lyrics_status: 'synced' });
        } catch (err) {
            console.error('[Lyrics] Failed to save synced lyrics', err);
            setErrorMessage('儲存失敗');
        } finally {
            setSavingLrc(false);
        }
    }, [lines, selectedSong, selectedSongId, updateSongMetaInList, showTempMessage]);

    const isRawChanged = rawTextDraft !== lastSavedRawText;

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            <div
                style={{
                    width: '180px',
                    borderRight: '1px solid #242424',
                    background: '#131313',
                    overflowY: 'auto',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, color: '#fff', fontSize: '16px' }}>歌曲列表</h2>
                    <span style={{ color: '#888', fontSize: '11px' }}>{loadingSongs ? '...' : `${songs.length}`}</span>
                </div>

                <input
                    type="text"
                    placeholder="搜尋..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #333',
                        background: '#1a1a1a',
                        color: '#fff',
                        fontSize: '12px',
                        boxSizing: 'border-box',
                    }}
                />

                {songs.length === 0 ? (
                    <div style={{ color: '#777', fontSize: '12px' }}>無歌曲</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {songs
                            .filter(
                                (s) =>
                                    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    (s.artist && s.artist.toLowerCase().includes(searchQuery.toLowerCase())),
                            )
                            .map((song) => {
                                const active = song.id === selectedSongId;
                                const lyricLabel =
                                    song.lyrics_status === 'synced' ? '已對齊' : song.lyrics_status === 'text_only' ? '純文字' : '無';
                                return (
                                    <div
                                        key={song.id}
                                        onClick={() => handleSelectSong(song)}
                                        style={{
                                            padding: '8px',
                                            borderRadius: '8px',
                                            background: active ? '#1f1f1f' : '#161616',
                                            border: active ? '1px solid var(--accent-color)' : '1px solid #222',
                                            cursor: 'pointer',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <div
                                            title={song.title}
                                            style={{
                                                color: '#fff',
                                                fontWeight: 700,
                                                marginBottom: '2px',
                                                fontSize: '13px',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}
                                        >
                                            {song.title}
                                        </div>
                                        <div
                                            title={`${song.artist || '未知'} ・ ${song.type}`}
                                            style={{
                                                color: '#aaa',
                                                fontSize: '11px',
                                                marginBottom: '4px',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}
                                        >
                                            {song.artist || '未知'} ・ {song.type}
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                                            <span>{audioStatusLabels[song.audio_status] ?? song.audio_status}</span>
                                            <span>| {lyricLabel}</span>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                )}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '15px', gap: '10px' }}>

                {/* Main Content Grid with 2 Columns */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '260px 1fr',
                        gap: '16px',
                        height: '230px', // Fixed height restored to ensure gap
                        flexShrink: 0,
                    }}
                >
                    {/* Left Column: Header Info + Alignment Control */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                        {/* Header Info */}
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '50px' }}>
                            <div style={{ fontSize: '12px', transition: 'color 0.2s', color: headerTitle === '歌詞編輯' ? '#999' : 'var(--accent-color)' }}>
                                {headerTitle}
                            </div>
                            <div style={{ color: '#fff', fontSize: '18px', fontWeight: 800 }}>
                                {selectedSong ? selectedSong.title : '請選擇歌曲'}
                            </div>
                            <div style={{ color: '#aaa', fontSize: '12px', marginTop: '2px' }}>
                                {selectedSong?.artist || '未知歌手'} ・ {selectedSong?.type || '—'}
                            </div>
                        </div>

                        {/* Alignment Control */}
                        <div style={{ background: '#141414', borderRadius: '12px', border: '1px solid #222', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
                            <div>
                                <div style={{ color: '#fff', fontWeight: 700, marginBottom: '4px' }}>對齊控制</div>
                                <div style={{ color: '#888', fontSize: '12px', lineHeight: 1.4 }}>
                                    開啟敲擊模式後，按下 J 鍵可將當前播放時間套用到下一行歌詞。
                                </div>
                            </div>

                            <button
                                onClick={handleResetAlignment}
                                disabled={!selectedSong}
                                style={{
                                    width: '100%',
                                    padding: '4px 0',
                                    background: '#3a1a1a',
                                    color: '#ff6b6b',
                                    border: '1px solid #5a2a2a',
                                    borderRadius: '6px',
                                    cursor: selectedSong ? 'pointer' : 'not-allowed',
                                    fontSize: '12px',
                                    marginTop: '8px'
                                }}
                            >
                                重設所有時間
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Raw Text Block (Full Height) */}
                    <div style={{ background: '#141414', borderRadius: '12px', border: '1px solid #222', padding: '12px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ color: '#fff', fontWeight: 700 }}>歌詞文字</div>
                                {/* Auto-save Badge */}
                                {selectedSong && (
                                    <div style={{
                                        fontSize: '10px',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: (savingRaw || isRawChanged) ? '#3a2a1a' : '#1a2a1a',
                                        color: (savingRaw || isRawChanged) ? '#ffcc00' : '#4caf50',
                                        border: `1px solid ${(savingRaw || isRawChanged) ? '#5a4a2a' : '#2a3a2a'}`
                                    }}>
                                        {(savingRaw || isRawChanged) ? '正在儲存...' : '已儲存'}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={handleClearEmptyLines}
                                    disabled={!selectedSong}
                                    style={{
                                        padding: '4px 8px',
                                        background: '#2a2a2a',
                                        color: '#aaa',
                                        border: '1px solid #333',
                                        borderRadius: '6px',
                                        cursor: selectedSong ? 'pointer' : 'not-allowed',
                                        fontSize: '12px',
                                    }}
                                >
                                    清除空白
                                </button>
                                <button
                                    onClick={() => applyDraftToLines(false)}
                                    disabled={!selectedSong}
                                    style={{
                                        padding: '4px 10px',
                                        background: '#2a2a2a',
                                        color: '#fff',
                                        border: '1px solid #333',
                                        borderRadius: '6px',
                                        cursor: selectedSong ? 'pointer' : 'not-allowed',
                                        fontSize: '12px',
                                    }}
                                >
                                    套用
                                </button>
                            </div>
                        </div>
                        <textarea
                            value={rawTextDraft}
                            onChange={(e) => setRawTextDraft(e.target.value)}
                            placeholder="輸入歌詞..."
                            style={{
                                flex: 1,
                                width: '100%',
                                background: '#0f0f0f',
                                border: '1px solid #222',
                                color: '#fff',
                                borderRadius: '8px',
                                padding: '8px',
                                resize: 'none',
                                fontSize: '13px',
                                lineHeight: 1.5,
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>
                </div>

                {/* Lyric Lines List */}
                <div
                    style={{
                        flex: 1,
                        background: '#0f0f0f',
                        borderRadius: '12px',
                        border: '1px solid #1f1f1f',
                        padding: '12px',
                        overflowY: 'auto',
                    }}
                >
                    {loadingLyrics ? (
                        <div style={{ color: '#b3b3b3' }}>載入歌詞中...</div>
                    ) : lines.length === 0 ? (
                        <div style={{ color: '#777' }}>尚未有歌詞，請先貼上並儲存歌詞文字。</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {lines.map((line, idx) => {
                                const isCurrent = idx === currentLineIndex;
                                const isNextTap = idx === tapIndex && tapMode;
                                return (
                                    <div
                                        key={line.id}
                                        ref={(el) => (lineRefs.current[line.id] = el)}
                                        onClick={(e) => {
                                            const target = e.target as HTMLElement;
                                            if (target.tagName === 'INPUT' || target.tagName === 'BUTTON') return;
                                            if (line.timeSeconds !== null) {
                                                onSeek(line.timeSeconds);
                                            }
                                        }}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '140px 1fr',
                                            gap: '10px',
                                            padding: '10px',
                                            borderRadius: '10px',
                                            background: isCurrent ? '#1e1e1e' : '#151515',
                                            border: isCurrent ? '1px solid var(--accent-color)' : '1px solid #1f1f1f',
                                            cursor: line.timeSeconds !== null ? 'pointer' : 'default',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                                <input
                                                    type="text"
                                                    defaultValue={formatDisplayTime(line.timeSeconds)}
                                                    key={line.timeSeconds} // Force re-render on time change
                                                    onBlur={(e) => {
                                                        const val = e.target.value.trim();
                                                        const parts = val.split(':');
                                                        let newTime = null;
                                                        if (parts.length === 2) {
                                                            const m = parseFloat(parts[0]);
                                                            const s = parseFloat(parts[1]);
                                                            if (!isNaN(m) && !isNaN(s)) newTime = m * 60 + s;
                                                        } else {
                                                            const s = parseFloat(val);
                                                            if (!isNaN(s)) newTime = s;
                                                        }
                                                        if (newTime !== null && newTime >= 0 && newTime <= duration) {
                                                            updateLineTime(idx, newTime);
                                                        } else {
                                                            e.target.value = formatDisplayTime(line.timeSeconds);
                                                        }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') e.currentTarget.blur();
                                                    }}
                                                    style={{
                                                        width: '80px', background: 'transparent', border: '1px solid #333',
                                                        color: '#fff', borderRadius: '4px', padding: '2px 4px', fontFamily: 'monospace', fontSize: '12px',
                                                        textAlign: 'center'
                                                    }}
                                                />
                                                <button
                                                    onClick={() => updateLineTime(idx, currentTime)}
                                                    style={{
                                                        padding: '2px 6px', background: '#2a2a2a', color: '#fff', border: '1px solid #333',
                                                        borderRadius: '4px', cursor: 'pointer', fontSize: '10px', width: '100%'
                                                    }}
                                                    title="套用目前播放時間"
                                                >
                                                    套用當前時間
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <button
                                                    onClick={() => adjustLineTime(idx, -0.05)}
                                                    disabled={line.timeSeconds === null}
                                                    style={{
                                                        padding: '4px 6px',
                                                        background: '#262626',
                                                        color: '#fff',
                                                        border: '1px solid #333',
                                                        borderRadius: '6px',
                                                        cursor: line.timeSeconds === null ? 'not-allowed' : 'pointer',
                                                        fontSize: '12px',
                                                    }}
                                                >
                                                    稍早
                                                </button>
                                                <button
                                                    onClick={() => adjustLineTime(idx, 0.05)}
                                                    disabled={line.timeSeconds === null}
                                                    style={{
                                                        padding: '4px 6px',
                                                        background: '#262626',
                                                        color: '#fff',
                                                        border: '1px solid #333',
                                                        borderRadius: '6px',
                                                        cursor: line.timeSeconds === null ? 'not-allowed' : 'pointer',
                                                        fontSize: '12px',
                                                    }}
                                                >
                                                    稍晚
                                                </button>
                                            </div>
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <input
                                                value={line.text}
                                                onChange={(e) => updateLineText(line.id, e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    background: 'transparent',
                                                    color: isCurrent ? '#fff' : '#ccc',
                                                    border: '1px solid #222',
                                                    borderRadius: '8px',
                                                    padding: '8px 10px',
                                                    boxSizing: 'border-box',
                                                }}
                                            />
                                            {isNextTap && (
                                                <div style={{ color: '#f0c36b', fontSize: '12px', marginTop: '4px' }}>下一次敲擊會套用到此行</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Bottom Control Bar */}
                <div
                    style={{
                        background: '#121212',
                        border: '1px solid #1f1f1f',
                        borderRadius: '12px',
                        padding: '8px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        position: 'relative' // For absolute centering
                    }}
                >
                    {/* Time Display (Current Only) */}
                    <div style={{ color: '#fff', fontSize: '16px', fontFamily: 'monospace', fontWeight: 700, minWidth: '80px' }}>
                        {formatDisplayTime(currentTime)}
                    </div>

                    {/* Center: Tap Button (Centered) and Toggle (Left of it) */}
                    <div style={{
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        alignItems: 'center'
                    }}>
                        {/* Toggle (Absolute relative to this centered container) */}
                        <div style={{
                            position: 'absolute',
                            right: '100%',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            paddingRight: '12px',
                            display: 'flex',
                            alignItems: 'center'
                        }}>
                            <div
                                onClick={() => setTapMode(p => !p)}
                                style={{
                                    cursor: 'pointer',
                                    color: tapMode ? 'var(--accent-color)' : '#444',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '2px 6px', // Smaller padding
                                    borderRadius: '8px',
                                    background: tapMode ? 'rgba(var(--accent-color-rgb), 0.1)' : 'transparent',
                                    transition: 'all 0.2s',
                                    border: tapMode ? '1px solid rgba(var(--accent-color-rgb), 0.3)' : '1px solid transparent',
                                    whiteSpace: 'nowrap'
                                }}
                                title="敲擊模式 (J)"
                            >
                                <img src={TapModeIcon} alt="Tap Mode" style={{ width: '20px', height: '20px', filter: tapMode ? 'none' : 'grayscale(100%) opacity(0.3)' }} />
                                <span style={{ fontSize: '9px', fontWeight: 600, marginTop: '2px' }}>敲擊模式</span>
                            </div>
                        </div>

                        {/* Big Tap Button */}
                        <button
                            onClick={handleTap}
                            disabled={!tapMode || !selectedSong}
                            style={{
                                padding: '8px 32px', // Wider
                                background: tapMode ? 'var(--accent-color)' : '#333',
                                color: tapMode ? '#000' : '#888',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 800,
                                cursor: tapMode ? 'pointer' : 'not-allowed',
                                transition: 'transform 0.1s',
                                opacity: tapMode ? 1 : 0.5,
                                height: '40px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <span>敲擊</span>
                            <span style={{
                                background: 'rgba(0,0,0,0.2)',
                                color: tapMode ? '#000' : '#888',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700
                            }}>J</span>
                        </button>
                    </div>

                    {/* Right: Save LRC */}
                    <div
                        onClick={handleSaveLrc}
                        style={{
                            cursor: selectedSong && !savingLrc ? 'pointer' : 'not-allowed',
                            opacity: selectedSong && !savingLrc ? 1 : 0.3,
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '8px',
                        }}
                        title="儲存同步歌詞 (LRC)"
                    >
                        <img src={SaveLrcIcon} alt="Save" style={{ width: '24px', height: '24px' }} />
                    </div>
                </div>

                {errorMessage && <div style={{ color: '#ff8b8b', fontSize: '13px' }}>{errorMessage}</div>}
            </div>
        </div>
    );
};

export default LyricEditorView;
