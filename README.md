# KHelperLive (Phase 2)

KHelperLive is a desktop application designed for VTubers and streamers who sing live. It aims to provide a comprehensive song library management system, manual lyric editing tools, and a dedicated live performance mode with OBS-compatible lyric overlays.

## Tech Stack

* **Electron**: For cross-platform desktop capabilities.
* **React**: For a rich and responsive user interface.
* **TypeScript**: For type safety and maintainability.
* **Vite**: For fast development and building.

## Getting Started

### Prerequisites
* Node.js (v16 or higher recommended)
* npm (or pnpm/yarn)

### Installation

1. Clone the repository (or open the folder).
2. Install dependencies:
    ```bash
    npm install
    ```

### Running in Development Mode

To start the app in development mode with hot reloading:

```bash
npm run dev
```

This will launch the Electron window.

## Project Structure

* `electron/`: Main and preload process code.
* `src/`: Renderer process (React) code.
    * `components/`: UI components (Sidebar, PlayerBar, Views).
    * `App.tsx`: Main application layout.
    * `index.css`: Global styles.
* `shared/`: Shared types between main and renderer (e.g., song metadata).

## Phase 0 Features

* **Basic Layout**: Sidebar navigation, main content area, and persistent player bar.
* **Views**:
    * **歌曲庫 (Library)**: Song list surface.
    * **歌詞編輯 (Lyric Editor)**: Placeholder for lyric editing tools.
    * **直播模式 (Stream Mode)**: Placeholder for the live performance view.
* **UI**: Dark theme inspired by modern music apps.

## Phase 1 – Audio Playback

* Added a simple `AudioEngine` abstraction that wraps an HTML5 `<audio>` element in the renderer. React components talk only to this interface so a later native/Node backend can swap in without touching the UI.
* The **歌曲庫** view previously had a temporary「選擇檔案」button that opened the OS file picker (mp3/wav and common audio formats) via Electron IPC and immediately loaded the chosen file into the engine.
* The footer player shows the selected track name, supports play/pause, displays current time vs. duration, updates the progress bar, and allows seeking. Volume sliders remain UI-only placeholders.

## Phase 2 – Song Library (new)

### Storage model

* Base directory: `app.getPath('userData')/KHelperLive/songs/`.
* Each song gets its own folder: `<userData>/KHelperLive/songs/<song_id>/`.
* Files inside each folder:
  * `Original.<ext>` – a copy of the imported audio file.
  * `meta.json` – metadata with the following shape:
    ```json
    {
      "id": "1732040000000",
      "title": "Song Title",
      "artist": "Artist Name",
      "type": "伴奏",
      "audio_status": "ready",
      "lyrics_status": "none",
      "source": { "kind": "file", "originalPath": "C:\\\\path\\\\to\\\\file.mp3" },
      "stored_filename": "Original.mp3",
      "created_at": "2025-11-19T12:34:56.000Z",
      "updated_at": "2025-11-19T12:34:56.000Z"
    }
    ```

### What’s new in the UI

* In **歌曲庫**, a button「＋ 新增歌曲」opens an add dialog with:
  * File picker (mp3/wav, via Electron dialog).
  * Type selector (伴奏/原曲, default 伴奏).
  * Title (required) and Artist (optional).
* On confirm, the file is copied into the per-song folder, `meta.json` is written, and the list refreshes.
* The library view now shows a table with columns: 歌曲名稱 / 歌手 / 類型 / 音訊狀態 / 歌詞狀態.
* Clicking a row resolves the stored file path, loads it into `AudioEngine`, and updates the footer with the song title/artist. Playback controls continue to work as before.
* On app restart, `meta.json` files are reloaded and the list persists.

### Debug logging

* Song added: logs source path + song id + destination folder.
* Library load: logs how many songs were found.
* Song select: logs song id + resolved path passed to the player.

### How to use Phase 2

1. Run `npm run dev` to start the app.
2. Open **歌曲庫** and click **＋ 新增歌曲**.
3. Pick a local mp3/wav, choose 類型, fill in 歌曲名稱 (and optionally 歌手), 然後點擊「確認新增」.
4. The new song appears in the table; click its row to load it. Use the footer Play/Pause and seek bar to control playback.
5. Stored files live under `<userData>/KHelperLive/songs/<id>/Original.ext` with the matching `meta.json`. Reopen the app to see the same library.
