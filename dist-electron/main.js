import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import http from "node:http";
import fs from "node:fs";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
const jobSubscriptions = /* @__PURE__ */ new Map();
const downloadSubscriptions = /* @__PURE__ */ new Map();
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
  const { addLocalSong } = await import("./songLibrary-IuL3IOY5.js");
  return addLocalSong(payload);
});
ipcMain.handle("library:load-all", async () => {
  const { loadAllSongs } = await import("./songLibrary-IuL3IOY5.js");
  const songs = await loadAllSongs();
  return songs;
});
ipcMain.handle("library:get-song-file-path", async (_event, id) => {
  const { getSongFilePath } = await import("./songLibrary-IuL3IOY5.js");
  return getSongFilePath(id);
});
ipcMain.handle("library:get-original-song-file-path", async (_event, id) => {
  const { getOriginalSongFilePath } = await import("./songLibrary-IuL3IOY5.js");
  return getOriginalSongFilePath(id);
});
ipcMain.handle("library:get-separated-song-paths", async (_event, id) => {
  const { getSeparatedSongPaths } = await import("./songLibrary-IuL3IOY5.js");
  return getSeparatedSongPaths(id);
});
ipcMain.handle("library:get-base-path", async () => {
  const { getSongsBaseDir } = await import("./songLibrary-IuL3IOY5.js");
  return getSongsBaseDir();
});
ipcMain.handle("library:delete-song", async (_event, id) => {
  if (!win) return;
  const result = await dialog.showMessageBox(win, {
    type: "warning",
    title: "刪除歌曲",
    message: "確定要刪除這首歌曲嗎？此操作無法復原。",
    buttons: ["取消", "刪除"],
    defaultId: 0,
    cancelId: 0
  });
  if (result.response === 1) {
    const { deleteSong } = await import("./songLibrary-IuL3IOY5.js");
    await deleteSong(id);
    const { downloadManager } = await import("./downloadJobs-BUxKSFWC.js");
    downloadManager.removeJobBySongId(id);
    return true;
  }
  return false;
});
ipcMain.handle("library:update-song", async (_event, payload) => {
  const { updateSong } = await import("./songLibrary-IuL3IOY5.js");
  return updateSong(payload.id, payload.updates);
});
ipcMain.handle("jobs:queue-separation", async (_event, songId, quality) => {
  const { queueSeparationJob } = await import("./separationJobs-vnrkmBQP.js");
  return queueSeparationJob(songId, quality);
});
ipcMain.handle("jobs:get-all", async () => {
  const { getAllJobs } = await import("./separationJobs-vnrkmBQP.js");
  return getAllJobs();
});
ipcMain.handle("lyrics:read-raw", async (_event, songId) => {
  const { readRawLyrics } = await import("./lyrics-CS0DrMxd.js");
  return readRawLyrics(songId);
});
ipcMain.handle("lyrics:read-synced", async (_event, songId) => {
  const { readSyncedLyrics } = await import("./lyrics-CS0DrMxd.js");
  return readSyncedLyrics(songId);
});
ipcMain.handle("lyrics:write-raw", async (_event, payload) => {
  const { writeRawLyrics } = await import("./lyrics-CS0DrMxd.js");
  return writeRawLyrics(payload.songId, payload.content);
});
ipcMain.handle("lyrics:write-synced", async (_event, payload) => {
  const { writeSyncedLyrics } = await import("./lyrics-CS0DrMxd.js");
  return writeSyncedLyrics(payload.songId, payload.content);
});
ipcMain.handle("queue:save", async (_event, payload) => {
  const { saveQueue } = await import("./queue-Cm6GAPWY.js");
  return saveQueue(payload);
});
ipcMain.handle("queue:load", async () => {
  const { loadQueue } = await import("./queue-Cm6GAPWY.js");
  return loadQueue();
});
ipcMain.handle("userData:save-favorites", async (_event, songIds) => {
  const { saveFavorites } = await import("./userData-D7f6Pjef.js");
  return saveFavorites(songIds);
});
ipcMain.handle("userData:load-favorites", async () => {
  const { loadFavorites } = await import("./userData-D7f6Pjef.js");
  return loadFavorites();
});
ipcMain.handle("userData:save-history", async (_event, songIds) => {
  const { saveHistory } = await import("./userData-D7f6Pjef.js");
  return saveHistory(songIds);
});
ipcMain.handle("userData:load-history", async () => {
  const { loadHistory } = await import("./userData-D7f6Pjef.js");
  return loadHistory();
});
ipcMain.handle("userData:save-playlists", async (_event, playlists) => {
  const { savePlaylists } = await import("./userData-D7f6Pjef.js");
  return savePlaylists(playlists);
});
ipcMain.handle("userData:load-playlists", async () => {
  const { loadPlaylists } = await import("./userData-D7f6Pjef.js");
  return loadPlaylists();
});
ipcMain.handle("userData:save-settings", async (_event, settings) => {
  const { saveSettings } = await import("./userData-D7f6Pjef.js");
  return saveSettings(settings);
});
ipcMain.handle("userData:load-settings", async () => {
  const { loadSettings } = await import("./userData-D7f6Pjef.js");
  return loadSettings();
});
ipcMain.on("jobs:subscribe", async (event, subscriptionId) => {
  const { subscribeJobUpdates } = await import("./separationJobs-vnrkmBQP.js");
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
async function getDownloadManager() {
  const { downloadManager } = await import("./downloadJobs-BUxKSFWC.js");
  downloadManager.onLibraryChanged = () => {
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.send("library:changed");
    });
  };
  return downloadManager;
}
ipcMain.handle("downloads:validate", async (_event, url) => {
  const dm = await getDownloadManager();
  return dm.validateUrl(url);
});
ipcMain.handle("downloads:queue", async (_event, url, quality, title, artist) => {
  const dm = await getDownloadManager();
  return dm.queueJob(url, quality, title, artist);
});
ipcMain.handle("downloads:get-all", async () => {
  const dm = await getDownloadManager();
  return dm.getAll();
});
ipcMain.on("downloads:subscribe", async (event, subscriptionId) => {
  const dm = await getDownloadManager();
  const wc = event.sender;
  const disposer = dm.subscribe((jobs) => wc.send("downloads:updated", jobs));
  let disposers = downloadSubscriptions.get(wc.id);
  if (!disposers) {
    disposers = /* @__PURE__ */ new Map();
    downloadSubscriptions.set(wc.id, disposers);
    wc.once("destroyed", () => {
      disposers == null ? void 0 : disposers.forEach((fn) => fn());
      downloadSubscriptions.delete(wc.id);
    });
  }
  disposers.set(subscriptionId, disposer);
});
ipcMain.on("downloads:unsubscribe", (event, subscriptionId) => {
  const disposers = downloadSubscriptions.get(event.sender.id);
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
app.whenReady().then(async () => {
  console.log("[App] userData path:", app.getPath("userData"));
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
    import("./lyrics-CS0DrMxd.js").then(({ readSyncedLyrics, readRawLyrics }) => {
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
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        fs.readFile(path.join(RENDERER_DIST, "index.html"), (err2, content2) => {
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
