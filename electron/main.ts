

import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'

import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

// Disable native swipe navigation (fixes sidebar drag sliding the screen)
app.commandLine.appendSwitch('disable-features', 'OverscrollHistoryNavigation')

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

// Lazy load these modules
// import {
//   addLocalSong, getOriginalSongFilePath,
//   getSeparatedSongPaths,
//   getSongFilePath, getSongsBaseDir, loadAllSongs
// } from './songLibrary'
// import { getAllJobs, queueSeparationJob, subscribeJobUpdates } from './separationJobs'
// import { downloadManager } from './downloadJobs'
// import { readRawLyrics, readSyncedLyrics, writeRawLyrics, writeSyncedLyrics } from './lyrics'
// import { loadQueue, saveQueue } from './queue'

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
const jobSubscriptions = new Map<number, Map<string, () => void>>()
const downloadSubscriptions = new Map<number, Map<string, () => void>>()

const WINDOW_STATE_FILE = 'window-state.json'

interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
}

function loadWindowState(): WindowState {
  try {
    const statePath = path.join(app.getPath('userData'), WINDOW_STATE_FILE)
    if (fs.existsSync(statePath)) {
      const data = fs.readFileSync(statePath, 'utf-8')
      return JSON.parse(data)
    }
  } catch (e) {
    console.error('Failed to load window state', e)
  }
  // Default state
  return { width: 1130, height: 660, isMaximized: false }
}

function saveWindowState(state: WindowState) {
  try {
    const statePath = path.join(app.getPath('userData'), WINDOW_STATE_FILE)
    fs.writeFileSync(statePath, JSON.stringify(state))
  } catch (e) {
    console.error('Failed to save window state', e)
  }
}

function createWindow() {
  const state = loadWindowState()

  win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 1130,
    minHeight: 660,
    icon: path.join(process.env.VITE_PUBLIC, 'logo_outer.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      // Allow loading local file:// resources from the renderer (needed for direct audio file playback in dev/HTTP origin).
      webSecurity: false,
    },
    show: false, // Don't show immediately to avoid flickering if maximizing
    frame: false, // Custom window controls
    // autoHideMenuBar: true, // Not needed with frame: false
  })

  if (state.isMaximized) {
    win.maximize()
  }

  win.show()

  // Window Control IPC
  ipcMain.on('window:minimize', () => {
    win?.minimize()
  })

  ipcMain.on('window:maximize', () => {
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })

  ipcMain.on('window:close', () => {
    win?.close()
  })

  ipcMain.handle('window:is-maximized', () => {
    return win?.isMaximized() ?? false
  })

  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    await shell.openExternal(url)
  })

  // Save state on close
  let saveTimeout: NodeJS.Timeout | null = null
  const handleSave = () => {
    if (!win) return
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      if (!win || win.isDestroyed()) return

      // Don't save if minimized
      if (win.isMinimized()) return

      const isMaximized = win.isMaximized()
      const bounds = win.getBounds()

      saveWindowState({
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        isMaximized
      })
    }, 1000) // Debounce 1s
  }

  win.on('resize', handleSave)
  win.on('move', handleSave)
  win.on('maximize', () => {
    win?.webContents.send('window:maximized')
    handleSave()
  })
  win.on('unmaximize', () => {
    win?.webContents.send('window:unmaximized')
    handleSave()
  })
  win.on('close', () => {
    // Force save on close without debounce
    if (win && !win.isDestroyed() && !win.isMinimized()) {
      const isMaximized = win.isMaximized()
      const bounds = win.getBounds()
      saveWindowState({
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        isMaximized
      })
    }
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
  const { addLocalSong } = await import('./songLibrary')
  return addLocalSong(payload)
})

ipcMain.handle('library:load-all', async () => {
  const { loadAllSongs } = await import('./songLibrary')
  const songs = await loadAllSongs()
  return songs
})

ipcMain.handle('library:get-song-file-path', async (_event, id: string) => {
  const { getSongFilePath } = await import('./songLibrary')
  return getSongFilePath(id)
})

ipcMain.handle('library:get-original-song-file-path', async (_event, id: string) => {
  const { getOriginalSongFilePath } = await import('./songLibrary')
  return getOriginalSongFilePath(id)
})

ipcMain.handle('library:get-separated-song-paths', async (_event, id: string) => {
  const { getSeparatedSongPaths } = await import('./songLibrary')
  return getSeparatedSongPaths(id)
})

ipcMain.handle('library:get-base-path', async () => {
  const { getSongsBaseDir } = await import('./songLibrary')
  return getSongsBaseDir()
})

ipcMain.handle('library:delete-song', async (_event, id: string) => {
  if (!win) return
  const result = await dialog.showMessageBox(win, {
    type: 'warning',
    title: '刪除歌曲',
    message: '確定要刪除這首歌曲嗎？此操作無法復原。',
    buttons: ['取消', '刪除'],
    defaultId: 0,
    cancelId: 0,
  })

  if (result.response === 1) {
    const { deleteSong } = await import('./songLibrary')
    await deleteSong(id)
    // Also remove from download history if exists
    const { downloadManager } = await import('./downloadJobs')
    downloadManager.removeJobBySongId(id)
    return true
  }
  return false
})

ipcMain.handle('library:update-song', async (_event, payload: { id: string; updates: any }) => {
  const { updateSong } = await import('./songLibrary')
  return updateSong(payload.id, payload.updates)
})

ipcMain.handle('jobs:queue-separation', async (_event, songId: string, quality?: 'high' | 'normal' | 'fast') => {
  const { queueSeparationJob } = await import('./separationJobs')
  return queueSeparationJob(songId, quality)
})

ipcMain.handle('jobs:get-all', async () => {
  const { getAllJobs } = await import('./separationJobs')
  return getAllJobs()
})

ipcMain.handle('lyrics:read-raw', async (_event, songId: string) => {
  const { readRawLyrics } = await import('./lyrics')
  return readRawLyrics(songId)
})

ipcMain.handle('lyrics:read-synced', async (_event, songId: string) => {
  const { readSyncedLyrics } = await import('./lyrics')
  return readSyncedLyrics(songId)
})

ipcMain.handle('lyrics:write-raw', async (_event, payload: { songId: string; content: string }) => {
  const { writeRawLyrics } = await import('./lyrics')
  return writeRawLyrics(payload.songId, payload.content)
})

ipcMain.handle('lyrics:write-synced', async (_event, payload: { songId: string; content: string }) => {
  const { writeSyncedLyrics } = await import('./lyrics')
  return writeSyncedLyrics(payload.songId, payload.content)
})

ipcMain.handle('lyrics:enrich', async (_event, lines: string[]) => {
  const { enrichLyrics } = await import('./lyricEnrichment')
  return enrichLyrics(lines)
})

ipcMain.handle('queue:save', async (_event, payload: { songIds: string[]; currentIndex: number }) => {
  const { saveQueue } = await import('./queue')
  return saveQueue(payload)
})

ipcMain.handle('queue:load', async () => {
  const { loadQueue } = await import('./queue')
  return loadQueue()
})

ipcMain.handle('userData:save-favorites', async (_event, songIds: string[]) => {
  const { saveFavorites } = await import('./userData')
  return saveFavorites(songIds)
})

ipcMain.handle('userData:load-favorites', async () => {
  const { loadFavorites } = await import('./userData')
  return loadFavorites()
})

ipcMain.handle('userData:save-history', async (_event, songIds: string[]) => {
  const { saveHistory } = await import('./userData')
  return saveHistory(songIds)
})

ipcMain.handle('userData:load-history', async () => {
  const { loadHistory } = await import('./userData')
  return loadHistory()
})

ipcMain.handle('userData:save-playlists', async (_event, playlists: any[]) => {
  const { savePlaylists } = await import('./userData')
  return savePlaylists(playlists)
})

ipcMain.handle('userData:load-playlists', async () => {
  const { loadPlaylists } = await import('./userData')
  return loadPlaylists()
})

ipcMain.handle('userData:save-settings', async (_event, settings: any) => {
  const { saveSettings } = await import('./userData')
  return saveSettings(settings)
})

ipcMain.handle('userData:load-settings', async () => {
  const { loadSettings } = await import('./userData')
  return loadSettings()
})

ipcMain.on('jobs:subscribe', async (event, subscriptionId: string) => {
  const { subscribeJobUpdates } = await import('./separationJobs')
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

// Helper to ensure download manager is initialized and hooked
async function getDownloadManager() {
  const { downloadManager } = await import('./downloadJobs')
  // Ensure hook is set (idempotent assignment)
  downloadManager.onLibraryChanged = () => {
    BrowserWindow.getAllWindows().forEach(w => {
      w.webContents.send('library:changed')
    })
  }
  return downloadManager
}

ipcMain.handle('downloads:validate', async (_event, url: string) => {
  const dm = await getDownloadManager()
  return dm.validateUrl(url)
})

ipcMain.handle('downloads:queue', async (_event, url: string, quality: 'best' | 'high' | 'normal', title?: string, artist?: string, type?: import('../shared/songTypes').SongType, lyricsText?: string) => {
  const dm = await getDownloadManager()
  return dm.queueJob(url, quality, title, artist, type, lyricsText)
})

ipcMain.handle('downloads:get-all', async () => {
  const dm = await getDownloadManager()
  return dm.getAll()
})

ipcMain.on('downloads:subscribe', async (event, subscriptionId: string) => {
  const dm = await getDownloadManager()
  const wc = event.sender
  const disposer = dm.subscribe((jobs) => wc.send('downloads:updated', jobs))

  let disposers = downloadSubscriptions.get(wc.id)
  if (!disposers) {
    disposers = new Map()
    downloadSubscriptions.set(wc.id, disposers)
    wc.once('destroyed', () => {
      disposers?.forEach((fn) => fn())
      downloadSubscriptions.delete(wc.id)
    })
  }
  disposers.set(subscriptionId, disposer)
})

ipcMain.on('downloads:unsubscribe', (event, subscriptionId: string) => {
  const disposers = downloadSubscriptions.get(event.sender.id)
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

app.whenReady().then(async () => {
  console.log('[App] userData path:', app.getPath('userData'))

  // Initialize Updater
  const { initUpdater } = await import('./updater')
  initUpdater()

  // Lazy load this too if needed, or just remove if not critical
  // console.log('[Library] base songs dir:', getSongsBaseDir()) 
  createWindow()
})

const clients: Set<Response> = new Set()

// Create a simple HTTP server to serve the overlay and SSE
import http from 'node:http'

const OVERLAY_PORT = 10001

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
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

    // Send cached state if available
    if (lastStyle) {
      res.write(`data: ${JSON.stringify({ type: 'style', style: lastStyle })}\n\n`);
    }
    if (lastPreferences) {
      res.write(`data: ${JSON.stringify({ type: 'preference', prefs: lastPreferences })}\n\n`);
    }
    if (lastSongInfo) {
      res.write(`data: ${JSON.stringify(lastSongInfo)}\n\n`);
    }

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

    // Lazy load lyrics module here too
    import('./lyrics').then(({ readSyncedLyrics, readRawLyrics }) => {
      Promise.all([
        readSyncedLyrics(songId),
        readRawLyrics(songId)
      ]).then(async ([synced, raw]) => {
        let enriched = null;
        const content = synced?.content || raw?.content || '';

        // Simple Japanese detection (Hiragana, Katakana, Kanji)
        const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(content);

        if (hasJapanese) {
          try {
            const { enrichLyrics } = await import('./lyricEnrichment');
            // Parse lines for enrichment
            let lines: string[] = [];
            if (synced?.content) {
              // Simple parse to get text
              lines = synced.content.split('\n')
                .map(l => l.replace(/^\[.*?\]/, '').trim())
                .filter(l => l.length > 0);
            } else if (raw?.content) {
              lines = raw.content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            }

            if (lines.length > 0) {
              enriched = await enrichLyrics(lines);
            }
          } catch (e) {
            console.error('[OverlayServer] Enrichment failed', e);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          synced: synced?.content || null,
          raw: raw?.content || null,
          enriched
        }))
      }).catch(err => {
        console.error('[OverlayServer] Failed to read lyrics', err)
        res.writeHead(500)
        res.end('Internal Server Error')
      })
    })

    return
  }

  if (req.url === '/batch-metadata' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const { ids } = JSON.parse(body);
        if (!Array.isArray(ids)) {
          res.writeHead(400);
          res.end('Invalid IDs');
          return;
        }

        // We might need loadAllSongs to ensure cache is populated if getting by ID relies on memory
        // But getSongById usually reads from a map. loadAllSongs might be needed if strictly cold.
        // Assuming the main process has the library loaded or we can load it.
        // getSongById isn't exported as a standalone usually, it's often inside the closure or class.
        // Wait, looking at main.ts imports: "import { addLocalSong ...} from './songLibrary'".
        // Let's check songLibrary exports.
        // If getSongById isn't available, we might need to use loadAllSongs and filter.

        const { loadAllSongs } = await import('./songLibrary');
        const allSongs = await loadAllSongs();
        const map = new Map(allSongs.map(s => [s.id, s]));

        const results = ids.map(id => {
          const s = map.get(id);
          if (!s) return null;
          return { id: s.id, title: s.title, artist: s.artist };
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results));
      } catch (e) {
        console.error('[OverlayServer] Failed to fetch metadata', e);
        res.writeHead(500);
        res.end('Server Error');
      }
    });
    return;
  }

  // If in Dev mode, redirect to Vite server for the overlay page
  if (process.env.VITE_DEV_SERVER_URL) {
    const devUrl = process.env.VITE_DEV_SERVER_URL.endsWith('/')
      ? process.env.VITE_DEV_SERVER_URL
      : `${process.env.VITE_DEV_SERVER_URL}/`;

    console.log('[OverlayServer] Dev Redirect Check:', req.url);

    if (req.url?.startsWith('/obs/setlist') || req.url === '/setlist') {
      console.log('[OverlayServer] Redirecting to Setlist');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.writeHead(302, { 'Location': `${devUrl}#/setlist` })
      res.end()
      return
    }
    if (req.url?.startsWith('/obs/all') || req.url === '/all') {
      console.log('[OverlayServer] Redirecting to Combined');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.writeHead(302, { 'Location': `${devUrl}#/all` })
      res.end()
      return
    }
    if (req.url === '/' || req.url === '/overlay' || req.url?.startsWith('/#/')) {
      console.log('[OverlayServer] Redirecting to Default Overlay');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.writeHead(302, { 'Location': `${devUrl}#/overlay` })
      res.end()
      return
    }
    // Also support readable /lyrics or /obs/lyrics -> redirect to overlay
    if (req.url?.startsWith('/lyrics') || req.url?.startsWith('/obs/lyrics')) {
      console.log('[OverlayServer] Redirecting to Lyrics');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.writeHead(302, { 'Location': `${devUrl}#/overlay` })
      res.end()
      return
    }
  }

  // Serve static files for the overlay
  // We want to serve the renderer dist folder
  let filePath = path.join(RENDERER_DIST, req.url === '/' ? 'index.html' : req.url || 'index.html')

  // If requesting root or /overlay, serve index.html
  if (req.url === '/' || req.url === '/overlay' || req.url === '/obs/setlist' || req.url === '/obs/all' || req.url === '/obs/lyrics' || req.url === '/lyrics') {
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

server.on('error', (e: any) => {
  if (e.code === 'EADDRINUSE') {
    console.warn(`[OverlayServer] Port ${OVERLAY_PORT} is already in use. Overlay server might effectively be unavailable or running in another instance.`);
  } else {
    console.error('[OverlayServer] Server error:', e);
  }
});

server.listen(OVERLAY_PORT, () => {
  console.log(`[OverlayServer] Listening on port ${OVERLAY_PORT}`)
})

app.on('before-quit', () => {
  server.close();
});

ipcMain.on('window:open-overlay', () => {
  // Deprecated: We now use the browser source URL
  console.log('[Main] window:open-overlay called but deprecated in favor of OBS URL')
})

// State cache for new clients
let lastSongInfo: any = null;
let lastStyle: any = null;
let lastPreferences: any = null;

ipcMain.on('overlay:update', (_event, payload) => {
  lastSongInfo = payload;
  // Broadcast to all SSE clients
  const data = JSON.stringify(payload)
  // @ts-ignore
  for (const client of clients) {
    // @ts-ignore
    client.write(`data: ${data}\n\n`)
  }
})

ipcMain.on('overlay:style-update', (_event, style) => {
  lastStyle = style;
  // Broadcast to all SSE clients
  const data = JSON.stringify({ type: 'style', style })
  // @ts-ignore
  for (const client of clients) {
    // @ts-ignore
    client.write(`data: ${data}\n\n`)
  }
})

ipcMain.on('overlay:preference-update', (_event, prefs) => {
  lastPreferences = prefs;
  // Broadcast to all SSE clients
  const data = JSON.stringify({ type: 'preference', prefs })
  // @ts-ignore
  for (const client of clients) {
    // @ts-ignore
    client.write(`data: ${data}\n\n`)
  }
})

ipcMain.on('overlay:scroll-update', (_event, scrollY: number) => {
  // Broadcast scroll update (no need to cache strictly, but good for immediate sync if we wanted)
  // For scrolling, we just broadcast.
  const data = JSON.stringify({ type: 'scroll', scrollTop: scrollY })
  // @ts-ignore
  for (const client of clients) {
    // @ts-ignore
    client.write(`data: ${data}\n\n`)
  }
})



