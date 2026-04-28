# 白芙妮 K 歌小幫手 V3 (KHelper)

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/msfmsf777/karaoke-helper-v3)](https://github.com/msfmsf777/karaoke-helper-v3/releases)
[![GitHub all releases](https://img.shields.io/github/downloads/msfmsf777/karaoke-helper-v3/total)](https://github.com/msfmsf777/karaoke-helper-v3/releases)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
[![GitHub license](https://img.shields.io/github/license/msfmsf777/karaoke-helper-v3)](https://github.com/msfmsf777/karaoke-helper-v3/blob/main/LICENSE)

**KHelper V3** 是一款專為 **VTuber** 與 **實況主** 打造的 K 歌直播輔助工具。  
整合歌曲管理、YouTube 線上播放、AI 人聲分離、日文歌詞輔助與直播場景整合，讓你的歌回直播更穩、更順、更專業。

> 🧪 **Public Pre-release / Beta 公開測試中** 
> 歡迎自由下載試用與回報問題，協助我們把 KHelper V3 變得更好！

> ⚠️ 目前僅支援 **Windows (64-bit)**，其他平台暫不支援。

【[直接下載連結](https://github.com/msfmsf777/karaoke-helper-v3/releases/download/v3.2.0-beta/KHelperV3.Setup.3.2.0-beta.exe)】


----------

## ✨ V3 核心功能 (Features)

### 🎵 全方位歌曲管理

-  **本地歌曲匯入**：支援批量匯入 MP3, WAV 等多種音訊檔案。

-  **YouTube 線上播放與搜尋**：可直接在 APP 內搜尋並播放 YouTube 結果，也可將線上歌曲加入佇列、最愛、最近播放與自訂歌單。

-  **YouTube 下載**：內建下載管理器，可下載為原曲、伴奏或自訂歌曲資料並自動匯入。**請自行確認您擁有從 YouTube 下載所選歌曲的使用權限， 本工具不負擔任何法律責任。**

-  **縮圖顯示**：下載自 YouTube 的歌曲會在歌曲列表、底部播放器與迷你播放器中顯示縮圖。

-  **歌曲分類**：支援「原曲」與「伴奏」分類，原曲可以進行人聲分離，請注意添加歌曲後分類不能修改。

-  **播放清單**：支援「我的最愛」、「歷史記錄」與自訂播放清單，輕鬆管理歌單。

-  **列表搜尋 / 篩選 / 排序**：歌曲庫、我的最愛、最近播放與自訂歌單皆支援快速搜尋、篩選與排序。

### 🤖 AI 音訊處理 (Powered by UVR)

-  **人聲分離**：內建 AI 模型，可將原曲自動分離為「人聲」與「伴奏」軌道。

-  **獨立音控**：直播時可獨立調整伴奏與人聲的音量，實現即時導唱/消音功能。

-  **雙輸出路由**：支援將音樂分別輸出至「直播串流 (Stream)」與「監聽耳機 (Monitor)」，觀眾只能聽到伴奏，而主播則可以聽到伴奏 + 人聲導唱。

### 📝 強大的歌詞系統

-  **歌詞編輯器**：內建視覺化歌詞編輯與對齊工具。

-  **歌詞搜尋**：內建歌詞搜尋功能，可快速從網路搜尋歌詞。

-  **敲擊對齊 (Tap Sync)**：直覺的敲擊模式，輕鬆製作精準的 LRC 動態滾動歌詞。

-  **日文輔助**：自動為日文歌詞標註平假名 (Furigana) 與羅馬拼音 (Romaji)。

-  **OBS 同步顯示**：實況模式中的日文輔助顯示狀態可同步至 OBS / Browser Source 歌詞畫面。

### 📺 專為直播設計

-  **直播界面 (Stream View)**：簡潔的直播專屬界面，隱藏不必要的控制項，專注於演唱。

-  **迷你播放器 (Mini Player)**：懸浮的小型控制台，方便在直播時快速控制歌曲播放而無需占用大量空間。

-  **快速播放佇列**：迷你播放器可查看播放佇列並快速切換歌曲。

-  **觀衆體驗++**：提供透明背景瀏覽器來源 (Browser Source) 連結，輕鬆將動態歌詞、歌曲資訊美觀地整合至 OBS 直播畫面。

-  **高度客製化字幕**：字幕大小、顏色、邊框皆可即時調整。

-  **快捷鍵支援**：可自訂本機快捷鍵與全域快捷鍵，快速控制播放與常用功能。

----------

## 📥 下載與安裝 (Downloads & Install)

### 一般使用者

1.  前往 GitHub Releases或使用【[最新版本 (V3.2.0-beta) 下載連結](https://github.com/msfmsf777/karaoke-helper-v3/releases/download/v3.2.0-beta/KHelperV3.Setup.3.2.0-beta.exe)】：  
    👉 `https://github.com/msfmsf777/karaoke-helper-v3/releases`
    
2.  找到想要的版本。
    
3.  下載 Windows 安裝檔，例如：  
    `KHelperV3.Setup.3.2.0-beta.exe`
    
4.  執行安裝程式並依照步驟完成安裝。**若遇到 Windows SmartScreen（未簽章），點「更多資訊 → 仍要執行」**。
    
5.  安裝完成後，可以從桌面捷徑或開始選單啟動 **KHelper V3**。
    

----------

## 🚀 快速上手 (Quick Start for Streamers)

這一段是給「只想快點開台唱歌」的你。

### 1️⃣ 基本使用流程

1.  **匯入歌曲**
    
    -   從本地電腦匯入音樂檔 (MP3 / WAV…)
        
    -   或直接搜尋 **YouTube 線上結果** 進行播放、加入歌單，或下載後加入歌庫。
        
    -   若已經有 YouTube 連結，也可以在新增歌曲精靈中貼上連結，讓 KHelper 自動下載音訊並加入歌庫。
    - 注：測試版本所有檔案只會存放在系統硬碟Appdata裏。由於分離以及下載品質都為直播打造（偏高），可能會占用大量儲存空間。當前不支持調整儲存位置，後續版本可能會調整（一首~3分鐘歌曲原檔 + 分離音檔總計約~30MB空間）。
        
2.  **AI 人聲分離 (可選)**
    
    -   選擇歌曲後，點選「分離」：
        
        -   快速 / 標準 / 高品質 三種模式（可在設定中調整，也可以右鍵歌曲選擇分離品質）。
        -   分離速度（實際根據CPU效能而定，由於兼容性目前沒有GPU選項，以下是在i5-12400F CPU環境下**分離1分鐘歌曲**的估計值）：
            -   快速：約50秒
            -   標準：約1分鐘
            -   高品質：約6分鐘
            
    -   完成後播放將自動使用分離音檔，若分離時正在播放原曲，完成後請重新載入歌曲。
        
3.  **設定輸出裝置**
    
    -   在 **設定 (Settings)** 中：
        
        -   **串流輸出 (Stream Output)**：給 OBS / 觀眾聽的聲音，僅輸出伴奏。
            
        -   **監聽輸出 (Monitor Output)**：給你自己耳機 / 音訊介面聽的聲音，輸出人聲和伴奏。
    
    -   **雙輸出同步偏移**：若選擇雙輸出，可以調整同步偏移，以確保觀眾聽到的伴奏與你聽到的伴奏同步。具體指南請見APP内说明。
            

👉 **如果你不需要「雙輸出」：**

-   只想「我聽到什麼，觀眾就聽到什麼」：  
    直接把 **串流輸出 (Stream Output)** 關閉，就可以正常直播，不需要額外虛擬音訊線。
- 注：不想要人聲可以將其靜音。
    

👉 **如果你有支援多輸出的音訊介面：**

-   你可以：
    
    -   串流輸出 (Stream Output)：選擇介面的「Streaming / Loopback」輸出。
        
    -   監聽輸出 (Monitor Output)：選擇介面的「Headphone / Monitor」輸出。
        
-   讓觀眾聽到混好的聲音，同時你耳機有獨立監聽。
    

👉 **如果你只有內建聲卡 & 想要乾淨導唱：**

-   可以選擇使用 VB-CABLE 之類的虛擬音訊線作為「只給 OBS 的輸出」，避免觀衆聽到人聲導唱。    

----------

## 🎧 (選用) VB-CABLE 虛擬音訊線快速教學（ OBS 用，其他串流軟體僅供參考）

> 只適用於：**沒有音訊介面/不支援多輸出**、但想讓「KHelperV3 的導唱聲音僅獨立輸出給自己耳機/喇叭」的使用者。  
> 如果你已經用同一裝置就能滿足需求，可以略過這一段。

### 步驟 1：安裝 VB-CABLE

1.  前往 VB-Audio 官方網站：  
    👉 [https://vb-audio.com/Cable/](https://vb-audio.com/Cable/)
    
2.  下載 **VB-CABLE Driver (Windows 版)** 並解壓縮。
    
3.  以系統管理員身分執行安裝程式，安裝完成後 **重新開機**。
    

【檢驗】重新開機後，在 **Windows 音效設定 / 聲音控制台** 應該會看到：

-   播放裝置：`CABLE Input (VB-Audio Virtual Cable)`
    
-   錄製裝置：`CABLE Output (VB-Audio Virtual Cable)`
    

### 步驟 2：KHelperV3 音訊設定

在 KHelperV3 設定中：

-   **Stream Output**：選擇 `CABLE Input (VB-Audio Virtual Cable)`  
    → 做為「給 OBS / 觀眾聽」的專用輸出。
    
-   **Monitor Output**：選擇你的實體耳機或喇叭裝置。
    

### 步驟 3：OBS 收音設定

1.  在 OBS 的 **來源 (Sources)** 中新增：
    
    -   `Audio Input Capture`（音訊輸入擷取）
        
    -   裝置選擇：`CABLE Output (VB-Audio Virtual Cable)`
        
2.  使用 APP 播放音樂，確認 OBS 中有音量跳動，即代表 OBS 正在接收 KHelperV3 的聲音。


### 步驟 4：輸出同步偏移調整

1.  在 OBS 中的音效混音器中點下方齒輪按鈕 (進階音訊屬性)，將剛剛新增的 `Audio Input Capture` 來源的音訊檢測設定爲「監測和輸出」。

2.  在 KHelperV3 設定中開始「輸出同步偏移」調整，並根據界面提示進行調整。完成後儲存。**推薦每次直播前再次確認同步偏移**。

----------

## 📌 狀態與授權 (Status & License)

-   本專案目前為 **公開測試 (Public Beta / Pre-release)**。
    
-   二進位安裝檔可供公開試用；原始碼授權與使用條款以 repo 內 LICENSE / NOTICE 為準。
    
-   如需回報問題或提供建議，歡迎使用：
    -   [Discord 群組專用論壇](https://discord.gg/96zfTcBgZG)【中文使用者推薦】
    -   [GitHub Issues](https://github.com/msfmsf777/karaoke-helper-v3/issues/new)

感謝你願意幫忙測試 KHelper V3，  
希望它能讓你的歌回直播變得更輕鬆、更好玩 🎤✨

----------

## 🛠️ 技術棧 (Tech Stack)

-   **Frontend**
    -   **Electron** (Cross-platform desktop application framework)
    -   **React** (UI Library) + **TypeScript**
    -   **Vite** (Build tool)
    -   **Electron Builder** (Windows NSIS packaging)
    -   **React Virtuoso** (Virtualized song lists)
        
-   **Backend / Runtime**
    -   **Node.js** (Electron Main Process)
    -   **Python 3.10** (AI & Audio Processing Runtime)
        
-   **Audio / AI Core**
    -   **UVR (Ultimate Vocal Remover)** / **MDX-Net** / **Demucs** (Vocal Separation)
    -   **youtubei.js** (YouTube online search / streaming metadata)
    -   **yt-dlp** (Media Downloader)
    -   **FFmpeg** (Audio Conversion & Processing)
        
-   **Natural Language Processing**
    -   **Mecab** / **Cutlet** / **Kakasi** (Japanese Tokenization & Romaji Conversion)

----------

## ❤️ 致謝 (Acknowledgements)

KHelper V3 的誕生離不開這些強大開源專案與社群的貢獻：

*   **[Ultimate Vocal Remover](https://github.com/Anjok07/ultimatevocalremovergui)** & **[audio-separator](https://github.com/karaokenerds/python-audio-separator)**:  
    提供世界頂尖的 AI 人聲分離核心與模型參考。
*   **[yt-dlp](https://github.com/yt-dlp/yt-dlp)**:  
    強大且持續更新的媒體下載工具。
*   **[youtubei.js](https://github.com/LuanRT/YouTube.js)**:  
    提供 YouTube InnerTube API 的線上搜尋與播放資料支援。
*   **[LRCLIB](https://lrclib.net/)**:  
    提供線上歌詞搜尋與 LRC 歌詞匯入來源。
*   **[FFmpeg](https://ffmpeg.org/)**:  
    音訊處理的瑞士軍刀。
*   **[Electron](https://www.electronjs.org/)** & **[React](https://reactjs.org/)** & **[Vite](https://vitejs.dev/)**:  
    現代且高效的應用程式開發框架。
*   **[Cutlet](https://github.com/polm/cutlet)** & **[Mecab](https://taku910.github.io/mecab/)**:  
    精準的日文分詞與拼音轉換支援。
*   以及所有參與測試、提供建議與使用的 VTuber 與實況主們！

----------

## 👩‍💻 簡要開發資訊 (For Developers – Minimal)

> 一般使用者不需要這段，只要安裝套件即可使用。  
> 以下是給想要自行編譯 / 修改程式的開發者。

### 開發環境需求

-   Windows 10 / 11 (64-bit)
    
-   Node.js ≥ 18
    
-   Python 3.10（用於 AI 模型的私有 runtime）
    
-   Git
    

### 基本指令

```bash
# 下載專案
git clone https://github.com/msfmsf777/karaoke-helper-v3.git
cd karaoke-helper-v3

# 安裝前端 / Electron 依賴
npm install

# 啟動開發模式 (Electron + Vite)
npm run dev

# 建置 Windows 安裝檔
npm run build

# 產物位於 release/<version>/ 目錄
 
```

> 私有 Python runtime 的具體建置流程請參考 repo 內的說明文件`docs/python-runtime-setup.md` 。
