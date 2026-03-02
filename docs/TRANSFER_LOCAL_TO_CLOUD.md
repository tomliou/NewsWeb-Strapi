# 把本機 (dev) 資料搬到 Strapi Cloud

使用官方 **`strapi transfer`** 指令，將本機的 Article、Category、媒體等一次推到 Cloud。

---

## 注意

- **Cloud 現有資料會被覆蓋**：transfer 會清空 Cloud 的資料庫與資產，再寫入本機的內容。
- **兩邊 schema 要一致**：本機與 Cloud 的 Content Type（Article、Category 等）必須相同（你已用同一份 code 部署 Cloud，所以會一致）。
- **Admin 使用者與 API Token 不會被搬**：只搬內容與檔案，Cloud 的登入帳號、Token 維持不變。

---

## 步驟一：在 Strapi Cloud 建立 Transfer Token（Push）

1. 打開 **Cloud 後台**：  
   `https://active-trust-e46c30f868.strapiapp.com/admin`
2. 左側 **Settings（齒輪）** → **Global settings** → **Transfer Tokens**
3. 點 **Create new Transfer Token**
4. 設定：
   - **Name**：例如 `local-to-cloud`
   - **Token type**：選 **Push**（只允許「本機 → Cloud」）
   - **Duration**：選 7 天或 Unlimited
5. 點 **Save**
6. **立刻複製畫面上顯示的 Token**（只會顯示一次，之後看不到）

---

## 步驟二：本機 Strapi 先跑起來

在專案根目錄開一個終端機：

```bash
cd /path/to/NewsWeb-Strapi
npm run develop
```

看到 `Strapi started successfully` 後**不要關**，保持運行。

---

## 步驟三：執行 transfer（再開一個終端機）

在**另一個**終端機，同樣在專案根目錄執行：

```bash
cd /path/to/NewsWeb-Strapi
npx strapi transfer --to https://active-trust-e46c30f868.strapiapp.com/admin --to-token 你剛複製的Token --force
```

- `--to`：Cloud 的 **admin 網址**（要含 `/admin`）
- `--to-token`：步驟一複製的 Token
- `--force`：略過「確定要覆蓋遠端嗎？」的詢問（可選，若不加會要你手動輸入 yes）

執行後會開始上傳，完成即可。

---

## 步驟四：確認

打開：

`https://active-trust-e46c30f868.strapiapp.com/api/articles`

應會看到本機那 8 筆 Article 的 JSON。

---

## 若沒有「Transfer Tokens」選項

代表 Cloud 或專案未啟用 Data Management。需在 `config/admin.ts` 裡有設定 **transfer token salt**（例如 `TRANSFER_TOKEN_SALT` 環境變數）。本專案 `.env.example` 已有 `TRANSFER_TOKEN_SALT`，Strapi Cloud 通常會自動帶入；若後台仍看不到 Transfer Tokens，可至 Strapi 文件或 Cloud 說明確認該方案是否支援。

---

## 參考

- [Data transfer 文件](https://docs.strapi.io/cms/data-management/transfer)
- [Data Management 功能說明](https://docs.strapi.io/cms/features/data-management)
