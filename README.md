# SSET 業務會議 AI 筆記本

手機可用的本機 PWA 會議筆記 App，支援業務會議的手寫、錄音、即時逐字稿、名片、與會人、待辦追蹤、會後追蹤信與列印記錄。

## 使用方式

```powershell
node .\server.js
```

開啟：

```text
http://127.0.0.1:8000/?v=v8
```

在手機瀏覽器開啟同一網址後，可使用瀏覽器的「加入主畫面」安裝成 App。

## 版本規則

目前手機安裝版為 `v8`。日後每次更新請用 `v+n` 表示，例如下一版為 `v9`、再下一版為 `v10`。

更新版本時需同步調整：

- `index.html` 的 manifest、CSS、JS 查詢版本與畫面上的版本標籤
- `install.html` 的 manifest、CSS、QR 安裝網址與畫面上的版本標籤
- `manifest.webmanifest` 的 `start_url`
- `sw.js` 的 `APP_VERSION`
- `server.js` 的 `latestAppVersion`

## 目前能力

- v7 新增音訊來源選擇與「重讀音訊」；外接音訊可指定為錄音來源，即時逐字稿仍需瀏覽器或系統預設麥克風能收到該音訊。
- v8 手寫草稿改為長頁面，右側新增滑桿可快速上下滑動。
- 手機版頂部 App Bar 與底部快速導航
- PWA manifest 與 service worker，可加入手機主畫面
- `install.html` 提供手機 QR Code 安裝/開啟頁
- 觸控筆、滑鼠或觸控板手寫草稿
- 手寫草稿支援主動式觸控筆直接書寫；電容筆若被手機當成手指，請按「手指/電容筆書寫」
- 瀏覽器錄音，支援時會啟用 Web Speech API 即時轉文字
- 錄音可切換為背景模式，保留浮動控制列
- 停止錄音時自動下載音檔，檔名使用「客戶名稱_拜訪議題_時間」
- 關閉 App / 分頁時會嘗試自動停止與保存錄音；瀏覽器可能要求確認，建議重要會議先按「停止」
- AI 作戰板顯示決策狀態、下次聯繫與待追蹤數量
- 名片圖片保存與名片文字解析
- 與會人、待辦、追蹤信與列印內容管理
- `/api/sync` 可做本機、區網或雲端同步 API
- 可透過 `google-drive-sync.gs` 使用 shcl1973 Google 雲端硬碟保存同步資料
- JSON 匯出與匯入備份

## 手機 QR 與同步

正式給手機直接安裝時，建議把此專案啟用 GitHub Pages，讓手機開 HTTPS 網址：

```text
https://shcl1973-spec.github.io/sset-ai-meeting-notebook/?v=v8
```

手機安裝方式：

- iPhone：用 Safari 開啟 HTTPS 網址，按分享，選「加入主畫面」。
- Android：用 Chrome 開啟 HTTPS 網址，選「安裝應用程式」或「加入主畫面」。
- 安裝後，在 App 的「雲端同步」填入 shcl1973 Google Apps Script `/exec` 同步網址與 `SYNC_TOKEN`。

如果還在本機測試：

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

## shcl1973 Google 雲端硬碟同步

可以使用 shcl1973 的 Google Drive 作為同步儲存位置。做法是用 Google Apps Script 建立一個 Web App 同步端點，App 仍然填「同步 API」，實際資料會寫入 Google Drive 的 `SSET AI Meeting Notebook/notebook.json`。

設定步驟：

1. 用 shcl1973 Google 帳號開啟 [Apps Script](https://script.google.com/)。
2. 建立新專案，把 `google-drive-sync.gs` 的內容貼到 `Code.gs`。
3. 到「專案設定」新增 Script Property：`SYNC_TOKEN`，值請設定成一組不容易猜的同步金鑰。
4. 點「部署」>「新增部署」> 選「網頁應用程式」。
5. 執行身分選「我」，存取權限依使用情境選「任何知道連結的人」或公司網域內使用者。
6. 部署後複製 `/exec` 結尾的 Web App URL。
7. 回到 AI 筆記本，在「雲端同步」填入該 URL，金鑰填入同一組 `SYNC_TOKEN`，按「智慧同步」。

注意：會議資料、逐字稿、名片文字、手寫草稿圖片資料會存在 Google Drive。錄音音檔目前仍會下載保存在操作裝置本機，避免會議錄音檔過大造成同步失敗。
