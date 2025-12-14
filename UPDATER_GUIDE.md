# In-App Updater Testing Guide

This guide details how to build, publish, and test the in-app updater for **KHelperLive**.

## 1. Prerequisites
- **Current Version**: `3.0.0-beta` (Confirmed in `package.json`).
- **GitHub Repository**: You must have a public (or private with token) GitHub repository.
- **GitHub Token**: For private repos, users need `GH_TOKEN` env var. For public, it works out of the box for reading.
- **Configuration**:
  - Open `package.json`.
  - **CRITICAL**: Update the `build.publish` section with your actual GitHub username and repository name.
    ```json
    "publish": [
      {
        "provider": "github",
        "owner": "YOUR_GITHUB_USERNAME", // <--- UPDATE THIS
        "repo": "YOUR_REPO_NAME"        // <--- UPDATE THIS
      }
    ]
    ```

## 2. Generating the Release Build
Running the build script will compile the app and use `electron-builder` to generate the installer and update metadata.

1.  **Run Build**:
    ```powershell
    npm run build
    ```
2.  **Verify Output**:
    - Check the `release/3.0.0-beta` (or similar) folder.
    - You must see these file types:
        - `KHelperLive Setup 3.0.0-beta.exe` (The installer)
        - `latest.yml` (CRITICAL: Contains version/checksum info for the updater)
        - `latest.yml.blockmap` (Optimizes differential updates)

> **Note**: `electron-builder` might attempt to auto-publish if `GH_TOKEN` is set. If not, it will just generate files.

## 3. Creating the "New" Version (For Testing)
To test the update flow, you need a "future" version to update *to*.

1.  **Modify Version**:
    - Open `package.json`.
    - Change `"version"` to `3.0.1-beta` (or any higher number).
2.  **Re-Build**:
    - Run `npm run build` again.
3.  **Draft GitHub Release**:
    - Go to your GitHub Repository > Releases > Draft a new release.
    - **Tag version**: `v3.0.1-beta` (Must match the version in package.json, usually prefixed with 'v').
    - **Title**: `v3.0.1 Beta Update`.
    - **Description**: Add some release notes here.
        ```markdown
        # v3.0.1 Changes
        - Added cool new feature.
        - Fixed bugs.
        ```
        *These notes will appear in the App's Update Popup.*
4.  **Upload Assets**:
    - Upload the following files from your `release/3.0.1-beta` folder:
        1.  `KHelperLive Setup 3.0.1-beta.exe`
        2.  `latest.yml`
        3.  `latest.yml.blockmap` (if exists)
5.  **Publish Release**:
    - Click "Publish release".
    - *Important*: If you use "Pre-release" checkbox on GitHub, make sure your app is configured to allow prereleases (We set `allowPrerelease: true` in code, so this is supported).

## 4. Testing the Update Flow

Now, verify the flow using the **OLD** version (3.0.0-beta).

1.  **Install Old Version**:
    - Install the `3.0.0-beta` version (from your first build) or run it if you haven't installed `3.0.1` yet.
    - *Tip*: You can just run the executable from `win-unpacked` of the 3.0.0 build if you didn't create an installer, but for best results, install it.
2.  **Trigger Update**:
    - Open KHelperLive.
    - It should auto-check shortly after launch (after 3 seconds).
    - Or go to **Settings** > **Software Update** > click **檢查更新 (Check for Updates)**.
3.  **Verify UI**:
    - The top bar icon should appear (Green).
    - Clicking it should show the popup with your Release Notes ("Added cool new feature...").
4.  **Test "Ignore This Version"**:
    - Click **忽略此版本 (Ignore this version)**.
    - **Result**: The popup closes, and the top bar icon **disappears**.
    - **Verify Persistence**: Restart the app. The update icon should **NOT** appear automatically.
    - **Verify Manual Override**: Go to Settings > Click "Check for Updates". The update **SHOULD** appear again (bypassing the ignore).
5.  **Test "Download & Install"**:
    - Click **下載更新 (Download)**.
    - **Verify**:
        - Progress bar shows in popup and under the top-bar icon.
        - You can close the popup (click 'X' or 'Hide') and look at the tiny progress bar in the top bar.
    - **Completion**:
        - Use the Debug UI (if in dev) or wait for download.
        - Top bar icon gets a **Checkmark Badge**.
        - Popup changes to "Restart to Install".
6.  **Restart**:
    - Click **重新啟動並更新 (Restart and Install)**.
    - App should close, runs the installer silently (or visible depending on nsis config), and reopen with the new version.
    - Verify version in Settings/Title is now `3.0.1-beta`.

## 5. Troubleshooting
- **No Update Found?**
    - Check `latest.yml` on GitHub matches the files you uploaded.
    - Check `package.json` `publish` config matches the repo you are testing against.
- **GitHub Token Error?**
    - If your repo is private, you need to set `GH_TOKEN` environment variable on your machine.
