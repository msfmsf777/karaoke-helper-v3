import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SongType } from '../../shared/songTypes';
import LyricsSearchPane from './LyricsSearchPane';
import type { YouTubeDownloadTarget } from './YouTubeDownloadControl';
import { queueYouTubeDownload, youtubeIdToUrl } from '../utils/onlineSongs';

interface OnlineDownloadPanelProps {
    target: YouTubeDownloadTarget;
    onClose: () => void;
    onQueued?: () => void;
}

const fieldStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '13px',
    outline: 'none',
};

const labelStyle: React.CSSProperties = {
    color: '#b3b3b3',
    fontSize: '13px',
    marginBottom: '6px',
};

const OnlineDownloadPanel: React.FC<OnlineDownloadPanelProps> = ({ target, onClose, onQueued }) => {
    const [title, setTitle] = useState(target.title);
    const [artist, setArtist] = useState(target.artist || '');
    const [type, setType] = useState<SongType>('原曲');
    const [quality, setQuality] = useState<'best' | 'high' | 'normal'>('high');
    const [lyricsMode, setLyricsMode] = useState<'none' | 'paste' | 'import_search'>('none');
    const [lyricsText, setLyricsText] = useState('');
    const [lyricsLrc, setLyricsLrc] = useState('');
    const [lyricsFormat, setLyricsFormat] = useState<'txt' | 'lrc' | undefined>();
    const [lyricsFilename, setLyricsFilename] = useState('');
    const [showSearchPane, setShowSearchPane] = useState(false);

    useEffect(() => {
        setTitle(target.title);
        setArtist(target.artist || '');
        setType('原曲');
        setQuality('high');
        setLyricsMode('none');
        setLyricsText('');
        setLyricsLrc('');
        setLyricsFormat(undefined);
        setLyricsFilename('');
        setShowSearchPane(false);
    }, [target.youtubeId, target.title, target.artist]);

    const handleLyricsSelect = (content: string, format: 'txt' | 'lrc', name?: string, selectedArtist?: string) => {
        setLyricsFormat(format);
        setLyricsText(format === 'txt' ? content : '');
        setLyricsLrc(format === 'lrc' ? content : '');
        setLyricsFilename(`搜尋結果: ${name || title} - ${selectedArtist || artist || ''}`);
        setShowSearchPane(false);
    };

    const handleSubmit = () => {
        if (!title.trim()) return;

        const promise = queueYouTubeDownload({
            youtubeId: target.youtubeId,
            title: title.trim(),
            artist: artist.trim() || undefined,
            type,
            quality,
            lyricsText: lyricsMode === 'paste' ? lyricsText : (lyricsMode === 'import_search' && lyricsFormat === 'txt' ? lyricsText : undefined),
            lyricsLrc: lyricsMode === 'import_search' && lyricsFormat === 'lrc' ? lyricsLrc : undefined,
        });

        onClose();
        promise.then(() => onQueued?.()).catch((err) => {
            console.error('Failed to queue custom YouTube download', err);
        });
    };

    return createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 12000 }}>
            <div
                style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', zIndex: 0 }}
                onClick={onClose}
            />

            <LyricsSearchPane
                isOpen={showSearchPane}
                onClose={() => setShowSearchPane(false)}
                initialQuery={`${title} ${artist}`.trim()}
                onSelect={handleLyricsSelect}
            />

            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: '450px',
                    backgroundColor: '#1f1f1f',
                    borderLeft: '1px solid #333',
                    boxShadow: '-5px 0 30px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 301,
                    color: '#fff',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#252525' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>自訂下載</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '20px', padding: '4px' }}>×</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ background: '#1a1a1a', color: '#777', fontSize: '11px', padding: '6px 8px', borderRadius: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {youtubeIdToUrl(target.youtubeId)}
                    </div>

                    <div>
                        <div style={labelStyle}>標題</div>
                        <input style={fieldStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="歌曲標題" />
                    </div>

                    <div>
                        <div style={labelStyle}>歌手</div>
                        <input style={fieldStyle} value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="歌手（選填）" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <div style={labelStyle}>類型</div>
                            <select style={fieldStyle} value={type} onChange={(e) => setType(e.target.value as SongType)}>
                                <option value="原曲">原曲</option>
                                <option value="伴奏">伴奏</option>
                            </select>
                        </div>
                        <div>
                            <div style={labelStyle}>音質</div>
                            <select style={fieldStyle} value={quality} onChange={(e) => setQuality(e.target.value as 'best' | 'high' | 'normal')}>
                                <option value="normal">普通（節省空間）</option>
                                <option value="high">高音質（標準）</option>
                                <option value="best">最佳（檔案較大）</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <div style={labelStyle}>歌詞</div>
                        <select
                            style={fieldStyle}
                            value={lyricsMode}
                            onChange={(e) => {
                                setLyricsMode(e.target.value as 'none' | 'paste' | 'import_search');
                                setShowSearchPane(false);
                            }}
                        >
                            <option value="none">無歌詞</option>
                            <option value="paste">貼上純文字</option>
                            <option value="import_search">搜尋/匯入</option>
                        </select>
                    </div>

                    {lyricsMode === 'paste' && (
                        <textarea
                            value={lyricsText}
                            onChange={(e) => setLyricsText(e.target.value)}
                            placeholder="貼上歌詞..."
                            rows={7}
                            style={{ ...fieldStyle, color: '#aaa', resize: 'vertical', lineHeight: 1.5 }}
                        />
                    )}

                    {lyricsMode === 'import_search' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button
                                onClick={() => setShowSearchPane(true)}
                                style={{ padding: '8px 12px', background: '#333', border: showSearchPane ? '1px solid var(--accent-color)' : '1px solid #444', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', textAlign: 'left' }}
                            >
                                搜尋歌詞
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#888', background: '#1a1a1a', padding: '6px', borderRadius: '4px' }}>
                                {lyricsFilename ? (
                                    <>
                                        <span style={{ background: lyricsFormat === 'lrc' ? 'var(--accent-color)' : '#444', color: lyricsFormat === 'lrc' ? '#000' : '#ccc', padding: '1px 4px', borderRadius: '2px', fontSize: '10px' }}>{lyricsFormat?.toUpperCase()}</span>
                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lyricsFilename}</span>
                                    </>
                                ) : (
                                    <span style={{ flex: 1, fontStyle: 'italic' }}>未選擇歌詞</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ padding: '20px', borderTop: '1px solid #333', backgroundColor: '#202020', display: 'flex', gap: '10px' }}>
                    <button
                        onClick={onClose}
                        style={{ flex: 1, padding: '11px', background: '#333', color: '#ddd', border: '1px solid #444', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!title.trim()}
                        style={{
                            flex: 2,
                            padding: '11px',
                            backgroundColor: !title.trim() ? '#555' : 'var(--accent-color)',
                            color: !title.trim() ? '#aaa' : '#000',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: !title.trim() ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold',
                            fontSize: '15px',
                        }}
                    >
                        加入下載佇列
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default OnlineDownloadPanel;
