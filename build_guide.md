# KHelperLive Build & Distribution Guide

This guide details how to build the KHelperLive application for distribution (Windows).

## Prerequisites

Before building, ensure the following are in place:

1.  **Node.js & Dependencies**: Ensure `node_modules` are installed (`npm install`).
2.  **Python Runtime**: The standalone Python runtime must be present at:
    *   `resources/python-runtime/python.exe`
    *   This runtime should include all necessary packages (`demucs`, `fugashi`, `unidic-lite`, `pykakasi`, etc.).
3.  **Scripts**:
    *   `resources/lyrics/jp_furigana.py`
    *   `resources/separation/separate.py`

## Configuration

The build configuration is managed in `electron-builder.json5`. We have configured it to bundle the necessary extra resources:

```json5
"extraResources": [
  { "from": "resources/python-runtime", "to": "python-runtime" },
  { "from": "resources/lyrics", "to": "lyrics" },
  { "from": "resources/separation", "to": "separation" }
]
```

This ensures that the Python runtime and scripts are copied to the `resources` folder of the installed application.

## Building the Application

To create a production build, run the following command in your terminal:

```bash
npm run build
```

This command performs the following steps:
1.  **TypeScript Compilation**: Checks for type errors (`tsc`).
2.  **Vite Build**: Bundles the React renderer and Electron main process code (`vite build`).
3.  **Electron Builder**: Packages the application into an installer (`electron-builder`).

## Output

After a successful build, the installer and executable will be located in the `release` directory:

*   `release/<version>/KHelperLive-Windows-<version>-Setup.exe` (Installer)
*   `release/<version>/win-unpacked/` (Unpacked executable for testing)

## Testing the Build

1.  Go to `release/<version>/win-unpacked/`.
2.  Run `KHelperLive.exe`.
3.  Verify that:
    *   The app opens without errors.
    *   **Vocal Separation** works (this confirms the Python runtime and `separate.py` are correctly bundled).
    *   **Japanese Lyric Conversion** works (this confirms `jp_furigana.py` is correctly bundled).

## Troubleshooting

*   **Missing Python**: If features relying on Python fail, check the `resources` folder inside the installed app directory (e.g., `AppData/Local/Programs/KHelperLive/resources`). It should contain `python-runtime`, `lyrics`, and `separation` folders.
*   **Build Errors**: Check `build_log.txt` or the terminal output for details. Common issues include missing files or permission errors.
