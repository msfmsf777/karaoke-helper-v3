/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: import('electron').IpcRenderer
  api: {
    openAudioFileDialog: () => Promise<string | null>
  }
  khelper?: {
    dialogs: {
      pickAudioFile: () => Promise<string | null>
    }
    songLibrary: {
      addLocalSong: (payload: {
        sourcePath: string
        title: string
        artist?: string
        type: import('../shared/songTypes').SongType
        lyricsText?: string
      }) => Promise<import('../shared/songTypes').SongMeta>
      loadAllSongs: () => Promise<import('../shared/songTypes').SongMeta[]>
      getSongFilePath: (id: string) => Promise<string | null>
      getOriginalSongFilePath: (id: string) => Promise<string | null>
      getBasePath: () => Promise<string>
    }
    jobs: {
      queueSeparationJob: (songId: string) => Promise<import('../shared/separationTypes').SeparationJob>
      getAllJobs: () => Promise<import('../shared/separationTypes').SeparationJob[]>
      subscribeJobUpdates: (
        callback: (jobs: import('../shared/separationTypes').SeparationJob[]) => void
      ) => () => void
    }
    lyrics: {
      readRawLyrics: (songId: string) => Promise<{ path: string; content: string } | null>
      readSyncedLyrics: (songId: string) => Promise<{ path: string; content: string } | null>
      writeRawLyrics: (payload: { songId: string; content: string }) => Promise<{
        path: string
        meta: import('../shared/songTypes').SongMeta
      }>
      writeSyncedLyrics: (payload: { songId: string; content: string }) => Promise<{
        path: string
        meta: import('../shared/songTypes').SongMeta
      }>
    }
  }
}
