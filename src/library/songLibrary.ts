import type { SongMeta, SongType } from '../../shared/songTypes';

const getApi = () => {
  if (window.khelper?.songLibrary) return window.khelper.songLibrary;
  throw new Error('Library API is not available on window.khelper.songLibrary');
};

const getDialogs = () => {
  if (window.khelper?.dialogs) return window.khelper.dialogs;
  if (window.api && !!window.api.openAudioFileDialog) {
    // Backward compatibility for Phase 1
    return {
      pickAudioFile: () => window.api!.openAudioFileDialog(),
    };
  }
  throw new Error('Dialog API is not available');
};

export async function pickAudioFile(): Promise<string | null> {
  return getDialogs().pickAudioFile();
}

export async function addLocalSong(params: {
  sourcePath: string;
  title: string;
  artist?: string;
  type: SongType;
  lyricsText?: string;
  lyricsLrc?: string;
}): Promise<SongMeta> {
  const api = getApi();
  const meta = await api.addLocalSong(params);
  console.log('[Library] Added song', meta.id, meta.title);
  return meta;
}

export async function loadAllSongs(): Promise<SongMeta[]> {
  const api = getApi();
  const songs = await api.loadAllSongs();
  console.log('[Library] Loaded songs from disk', songs.length);
  return songs;
}

export async function getSongFilePath(id: string): Promise<string | null> {
  const api = getApi();
  const filePath = await api.getSongFilePath(id);
  console.log('[Library] Resolved song file path', { id, filePath });
  return filePath;
}

export async function getOriginalSongFilePath(id: string): Promise<string | null> {
  const api = getApi();
  const filePath = await api.getOriginalSongFilePath(id);
  console.log('[Library] Resolved original song file path', { id, filePath });
  return filePath;
}

export async function getSeparatedSongPaths(id: string): Promise<{ instrumental: string; vocal: string | null }> {
  const api = getApi();
  // @ts-ignore - API might not be typed yet in window.khelper
  if (api.getSeparatedSongPaths) {
    const paths = await api.getSeparatedSongPaths(id);
    console.log('[Library] Resolved separated paths', { id, paths });
    return paths;
  }
  // Fallback for older backend? (Shouldn't happen in dev)
  const original = await getOriginalSongFilePath(id);
  return { instrumental: original || '', vocal: null };
}

export type { SongMeta, SongType };
