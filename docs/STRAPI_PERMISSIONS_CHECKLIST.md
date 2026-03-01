# Strapi 權限檢查清單（讓前端能取用 API）

前端 NewsWeb 要能讀取文章、分類，需要在 Strapi 後台開放對應權限。

---

## 在哪裡設定

1. 登入 **Strapi 後台**（本機：http://localhost:1337/admin；Strapi Cloud：你的 App URL + `/admin`）
2. 左側最下方點 **齒輪圖示（Settings）**
3. 左側選 **Users & Permissions** → **Roles**

---

## 要勾的權限

### 若前端「不帶 Token」打 API（匿名讀取）

編輯 **Public** 角色，在權限列表中找到：

| 權限區塊 | 勾選項目 | 說明 |
|----------|----------|------|
| **Article** | `find`、`findOne` | 取得文章列表、單篇文章 |
| **Category** | `find`、`findOne` | 取得分類列表、單一分類 |

勾好後點 **Save**。

### 若前端「帶 API Token」打 API

1. 到 **Settings** → **API Tokens**，確認你的 Token 權限包含：
   - **Article**：`find`、`findOne`
   - **Category**：`find`、`findOne`
2. 或該 Token 使用 **Full access**（已包含上述）。

---

## 快速自測

在瀏覽器或終端機打（把網址換成你的 Strapi 網址）：

- 文章列表：`https://你的Strapi網址/api/articles`
- 分類列表：`https://你的Strapi網址/api/categories`

- **有權限**：會回 JSON 資料（或 `data: []`）
- **沒權限**：常會回 **403 Forbidden** 或 **401 Unauthorized**

---

## 常見狀況

| 狀況 | 可能原因 | 處理 |
|------|----------|------|
| 403 Forbidden | Public 沒開 find/findOne | 到 Roles → Public 勾選 Article、Category 的 find、findOne |
| 401 Unauthorized | 需要登入或 Token | 用 Public 開放讀取，或前端帶正確 API Token |
| 404 Not Found | 路徑錯或 content-type 沒上線 | 確認是 `/api/articles`、`/api/categories`，且專案有部署成功 |
