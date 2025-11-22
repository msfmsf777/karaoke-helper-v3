var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import http from "node:http";
import fs$1 from "node:fs";
const APP_FOLDER_NAME = "KHelperLive";
const SONGS_FOLDER_NAME = "songs";
const AUDIO_STATUS_VALUES = ["original_only", "separation_pending", "separating", "separation_failed", "separated"];
const DEFAULT_AUDIO_STATUS = "original_only";
const LYRICS_STATUS_VALUES = ["none", "text_only", "synced"];
const DEFAULT_LYRICS_STATUS = "none";
const RAW_LYRICS_FILENAME = "lyrics_raw.txt";
const SYNCED_LYRICS_FILENAME = "lyrics_synced.lrc";
function getAppDataRoot() {
  const userData2 = app.getPath("userData");
  return path.join(userData2, APP_FOLDER_NAME);
}
function getSongsDir() {
  return path.join(getAppDataRoot(), SONGS_FOLDER_NAME);
}
async function ensureSongsDir() {
  const base = getSongsDir();
  await fs.mkdir(base, { recursive: true });
  return base;
}
function normalizeAudioStatus(status) {
  if (status && AUDIO_STATUS_VALUES.includes(status)) {
    return status;
  }
  if (status === "ready" || status === "missing" || status === "error") {
    return DEFAULT_AUDIO_STATUS;
  }
  return DEFAULT_AUDIO_STATUS;
}
function normalizeLyricsStatus(status) {
  if (status && LYRICS_STATUS_VALUES.includes(status)) {
    return status;
  }
  if (status === "ready") return "synced";
  if (status === "missing") return "none";
  return DEFAULT_LYRICS_STATUS;
}
function getOriginalFilename(meta) {
  return meta.stored_filename || `Original${path.extname(meta.source.originalPath) || ".mp3"}`;
}
function getOriginalPath(meta, songDir) {
  return path.join(songDir, getOriginalFilename(meta));
}
function normalizeMeta(meta) {
  const normalized = {
    ...meta,
    audio_status: normalizeAudioStatus(meta.audio_status),
    lyrics_status: normalizeLyricsStatus(meta.lyrics_status),
    stored_filename: getOriginalFilename(meta),
    lyrics_raw_path: meta.lyrics_raw_path ?? void 0,
    lyrics_lrc_path: meta.lyrics_lrc_path ?? void 0,
    instrumental_path: meta.instrumental_path ?? void 0,
    vocal_path: meta.vocal_path ?? void 0,
    last_separation_error: meta.last_separation_error ?? null,
    separation_quality: meta.separation_quality ?? void 0
  };
  return normalized;
}
async function writeMeta(songDir, meta) {
  await fs.writeFile(path.join(songDir, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");
}
async function readMeta(songDir) {
  try {
    const metaRaw = await fs.readFile(path.join(songDir, "meta.json"), "utf-8");
    const parsed = JSON.parse(metaRaw);
    return normalizeMeta(parsed);
  } catch (err) {
    console.warn("[Library] Failed to read meta.json from", songDir, err);
    return null;
  }
}
function generateSongId() {
  return `${Date.now()}`;
}
async function addLocalSong(params) {
  const { sourcePath, title, artist, type, lyricsText } = params;
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
  const rawLyrics = (lyricsText ?? "").replace(/\r\n/g, "\n");
  const hasLyrics = rawLyrics.trim().length > 0;
  const lyricsRawPath = hasLyrics ? path.join(songDir, RAW_LYRICS_FILENAME) : void 0;
  if (hasLyrics && lyricsRawPath) {
    await fs.writeFile(lyricsRawPath, rawLyrics, "utf-8");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const meta = {
    id,
    title,
    artist: (artist == null ? void 0 : artist.trim()) || void 0,
    type,
    audio_status: DEFAULT_AUDIO_STATUS,
    lyrics_status: hasLyrics ? "text_only" : DEFAULT_LYRICS_STATUS,
    lyrics_raw_path: lyricsRawPath,
    lyrics_lrc_path: void 0,
    source: {
      kind: "file",
      originalPath: sourcePath
    },
    stored_filename: storedFilename,
    instrumental_path: void 0,
    vocal_path: void 0,
    last_separation_error: null,
    separation_quality: void 0,
    created_at: now,
    updated_at: now
  };
  await writeMeta(songDir, meta);
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
async function getSongMeta(id) {
  if (!id) return null;
  const songsDir = await ensureSongsDir();
  const songDir = path.join(songsDir, id);
  return readMeta(songDir);
}
async function updateSongMeta(id, mutate) {
  if (!id) return null;
  const songsDir = await ensureSongsDir();
  const songDir = path.join(songsDir, id);
  const current = await readMeta(songDir);
  if (!current) return null;
  const nextRaw = mutate(current);
  const next = normalizeMeta({
    ...current,
    ...nextRaw,
    id: current.id,
    created_at: current.created_at,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  await writeMeta(songDir, next);
  return next;
}
async function getSongFilePath(id) {
  if (!id) return null;
  const songsDir = await ensureSongsDir();
  const songDir = path.join(songsDir, id);
  const meta = await readMeta(songDir);
  if (!meta) return null;
  const candidates = [];
  if (meta.audio_status === "separated" && meta.instrumental_path) {
    candidates.push(meta.instrumental_path);
  }
  candidates.push(getOriginalPath(meta, songDir));
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      if (candidate !== candidates[candidates.length - 1]) {
        console.log("[Library] Using separated instrumental for playback", { id, candidate });
      }
      return candidate;
    } catch (err) {
      continue;
    }
  }
  console.warn("[Library] Stored audio file missing", { id, candidates });
  return null;
}
async function getOriginalSongFilePath(id) {
  if (!id) return null;
  const songsDir = await ensureSongsDir();
  const songDir = path.join(songsDir, id);
  const meta = await readMeta(songDir);
  if (!meta) return null;
  const originalPath = getOriginalPath(meta, songDir);
  try {
    await fs.access(originalPath);
    return originalPath;
  } catch {
    console.warn("[Library] Original audio file missing", { id, originalPath });
    return null;
  }
}
async function getSeparatedSongPaths(id) {
  if (!id) return { instrumental: "", vocal: null };
  const songsDir = await ensureSongsDir();
  const songDir = path.join(songsDir, id);
  const meta = await readMeta(songDir);
  if (!meta) return { instrumental: "", vocal: null };
  const originalPath = getOriginalPath(meta, songDir);
  const isAccompaniment = meta.type === "伴奏";
  const isSeparated = meta.audio_status === "separated" && meta.instrumental_path && meta.vocal_path;
  if (!isAccompaniment && isSeparated) {
    try {
      await Promise.all([
        fs.access(meta.instrumental_path),
        fs.access(meta.vocal_path)
      ]);
      return {
        instrumental: meta.instrumental_path,
        vocal: meta.vocal_path
      };
    } catch (err) {
      console.warn("[Library] Separated files missing, falling back to original", { id, err });
    }
  }
  try {
    await fs.access(originalPath);
    return { instrumental: originalPath, vocal: null };
  } catch {
    console.warn("[Library] Original audio file missing", { id, originalPath });
    return { instrumental: "", vocal: null };
  }
}
async function deleteSong(id) {
  if (!id) return;
  const songsDir = await ensureSongsDir();
  const songDir = path.join(songsDir, id);
  try {
    await fs.rm(songDir, { recursive: true, force: true });
    console.log("[Library] Deleted song folder", { id, songDir });
  } catch (err) {
    console.error("[Library] Failed to delete song folder", { id, songDir }, err);
    throw err;
  }
}
async function updateSong(id, updates) {
  return updateSongMeta(id, (current) => ({
    ...current,
    ...updates
  }));
}
function getSongsBaseDir() {
  return getSongsDir();
}
const songLibrary = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  RAW_LYRICS_FILENAME,
  SYNCED_LYRICS_FILENAME,
  addLocalSong,
  deleteSong,
  getOriginalSongFilePath,
  getSeparatedSongPaths,
  getSongFilePath,
  getSongMeta,
  getSongsBaseDir,
  loadAllSongs,
  updateSong,
  updateSongMeta
}, Symbol.toStringTag, { value: "Module" }));
const FAVORITES_FILE = "favorites.json";
const HISTORY_FILE = "history.json";
const SETTINGS_FILE = "settings.json";
function getUserDataPath(filename) {
  return path.join(app.getPath("userData"), filename);
}
async function saveFavorites(songIds) {
  try {
    const filePath = getUserDataPath(FAVORITES_FILE);
    await fs.writeFile(filePath, JSON.stringify(songIds, null, 2), "utf-8");
  } catch (err) {
    console.error("[UserData] Failed to save favorites", err);
  }
}
async function loadFavorites() {
  try {
    const filePath = getUserDataPath(FAVORITES_FILE);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("[UserData] Failed to load favorites", err);
    }
    return [];
  }
}
async function saveHistory(songIds) {
  try {
    const filePath = getUserDataPath(HISTORY_FILE);
    await fs.writeFile(filePath, JSON.stringify(songIds, null, 2), "utf-8");
  } catch (err) {
    console.error("[UserData] Failed to save history", err);
  }
}
async function loadHistory() {
  try {
    const filePath = getUserDataPath(HISTORY_FILE);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("[UserData] Failed to load history", err);
    }
    return [];
  }
}
async function saveSettings(settings) {
  try {
    const filePath = getUserDataPath(SETTINGS_FILE);
    await fs.writeFile(filePath, JSON.stringify(settings, null, 2), "utf-8");
  } catch (err) {
    console.error("[UserData] Failed to save settings", err);
  }
}
async function loadSettings() {
  try {
    const filePath = getUserDataPath(SETTINGS_FILE);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("[UserData] Failed to load settings", err);
    }
    return { separationQuality: "normal" };
  }
}
const PLAYLISTS_FILE = "playlists.json";
async function savePlaylists(playlists) {
  try {
    const filePath = getUserDataPath(PLAYLISTS_FILE);
    await fs.writeFile(filePath, JSON.stringify(playlists, null, 2), "utf-8");
  } catch (err) {
    console.error("[UserData] Failed to save playlists", err);
  }
}
async function loadPlaylists() {
  try {
    const filePath = getUserDataPath(PLAYLISTS_FILE);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("[UserData] Failed to load playlists", err);
    }
    return [];
  }
}
const userData = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loadFavorites,
  loadHistory,
  loadPlaylists,
  loadSettings,
  saveFavorites,
  saveHistory,
  savePlaylists,
  saveSettings
}, Symbol.toStringTag, { value: "Module" }));
function generateJobId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}
async function runDemucsSeparation(originalPath, songFolder, quality, onProgress) {
  console.log("[Separation] Starting MDX separation", { originalPath, songFolder, quality });
  const scriptPath = path.join(process.cwd(), "resources", "separation", "separate.py");
  return new Promise((resolve, reject) => {
    const python = spawn("python", [
      scriptPath,
      "--input",
      originalPath,
      "--output-dir",
      songFolder,
      "--quality",
      quality,
      "--cache-dir",
      path.join(process.env.APPDATA || "", "KHelperLive", "models")
    ]);
    let result = null;
    let errorOutput = "";
    python.stdout.on("data", (data) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.status === "success") {
            result = msg;
          } else if (msg.status === "progress" && typeof msg.progress === "number") {
            onProgress == null ? void 0 : onProgress(msg.progress);
          } else if (msg.error) {
            reject(new Error(`${msg.error} ${msg.details || ""}`));
          }
        } catch (e) {
        }
      }
    });
    python.stderr.on("data", (data) => {
      const str = data.toString();
      errorOutput += str;
    });
    python.on("close", (code) => {
      if (code === 0 && result && result.instrumental && result.vocal) {
        resolve({
          instrumentalPath: result.instrumental,
          vocalPath: result.vocal
        });
      } else {
        const msg = (result == null ? void 0 : result.error) || "Separation process failed";
        reject(new Error(`${msg} (Exit code ${code}). Details: ${errorOutput.slice(-500)}`));
      }
    });
  });
}
class SeparationJobManager {
  constructor() {
    __publicField(this, "jobs", []);
    __publicField(this, "runningJobId", null);
    __publicField(this, "subscribers", /* @__PURE__ */ new Set());
  }
  snapshot() {
    return [...this.jobs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  notify() {
    const current = this.snapshot();
    this.subscribers.forEach((fn) => {
      try {
        fn(current);
      } catch (err) {
        console.warn("[Separation] subscriber threw", err);
      }
    });
  }
  async ensureOriginalPath(meta) {
    const songDir = path.join(getSongsBaseDir(), meta.id);
    await fs.mkdir(songDir, { recursive: true });
    const originalPath = path.join(songDir, meta.stored_filename || `Original${path.extname(meta.source.originalPath) || ".mp3"}`);
    try {
      await fs.access(originalPath);
    } catch {
      throw new Error(`Original audio missing at ${originalPath}`);
    }
    return { songDir, originalPath };
  }
  updateJob(id, patch) {
    this.jobs = this.jobs.map(
      (job) => job.id === id ? {
        ...job,
        ...patch,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      } : job
    );
  }
  async executeJob(job) {
    try {
      const meta = await getSongMeta(job.songId);
      if (!meta) {
        throw new Error(`Song ${job.songId} not found for separation`);
      }
      await updateSongMeta(job.songId, (current) => ({
        ...current,
        audio_status: "separating",
        last_separation_error: null
      }));
      this.updateJob(job.id, { status: "running", errorMessage: void 0 });
      this.notify();
      const { songDir, originalPath } = await this.ensureOriginalPath(meta);
      const quality = job.quality || "normal";
      const { instrumentalPath, vocalPath } = await runDemucsSeparation(originalPath, songDir, quality, (progress) => {
        this.updateJob(job.id, { progress });
        this.notify();
      });
      await updateSongMeta(job.songId, (current) => ({
        ...current,
        audio_status: "separated",
        instrumental_path: instrumentalPath,
        vocal_path: vocalPath,
        last_separation_error: null,
        separation_quality: quality
      }));
      this.updateJob(job.id, { status: "succeeded", errorMessage: void 0 });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[Separation] Job failed", { jobId: job.id, songId: job.songId, message, err });
      await updateSongMeta(job.songId, (current) => ({
        ...current,
        audio_status: "separation_failed",
        last_separation_error: message
      }));
      this.updateJob(job.id, { status: "failed", errorMessage: message });
    } finally {
      this.runningJobId = null;
      this.notify();
      void this.processQueue();
    }
  }
  async processQueue() {
    if (this.runningJobId) return;
    const next = this.jobs.find((job) => job.status === "queued");
    if (!next) return;
    this.runningJobId = next.id;
    await this.executeJob(next);
  }
  async queueJob(songId) {
    const meta = await getSongMeta(songId);
    if (!meta) {
      throw new Error(`Cannot queue separation: song ${songId} not found`);
    }
    if (meta.type !== "原曲") {
      throw new Error("Only 原曲 songs support separation");
    }
    const existing = this.jobs.find(
      (job2) => job2.songId === songId && (job2.status === "queued" || job2.status === "running")
    );
    if (existing) {
      console.log("[Separation] Job already queued/running for song", songId, existing.id);
      return existing;
    }
    await updateSongMeta(songId, (current) => ({
      ...current,
      audio_status: "separation_pending",
      last_separation_error: null
    }));
    const settings = await loadSettings();
    const quality = settings.separationQuality || "normal";
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const job = {
      id: generateJobId(),
      songId,
      quality,
      createdAt: now,
      updatedAt: now,
      status: "queued"
    };
    this.jobs = [job, ...this.jobs];
    this.notify();
    void this.processQueue();
    console.log("[Separation] Queued job", job);
    return job;
  }
  async getAllJobs() {
    return this.snapshot();
  }
  subscribe(subscriber) {
    this.subscribers.add(subscriber);
    subscriber(this.snapshot());
    return () => this.subscribers.delete(subscriber);
  }
}
const jobManager = new SeparationJobManager();
function queueSeparationJob(songId) {
  return jobManager.queueJob(songId);
}
function getAllJobs() {
  return jobManager.getAllJobs();
}
function subscribeJobUpdates(callback) {
  return jobManager.subscribe(callback);
}
async function ensureSongFolder(songId) {
  const base = getSongsBaseDir();
  const songDir = path.join(base, songId);
  const meta = await getSongMeta(songId);
  if (!meta) {
    throw new Error(`Song ${songId} not found for lyrics operation`);
  }
  await fs.mkdir(songDir, { recursive: true });
  return { songDir, meta };
}
async function readRawLyrics(songId) {
  const { songDir, meta } = await ensureSongFolder(songId);
  const filePath = meta.lyrics_raw_path || path.join(songDir, RAW_LYRICS_FILENAME);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    console.log("[Lyrics] Loaded raw lyrics", { songId, filePath });
    return { path: filePath, content };
  } catch (err) {
    console.warn("[Lyrics] No raw lyrics found", { songId, filePath, err });
    return null;
  }
}
async function readSyncedLyrics(songId) {
  const { songDir, meta } = await ensureSongFolder(songId);
  const filePath = meta.lyrics_lrc_path || path.join(songDir, SYNCED_LYRICS_FILENAME);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    console.log("[Lyrics] Loaded synced lyrics", { songId, filePath });
    return { path: filePath, content };
  } catch (err) {
    console.warn("[Lyrics] No synced lyrics found", { songId, filePath, err });
    return null;
  }
}
async function writeRawLyrics(songId, content) {
  const { songDir } = await ensureSongFolder(songId);
  const normalized = content.replace(/\r\n/g, "\n");
  const filePath = path.join(songDir, RAW_LYRICS_FILENAME);
  await fs.writeFile(filePath, normalized, "utf-8");
  console.log("[Lyrics] Saved raw lyrics", { songId, filePath });
  const updated = await updateSongMeta(songId, (current) => ({
    ...current,
    lyrics_status: normalized.trim().length > 0 ? "text_only" : "none",
    lyrics_raw_path: filePath
  }));
  if (!updated) {
    throw new Error(`Failed to update meta after saving lyrics for ${songId}`);
  }
  return { path: filePath, meta: updated };
}
async function writeSyncedLyrics(songId, content) {
  const { songDir } = await ensureSongFolder(songId);
  const normalized = content.replace(/\r\n/g, "\n");
  const filePath = path.join(songDir, SYNCED_LYRICS_FILENAME);
  await fs.writeFile(filePath, normalized, "utf-8");
  console.log("[Lyrics] Saved synced lyrics", { songId, filePath });
  const updated = await updateSongMeta(songId, (current) => ({
    ...current,
    lyrics_status: "synced",
    lyrics_lrc_path: filePath,
    lyrics_raw_path: current.lyrics_raw_path ?? path.join(songDir, RAW_LYRICS_FILENAME)
  }));
  if (!updated) {
    throw new Error(`Failed to update meta after saving synced lyrics for ${songId}`);
  }
  return { path: filePath, meta: updated };
}
const QUEUE_FILE = "playback_queue.json";
function getQueueFilePath() {
  return path.join(app.getPath("userData"), QUEUE_FILE);
}
async function saveQueue(data) {
  try {
    const filePath = getQueueFilePath();
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
    console.log("[Queue] Saved queue to", filePath);
  } catch (err) {
    console.error("[Queue] Failed to save queue", err);
  }
}
async function loadQueue() {
  try {
    const filePath = getQueueFilePath();
    const content = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(content);
    console.log("[Queue] Loaded queue from", filePath);
    return data;
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("[Queue] Failed to load queue", err);
    }
    return null;
  }
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
const jobSubscriptions = /* @__PURE__ */ new Map();
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
  const options = {
    properties: ["openFile"],
    filters: [
      { name: "Audio Files", extensions: ["mp3", "wav", "flac", "aac", "m4a", "ogg"] },
      { name: "All Files", extensions: ["*"] }
    ]
  };
  const { canceled, filePaths } = browserWindow ? await dialog.showOpenDialog(browserWindow, options) : await dialog.showOpenDialog(options);
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
ipcMain.handle("library:get-original-song-file-path", async (_event, id) => {
  return getOriginalSongFilePath(id);
});
ipcMain.handle("library:get-separated-song-paths", async (_event, id) => {
  return getSeparatedSongPaths(id);
});
ipcMain.handle("library:get-base-path", async () => {
  return getSongsBaseDir();
});
ipcMain.handle("library:delete-song", async (_event, id) => {
  const { deleteSong: deleteSong2 } = await Promise.resolve().then(() => songLibrary);
  return deleteSong2(id);
});
ipcMain.handle("library:update-song", async (_event, payload) => {
  const { updateSong: updateSong2 } = await Promise.resolve().then(() => songLibrary);
  return updateSong2(payload.id, payload.updates);
});
ipcMain.handle("jobs:queue-separation", async (_event, songId) => {
  return queueSeparationJob(songId);
});
ipcMain.handle("jobs:get-all", async () => {
  return getAllJobs();
});
ipcMain.handle("lyrics:read-raw", async (_event, songId) => {
  return readRawLyrics(songId);
});
ipcMain.handle("lyrics:read-synced", async (_event, songId) => {
  return readSyncedLyrics(songId);
});
ipcMain.handle("lyrics:write-raw", async (_event, payload) => {
  return writeRawLyrics(payload.songId, payload.content);
});
ipcMain.handle("lyrics:write-synced", async (_event, payload) => {
  return writeSyncedLyrics(payload.songId, payload.content);
});
ipcMain.handle("queue:save", async (_event, payload) => {
  return saveQueue(payload);
});
ipcMain.handle("queue:load", async () => {
  return loadQueue();
});
ipcMain.handle("userData:save-favorites", async (_event, songIds) => {
  return saveFavorites(songIds);
});
ipcMain.handle("userData:load-favorites", async () => {
  return loadFavorites();
});
ipcMain.handle("userData:save-history", async (_event, songIds) => {
  return saveHistory(songIds);
});
ipcMain.handle("userData:load-history", async () => {
  return loadHistory();
});
ipcMain.handle("userData:save-playlists", async (_event, playlists) => {
  const { savePlaylists: savePlaylists2 } = await Promise.resolve().then(() => userData);
  return savePlaylists2(playlists);
});
ipcMain.handle("userData:load-playlists", async () => {
  const { loadPlaylists: loadPlaylists2 } = await Promise.resolve().then(() => userData);
  return loadPlaylists2();
});
ipcMain.handle("userData:save-settings", async (_event, settings) => {
  const { saveSettings: saveSettings2 } = await Promise.resolve().then(() => userData);
  return saveSettings2(settings);
});
ipcMain.handle("userData:load-settings", async () => {
  const { loadSettings: loadSettings2 } = await Promise.resolve().then(() => userData);
  return loadSettings2();
});
ipcMain.on("jobs:subscribe", (event, subscriptionId) => {
  const wc = event.sender;
  const disposer = subscribeJobUpdates((jobs) => wc.send("jobs:updated", jobs));
  let disposers = jobSubscriptions.get(wc.id);
  if (!disposers) {
    disposers = /* @__PURE__ */ new Map();
    jobSubscriptions.set(wc.id, disposers);
    wc.once("destroyed", () => {
      disposers == null ? void 0 : disposers.forEach((fn) => fn());
      jobSubscriptions.delete(wc.id);
    });
  }
  disposers.set(subscriptionId, disposer);
});
ipcMain.on("jobs:unsubscribe", (event, subscriptionId) => {
  const disposers = jobSubscriptions.get(event.sender.id);
  if (!disposers) return;
  if (subscriptionId) {
    const fn = disposers.get(subscriptionId);
    fn == null ? void 0 : fn();
    disposers.delete(subscriptionId);
  } else {
    disposers.forEach((fn) => fn());
    disposers.clear();
  }
});
app.whenReady().then(() => {
  console.log("[App] userData path:", app.getPath("userData"));
  console.log("[Library] base songs dir:", getSongsBaseDir());
  createWindow();
});
const clients = /* @__PURE__ */ new Set();
const OVERLAY_PORT = 10001;
const server = http.createServer((req, res) => {
  var _a, _b;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.url === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });
    res.write('data: {"type":"connected"}\n\n');
    const keepAlive = setInterval(() => {
      res.write(": keep-alive\n\n");
    }, 15e3);
    const client = res;
    clients.add(client);
    req.on("close", () => {
      clearInterval(keepAlive);
      clients.delete(client);
    });
    return;
  }
  if ((_a = req.url) == null ? void 0 : _a.startsWith("/lyrics")) {
    const url = new URL(req.url, `http://localhost:${OVERLAY_PORT}`);
    const songId = url.searchParams.get("id");
    if (!songId) {
      res.writeHead(400);
      res.end("Missing songId");
      return;
    }
    Promise.all([
      readSyncedLyrics(songId),
      readRawLyrics(songId)
    ]).then(([synced, raw]) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        synced: (synced == null ? void 0 : synced.content) || null,
        raw: (raw == null ? void 0 : raw.content) || null
      }));
    }).catch((err) => {
      console.error("[OverlayServer] Failed to read lyrics", err);
      res.writeHead(500);
      res.end("Internal Server Error");
    });
    return;
  }
  if (process.env.VITE_DEV_SERVER_URL) {
    if (req.url === "/" || req.url === "/overlay" || ((_b = req.url) == null ? void 0 : _b.startsWith("/#/"))) {
      res.writeHead(302, { "Location": `${process.env.VITE_DEV_SERVER_URL}#/overlay` });
      res.end();
      return;
    }
  }
  let filePath = path.join(RENDERER_DIST, req.url === "/" ? "index.html" : req.url || "index.html");
  if (req.url === "/" || req.url === "/overlay") {
    filePath = path.join(RENDERER_DIST, "index.html");
  }
  const extname = path.extname(filePath);
  let contentType = "text/html";
  switch (extname) {
    case ".js":
      contentType = "text/javascript";
      break;
    case ".css":
      contentType = "text/css";
      break;
    case ".json":
      contentType = "application/json";
      break;
    case ".png":
      contentType = "image/png";
      break;
    case ".jpg":
      contentType = "image/jpg";
      break;
    case ".svg":
      contentType = "image/svg+xml";
      break;
  }
  fs$1.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        fs$1.readFile(path.join(RENDERER_DIST, "index.html"), (err2, content2) => {
          if (err2) {
            res.writeHead(500);
            res.end("Error loading index.html");
          } else {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(content2, "utf-8");
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});
server.listen(OVERLAY_PORT, () => {
  console.log(`[OverlayServer] Listening on port ${OVERLAY_PORT}`);
});
ipcMain.on("window:open-overlay", () => {
  console.log("[Main] window:open-overlay called but deprecated in favor of OBS URL");
});
ipcMain.on("overlay:update", (_event, payload) => {
  const data = JSON.stringify(payload);
  for (const client of clients) {
    client.write(`data: ${data}

`);
  }
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
