# SSET 業務會議 AI 筆記本

手機可用的本機 PWA 會議筆記 App，支援業務會議的手寫、錄音、即時逐字稿、名片、與會人、待辦追蹤、會後追蹤信與列印記錄。

## 使用方式

```powershell
node .\server.js
```

開啟：

```text
http://127.0.0.1:8000/?v=v1
```

在手機瀏覽器開啟同一網址後，可使用瀏覽器的「加入主畫面」安裝成 App。

## 版本規則

目前手機安裝版為 `v1`。日後每次更新請用 `v+n` 表示，例如下一版為 `v2`、再下一版為 `v3`。

更新版本時需同步調整：

- `index.html` 的 manifest、CSS、JS 查詢版本與畫面上的版本標籤
- `install.html` 的 manifest、CSS、QR 安裝網址與畫面上的版本標籤
- `manifest.webmanifest` 的 `start_url`
- `sw.js` 的 `APP_VERSION`

## 目前能力

- 手機版頂部 App Bar 與底部快速導航
- PWA manifest 與 service worker，可加入手機主畫面
- `install.html` 提供手機 QR Code 安裝/開啟頁
- 觸控筆、滑鼠或觸控板手寫草稿
- 瀏覽器錄音，支援時會啟用 Web Speech API 即時轉文字
- 錄音可切換為背景模式，保留浮動控制列
- 停止錄音時自動下載音檔，檔名使用「客戶名稱_拜訪議題_時間」
- 關閉 App / 分頁時會嘗試自動停止與保存錄音；瀏覽器可能要求確認，建議重要會議先按「停止」
- AI 作戰板顯示決策狀態、下次聯繫與待追蹤數量
- 名片圖片保存與名片文字解析
- 與會人、待辦、追蹤信與列印內容管理
- `/api/sync` 可做本機、區網或雲端同步 API
- JSON 匯出與匯入備份

## 手機 QR 與同步

本機啟動後開啟：

```text
http://127.0.0.1:8000/install.html
```

同 Wi-Fi 手機要掃的是頁面中的區網網址，例如：

```text
http://192.168.x.x:8000/
```

注意：真正 PWA 安裝通常需要 HTTPS。區網網址適合測試與內部使用；正式部署建議放到支援 HTTPS 的雲端主機，並設定 `SYNC_TOKEN`。

```powershell
$env:SYNC_TOKEN="your-secret"
node .\server.js
```
