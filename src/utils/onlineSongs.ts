import type { DownloadJob, SongMeta, SongType } from '../../shared/songTypes';
import i18n from '../i18n';
import {
    formatViewCount as formatLocalizedViewCount,
    getLyricsStatusLabel,
} from '../i18n/domainLabels';

export interface YouTubeResultLike {
    videoId: string;
    title: string;
    artist?: string;
    thumbnailUrl?: string;
    duration?: number | { seconds?: number; timestamp?: string };
    views?: number;
    ago?: string;
}

export type DownloadState =
    | { kind: 'downloaded'; song: SongMeta }
    | { kind: 'active'; job: DownloadJob }
    | { kind: 'failed'; job: DownloadJob }
    | { kind: 'none' };

export const coerceDurationSeconds = (duration: unknown): number | undefined => {
    if (typeof duration === 'number' && Number.isFinite(duration)) return duration;
    if (duration && typeof duration === 'object') {
        const seconds = (duration as { seconds?: unknown }).seconds;
        if (typeof seconds === 'number' && Number.isFinite(seconds)) return seconds;
    }
    return undefined;
};

export const youtubeIdToUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;

export const getSongYoutubeId = (song: SongMeta): string | null => {
    return song.source.kind === 'youtube' ? song.source.youtubeId : null;
};

export const getStreamingSongThumbnailUrl = (song?: SongMeta | null): string | undefined => {
    if (!song || song.audio_status !== 'streaming' || song.source.kind !== 'youtube') return undefined;
    return song.thumbnailUrl || `https://i.ytimg.com/vi/${song.source.youtubeId}/hqdefault.jpg`;
};

export const getYtDurationSeconds = (yt: YouTubeResultLike): number | undefined => {
    return coerceDurationSeconds(yt.duration);
};

export const getYtDurationTimestamp = (yt: YouTubeResultLike): string => {
    const seconds = coerceDurationSeconds(yt.duration);
    if (seconds !== undefined) return formatDuration(seconds);
    return typeof yt.duration === 'object' ? yt.duration?.timestamp || '--:--' : '--:--';
};

export const findSongByYoutubeId = (songs: SongMeta[], youtubeId: string): SongMeta | undefined => {
    return songs.find(song => song.source.kind === 'youtube' && song.source.youtubeId === youtubeId);
};

export const getDownloadState = (
    allSongs: SongMeta[],
    downloadJobs: DownloadJob[],
    youtubeId: string
): DownloadState => {
    const song = findSongByYoutubeId(allSongs, youtubeId);
    if (song && song.audio_status !== 'streaming') {
        return { kind: 'downloaded', song };
    }

    const job = downloadJobs.find(j => j.youtubeId === youtubeId);
    if (!job) return { kind: 'none' };
    if (job.status === 'failed') return { kind: 'failed', job };
    if (job.status === 'queued' || job.status === 'downloading' || job.status === 'processing') {
        return { kind: 'active', job };
    }
    if (job.status === 'completed' && song) {
        return { kind: 'downloaded', song };
    }
    return { kind: 'none' };
};

export const ensureOnlineSong = async (
    yt: YouTubeResultLike,
    refreshSongs?: () => Promise<void>
): Promise<SongMeta | null> => {
    const meta = await window.khelper?.songLibrary.addOnlineSong({
        youtubeId: yt.videoId,
        title: yt.title,
        artist: yt.artist,
        thumbnailUrl: yt.thumbnailUrl,
        duration: getYtDurationSeconds(yt),
    });

    if (meta && refreshSongs) {
        await refreshSongs();
    }
    return meta || null;
};

export const queueYouTubeDownload = async (params: {
    youtubeId: string;
    title: string;
    artist?: string;
    type: SongType;
    quality?: 'best' | 'high' | 'normal';
    lyricsText?: string;
    lyricsLrc?: string;
}) => {
    return window.khelper?.downloads.queueDownload(
        youtubeIdToUrl(params.youtubeId),
        params.quality || 'high',
        params.title,
        params.artist,
        params.type,
        params.lyricsText,
        params.lyricsLrc
    );
};

export const formatDuration = (seconds?: unknown): string => {
    const value = coerceDurationSeconds(seconds);
    if (value === undefined) return '--:--';
    const mins = Math.floor(value / 60);
    const secs = Math.floor(value % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatViewCount = (views?: number): string => {
    return formatLocalizedViewCount(i18n.t, views);
};

export const lyricsLabel = (status?: SongMeta['lyrics_status']) => {
    return getLyricsStatusLabel(i18n.t, status, true);
};
