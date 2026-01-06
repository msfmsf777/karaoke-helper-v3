export interface LrcLibTrack {
    id: number;
    name: string;
    artistName: string;
    albumName: string;
    duration: number;
    instrumental: boolean;
    plainLyrics: string;
    syncedLyrics: string;
}

export async function searchLyrics(query: string): Promise<LrcLibTrack[]> {
    try {
        const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'User-Agent': 'KHelperLive/1.0 (https://github.com/msfmsf777/karaoke-helper-v3)'
            }
        });
        if (!res.ok) {
            console.warn('[LyricsSearch] Search failed', res.status, res.statusText);
            return [];
        }
        return await res.json();
    } catch (err) {
        console.error('[LyricsSearch] Error fetching lyrics', err);
        return [];
    }
}
