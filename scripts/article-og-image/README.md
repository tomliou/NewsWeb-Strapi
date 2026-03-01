# Article OG Image 同步腳本

**此資料夾與主程式無關**，僅為「從新聞 URL 抓取 og:image 並上傳到 Strapi」的獨立腳本，方便辨識、不會與 Strapi 主程式搞混。

## 功能

- 讀取 Strapi 裡**尚未有 image** 的 Article
- 依每筆 Article 的 **url** 去抓該頁的 **og:image**
- 下載圖片後上傳至 Strapi Media Library，並寫回該 Article 的 **image** 欄位

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

- **無參數**：會實際抓 og:image、上傳並更新 Article
- **`--dry`**：只列出「會處理的 Article」（有 url、無 image），不抓圖、不上傳

```bash
npm run sync:dry
# 或
node scripts/article-og-image/sync.js --dry
```

## 注意

- 僅處理「有 url 且沒有 image」的 Article，已有 image 的不會覆蓋
- 若該新聞頁沒有 og:image，會跳過該筆並在 console 顯示
- 需可連到新聞網址與 Strapi，請確認網路與防火牆設定
