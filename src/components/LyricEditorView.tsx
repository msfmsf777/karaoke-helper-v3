import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import audioEngine from '../audio/AudioEngine';
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
  const [lines, setLines] = useState<EditableLyricLine[]>([]);
  const [rawTextDraft, setRawTextDraft] = useState('');
  const [tapIndex, setTapIndex] = useState(0);
  const [tapMode, setTapMode] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingRaw, setSavingRaw] = useState(false);
  const [savingLrc, setSavingLrc] = useState(false);
  const initialSelectDone = useRef(false);
  const lineRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const selectedSong = useMemo(() => songs.find((s) => s.id === selectedSongId) ?? null, [songs, selectedSongId]);

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
      if (synced?.content) {
        nextLines = parseLrc(synced.content);
        console.log('[Lyrics] Loaded synced LRC', { songId: song.id, path: synced.path });
      } else if (raw?.content) {
        nextLines = linesFromRawText(raw.content);
        console.log('[Lyrics] Loaded raw lyrics', { songId: song.id, path: raw.path });
      }
      if (nextLines.length === 0) {
        nextLines = [{ id: `line-${Date.now()}`, text: '', timeSeconds: null }];
      }
      setLines(nextLines);
      setRawTextDraft(nextLines.map((l) => l.text).join('\n'));
      setStatusMessage(
        synced
          ? `已載入 LRC：${synced.path}`
          : raw
          ? `已載入歌詞文字：${raw.path}`
          : '尚未有歌詞，請貼上歌詞文字。',
      );
    } catch (err) {
      console.error('[Lyrics] Failed to load lyrics', song.id, err);
      setErrorMessage('讀取歌詞檔案失敗，請確認檔案是否存在。');
      setLines([{ id: `line-${Date.now()}`, text: '', timeSeconds: null }]);
      setRawTextDraft('');
    } finally {
      setLoadingLyrics(false);
    }
  }, []);

  const handleSelectSong = useCallback(
    async (song: SongMeta) => {
      setSelectedSongId(song.id);
      onSongSelectedChange?.(song.id);
      setStatusMessage(null);
      setErrorMessage(null);
      setTapMode(true);
      setPlaybackRate(1);
      audioEngine.setPlaybackRate(1);

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
        setErrorMessage('載入歌曲或歌詞時發生錯誤，請稍後再試。');
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
      setStatusMessage(resetTimes ? '已套用文字，時間軸重設。' : '已套用文字到行列表。');
    },
    [rawTextDraft],
  );

  const updateLineText = useCallback((lineId: string, text: string) => {
    setLines((prev) => {
      const next = prev.map((line) => (line.id === lineId ? { ...line, text } : line));
      setRawTextDraft(next.map((l) => l.text).join('\n'));
      return next;
    });
  }, []);

  const adjustLineTime = useCallback((index: number, delta: number) => {
    setLines((prev) =>
      prev.map((line, idx) => {
        if (idx !== index || line.timeSeconds === null) return line;
        const nextTime = Math.max(0, line.timeSeconds + delta);
        console.log('[Lyrics] Adjust line time', { index, delta, nextTime, text: line.text });
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
      if (event.code === 'Space') {
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
    if (isPlaying) {
      onPlayPause();
    }
    onSeek(0);
    setLines((prev) => prev.map((line) => ({ ...line, timeSeconds: null })));
    setTapIndex(0);
    setStatusMessage('已重置時間標記，從頭開始敲擊。');
  }, [isPlaying, onPlayPause, onSeek]);

  const handleSaveRawLyrics = useCallback(async () => {
    if (!selectedSongId) return;
    setSavingRaw(true);
    setErrorMessage(null);
    try {
      const result = await writeRawLyrics(selectedSongId, rawTextDraft);
      setStatusMessage(`已儲存歌詞文字：${result.path}`);
      updateSongMetaInList(result.meta);
      applyDraftToLines(false);
    } catch (err) {
      console.error('[Lyrics] Failed to save raw lyrics', err);
      setErrorMessage('儲存歌詞文字失敗，請確認磁碟權限。');
    } finally {
      setSavingRaw(false);
    }
  }, [applyDraftToLines, rawTextDraft, selectedSongId, updateSongMetaInList]);

  const handleSaveLrc = useCallback(async () => {
    if (!selectedSongId || !selectedSong) return;
    const hasTimed = lines.some((line) => line.timeSeconds !== null);
    if (!hasTimed) {
      setErrorMessage('請先使用敲擊模式為歌詞添加時間標記。');
      return;
    }
    setSavingLrc(true);
    setErrorMessage(null);
    try {
      const lrcText = formatLrc(lines, { title: selectedSong.title, artist: selectedSong.artist });
      const result = await writeSyncedLyrics(selectedSongId, lrcText);
      setStatusMessage(`已儲存同步歌詞：${result.path}`);
      updateSongMetaInList(result.meta);
    } catch (err) {
      console.error('[Lyrics] Failed to save synced lyrics', err);
      setErrorMessage('儲存 LRC 失敗，請重試。');
    } finally {
      setSavingLrc(false);
    }
  }, [lines, selectedSong, selectedSongId, updateSongMetaInList]);

  const currentLyricStatus = selectedSong?.lyrics_status;
  const lyricStatusLabel =
    currentLyricStatus === 'synced' ? '已對齊' : currentLyricStatus === 'text_only' ? '純文字' : '無';
  const tapDisplayIndex = lines.length ? tapIndex + 1 : 0;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div
        style={{
          width: '28%',
          borderRight: '1px solid #242424',
          background: '#131313',
          overflowY: 'auto',
          padding: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>歌曲列表</h2>
          <span style={{ color: '#888', fontSize: '12px' }}>{loadingSongs ? '載入中...' : `${songs.length} 首`}</span>
        </div>
        {songs.length === 0 ? (
          <div style={{ color: '#777', fontSize: '14px' }}>尚未有歌曲，請先到歌曲庫新增。</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {songs.map((song) => {
              const active = song.id === selectedSongId;
              const lyricLabel = song.lyrics_status === 'synced' ? '已對齊' : song.lyrics_status === 'text_only' ? '純文字' : '無';
              return (
                <div
                  key={song.id}
                  onClick={() => handleSelectSong(song)}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    background: active ? '#1f1f1f' : '#161616',
                    border: active ? '1px solid var(--accent-color)' : '1px solid #222',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ color: '#fff', fontWeight: 700, marginBottom: '4px' }}>{song.title}</div>
                  <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '6px' }}>
                    {song.artist || '未知歌手'} ・ {song.type}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', color: '#888' }}>
                    <span>音訊：{audioStatusLabels[song.audio_status] ?? song.audio_status}</span>
                    <span>歌詞：{lyricLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#999', fontSize: '12px' }}>歌詞編輯</div>
            <div style={{ color: '#fff', fontSize: '22px', fontWeight: 800 }}>
              {selectedSong ? selectedSong.title : '請選擇歌曲'}
            </div>
            <div style={{ color: '#aaa', fontSize: '13px', marginTop: '4px' }}>
              {selectedSong?.artist || '未知歌手'} ・ {selectedSong?.type || '—'} ・ 歌詞狀態：{lyricStatusLabel}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleSaveRawLyrics}
              disabled={!selectedSong || savingRaw}
              style={{
                padding: '10px 14px',
                background: '#2a2a2a',
                color: '#fff',
                border: '1px solid #3a3a3a',
                borderRadius: '10px',
                cursor: selectedSong ? 'pointer' : 'not-allowed',
              }}
            >
              {savingRaw ? '儲存中...' : '儲存歌詞文字'}
            </button>
            <button
              onClick={handleSaveLrc}
              disabled={!selectedSong || savingLrc}
              style={{
                padding: '10px 14px',
                background: 'var(--accent-color)',
                color: '#000',
                border: 'none',
                borderRadius: '10px',
                cursor: selectedSong ? 'pointer' : 'not-allowed',
                fontWeight: 800,
              }}
            >
              {savingLrc ? '儲存中...' : '儲存同步歌詞 (LRC)'}
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: '16px',
            minHeight: '180px',
          }}
        >
          <div style={{ background: '#141414', borderRadius: '12px', border: '1px solid #222', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ color: '#fff', fontWeight: 700 }}>歌詞文字</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => applyDraftToLines(false)}
                  disabled={!selectedSong}
                  style={{
                    padding: '6px 10px',
                    background: '#2a2a2a',
                    color: '#fff',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    cursor: selectedSong ? 'pointer' : 'not-allowed',
                  }}
                >
                  套用文字
                </button>
                <button
                  onClick={() => applyDraftToLines(true)}
                  disabled={!selectedSong}
                  style={{
                    padding: '6px 10px',
                    background: '#202020',
                    color: '#fff',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    cursor: selectedSong ? 'pointer' : 'not-allowed',
                  }}
                >
                  套用並重設時間
                </button>
              </div>
            </div>
            <textarea
              value={rawTextDraft}
              onChange={(e) => setRawTextDraft(e.target.value)}
              placeholder="一行一行輸入或貼上歌詞"
              rows={8}
              style={{
                width: '100%',
                background: '#0f0f0f',
                border: '1px solid #222',
                color: '#fff',
                borderRadius: '10px',
                padding: '10px',
                resize: 'vertical',
                fontSize: '14px',
                lineHeight: 1.5,
              }}
            />
          </div>

          <div style={{ background: '#141414', borderRadius: '12px', border: '1px solid #222', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ color: '#fff', fontWeight: 700 }}>對齊控制</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#aaa', fontSize: '12px' }}>
                <span>敲擊模式</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={tapMode} onChange={(e) => setTapMode(e.target.checked)} />
                  <span style={{ color: tapMode ? '#fff' : '#888' }}>{tapMode ? '開' : '關'}</span>
                </label>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                onClick={handleResetAlignment}
                disabled={!selectedSong}
                style={{
                  padding: '10px 12px',
                  background: '#222',
                  color: '#fff',
                  border: '1px solid #333',
                  borderRadius: '10px',
                  cursor: selectedSong ? 'pointer' : 'not-allowed',
                }}
              >
                開始重新對齊
              </button>
              <button
                onClick={handleTap}
                disabled={!selectedSong}
                style={{
                  padding: '10px 12px',
                  background: 'var(--accent-color)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 800,
                  cursor: selectedSong ? 'pointer' : 'not-allowed',
                }}
              >
                敲擊對齊（Space）
              </button>
            </div>
            <div style={{ marginTop: '10px', color: '#aaa', fontSize: '12px' }}>
              TapIndex: {tapDisplayIndex}/{lines.length} ・ 再次敲擊將套用當前播放時間
            </div>
          </div>
        </div>

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
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '120px 1fr',
                      gap: '10px',
                      padding: '10px',
                      borderRadius: '10px',
                      background: isCurrent ? '#1e1e1e' : '#151515',
                      border: isCurrent ? '1px solid var(--accent-color)' : '1px solid #1f1f1f',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                      <div style={{ minWidth: '70px', fontFamily: 'monospace' }}>{formatDisplayTime(line.timeSeconds)}</div>
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
                    <div>
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

        <div
          style={{
            background: '#121212',
            border: '1px solid #1f1f1f',
            borderRadius: '12px',
            padding: '12px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onPlayPause}
              disabled={!selectedSong}
              style={{
                padding: '10px 14px',
                background: 'var(--accent-color)',
                color: '#000',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 800,
                cursor: selectedSong ? 'pointer' : 'not-allowed',
              }}
            >
              {isPlaying ? '暫停' : '播放'}
            </button>
            <div style={{ color: '#fff' }}>{formatDisplayTime(currentTime)}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={Math.min(Math.max(currentTime, 0), duration || 0)}
              step={0.05}
              onChange={(e) => onSeek(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-color)' }}
            />
            <span style={{ color: '#aaa', fontSize: '12px' }}>{formatDisplayTime(duration || 0)}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
            <span style={{ color: '#aaa', fontSize: '12px' }}>速度</span>
            <input
              type="range"
              min={0.5}
              max={1.25}
              step={0.05}
              value={playbackRate}
              onChange={(e) => {
                const rate = Number(e.target.value);
                setPlaybackRate(rate);
                audioEngine.setPlaybackRate(rate);
              }}
              style={{ width: '160px', accentColor: 'var(--accent-color)' }}
            />
            <span style={{ color: '#fff', width: '48px' }}>{playbackRate.toFixed(2)}x</span>
          </div>
        </div>

        <div style={{ minHeight: '20px', color: '#a0d468', fontSize: '13px' }}>{statusMessage}</div>
        {errorMessage && <div style={{ color: '#ff8b8b', fontSize: '13px' }}>{errorMessage}</div>}
      </div>
    </div>
  );
};

export default LyricEditorView;
