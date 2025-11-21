/// <reference types="vite/client" />

interface Window {
  ipcRenderer: import('electron').IpcRenderer;
  api: {
    openAudioFileDialog: () => Promise<string | null>;
    openOverlayWindow: () => void;
    sendOverlayUpdate: (payload: { songId: string; currentTime: number; isPlaying: boolean }) => void;
    subscribeOverlayUpdates: (callback: (payload: { songId: string; currentTime: number; isPlaying: boolean }) => void) => () => void;
  };
  khelper?: {
    dialogs: {
      pickAudioFile: () => Promise<string | null>;
    };
    songLibrary: {
      addLocalSong: (payload: {
        sourcePath: string;
        title: string;
        artist?: string;
        type: import('../shared/songTypes').SongType;
        lyricsText?: string;
      }) => Promise<import('../shared/songTypes').SongMeta>;
      loadAllSongs: () => Promise<import('../shared/songTypes').SongMeta[]>;
      getSongFilePath: (id: string) => Promise<string | null>;
      getOriginalSongFilePath: (id: string) => Promise<string | null>;
      getBasePath: () => Promise<string>;
    };
    jobs: {
      queueSeparationJob: (songId: string) => Promise<import('../shared/separationTypes').SeparationJob>;
      getAllJobs: () => Promise<import('../shared/separationTypes').SeparationJob[]>;
      subscribeJobUpdates: (
        callback: (jobs: import('../shared/separationTypes').SeparationJob[]) => void
      ) => () => void;
    };
    lyrics: {
      readRawLyrics: (songId: string) => Promise<{ path: string; content: string } | null>;
      readSyncedLyrics: (songId: string) => Promise<{ path: string; content: string } | null>;
      writeRawLyrics: (payload: { songId: string; content: string }) => Promise<{ path: string; meta: import('../shared/songTypes').SongMeta }>;
      writeSyncedLyrics: (payload: { songId: string; content: string }) => Promise<{ path: string; meta: import('../shared/songTypes').SongMeta }>;
    };
    queue: {
      save: (payload: { songIds: string[]; currentIndex: number }) => Promise<void>;
      load: () => Promise<{ songIds: string[]; currentIndex: number } | null>;
    };
  };
}
