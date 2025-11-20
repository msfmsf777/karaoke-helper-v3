import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
const APP_FOLDER_NAME = "KHelperLive";
const SONGS_FOLDER_NAME = "songs";
function getAppDataRoot() {
  const userData = app.getPath("userData");
  return path.join(userData, APP_FOLDER_NAME);
}
function getSongsDir() {
  return path.join(getAppDataRoot(), SONGS_FOLDER_NAME);
}
async function ensureSongsDir() {
  const base = getSongsDir();
  await fs.mkdir(base, { recursive: true });
  return base;
}
async function readMeta(songDir) {
  try {
    const metaRaw = await fs.readFile(path.join(songDir, "meta.json"), "utf-8");
    return JSON.parse(metaRaw);
  } catch (err) {
    console.warn("[Library] Failed to read meta.json from", songDir, err);
    return null;
  }
}
function generateSongId() {
  return `${Date.now()}`;
}
async function addLocalSong(params) {
  const { sourcePath, title, artist, type } = params;
  if (!sourcePath || !title) {
    throw new Error("sourcePath and title are required");
  }
  const songsDir = await ensureSongsDir();
  const id = generateSongId();
  const songDir = path.join(songsDir, id);
  await fs.mkdir(songDir, { recursive: true });
  const ext = path.extname(sourcePath) || ".mp3";
  const storedFilename = `Original${ext}`;
  const targetPath = path.join(songDir, storedFilename);
  console.log("[Library] Adding song", { sourcePath, songDir, id });
  await fs.copyFile(sourcePath, targetPath);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const meta = {
    id,
    title,
    artist: (artist == null ? void 0 : artist.trim()) || void 0,
    type,
    audio_status: "ready",
    lyrics_status: "none",
    source: {
      kind: "file",
      originalPath: sourcePath
    },
    stored_filename: storedFilename,
    created_at: now,
    updated_at: now
  };
  await fs.writeFile(path.join(songDir, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");
  console.log("[Library] Saved meta.json", { id, path: path.join(songDir, "meta.json") });
  return meta;
}
async function loadAllSongs() {
  const songsDir = await ensureSongsDir();
  const entries = await fs.readdir(songsDir, { withFileTypes: true });
  const metas = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const songDir = path.join(songsDir, entry.name);
    const meta = await readMeta(songDir);
    if (meta) {
      metas.push(meta);
    }
  }
  console.log("[Library] Loaded songs", { count: metas.length, songsDir });
  return metas.sort((a, b) => Number(b.id) - Number(a.id));
}
async function getSongFilePath(id) {
  if (!id) return null;
  const songsDir = await ensureSongsDir();
  const songDir = path.join(songsDir, id);
  const meta = await readMeta(songDir);
  if (!meta) return null;
  const candidate = path.join(songDir, meta.stored_filename || `Original${path.extname(meta.source.originalPath)}`);
  try {
    await fs.access(candidate);
    return candidate;
  } catch (err) {
    console.warn("[Library] Stored audio file missing", { id, candidate, err });
    return null;
  }
}
function getSongsBaseDir() {
  return getSongsDir();
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      // Allow loading local file:// resources from the renderer (needed for direct audio file playback in dev/HTTP origin).
      webSecurity: false
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
ipcMain.handle("dialog:open-audio-file", async () => {
  const browserWindow = BrowserWindow.getFocusedWindow() ?? win;
  const { canceled, filePaths } = await dialog.showOpenDialog(browserWindow ?? void 0, {
    properties: ["openFile"],
    filters: [
      { name: "Audio Files", extensions: ["mp3", "wav", "flac", "aac", "m4a", "ogg"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });
  if (canceled || filePaths.length === 0) {
    return null;
  }
  return filePaths[0];
});
ipcMain.handle("library:add-local-song", async (_event, payload) => {
  return addLocalSong(payload);
});
ipcMain.handle("library:load-all", async () => {
  const songs = await loadAllSongs();
  return songs;
});
ipcMain.handle("library:get-song-file-path", async (_event, id) => {
  return getSongFilePath(id);
});
ipcMain.handle("library:get-base-path", async () => {
  return getSongsBaseDir();
});
app.whenReady().then(() => {
  console.log("[App] userData path:", app.getPath("userData"));
  console.log("[Library] base songs dir:", getSongsBaseDir());
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
