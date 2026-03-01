# NewsWeb 前端所需 API 規格

本文件描述 **NewsWeb**（Next.js 前端）實際使用的資料結構與 API 需求，供 Strapi 後端對齊實作。

---

## 1. 前端資料結構（來自 NewsWeb 程式碼）

### 1.1 新聞卡片 `NewsCard`（`src/components/NewsCard.tsx`）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | string | 唯一識別，用於收藏、列表 key |
| `title` | string | 標題 |
| `description` | string | 摘要/描述 |
| `source` | string | 來源名稱（如「yahoo 科技新聞」） |
| `date` | string | 顯示用日期（如 "2024-04-14"） |
| `href` | string | 點擊後跳轉的連結（外部新聞 URL） |
| `image` | string | 圖片 URL，可選，無則前端用 placeholder |

### 1.2 收藏 `Bookmark`（`src/app/bookmarks/page.tsx`、`myaccount/page.tsx`）

與新聞卡片相同，但使用 `url` 而非 `href`：

- `id`, `title`, `description`, `source`, `date`, `url`, `image?`

### 1.3 首頁分類（`src/app/page.tsx`）

目前前端寫死的四個分類（Tab）：

| id | name | source 顯示範例 |
|----|------|-----------------|
| tech | 科技 | yahoo 科技新聞 |
| finance | 財經 | 東森新聞雲 財經新聞 |
| social | 社會 | Google 社會新聞 |
| discussion | 討論 | Dcard 討論新聞 |

---

## 2. 前端目前如何取新聞

- **路徑**：`NewsWeb/src/app/api/news/route.ts` 的 `GET`。
- **行為**：接收 query `category`，目前向 `http://localhost:3000/api/hotnews` 發 POST（該端點尚未實作）。
- **預期**：後端應能依「分類」回傳上述結構的新聞列表，供首頁各 Tab 使用。

---

## 3. 建議 Strapi 提供的 API

### 3.1 新聞列表（對應首頁各分類）

- **用途**：首頁依分類顯示新聞卡片。
- **建議路徑**：`GET /api/articles`
- **Query 參數**：
  - `filters[category][slug][$eq]=tech`（或 finance、social、discussion）
  - `pagination[page]=1&pagination[pageSize]=6`（首頁每 Tab 目前 6 筆）
  - `sort=publishedAt:desc`
  - `populate=category,image`（若圖片、分類要一起回傳）

**回傳格式**：陣列，每筆至少可對應成：

```ts
{
  id: string,        // 可用 documentId 或 id 轉 string
  title: string,
  description: string,
  source: string,
  date: string,      // YYYY-MM-DD，由 publishedAt 或自訂 date 欄位來
  href: string,      // 對應 Strapi 的 url 欄位
  image: string      // 從 populate image 取 url，需補上 STRAPI_URL
}
```

### 3.2 單篇新聞（若之後有詳情頁）

- **建議路徑**：`GET /api/articles/:id` 或 `GET /api/articles?filters[slug][$eq]=xxx`
- **回傳**：同上結構，單一物件。

---

## 4. Strapi 與前端欄位對照

| NewsWeb 欄位 | Strapi 建議欄位 | 備註 |
|--------------|-----------------|------|
| id | documentId 或 id | 回傳時轉成 string |
| title | title | |
| description | description | |
| source | source | 字串，存來源名稱 |
| date | publishedAt 或 date | 回傳時格式化成 YYYY-MM-DD |
| href / url | url | 外部連結 |
| image | image (media) | 回傳時用 `STRAPI_URL + image.url` |

---

## 5. 前端接 Strapi 時建議改動

1. **`NewsWeb/src/app/api/news/route.ts`**  
   - 改為呼叫 Strapi：`GET ${STRAPI_URL}/api/articles?filters[category][slug][$eq]=${category}&pagination[pageSize]=6&sort=publishedAt:desc&populate=image,category`
   - 將 Strapi 回傳的每筆轉成上述 `NewsCard` 格式（id、title、description、source、date、href、image）。

2. **圖片網址**  
   - Strapi 的 media 常回傳相對路徑（如 `/uploads/...`），前端或 Next.js API route 需加上 `process.env.STRAPI_URL` 組成完整 URL。

3. **分類**  
   - 在 Strapi 建立 Category（slug: tech, finance, social, discussion），Article 關聯 Category；前端傳的 `category` 即對應 `category.slug`。

---

## 6. 小結

- 新聞 API 需回傳：**id, title, description, source, date, href, image**，且支援依**分類 slug** 篩選。
- 分類與首頁 Tab 一致：**tech / finance / social / discussion**。
- 收藏功能目前用 localStorage（與 `/api/bookmarks`），不需 Strapi 提供收藏 API；若未來改為後端存收藏，可再擴充。

---

## 7. Strapi 端已建立的 Content Types（本專案）

已依上述規格在 `src/api/` 建立：

| API | 說明 | 欄位 |
|-----|------|------|
| **Category** | 分類 | name, slug, sourceLabel（選填） |
| **Article** | 新聞 | title, description, source, url, image(media), category(關聯)，另用內建 publishedAt 當 date |

**下一步：**

1. 執行 `npm run develop` 啟動 Strapi，後台建立四個分類（slug: tech, finance, social, discussion）與數筆文章。
2. **Settings → Users & Permissions → Public**：對 Article、Category 開放 `find`、`findOne`。
3. 在 NewsWeb 的 `.env.local` 設定 `STRAPI_URL=http://localhost:1337`，並修改 `src/app/api/news/route.ts` 改打 Strapi 並轉成 NewsCard 格式。
