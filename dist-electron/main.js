var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
const APP_FOLDER_NAME = "KHelperLive";
const SONGS_FOLDER_NAME = "songs";
const AUDIO_STATUS_VALUES = ["original_only", "separation_pending", "separating", "separation_failed", "separated"];
const DEFAULT_AUDIO_STATUS = "original_only";
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
function normalizeAudioStatus(status, type) {
  if (status && AUDIO_STATUS_VALUES.includes(status)) {
    return status;
  }
  if (status === "ready" || status === "missing" || status === "error") {
    return DEFAULT_AUDIO_STATUS;
  }
  if (type === "伴奏") {
    return DEFAULT_AUDIO_STATUS;
  }
  return DEFAULT_AUDIO_STATUS;
}
function normalizeMeta(meta) {
  const normalized = {
    ...meta,
    audio_status: normalizeAudioStatus(meta.audio_status, meta.type),
    lyrics_status: meta.lyrics_status ?? "none",
    stored_filename: meta.stored_filename ?? `Original${path.extname(meta.source.originalPath) || ".mp3"}`,
    instrumental_path: meta.instrumental_path ?? void 0,
    vocal_path: meta.vocal_path ?? void 0,
    last_separation_error: meta.last_separation_error ?? null
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
    audio_status: DEFAULT_AUDIO_STATUS,
    lyrics_status: "none",
    source: {
      kind: "file",
      originalPath: sourcePath
    },
    stored_filename: storedFilename,
    instrumental_path: void 0,
    vocal_path: void 0,
    last_separation_error: null,
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
  candidates.push(path.join(songDir, meta.stored_filename || `Original${path.extname(meta.source.originalPath)}`));
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
function getSongsBaseDir() {
  return getSongsDir();
}
function generateJobId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}
async function runStubSeparation(originalPath, songFolder) {
  console.log("[Separation] Stub separation start", { originalPath, songFolder });
  const ext = path.extname(originalPath) || ".wav";
  const instrumentalPath = path.join(songFolder, `Instrumental${ext}`);
  const vocalPath = path.join(songFolder, `Vocals${ext}`);
  await fs.copyFile(originalPath, instrumentalPath);
  await fs.copyFile(originalPath, vocalPath);
  console.log("[Separation] Stub separation finished", { instrumentalPath, vocalPath });
  return { instrumentalPath, vocalPath };
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
      const { instrumentalPath, vocalPath } = await runStubSeparation(originalPath, songDir);
      await updateSongMeta(job.songId, (current) => ({
        ...current,
        audio_status: "separated",
        instrumental_path: instrumentalPath,
        vocal_path: vocalPath,
        last_separation_error: null
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
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const job = {
      id: generateJobId(),
      songId,
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
ipcMain.handle("jobs:queue-separation", async (_event, songId) => {
  return queueSeparationJob(songId);
});
ipcMain.handle("jobs:get-all", async () => {
  return getAllJobs();
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
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
