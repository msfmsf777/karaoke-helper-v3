
import { app, BrowserWindow, dialog, ipcMain } from 'electron'

import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  addLocalSong, getOriginalSongFilePath,
  getSeparatedSongPaths,
  getSongFilePath, getSongsBaseDir, loadAllSongs
} from './songLibrary'
import { getAllJobs, queueSeparationJob, subscribeJobUpdates } from './separationJobs'
import { readRawLyrics, readSyncedLyrics, writeRawLyrics, writeSyncedLyrics } from './lyrics'
import { loadQueue, saveQueue } from './queue'
import { loadFavorites, saveFavorites, loadHistory, saveHistory } from './userData'

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
  const options = {
    properties: ['openFile'] as 'openFile'[],
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  }
  const { canceled, filePaths } = browserWindow
    ? await dialog.showOpenDialog(browserWindow, options)
    : await dialog.showOpenDialog(options)

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

ipcMain.handle('library:get-separated-song-paths', async (_event, id: string) => {
  return getSeparatedSongPaths(id)
})

ipcMain.handle('library:get-base-path', async () => {
  return getSongsBaseDir()
})

ipcMain.handle('library:delete-song', async (_event, id: string) => {
  // Dynamic import to avoid circular dependencies if any, or just import from songLibrary
  const { deleteSong } = await import('./songLibrary')
  return deleteSong(id)
})

ipcMain.handle('library:update-song', async (_event, payload: { id: string; updates: any }) => {
  const { updateSong } = await import('./songLibrary')
  return updateSong(payload.id, payload.updates)
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

ipcMain.handle('queue:save', async (_event, payload: { songIds: string[]; currentIndex: number }) => {
  return saveQueue(payload)
})

ipcMain.handle('queue:load', async () => {
  return loadQueue()
})

ipcMain.handle('userData:save-favorites', async (_event, songIds: string[]) => {
  return saveFavorites(songIds)
})

ipcMain.handle('userData:load-favorites', async () => {
  return loadFavorites()
})

ipcMain.handle('userData:save-history', async (_event, songIds: string[]) => {
  return saveHistory(songIds)
})

ipcMain.handle('userData:load-history', async () => {
  return loadHistory()
})

ipcMain.handle('userData:save-playlists', async (_event, playlists: any[]) => {
  // Dynamic import or just use the function if it's exported. 
  // Note: We need to import savePlaylists/loadPlaylists from userData.ts
  // Since we are in main.ts and it imports from userData, we need to update the import statement first.
  // But here we are just adding the handlers.
  // Wait, I need to update the import at the top of the file first.
  // I will do that in a separate edit or assume I can do it here if I use the imported names.
  // I'll use the imported names and update the import in a separate step or use a multi-replace if possible.
  // Actually, I can't use them if they are not imported.
  // I will assume I will update the import in the next step.
  // For now, let's just add the handlers and then update the import.
  const { savePlaylists } = await import('./userData')
  return savePlaylists(playlists)
})

ipcMain.handle('userData:load-playlists', async () => {
  const { loadPlaylists } = await import('./userData')
  return loadPlaylists()
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

const clients: Set<Response> = new Set()

// Create a simple HTTP server to serve the overlay and SSE
import http from 'node:http'
import fs from 'node:fs'

const OVERLAY_PORT = 10001

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.url === '/events') {
    // SSE Endpoint
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })
    res.write('data: {"type":"connected"}\n\n')

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(': keep-alive\n\n')
    }, 15000)

    // Add to clients
    const client = res as unknown as Response // Type casting for simplicity in this context
    // @ts-ignore
    clients.add(client)

    req.on('close', () => {
      clearInterval(keepAlive)
      // @ts-ignore
      clients.delete(client)
    })
    return
  }

  if (req.url?.startsWith('/lyrics')) {
    const url = new URL(req.url, `http://localhost:${OVERLAY_PORT}`)
    const songId = url.searchParams.get('id')

    if (!songId) {
      res.writeHead(400)
      res.end('Missing songId')
      return
    }

    Promise.all([
      readSyncedLyrics(songId),
      readRawLyrics(songId)
    ]).then(([synced, raw]) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        synced: synced?.content || null,
        raw: raw?.content || null
      }))
    }).catch(err => {
      console.error('[OverlayServer] Failed to read lyrics', err)
      res.writeHead(500)
      res.end('Internal Server Error')
    })
    return
  }

  // If in Dev mode, redirect to Vite server for the overlay page
  if (process.env.VITE_DEV_SERVER_URL) {
    if (req.url === '/' || req.url === '/overlay' || req.url?.startsWith('/#/')) {
      res.writeHead(302, { 'Location': `${process.env.VITE_DEV_SERVER_URL}#/overlay` })
      res.end()
      return
    }
  }

  // Serve static files for the overlay
  // We want to serve the renderer dist folder
  let filePath = path.join(RENDERER_DIST, req.url === '/' ? 'index.html' : req.url || 'index.html')

  // If requesting root or /overlay, serve index.html
  if (req.url === '/' || req.url === '/overlay') {
    filePath = path.join(RENDERER_DIST, 'index.html')
  }

  const extname = path.extname(filePath)
  let contentType = 'text/html'
  switch (extname) {
    case '.js':
      contentType = 'text/javascript'
      break
    case '.css':
      contentType = 'text/css'
      break
    case '.json':
      contentType = 'application/json'
      break
    case '.png':
      contentType = 'image/png'
      break
    case '.jpg':
      contentType = 'image/jpg'
      break
    case '.svg':
      contentType = 'image/svg+xml'
      break
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Fallback to index.html for SPA routing
        fs.readFile(path.join(RENDERER_DIST, 'index.html'), (err2, content2) => {
          if (err2) {
            res.writeHead(500)
            res.end('Error loading index.html')
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(content2, 'utf-8')
          }
        })
      } else {
        res.writeHead(500)
        res.end(`Server Error: ${err.code}`)
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType })
      res.end(content, 'utf-8')
    }
  })
})

server.listen(OVERLAY_PORT, () => {
  console.log(`[OverlayServer] Listening on port ${OVERLAY_PORT}`)
})

ipcMain.on('window:open-overlay', () => {
  // Deprecated: We now use the browser source URL
  console.log('[Main] window:open-overlay called but deprecated in favor of OBS URL')
})

ipcMain.on('overlay:update', (_event, payload) => {
  // Broadcast to all SSE clients
  const data = JSON.stringify(payload)
  // @ts-ignore
  for (const client of clients) {
    // @ts-ignore
    client.write(`data: ${data}\n\n`)
  }
})
