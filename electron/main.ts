import { app, BrowserWindow, dialog, ipcMain, shell, Tray, Menu, nativeImage, screen } from 'electron'

import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

// Static Imports to ensure bundling
import {
  addLocalSong, getOriginalSongFilePath,
  getSeparatedSongPaths,
  getSongFilePath, getSongsBaseDir, loadAllSongs,
  deleteSong, updateSong, getSongDirById
} from './songLibrary'
import { getAllJobs, queueSeparationJob, subscribeJobUpdates } from './separationJobs'
import { downloadManager } from './downloadJobs'
import { readRawLyrics, readSyncedLyrics, writeRawLyrics, writeSyncedLyrics } from './lyrics'
import { loadQueue, saveQueue } from './queue'
import { enrichLyrics } from './lyricEnrichment'
import {
  loadFavorites, loadHistory, loadPlaylists, loadSettings,
  saveFavorites, saveHistory, savePlaylists, saveSettings
} from './userData'
import { initUpdater, checkForUpdates, onStatusChange } from './updater'

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

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
const jobSubscriptions = new Map<number, Map<string, () => void>>()
const downloadSubscriptions = new Map<number, Map<string, () => void>>()

// Tray & Lifecycle
let tray: Tray | null = null
let isQuitting = false

function createTray() {
  // Use SVG if possible, assume logo is available
  const iconPath = path.join(process.env.VITE_PUBLIC, 'logo_outer.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('KHelper V3')

  tray.on('click', () => {
    if (win) {
      if (win.isVisible()) {
        if (win.isFocused()) {
          win.hide()
        } else {
          win.focus()
        }
      } else {
        win.show()
        win.focus()
      }
    }
  })

  // Initial menu
  updateTrayMenu()
}

function updateTrayMenu(updaterStatus?: string) {
  if (!tray) return

  const updaterLabel = updaterStatus === 'checking' ? '檢查更新中...' : '檢查更新'

  // Icon Helpers
  const getIcon = (name: string) => {
    let iconPath: string
    if (app.isPackaged) {
      // Production: resources/icons/[name]
      // We mapped src/assets/icons -> icons in package.json extraResources
      iconPath = path.join(process.resourcesPath, 'icons', name)
    } else {
      // Development: src/assets/icons/[name]
      if (!process.env.APP_ROOT) return null
      iconPath = path.join(process.env.APP_ROOT, 'src/assets/icons', name)
    }

    if (fs.existsSync(iconPath)) {
      return nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    }
    return null
  }

  // Define icons
  // Logo is in public root, handle separately
  const logoPath = path.join(process.env.VITE_PUBLIC, 'logo_outer.png')
  const logoIcon = fs.existsSync(logoPath) ? nativeImage.createFromPath(logoPath).resize({ width: 16, height: 16 }) : undefined

  // Use the dedicated Tray icons (black / separate ones)
  const settingsIcon = getIcon('settings_tray.png')
  const updateIcon = getIcon('update_tray.png')
  const quitIcon = getIcon('quit.png')
  const openIcon = getIcon('open.png')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '𝐊𝐇𝐞𝐥𝐩𝐞𝐫 𝐕𝟑',
      enabled: false,
      icon: logoIcon
    },
    { type: 'separator' },
    {
      label: '開啟主視窗',
      icon: openIcon || undefined,
      click: () => {
        if (win) {
          win.show()
          win.focus()
        }
      }
    },
    {
      label: '設定',
      icon: settingsIcon || undefined,
      click: () => {
        if (win) {
          // Whether hidden or visible, we want to nav
          if (!win.isVisible()) {
            win.show()
            win.focus()
          }
          if (win.isMinimized()) win.restore()
          win.focus()

          win.webContents.send('navigate', 'settings')
        }
      }
    },
    {
      label: updaterLabel,
      icon: updateIcon || undefined,
      enabled: updaterStatus !== 'checking',
      click: () => {
        if (win) {
          if (!win.isVisible()) {
            win.show()
            win.focus()
          } else {
            win.focus()
          }
        }
        checkForUpdates({ manual: true })
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      icon: quitIcon || undefined,
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

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
      // Fix for background throttling: Ensure lyrics/audio engine updates continue when window is hidden/minimized
      backgroundThrottling: false,
    },
    show: false, // Don't show immediately to avoid flickering if maximizing
    frame: false, // Custom window controls
    // autoHideMenuBar: true, // Not needed with frame: false
  })

  // Windows-specific behavior for robust "Click vs Drag" on Title Bar
  if (process.platform === 'win32') {
    const WM_NCLBUTTONDOWN = 0x00A1
    const WM_NCLBUTTONUP = 0x00A2
    let isMoving = false
    let downTime = 0

    const WM_ENTERSIZEMOVE = 0x0231

    // Detect start of potential drag or click
    win.hookWindowMessage(WM_NCLBUTTONDOWN, () => {
      isMoving = false
      downTime = Date.now()
    })

    // Detect actual modal move/size loop
    win.hookWindowMessage(WM_ENTERSIZEMOVE, () => {
      isMoving = true
    })

    // Detect release
    win.hookWindowMessage(WM_NCLBUTTONUP, () => {
      // If we haven't moved and it was a short press, count as click
      // We check !isMoving.
      if (!isMoving && (Date.now() - downTime < 500)) {
        win?.webContents.send('window:title-bar-click')
      }
    })
  }

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
  win.on('close', (event) => {
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

    if (!isQuitting) {
      event.preventDefault()
      win?.hide()
      return
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

  createMiniPlayerWindow()
}

// ---------------- Mini Player Implementation ----------------

let miniWin: BrowserWindow | null = null

function createMiniPlayerWindow() {
  // Load saved position if any
  const miniStatePath = path.join(app.getPath('userData'), 'mini-player-state.json')
  let miniState = { x: undefined as number | undefined, y: undefined as number | undefined }
  try {
    if (fs.existsSync(miniStatePath)) {
      miniState = JSON.parse(fs.readFileSync(miniStatePath, 'utf-8'))
    }
  } catch (e) {
    console.error('Failed to load mini player state', e)
  }

  // Calculate default position (bottom-right of primary display) if no saved state
  // Validate position is visible on some display
  const isVisible = screen.getAllDisplays().some(display => {
    const d = display.bounds
    return (
      miniState.x !== undefined &&
      miniState.y !== undefined &&
      miniState.x >= d.x &&
      miniState.x < d.x + d.width &&
      miniState.y >= d.y &&
      miniState.y < d.y + d.height
    )
  })

  // If invalid or undefined, center on primary
  if (!isVisible || miniState.x === undefined || miniState.y === undefined) {
    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workArea
    miniState.x = Math.round(workArea.x + (workArea.width - 420) / 2)
    miniState.y = Math.round(workArea.y + (workArea.height - 110) / 2)
  }

  miniWin = new BrowserWindow({
    width: 420,
    height: 110,
    x: miniState.x,
    y: miniState.y,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false, // Hidden by default
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      webSecurity: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })



  // Persistence
  const saveMiniState = () => {
    if (!miniWin || miniWin.isDestroyed()) return
    const bounds = miniWin.getBounds()
    try {
      fs.writeFileSync(miniStatePath, JSON.stringify({ x: bounds.x, y: bounds.y }))
    } catch (e) {
      console.error('Failed to save mini player state', e)
    }
  }

  miniWin.on('move', () => {
    saveMiniState()
  })

  // Clean up
  miniWin.on('closed', () => {
    miniWin = null
  })

  // Load URL
  if (VITE_DEV_SERVER_URL) {
    // Hash routing for mini player
    miniWin.loadURL(`${VITE_DEV_SERVER_URL}#/mini-player`)
  } else {
    miniWin.loadFile(path.join(RENDERER_DIST, 'index.html'), { hash: '/mini-player' })
  }

  // Mouse Polling for Robust Hover/Drag Detection
  // We send coordinates to renderer so it can perform elementFromPoint
  // This bypasses the issue where WebkitAppRegion: drag swallows mouse events
  const pollCursor = () => {
    if (!miniWin || miniWin.isDestroyed() || !miniWin.isVisible()) {
      setTimeout(pollCursor, 100)
      return
    }

    try {
      const point = screen.getCursorScreenPoint()
      const bounds = miniWin.getBounds()

      const inside = (
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height
      )

      if (inside) {
        const relativeX = point.x - bounds.x
        const relativeY = point.y - bounds.y
        miniWin.webContents.send('mini-player:cursor-poll', { x: relativeX, y: relativeY })
      } else {
        // Send one "outside" event to ensure cleanup
        miniWin.webContents.send('mini-player:cursor-poll', { x: -1, y: -1 })
      }
    } catch (e) {
      // Ignore
    }
    setTimeout(pollCursor, 40) // ~25fps is enough
  }
  pollCursor()
}

// IPC Wiring for Mini Player
ipcMain.on('mini-player:set-ignore-mouse-events', (_event, ignore, options) => {
  if (miniWin && !miniWin.isDestroyed()) {
    miniWin.setIgnoreMouseEvents(ignore, options)
  }
})

ipcMain.on('mini-player:toggle', () => {
  if (!miniWin) {
    createMiniPlayerWindow()
    // TS thinks miniWin is still null here, but createMiniPlayerWindow assigns it.
    if (miniWin) {
      // @ts-ignore
      miniWin.show()
      if (win) {
        win.hide()
        win.webContents.send('mini-player:visibility-change', true)
      }
    }
    return
  }
  if (miniWin.isVisible()) {
    miniWin.hide()
    if (win) {
      if (!win.isVisible()) win.show()
      win.webContents.send('mini-player:visibility-change', false)
    }
  } else {
    miniWin.show()
    // Hide main window as requested
    if (win) {
      win.hide()
      win.webContents.send('mini-player:visibility-change', true)
    }
  }
})

ipcMain.handle('mini-player:get-visibility', () => {
  return miniWin ? miniWin.isVisible() : false
})

ipcMain.on('mini-player:resize', (_event, width, height) => {
  if (miniWin && !miniWin.isDestroyed()) {
    miniWin.setSize(Math.ceil(width), Math.ceil(height))
  }
})

// Relay Commands: Mini -> Main Window
ipcMain.on('mini-player:command', (_event, command, ...args) => {
  // If "toggleMainWindow" command
  if (command === 'toggleMainWindow') {
    if (win) {
      if (win.isVisible() && !win.isMinimized()) {
        win.hide()
      } else {
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      }
    }
    return
  }

  if (command === 'showMainWindow') {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
    return
  }

  // Forward to Main Window
  if (win && !win.isDestroyed()) {
    win.webContents.send('mini-player:command', command, ...args)
  }
})

// Relay State: Main Window -> Mini Player
ipcMain.on('mini-player:update-state', (_event, state) => {
  if (miniWin && !miniWin.isDestroyed()) {
    miniWin.webContents.send('mini-player:update-state', state)
  }
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // Keep app running for tray behavior on all platforms (Phase 1 req)
  /* if (process.platform !== 'darwin') {
    app.quit()
    win = null
  } */
})


app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

ipcMain.handle('dialog:open-audio-file', async () => {
  const browserWindow = BrowserWindow.getFocusedWindow() ?? win
  const options = {
    properties: ['openFile', 'multiSelections'] as ('openFile' | 'multiSelections')[],
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

  return filePaths
})

ipcMain.handle('library:add-local-song', async (_event, payload) => {
  return addLocalSong(payload)
})

ipcMain.handle('library:load-all', async () => {
  return loadAllSongs()
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

ipcMain.handle('library:open-song-folder', async (_event, id: string) => {
  const songDir = getSongDirById(id)
  await shell.openPath(songDir)
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
    await deleteSong(id)
    // Also remove from download history if exists
    downloadManager.removeJobBySongId(id)
    return true
  }
  return false
})

ipcMain.handle('library:update-song', async (_event, payload: { id: string; updates: any }) => {
  return updateSong(payload.id, payload.updates)
})

ipcMain.handle('jobs:queue-separation', async (_event, songId: string, quality?: 'high' | 'normal' | 'fast') => {
  return queueSeparationJob(songId, quality)
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

ipcMain.handle('lyrics:enrich', async (_event, lines: string[]) => {
  return enrichLyrics(lines)
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
  return savePlaylists(playlists)
})

ipcMain.handle('userData:load-playlists', async () => {
  return loadPlaylists()
})

ipcMain.handle('userData:save-settings', async (_event, settings: any) => {
  return saveSettings(settings)
})

ipcMain.handle('userData:load-settings', async () => {
  return loadSettings()
})

ipcMain.on('jobs:subscribe', async (event, subscriptionId: string) => {
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
function getDownloadManager() {
  // Ensure hook is set (idempotent assignment)
  downloadManager.onLibraryChanged = () => {
    BrowserWindow.getAllWindows().forEach(w => {
      w.webContents.send('library:changed')
    })
  }
  return downloadManager
}

ipcMain.handle('downloads:validate', async (_event, url: string) => {
  const dm = getDownloadManager()
  return dm.validateUrl(url)
})

ipcMain.handle('downloads:queue', async (_event, url: string, quality: 'best' | 'high' | 'normal', title?: string, artist?: string, type?: import('../shared/songTypes').SongType, lyricsText?: string, lyricsLrc?: string) => {
  const dm = getDownloadManager()
  return dm.queueJob(url, quality, title, artist, type, lyricsText, lyricsLrc)
})

ipcMain.handle('downloads:get-all', async () => {
  const dm = getDownloadManager()
  return dm.getAll()
})

ipcMain.handle('downloads:remove', async (_event, id: string) => {
  const dm = getDownloadManager()
  dm.removeJob(id)
})

ipcMain.on('downloads:subscribe', async (event, subscriptionId: string) => {
  const dm = getDownloadManager()
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

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })

  app.whenReady().then(async () => {
    // Preserve User Data path before changing App Name for display
    const userDataPath = app.getPath('userData')
    app.setName('KHelper V3')
    app.setPath('userData', userDataPath)

    console.log('[App] userData path:', app.getPath('userData'))

    // Initialize Updater
    initUpdater()

    // Initialize Tray
    createTray()

    // Subscribe to Updater Status for Tray Menu
    onStatusChange((status) => {
      updateTrayMenu(status.status)
    })

    // Lazy load this too if needed, or just remove if not critical
    // console.log('[Library] base songs dir:', getSongsBaseDir()) 
    createWindow()
  })
}


const clients: Set<Response> = new Set()

// State cache for new clients
// Moved from bottom of file to here for scope access in server
let lastSongInfo: any = null;
let lastStyle: any = null;
let lastPreferences: any = null;

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

  // Parse URL to ignore query parameters in routing
  const urlObj = new URL(req.url || '/', `http://localhost:${OVERLAY_PORT}`)
  const pathname = urlObj.pathname

  // Logging for debug
  const isAsset = pathname.startsWith('/assets/');
  if (isAsset || pathname.startsWith('/obs/')) {
    console.log(`[OverlayServer] Request: ${pathname} (Original: ${req.url})`);
  }

  if (pathname === '/events') {
    // ... (keep existing SSE logic)
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

  if (pathname.startsWith('/lyrics')) {
    // ... (keep existing Lyrics logic)
    const songId = urlObj.searchParams.get('id')

    if (!songId) {
      res.writeHead(400)
      res.end('Missing songId')
      return
    }

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
    return
  }

  if (pathname === '/batch-metadata' && req.method === 'POST') {
    // ... (keep existing Metadata logic)
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
    // ... (keep existing Dev logic)
    const devUrl = process.env.VITE_DEV_SERVER_URL.endsWith('/')
      ? process.env.VITE_DEV_SERVER_URL
      : `${process.env.VITE_DEV_SERVER_URL}/`;

    console.log('[OverlayServer] Dev Redirect Check:', pathname);

    if (pathname.startsWith('/obs/setlist') || pathname === '/setlist') {
      console.log('[OverlayServer] Redirecting to Setlist');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.writeHead(302, { 'Location': `${devUrl}#/setlist` })
      res.end()
      return
    }
    if (pathname.startsWith('/obs/all') || pathname === '/all') {
      console.log('[OverlayServer] Redirecting to Combined');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.writeHead(302, { 'Location': `${devUrl}#/all` })
      res.end()
      return
    }
    if (pathname === '/' || pathname === '/overlay' || pathname.startsWith('/#/')) {
      console.log('[OverlayServer] Redirecting to Default Overlay');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.writeHead(302, { 'Location': `${devUrl}#/overlay` })
      res.end()
      return
    }
    // Also support readable /lyrics or /obs/lyrics -> redirect to overlay
    if (pathname.startsWith('/lyrics') || pathname.startsWith('/obs/lyrics')) {
      console.log('[OverlayServer] Redirecting to Lyrics');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.writeHead(302, { 'Location': `${devUrl}#/overlay` })
      res.end()
      return
    }
  }

  // Serve static files for the overlay
  // Handle relative path safely
  let safePath = pathname.startsWith('/') ? pathname.slice(1) : pathname;

  // FIX for relative asset paths when accessing nested routes (e.g. /obs/setlist -> /obs/assets/index.js)
  // If the path contains 'assets/', we force it to be served from the root 'dist/assets/'
  if (pathname.includes('/assets/')) {
    const assetPart = pathname.substring(pathname.indexOf('/assets/')); // "/assets/foo.js"
    safePath = assetPart.startsWith('/') ? assetPart.slice(1) : assetPart; // "assets/foo.js"
  } else if (safePath.endsWith('.svg') || safePath.endsWith('.png') || safePath.endsWith('.ico')) {
    // Also handle root assets like vite.svg referenced relatively
    safePath = path.basename(safePath);
  }

  let filePath = path.join(RENDERER_DIST, safePath === '' ? 'index.html' : safePath);

  // SPA Routing overrides
  if (pathname === '/' || pathname === '/overlay' || pathname === '/obs/setlist' || pathname === '/obs/all' || pathname === '/obs/lyrics' || pathname === '/lyrics') {
    filePath = path.join(RENDERER_DIST, 'index.html')
  }

  if (isAsset || pathname.includes('/assets/')) {
    // console.log(`[OverlayServer] Serving Asset: ${pathname} -> ${filePath}`);
    if (!fs.existsSync(filePath)) {
      console.error(`[OverlayServer] Asset NOT FOUND: ${filePath} (Base: ${RENDERER_DIST})`);
    }
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
        // Only warn if it looked like an asset
        if (filePath.includes('assets') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
          console.warn(`[OverlayServer] Asset fallback triggered for ${pathname} (Resolved: ${filePath})`);
        }

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
  console.log(`[OverlayServer] Serving from: ${RENDERER_DIST}`)
})

app.on('before-quit', () => {
  server.close();
});

ipcMain.on('window:open-overlay', () => {
  // Deprecated: We now use the browser source URL
  console.log('[Main] window:open-overlay called but deprecated in favor of OBS URL')
})

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
