# 漸強會議需求自動化（Meeting → Requirement / Handover / Slides / Report）

業務開完客戶會後，從 Fireflies 抓逐字稿，自動生成：
1. **需求蒐集文件**（文字，可同步到 HubSpot Deal Notes）
2. **規劃報告書**（Word .docx）
3. **客戶簡報**（Google Slides）
4. **BD × CS 交接文件 L2**（文字，可同步到 HubSpot Deal Notes）

## 技術棧

- 後端：Node.js 18+ / Express
- 前端：Vanilla HTML + JS（可換 React）
- AI：Google Gemini API（gemini-2.5-pro，可在 `.env` 改成 flash）
- 資料源：Fireflies GraphQL API
- 同步目的地：HubSpot Notes API、Google Drive/Slides

## 安裝

```bash
cd meeting-automation
npm install
cp .env.example .env
# 填入 .env 內所有金鑰
npm run dev
# 開啟 http://localhost:3000
```

## .env 必填項

```
GEMINI_API_KEY=AIzaSy...
FIREFLIES_API_KEY=...
HUBSPOT_TOKEN=pat-na1-...

# Google OAuth（給 Slides 用）
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
GOOGLE_DRIVE_FOLDER_ID=1ncfnP1ZTZjEyvGKHCLlaFDylooZ0TG-A   # 你們的共用資料夾

PORT=3000
```

## 取得各個金鑰

### Fireflies
1. 登入 https://app.fireflies.ai/
2. 右上角頭像 → Settings → Developer Settings
3. Generate API Key

### HubSpot Private App Token
1. HubSpot 後台 → Settings → Integrations → Private Apps
2. Create a private app
3. Scopes 勾：
   - `crm.objects.deals.read`
   - `crm.objects.deals.write`
   - `crm.objects.notes.write`
4. Create → 複製 Access token

### Google OAuth
1. https://console.cloud.google.com/ → 建立專案
2. APIs & Services → Library → 啟用 Google Drive API、Google Slides API
3. APIs & Services → Credentials → Create OAuth client ID（Web application）
4. Authorized redirect URIs 填 `http://localhost:3000/oauth/callback`
5. 下載 client ID 跟 secret

### Google Gemini
1. https://aistudio.google.com/apikey
2. **Create API key** → 選一個 GCP 專案（或建新的）
3. 複製出現的 `AIzaSy...` 字串
4. 若公司要用 Vertex AI 走 GCP 計費，請 IT 給 Vertex AI 的 service account JSON
   （此版本預設走 AI Studio key，要切換要改 `server/lib/gemini.js` 改用 @google-cloud/vertexai）

## 流程

1. 業務在前端選日期區間（預設最近 7 天）→ 列出該區間 Fireflies 會議
2. 勾選一場或多場會議（可顯示已選數量）
3. 選擇要產出哪一種文件
4. 後端抓逐字稿 → 套對應 prompt → Claude 生成
5. 前端顯示結果 → 一鍵：
   - 同步到 HubSpot（**輸入名稱即時下拉搜尋 Deal**，不必手抄 ID）
   - 下載 Word
   - 建立 Google Slides（會跳 OAuth 授權）

## 簡報版型（共 11 張）

1. 封面（藍紫雙色塊 + 客戶名 + 日期）
2. 議程
3. Section divider 01：洞察客戶
4. 客戶現況（數字卡 + bullets）
5. 痛點分析（2×2 紫色卡）
6. Section divider 02：建議方案
7. 解決方案（行銷/客服/簡訊/EDM 4 區塊）
8. 導入時程（時間軸圓點）
9. 成功指標（KPI 數字卡）
10. 下一步（✓ 條列）
11. Thank You

每張內容頁都有：左上 4px 藍直線 + 標題、右上 section tag、淡藍/淡紫漸層背景（用 3 個 rect 模擬，pptxgenjs 不支援漸層）。

## 部署

最簡單：Render 或 Railway 一鍵部署，記得把 `GOOGLE_REDIRECT_URI` 改成正式網址。
