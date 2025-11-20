# KHelperLive (Phase 3)

KHelperLive is a desktop application designed for VTubers and streamers who sing live. It provides a song library, lyric tools, and live mode controls built on Electron + React + TypeScript + Vite.

## Tech Stack

- Electron
- React
- TypeScript
- Vite

## Getting Started

### Prerequisites
- Node.js (v16 or higher recommended)
- npm (or pnpm/yarn)

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```

### Running in Development Mode

To start the app with hot reload:

```bash
npm run dev
```

## Project Structure

- `electron/`: Main and preload process code.
- `src/`: Renderer (React) code.
  - `components/`: UI components (Sidebar, PlayerBar, Views).
  - `App.tsx`: Main application layout.
  - `index.css`: Global styles.
- `shared/`: Shared types between main and renderer.

## Phase 0 Features

- Basic layout: sidebar navigation, main content area, and a persistent player bar.
- Views: `歌曲庫` (Library), `歌詞編輯` (Lyric Editor placeholder), `直播模式` (Stream Mode placeholder).
- Dark theme inspired by modern music apps.

## Phase 1 – Audio Playback

- `AudioEngine` abstraction wraps an HTML5 `<audio>` element; React components only talk to this interface.
- Temporary "add song" button opened the OS file picker (mp3/wav etc.) via IPC and loaded directly into the player.
- Footer player shows track name, supports play/pause, displays current time vs. duration, updates the progress bar, and allows seeking.

## Phase 2 – Song Library

### Storage model

- Base directory: `app.getPath('userData')/KHelperLive/songs/`.
- Each song: `<userData>/KHelperLive/songs/<song_id>/` containing `Original.<ext>` and `meta.json`:
  ```json
  {
    "id": "1732040000000",
    "title": "Song Title",
    "artist": "Artist Name",
    "type": "原唱",
    "audio_status": "ready",
    "lyrics_status": "none",
    "source": { "kind": "file", "originalPath": "C:/path/to/file.mp3" },
    "stored_filename": "Original.mp3",
    "created_at": "2025-11-19T12:34:56.000Z",
    "updated_at": "2025-11-19T12:34:56.000Z"
  }
  ```

### UI updates

- `歌曲庫` view has an **新增歌曲** dialog: file picker (mp3/wav via Electron), type selector (原唱/伴奏), required title + optional artist.
- Library table columns: song title / artist / 類型 / 音檔狀態 / 歌詞狀態.
- Clicking a row resolves the stored file path, loads it into `AudioEngine`, and updates the footer. Playback controls continue to work as before.
- On restart, `meta.json` files reload and the list persists.

### Debug logging

- Song add: logs source path + song id + destination folder.
- Library load: logs how many songs were found.
- Song select: logs song id + resolved path passed to the player.

### How to use Phase 2

1. Run `npm run dev`.
2. Open **歌曲庫** and click **新增歌曲**.
3. Pick an mp3/wav, choose 類型, fill in 標題 (and optionally 作者), then save.
4. The new song appears in the table; click its row to load it. Use the footer Play/Pause and seek bar to control playback.
5. Stored files live under `<userData>/KHelperLive/songs/<id>/Original.ext` with the matching `meta.json`.

## Phase 3 – Dual Output & Volumes

- Dual output routing: the AudioEngine now mirrors playback to both logical roles (觀眾輸出/stream and 耳機輸出/monitor).
- Device selection: open the top-bar 設定 button to pick the 觀眾輸出裝置 and 耳機輸出裝置 (includes a 系統預設 option). Choices are remembered and re-applied on startup.
- Per-output volume: footer sliders now drive 伴奏音量 → stream and 人聲音量 → headphone output gains.
- Debug logging covers device enumeration, device selection, and per-output volume changes to verify routing.
- Both outputs currently play the same audio. Multi-device routing relies on `setSinkId`; if unsupported, playback falls back to the default device without crashing.
