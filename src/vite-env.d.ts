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
    sendOverlayUpdate: (payload: { type?: string; songId?: string; currentTime?: number; isPlaying?: boolean; queue?: string[]; currentIndex?: number; isStreamWaiting?: boolean; playbackMode?: 'normal' | 'repeat_one' | 'random' | 'stream'; language?: import('../shared/i18n').SupportedLanguage }) => void;
    subscribeOverlayUpdates: (callback: (payload: { type?: string; status?: 'ok' | 'missing'; songId?: string; currentTime?: number; isPlaying?: boolean; queue?: string[]; currentIndex?: number; isStreamWaiting?: boolean; playbackMode?: 'normal' | 'repeat_one' | 'random' | 'stream'; language?: import('../shared/i18n').SupportedLanguage; kind?: 'lyrics' | 'setlist'; requestedDesignId?: string; designId?: string; design?: any; overlayTemplates?: import('../shared/overlayTemplates').OverlayTemplatesConfig }) => void) => () => void;
    sendOverlayStyleUpdate: (style: any) => void;
    subscribeOverlayStyleUpdates: (callback: (style: any) => void) => () => void;
    sendOverlayPreferenceUpdate: (prefs: { furiganaEnabled: boolean; romajiEnabled: boolean }) => void;
    subscribeOverlayPreferenceUpdates: (callback: (prefs: { furiganaEnabled: boolean; romajiEnabled: boolean }) => void) => () => void;
    sendOverlayScrollUpdate: (scrollY: number) => void;
    subscribeOverlayScrollUpdates: (callback: (scrollY: number) => void) => () => void;
  };
  khelper?: {
    dialogs: {
      pickAudioFile: () => Promise<string[] | null>;
    };
    songLibrary: {
      addLocalSong: (payload: {
        sourcePath: string;
        title: string;
        artist?: string;
        type: import('../shared/songTypes').SongType;
        lyricsText?: string;
        lyricsLrc?: string;
      }) => Promise<import('../shared/songTypes').SongMeta>;
      addOnlineSong: (payload: {
        youtubeId: string;
        title: string;
        artist?: string;
        thumbnailUrl?: string;
        duration?: number;
      }) => Promise<import('../shared/songTypes').SongMeta>;
      loadAllSongs: () => Promise<import('../shared/songTypes').SongMeta[]>;
      getSongFilePath: (id: string) => Promise<string | null>;
      getOriginalSongFilePath: (id: string) => Promise<string | null>;
      getSeparatedSongPaths: (id: string) => Promise<{ instrumental: string; vocal: string | null }>;
      openSongFolder: (id: string) => Promise<void>;
      getBasePath: () => Promise<string>;
      deleteSong: (id: string) => Promise<boolean>;
      updateSong: (id: string, updates: Partial<import('../shared/songTypes').SongMeta>) => Promise<import('../shared/songTypes').SongMeta | null>;
      ensureYoutubeThumbnail: (id: string) => Promise<import('../shared/songTypes').SongMeta | null>;
      subscribeSongUpdated: (callback: (song: import('../shared/songTypes').SongMeta) => void) => () => void;
    };
    youtube: {
      search: (query: string) => Promise<any[]>;
      searchMore: () => Promise<any[]>;
      getStreamUrl: (videoId: string) => Promise<string | null>;
      getSuggestions: (query: string) => Promise<string[]>;
    };
    jobs: {
      queueSeparationJob: (songId: string, quality?: 'high' | 'normal' | 'fast') => Promise<import('../shared/separationTypes').SeparationJob>;
      getAllJobs: () => Promise<import('../shared/separationTypes').SeparationJob[]>;
      cancelJob: (jobId: string) => Promise<void>;
      retryJob: (jobId: string) => Promise<void>;
      removeJob: (jobId: string) => Promise<void>;
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
      validateUrl: (url: string) => Promise<{ videoId: string; title: string; duration?: number; thumbnailUrl?: string } | null>;
      queueDownload: (url: string, quality: 'best' | 'high' | 'normal', title?: string, artist?: string, type?: import('../shared/songTypes').SongType, lyricsText?: string, lyricsLrc?: string) => Promise<import('../shared/songTypes').DownloadJob>;
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
      loadSettingsWithMeta: () => Promise<unknown>;
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
      download: () => Promise<void>;
      install: () => Promise<void>;
      openReleasePage: () => Promise<void>;
      ignore: (version: string) => Promise<void>;
      getStatus: () => Promise<any>;
      onStatus: (callback: (status: any) => void) => () => void;
    };
    hotkeys: {
      getStatus: () => Promise<import('../shared/hotkeys').HotkeyRegistrationStatus>;
      onStatus: (callback: (status: import('../shared/hotkeys').HotkeyRegistrationStatus) => void) => () => void;
      onAction: (callback: (action: import('../shared/hotkeys').HotkeyAction) => void) => () => void;
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
