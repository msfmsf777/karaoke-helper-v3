/// <reference types="vite/client" />

declare module '*.svg' {
  const content: string;
  export default content;
}

interface Window {
  ipcRenderer: {
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => () => void;
    off: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
    send: (channel: string, ...args: any[]) => void;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
  };
  api: {
    openAudioFileDialog: () => Promise<string | null>;
    openExternal: (url: string) => Promise<void>;
    openOverlayWindow: () => void;
    sendOverlayUpdate: (payload: { songId: string; currentTime: number; isPlaying: boolean; queue?: string[]; currentIndex?: number; isStreamWaiting?: boolean }) => void;
    subscribeOverlayUpdates: (callback: (payload: { songId: string; currentTime: number; isPlaying: boolean; queue?: string[]; currentIndex?: number; isStreamWaiting?: boolean }) => void) => () => void;
    sendOverlayStyleUpdate: (style: any) => void;
    subscribeOverlayStyleUpdates: (callback: (style: any) => void) => () => void;
    sendOverlayPreferenceUpdate: (prefs: { furiganaEnabled: boolean; romajiEnabled: boolean }) => void;
    subscribeOverlayPreferenceUpdates: (callback: (prefs: { furiganaEnabled: boolean; romajiEnabled: boolean }) => void) => () => void;
    sendOverlayScrollUpdate: (scrollY: number) => void;
    subscribeOverlayScrollUpdates: (callback: (scrollY: number) => void) => () => void;
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
      getSeparatedSongPaths: (id: string) => Promise<{ instrumental: string; vocal: string | null }>;
      openSongFolder: (id: string) => Promise<void>;
      getBasePath: () => Promise<string>;
      deleteSong: (id: string) => Promise<void>;
      updateSong: (id: string, updates: Partial<import('../shared/songTypes').SongMeta>) => Promise<import('../shared/songTypes').SongMeta | null>;
    };
    jobs: {
      queueSeparationJob: (songId: string, quality?: 'high' | 'normal' | 'fast') => Promise<import('../shared/separationTypes').SeparationJob>;
      getAllJobs: () => Promise<import('../shared/separationTypes').SeparationJob[]>;
      subscribeJobUpdates: (
        callback: (jobs: import('../shared/separationTypes').SeparationJob[]) => void
      ) => () => void;
    };
    ipcRenderer: {
      on: (channel: string, listener: (event: any, ...args: any[]) => void) => () => void;
      off: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
      send: (channel: string, ...args: any[]) => void;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    };
    downloads: {
      validateUrl: (url: string) => Promise<{ videoId: string; title: string; duration?: number } | null>;
      queueDownload: (url: string, quality: 'best' | 'high' | 'normal', title?: string, artist?: string, type?: import('../shared/songTypes').SongType, lyricsText?: string) => Promise<import('../shared/songTypes').DownloadJob>;
      getAllJobs: () => Promise<import('../shared/songTypes').DownloadJob[]>;
      subscribeUpdates: (
        callback: (jobs: import('../shared/songTypes').DownloadJob[]) => void
      ) => () => void;
      removeJob: (id: string) => Promise<void>;
    };
    lyrics: {
      readRawLyrics: (songId: string) => Promise<{ path: string; content: string } | null>;
      readSyncedLyrics: (songId: string) => Promise<{ path: string; content: string } | null>;
      writeRawLyrics: (payload: { songId: string; content: string }) => Promise<{ path: string; meta: import('../shared/songTypes').SongMeta }>;
      writeSyncedLyrics: (payload: { songId: string; content: string }) => Promise<{ path: string; meta: import('../shared/songTypes').SongMeta }>;
      enrichLyrics: (lines: string[]) => Promise<import('../shared/songTypes').EnrichedLyricLine[]>;
    };
    queue: {
      save: (payload: { songIds: string[]; currentIndex: number }) => Promise<void>;
      load: () => Promise<{ songIds: string[]; currentIndex: number } | null>;
    };
    userData: {
      saveFavorites: (favorites: string[]) => Promise<void>;
      loadFavorites: () => Promise<string[]>;
      saveHistory: (history: string[]) => Promise<void>;
      loadHistory: () => Promise<string[]>;
      savePlaylists: (playlists: any[]) => Promise<void>;
      loadPlaylists: () => Promise<any[]>;
      saveSettings: (settings: any) => Promise<void>;
      loadSettings: () => Promise<any>;
    };
    windowOps: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      onMaximized: (callback: () => void) => () => void;
      onUnmaximized: (callback: () => void) => () => void;
    };
    updater: {
      check: () => Promise<void>;
      openReleasePage: () => Promise<void>;
      ignore: (version: string) => Promise<void>;
      getStatus: () => Promise<any>;
      onStatus: (callback: (status: any) => void) => () => void;
    };
    navigation: {
      onNavigate: (callback: (view: string) => void) => () => void;
    };
    miniPlayer: {
      sendCommand: (command: string, ...args: any[]) => void;
      onCommand: (callback: (command: string, ...args: any[]) => void) => () => void;
      sendStateUpdate: (state: any) => void;
      onStateUpdate: (callback: (state: any) => void) => () => void;
      toggle: () => void;
      resize: (width: number, height: number) => void;
      setIgnoreMouseEvents?: (ignore: boolean, options?: { forward: boolean }) => void;
      onMousePresence?: (callback: (isOver: boolean) => void) => () => void;
      onCursorPoll?: (callback: (pos: { x: number, y: number }) => void) => () => void;
      getVisibility: () => Promise<boolean>;
      onVisibilityChange: (callback: (isVisible: boolean) => void) => () => void;
    };
  };
}
