import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { SongType } from '../../shared/songTypes';
import DownloadIcon from '../assets/icons/download.svg';
import CheckIcon from '../assets/icons/check.svg';
import CloudIcon from '../assets/icons/cloud.svg';
import EditIcon from '../assets/icons/edit.svg';
import { DownloadState, queueYouTubeDownload } from '../utils/onlineSongs';
import { getSongTypeLabel } from '../i18n/domainLabels';

export interface YouTubeDownloadTarget {
    youtubeId: string;
    title: string;
    artist?: string;
}

interface YouTubeDownloadControlProps {
    target: YouTubeDownloadTarget;
    state?: DownloadState;
    variant?: 'search' | 'status';
    rowHovered?: boolean;
    onQueued?: () => void;
    onCustomDownload: (target: YouTubeDownloadTarget) => void;
}

const isLockedState = (state?: DownloadState) => state?.kind === 'downloaded' || state?.kind === 'active';

const getActiveLabel = (state: DownloadState, t: TFunction) => {
    if (state.kind !== 'active') return '';
    if (state.job.status === 'queued') return t('songManagement.download.activeQueued');
    if (state.job.status === 'processing') return t('songManagement.download.activeProcessing');
    return t('songManagement.download.activeProgress', { progress: Math.round(state.job.progress || 0) });
};

const actionButtonStyle: React.CSSProperties = {
    width: '34px',
    minWidth: '34px',
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: '#d8d8d8',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    fontSize: '10px',
    lineHeight: 1.1,
};

export const YouTubeDownloadControl: React.FC<YouTubeDownloadControlProps> = ({
    target,
    state = { kind: 'none' },
    variant = 'search',
    rowHovered = false,
    onQueued,
    onCustomDownload,
}) => {
    const { t } = useTranslation();

    const queueQuick = async (type: SongType) => {
        if (isLockedState(state)) return;
        try {
            await queueYouTubeDownload({ ...target, type, quality: 'high' });
            onQueued?.();
        } catch (err) {
            console.error('Failed to queue YouTube download', err);
        }
    };

    if (state.kind === 'active') {
        return (
            <span style={{ color: '#b8d7ff', fontSize: '12px', whiteSpace: 'nowrap' }}>
                {getActiveLabel(state, t)}
            </span>
        );
    }

    if (state.kind === 'downloaded') {
        if (rowHovered) {
            return <span style={{ color: '#8be28b', fontSize: '12px', whiteSpace: 'nowrap' }}>{t('songManagement.download.downloaded')}</span>;
        }
        return (
            <span
                title={t('songManagement.download.downloaded')}
                style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: 'rgba(76,175,80,0.18)',
                    border: '1px solid rgba(139,226,139,0.55)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <img src={CheckIcon} alt="" style={{ width: '14px', height: '14px', display: 'block' }} />
            </span>
        );
    }

    if (!rowHovered) {
        return (
            <button
                type="button"
                title={state.kind === 'failed' ? t('songManagement.download.failed') : t('songManagement.download.options')}
                onClick={(e) => {
                    e.stopPropagation();
                    if (state.kind !== 'failed') onCustomDownload(target);
                }}
                style={{
                    width: '24px',
                    height: '24px',
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    cursor: state.kind === 'failed' ? 'default' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {state.kind === 'failed' ? (
                    <span style={{ color: '#ff8b8b', fontSize: '12px' }}>{t('domain.downloadStatus.failed')}</span>
                ) : (
                    <img
                        src={variant === 'status' ? CloudIcon : DownloadIcon}
                        alt=""
                        style={{ width: '20px', height: '20px', display: 'block', opacity: 0.78 }}
                    />
                )}
            </button>
        );
    }

    return (
        <div
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                minWidth: '110px',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                title={t('songManagement.download.downloadAs', { type: getSongTypeLabel(t, '原曲') })}
                onClick={() => queueQuick('原曲')}
                style={actionButtonStyle}
            >
                <img src={DownloadIcon} alt="" style={{ width: '15px', height: '15px', display: 'block' }} />
                <span>{getSongTypeLabel(t, '原曲')}</span>
            </button>
            <button
                type="button"
                title={t('songManagement.download.downloadAs', { type: getSongTypeLabel(t, '伴奏') })}
                onClick={() => queueQuick('伴奏')}
                style={actionButtonStyle}
            >
                <img src={DownloadIcon} alt="" style={{ width: '15px', height: '15px', display: 'block' }} />
                <span>{getSongTypeLabel(t, '伴奏')}</span>
            </button>
            <button
                type="button"
                title={t('songManagement.download.customDownload')}
                onClick={() => onCustomDownload(target)}
                style={actionButtonStyle}
            >
                <img src={EditIcon} alt="" style={{ width: '15px', height: '15px', display: 'block' }} />
                <span>{t('songManagement.download.custom')}</span>
            </button>
        </div>
    );
};

export default YouTubeDownloadControl;
