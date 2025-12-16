"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(channel, listener) {
    const subscription = (event, ...args) => listener(event, ...args);
    electron.ipcRenderer.on(channel, subscription);
    return () => {
      electron.ipcRenderer.off(channel, subscription);
    };
  },
  off(channel, listener) {
    electron.ipcRenderer.off(channel, listener);
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
  openExternal: (url) => electron.ipcRenderer.invoke("shell:open-external", url),
  openOverlayWindow: () => electron.ipcRenderer.send("window:open-overlay"),
  sendOverlayUpdate: (payload) => electron.ipcRenderer.send("overlay:update", payload),
  subscribeOverlayUpdates: (callback) => {
    const listener = (_event, payload) => callback(payload);
    electron.ipcRenderer.on("overlay:update", listener);
    return () => electron.ipcRenderer.off("overlay:update", listener);
  },
  sendOverlayStyleUpdate: (style) => electron.ipcRenderer.send("overlay:style-update", style),
  subscribeOverlayStyleUpdates: (callback) => {
    const listener = (_event, style) => callback(style);
    electron.ipcRenderer.on("overlay:style-update", listener);
    return () => electron.ipcRenderer.off("overlay:style-update", listener);
  },
  sendOverlayPreferenceUpdate: (prefs) => electron.ipcRenderer.send("overlay:preference-update", prefs),
  subscribeOverlayPreferenceUpdates: (callback) => {
    const listener = (_event, prefs) => callback(prefs);
    electron.ipcRenderer.on("overlay:preference-update", listener);
    return () => electron.ipcRenderer.off("overlay:preference-update", listener);
  },
  sendOverlayScrollUpdate: (scrollY) => electron.ipcRenderer.send("overlay:scroll-update", scrollY),
  subscribeOverlayScrollUpdates: (callback) => {
    const listener = (_event, scrollY) => callback(scrollY);
    electron.ipcRenderer.on("overlay:scroll-update", listener);
    return () => electron.ipcRenderer.off("overlay:scroll-update", listener);
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
    queueSeparationJob: (songId, quality) => electron.ipcRenderer.invoke("jobs:queue-separation", songId, quality),
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
  downloads: {
    validateUrl: (url) => electron.ipcRenderer.invoke("downloads:validate", url),
    queueDownload: (url, quality, title, artist, type, lyricsText) => electron.ipcRenderer.invoke("downloads:queue", url, quality, title, artist, type, lyricsText),
    getAllJobs: () => electron.ipcRenderer.invoke("downloads:get-all"),
    subscribeUpdates: (callback) => {
      const listener = (_event, jobs) => callback(jobs);
      const subscriptionId = `dl-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
      electron.ipcRenderer.send("downloads:subscribe", subscriptionId);
      electron.ipcRenderer.on("downloads:updated", listener);
      return () => {
        electron.ipcRenderer.send("downloads:unsubscribe", subscriptionId);
        electron.ipcRenderer.off("downloads:updated", listener);
      };
    }
  },
  lyrics: {
    readRawLyrics: (songId) => electron.ipcRenderer.invoke("lyrics:read-raw", songId),
    readSyncedLyrics: (songId) => electron.ipcRenderer.invoke("lyrics:read-synced", songId),
    writeRawLyrics: (payload) => electron.ipcRenderer.invoke("lyrics:write-raw", payload),
    writeSyncedLyrics: (payload) => electron.ipcRenderer.invoke("lyrics:write-synced", payload),
    enrichLyrics: (lines) => electron.ipcRenderer.invoke("lyrics:enrich", lines)
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
  },
  updater: {
    check: () => electron.ipcRenderer.invoke("updater:check"),
    openReleasePage: () => electron.ipcRenderer.invoke("updater:open-release-page"),
    ignore: (version) => electron.ipcRenderer.invoke("updater:ignore", version),
    getStatus: () => electron.ipcRenderer.invoke("updater:get-status"),
    onStatus: (callback) => {
      const listener = (_event, payload) => callback(payload);
      electron.ipcRenderer.on("updater:status", listener);
      return () => electron.ipcRenderer.off("updater:status", listener);
    }
  },
  windowOps: {
    minimize: () => electron.ipcRenderer.send("window:minimize"),
    maximize: () => electron.ipcRenderer.send("window:maximize"),
    close: () => electron.ipcRenderer.send("window:close"),
    isMaximized: () => electron.ipcRenderer.invoke("window:is-maximized"),
    onMaximized: (callback) => {
      const subscription = (_event) => callback();
      electron.ipcRenderer.on("window:maximized", subscription);
      return () => electron.ipcRenderer.removeListener("window:maximized", subscription);
    },
    onUnmaximized: (callback) => {
      const subscription = (_event) => callback();
      electron.ipcRenderer.on("window:unmaximized", subscription);
      return () => electron.ipcRenderer.removeListener("window:unmaximized", subscription);
    }
  },
  navigation: {
    onNavigate: (callback) => {
      const listener = (_event, view) => callback(view);
      electron.ipcRenderer.on("navigate", listener);
      return () => electron.ipcRenderer.off("navigate", listener);
    }
  },
  miniPlayer: {
    sendCommand: (command, ...args) => electron.ipcRenderer.send("mini-player:command", command, ...args),
    onCommand: (callback) => {
      const listener = (_event, command, ...args) => callback(command, ...args);
      electron.ipcRenderer.on("mini-player:command", listener);
      return () => electron.ipcRenderer.off("mini-player:command", listener);
    },
    sendStateUpdate: (state) => electron.ipcRenderer.send("mini-player:update-state", state),
    onStateUpdate: (callback) => {
      const listener = (_event, state) => callback(state);
      electron.ipcRenderer.on("mini-player:update-state", listener);
      return () => electron.ipcRenderer.off("mini-player:update-state", listener);
    },
    toggle: () => electron.ipcRenderer.send("mini-player:toggle"),
    resize: (width, height) => electron.ipcRenderer.send("mini-player:resize", width, height)
  }
});
