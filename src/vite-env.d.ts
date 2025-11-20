/// <reference types="vite/client" />

interface Window {
  ipcRenderer: import('electron').IpcRenderer;
  api: {
    openAudioFileDialog: () => Promise<string | null>;
  };
}
