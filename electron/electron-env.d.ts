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
      }) => Promise<import('../shared/songTypes').SongMeta>
      loadAllSongs: () => Promise<import('../shared/songTypes').SongMeta[]>
      getSongFilePath: (id: string) => Promise<string | null>
      getBasePath: () => Promise<string>
    }
  }
}
