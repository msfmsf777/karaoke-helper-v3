import React, { useMemo, useState } from 'react';
import { addLocalSong, pickAudioFile, SongMeta, SongType } from '../library/songLibrary';
import { useLibrary } from '../contexts/LibraryContext';
import { useQueue } from '../contexts/QueueContext';
import { useUserData } from '../contexts/UserDataContext';
import SongList from './SongList';

interface LibraryViewProps {
  onOpenLyrics?: (song: SongMeta) => void;
}

interface AddSongFormState {
  source: 'file' | 'youtube';
  sourcePath: string; // For file
  youtubeUrl: string; // For YouTube
  youtubeQuality: 'best' | 'high' | 'normal';
  title: string;
  artist: string;
  type: SongType;
  lyricsMode: 'none' | 'paste';
  lyricsText: string;
}

const defaultForm: AddSongFormState = {
  source: 'file',
  sourcePath: '',
  youtubeUrl: '',
  youtubeQuality: 'high',
  title: '',
  artist: '',
  type: '原曲',
  lyricsMode: 'none',
  lyricsText: '',
};

const AddSongDialog: React.FC<{
  form: AddSongFormState;
  onChange: (next: Partial<AddSongFormState>) => void;
  onConfirm: () => void;
  onClose: () => void;
  busy: boolean;
  error?: string | null;
}> = ({ form, onChange, onConfirm, onClose, busy, error }) => {
  const [validating, setValidating] = useState(false);

  const handleUrlBlur = async () => {
    if (form.source !== 'youtube' || !form.youtubeUrl.trim()) return;

    // Basic regex check to avoid unnecessary IPC calls
    if (!form.youtubeUrl.includes('youtube.com') && !form.youtubeUrl.includes('youtu.be')) return;

    setValidating(true);
    try {
      const meta = await window.khelper?.downloads.validateUrl(form.youtubeUrl.trim());
      if (meta) {
        onChange({ title: meta.title }); // Auto-fill title
      }
    } catch (err) {
      console.warn('Validation failed', err);
    } finally {
      setValidating(false);
    }
  };

  const handlePasteUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onChange({ youtubeUrl: text });
        // Trigger validation manually since blur might not happen
        // We can just call the logic directly or let the user blur.
        // Let's just set it. The user will likely click elsewhere or we can trigger validation.
        // Actually, let's trigger validation immediately for better UX.
        if (text.includes('youtube.com') || text.includes('youtu.be')) {
          setValidating(true);
          window.khelper?.downloads.validateUrl(text.trim()).then(meta => {
            if (meta) onChange({ title: meta.title });
            setValidating(false);
          }).catch(() => setValidating(false));
        }
      }
    } catch (err) {
      console.error('Clipboard read failed', err);
    }
  };

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

        {/* Source Selector */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="source"
              checked={form.source === 'file'}
              onChange={() => onChange({ source: 'file' })}
            />
            <span style={{ color: '#fff' }}>檔案 (File)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="source"
              checked={form.source === 'youtube'}
              onChange={() => onChange({ source: 'youtube' })}
            />
            <span style={{ color: '#fff' }}>YouTube</span>
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* File Source UI */}
          {form.source === 'file' && (
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
          )}

          {/* YouTube Source UI */}
          {form.source === 'youtube' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={form.youtubeUrl}
                  onChange={(e) => onChange({ youtubeUrl: e.target.value })}
                  onBlur={handleUrlBlur}
                  placeholder="貼上 YouTube 連結..."
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: '#252525',
                    color: '#fff',
                    border: '1px solid #3a3a3a',
                    borderRadius: '8px',
                  }}
                />
                <button
                  onClick={handlePasteUrl}
                  style={{
                    padding: '0 16px',
                    background: '#333',
                    color: '#fff',
                    border: '1px solid #444',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  貼上
                </button>
              </div>
              {validating && <div style={{ fontSize: '12px', color: '#aaa' }}>正在解析連結...</div>}

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#b3b3b3', fontSize: '13px' }}>
                  音訊品質
                </label>
                <select
                  value={form.youtubeQuality}
                  onChange={(e) => onChange({ youtubeQuality: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#252525',
                    color: '#fff',
                    border: '1px solid #3a3a3a',
                    borderRadius: '8px',
                  }}
                >
                  <option value="normal">普通（節省空間）</option>
                  <option value="high">高音質（標準）</option>
                  <option value="best">最佳（檔案較大）</option>
                </select>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  實際佔用空間會依影片長度與品質而異
                </div>
              </div>
            </div>
          )}

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

const LibraryView: React.FC<LibraryViewProps> = ({ onOpenLyrics }) => {
  const { songs, loading, refreshSongs } = useLibrary();
  const { } = useQueue();
  const { } = useUserData();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formState, setFormState] = useState<AddSongFormState>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddConfirm = async () => {
    setFormError(null);

    if (formState.source === 'file') {
      if (!formState.sourcePath) {
        setFormError('請先選擇音訊檔');
        return;
      }
    } else {
      if (!formState.youtubeUrl.trim()) {
        setFormError('請輸入 YouTube 連結');
        return;
      }
    }

    if (!formState.title.trim()) {
      setFormError('請輸入歌曲名稱');
      return;
    }

    setIsAdding(true);
    try {
      if (formState.source === 'file') {
        await addLocalSong({
          sourcePath: formState.sourcePath,
          title: formState.title.trim(),
          artist: formState.artist.trim(),
          type: formState.type,
          lyricsText: formState.lyricsMode === 'paste' ? formState.lyricsText : undefined,
        });
        await refreshSongs();
      } else {
        // YouTube
        await window.khelper?.downloads.queueDownload(
          formState.youtubeUrl.trim(),
          formState.youtubeQuality,
          formState.title.trim(),
          formState.artist.trim()
        );
        // We don't refresh songs immediately because it's a background job.
        // But we might want to notify user or switch view?
        // For now, just close dialog.
      }

      setShowAddDialog(false);
      setFormState(defaultForm);
      setFormError(null);
    } catch (err: any) {
      console.error('[Library] Failed to add song', err);
      let msg = err.message || '';
      if (msg.includes('Invalid YouTube URL')) msg = '無效的 YouTube 連結';
      else if (msg.includes('Video unavailable')) msg = '影片無法觀看 (可能被刪除或設為私人)';
      else if (msg.includes('Private video')) msg = '這是私人影片';
      else if (msg.includes('Sign in to confirm your age')) msg = '影片有年齡限制，無法下載';
      else if (msg.includes('network')) msg = '網路連線錯誤';
      else if (msg.includes('timeout')) msg = '連線逾時';
      else if (msg.includes('already exists')) msg = '歌曲已存在於資料庫';
      else msg = '新增歌曲失敗，請確認輸入資訊或稍後再試。';

      setFormError(msg);
    } finally {
      setIsAdding(false);
    }
  };

  const currentSongs = useMemo(() => songs, [songs]);

  return (
    <div style={{ padding: '32px', height: '100%', overflowY: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexShrink: 0 }}>
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

      <div style={{ color: '#b3b3b3', marginBottom: '12px', fontSize: '14px', flexShrink: 0 }}>
        支援原曲與伴奏，原曲可排入分離任務；點擊列可以直接載入播放器。
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '20px', color: '#b3b3b3' }}>載入中...</div>
        ) : (
          <SongList
            songs={currentSongs}
            context="library"
            onEditLyrics={onOpenLyrics}
            emptyMessage="尚未有歌曲，點右上角「＋ 新增歌曲」開始建立你的歌單。"
          />
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
