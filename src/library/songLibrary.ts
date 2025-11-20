import type { SongMeta, SongType } from '../../shared/songTypes';

const getApi = () => {
  if (window.khelper?.songLibrary) return window.khelper.songLibrary;
  throw new Error('Library API is not available on window.khelper.songLibrary');
};

const getDialogs = () => {
  if (window.khelper?.dialogs) return window.khelper.dialogs;
  if (window.api?.openAudioFileDialog) {
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

export type { SongMeta, SongType };
