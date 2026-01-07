import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueue } from '../contexts/QueueContext';

import { loadAllSongs, SongMeta } from '../library/songLibrary';
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

import LyricsSearchPane from './LyricsSearchPane';

import TapModeIcon from '../assets/icons/tap_mode.svg';
import SaveLrcIcon from '../assets/icons/save_lrc.svg';
import SmartAlignIcon from '../assets/icons/SmartAlign.svg';
import PlayIcon from '../assets/icons/play.svg';
import AddIcon from '../assets/icons/add.svg';
import DeleteIcon from '../assets/icons/delete.svg';

const SearchIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
);


interface LyricEditorViewProps {
    activeSongId?: string;
    initialSongId?: string | null;
    onSongSelectedChange?: (songId: string) => void;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    onPlayPause: () => void;
    onSeek: (seconds: number) => void;
    // Navigation Blocking Props
    pendingView: string | null;
    setIsDirty: (dirty: boolean) => void;
    onConfirmLeave: () => void;
    onCancelLeave: () => void;
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
    activeSongId,
    initialSongId,
    onSongSelectedChange,
    isPlaying,
    currentTime,
    duration,
    onPlayPause,
    onSeek,
    pendingView,
    setIsDirty,
    onConfirmLeave,
    onCancelLeave,
}) => {
    const [songs, setSongs] = useState<SongMeta[]>([]);
    const [loadingSongs, setLoadingSongs] = useState(false);
    const [loadingLyrics, setLoadingLyrics] = useState(false);
    const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [lines, setLines] = useState<EditableLyricLine[]>([]);
    const [rawTextDraft, setRawTextDraft] = useState('');
    const [lastSavedRawText, setLastSavedRawText] = useState('');
    const [tapIndex, setTapIndex] = useState(0);
    const [tapMode, setTapMode] = useState(true);

    const [headerTitle, setHeaderTitle] = useState('歌詞編輯');
    const headerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [showSearchPane, setShowSearchPane] = useState(false);

    // Smart Align State
    const [smartAlignStep, setSmartAlignStep] = useState<0 | 1 | 2>(0);
    // Snapshot of lines before any alignment (to revert on cancel)
    const [linesSnapshot, setLinesSnapshot] = useState<EditableLyricLine[]>([]);
    // We only need to store the start time set in Step 1
    const [smartAlignStartTime, setSmartAlignStartTime] = useState<number | null>(null);

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [savingRaw, setSavingRaw] = useState(false);
    const [savingLrc, setSavingLrc] = useState(false);
    const initialSelectDone = useRef(false);
    const lineRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const queue = useQueue();

    // UX Enhancements
    const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);
    const [originalLinesSnapshot, setOriginalLinesSnapshot] = useState<string>(JSON.stringify([]));

    // Round 2 Enhancements
    const [pendingSongId, setPendingSongId] = useState<string | null>(null);
    const [deleteConfirmLineId, setDeleteConfirmLineId] = useState<string | null>(null);
    const deleteConfirmTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Dirty Check State - Exposed for internal logic
    const [isDirtyInternal, setIsDirtyInternal] = useState(false);

    // Dirty Check Effect
    useEffect(() => {
        const currentSnapshot = JSON.stringify(lines.map(l => ({ text: l.text, timeSeconds: l.timeSeconds })));
        const isDirty = currentSnapshot !== originalLinesSnapshot;
        setIsDirty(isDirty);
        setIsDirtyInternal(isDirty);
    }, [lines, originalLinesSnapshot, setIsDirty]);

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
    }, [activeSongId]); // Only run when activeSongId changes, don't depend on selectedSongId to avoid loops or overriding user selection

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

            // Take snapshot for dirty check
            setOriginalLinesSnapshot(JSON.stringify(nextLines.map(l => ({ text: l.text, timeSeconds: l.timeSeconds }))));

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

    const performSongSelection = useCallback(async (songId: string) => {
        const song = songs.find(s => s.id === songId);
        if (!song) return;

        setSelectedSongId(songId);
        onSongSelectedChange?.(songId);
        setErrorMessage(null);
        setTapMode(true);
        setPendingSongId(null);
        setDeleteConfirmLineId(null); // Reset delete state

        try {
            // Use queue.loadImmediate to load but NOT play
            await queue.loadImmediate(songId);

            await loadLyricsForSong(song);
        } catch (err) {
            console.error('[Lyrics] Failed to load song for lyrics', songId, err);
            setErrorMessage('載入錯誤');
        }
    }, [songs, onSongSelectedChange, queue, loadLyricsForSong]);

    const handleSelectSong = useCallback(
        async (song: SongMeta) => {
            // Unsaved Changes Interception
            if (isDirtyInternal && song.id !== selectedSongId) {
                setPendingSongId(song.id);
                return;
            }
            // Proceed if not dirty or same song (or confirmed via modal logic below)
            performSongSelection(song.id);
        },
        [isDirtyInternal, selectedSongId, performSongSelection]
    );

    // Initial selection logic: Select active song if available, otherwise do nothing (show placeholder)
    useEffect(() => {
        if (initialSelectDone.current) return;
        if (!songs.length) return;

        // If there is an active song (playing or paused), select it.
        // If not, we leave selectedSongId as null.
        if (activeSongId) {
            const target = songs.find((s) => s.id === activeSongId);
            if (target) {
                initialSelectDone.current = true;
                // Just set ID and load lyrics, don't trigger audio load since it's already active
                setSelectedSongId(target.id);
                void loadLyricsForSong(target);
            }
        } else {
            // Mark as done so we don't keep trying
            initialSelectDone.current = true;
        }
    }, [activeSongId, songs, loadLyricsForSong]);

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

    // Auto-scroll logic (Standard)
    useEffect(() => {
        if (smartAlignStep > 0) return; // Disable standard auto-scroll in smart align
        if (currentLineIndex < 0) return;
        const line = lines[currentLineIndex];
        if (!line) return;
        const el = lineRefs.current[line.id];
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentLineIndex, lines, smartAlignStep]);

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

            // Auto-sync TXT file
            const rawText = lines.map(l => l.text).join('\n');
            await writeRawLyrics(selectedSongId, rawText);

            showTempMessage('已儲存 LRC (同步 TXT)');
            updateSongMetaInList({ ...result.meta, lyrics_status: 'synced' });

            // Update snapshot
            setOriginalLinesSnapshot(JSON.stringify(lines.map(l => ({ text: l.text, timeSeconds: l.timeSeconds }))));
            setLastSavedRawText(rawText);
        } catch (err) {
            console.error('[Lyrics] Failed to save synced lyrics', err);
            setErrorMessage('儲存失敗');
        } finally {
            setSavingLrc(false);
        }
    }, [lines, selectedSong, selectedSongId, updateSongMetaInList, showTempMessage]);

    const handleLyricsImport = useCallback(async (content: string, type: 'lrc' | 'txt') => {
        if (!selectedSongId || !selectedSong) return;

        // Check if current song has lyrics
        const hasExistingLyrics = selectedSong.lyrics_status !== 'none' || lines.length > 1 || (lines.length === 1 && lines[0].text.trim().length > 0);

        if (hasExistingLyrics) {
            if (!window.confirm('此歌曲已有歌詞，是否要覆蓋原本的歌詞檔案？')) {
                return;
            }
        }

        try {
            setLoadingLyrics(true);
            let result;
            if (type === 'lrc') {
                result = await writeSyncedLyrics(selectedSongId, content);
                updateSongMetaInList({ ...result.meta, lyrics_status: 'synced' });
                showTempMessage('已匯入 LRC');
            } else {
                result = await writeRawLyrics(selectedSongId, content);
                updateSongMetaInList({ ...result.meta, lyrics_status: 'text_only' });
                showTempMessage('已匯入純文字');
            }
            setShowSearchPane(false);

            // Reload lyrics
            await loadLyricsForSong(selectedSong);

        } catch (err) {
            console.error('[Lyrics] Failed to import lyrics', err);
            setErrorMessage('匯入失敗');
        } finally {
            setLoadingLyrics(false);
        }
    }, [selectedSongId, selectedSong, lines, updateSongMetaInList, showTempMessage, loadLyricsForSong]);

    // Smart Alignment Logic
    const startSmartAlign = useCallback(() => {
        if (!selectedSong) return;
        setLinesSnapshot(lines);
        setSmartAlignStep(1);
        setTapMode(false);

        // Find first valid line to scroll to
        const firstValidIdx = lines.findIndex(l => l.timeSeconds !== null);
        const targetIdx = firstValidIdx >= 0 ? firstValidIdx : 0;

        // Seek to it
        const targetTime = lines[targetIdx]?.timeSeconds ?? 0;
        onSeek(targetTime);

        // Force scroll with timeout to ensure UI is ready
        setTimeout(() => {
            const id = lines[targetIdx]?.id;
            if (id && lineRefs.current[id]) {
                lineRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);

    }, [lines, onSeek, selectedSong]);

    const cancelSmartAlign = useCallback(() => {
        setLines(linesSnapshot); // Revert
        setSmartAlignStep(0);
        setSmartAlignStartTime(null);
        setTapMode(true);
    }, [linesSnapshot]);

    const confirmSmartAlignStep1 = useCallback(() => {
        // 1. Find the Anchor (First Valid Line) in Snapshot
        // We look up valid index from snapshot to be consistent with how we determine "first"
        const firstValidIndex = linesSnapshot.findIndex(l => l.timeSeconds !== null);
        if (firstValidIndex === -1) {
            setErrorMessage("無法對齊：找不到任何有效的時間標記");
            return;
        }

        const firstLineSnap = linesSnapshot[firstValidIndex];
        const oldStartTime = firstLineSnap.timeSeconds!; // Safe due to check above

        // 2. Determine Start Time -> ALWAYS from the visual line
        // The user must set the time on the line itself (using 'Set to Current' or +/-)
        // The "Confirm" button just commits what is on screen.
        const currentLineTime = lines[firstValidIndex]?.timeSeconds;

        // Fallback to currentTime ONLY if for some reason the line time is null (shouldn't happen given valid index logic)
        const newStartTime = currentLineTime ?? currentTime;

        setSmartAlignStartTime(newStartTime);

        const offset = newStartTime - oldStartTime;

        // 3. Apply Offset Visually
        setLines(linesSnapshot.map(l => ({
            ...l,
            timeSeconds: l.timeSeconds !== null ? Math.max(0, l.timeSeconds + offset) : null
        })));

        setSmartAlignStep(2);

        // 4. Find Last Anchor for Step 2
        // Find last valid line
        let lastValidIndex = -1;
        for (let i = linesSnapshot.length - 1; i >= 0; i--) {
            if (linesSnapshot[i].timeSeconds !== null) {
                lastValidIndex = i;
                break;
            }
        }

        const lastLineSnap = linesSnapshot[lastValidIndex];

        // Auto seek to last line (shifted)
        if (lastLineSnap && lastLineSnap.timeSeconds !== null) {
            const newLastLineTime = Math.max(0, lastLineSnap.timeSeconds + offset);
            onSeek(newLastLineTime);

            // Imperative Scroll to Bottom Logic
            setTimeout(() => {
                const id = lastLineSnap.id;
                if (id && lineRefs.current[id]) {
                    lineRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        } else {
            onSeek(currentTime);
        }
    }, [currentTime, lines, linesSnapshot, onSeek]);


    const confirmSmartAlignStep2 = useCallback(() => {
        // Step 2: Set End (Stretch) and Apply Final
        if (smartAlignStartTime === null) return;

        // 1. Find Anchors in Snapshot
        const firstValidIndex = linesSnapshot.findIndex(l => l.timeSeconds !== null);
        let lastValidIndex = -1;
        for (let i = linesSnapshot.length - 1; i >= 0; i--) {
            if (linesSnapshot[i].timeSeconds !== null) {
                lastValidIndex = i;
                break;
            }
        }

        if (firstValidIndex === -1 || lastValidIndex === -1 || firstValidIndex >= lastValidIndex) {
            setErrorMessage('無法計算：時間軸標記不足或順序錯誤');
            setSmartAlignStep(0);
            return;
        }

        const firstLineOld = linesSnapshot[firstValidIndex];
        const lastLineOld = linesSnapshot[lastValidIndex];

        const oldStartTime = firstLineOld.timeSeconds!;
        const oldEndTime = lastLineOld.timeSeconds!;
        const oldDuration = oldEndTime - oldStartTime;



        // 2. Determine End Time -> ALWAYS from the visual line
        const currentLineTime = lines[lastValidIndex]?.timeSeconds;
        const newEndTime = currentLineTime ?? currentTime;

        const newDuration = newEndTime - smartAlignStartTime;

        if (oldDuration <= 0.1) {
            // Protect against zero division or extremely short songs
            setSmartAlignStep(0);
            return;
        }

        const ratio = newDuration / oldDuration;

        console.log('[SmartAlign] Applying', {
            oldStart: oldStartTime,
            oldEnd: oldEndTime,
            newStart: smartAlignStartTime,
            newEnd: newEndTime,
            ratio
        });

        // Apply Transform: t_new = t_new_start + (t_old - t_old_start) * ratio
        // This ensures the first line is exactly t_new_start
        setLines(linesSnapshot.map(line => {
            if (line.timeSeconds === null) return line;
            const offsetFromStart = line.timeSeconds - oldStartTime;
            const newTime = smartAlignStartTime + (offsetFromStart * ratio);
            return { ...line, timeSeconds: Math.max(0, newTime) };
        }));

        setSmartAlignStep(0);
        showTempMessage('智慧對齊完成');
        setTapMode(true);
    }, [currentTime, lines, linesSnapshot, smartAlignStartTime, showTempMessage]);


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
                                        onClick={() => smartAlignStep === 0 && handleSelectSong(song)}
                                        style={{
                                            padding: '8px',
                                            borderRadius: '8px',
                                            background: active ? '#1f1f1f' : '#161616',
                                            border: active ? '1px solid var(--accent-color)' : '1px solid #222',
                                            cursor: smartAlignStep > 0 ? 'not-allowed' : 'pointer',
                                            overflow: 'hidden',
                                            opacity: smartAlignStep > 0 && !active ? 0.3 : 1
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

            {/* Main Content Area */}
            {!selectedSong ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '14px' }}>
                    請從左側選擇歌曲
                </div>
            ) : (
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
                                <div
                                    title={selectedSong.title}
                                    style={{
                                        color: '#fff',
                                        fontSize: '18px',
                                        fontWeight: 800,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        width: '100%' // Ensure full width
                                    }}
                                >
                                    <div style={{
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        flex: 1, // Take remaining space
                                        minWidth: 0 // Allow shrinking below content size
                                    }}>
                                        {selectedSong.title}
                                    </div>
                                    <button
                                        onClick={() => setShowSearchPane(true)}
                                        title="搜尋歌詞"
                                        style={{
                                            flexShrink: 0, // Prevent shrinking
                                            background: 'transparent',
                                            border: 'none',
                                            color: smartAlignStep > 0 ? '#555' : 'var(--accent-color)',
                                            cursor: smartAlignStep > 0 ? 'not-allowed' : 'pointer',
                                            padding: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            opacity: 0.7,
                                            transition: 'opacity 0.2s',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                                    >
                                        {SearchIcon}
                                    </button>
                                </div>
                                <div
                                    title={`${selectedSong.artist || '未知歌手'} ・ ${selectedSong.type || '—'}`}
                                    style={{
                                        color: '#aaa',
                                        fontSize: '12px',
                                        marginTop: '2px',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}
                                >
                                    {selectedSong.artist || '未知歌手'} ・ {selectedSong.type || '—'}
                                </div>
                                <div style={{ color: '#aaa', fontSize: '12px', marginTop: '2px' }}>
                                    {selectedSong.lyrics_status === 'synced' ? '已對齊' : selectedSong.lyrics_status === 'text_only' ? '純文字' : '無'}
                                </div>
                            </div>

                            {/* Alignment Control / Smart Align Header */}
                            {smartAlignStep > 0 ? (
                                <div style={{ background: '#1e1e1e', borderRadius: '12px', border: '1px solid var(--accent-color)', padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div style={{ color: 'var(--accent-color)', fontWeight: 700, marginBottom: '8px', fontSize: '16px' }}>
                                        {smartAlignStep === 1 ? '智慧對齊 - 設定起始' : '智慧對齊 - 設定結束'}
                                    </div>
                                    <div style={{ color: '#ccc', fontSize: '13px', lineHeight: 1.5 }}>
                                        {smartAlignStep === 1
                                            ? '請將播放器移動到第一句歌詞的正確開始時間，然後點擊下方「設定起始」按鈕。'
                                            : '請將播放器移動到最後一句歌詞的正確開始時間，然後點擊下方「設定結束」按鈕。系統將自動調整中間所有歌詞的時間。'}
                                    </div>
                                </div>
                            ) : (
                                /* Alignment Control */
                                <div style={{ background: '#141414', borderRadius: '12px', border: '1px solid #222', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
                                    <div>
                                        <div style={{ color: '#fff', fontWeight: 700, marginBottom: '4px' }}>對齊控制</div>
                                        <div style={{ color: '#888', fontSize: '12px', lineHeight: 1.4 }}>
                                            開啟敲擊模式後，按下 J 鍵可將當前播放時間套用到下一行歌詞。
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleResetAlignment}
                                        style={{
                                            width: '100%',
                                            padding: '4px 0',
                                            background: '#3a1a1a',
                                            color: '#ff6b6b',
                                            border: '1px solid #5a2a2a',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            marginTop: '8px'
                                        }}
                                    >
                                        重設所有時間
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Right Column: Raw Text Block (Full Height) */}
                        <div style={{ background: '#141414', borderRadius: '12px', border: '1px solid #222', padding: '12px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ color: '#fff', fontWeight: 700 }}>歌詞文字</div>
                                    {/* Auto-save Badge */}
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
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={handleClearEmptyLines}
                                        style={{
                                            padding: '4px 8px',
                                            background: '#2a2a2a',
                                            color: '#aaa',
                                            border: '1px solid #333',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                        }}
                                    >
                                        清除空白
                                    </button>
                                    <button
                                        onClick={() => applyDraftToLines(false)}
                                        style={{
                                            padding: '4px 10px',
                                            background: '#2a2a2a',
                                            color: '#fff',
                                            border: '1px solid #333',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
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
                                    opacity: smartAlignStep > 0 ? 0.5 : 1,
                                    pointerEvents: smartAlignStep > 0 ? 'none' : 'auto'
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

                                    // Smart Align Visibility Logic
                                    let isDimmed = false;
                                    let showControls = false;

                                    if (smartAlignStep === 1) {
                                        // Show controls for first VALID line
                                        const firstValidIdx = lines.findIndex(l => l.timeSeconds !== null);
                                        const targetIdx = firstValidIdx >= 0 ? firstValidIdx : 0;
                                        if (idx === targetIdx) showControls = true;
                                        else isDimmed = true;
                                    } else if (smartAlignStep === 2) {
                                        // Show controls for last VALID line
                                        let lastValidIdx = -1;
                                        for (let i = lines.length - 1; i >= 0; i--) {
                                            if (lines[i].timeSeconds !== null) {
                                                lastValidIdx = i;
                                                break;
                                            }
                                        }
                                        if (lastValidIdx === -1) lastValidIdx = lines.length - 1;
                                        if (idx === lastValidIdx) showControls = true;
                                        else isDimmed = true;
                                    }

                                    if (showControls) {
                                        // Render Highlighted Control Row for Smart Align
                                        return (
                                            <div
                                                key={line.id}
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '40px 1fr auto', // Play, Text+Controls, Time
                                                    gap: '12px',
                                                    padding: '16px',
                                                    borderRadius: '12px',
                                                    background: '#2a2a2a',
                                                    border: '2px solid var(--accent-color)',
                                                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                                                    alignItems: 'center',
                                                    zIndex: 10
                                                }}
                                                ref={(el) => (lineRefs.current[line.id] = el)}
                                            >
                                                {/* Play Button */}
                                                <button
                                                    onClick={() => {
                                                        onSeek(line.timeSeconds ?? 0);
                                                        if (!isPlaying) onPlayPause();
                                                    }}
                                                    style={{
                                                        width: '48px', height: '48px', borderRadius: '50%',
                                                        background: 'var(--accent-color)', border: 'none',
                                                        color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <img src={PlayIcon} alt="Play" style={{ width: '18px', height: '18px', filter: 'brightness(0)' }} />
                                                </button>

                                                {/* Text and Time Controls */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <div style={{ color: '#fff', fontSize: '16px', fontWeight: 700 }}>{line.text}</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <button
                                                            onClick={() => adjustLineTime(idx, -0.1)}
                                                            style={{ padding: '4px 10px', background: '#333', border: '1px solid #444', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
                                                        >
                                                            -0.1s
                                                        </button>
                                                        <button
                                                            onClick={() => updateLineTime(idx, currentTime)}
                                                            style={{ padding: '4px 12px', background: 'var(--accent-color)', border: 'none', color: '#000', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                                                        >
                                                            設定為當前播放時間
                                                        </button>
                                                        <button
                                                            onClick={() => adjustLineTime(idx, 0.1)}
                                                            style={{ padding: '4px 10px', background: '#333', border: '1px solid #444', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
                                                        >
                                                            +0.1s
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Time Display */}
                                                <div style={{ fontSize: '20px', fontFamily: 'monospace', color: '#fff', fontWeight: 700 }}>
                                                    {formatDisplayTime(line.timeSeconds)}
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={line.id}
                                            ref={(el) => (lineRefs.current[line.id] = el)}
                                            onMouseEnter={() => setHoveredLineIndex(idx)}
                                            onMouseLeave={() => setHoveredLineIndex(null)}
                                            onClick={(e) => {
                                                if (smartAlignStep > 0) return; // Disable seek click in smart align
                                                const target = e.target as HTMLElement;
                                                if (target.tagName === 'INPUT' || target.tagName === 'BUTTON') return;
                                                if (line.timeSeconds !== null) {
                                                    onSeek(line.timeSeconds);
                                                }
                                            }}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '140px 1fr', // Reverted to 2 columns
                                                gap: '10px',
                                                padding: '10px',
                                                borderRadius: '10px',
                                                background: isCurrent ? '#1e1e1e' : '#151515',
                                                border: isCurrent ? '1px solid var(--accent-color)' : '1px solid #1f1f1f',
                                                cursor: (line.timeSeconds !== null && smartAlignStep === 0) ? 'pointer' : 'default',
                                                opacity: isDimmed ? 0.2 : 1,
                                                pointerEvents: isDimmed ? 'none' : 'auto',
                                                transition: 'opacity 0.3s'
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
                                            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                                                {/* Line 2: Instruction & Icons Row */}
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between', // Push instruction to left, icons to right
                                                    alignItems: 'center',
                                                    height: '24px', // Fixed height
                                                    opacity: hoveredLineIndex === idx || deleteConfirmLineId === line.id || (isNextTap && hoveredLineIndex === idx) ? 1 : (isNextTap ? 1 : 0),
                                                    // Show if hovered OR confirming delete OR isNextTap (for instruction). 
                                                    // But we only want 'isNextTap' text to be visible always? 
                                                    // User requirement: "display in the same line". 
                                                    // If we hide the container, instruction hides.
                                                    // So opacity logic needs to be per-item or container always visible if isNextTap?
                                                    // Let's make container visible if isNextTap is true, but icons only if hovered.
                                                    transition: 'opacity 0.2s',
                                                    marginTop: '4px'
                                                }}>
                                                    {/* Left: Instruction */}
                                                    <div style={{ flex: 1 }}>
                                                        {isNextTap && (
                                                            <div style={{ color: '#f0c36b', fontSize: '12px' }}>下一次敲擊會套用到此行</div>
                                                        )}
                                                    </div>

                                                    {/* Right: Icons */}
                                                    <div style={{
                                                        display: 'flex',
                                                        gap: '8px',
                                                        opacity: hoveredLineIndex === idx || deleteConfirmLineId === line.id ? 1 : 0,
                                                        pointerEvents: hoveredLineIndex === idx || deleteConfirmLineId === line.id ? 'auto' : 'none',
                                                        transition: 'opacity 0.2s',
                                                    }}>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const newLines = [...lines];
                                                                newLines.splice(idx + 1, 0, { id: `line-${Date.now()}`, text: '', timeSeconds: null });
                                                                setLines(newLines);
                                                            }}
                                                            style={{
                                                                padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center',
                                                                borderRadius: '4px',
                                                                transition: 'opacity 0.2s',
                                                                opacity: 0.6 // Initial opacity
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                                                            title="向下新增一行"
                                                        >
                                                            <img src={AddIcon} style={{ width: '16px', height: '16px' }} />
                                                        </button>

                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (deleteConfirmLineId === line.id) {
                                                                    // Confirmed Delete
                                                                    const newLines = [...lines];
                                                                    newLines.splice(idx, 1);
                                                                    setLines(newLines);
                                                                    setDeleteConfirmLineId(null);
                                                                    if (deleteConfirmTimeoutRef.current) clearTimeout(deleteConfirmTimeoutRef.current);
                                                                } else {
                                                                    // First Click
                                                                    setDeleteConfirmLineId(line.id);
                                                                    if (deleteConfirmTimeoutRef.current) clearTimeout(deleteConfirmTimeoutRef.current);
                                                                    deleteConfirmTimeoutRef.current = setTimeout(() => {
                                                                        setDeleteConfirmLineId(null);
                                                                    }, 3000); // 3s timeout
                                                                }
                                                            }}
                                                            style={{
                                                                padding: '4px 8px',
                                                                background: 'transparent', // No background change
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center',
                                                                color: deleteConfirmLineId === line.id ? '#ff4444' : '#ffffff', // White for trash icon, Red for text
                                                                fontSize: '12px',
                                                                fontWeight: 600,
                                                                transition: 'all 0.2s',
                                                                opacity: deleteConfirmLineId === line.id ? 1 : 0.6 // Full opacity for confirm, partial for trash
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.opacity = '1';
                                                                if (deleteConfirmLineId === line.id) {
                                                                    e.currentTarget.style.color = '#ff6666'; // Brighter red
                                                                }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.opacity = deleteConfirmLineId === line.id ? '1' : '0.6';
                                                                if (deleteConfirmLineId === line.id) {
                                                                    e.currentTarget.style.color = '#ff4444'; // Normal red
                                                                }
                                                            }}
                                                            title={deleteConfirmLineId === line.id ? "再次點擊以刪除" : "刪除"}
                                                        >
                                                            {deleteConfirmLineId === line.id ? (
                                                                <span>確認？</span>
                                                            ) : (
                                                                <img src={DeleteIcon} style={{ width: '16px', height: '16px' }} />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
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

                        {/* Center: Tap Button / Smart Align Action */}
                        <div style={{
                            position: 'absolute',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            display: 'flex',
                            alignItems: 'center'
                        }}>
                            {/* Toggle (Absolute relative to this centered container) - Hidden in Smart Align */}
                            {smartAlignStep === 0 && (
                                <div style={{
                                    position: 'absolute',
                                    right: '100%',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    paddingRight: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
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
                                            padding: '2px 6px',
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
                            )}

                            {/* Smart Align Icon - Moved to Right of Tap Button */}
                            {smartAlignStep === 0 && lines.length > 1 && (
                                <div style={{
                                    position: 'absolute',
                                    left: '100%',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    paddingLeft: '12px',
                                }}>
                                    <button
                                        onClick={startSmartAlign}
                                        style={{
                                            background: 'transparent',
                                            border: '1px solid #333',
                                            borderRadius: '8px',
                                            padding: '2px 12px', /* Increased horizontal padding */
                                            minWidth: '60px', /* Minimum width to ensure text fits */
                                            color: '#aaa',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s',
                                        }}
                                        title="智慧對齊：設定起始與結束時間，自動調整中間的歌詞"
                                        onMouseEnter={e => {
                                            e.currentTarget.style.color = '#fff';
                                            e.currentTarget.style.borderColor = '#666';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.color = '#aaa';
                                            e.currentTarget.style.borderColor = '#333';
                                        }}
                                    >
                                        <img src={SmartAlignIcon} alt="Smart Align" style={{ width: '20px', height: '20px' }} />
                                        <span style={{ fontSize: '9px', fontWeight: 600, marginTop: '2px', whiteSpace: 'nowrap' }}>智慧對齊</span>
                                    </button>
                                </div>
                            )}

                            {/* Big Action Button */}
                            {smartAlignStep === 0 ? (
                                <button
                                    onClick={handleTap}
                                    disabled={!tapMode || !selectedSong}
                                    style={{
                                        padding: '8px 32px',
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
                            ) : (
                                <button
                                    onClick={smartAlignStep === 1 ? confirmSmartAlignStep1 : confirmSmartAlignStep2}
                                    style={{
                                        padding: '8px 32px',
                                        background: 'var(--accent-color)',
                                        color: '#000',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        height: '40px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        boxShadow: '0 0 15px rgba(var(--accent-color-rgb), 0.4)'
                                    }}
                                >
                                    {smartAlignStep === 1 ? '設定起始 (Offset)' : '設定結束 (Scale)'}
                                </button>
                            )}
                        </div>

                        {/* Right: Save / Cancel Button */}
                        {smartAlignStep > 0 ? (
                            <button
                                onClick={cancelSmartAlign}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 16px',
                                    background: '#333',
                                    border: '1px solid #444',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: 600
                                }}
                            >
                                取消
                            </button>
                        ) : (
                            <button
                                onClick={handleSaveLrc}
                                disabled={savingLrc}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 16px',
                                    background: '#2a2a2a',
                                    border: '1px solid #333',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: 600
                                }}
                            >
                                <img src={SaveLrcIcon} alt="Save" style={{ width: '16px', height: '16px' }} />
                                {savingLrc ? '儲存中...' : '儲存 LRC'}
                            </button>
                        )}
                    </div>

                    {errorMessage && <div style={{ color: '#ff8b8b', fontSize: '13px' }}>{errorMessage}</div>}
                </div>
            )}

            {/* Unsaved Changes Modal */}
            {(pendingView || pendingSongId) && (
                <div
                    onClick={() => {
                        // Click outside to cancel
                        onCancelLeave();
                        setPendingSongId(null);
                    }}
                    style={{
                        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                        background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content
                        style={{
                            background: '#2a2a2a', padding: '20px', borderRadius: '12px',
                            border: '1px solid #444',
                            minWidth: '320px', // Reduced width
                            maxWidth: '90vw',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                            position: 'relative'
                        }}
                    >
                        {/* Cross Button */}
                        <button
                            onClick={() => {
                                onCancelLeave();
                                setPendingSongId(null);
                            }}
                            style={{
                                position: 'absolute', top: '12px', right: '12px',
                                background: 'transparent', border: 'none', color: '#888',
                                fontSize: '16px', cursor: 'pointer', padding: '4px'
                            }}
                        >
                            ✕
                        </button>

                        <h3 style={{ margin: '0 0 12px', color: '#fff', fontSize: '16px' }}>未儲存的變更</h3>
                        <p style={{ color: '#aaa', marginBottom: '20px', fontSize: '13px' }}>
                            {pendingSongId ? '切換歌曲' : '離開頁面'}將會導致未儲存的變更遺失。
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Left Aligned Cancel */}
                            <button
                                onClick={() => {
                                    onCancelLeave();
                                    setPendingSongId(null);
                                }}
                                style={{
                                    padding: '6px 12px', background: 'transparent', border: '1px solid #555',
                                    color: '#ccc', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                                    marginRight: 'auto' // Push other buttons to right
                                }}
                            >
                                取消
                            </button>

                            <button
                                onClick={() => {
                                    if (pendingSongId) {
                                        // Internal Switch - Don't Save
                                        setIsDirtyInternal(false); // Reset dirty so interceptor doesn't block again
                                        // Wait a tick for state update
                                        setTimeout(() => performSongSelection(pendingSongId), 0);
                                    } else {
                                        // External Navigation
                                        onConfirmLeave(); // App.tsx handles clearing dirty
                                    }
                                }}
                                style={{
                                    padding: '6px 12px', background: '#d32f2f', border: 'none',
                                    color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '13px'
                                }}
                            >
                                不儲存
                            </button>
                            <button
                                onClick={() => {
                                    handleSaveLrc().then(() => {
                                        if (pendingSongId) {
                                            // Internal Switch - Save Done
                                            setIsDirtyInternal(false);
                                            setTimeout(() => performSongSelection(pendingSongId), 0);
                                        } else {
                                            // External Navigation
                                            onConfirmLeave();
                                        }
                                    });
                                }}
                                style={{
                                    padding: '6px 12px', background: 'var(--accent-color)', border: 'none',
                                    color: '#000', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px'
                                }}
                            >
                                儲存並繼續
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSearchPane && selectedSong && (
                <LyricsSearchPane
                    isOpen={showSearchPane}
                    onClose={() => setShowSearchPane(false)}
                    initialQuery={`${selectedSong.title} ${selectedSong.artist || ''}`.trim()}
                    onSelect={handleLyricsImport}
                    mode="overlay"
                />
            )}
        </div>
    );
};

export default LyricEditorView;
