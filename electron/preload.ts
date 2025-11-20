import { ipcRenderer, contextBridge } from 'electron'
import type { SongMeta, SongType } from '../shared/songTypes'

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
    addLocalSong: (payload: { sourcePath: string; title: string; artist?: string; type: SongType }): Promise<SongMeta> =>
      ipcRenderer.invoke('library:add-local-song', payload),
    loadAllSongs: (): Promise<SongMeta[]> => ipcRenderer.invoke('library:load-all'),
    getSongFilePath: (id: string): Promise<string | null> => ipcRenderer.invoke('library:get-song-file-path', id),
    getBasePath: (): Promise<string> => ipcRenderer.invoke('library:get-base-path'),
  },
})
