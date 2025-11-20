import { app, BrowserWindow, dialog, ipcMain } from 'electron'

import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { addLocalSong, getOriginalSongFilePath, getSongFilePath, getSongsBaseDir, loadAllSongs } from './songLibrary'
import { getAllJobs, queueSeparationJob, subscribeJobUpdates } from './separationJobs'
import { readRawLyrics, readSyncedLyrics, writeRawLyrics, writeSyncedLyrics } from './lyrics'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure (electron-vite output)
// /dist              -> renderer build
// /dist/index.html   -> renderer entry
// /dist-electron     -> main/preload build outputs
// /dist-electron/main.js
// /dist-electron/preload.mjs
process.env.APP_ROOT = path.join(__dirname, '..')

// Use ['ENV_NAME'] to avoid vite:define plugin rewriting during build.
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
const jobSubscriptions = new Map<number, Map<string, () => void>>()

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      // Allow loading local file:// resources from the renderer (needed for direct audio file playback in dev/HTTP origin).
      webSecurity: false,
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

ipcMain.handle('dialog:open-audio-file', async () => {
  const browserWindow = BrowserWindow.getFocusedWindow() ?? win
  const { canceled, filePaths } = await dialog.showOpenDialog(browserWindow ?? undefined, {
    properties: ['openFile'],
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })

  if (canceled || filePaths.length === 0) {
    return null
  }

  return filePaths[0]
})

ipcMain.handle('library:add-local-song', async (_event, payload) => {
  return addLocalSong(payload)
})

ipcMain.handle('library:load-all', async () => {
  const songs = await loadAllSongs()
  return songs
})

ipcMain.handle('library:get-song-file-path', async (_event, id: string) => {
  return getSongFilePath(id)
})

ipcMain.handle('library:get-original-song-file-path', async (_event, id: string) => {
  return getOriginalSongFilePath(id)
})

ipcMain.handle('library:get-base-path', async () => {
  return getSongsBaseDir()
})

ipcMain.handle('jobs:queue-separation', async (_event, songId: string) => {
  return queueSeparationJob(songId)
})

ipcMain.handle('jobs:get-all', async () => {
  return getAllJobs()
})

ipcMain.handle('lyrics:read-raw', async (_event, songId: string) => {
  return readRawLyrics(songId)
})

ipcMain.handle('lyrics:read-synced', async (_event, songId: string) => {
  return readSyncedLyrics(songId)
})

ipcMain.handle('lyrics:write-raw', async (_event, payload: { songId: string; content: string }) => {
  return writeRawLyrics(payload.songId, payload.content)
})

ipcMain.handle('lyrics:write-synced', async (_event, payload: { songId: string; content: string }) => {
  return writeSyncedLyrics(payload.songId, payload.content)
})

ipcMain.on('jobs:subscribe', (event, subscriptionId: string) => {
  const wc = event.sender
  const disposer = subscribeJobUpdates((jobs) => wc.send('jobs:updated', jobs))

  let disposers = jobSubscriptions.get(wc.id)
  if (!disposers) {
    disposers = new Map()
    jobSubscriptions.set(wc.id, disposers)
    wc.once('destroyed', () => {
      disposers?.forEach((fn) => fn())
      jobSubscriptions.delete(wc.id)
    })
  }
  disposers.set(subscriptionId, disposer)
})

ipcMain.on('jobs:unsubscribe', (event, subscriptionId: string) => {
  const disposers = jobSubscriptions.get(event.sender.id)
  if (!disposers) return
  if (subscriptionId) {
    const fn = disposers.get(subscriptionId)
    fn?.()
    disposers.delete(subscriptionId)
  } else {
    disposers.forEach((fn) => fn())
    disposers.clear()
  }
})

app.whenReady().then(() => {
  console.log('[App] userData path:', app.getPath('userData'))
  console.log('[Library] base songs dir:', getSongsBaseDir())
  createWindow()
})

let overlayWindow: BrowserWindow | null = null

ipcMain.on('window:open-overlay', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.focus()
    return
  }

  overlayWindow = new BrowserWindow({
    width: 800,
    height: 600,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      webSecurity: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    overlayWindow.loadURL(`${VITE_DEV_SERVER_URL}#/overlay`)
  } else {
    overlayWindow.loadFile(path.join(RENDERER_DIST, 'index.html'), { hash: 'overlay' })
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
})

ipcMain.on('overlay:update', (_event, payload) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('overlay:update', payload)
  }
})
