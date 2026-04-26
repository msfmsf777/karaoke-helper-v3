import { useEffect } from 'react';
import type { SongMeta } from '../../shared/songTypes';

const requestedSongIds = new Set<string>();

export function useEnsureYoutubeThumbnail(song?: SongMeta | null) {
    useEffect(() => {
        if (!song) return;
        if (song.audio_status === 'streaming') return;
        if (song.source.kind !== 'youtube') return;
        if (requestedSongIds.has(song.id)) return;
        if (!window.khelper?.songLibrary?.ensureYoutubeThumbnail) return;

        requestedSongIds.add(song.id);
        window.khelper.songLibrary.ensureYoutubeThumbnail(song.id).catch((error) => {
            console.warn('[Artwork] Failed to ensure YouTube thumbnail', song.id, error);
        });
    }, [song?.id, song?.audio_status, song?.source.kind, song?.thumbnail_path]);
}
