# SpeedUp

輕量級音檔速度控制 PWA 網頁應用，支援手機、平板快速操作。無需安裝，打開瀏覽器即可使用。

## 功能特色

### 播放控制
- **速度調整**：0.25x ~ 4x，提供 9 個預設速度按鈕 + 滑桿微調
- **播放/暫停/停止**：直覺的大按鈕操作
- **進度條拖曳**：直接點擊或拖曳進度條跳轉
- **手動時間輸入**：輸入 分:秒.0.1秒 精確跳轉到指定位置
- **剩餘時間顯示**：播放時即時顯示依當前速度還需多久播完

### 標記系統
- **快速標記**：在播放中隨時新增時間點標記
- **自訂名稱**：為每個標記點命名
- **一鍵跳轉**：點擊標記時間或播放按鈕即可跳轉
- **匯出/匯入**：將標記匯出為 JSON 檔案，或從 JSON 匯入
- **刪除全部**：一鍵清除當前檔案所有標記
- **持久儲存**：標記自動保存在 localStorage，按檔案名稱分類

### 格式轉換
- **MP3 編碼**：使用 lamejs 純 JS 編碼，無需後端
- **WAV 編碼**：內建 PCM 編碼器，即時轉換
- **進度顯示**：轉換過程顯示進度百分比

### 分享支援
- **Share Target API**：安裝 PWA 後可從其他 App 分享音檔直接開啟
- **拖放支援**：將音檔拖放到網頁即可播放

### 多語言
- 繁體中文 / English 一鍵切換

### PWA 特性
- 可安裝到手機主畫面
- Service Worker 離線快取
- 響應式設計，手機、平板、桌面皆適用

## 支援格式

**輸入**：AAC、MP3、MP4、WAV、OGG、FLAC、WEBM、M4A、WMA、OPUS

**轉換輸出**：MP3、WAV

## 鍵盤快捷鍵

| 按鍵 | 功能 |
|------|------|
| `Space` | 播放 / 暫停 |
| `←` / `→` | 速度 -0.1x / +0.1x |
| `M` | 新增標記 |
| `1` ~ `9` | 跳至第 1~9 個標記 |

## 技術架構

```
SpeedUp/
├── index.html          # PWA 主頁面
├── style.css           # 響應式樣式（深色主題）
├── app.js              # 核心邏輯：播放、速度、標記
├── converter.js        # 格式轉換：Web Audio API + lamejs
├── i18n.js             # 多語言系統（zh-TW / en）
├── sw.js               # Service Worker（離線快取）
├── manifest.json       # PWA 清單（含 Share Target）
├── icons/              # PWA 圖示
│   ├── icon-192.png
│   └── icon-512.png
└── lib/
    └── lame.min.js     # MP3 編碼器（純 JS）
```

## 本地開發

```bash
# 使用任意靜態檔案伺服器
python -m http.server 8080

# 或使用 Node.js
npx serve .
```

開啟 `http://localhost:8080` 即可使用。

## 部署

本專案為純靜態檔案，可部署到任何靜態託管服務：

- GitHub Pages
- Vercel
- Netlify
- Cloudflare Pages

### GitHub Pages

```bash
git push origin main
# Settings → Pages → Source: main branch
```

## 瀏覽器相容性

- Chrome / Edge 88+
- Firefox 90+
- Safari 14+
- 行動版 Chrome / Safari

> 格式轉換功能需要瀏覽器支援 `AudioContext.decodeAudioData`。

## 授權

MIT License
