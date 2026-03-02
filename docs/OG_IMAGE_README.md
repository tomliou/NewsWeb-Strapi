# 如何取得新聞 URL 的 OG 圖（og:image）

網站目前若顯示「假資料」或沒有圖片，可以用以下兩種方式取得真實的 **og:image**。

---

## 方式一：同步腳本（推薦，圖會存進 Strapi）

一次把「有 url、沒 image」的 Article 從對應新聞頁抓 og:image，下載後上傳到 Strapi，之後前端直接從 API 拿圖。

- **腳本位置**：`scripts/article-og-image/`
- **說明**：[scripts/article-og-image/README.md](../scripts/article-og-image/README.md)

**步驟摘要**：

1. Strapi 啟動，並在後台建立 API Token（Article 的 find/update、Upload）。
2. 在專案根目錄或該腳本資料夾的 `.env` 設定：
   - `STRAPI_URL`（例如 `https://你的專案.strapiapp.com`）
   - `STRAPI_API_TOKEN`
3. 執行：
   ```bash
   cd scripts/article-og-image
   npm install
   npm run sync
   ```
   或 `node scripts/article-og-image/sync.js --dry` 先看會處理哪些文章。

跑完後，Article 的 `image` 欄位會有圖，前端用 Strapi 的 `/api/articles?populate=image` 就會拿到真實封面圖。

---

## 方式二：即時從 URL 讀取 og:image（不存 Strapi）

當某筆文章在 Strapi 沒有 `image` 時，前端可以呼叫 Strapi 的 **即時 API**，傳入該新聞的 URL，直接回傳該頁的 og:image 網址。

**API**：

- **路徑**：`GET /api/articles/og-from-url?url=<新聞頁的完整 URL>`
- **無需驗證**（已設 `auth: false`）
- **回傳**：
  - 成功：`{ data: { ogImage: "https://..." } }`
  - 無 og:image：404
  - URL 無效或抓取失敗：400

**範例**：

```bash
curl "https://你的Strapi網址/api/articles/og-from-url?url=https://tw.news.yahoo.com/某則新聞-123.html"
```

前端用法：若 `article.image` 為空，就用 `article.url` 呼叫上述 API，把回傳的 `ogImage` 當成卡片圖片 URL 顯示（或先快取再顯示）。

---

## 建議

- **首選**：用方式一定期跑同步腳本，讓 Strapi 裡每筆 Article 都有 image，前端只接 Strapi 即可。
- **補強**：若暫時沒跑腳本或部分文章沒圖，前端可對「無 image」的項目用方式二即時取 og 圖，避免顯示假資料或空白圖。
