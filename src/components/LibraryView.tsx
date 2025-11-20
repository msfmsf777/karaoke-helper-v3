import React, { useEffect, useMemo, useState } from 'react';
import { addLocalSong, getSongFilePath, loadAllSongs, pickAudioFile, SongMeta, SongType } from '../library/songLibrary';
import { queueSeparationJob, subscribeJobUpdates } from '../jobs/separationJobs';

interface LibraryViewProps {
  onSongSelect: (song: SongMeta, filePath: string) => Promise<void>;
  selectedSongId?: string;
  onOpenLyrics?: (song: SongMeta) => void;
}

interface AddSongFormState {
  sourcePath: string;
  title: string;
  artist: string;
  type: SongType;
  lyricsMode: 'none' | 'paste';
  lyricsText: string;
}

const defaultForm: AddSongFormState = {
  sourcePath: '',
  title: '',
  artist: '',
  type: '原曲',
  lyricsMode: 'none',
  lyricsText: '',
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

const lyricsLabel = (status?: SongMeta['lyrics_status']) => {
  switch (status) {
    case 'text_only':
      return '純文字';
    case 'synced':
      return '已對齊';
    case 'none':
    default:
      return '無';
  }
};

const AddSongDialog: React.FC<{
  form: AddSongFormState;
  onChange: (next: Partial<AddSongFormState>) => void;
  onConfirm: () => void;
  onClose: () => void;
  busy: boolean;
  error?: string | null;
}> = ({ form, onChange, onConfirm, onClose, busy, error }) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '540px',
          background: '#1f1f1f',
          border: '1px solid #2f2f2f',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 12px 50px rgba(0,0,0,0.45)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: 0, marginBottom: '12px', fontSize: '20px', color: '#fff' }}>＋ 新增歌曲</h2>
        <p style={{ margin: '0 0 16px', color: '#b3b3b3', fontSize: '14px' }}>
          選擇音訊檔（mp3/wav/flac…），填寫基本資訊，必要時可直接貼上歌詞文字。
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={async () => {
                try {
                  const picked = await pickAudioFile();
                  if (picked) {
                    onChange({ sourcePath: picked });
                  }
                } catch (err) {
                  console.error('[Library] pick file failed', err);
                }
              }}
              style={{
                padding: '10px 14px',
                backgroundColor: '#2d2d2d',
                color: '#fff',
                border: '1px solid #3a3a3a',
                borderRadius: '8px',
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.7 : 1,
              }}
              disabled={busy}
            >
              選擇音訊檔
            </button>
            <div style={{ color: form.sourcePath ? '#fff' : '#777', fontSize: '14px', flex: 1 }}>
              {form.sourcePath || '尚未選擇檔案（支援 mp3 / wav / flac）'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#b3b3b3', fontSize: '13px' }}>
                類型
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {(['原曲', '伴奏'] as SongType[]).map((type) => (
                  <label
                    key={type}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      background: form.type === type ? '#2f2f2f' : '#252525',
                      border: '1px solid #333',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="song-type"
                      value={type}
                      checked={form.type === type}
                      onChange={() => onChange({ type })}
                    />
                    <span style={{ color: '#fff', fontSize: '13px' }}>{type}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#b3b3b3', fontSize: '13px' }}>
              歌曲名稱 <span style={{ color: '#888', fontSize: '12px' }}>(必填)</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="輸入歌曲名稱"
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#252525',
                color: '#fff',
                border: '1px solid #3a3a3a',
                borderRadius: '8px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#b3b3b3', fontSize: '13px' }}>
              歌手 / 團名 <span style={{ color: '#888', fontSize: '12px' }}>(選填)</span>
            </label>
            <input
              type="text"
              value={form.artist}
              onChange={(e) => onChange({ artist: e.target.value })}
              placeholder="輸入歌手 / 團名"
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#252525',
                color: '#fff',
                border: '1px solid #3a3a3a',
                borderRadius: '8px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#b3b3b3', fontSize: '13px' }}>
              歌詞
            </label>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
              {([
                { value: 'none', label: '無歌詞' },
                { value: 'paste', label: '貼上歌詞' },
              ] as const).map((option) => (
                <label
                  key={option.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    background: form.lyricsMode === option.value ? '#2f2f2f' : '#252525',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="lyrics-mode"
                    value={option.value}
                    checked={form.lyricsMode === option.value}
                    onChange={() => onChange({ lyricsMode: option.value })}
                  />
                  <span style={{ color: '#fff', fontSize: '13px' }}>{option.label}</span>
                </label>
              ))}
            </div>
            {form.lyricsMode === 'paste' && (
              <textarea
                value={form.lyricsText}
                onChange={(e) => onChange({ lyricsText: e.target.value })}
                placeholder="一行一行貼上歌詞文字"
                rows={6}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#252525',
                  color: '#fff',
                  border: '1px solid #3a3a3a',
                  borderRadius: '8px',
                  resize: 'vertical',
                }}
              />
            )}
          </div>
        </div>

        {error && <div style={{ color: '#ff8080', marginTop: '12px', fontSize: '13px' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 14px',
              backgroundColor: '#2d2d2d',
              color: '#fff',
              border: '1px solid #3a3a3a',
              borderRadius: '8px',
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.7 : 1,
            }}
            disabled={busy}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--accent-color)',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.7 : 1,
              fontWeight: 700,
            }}
            disabled={busy}
          >
            {busy ? '新增中...' : '新增歌曲'}
          </button>
        </div>
      </div>
    </div>
  );
};

const LibraryView: React.FC<LibraryViewProps> = ({ onSongSelect, selectedSongId, onOpenLyrics }) => {
  const [songs, setSongs] = useState<SongMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formState, setFormState] = useState<AddSongFormState>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [currentSelection, setCurrentSelection] = useState<string | undefined>(selectedSongId);
  const [separationBusyId, setSeparationBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedSongId) setCurrentSelection(selectedSongId);
  }, [selectedSongId]);

  const fetchSongs = async () => {
    setLoading(true);
    try {
      const list = await loadAllSongs();
      setSongs(list);
      console.log('[Library] Loaded library list', list.length);
    } catch (err) {
      console.error('[Library] Failed to load songs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeJobUpdates(() => {
      fetchSongs();
    });
    return () => unsubscribe();
  }, []);

  const handleAddConfirm = async () => {
    setFormError(null);
    if (!formState.sourcePath) {
      setFormError('請先選擇音訊檔');
      return;
    }
    if (!formState.title.trim()) {
      setFormError('請輸入歌曲名稱');
      return;
    }

    setIsAdding(true);
    try {
      const meta = await addLocalSong({
        sourcePath: formState.sourcePath,
        title: formState.title.trim(),
        artist: formState.artist.trim(),
        type: formState.type,
        lyricsText: formState.lyricsMode === 'paste' ? formState.lyricsText : undefined,
      });
      setSongs((prev) => [meta, ...prev.filter((s) => s.id !== meta.id)]);
      setShowAddDialog(false);
      setFormState(defaultForm);
      setFormError(null);
    } catch (err) {
      console.error('[Library] Failed to add song', err);
      setFormError('新增歌曲失敗，請確認檔案路徑與權限。');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRowClick = async (song: SongMeta) => {
    try {
      const filePath = await getSongFilePath(song.id);
      if (!filePath) {
        console.warn('[Library] No file path found for song', song.id);
        return;
      }
      setCurrentSelection(song.id);
      await onSongSelect(song, filePath);
      console.log('[Library] Selected song', song.id, filePath);
    } catch (err) {
      console.error('[Library] Failed to select song', song.id, err);
    }
  };

  const handleStartSeparation = async (song: SongMeta) => {
    setSeparationBusyId(song.id);
    const previousStatus = song.audio_status;
    setSongs((prev) =>
      prev.map((item) => (item.id === song.id ? { ...item, audio_status: 'separation_pending', last_separation_error: null } : item)),
    );
    try {
      await queueSeparationJob(song.id);
      console.log('[Library] Queued separation job', song.id);
    } catch (err) {
      console.error('[Library] Failed to queue separation', song.id, err);
      setSongs((prev) => prev.map((item) => (item.id === song.id ? { ...item, audio_status: previousStatus } : item)));
    } finally {
      setSeparationBusyId(null);
    }
  };

  const currentSongs = useMemo(() => songs, [songs]);

  return (
    <div style={{ padding: '32px', height: '100%', overflowY: 'auto', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: 0 }}>歌曲庫</h1>
        <button
          onClick={() => {
            setFormState(defaultForm);
            setFormError(null);
            setShowAddDialog(true);
          }}
          style={{
            padding: '10px 16px',
            backgroundColor: 'var(--accent-color)',
            color: '#000',
            border: 'none',
            borderRadius: '999px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
          }}
        >
          ＋ 新增歌曲
        </button>
      </div>

      <div style={{ color: '#b3b3b3', marginBottom: '12px', fontSize: '14px' }}>
        支援原曲與伴奏，原曲可排入分離任務；點擊列可以直接載入播放器。
      </div>

      <div
        style={{
          backgroundColor: '#181818',
          borderRadius: '10px',
          overflow: 'hidden',
          border: '1px solid #2a2a2a',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '40px 3fr 2fr 1fr 1.2fr 1fr 1.2fr',
            padding: '12px 16px',
            borderBottom: '1px solid #252525',
            color: '#b3b3b3',
            fontSize: '13px',
            letterSpacing: '0.2px',
          }}
        >
          <div>#</div>
          <div>歌曲名稱</div>
          <div>歌手</div>
          <div>類型</div>
          <div>音訊狀態</div>
          <div>歌詞狀態</div>
          <div>操作</div>
        </div>

        {loading ? (
          <div style={{ padding: '20px', color: '#b3b3b3' }}>載入中...</div>
        ) : currentSongs.length === 0 ? (
          <div style={{ padding: '20px', color: '#b3b3b3' }}>
            尚未有歌曲，點右上角「＋ 新增歌曲」開始建立你的歌單。
          </div>
        ) : (
          currentSongs.map((song, idx) => {
            const isActive = currentSelection === song.id;
            const canStartSeparation =
              song.type === '原曲' &&
              (song.audio_status === 'original_only' || song.audio_status === 'separation_failed' || song.audio_status === 'ready');
            const isWorking =
              song.audio_status === 'separation_pending' || song.audio_status === 'separating' || separationBusyId === song.id;
            const audioColor =
              song.audio_status === 'separated'
                ? '#8be28b'
                : song.audio_status === 'separation_failed' || song.audio_status === 'error'
                ? '#ff8b8b'
                : '#e0a040';

            return (
              <div
                key={song.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 3fr 2fr 1fr 1.2fr 1fr 1.2fr',
                  padding: '12px 16px',
                  borderBottom: '1px solid #252525',
                  color: '#fff',
                  fontSize: '14px',
                  alignItems: 'center',
                  backgroundColor: isActive ? '#262626' : 'transparent',
                  cursor: 'pointer',
                }}
                onClick={() => handleRowClick(song)}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = isActive ? '#262626' : '#202020')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = isActive ? '#262626' : 'transparent')}
              >
                <div style={{ color: '#b3b3b3' }}>{idx + 1}</div>
                <div style={{ fontWeight: isActive ? 700 : 500 }}>{song.title}</div>
                <div style={{ color: '#b3b3b3' }}>{song.artist || '—'}</div>
                <div style={{ color: '#b3b3b3' }}>{song.type}</div>
                <div style={{ color: audioColor }} title={song.last_separation_error || undefined}>
                  {audioStatusLabels[song.audio_status]}
                  {song.audio_status === 'separating' && <span style={{ marginLeft: 6, fontSize: '12px' }}>⋯</span>}
                  {song.audio_status === 'separation_failed' && song.last_separation_error && (
                    <span style={{ marginLeft: 6, color: '#ffb3b3', fontSize: '12px' }}>查看錯誤</span>
                  )}
                </div>
                <div style={{ color: '#b3b3b3' }}>{lyricsLabel(song.lyrics_status)}</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {song.type === '原曲' ? (
                    canStartSeparation ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartSeparation(song);
                        }}
                        disabled={isWorking}
                        style={{
                          padding: '6px 10px',
                          backgroundColor: isWorking ? '#3a3a3a' : 'var(--accent-color)',
                          color: '#000',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: isWorking ? 'not-allowed' : 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        {song.audio_status === 'separation_failed' ? '重新分離' : '分離伴奏'}
                      </button>
                    ) : song.audio_status === 'separated' ? (
                      <span style={{ color: '#8be28b' }}>已分離</span>
                    ) : (
                      <span style={{ color: '#b3b3b3' }}>{audioStatusLabels[song.audio_status]}</span>
                    )
                  ) : (
                    <span style={{ color: '#555' }}>—</span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenLyrics?.(song);
                    }}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: '#2d2d2d',
                      color: '#fff',
                      border: '1px solid #3a3a3a',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    歌詞對齊
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showAddDialog && (
        <AddSongDialog
          form={formState}
          onChange={(next) => setFormState((prev) => ({ ...prev, ...next }))}
          onConfirm={handleAddConfirm}
          onClose={() => (!isAdding ? setShowAddDialog(false) : null)}
          busy={isAdding}
          error={formError}
        />
      )}
    </div>
  );
};

export default LibraryView;
