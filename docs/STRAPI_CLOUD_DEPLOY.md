# 部署 NewsWeb-Strapi 到 Strapi Cloud

讓前端 NewsWeb 可透過公網 API 取用後端，使用官方 Strapi Cloud 一條龍部署。

---

## 前置條件

- Strapi 4.8.2 以上（本專案為 5.x ✓）
- **資料庫**：Strapi Cloud 使用 **PostgreSQL**，會自動提供並設定環境變數，本專案 `config/database.ts` 已支援
- **程式碼**：專案需在 **GitHub** 或 **GitLab**，且你有權限可讓 Strapi Cloud 讀取

---

## 步驟一：程式碼推上 Git

若尚未推上遠端：

```bash
cd /path/to/NewsWeb-Strapi
git remote add origin https://github.com/你的帳號/你的repo.git
git add .
git commit -m "chore: prepare for Strapi Cloud"
git push -u origin main
```

若 Strapi 專案在 **monorepo 子目錄**（例如 repo 根目錄是 `Tom_VibeCoding`，Strapi 在 `NewsWeb-Strapi/`），部署時需在 Strapi Cloud 設定 **Base directory**（見下方）。

---

## 步驟二：登入 Strapi Cloud

1. 開啟 **https://cloud.strapi.io**
2. 使用 **GitHub**、**Google**、**GitLab** 或 **Magic link** 登入（首次會建立 Strapi Cloud 帳號）

---

## 步驟三：建立專案

1. 點 **Create project**
2. **選擇方案**：Free / Essential / Pro / Scale（可先選 Free）
3. **連接 Git**：
   - 選 **Use your own repository**
   - 授權 Strapi Cloud 存取你的 GitHub/GitLab
   - 選擇放 **NewsWeb-Strapi** 的那個 repository
4. **設定專案**：
   - **Display name**：例如 `NewsWeb-Strapi`（可改）
   - **Git branch**：要部署的分支（例如 `main`）
   - **Deploy on push**：勾選則每次 push 會自動部署
   - **Region**：選 **Asia (Southeast)** 較接近台灣
   - **Base directory**：若 Strapi 在 repo 的**子目錄**（例如 `NewsWeb-Strapi`），這裡填 `NewsWeb-Strapi`；若整個 repo 就是 Strapi 專案則留空
5. **Advanced（可選）**：
   - **Environment variables**：Strapi Cloud 會自動帶入資料庫等變數；若有自訂變數可在此加
   - **Node version**：依專案需求，預設即可
6. Free 方案可略過付款，直接點 **Create project**

---

## 步驟四：等待部署

- 建立後會自動觸發第一次部署
- 在專案儀表板可看部署進度與日誌
- 若失敗可看錯誤訊息（常見：Node 版本、Base directory 設錯、缺少依賴）

---

## 步驟五：取得 API 網址與建立 Admin

1. 部署成功後，在 Strapi Cloud 專案頁會顯示 **Strapi URL**（例如 `https://xxx.strapiapp.com`）
2. 點進該 URL，**建立第一個 Admin 帳號**（僅首次需要）
3. 之後到 **Settings → API Tokens** 建立給前端用的 Token（若需要）
4. 在 **Settings → Users & Permissions → Public** 確認 Article、Category 等有開放 `find`、`findOne`（前端才能讀取）

---

## 前端 NewsWeb 設定

在 NewsWeb 專案中，把 Strapi 的網址設成環境變數，例如：

```env
# .env.local
NEXT_PUBLIC_STRAPI_URL=https://你的專案.strapiapp.com
```

前端打 API 時使用 `NEXT_PUBLIC_STRAPI_URL`，例如：

- `GET ${NEXT_PUBLIC_STRAPI_URL}/api/articles`
- `GET ${NEXT_PUBLIC_STRAPI_URL}/api/categories`

若前端有 CORS 問題，到 Strapi Cloud 專案的 **Settings**（或本機 `config/middlewares.ts`）確認 CORS 的 `origin` 有包含前端網域。

---

## 注意事項

- **資料庫**：Strapi Cloud 會提供 PostgreSQL，**不需**自己設 `DATABASE_*`（除非要用外部 DB）
- **本機 SQLite**：本機開發仍可用 SQLite；上 Cloud 後會自動用 Cloud 提供的 Postgres
- **上傳檔案**：Cloud 會處理 media 儲存，無需額外設定即可使用
- **費用**：Free 有額度與限制，詳見 [Strapi Cloud 定價](https://strapi.io/pricing-cloud)

---

## 參考

- [Strapi Cloud 部署文件](https://docs.strapi.io/cloud/getting-started/deployment)
- [Strapi Cloud 介紹](https://docs.strapi.io/cloud/intro)
