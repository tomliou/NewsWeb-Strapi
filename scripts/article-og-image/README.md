# Article OG Image 與 Description 同步腳本

**此資料夾與主程式無關**，為「從新聞 URL 直接抓取 og:image 與 page description 並寫回 Strapi」的獨立腳本。

## 功能

- 讀取 Strapi 裡**有 url 且缺 image 或缺 description** 的 Article
- 依每筆 Article 的 **url** 直接抓該頁：
  - **og:image** → 下載後上傳至 Strapi Media Library，寫回 **image** 欄位
  - **page description**（og:description 或 meta name="description"）→ 寫回 **description** 欄位
- 同一筆文章只抓一次 URL，能補 image 就補 image，能補 description 就補 description

## 使用前準備

1. **Strapi 先啟動**（例如 `npm run develop`）
2. 在 Strapi 後台建立 **API Token**（Settings → API Tokens），權限至少要有：
   - `Article`：find、findOne、update
   - `Upload`：upload（或對應的 upload 權限）
3. 設定環境變數（見下方）

## 環境變數

可放在**專案根目錄**的 `.env`，或**本資料夾**的 `.env`：

```env
STRAPI_URL=http://localhost:1337
STRAPI_API_TOKEN=你的_API_Token
```

- `STRAPI_URL`：Strapi 位址，預設 `http://localhost:1337`
- `STRAPI_API_TOKEN`：必填，用於呼叫 Strapi API 與上傳

## 執行方式

在**專案根目錄**執行（建議先裝依賴）：

```bash
cd scripts/article-og-image
npm install
npm run sync
```

或從專案根目錄：

```bash
node scripts/article-og-image/sync.js
```

### 參數

- **無參數**：會實際抓 og:image / description 並寫回 Strapi
- **`--dry`**：只列出「會處理的 Article」（有 url 且缺 image 或 description），不抓取、不寫入

```bash
npm run sync:dry
# 或
node scripts/article-og-image/sync.js --dry
```

## 注意

- 僅處理「有 url 且缺 image 或缺 description」的 Article；已有 image / description 的不會覆蓋
- 若該頁沒有 og:image 或 description，該欄位會跳過，其他欄位仍會嘗試更新
- 需可連到新聞網址與 Strapi，請確認網路與防火牆設定

## 即時讀取 OG 圖（不存 Strapi）

若希望「不跑腳本、直接從某個 URL 讀 og:image 或 description」，可改用 Strapi 提供的 API：  
`GET /api/articles/og-from-url?url=<新聞頁 URL>`，會回傳 `{ data: { ogImage?: "...", description?: "..." } }`。  
詳見專案 [docs/OG_IMAGE_README.md](../../docs/OG_IMAGE_README.md)。
