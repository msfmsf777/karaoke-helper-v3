import { ipcRenderer, contextBridge } from 'electron'
import type { SongMeta, SongType } from '../shared/songTypes'
import type { SeparationJob } from '../shared/separationTypes'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
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
    getSongFilePath: (id: string): Promise<string | null> => ipcRenderer.invoke('library:get-song-file-path', id),
    getOriginalSongFilePath: (id: string): Promise<string | null> =>
      ipcRenderer.invoke('library:get-original-song-file-path', id),
    getBasePath: (): Promise<string> => ipcRenderer.invoke('library:get-base-path'),
  },
  jobs: {
    queueSeparationJob: (songId: string): Promise<SeparationJob> =>
      ipcRenderer.invoke('jobs:queue-separation', songId),
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
  lyrics: {
    readRawLyrics: (songId: string): Promise<{ path: string; content: string } | null> =>
      ipcRenderer.invoke('lyrics:read-raw', songId),
    readSyncedLyrics: (songId: string): Promise<{ path: string; content: string } | null> =>
      ipcRenderer.invoke('lyrics:read-synced', songId),
    writeRawLyrics: (payload: { songId: string; content: string }): Promise<{ path: string; meta: SongMeta }> =>
      ipcRenderer.invoke('lyrics:write-raw', payload),
    writeSyncedLyrics: (payload: { songId: string; content: string }): Promise<{ path: string; meta: SongMeta }> =>
      ipcRenderer.invoke('lyrics:write-synced', payload),
  },
})
