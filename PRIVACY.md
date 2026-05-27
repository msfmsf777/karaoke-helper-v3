# KHelper Privacy Notice / KHelper 隱私權聲明

Last updated: 2026-05-26  
Notice version: 1

## 繁體中文

### 維護者與聯絡方式

KHelper 由 `msfmsf777` 維護。如有隱私疑問、Bug 或功能建議，請透過 [Discord 群組論壇](https://discord.gg/96zfTcBgZG) 或 [GitHub Issues](https://github.com/msfmsf777/karaoke-helper-v3/issues) 聯絡。

### 選用的產品改善統計

KHelper 會在應用程式內詢問您是否允許傳送隱私保護使用統計。這是自願選項；選擇「不允許」不會影響任何功能。除非您主動選擇「允許」，否則 KHelper 不會傳送產品分析事件。

若您允許，KHelper 使用 [TelemetryDeck](https://telemetrydeck.com/privacy/) 作為分析服務提供者，目的僅為瞭解功能採用狀況與可靠性問題，以改善公開測試版本。

### 允許後可能傳送的資料

- 隨機產生的安裝識別碼。識別碼只會在您允許後建立，停用統計時會從本機刪除。
- 事件類別，例如啟動應用程式、進入實況模式、使用線上搜尋或歌詞工具、完成下載或分離、複製 OBS 疊圖連結、更新結果與設定復原結果。
- 固定分類屬性：KHelper 版本、發行頻道、介面語言、Windows 版本類別、操作結果、品質預設、時間區間與整理後的失敗類別。
- TelemetryDeck SDK 依其文件處理的匿名化識別碼、四捨五入至小時的事件時間，以及基本技術裝置或 SDK 中繼資料。

TelemetryDeck 表示其 SDK 會在裝置端匿名化識別碼，且不會在伺服器儲存 IP 位址。詳情請見 [TelemetryDeck Privacy FAQ](https://telemetrydeck.com/docs/guides/privacy-faq/) 與 [Anonymization documentation](https://telemetrydeck.com/docs/articles/anonymization-how-it-works/)。

### 絕不作為產品分析傳送的資料

- 歌名、歌手名稱、YouTube ID、網址、縮圖或線上搜尋文字。
- 本機檔名、路徑、歌詞、LRC 文字或時間、日文輔助輸出。
- 我的最愛、播放歷史、佇列內容或歌單名稱。
- 自訂 OBS 範本名稱、文字、顏色、ID 或複製的 OBS 網址。
- 音訊裝置 ID 或名稱、同步偏移、音量與快捷鍵設定。
- 原始錯誤、堆疊追蹤、主控台日誌、螢幕畫面、工作階段重播或剪貼簿內容。

### 控制與撤回

您可隨時在 `設定 > 隱私與產品改善` 中啟用或停用統計。停用後，KHelper 會立即停止傳送、清除尚未送出的記憶體事件，並刪除本機隨機識別碼。之後再次允許時會產生新的識別碼。

若日後提供者、用途或收集類別有重大變更，KHelper 會提高聲明版本並重新要求選擇；在您重新允許前不會傳送統計。

### 保存期間

正式啟用分析前，維護者會在 TelemetryDeck 設定保存政策並於此文件公布實際期限。在保存期限尚未公開並完成測試資料檢查前，正式建置不應設定 TelemetryDeck 應用程式 ID。

### 其他網路服務

下列既有功能並非上述選用產品分析，但在您使用相關功能時可能連線至第三方服務：

- GitHub Releases：檢查及下載應用程式更新。
- YouTube 相關功能與 `yt-dlp`：搜尋、串流或下載您選擇的線上歌曲。
- LRCLIB：搜尋及匯入歌詞。
- UVR 模型下載來源：首次使用所選人聲分離模型時下載模型檔。

## English

### Maintainer And Contact

KHelper is maintained by `msfmsf777`. For privacy questions, bugs, or feature requests, contact the maintainer through the [Discord forum](https://discord.gg/96zfTcBgZG) or [GitHub Issues](https://github.com/msfmsf777/karaoke-helper-v3/issues).

### Optional Product Improvement Statistics

KHelper asks inside the app whether you allow privacy-preserving usage statistics. This is voluntary; choosing `Do not allow` does not affect any feature. KHelper sends no product analytics event unless you affirmatively select `Allow`.

If allowed, KHelper uses [TelemetryDeck](https://telemetrydeck.com/privacy/) as its analytics provider solely to understand feature adoption and reliability issues during public beta development.

### Data That May Be Sent After You Allow

- A randomly generated installation identifier, created only after permission and deleted locally when statistics are disabled.
- Event categories such as app launch, Stream Mode entry, online search or lyrics-tool use, completed downloads or separation, copied OBS overlay links, update results, and settings recovery results.
- Fixed-category properties: KHelper version, release channel, interface language, Windows version category, operation result, quality preset, duration bucket, and sanitized failure category.
- Metadata processed by the TelemetryDeck SDK according to its documentation, including an anonymized identifier, an event timestamp rounded to the nearest hour, and basic technical device or SDK metadata.

TelemetryDeck states that its SDK anonymizes identifiers on device and that IP addresses are not stored on its servers. See the [TelemetryDeck Privacy FAQ](https://telemetrydeck.com/docs/guides/privacy-faq/) and [Anonymization documentation](https://telemetrydeck.com/docs/articles/anonymization-how-it-works/).

### Data Never Sent As Product Analytics

- Song titles, artist names, YouTube IDs, URLs, thumbnails, or online search text.
- Local filenames or paths, lyrics, LRC text or timings, or Japanese-assist output.
- Favorites, playback history, queue contents, or playlist names.
- Custom OBS template names, text, colors, IDs, or copied OBS URLs.
- Audio device IDs or names, sync offsets, volume values, or hotkey bindings.
- Raw errors, stack traces, console logs, screenshots, session replay, or clipboard contents.

### Control And Withdrawal

You can enable or disable statistics at any time in `Settings > Privacy & Improvement`. When disabled, KHelper immediately stops transmission, discards pending in-memory events, and deletes the local random identifier. Opting in later creates a new identifier.

If the provider, purpose, or categories change materially, KHelper will increment this notice version and request a new choice; no statistics are sent until you allow again.

### Retention

Before production analytics is enabled, the maintainer will configure a TelemetryDeck retention policy and publish the enforced duration in this notice. A production build should not be configured with a TelemetryDeck application ID until retention and outbound payload review are complete.

### Other Network Services

The following existing feature traffic is separate from optional product analytics and may connect to third parties when you use the relevant feature:

- GitHub Releases for application update checks and downloads.
- YouTube-related features and `yt-dlp` for searching, streaming, or downloading selected online songs.
- LRCLIB for lyrics search and import.
- UVR model download sources when a selected vocal-separation model is first needed.
