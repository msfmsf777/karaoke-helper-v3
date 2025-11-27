# KHelperLive (K歌小幫手 V3)

![Version](https://img.shields.io/badge/version-3.0.0--beta-blue) ![Electron](https://img.shields.io/badge/Electron-30.0.0-47848F) ![React](https://img.shields.io/badge/React-18.2.0-61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6)

**KHelper V3** 是一款專為 VTuber 與實況主量身打造的全能 K 歌直播輔助工具。結合了強大的歌曲管理、AI 人聲分離、動態歌詞顯示與 OBS 直播整合功能，讓您的歌回直播更加專業、流暢。

---

## ✨ V3 核心功能 (Features)

### 🎵 全方位歌曲管理
- **本地歌曲匯入**：支援 MP3, WAV, FLAC, OGG, M4A 等多種音訊格式。
- **YouTube 下載**：內建下載管理器，可直接貼上 YouTube 連結下載歌曲並自動匯入。
- **智慧分類**：支援「原曲」、「伴奏」、「阿卡貝拉」等多種歌曲類型標記。
- **播放清單**：支援「我的最愛」、「歷史記錄」與自訂播放清單，輕鬆管理歌單。

### 🤖 AI 音訊處理 (Powered by UVR)
- **人聲分離**：內建 AI 模型，可將原曲自動分離為「人聲」與「伴奏」軌道。
- **獨立音控**：直播時可獨立調整伴奏與人聲的音量，實現即時導唱/消音功能。
- **雙輸出路由**：支援將音樂分別輸出至「直播串流 (Stream)」與「監聽耳機 (Monitor)」，確保觀眾聽到最佳混音效果。

### 📝 強大的歌詞系統
- **歌詞編輯器**：內建視覺化歌詞編輯與對齊工具。
- **敲擊對齊 (Tap Sync)**：直覺的敲擊模式，輕鬆製作精準的 LRC 動態歌詞。
- **日文輔助**：自動為日文歌詞標註平假名 (Furigana) 與羅馬拼音 (Romaji)，唱日文歌不再卡詞。

### 📺 專為直播設計
- **串流模式 (Stream Mode)**：簡潔的專屬介面，隱藏不必要的控制項，專注於演唱。
- **OBS Overlay**：提供瀏覽器來源 (Browser Source) 連結，輕鬆將動態歌詞、歌曲資訊美觀地整合至 OBS 直播畫面。
- **高度客製化**：Overlay 樣式、字體、顏色、動畫皆可即時調整。

---

## 🚀 快速開始 (Getting Started)

### 環境需求
- **Node.js**: v18 或更高版本
- **Python**: v3.10 (用於 AI 運算模組)

### 安裝依賴
```bash
npm install
```

### 開發模式 (Development)
啟動 Electron 開發伺服器 (支援 Hot Reload)：
```bash
npm run dev
```

### 建置發布 (Build)
打包應用程式 (Windows)：
```bash
npm run build
```
建置完成的安裝檔將位於 `dist/` 目錄下。

---

## 🛠️ 技術棧 (Tech Stack)

- **Frontend**: React, Vite, TypeScript, TailwindCSS (Styled Components)
- **Backend**: Electron (Main Process)
- **AI/NLP**: Python (Demucs for separation, Fugashi for Japanese tokenization)
- **Data**: JSON-based local storage

---

## 📂 專案結構

```
KHelperLive/
├── electron/          # Electron 主進程與 Preload 腳本
├── resources/         # 外部資源 (Python 腳本、預設圖示等)
├── src/
│   ├── assets/        # 靜態資源 (圖片、SVG)
│   ├── components/    # React UI 元件
│   ├── contexts/      # React Context (狀態管理)
│   ├── library/       # 歌曲庫邏輯
│   ├── styles/        # CSS 樣式檔
│   ├── App.tsx        # 應用程式入口
│   └── main.tsx
└── ...
```

---

## 📝 License

本專案目前為 **Private Beta** 階段。
Copyright © 2025 KHelperLive Team. All rights reserved.
