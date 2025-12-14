import { ipcRenderer, contextBridge, type IpcRendererEvent } from 'electron'
import type { SongMeta, SongType, DownloadJob } from '../shared/songTypes'
import type { SeparationJob } from '../shared/separationTypes'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) {
    const subscription = (event: IpcRendererEvent, ...args: any[]) => listener(event, ...args)
    ipcRenderer.on(channel, subscription)
    return () => {
      ipcRenderer.off(channel, subscription)
    }
  },
  off(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) {
    ipcRenderer.off(channel, listener)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})

contextBridge.exposeInMainWorld('api', {
  openAudioFileDialog: () => ipcRenderer.invoke('dialog:open-audio-file'),
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  openOverlayWindow: () => ipcRenderer.send('window:open-overlay'),
  sendOverlayUpdate: (payload: { songId: string; currentTime: number; isPlaying: boolean; queue?: string[]; currentIndex?: number; isStreamWaiting?: boolean }) => ipcRenderer.send('overlay:update', payload),
  subscribeOverlayUpdates: (callback: (payload: { songId: string; currentTime: number; isPlaying: boolean; queue?: string[]; currentIndex?: number; isStreamWaiting?: boolean }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload)
    ipcRenderer.on('overlay:update', listener)
    return () => ipcRenderer.off('overlay:update', listener)
  },
  sendOverlayStyleUpdate: (style: any) => ipcRenderer.send('overlay:style-update', style),
  subscribeOverlayStyleUpdates: (callback: (style: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, style: any) => callback(style)
    ipcRenderer.on('overlay:style-update', listener)
    return () => ipcRenderer.off('overlay:style-update', listener)
  },
  sendOverlayPreferenceUpdate: (prefs: any) => ipcRenderer.send('overlay:preference-update', prefs),
  subscribeOverlayPreferenceUpdates: (callback: (prefs: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, prefs: any) => callback(prefs)
    ipcRenderer.on('overlay:preference-update', listener)
    return () => ipcRenderer.off('overlay:preference-update', listener)
  },
  sendOverlayScrollUpdate: (scrollY: number) => ipcRenderer.send('overlay:scroll-update', scrollY),
  subscribeOverlayScrollUpdates: (callback: (scrollY: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, scrollY: number) => callback(scrollY)
    ipcRenderer.on('overlay:scroll-update', listener)
    return () => ipcRenderer.off('overlay:scroll-update', listener)
  },
})

contextBridge.exposeInMainWorld('khelper', {
  dialogs: {
    pickAudioFile: () => ipcRenderer.invoke('dialog:open-audio-file'),
  },
  songLibrary: {
    addLocalSong: (payload: {
      sourcePath: string
      title: string
      artist?: string
      type: SongType
      lyricsText?: string
    }): Promise<SongMeta> => ipcRenderer.invoke('library:add-local-song', payload),
    loadAllSongs: (): Promise<SongMeta[]> => ipcRenderer.invoke('library:load-all'),
    getSongFilePath: (id: string) => ipcRenderer.invoke('library:get-song-file-path', id),
    getOriginalSongFilePath: (id: string) => ipcRenderer.invoke('library:get-original-song-file-path', id),
    getSeparatedSongPaths: (id: string) => ipcRenderer.invoke('library:get-separated-song-paths', id),
    getBasePath: (): Promise<string> => ipcRenderer.invoke('library:get-base-path'),
    deleteSong: (id: string): Promise<void> => ipcRenderer.invoke('library:delete-song', id),
    updateSong: (id: string, updates: Partial<SongMeta>): Promise<SongMeta | null> =>
      ipcRenderer.invoke('library:update-song', { id, updates }),
  },
  jobs: {
    queueSeparationJob: (songId: string, quality?: 'high' | 'normal' | 'fast'): Promise<SeparationJob> =>
      ipcRenderer.invoke('jobs:queue-separation', songId, quality),
    getAllJobs: (): Promise<SeparationJob[]> => ipcRenderer.invoke('jobs:get-all'),
    subscribeJobUpdates: (callback: (jobs: SeparationJob[]) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, jobs: SeparationJob[]) => callback(jobs)
      const subscriptionId = `jobs-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
      ipcRenderer.send('jobs:subscribe', subscriptionId)
      ipcRenderer.on('jobs:updated', listener)
      return () => {
        ipcRenderer.send('jobs:unsubscribe', subscriptionId)
        ipcRenderer.off('jobs:updated', listener)
      }
    },
  },
  downloads: {
    validateUrl: (url: string): Promise<{ videoId: string; title: string; duration?: number } | null> =>
      ipcRenderer.invoke('downloads:validate', url),
    queueDownload: (url: string, quality: 'best' | 'high' | 'normal', title?: string, artist?: string, type?: SongType, lyricsText?: string): Promise<DownloadJob> =>
      ipcRenderer.invoke('downloads:queue', url, quality, title, artist, type, lyricsText),
    getAllJobs: (): Promise<DownloadJob[]> => ipcRenderer.invoke('downloads:get-all'),
    subscribeUpdates: (callback: (jobs: DownloadJob[]) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, jobs: DownloadJob[]) => callback(jobs)
      const subscriptionId = `dl-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
      ipcRenderer.send('downloads:subscribe', subscriptionId)
      ipcRenderer.on('downloads:updated', listener)
      return () => {
        ipcRenderer.send('downloads:unsubscribe', subscriptionId)
        ipcRenderer.off('downloads:updated', listener)
      }
    },
  },
  lyrics: {
    readRawLyrics: (songId: string): Promise<{ path: string; content: string } | null> =>
      ipcRenderer.invoke('lyrics:read-raw', songId),
    readSyncedLyrics: (songId: string): Promise<{ path: string; content: string } | null> =>
      ipcRenderer.invoke('lyrics:read-synced', songId),
    writeRawLyrics: (payload: { songId: string; content: string }): Promise<{ path: string; meta: SongMeta }> =>
      ipcRenderer.invoke('lyrics:write-raw', payload),
    writeSyncedLyrics: (payload: { songId: string; content: string }): Promise<{ path: string; meta: SongMeta }> =>
      ipcRenderer.invoke('lyrics:write-synced', payload),
    enrichLyrics: (lines: string[]): Promise<import('../shared/songTypes').EnrichedLyricLine[]> =>
      ipcRenderer.invoke('lyrics:enrich', lines),
  },
  queue: {
    save: (payload: { songIds: string[]; currentIndex: number }): Promise<void> =>
      ipcRenderer.invoke('queue:save', payload),
    load: (): Promise<{ songIds: string[]; currentIndex: number } | null> => ipcRenderer.invoke('queue:load'),
  },
  userData: {
    saveFavorites: (songIds: string[]): Promise<void> => ipcRenderer.invoke('userData:save-favorites', songIds),
    loadFavorites: (): Promise<string[]> => ipcRenderer.invoke('userData:load-favorites'),
    saveHistory: (songIds: string[]): Promise<void> => ipcRenderer.invoke('userData:save-history', songIds),
    loadHistory: (): Promise<string[]> => ipcRenderer.invoke('userData:load-history'),
    savePlaylists: (playlists: any[]): Promise<void> => ipcRenderer.invoke('userData:save-playlists', playlists),
    loadPlaylists: (): Promise<any[]> => ipcRenderer.invoke('userData:load-playlists'),
    saveSettings: (settings: any): Promise<void> => ipcRenderer.invoke('userData:save-settings', settings),
    loadSettings: (): Promise<any> => ipcRenderer.invoke('userData:load-settings'),
  },
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    ignore: (version: string) => ipcRenderer.invoke('updater:ignore', version),
    getStatus: () => ipcRenderer.invoke('updater:get-status'),
    onStatus: (callback: (status: any) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload)
      ipcRenderer.on('updater:status', listener)
      return () => ipcRenderer.off('updater:status', listener)
    },
  },
  windowOps: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onMaximized: (callback: () => void) => {
      const subscription = (_event: any) => callback()
      ipcRenderer.on('window:maximized', subscription)
      return () => ipcRenderer.removeListener('window:maximized', subscription)
    },
    onUnmaximized: (callback: () => void) => {
      const subscription = (_event: any) => callback()
      ipcRenderer.on('window:unmaximized', subscription)
      return () => ipcRenderer.removeListener('window:unmaximized', subscription)
    }
  },
})
