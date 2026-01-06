import React, { useState, useEffect } from 'react';
import { addLocalSong, pickAudioFile, SongType } from '../library/songLibrary';
import { useLibrary } from '../contexts/LibraryContext';
import LyricsSearchPane from './LyricsSearchPane';

interface AddSongSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

interface AddSongFormState {
    source: 'file' | 'youtube';
    sourcePath: string; // For file
    youtubeUrl: string; // For YouTube
    youtubeQuality: 'best' | 'high' | 'normal';
    title: string;
    artist: string;
    type: SongType;
    lyricsMode: 'none' | 'paste' | 'import_search';
    lyricsText: string;
    lyricsLrc?: string;
    lyricsFormat?: 'txt' | 'lrc';
    lyricsFilename?: string;
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
    lyricsFormat: 'txt'
};

const AddSongSidebar: React.FC<AddSongSidebarProps> = ({ isOpen, onClose }) => {
    const { refreshSongs } = useLibrary();
    const [form, setForm] = useState<AddSongFormState>(defaultForm);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [validating, setValidating] = useState(false);
    const [showSearchPane, setShowSearchPane] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Reset form when opened
    useEffect(() => {
        if (isOpen) {
            setForm(defaultForm);
            setError(null);
            setBusy(false);
            setValidating(false);
            setShowSearchPane(false);
        }
    }, [isOpen]);

    // Auto-clear error after 3 seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const updateForm = (updates: Partial<AddSongFormState>) => {
        setForm(prev => ({ ...prev, ...updates }));
    };

    const handleUrlBlur = async () => {
        if (form.source !== 'youtube' || !form.youtubeUrl.trim()) return;
        if (!form.youtubeUrl.includes('youtube.com') && !form.youtubeUrl.includes('youtu.be')) return;

        setValidating(true);
        try {
            const meta = await window.khelper?.downloads.validateUrl(form.youtubeUrl.trim());
            if (meta) {
                updateForm({ title: meta.title });
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
                updateForm({ youtubeUrl: text });
                if (text.includes('youtube.com') || text.includes('youtu.be')) {
                    setValidating(true);
                    window.khelper?.downloads.validateUrl(text.trim()).then(meta => {
                        if (meta) updateForm({ title: meta.title });
                        setValidating(false);
                    }).catch(() => setValidating(false));
                }
            }
        } catch (err) {
            console.error('Clipboard read failed', err);
        }
    };

    const handleConfirm = async () => {
        setError(null);

        if (form.source === 'file') {
            if (!form.sourcePath) {
                setError('請先選擇音訊檔');
                return;
            }
        } else {
            if (!form.youtubeUrl.trim()) {
                setError('請輸入 YouTube 連結');
                return;
            }
        }

        if (!form.title.trim()) {
            setError('請輸入歌曲名稱');
            return;
        }

        setBusy(true);
        try {
            if (form.source === 'file') {
                await addLocalSong({
                    sourcePath: form.sourcePath,
                    title: form.title.trim(),
                    artist: form.artist.trim(),
                    type: form.type,
                    lyricsText: form.lyricsMode === 'paste' ? form.lyricsText : (form.lyricsMode === 'import_search' && form.lyricsFormat === 'txt' ? form.lyricsText : undefined),
                    lyricsLrc: form.lyricsMode === 'import_search' && form.lyricsFormat === 'lrc' ? form.lyricsLrc : undefined
                });
                await refreshSongs();
            } else {
                await window.khelper?.downloads.queueDownload(
                    form.youtubeUrl.trim(),
                    form.youtubeQuality,
                    form.title.trim(),
                    form.artist.trim(),
                    form.type,
                    form.lyricsMode === 'paste' ? form.lyricsText : (form.lyricsMode === 'import_search' && form.lyricsFormat === 'txt' ? form.lyricsText : undefined),
                    form.lyricsMode === 'import_search' && form.lyricsFormat === 'lrc' ? form.lyricsLrc : undefined
                );
            }
            onClose();
        } catch (err: any) {
            console.error('[AddSong] Failed to add song', err);
            let msg = err.message || '';
            if (msg.includes('Invalid YouTube URL')) msg = '無效的 YouTube 連結';
            else if (msg.includes('Video unavailable')) msg = '影片無法觀看 (可能被刪除或設為私人)';
            else if (msg.includes('Private video')) msg = '這是私人影片';
            else if (msg.includes('Sign in to confirm your age')) msg = '影片有年齡限制，無法下載';
            else if (msg.includes('network')) msg = '網路連線錯誤';
            else if (msg.includes('timeout')) msg = '連線逾時';
            else if (msg.includes('already exists')) msg = '歌曲已存在於資料庫';
            else msg = '新增歌曲失敗';
            setError(msg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            {/* Backdrop with blur */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(5px)',
                    zIndex: 250, // Higher than QueuePanel (200)
                    opacity: isOpen ? 1 : 0,
                    pointerEvents: isOpen ? 'auto' : 'none',
                    transition: 'opacity 0.3s ease',
                }}
                onClick={onClose}
            />

            {/* Sidebar */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: '400px',
                    backgroundColor: '#1f1f1f',
                    borderLeft: '1px solid #333',
                    zIndex: 251,
                    transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                    transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: '-5px 0 30px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#252525'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>新增歌曲</h2>
                        {error && (
                            <span style={{
                                backgroundColor: '#ff4444',
                                color: '#fff',
                                fontSize: '12px',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                                animation: 'fadeIn 0.2s ease-out'
                            }}>
                                {error}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#aaa',
                            cursor: 'pointer',
                            fontSize: '20px',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

                    {/* Source Selector */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                        <label style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            padding: '12px',
                            backgroundColor: form.source === 'file' ? 'var(--accent-color)' : '#2a2a2a',
                            color: form.source === 'file' ? '#000' : '#fff',
                            borderRadius: '8px',
                            fontWeight: form.source === 'file' ? 'bold' : 'normal',
                            transition: 'all 0.2s'
                        }}>
                            <input
                                type="radio"
                                name="source"
                                checked={form.source === 'file'}
                                onChange={() => updateForm({ source: 'file' })}
                                style={{ display: 'none' }}
                            />
                            <span>本機檔案</span>
                        </label>
                        <label style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            padding: '12px',
                            backgroundColor: form.source === 'youtube' ? '#ff0000' : '#2a2a2a',
                            color: '#fff',
                            borderRadius: '8px',
                            fontWeight: form.source === 'youtube' ? 'bold' : 'normal',
                            transition: 'all 0.2s'
                        }}>
                            <input
                                type="radio"
                                name="source"
                                checked={form.source === 'youtube'}
                                onChange={() => updateForm({ source: 'youtube' })}
                                style={{ display: 'none' }}
                            />
                            <span>YouTube</span>
                        </label>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* File Source UI */}
                        {form.source === 'file' && (
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', color: '#b3b3b3', fontSize: '13px' }}>
                                    音訊檔案
                                </label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={async () => {
                                            try {
                                                const picked = await pickAudioFile();
                                                if (picked) {
                                                    // Extract filename without extension
                                                    const filename = picked.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, "") || "";
                                                    updateForm({ sourcePath: picked, title: filename });
                                                }
                                            } catch (err) {
                                                console.error('[Library] pick file failed', err);
                                            }
                                        }}
                                        style={{
                                            padding: '10px 16px',
                                            backgroundColor: '#333',
                                            color: '#fff',
                                            border: '1px solid #444',
                                            borderRadius: '8px',
                                            cursor: busy ? 'not-allowed' : 'pointer',
                                            whiteSpace: 'nowrap'
                                        }}
                                        disabled={busy}
                                    >
                                        選擇檔案
                                    </button>
                                    <div style={{
                                        flex: 1,
                                        padding: '10px 12px',
                                        background: '#252525',
                                        border: '1px solid #333',
                                        borderRadius: '8px',
                                        color: form.sourcePath ? '#fff' : '#666',
                                        fontSize: '13px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        boxSizing: 'border-box'
                                    }}>
                                        {form.sourcePath || '未選擇檔案'}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* YouTube Source UI */}
                        {form.source === 'youtube' && (
                            <>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', color: '#b3b3b3', fontSize: '13px' }}>
                                        YouTube 連結
                                    </label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            type="text"
                                            value={form.youtubeUrl}
                                            onChange={(e) => updateForm({ youtubeUrl: e.target.value })}
                                            onBlur={handleUrlBlur}
                                            placeholder="https://www.youtube.com/watch?v=..."
                                            style={{
                                                flex: 1,
                                                padding: '10px 12px',
                                                background: '#252525',
                                                color: '#fff',
                                                border: '1px solid #3a3a3a',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                boxSizing: 'border-box'
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
                                    {validating && <div style={{ fontSize: '12px', color: 'var(--accent-color)', marginTop: '6px' }}>正在解析影片資訊...</div>}
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', color: '#b3b3b3', fontSize: '13px' }}>
                                        下載品質
                                    </label>
                                    <select
                                        value={form.youtubeQuality}
                                        onChange={(e) => updateForm({ youtubeQuality: e.target.value as any })}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            background: '#252525',
                                            color: '#fff',
                                            border: '1px solid #3a3a3a',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            boxSizing: 'border-box'
                                        }}
                                    >
                                        <option value="normal">普通 (節省空間)</option>
                                        <option value="high">高音質 (標準)</option>
                                        <option value="best">最佳 (檔案較大)</option>
                                    </select>
                                </div>
                            </>
                        )}

                        <div style={{ height: '1px', background: '#333', margin: '8px 0' }} />

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', color: '#b3b3b3', fontSize: '13px' }}>
                                歌曲類型
                            </label>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                {(['原曲', '伴奏'] as SongType[]).map((type) => (
                                    <label
                                        key={type}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            padding: '10px',
                                            background: form.type === type ? '#333' : '#252525',
                                            border: form.type === type ? '1px solid #555' : '1px solid #333',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name="song-type"
                                            value={type}
                                            checked={form.type === type}
                                            onChange={() => updateForm({ type })}
                                            style={{ accentColor: 'var(--accent-color)' }}
                                        />
                                        <span style={{ color: '#fff', fontSize: '14px' }}>{type}</span>
                                    </label>
                                ))}
                            </div>
                            <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                                {form.type === '原曲' ? '原曲可以進行人聲分離處理' : '伴奏不會進行人聲分離'}
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', color: '#b3b3b3', fontSize: '13px' }}>
                                歌曲標題 <span style={{ color: '#ff4444' }}>*</span>
                            </label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={(e) => updateForm({ title: e.target.value })}
                                placeholder="輸入歌曲標題"
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: '#252525',
                                    color: '#fff',
                                    border: '1px solid #3a3a3a',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', color: '#b3b3b3', fontSize: '13px' }}>
                                歌手 / 團體
                            </label>
                            <input
                                type="text"
                                value={form.artist}
                                onChange={(e) => updateForm({ artist: e.target.value })}
                                placeholder="輸入歌手名稱 (選填)"
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: '#252525',
                                    color: '#fff',
                                    border: '1px solid #3a3a3a',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', color: '#b3b3b3', fontSize: '13px' }}>
                                初始歌詞
                            </label>
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                                {([
                                    { value: 'none', label: '無歌詞' },
                                    { value: 'paste', label: '貼上文字' },
                                    { value: 'import_search', label: '上傳/搜尋' },
                                ] as const).map((option) => (
                                    <label
                                        key={option.value}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '8px 12px',
                                            background: form.lyricsMode === option.value ? '#333' : '#252525',
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
                                            onChange={() => updateForm({ lyricsMode: option.value })}
                                            style={{ accentColor: 'var(--accent-color)' }}
                                        />
                                        <span style={{ color: '#fff', fontSize: '13px' }}>{option.label}</span>
                                    </label>
                                ))}
                            </div>
                            {form.lyricsMode === 'paste' && (
                                <textarea
                                    value={form.lyricsText}
                                    onChange={(e) => updateForm({ lyricsText: e.target.value })}
                                    placeholder="在此貼上歌詞文字..."
                                    rows={8}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        background: '#252525',
                                        color: '#fff',
                                        border: '1px solid #3a3a3a',
                                        borderRadius: '8px',
                                        resize: 'vertical',
                                        fontSize: '13px',
                                        lineHeight: '1.5',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            )}

                            {form.lyricsMode === 'import_search' && (
                                <div style={{
                                    border: '1px solid #3a3a3a',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    background: '#202020'
                                }}>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            style={{
                                                flex: 1,
                                                padding: '8px',
                                                background: '#333',
                                                border: '1px solid #444',
                                                color: '#fff',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '13px'
                                            }}
                                        >
                                            上傳檔案 (.lrc/.txt)
                                        </button>
                                        <button
                                            onClick={() => setShowSearchPane(true)}
                                            style={{
                                                flex: 1,
                                                padding: '8px',
                                                background: '#333',
                                                border: '1px solid #444',
                                                color: '#fff',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px',
                                                fontSize: '13px'
                                            }}
                                        >
                                            <span style={{ fontSize: '14px' }}>🔍</span> 搜尋線上歌詞
                                        </button>
                                    </div>

                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept=".lrc,.txt"
                                        style={{ display: 'none' }}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (ev) => {
                                                    const content = ev.target?.result as string;
                                                    const isLrc = file.name.toLowerCase().endsWith('.lrc');
                                                    updateForm({
                                                        lyricsFormat: isLrc ? 'lrc' : 'txt',
                                                        lyricsText: isLrc ? '' : content,
                                                        lyricsLrc: isLrc ? content : undefined,
                                                        lyricsFilename: file.name
                                                    });
                                                };
                                                reader.readAsText(file);
                                            }
                                            // Reset value to allow re-selection
                                            e.target.value = '';
                                        }}
                                    />

                                    {(form.lyricsFilename || (form.lyricsFormat === 'lrc' ? form.lyricsLrc : form.lyricsText)) ? (
                                        <div style={{ fontSize: '12px', color: '#aaa', marginTop: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{
                                                    background: form.lyricsFormat === 'lrc' ? 'var(--accent-color)' : '#444',
                                                    color: form.lyricsFormat === 'lrc' ? '#000' : '#ccc',
                                                    padding: '2px 4px',
                                                    borderRadius: '3px',
                                                    fontWeight: 'bold',
                                                    fontSize: '10px'
                                                }}>
                                                    {form.lyricsFormat === 'lrc' ? 'LRC' : 'TXT'}
                                                </span>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {form.lyricsFilename || '已載入內容'}
                                                </span>
                                            </div>
                                            {form.lyricsFormat === 'lrc' && (
                                                <div style={{ marginTop: '4px', fontStyle: 'italic', opacity: 0.7 }}>
                                                    Synced Lyrics available
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '12px', color: '#666', marginTop: '8px', textAlign: 'center', fontStyle: 'italic' }}>
                                            未選擇歌詞
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '20px',
                    borderTop: '1px solid #333',
                    backgroundColor: '#202020',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    <button
                        onClick={handleConfirm}
                        disabled={busy}
                        style={{
                            width: '100%',
                            padding: '12px',
                            backgroundColor: 'var(--accent-color)',
                            color: '#000',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            cursor: busy ? 'not-allowed' : 'pointer',
                            opacity: busy ? 0.7 : 1,
                            transition: 'transform 0.1s',
                        }}
                        onMouseDown={e => !busy && (e.currentTarget.style.transform = 'scale(0.98)')}
                        onMouseUp={e => !busy && (e.currentTarget.style.transform = 'scale(1)')}
                        onMouseLeave={e => !busy && (e.currentTarget.style.transform = 'scale(1)')}
                    >
                        {busy ? '處理中...' : '確認新增'}
                    </button>
                </div>
            </div>
            <LyricsSearchPane
                isOpen={showSearchPane}
                onClose={() => setShowSearchPane(false)}
                initialQuery={`${form.title} ${form.artist}`.trim()}
                onSelect={(content, type) => {
                    updateForm({
                        lyricsFormat: type,
                        lyricsText: type === 'txt' ? content : '',
                        lyricsLrc: type === 'lrc' ? content : undefined,
                        lyricsFilename: `From Search: ${form.title}`
                    });
                    setShowSearchPane(false);
                }}
            />
        </>
    );
};

export default AddSongSidebar;
