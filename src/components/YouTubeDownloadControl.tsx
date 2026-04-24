import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SongType } from '../../shared/songTypes';
import DownloadIcon from '../assets/icons/download.svg';
import CheckIcon from '../assets/icons/check.svg';
import WebIcon from '../assets/icons/web.svg';
import { DownloadState, queueYouTubeDownload } from '../utils/onlineSongs';

export interface YouTubeDownloadTarget {
    youtubeId: string;
    title: string;
    artist?: string;
}

interface CustomDownloadDialogProps {
    target: YouTubeDownloadTarget;
    position: { x: number; y: number };
    onClose: () => void;
    onQueued?: () => void;
}

const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '7px 8px',
    background: '#1f1f1f',
    border: '1px solid #3a3a3a',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '13px',
    outline: 'none',
};

const labelStyle: React.CSSProperties = {
    color: '#b3b3b3',
    fontSize: '12px',
    marginBottom: '4px',
};

export const CustomDownloadDialog: React.FC<CustomDownloadDialogProps> = ({
    target,
    position,
    onClose,
    onQueued,
}) => {
    const [title, setTitle] = useState(target.title);
    const [artist, setArtist] = useState(target.artist || '');
    const [type, setType] = useState<SongType>('原曲');
    const [quality, setQuality] = useState<'best' | 'high' | 'normal'>('high');
    const [lyricsMode, setLyricsMode] = useState<'none' | 'txt' | 'lrc'>('none');
    const [lyricsText, setLyricsText] = useState('');
    const [lyricsLrc, setLyricsLrc] = useState('');
    const [busy, setBusy] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    const [adjustedPosition, setAdjustedPosition] = useState(position);

    useEffect(() => {
        const handleOutside = (event: MouseEvent) => {
            if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [onClose]);

    useEffect(() => {
        if (!dialogRef.current) return;
        const rect = dialogRef.current.getBoundingClientRect();
        const next = { ...position };
        if (next.x + rect.width > window.innerWidth) next.x = window.innerWidth - rect.width - 12;
        if (next.y + rect.height > window.innerHeight) next.y = window.innerHeight - rect.height - 12;
        if (next.x < 8) next.x = 8;
        if (next.y < 8) next.y = 8;
        setAdjustedPosition(next);
    }, [position, lyricsMode]);

    const handleSubmit = async () => {
        if (!title.trim() || busy) return;
        setBusy(true);
        try {
            await queueYouTubeDownload({
                youtubeId: target.youtubeId,
                title: title.trim(),
                artist: artist.trim() || undefined,
                type,
                quality,
                lyricsText: lyricsMode === 'txt' ? lyricsText : undefined,
                lyricsLrc: lyricsMode === 'lrc' ? lyricsLrc : undefined,
            });
            onQueued?.();
            onClose();
        } catch (err) {
            console.error('Failed to queue custom YouTube download', err);
        } finally {
            setBusy(false);
        }
    };

    return createPortal(
        <div
            ref={dialogRef}
            data-online-download-dialog="true"
            style={{
                position: 'fixed',
                left: adjustedPosition.x,
                top: adjustedPosition.y,
                width: '320px',
                background: '#2d2d2d',
                border: '1px solid #3a3a3a',
                borderRadius: '8px',
                boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
                padding: '14px',
                zIndex: 12000,
                color: '#fff',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div style={{ fontWeight: 700, marginBottom: '12px' }}>自訂下載</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                    <div style={labelStyle}>標題</div>
                    <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                    <div style={labelStyle}>歌手</div>
                    <input style={inputStyle} value={artist} onChange={(e) => setArtist(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                        <div style={labelStyle}>類型</div>
                        <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value as SongType)}>
                            <option value="原曲">原曲</option>
                            <option value="伴奏">伴奏</option>
                        </select>
                    </div>
                    <div>
                        <div style={labelStyle}>音質</div>
                        <select style={inputStyle} value={quality} onChange={(e) => setQuality(e.target.value as any)}>
                            <option value="normal">普通</option>
                            <option value="high">高音質</option>
                            <option value="best">最佳</option>
                        </select>
                    </div>
                </div>
                <div>
                    <div style={labelStyle}>歌詞</div>
                    <select style={inputStyle} value={lyricsMode} onChange={(e) => setLyricsMode(e.target.value as any)}>
                        <option value="none">不加入歌詞</option>
                        <option value="txt">貼上純文字</option>
                        <option value="lrc">貼上 LRC</option>
                    </select>
                </div>
                {lyricsMode !== 'none' && (
                    <textarea
                        value={lyricsMode === 'txt' ? lyricsText : lyricsLrc}
                        onChange={(e) => lyricsMode === 'txt' ? setLyricsText(e.target.value) : setLyricsLrc(e.target.value)}
                        placeholder={lyricsMode === 'txt' ? '貼上歌詞文字...' : '貼上 LRC 內容...'}
                        style={{ ...inputStyle, minHeight: '86px', resize: 'vertical' }}
                    />
                )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
                <button
                    onClick={onClose}
                    style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid #444', background: '#333', color: '#ddd', cursor: 'pointer' }}
                >
                    取消
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={busy || !title.trim()}
                    style={{
                        padding: '7px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: busy || !title.trim() ? '#555' : 'var(--accent-color)',
                        color: busy || !title.trim() ? '#aaa' : '#000',
                        fontWeight: 700,
                        cursor: busy || !title.trim() ? 'not-allowed' : 'pointer',
                    }}
                >
                    {busy ? '加入中...' : '加入下載佇列'}
                </button>
            </div>
        </div>,
        document.body
    );
};

interface YouTubeDownloadControlProps {
    target: YouTubeDownloadTarget;
    state?: DownloadState;
    variant?: 'search' | 'status' | 'compact';
    onQueued?: () => void;
}

const optionStyle: React.CSSProperties = {
    padding: '8px 12px',
    cursor: 'pointer',
    color: '#fff',
    whiteSpace: 'nowrap',
    fontSize: '13px',
};

const isDisabledState = (state?: DownloadState) => state?.kind === 'downloaded' || state?.kind === 'active';

export const YouTubeDownloadControl: React.FC<YouTubeDownloadControlProps> = ({
    target,
    state,
    variant = 'search',
    onQueued,
}) => {
    const [showOptions, setShowOptions] = useState(false);
    const [customPosition, setCustomPosition] = useState<{ x: number; y: number } | null>(null);
    const closeTimer = useRef<NodeJS.Timeout | null>(null);

    const queueQuick = async (type: SongType) => {
        if (isDisabledState(state)) return;
        try {
            await queueYouTubeDownload({ ...target, type, quality: 'high' });
            onQueued?.();
            setShowOptions(false);
        } catch (err) {
            console.error('Failed to queue YouTube download', err);
        }
    };

    const openCustom = (event: React.MouseEvent) => {
        if (isDisabledState(state)) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setCustomPosition({ x: rect.right + 8, y: rect.top - 8 });
        setShowOptions(false);
    };

    const startCloseTimer = () => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => setShowOptions(false), 220);
    };

    const cancelCloseTimer = () => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
    };

    const label = (() => {
        if (state?.kind === 'downloaded') return '已下載';
        if (state?.kind === 'active') {
            if (state.job.status === 'queued') return '佇列中';
            if (state.job.status === 'processing') return '處理中';
            return `${Math.round(state.job.progress || 0)}%`;
        }
        if (state?.kind === 'failed') return '失敗';
        return variant === 'status' ? '線上' : '下載';
    })();

    const icon = state?.kind === 'downloaded' ? CheckIcon : variant === 'status' ? WebIcon : DownloadIcon;
    const canOpenOptions = !isDisabledState(state);

    return (
        <div
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={() => {
                cancelCloseTimer();
                if (canOpenOptions) setShowOptions(true);
            }}
            onMouseLeave={startCloseTimer}
        >
            <button
                type="button"
                title={canOpenOptions ? '下載選項' : label}
                onClick={(e) => {
                    e.stopPropagation();
                    if (canOpenOptions) setShowOptions(prev => !prev);
                }}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    minWidth: variant === 'compact' ? '28px' : '72px',
                    height: variant === 'compact' ? '28px' : '30px',
                    padding: variant === 'compact' ? '0 6px' : '0 9px',
                    background: state?.kind === 'failed' ? 'rgba(255,128,128,0.12)' : 'rgba(255,255,255,0.06)',
                    border: state?.kind === 'failed' ? '1px solid rgba(255,128,128,0.35)' : '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '6px',
                    color: state?.kind === 'failed' ? '#ff8b8b' : state?.kind === 'downloaded' ? '#8be28b' : '#d8d8d8',
                    cursor: canOpenOptions ? 'pointer' : 'default',
                    fontSize: '12px',
                    fontWeight: 600,
                }}
            >
                <img src={icon} alt="" style={{ width: '16px', height: '16px', display: 'block' }} />
                {variant !== 'compact' && <span>{label}</span>}
            </button>

            {showOptions && canOpenOptions && (
                <div
                    style={{
                        position: 'absolute',
                        right: 0,
                        top: 'calc(100% + 6px)',
                        background: '#2d2d2d',
                        border: '1px solid #3a3a3a',
                        borderRadius: '8px',
                        padding: '6px 0',
                        minWidth: '150px',
                        zIndex: 11000,
                        boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
                    }}
                    onMouseEnter={cancelCloseTimer}
                    onMouseLeave={startCloseTimer}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={optionStyle} onClick={() => queueQuick('原曲')} onMouseEnter={(e) => e.currentTarget.style.background = '#3d3d3d'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        下載為原曲
                    </div>
                    <div style={optionStyle} onClick={() => queueQuick('伴奏')} onMouseEnter={(e) => e.currentTarget.style.background = '#3d3d3d'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        下載為伴奏
                    </div>
                    <div style={optionStyle} onClick={openCustom} onMouseEnter={(e) => e.currentTarget.style.background = '#3d3d3d'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        自訂下載...
                    </div>
                </div>
            )}

            {customPosition && (
                <CustomDownloadDialog
                    target={target}
                    position={customPosition}
                    onQueued={onQueued}
                    onClose={() => setCustomPosition(null)}
                />
            )}
        </div>
    );
};

export default YouTubeDownloadControl;
