import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { SongType } from '../../shared/songTypes';
import LyricsSearchPane from './LyricsSearchPane';
import type { YouTubeDownloadTarget } from './YouTubeDownloadControl';
import { queueYouTubeDownload, youtubeIdToUrl } from '../utils/onlineSongs';
import { getSongTypeLabel } from '../i18n/domainLabels';
import SearchIcon from '../assets/icons/search.svg';

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
    const { t } = useTranslation();
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
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        setLyricsFilename(t('songManagement.onlineDownload.searchResult', { name: name || title, artist: selectedArtist || artist || '' }));
        setShowSearchPane(false);
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (readerEvent) => {
            const content = String(readerEvent.target?.result || '');
            const format = file.name.toLowerCase().endsWith('.lrc') ? 'lrc' : 'txt';
            setLyricsFormat(format);
            setLyricsText(format === 'txt' ? content : '');
            setLyricsLrc(format === 'lrc' ? content : '');
            setLyricsFilename(file.name);
        };
        reader.readAsText(file);
        event.target.value = '';
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
                    <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>{t('songManagement.onlineDownload.title')}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '20px', padding: '4px' }}>×</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ background: '#1a1a1a', color: '#777', fontSize: '11px', padding: '6px 8px', borderRadius: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {youtubeIdToUrl(target.youtubeId)}
                    </div>

                    <div>
                        <div style={labelStyle}>{t('songManagement.onlineDownload.titleLabel')}</div>
                        <input style={fieldStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('songManagement.onlineDownload.titlePlaceholder')} />
                    </div>

                    <div>
                        <div style={labelStyle}>{t('songManagement.onlineDownload.artistLabel')}</div>
                        <input style={fieldStyle} value={artist} onChange={(e) => setArtist(e.target.value)} placeholder={t('songManagement.onlineDownload.artistPlaceholder')} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <div style={labelStyle}>{t('songManagement.onlineDownload.typeLabel')}</div>
                            <select style={fieldStyle} value={type} onChange={(e) => setType(e.target.value as SongType)}>
                                <option value="原曲">{getSongTypeLabel(t, '原曲')}</option>
                                <option value="伴奏">{getSongTypeLabel(t, '伴奏')}</option>
                            </select>
                        </div>
                        <div>
                            <div style={labelStyle}>{t('songManagement.onlineDownload.qualityLabel')}</div>
                            <select style={fieldStyle} value={quality} onChange={(e) => setQuality(e.target.value as 'best' | 'high' | 'normal')}>
                                <option value="normal">{t('songManagement.onlineDownload.quality.normal')}</option>
                                <option value="high">{t('songManagement.onlineDownload.quality.high')}</option>
                                <option value="best">{t('songManagement.onlineDownload.quality.best')}</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <div style={labelStyle}>{t('songManagement.onlineDownload.lyricsLabel')}</div>
                        <select
                            style={fieldStyle}
                            value={lyricsMode}
                            onChange={(e) => {
                                setLyricsMode(e.target.value as 'none' | 'paste' | 'import_search');
                                setShowSearchPane(false);
                            }}
                        >
                            <option value="none">{t('songManagement.onlineDownload.lyricsMode.none')}</option>
                            <option value="paste">{t('songManagement.onlineDownload.lyricsMode.paste')}</option>
                            <option value="import_search">{t('songManagement.onlineDownload.lyricsMode.importSearch')}</option>
                        </select>
                    </div>

                    {lyricsMode === 'paste' && (
                        <textarea
                            value={lyricsText}
                            onChange={(e) => setLyricsText(e.target.value)}
                            placeholder={t('songManagement.onlineDownload.lyricsPlaceholder')}
                            rows={7}
                            style={{ ...fieldStyle, color: '#aaa', resize: 'vertical', lineHeight: 1.5 }}
                        />
                    )}

                    {lyricsMode === 'import_search' && (
                        <div style={{ display: 'flex', alignItems: 'stretch', gap: '8px' }}>
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#888', background: '#1a1a1a', padding: '7px 8px', border: '1px solid #333', borderRadius: '4px' }}>
                                {lyricsFilename ? (
                                    <>
                                        <span style={{ background: lyricsFormat === 'lrc' ? 'var(--accent-color)' : '#444', color: lyricsFormat === 'lrc' ? '#000' : '#ccc', padding: '1px 4px', borderRadius: '2px', fontSize: '10px' }}>{lyricsFormat?.toUpperCase()}</span>
                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lyricsFilename}</span>
                                    </>
                                ) : (
                                    <span style={{ flex: 1, fontStyle: 'italic' }}>{t('songManagement.onlineDownload.noLyricsSelected')}</span>
                                )}
                            </div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                style={{ padding: '0 10px', background: '#333', border: '1px solid #444', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                            >
                                {t('songManagement.onlineDownload.import')}
                            </button>
                            <button
                                onClick={() => setShowSearchPane(true)}
                                title={t('songManagement.onlineDownload.searchLyrics')}
                                style={{ width: '34px', background: '#333', border: showSearchPane ? '1px solid var(--accent-color)' : '1px solid #444', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                            >
                                <img src={SearchIcon} alt="" style={{ width: '15px', height: '15px', display: 'block' }} />
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ padding: '20px', borderTop: '1px solid #333', backgroundColor: '#202020', display: 'flex', gap: '10px' }}>
                    <button
                        onClick={onClose}
                        style={{ flex: 1, padding: '11px', background: '#333', color: '#ddd', border: '1px solid #444', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
                    >
                        {t('common.cancel')}
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
                        {t('songManagement.onlineDownload.enqueue')}
                    </button>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".lrc,.txt"
                    style={{ display: 'none' }}
                    onChange={handleFileImport}
                />
            </div>
        </div>,
        document.body
    );
};

export default OnlineDownloadPanel;
