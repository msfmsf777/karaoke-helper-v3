# KHelperLive (Phase 0)

KHelperLive is a desktop application designed for VTubers and streamers who sing live. It aims to provide a comprehensive song library management system, manual lyric editing tools, and a dedicated live performance mode with OBS-compatible lyric overlays.

## Tech Stack

*   **Electron**: For cross-platform desktop capabilities.
*   **React**: For a rich and responsive user interface.
*   **TypeScript**: For type safety and maintainability.
*   **Vite**: For fast development and building.

We chose this stack because it's robust, widely supported, and allows for rapid UI development while keeping the door open for native integrations (like audio processing) in the future.

## Getting Started

### Prerequisites
*   Node.js (v16 or higher recommended)
*   npm (or pnpm/yarn)

### Installation

1.  Clone the repository (or open the folder).
2.  Install dependencies:
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

*   `electron/`: Main and preload process code.
*   `src/`: Renderer process (React) code.
    *   `components/`: UI components (Sidebar, PlayerBar, Views).
    *   `App.tsx`: Main application layout.
    *   `index.css`: Global styles.

## Phase 0 Features

*   **Basic Layout**: Sidebar navigation, main content area, and persistent player bar.
*   **Views**:
    *   **歌曲庫 (Library)**: Placeholder for song list.
    *   **歌詞編輯 (Lyric Editor)**: Placeholder for lyric editing tools.
    *   **直播模式 (Stream Mode)**: Placeholder for the live performance view.
*   **UI**: Dark theme inspired by modern music apps.
