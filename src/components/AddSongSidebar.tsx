import React, { useState, useEffect } from 'react';
import { addLocalSong, pickAudioFile, SongType, SongMeta } from '../library/songLibrary';
import { useLibrary } from '../contexts/LibraryContext';
import LyricsSearchPane from './LyricsSearchPane';

// Icons
import DeleteIcon from '../assets/icons/delete.svg';
// import SearchIcon from '../assets/icons/search.svg'; // Using inline SVG


interface AddSongSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

interface BatchSongEntry {
    id: string; // Temp ID
    sourceType: 'file' | 'youtube';
    sourcePath?: string; // For file
    youtubeUrl?: string; // For YouTube
    title: string;
    artist: string;
    type: SongType;
    lyricsMode: 'none' | 'paste' | 'import_search';
    lyricsText: string;
    lyricsLrc?: string;
    lyricsFormat?: 'txt' | 'lrc';
    lyricsFilename?: string;
    status: 'pending' | 'success' | 'error';
    errorMsg?: string;
}

const AddSongSidebar: React.FC<AddSongSidebarProps> = ({ isOpen, onClose }) => {
    const { refreshSongs } = useLibrary();
    const [source, setSource] = useState<'file' | 'youtube'>('file');
    const [entries, setEntries] = useState<BatchSongEntry[]>([]);

    // Youtube specific state
    const [youtubeInput, setYoutubeInput] = useState('');
    const [youtubeQuality, setYoutubeQuality] = useState<'best' | 'high' | 'normal'>('high');
    const [validating, setValidating] = useState(false);
    const [validationStatus, setValidationStatus] = useState<'idle' | 'has_error' | 'has_duplicate'>('idle');

    const [busy, setBusy] = useState(false);

    // Lyrics Search State
    const [showSearchPane, setShowSearchPane] = useState(false);
    const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [activeFileInputEntryId, setActiveFileInputEntryId] = useState<string | null>(null);

    // Reset when opened
    useEffect(() => {
        if (isOpen) {
            setEntries([]);
            setYoutubeInput('');
            setBusy(false);
            setValidating(false);
            setValidationStatus('idle');
            setSource('file');
            setShowSearchPane(false);
            setActiveEntryId(null);
        }
    }, [isOpen]);

    const handleAddFiles = async () => {
        try {
            const picked = await pickAudioFile(); // Now returns string[] | null
            if (picked && Array.isArray(picked) && picked.length > 0) {
                const newEntries: BatchSongEntry[] = picked.map(path => {
                    const filename = path.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, "") || "";
                    return {
                        id: Math.random().toString(36).substr(2, 9),
                        sourceType: 'file',
                        sourcePath: path,
                        title: filename,
                        artist: '',
                        type: '原曲',
                        lyricsMode: 'none',
                        lyricsText: '',
                        status: 'pending'
                    };
                });
                setEntries(prev => [...prev, ...newEntries]);
            }
        } catch (err) {
            console.error('[AddSong] Pick files failed', err);
        }
    };

    const handleCheckYoutube = async () => {
        if (!youtubeInput.trim()) return;
        setValidating(true);
        setValidationStatus('idle'); // Reset color during check (white)

        let existingSongs: SongMeta[] = [];
        try {
            existingSongs = await window.khelper?.songLibrary.loadAllSongs() || [];
        } catch (e) {
            console.warn('Failed to load existing songs for check', e);
        }

        const lines = youtubeInput.split('\n').map(l => l.trim()).filter(l => l);
        const newEntries: BatchSongEntry[] = [];
        const invalidLines: string[] = [];

        let hasDuplicate = false;
        let hasInvalid = false;

        // We process sequentially or parallel? Parallel is faster.
        await Promise.all(lines.map(async (line) => {
            // Basic check first
            if (!line.includes('youtube.com') && !line.includes('youtu.be')) {
                invalidLines.push(line);
                hasInvalid = true;
                return;
            }

            try {
                // Validate via backend
                const meta = await window.khelper?.downloads.validateUrl(line);
                if (meta) {
                    // Duplicate Check
                    const isDuplicate = existingSongs.some(s =>
                        s.source.kind === 'youtube' && s.source.youtubeId === meta.videoId
                    );

                    if (isDuplicate) {
                        invalidLines.push(line);
                        hasDuplicate = true;
                    } else {
                        // Creating Entry
                        newEntries.push({
                            id: Math.random().toString(36).substr(2, 9),
                            sourceType: 'youtube',
                            youtubeUrl: line,
                            title: meta.title,
                            artist: '', // Can't reliably get artist from YT title usually
                            type: '原曲',
                            lyricsMode: 'none',
                            lyricsText: '',
                            status: 'pending'
                        });
                    }
                } else {
                    invalidLines.push(line);
                    hasInvalid = true;
                }
            } catch (e) {
                invalidLines.push(line);
                hasInvalid = true;
            }
        }));

        setEntries(prev => [...prev, ...newEntries]);
        setYoutubeInput(invalidLines.join('\n'));

        if (hasDuplicate) setValidationStatus('has_duplicate');
        else if (hasInvalid) setValidationStatus('has_error');
        else setValidationStatus('idle');

        setValidating(false);
    };

    const handleConfirm = async () => {
        if (entries.length === 0) return;
        setBusy(true);

        let successCount = 0;
        const newEntries = [...entries];

        for (let i = 0; i < newEntries.length; i++) {
            const entry = newEntries[i];
            if (entry.status === 'success') continue;

            try {
                if (entry.sourceType === 'file' && entry.sourcePath) {
                    await addLocalSong({
                        sourcePath: entry.sourcePath,
                        title: entry.title.trim(),
                        artist: entry.artist.trim(),
                        type: entry.type,
                        lyricsText: entry.lyricsMode === 'paste' ? entry.lyricsText : (entry.lyricsMode === 'import_search' && entry.lyricsFormat === 'txt' ? entry.lyricsText : undefined),
                        lyricsLrc: entry.lyricsMode === 'import_search' && entry.lyricsFormat === 'lrc' ? entry.lyricsLrc : undefined
                    });
                } else if (entry.sourceType === 'youtube' && entry.youtubeUrl) {
                    await window.khelper?.downloads.queueDownload(
                        entry.youtubeUrl,
                        youtubeQuality,
                        entry.title.trim(),
                        entry.artist.trim(),
                        entry.type,
                        entry.lyricsMode === 'paste' ? entry.lyricsText : (entry.lyricsMode === 'import_search' && entry.lyricsFormat === 'txt' ? entry.lyricsText : undefined),
                        entry.lyricsMode === 'import_search' && entry.lyricsFormat === 'lrc' ? entry.lyricsLrc : undefined
                    );
                }
                newEntries[i].status = 'success';
                successCount++;
            } catch (e: any) {
                console.error(`Failed to add ${entry.title}`, e);
                newEntries[i].status = 'error';
                newEntries[i].errorMsg = e.message || 'Unknown error';
            }
        }

        setEntries(newEntries);
        setBusy(false);

        if (successCount > 0 && newEntries.every(e => e.status === 'success')) {
            await refreshSongs();
            onClose();
        } else {
            await refreshSongs(); // Refresh anyway
            // Keep dialog open if failures exist
        }
    };

    const updateEntry = (id: string, updates: Partial<BatchSongEntry>) => {
        setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    };

    const removeEntry = (id: string) => {
        setEntries(prev => prev.filter(e => e.id !== id));
    };

    const handleLyricsSelect = (content: string, type: 'txt' | 'lrc', name?: string, artist?: string) => {
        if (activeEntryId) {
            updateEntry(activeEntryId, {
                lyricsFormat: type,
                lyricsText: type === 'txt' ? content : '',
                lyricsLrc: type === 'lrc' ? content : undefined,
                lyricsFilename: `搜尋結果: ${name} - ${artist}`
            });
            setShowSearchPane(false);
            setActiveEntryId(null);
        }
    };

    const toggleSearch = (entryId: string) => {
        if (activeEntryId === entryId && showSearchPane) {
            // If clicking the same button and pane is allowed -> Close it
            setShowSearchPane(false);
            setActiveEntryId(null);
        } else {
            // Open new
            setActiveEntryId(entryId);
            setShowSearchPane(true);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && activeFileInputEntryId) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const content = ev.target?.result as string;
                const isLrc = file.name.toLowerCase().endsWith('.lrc');
                updateEntry(activeFileInputEntryId, {
                    lyricsFormat: isLrc ? 'lrc' : 'txt',
                    lyricsText: isLrc ? '' : content,
                    lyricsLrc: isLrc ? content : undefined,
                    lyricsFilename: file.name
                });
            };
            reader.readAsText(file);
            setActiveFileInputEntryId(null);
        }
        e.target.value = '';
    };

    // Determine input color
    const getInputColor = () => {
        if (validating) return '#fff'; // White while checking
        if (validationStatus === 'has_duplicate') return '#ffaa00'; // Orange for duplicates
        if (validationStatus === 'has_error') return '#ff4444'; // Red for errors
        return '#fff'; // Default
    };

    return (
        <>
            {/* Backdrop */}
            <div
                style={{
                    position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)',
                    zIndex: 250, opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none', transition: 'opacity 0.3s ease',
                }}
                onClick={onClose}
            />

            {/* Sidebar */}
            <div style={{
                position: 'absolute', top: 0, right: 0, bottom: 0, width: '450px', backgroundColor: '#1f1f1f',
                borderLeft: '1px solid #333', zIndex: 251, transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: '-5px 0 30px rgba(0,0,0,0.5)',
                display: 'flex', flexDirection: 'column',
            }}>
                {/* Header */}
                <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#252525' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>大量新增歌曲</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '20px', padding: '4px' }}>×</button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

                    {/* Source Selector */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                        <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', padding: '12px', backgroundColor: source === 'file' ? 'var(--accent-color)' : '#2a2a2a', color: source === 'file' ? '#000' : '#fff', borderRadius: '8px', fontWeight: source === 'file' ? 'bold' : 'normal', transition: 'all 0.2s' }}>
                            <input type="radio" name="source" checked={source === 'file'} onChange={() => setSource('file')} style={{ display: 'none' }} />
                            <span>本機檔案</span>
                        </label>
                        <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', padding: '12px', backgroundColor: source === 'youtube' ? '#ff0000' : '#2a2a2a', color: '#fff', borderRadius: '8px', fontWeight: source === 'youtube' ? 'bold' : 'normal', transition: 'all 0.2s' }}>
                            <input type="radio" name="source" checked={source === 'youtube'} onChange={() => setSource('youtube')} style={{ display: 'none' }} />
                            <span>YouTube</span>
                        </label>
                    </div>

                    {/* Controls */}
                    {source === 'file' && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <label style={{ color: '#b3b3b3', fontSize: '13px' }}>音訊檔案</label>
                            <button onClick={handleAddFiles} style={{ padding: '6px 12px', background: '#333', color: '#fff', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                                + 選擇檔案
                            </button>
                        </div>
                    )}

                    {source === 'youtube' && (
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label style={{ color: '#b3b3b3', fontSize: '13px' }}>YouTube 連結 (每行一個)</label>
                                <select value={youtubeQuality} onChange={(e) => setYoutubeQuality(e.target.value as any)} style={{ padding: '4px 8px', background: '#252525', color: '#fff', border: '1px solid #3a3a3a', borderRadius: '4px', fontSize: '12px' }}>
                                    <option value="normal">普通 (節省空間)</option>
                                    <option value="high">高音質 (標準)</option>
                                    <option value="best">最佳 (檔案較大)</option>
                                </select>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <textarea
                                    value={youtubeInput}
                                    onChange={(e) => setYoutubeInput(e.target.value)}
                                    placeholder="貼上 YouTube 連結..."
                                    rows={5}
                                    style={{ width: '100%', padding: '10px 12px', background: '#252525', color: getInputColor(), border: '1px solid #3a3a3a', borderRadius: '8px', resize: 'vertical', fontSize: '13px', lineHeight: '1.5', boxSizing: 'border-box', transition: 'color 0.2s' }}
                                />
                                <button
                                    onClick={async () => {
                                        const text = await navigator.clipboard.readText();
                                        if (text) setYoutubeInput(prev => prev + (prev ? '\n' : '') + text);
                                    }}
                                    style={{ position: 'absolute', top: '8px', right: '8px', padding: '4px 8px', background: '#333', color: '#fff', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                >
                                    貼上
                                </button>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                                <span style={{ fontSize: '12px', color: '#666' }}>
                                    {youtubeInput.split('\n').filter(l => l.trim()).length} 個連結
                                </span>
                                <button onClick={handleCheckYoutube} disabled={validating} style={{ padding: '6px 12px', background: validating ? '#444' : 'var(--accent-color)', color: validating ? '#aaa' : '#000', border: 'none', borderRadius: '6px', cursor: validating ? 'wait' : 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                                    {validating ? '解析中...' : '檢查並匯入'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Entry List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {entries.filter(e => e.sourceType === source).map((entry) => (
                            <div key={entry.id} style={{
                                backgroundColor: '#252525', border: entry.status === 'error' ? '1px solid #ff4444' : '1px solid #333',
                                borderRadius: '8px', padding: '12px', position: 'relative'
                            }}>
                                {/* Top Bar: Path & Controls */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px', color: '#666', marginRight: '12px', background: '#1a1a1a', padding: '4px 8px', borderRadius: '4px' }}>
                                        {entry.sourceType === 'file' ? entry.sourcePath : entry.youtubeUrl}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <select
                                            value={entry.type}
                                            onChange={(e) => updateEntry(entry.id, { type: e.target.value as SongType })}
                                            style={{ background: '#333', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '11px' }}
                                        >
                                            <option value="原曲">原曲</option>
                                            <option value="伴奏">伴奏</option>
                                        </select>
                                        <button onClick={() => removeEntry(entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', opacity: 0.7 }}>
                                            <img src={DeleteIcon} style={{ width: '14px', height: '14px' }} />
                                        </button>
                                    </div>
                                </div>

                                {/* Main Fields */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <input
                                        type="text" value={entry.title} onChange={(e) => updateEntry(entry.id, { title: e.target.value })}
                                        placeholder="歌曲標題"
                                        style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
                                    />
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            type="text" value={entry.artist} onChange={(e) => updateEntry(entry.id, { artist: e.target.value })}
                                            placeholder="歌手 (選填)"
                                            style={{ flex: 1, padding: '6px 8px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '12px', boxSizing: 'border-box' }}
                                        />

                                        {/* Lyrics Controls (Compact) */}
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <select
                                                value={entry.lyricsMode}
                                                onChange={(e) => updateEntry(entry.id, { lyricsMode: e.target.value as any })}
                                                style={{ background: '#333', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '0 4px', fontSize: '11px', width: '70px' }}
                                            >
                                                <option value="none">無歌詞</option>
                                                <option value="paste">貼上</option>
                                                <option value="import_search">搜尋/匯入</option>
                                            </select>

                                            {/* Contextual Action */}
                                            {entry.lyricsMode === 'import_search' && (
                                                <button
                                                    onClick={() => toggleSearch(entry.id)}
                                                    style={{
                                                        padding: '0 6px',
                                                        background: '#333',
                                                        border: activeEntryId === entry.id ? '1px solid var(--accent-color)' : '1px solid #444',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        boxShadow: activeEntryId === entry.id ? '0 0 5px var(--accent-color)' : 'none',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    title="搜尋歌詞"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                        <path d="M21 21L16.65 16.65" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Lyrics Details (Conditional) */}
                                    {entry.lyricsMode === 'paste' && (
                                        <textarea
                                            value={entry.lyricsText} onChange={(e) => updateEntry(entry.id, { lyricsText: e.target.value })}
                                            placeholder="貼上歌詞..."
                                            rows={2}
                                            style={{ width: '100%', padding: '6px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#aaa', fontSize: '11px', resize: 'vertical', boxSizing: 'border-box' }}
                                        />
                                    )}
                                    {entry.lyricsMode === 'import_search' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#888', background: '#1a1a1a', padding: '4px', borderRadius: '4px' }}>
                                            {entry.lyricsFilename ? (
                                                <>
                                                    <span style={{ background: entry.lyricsFormat === 'lrc' ? 'var(--accent-color)' : '#444', color: entry.lyricsFormat === 'lrc' ? '#000' : '#ccc', padding: '1px 3px', borderRadius: '2px', fontSize: '9px' }}>{entry.lyricsFormat?.toUpperCase()}</span>
                                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.lyricsFilename}</span>
                                                </>
                                            ) : (
                                                <div style={{ flex: 1, fontStyle: 'italic' }}>未選擇歌詞</div>
                                            )}
                                            <button onClick={() => { setActiveFileInputEntryId(entry.id); fileInputRef.current?.click(); }} style={{ fontSize: '10px', padding: '2px 6px', background: '#333', border: '1px solid #444', color: '#fff', borderRadius: '3px', cursor: 'pointer' }}>
                                                上傳
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {entry.status === 'error' && (
                                    <div style={{ fontSize: '11px', color: '#ff4444', marginTop: '6px' }}>
                                        {entry.errorMsg}
                                    </div>
                                )}
                            </div>
                        ))}

                        {entries.filter(e => e.sourceType === source).length === 0 && (
                            <div style={{ textAlign: 'center', color: '#555', padding: '40px 0', fontSize: '13px' }}>
                                {source === 'file' ? '尚未選擇任何檔案' : '尚未匯入有效連結'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '20px', borderTop: '1px solid #333', backgroundColor: '#202020', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                        onClick={handleConfirm}
                        disabled={busy || entries.filter(e => e.sourceType === source).length === 0}
                        style={{
                            width: '100%', padding: '12px', backgroundColor: 'var(--accent-color)', color: '#000', border: 'none', borderRadius: '8px',
                            fontWeight: 'bold', fontSize: '16px', cursor: (busy || entries.filter(e => e.sourceType === source).length === 0) ? 'not-allowed' : 'pointer', opacity: (busy || entries.filter(e => e.sourceType === source).length === 0) ? 0.7 : 1
                        }}
                    >
                        {busy ? `處理中...` : `確認新增 (${entries.filter(e => e.sourceType === source).length})`}
                    </button>
                </div>
            </div>

            <LyricsSearchPane
                isOpen={showSearchPane}
                onClose={() => { setShowSearchPane(false); setActiveEntryId(null); }}
                initialQuery={activeEntryId ? (entries.find(e => e.id === activeEntryId)?.title || '') + ' ' + (entries.find(e => e.id === activeEntryId)?.artist || '') : ''}
                onSelect={(content, type, name, artist) => handleLyricsSelect(content, type, name, artist)}
            />

            <input
                type="file"
                ref={fileInputRef}
                accept=".lrc,.txt"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
            />
        </>
    );
};

export default AddSongSidebar;
