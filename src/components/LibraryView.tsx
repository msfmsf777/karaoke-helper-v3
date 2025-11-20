import React, { useEffect, useMemo, useState } from 'react';
import { addLocalSong, getSongFilePath, loadAllSongs, pickAudioFile, SongMeta, SongType } from '../library/songLibrary';

interface LibraryViewProps {
  onSongSelect: (song: SongMeta, filePath: string) => Promise<void>;
  selectedSongId?: string;
}

interface AddSongFormState {
  sourcePath: string;
  title: string;
  artist: string;
  type: SongType;
}

const defaultForm: AddSongFormState = {
  sourcePath: '',
  title: '',
  artist: '',
  type: '伴奏',
};

const statusLabels: Record<SongMeta['audio_status'], string> = {
  ready: '已就緒',
  missing: '遺失',
  error: '錯誤',
};

const lyricsLabels: Record<SongMeta['lyrics_status'], string> = {
  none: '無',
  ready: '已就緒',
  missing: '遺失',
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
          width: '520px',
          background: '#1f1f1f',
          border: '1px solid #2f2f2f',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 12px 50px rgba(0,0,0,0.45)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: 0, marginBottom: '12px', fontSize: '20px', color: '#fff' }}>新增歌曲</h2>
        <p style={{ margin: '0 0 16px', color: '#b3b3b3', fontSize: '14px' }}>
          選擇本機音訊檔，填寫歌曲資訊後匯入到資料庫。
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
              選擇檔案…
            </button>
            <div style={{ color: form.sourcePath ? '#fff' : '#777', fontSize: '14px', flex: 1 }}>
              {form.sourcePath || '尚未選取檔案 (.mp3/.wav)'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#b3b3b3', fontSize: '13px' }}>
                類型
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {(['伴奏', '原曲'] as SongType[]).map((type) => (
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
              placeholder="請輸入歌曲名稱"
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
              歌手 / 演出者 <span style={{ color: '#888', fontSize: '12px' }}>(選填)</span>
            </label>
            <input
              type="text"
              value={form.artist}
              onChange={(e) => onChange({ artist: e.target.value })}
              placeholder="可留空"
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
            {busy ? '新增中…' : '確認新增'}
          </button>
        </div>
      </div>
    </div>
  );
};

const LibraryView: React.FC<LibraryViewProps> = ({ onSongSelect, selectedSongId }) => {
  const [songs, setSongs] = useState<SongMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formState, setFormState] = useState<AddSongFormState>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [currentSelection, setCurrentSelection] = useState<string | undefined>(selectedSongId);

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

  const handleAddConfirm = async () => {
    setFormError(null);
    if (!formState.sourcePath) {
      setFormError('請選擇歌曲檔案');
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
      });
      setSongs((prev) => [meta, ...prev.filter((s) => s.id !== meta.id)]);
      setShowAddDialog(false);
      setFormState(defaultForm);
      setFormError(null);
    } catch (err) {
      console.error('[Library] Failed to add song', err);
      setFormError('新增歌曲時發生錯誤，請再試一次');
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
        點擊歌曲即可透過播放器播放；右上角可以新增歌曲到本機資料庫。
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
            gridTemplateColumns: '40px 3fr 2fr 1fr 1fr',
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
          <div>音訊狀態</div>
          <div>歌詞狀態</div>
        </div>

        {loading ? (
          <div style={{ padding: '20px', color: '#b3b3b3' }}>載入中…</div>
        ) : currentSongs.length === 0 ? (
          <div style={{ padding: '20px', color: '#b3b3b3' }}>尚無歌曲，點擊「＋ 新增歌曲」開始建立歌庫。</div>
        ) : (
          currentSongs.map((song, idx) => {
            const isActive = currentSelection === song.id;
            return (
              <div
                key={song.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 3fr 2fr 1fr 1fr',
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
                <div style={{ color: song.audio_status === 'ready' ? '#8be28b' : '#e0a040' }}>
                  {statusLabels[song.audio_status]}
                </div>
                <div style={{ color: '#b3b3b3' }}>{lyricsLabels[song.lyrics_status]}</div>
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
