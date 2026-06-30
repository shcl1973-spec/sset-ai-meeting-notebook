# Android APK 安裝檔

此專案已加入 Android APK 打包設定。GitHub 會透過 Actions 產生測試用安裝檔：

1. 到 GitHub repo 的 `Actions`
2. 選擇 `Build Android APK`
3. 按 `Run workflow`
4. 等待完成後，下載 `SSET-AI-Notebook-Android-v9`
5. 解壓縮後把 `.apk` 傳到 Android 手機或平板安裝

此 APK 是 debug 測試版，適合內部試用。正式發佈到 Google Play 時，需要建立正式簽章的 release APK 或 AAB。

## 手機和平板資料

- APK 安裝後，資料會存在安裝的 Android 裝置本機。
- 若要手機和平板、電腦同步，仍然使用 App 內的 Google Drive 同步設定。
- 移除 App 可能會移除本機資料，移除前請先同步或匯出 JSON。

## iPhone / iPad

iPhone 與 iPad 不能直接安裝 Android APK。可行方式是：

- 用 Safari 開 GitHub Pages 網址後「加入主畫面」
- 或使用 Apple Developer 帳號建立 iOS App，透過 TestFlight 或 App Store 安裝
