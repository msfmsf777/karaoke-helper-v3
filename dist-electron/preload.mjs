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
  openAudioFileDialog: () => electron.ipcRenderer.invoke("dialog:open-audio-file")
});
electron.contextBridge.exposeInMainWorld("khelper", {
  dialogs: {
    pickAudioFile: () => electron.ipcRenderer.invoke("dialog:open-audio-file")
  },
  songLibrary: {
    addLocalSong: (payload) => electron.ipcRenderer.invoke("library:add-local-song", payload),
    loadAllSongs: () => electron.ipcRenderer.invoke("library:load-all"),
    getSongFilePath: (id) => electron.ipcRenderer.invoke("library:get-song-file-path", id),
    getBasePath: () => electron.ipcRenderer.invoke("library:get-base-path")
  }
});
