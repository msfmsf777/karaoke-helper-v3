"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  }
  // You can expose other APTs you need here.
  // ...
});
electron.contextBridge.exposeInMainWorld("api", {
  openAudioFileDialog: () => electron.ipcRenderer.invoke("dialog:open-audio-file"),
  openOverlayWindow: () => electron.ipcRenderer.send("window:open-overlay"),
  sendOverlayUpdate: (payload) => electron.ipcRenderer.send("overlay:update", payload),
  subscribeOverlayUpdates: (callback) => {
    const listener = (_event, payload) => callback(payload);
    electron.ipcRenderer.on("overlay:update", listener);
    return () => electron.ipcRenderer.off("overlay:update", listener);
  }
});
electron.contextBridge.exposeInMainWorld("khelper", {
  dialogs: {
    pickAudioFile: () => electron.ipcRenderer.invoke("dialog:open-audio-file")
  },
  songLibrary: {
    addLocalSong: (payload) => electron.ipcRenderer.invoke("library:add-local-song", payload),
    loadAllSongs: () => electron.ipcRenderer.invoke("library:load-all"),
    getSongFilePath: (id) => electron.ipcRenderer.invoke("library:get-song-file-path", id),
    getOriginalSongFilePath: (id) => electron.ipcRenderer.invoke("library:get-original-song-file-path", id),
    getSeparatedSongPaths: (id) => electron.ipcRenderer.invoke("library:get-separated-song-paths", id),
    getBasePath: () => electron.ipcRenderer.invoke("library:get-base-path"),
    deleteSong: (id) => electron.ipcRenderer.invoke("library:delete-song", id),
    updateSong: (id, updates) => electron.ipcRenderer.invoke("library:update-song", { id, updates })
  },
  jobs: {
    queueSeparationJob: (songId) => electron.ipcRenderer.invoke("jobs:queue-separation", songId),
    getAllJobs: () => electron.ipcRenderer.invoke("jobs:get-all"),
    subscribeJobUpdates: (callback) => {
      const listener = (_event, jobs) => callback(jobs);
      const subscriptionId = `jobs-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
      electron.ipcRenderer.send("jobs:subscribe", subscriptionId);
      electron.ipcRenderer.on("jobs:updated", listener);
      return () => {
        electron.ipcRenderer.send("jobs:unsubscribe", subscriptionId);
        electron.ipcRenderer.off("jobs:updated", listener);
      };
    }
  },
  lyrics: {
    readRawLyrics: (songId) => electron.ipcRenderer.invoke("lyrics:read-raw", songId),
    readSyncedLyrics: (songId) => electron.ipcRenderer.invoke("lyrics:read-synced", songId),
    writeRawLyrics: (payload) => electron.ipcRenderer.invoke("lyrics:write-raw", payload),
    writeSyncedLyrics: (payload) => electron.ipcRenderer.invoke("lyrics:write-synced", payload)
  },
  queue: {
    save: (payload) => electron.ipcRenderer.invoke("queue:save", payload),
    load: () => electron.ipcRenderer.invoke("queue:load")
  },
  userData: {
    saveFavorites: (songIds) => electron.ipcRenderer.invoke("userData:save-favorites", songIds),
    loadFavorites: () => electron.ipcRenderer.invoke("userData:load-favorites"),
    saveHistory: (songIds) => electron.ipcRenderer.invoke("userData:save-history", songIds),
    loadHistory: () => electron.ipcRenderer.invoke("userData:load-history"),
    savePlaylists: (playlists) => electron.ipcRenderer.invoke("userData:save-playlists", playlists),
    loadPlaylists: () => electron.ipcRenderer.invoke("userData:load-playlists"),
    saveSettings: (settings) => electron.ipcRenderer.invoke("userData:save-settings", settings),
    loadSettings: () => electron.ipcRenderer.invoke("userData:load-settings")
  }
});
