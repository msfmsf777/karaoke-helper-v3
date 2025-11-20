/// <reference types="vite/client" />

interface Window {
  ipcRenderer: import('electron').IpcRenderer;
  api: {
    openAudioFileDialog: () => Promise<string | null>;
  };
  khelper?: {
    dialogs: {
      pickAudioFile: () => Promise<string | null>;
    };
    songLibrary: {
      addLocalSong: (payload: {
        sourcePath: string;
        title: string;
        artist?: string;
        type: import('../shared/songTypes').SongType;
      }) => Promise<import('../shared/songTypes').SongMeta>;
      loadAllSongs: () => Promise<import('../shared/songTypes').SongMeta[]>;
      getSongFilePath: (id: string) => Promise<string | null>;
      getBasePath: () => Promise<string>;
    };
    jobs: {
      queueSeparationJob: (songId: string) => Promise<import('../shared/separationTypes').SeparationJob>;
      getAllJobs: () => Promise<import('../shared/separationTypes').SeparationJob[]>;
      subscribeJobUpdates: (
        callback: (jobs: import('../shared/separationTypes').SeparationJob[]) => void
      ) => () => void;
    };
  };
}
