import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { SongMeta } from '../../shared/songTypes';
import { useQueue } from '../contexts/QueueContext';
import { useUserData } from '../contexts/UserDataContext';
import AddToPlaylistMenu from './AddToPlaylistMenu';
import type { YouTubeDownloadTarget } from './YouTubeDownloadControl';
import { DownloadState, queueYouTubeDownload, youtubeIdToUrl } from '../utils/onlineSongs';
import { getSongTypeLabel } from '../i18n/domainLabels';

import PlayMenuIcon from '../assets/icons/play_menu.svg';
import QueueAddIcon from '../assets/icons/queue_add.svg';
import FavoritesIcon from '../assets/icons/favorites.svg';
import FavoritesFilledIcon from '../assets/icons/favorites_filled.svg';
import PlaylistItemIcon from '../assets/icons/playlist_item.svg';
import LyricsIcon from '../assets/icons/lyrics.svg';
import DownloadIcon from '../assets/icons/download.svg';
import SeparateIcon from '../assets/icons/separate.svg';
import LinkIcon from '../assets/icons/link.svg';
import OpenExternalIcon from '../assets/icons/open_external.svg';

interface OnlineSongContextMenuProps {
    song: SongMeta;
    position: { x: number; y: number };
    onClose: () => void;
    onEditLyrics?: (song: SongMeta) => void;
    onDownloadQueued?: () => void;
    onCustomDownload: (target: YouTubeDownloadTarget) => void;
    downloadState?: DownloadState;
}

const OnlineSongContextMenu: React.FC<OnlineSongContextMenuProps> = ({
    song,
    position,
    onClose,
    onEditLyrics,
    onDownloadQueued,
    onCustomDownload,
    downloadState = { kind: 'none' },
}) => {
    const { t } = useTranslation();
    const menuRef = useRef<HTMLDivElement>(null);
    const playlistItemRef = useRef<HTMLDivElement>(null);
    const downloadItemRef = useRef<HTMLDivElement>(null);
    const { playImmediate, addToQueue } = useQueue();
    const { isFavorite, toggleFavorite } = useUserData();
    const [adjustedPosition, setAdjustedPosition] = useState(position);
    const [activeSubmenu, setActiveSubmenu] = useState<'playlist' | 'download' | 'separation' | null>(null);
    const [playlistMenuPosition, setPlaylistMenuPosition] = useState({ x: 0, y: 0 });

    const youtubeId = song.source.kind === 'youtube' ? song.source.youtubeId : '';
    const videoUrl = youtubeIdToUrl(youtubeId);
    const target: YouTubeDownloadTarget = {
        youtubeId,
        title: song.title,
        artist: song.artist,
    };
    const isDownloaded = downloadState.kind === 'downloaded' || song.audio_status !== 'streaming';
    const isDownloading = downloadState.kind === 'active';
    const canSeparate = isDownloaded && song.type === '原曲';

    useLayoutEffect(() => {
        if (!menuRef.current) return;
        const rect = menuRef.current.getBoundingClientRect();
        const next = { ...position };
        if (next.y + rect.height > window.innerHeight) next.y = Math.max(10, next.y - rect.height);
        if (next.x + rect.width > window.innerWidth) next.x = window.innerWidth - rect.width - 10;
        setAdjustedPosition(next);
    }, [position, activeSubmenu]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const targetNode = event.target as Node;
            if (menuRef.current && !menuRef.current.contains(targetNode)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const itemStyle: React.CSSProperties = {
        padding: '8px 12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        position: 'relative',
        minHeight: '20px',
    };

    const iconStyle: React.CSSProperties = {
        width: '20px',
        height: '20px',
        opacity: 0.85,
        display: 'block',
        flexShrink: 0,
    };

    const separatorStyle: React.CSSProperties = {
        height: '1px',
        backgroundColor: '#3a3a3a',
        margin: '4px 0',
    };

    const hoverIn = (event: React.MouseEvent<HTMLDivElement>) => {
        event.currentTarget.style.backgroundColor = '#3d3d3d';
    };

    const hoverOut = (event: React.MouseEvent<HTMLDivElement>) => {
        event.currentTarget.style.backgroundColor = 'transparent';
    };

    const queueDownload = async (type: '原曲' | '伴奏') => {
        await queueYouTubeDownload({ ...target, type, quality: 'high' });
        onDownloadQueued?.();
        onClose();
    };

    const openCustomDownload = () => {
        onCustomDownload(target);
        onClose();
    };

    const getActiveDownloadLabel = () => {
        if (downloadState.kind !== 'active') return '';
        if (downloadState.job.status === 'queued') return t('songManagement.download.activeQueued');
        if (downloadState.job.status === 'processing') return t('songManagement.download.activeProcessing');
        return t('songManagement.download.activeProgress', { progress: Math.round(downloadState.job.progress || 0) });
    };

    return createPortal(
        <>
            <div
                ref={menuRef}
                style={{
                    position: 'fixed',
                    left: adjustedPosition.x,
                    top: adjustedPosition.y,
                    backgroundColor: '#2d2d2d',
                    border: '1px solid #3a3a3a',
                    borderRadius: '8px',
                    padding: '6px 0',
                    zIndex: 10000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    minWidth: '220px',
                    color: '#fff',
                    fontSize: '14px',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={itemStyle} onClick={() => { playImmediate(song.id); onClose(); }} onMouseOver={hoverIn} onMouseOut={hoverOut}>
                    <img src={PlayMenuIcon} alt="" style={iconStyle} />
                    <span>{t('common.play')}</span>
                </div>
                <div style={itemStyle} onClick={() => { addToQueue(song.id); onClose(); }} onMouseOver={hoverIn} onMouseOut={hoverOut}>
                    <img src={QueueAddIcon} alt="" style={iconStyle} />
                    <span>{t('songList.addToQueue')}</span>
                </div>

                <div style={separatorStyle} />

                <div style={itemStyle} onClick={() => { toggleFavorite(song.id); onClose(); }} onMouseOver={hoverIn} onMouseOut={hoverOut}>
                    <img src={isFavorite(song.id) ? FavoritesFilledIcon : FavoritesIcon} alt="" style={iconStyle} />
                    <span>{isFavorite(song.id) ? t('songManagement.removeFavorite') : t('songManagement.addFavorite')}</span>
                </div>
                <div
                    ref={playlistItemRef}
                    style={itemStyle}
                    onMouseEnter={(e) => {
                        hoverIn(e);
                        const rect = playlistItemRef.current?.getBoundingClientRect();
                        if (rect) setPlaylistMenuPosition({ x: rect.right - 5, y: rect.top });
                        setActiveSubmenu('playlist');
                    }}
                    onMouseLeave={(e) => {
                        hoverOut(e);
                    }}
                >
                    <img src={PlaylistItemIcon} alt="" style={iconStyle} />
                    <span style={{ flex: 1 }}>{t('songManagement.addToPlaylistEllipsis')}</span>
                    <span style={{ fontSize: '10px', opacity: 0.5 }}>▶</span>
                    {activeSubmenu === 'playlist' && (
                        <AddToPlaylistMenu
                            songId={song.id}
                            position={playlistMenuPosition}
                            onClose={() => setActiveSubmenu(null)}
                        />
                    )}
                </div>

                <div style={separatorStyle} />

                {isDownloading ? (
                    <div style={{ ...itemStyle, color: '#777', cursor: 'not-allowed' }}>
                        <img src={DownloadIcon} alt="" style={{ ...iconStyle, opacity: 0.35 }} />
                        <span style={{ flex: 1 }}>{getActiveDownloadLabel()}</span>
                    </div>
                ) : isDownloaded ? (
                    canSeparate && (() => {
                        const isSeparated = song.audio_status === 'separated';
                        const isSeparating = song.audio_status === 'separating' || song.audio_status === 'separation_pending';
                        const qualityValue = { fast: 1, normal: 2, high: 3 };
                        const currentQuality = song.separation_quality;
                        const currentVal = currentQuality ? qualityValue[currentQuality] : 0;

                        if (isSeparating || (isSeparated && currentVal === 3)) return null;

                        return (
                            <div
                                style={itemStyle}
                                onMouseEnter={(e) => {
                                    hoverIn(e);
                                    setActiveSubmenu('separation');
                                }}
                                onMouseLeave={hoverOut}
                            >
                                <img src={SeparateIcon} alt="" style={iconStyle} />
                                <span style={{ flex: 1 }}>{isSeparated ? t('songManagement.restartSeparation') : t('songManagement.startSeparation')}</span>
                                <span style={{ fontSize: '10px', opacity: 0.5 }}>▶</span>
                                {activeSubmenu === 'separation' && (
                                    <div style={{
                                        position: 'absolute',
                                        left: '100%',
                                        top: -4,
                                        backgroundColor: '#2d2d2d',
                                        border: '1px solid #3a3a3a',
                                        borderRadius: '8px',
                                        padding: '6px 0',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                        minWidth: '160px',
                                        marginLeft: '4px',
                                        zIndex: 10001,
                                    }}>
                                        {[
                                            { id: 'fast', label: t('songManagement.separationQuality.fast'), val: 1 },
                                            { id: 'normal', label: t('songManagement.separationQuality.normal'), val: 2 },
                                            { id: 'high', label: t('songManagement.separationQuality.high'), val: 3 },
                                        ].map((option) => {
                                            const isDisabled = isSeparated && option.val <= currentVal;
                                            return (
                                                <div
                                                    key={option.id}
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (isDisabled) return;
                                                        try {
                                                            const { queueSeparationJob } = await import('../jobs/separationJobs');
                                                            await queueSeparationJob(song.id, option.id as 'high' | 'normal' | 'fast');
                                                            onClose();
                                                        } catch (err) {
                                                            console.error('Failed to queue separation', err);
                                                        }
                                                    }}
                                                    style={{
                                                        ...itemStyle,
                                                        color: isDisabled ? '#666' : '#fff',
                                                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                    }}
                                                    onMouseOver={(e) => !isDisabled && (e.currentTarget.style.backgroundColor = '#3d3d3d')}
                                                    onMouseOut={(e) => !isDisabled && (e.currentTarget.style.backgroundColor = 'transparent')}
                                                >
                                                    {option.label}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })()
                ) : (
                    <div
                        ref={downloadItemRef}
                        style={itemStyle}
                        onMouseEnter={(e) => {
                            hoverIn(e);
                            setActiveSubmenu('download');
                        }}
                        onMouseLeave={hoverOut}
                    >
                        <img src={DownloadIcon} alt="" style={iconStyle} />
                        <span style={{ flex: 1 }}>{t('songManagement.download.downloadEllipsis')}</span>
                        <span style={{ fontSize: '10px', opacity: 0.5 }}>▶</span>
                        {activeSubmenu === 'download' && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: '100%',
                                    top: -4,
                                    backgroundColor: '#2d2d2d',
                                    border: '1px solid #3a3a3a',
                                    borderRadius: '8px',
                                    padding: '6px 0',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                    minWidth: '150px',
                                    marginLeft: '4px',
                                    zIndex: 10001,
                                }}
                            >
                                <div style={itemStyle} onClick={() => queueDownload('原曲')} onMouseOver={hoverIn} onMouseOut={hoverOut}>
                                    {t('songManagement.download.downloadAs', { type: getSongTypeLabel(t, '原曲') })}
                                </div>
                                <div style={itemStyle} onClick={() => queueDownload('伴奏')} onMouseOver={hoverIn} onMouseOut={hoverOut}>
                                    {t('songManagement.download.downloadAs', { type: getSongTypeLabel(t, '伴奏') })}
                                </div>
                                <div style={itemStyle} onClick={openCustomDownload} onMouseOver={hoverIn} onMouseOut={hoverOut}>{t('songManagement.download.customDownloadEllipsis')}</div>
                            </div>
                        )}
                    </div>
                )}
                <div style={itemStyle} onClick={() => { onEditLyrics?.(song); onClose(); }} onMouseOver={hoverIn} onMouseOut={hoverOut}>
                    <img src={LyricsIcon} alt="" style={iconStyle} />
                    <span>{t('songManagement.editLyrics')}</span>
                </div>

                <div style={separatorStyle} />

                <div
                    style={{ ...itemStyle, gap: '10px' }}
                    onClick={async () => {
                        await navigator.clipboard.writeText(videoUrl);
                        onClose();
                    }}
                    onMouseOver={hoverIn}
                    onMouseOut={hoverOut}
                >
                    <img src={LinkIcon} alt="" style={iconStyle} />
                    <span style={{ flex: 1 }}>{t('songManagement.copyVideoLink')}</span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            window.api.openExternal(videoUrl);
                            onClose();
                        }}
                        title={t('songManagement.openInBrowser')}
                        style={{
                            border: '1px solid #555',
                            background: '#333',
                            color: '#ddd',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '22px',
                            height: '22px',
                        }}
                    >
                        <img src={OpenExternalIcon} alt="" style={{ width: '14px', height: '14px', display: 'block' }} />
                    </button>
                </div>
            </div>
        </>,
        document.body
    );
};

export default OnlineSongContextMenu;
