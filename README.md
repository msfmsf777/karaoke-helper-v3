# KHelperLive (Phase 3)

## Phase 5 - Manual Lyric Editor & LRC Export

- 歌詞檔案：每首歌資料夾 (`<userData>/KHelperLive/songs/<id>/`) 內會儲存 `lyrics_raw.txt`（純文字）與 `lyrics_synced.lrc`（對齊後的 LRC）。
- 歌曲庫：新增「歌詞狀態」欄，操作欄提供「歌詞對齊」可直接切換到編輯器並選中該曲。
- 歌詞編輯視圖：
  - 左側列表選歌，顯示歌詞狀態；右側為編輯 + 對齊區。
  - 可貼上/編輯多行歌詞文字並按「儲存歌詞文字」寫入 `lyrics_raw.txt`（狀態變為純文字）。
  - 點「開始重新對齊」重置時間標記並跳回 0 秒，播放原始音訊；按「敲擊對齊 (Space)」逐行寫入時間戳（tapIndex 會往下走），播放時會自動醒目目前行並自動捲動。
  - 可用「稍早 / 稍晚」微調每行時間（每次 50ms），速度滑桿可在 0.5x~1.25x 之間調整對齊難度。
  - 按「儲存同步歌詞 (LRC)」會輸出 `[mm:ss.xx]Lyric text` 行格式（含可選 [ti]/[ar] 標籤），寫入 `lyrics_synced.lrc` 並將歌詞狀態設為已對齊。
- 除錯：載入/儲存歌詞檔、敲擊事件、微調與 LRC 匯出都會在主控台留下 debug 訊息，方便追蹤流程。
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
- Views: `???` (Library), `????` (Lyric Editor placeholder), `????` (Stream Mode placeholder).
- Dark theme inspired by modern music apps.

## Phase 1 - Audio Playback

- `AudioEngine` abstraction wraps an HTML5 `<audio>` element; React components only talk to this interface.
- Temporary "add song" button opened the OS file picker (mp3/wav etc.) via IPC and loaded directly into the player.
- Footer player shows track name, supports play/pause, displays current time vs. duration, updates the progress bar, and allows seeking.

## Phase 2 - Song Library

### Storage model

- Base directory: `app.getPath('userData')/KHelperLive/songs/`.
- Each song: `<userData>/KHelperLive/songs/<song_id>/` containing `Original.<ext>` and `meta.json`:
  ```json
  {
    "id": "1732040000000",
    "title": "Song Title",
    "artist": "Artist Name",
    "type": "原曲",
    "audio_status": "original_only",
    "lyrics_status": "none",
    "source": { "kind": "file", "originalPath": "C:/path/to/file.mp3" },
    "stored_filename": "Original.mp3",
    "instrumental_path": "C:/Path/To/Instrumental.mp3",
    "vocal_path": "C:/Path/To/Vocals.mp3",
    "last_separation_error": null,
    "created_at": "2025-11-19T12:34:56.000Z",
    "updated_at": "2025-11-19T12:34:56.000Z"
  }
  ```

### UI updates

- `???` view has an **????** dialog: file picker (mp3/wav via Electron), type selector (??/??), required title + optional artist.
- Library table columns: song title / artist / ?? / ???? / ????.
- Clicking a row resolves the stored file path, loads it into `AudioEngine`, and updates the footer. Playback controls continue to work as before.
- On restart, `meta.json` files reload and the list persists.

### Debug logging

- Song add: logs source path + song id + destination folder.
- Library load: logs how many songs were found.
- Song select: logs song id + resolved path passed to the player.

### How to use Phase 2

1. Run `npm run dev`.
2. Open **???** and click **????**.
3. Pick an mp3/wav, choose ??, fill in ?? (and optionally ??), then save.
4. The new song appears in the table; click its row to load it. Use the footer Play/Pause and seek bar to control playback.
5. Stored files live under `<userData>/KHelperLive/songs/<id>/Original.ext` with the matching `meta.json`.

## Phase 3 - Dual Output & Volumes

- Dual output routing: the AudioEngine now mirrors playback to both logical roles (????/stream and ????/monitor).
- Device selection: open the top-bar ?? button to pick the ?????? and ?????? (includes a ???? option). Choices are remembered and re-applied on startup.
- Per-output volume: footer sliders now drive ???? ? stream and ???? ? headphone output gains.
- Debug logging covers device enumeration, device selection, and per-output volume changes to verify routing.
- Both outputs currently play the same audio. Multi-device routing relies on `setSinkId`; if unsupported, playback falls back to the default device without crashing.

## Phase 4 - Separation Jobs & Processing List

- Separation jobs: queuing system runs one 原曲 separation at a time; new requests are added to an in-memory queue.
- Stub separation: copies `Original.ext` to `Instrumental.ext` and `Vocals.ext` in the song folder (same extension), ready to be replaced by a real Demucs/demucs.cpp pipeline later.
- `audio_status` mapping shown in the UI: `original_only` → 未分離, `separation_pending` → 已排程, `separating` → 處理中, `separation_failed` → 失敗, `separated` → 已完成.
- How to trigger: in **歌曲庫**, 原曲 rows with 未分離或失敗 show 「開始分離 / 重新分離」; clicking queues a job and updates the status.
- How to monitor: click **處理中任務** on the top bar to open the processing list (song name, status, created/updated time, and error tooltip on failure).
- Metadata persistence: `meta.json` now stores separation results (`instrumental_path`, `vocal_path`, `last_separation_error`) so statuses survive restarts; successful separation updates the paths and sets `audio_status` to `separated`.
- Logging: job creation/start/finish/failure, stub separation input/output paths, and meta updates are logged in the main process console for debugging.



