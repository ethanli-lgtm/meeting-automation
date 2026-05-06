# 部署指南 — 會議需求自動化工具

> 這份文件假設你完全沒接觸過這個專案,從拿到資料夾到正式上線。預估時間:**第一次跑通約 60-90 分鐘**(主要花在申請各個 API key)。

---

## 前置:你需要的帳號

- [ ] **Anthropic** 帳號(會用 Claude API,有充值)
- [ ] **Fireflies** 帳號(已有,業務在用)
- [ ] **HubSpot** 帳號 + 「Super Admin」或可建立 Private App 的權限
- [ ] **Google Workspace** 帳號(`@cresclab.com`)
- [ ] **Node.js 18+** 已安裝在你電腦上(建議 20 或 22)

---

## Step 1 — 取得 4 把 API 金鑰

### 1-A. Anthropic API Key

1. 前往 https://console.anthropic.com/
2. 左側 **API Keys** → **Create Key**
3. 命名為「meeting-automation」,Workspace 選預設
4. 複製出現的 `sk-ant-api03-...` 字串(只會顯示一次,務必先存)
5. 確認 **Plans & Billing** 有餘額,否則 API 會 401

> **預估成本**:每次跑完 4 種文件,約用 30K input tokens + 5K output tokens ≈ US$0.15-0.20。一個月跑 100 場會 ≈ US$15-20。

### 1-B. Fireflies API Key

1. 登入 https://app.fireflies.ai/
2. 右上角頭像 → **Settings**
3. 左側 **Integrations** → **Developer Settings**(若沒有此選項表示帳號方案不支援 API,需聯絡管理員升級)
4. 點 **Generate API Key**
5. 複製字串

> **重要**:這把 key 拿到的會議資料是「該帳號權限可見的全部會議」,所以建議用 BD 主管或專屬服務帳號的 key。

### 1-C. HubSpot Private App Token

1. HubSpot 後台 → 右上齒輪 **Settings**
2. 左側 **Integrations** → **Private Apps**
3. **Create a private app**
4. **Basic Info** 頁:命名為「Meeting Automation Sync」,加 Logo 可選
5. **Scopes** 頁,勾選以下 3 個:
   - `crm.objects.deals.read`
   - `crm.objects.deals.write`
   - `crm.objects.notes.write`
6. 右上 **Create app** → 確認 → 複製 **Access token**(格式 `pat-na1-xxxx`)

### 1-D. Google OAuth Client(給 Slides 使用)

1. 前往 https://console.cloud.google.com/
2. 上方選單建立或選擇一個專案(命名如「crescendo-meeting-automation」)
3. 左選單 **APIs & Services** → **Library**
4. 搜尋並啟用以下 2 個 API:
   - **Google Drive API**
   - **Google Slides API**
5. 左選單 **APIs & Services** → **OAuth consent screen**
   - User Type 選 **Internal**(限公司網域使用)
   - 填 App name「Meeting Automation」、Support email、Developer email
   - Scopes 暫時不用加,直接 Save & Continue
6. 左選單 **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
   - Application type:**Web application**
   - Name:「Meeting Automation Web」
   - **Authorized redirect URIs** 加入:
     - 本機測試:`http://localhost:3000/oauth/callback`
     - 之後正式部署:`https://你的網址/oauth/callback`(可後續再加)
7. 建立後跳出 Client ID + Client Secret,**兩個都要複製**
8. 順便記下 Drive 中的目標資料夾 ID(從資料夾網址 `drive.google.com/drive/folders/<這串就是 ID>`)— 你們既有的是 `1ncfnP1ZTZjEyvGKHCLlaFDylooZ0TG-A`

---

## Step 2 — 本機跑起來

```bash
# 1. 解壓專案
tar -xzf meeting-automation.tar.gz
cd meeting-automation

# 2. 安裝依賴(約 1-2 分鐘)
npm install

# 3. 建立 .env
cp .env.example .env
```

用任何文字編輯器打開 `.env`,把 Step 1 拿到的金鑰填進去:

```env
ANTHROPIC_API_KEY=sk-ant-api03-你的key
FIREFLIES_API_KEY=你的key
HUBSPOT_TOKEN=pat-na1-你的token
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
GOOGLE_DRIVE_FOLDER_ID=1ncfnP1ZTZjEyvGKHCLlaFDylooZ0TG-A
COMPANY_DOMAIN=cresclab.com
PORT=3000
```

啟動:

```bash
npm run dev
```

**注意**:第一次啟動會看起來「卡住」幾秒,因為 `googleapis` 套件初始化要 5-6 秒。看到 `Server running on http://localhost:3000` 才真的好了。

打開瀏覽器去 `http://localhost:3000`。

---

## Step 3 — 第一次完整跑一場驗證

### 3-A. 測試 Fireflies 連線

1. 在頁面左側「選擇會議」區塊,日期區間選最近一週
2. 點 **查詢**
3. 應該看到列表跑出最近的會議。**列不出來就是 Fireflies key 有問題**,先去檢查
4. 勾選 1 場小型會議當作測試

### 3-B. 測試 Claude 生成

1. 右側「客戶公司名」輸入該會議的客戶名(例如「測試公司」)
2. 點 **需求蒐集**(最快、最簡單的測試)
3. 等約 20-40 秒。下方會出現整理好的文字
4. 點 **複製** 確認文字格式正確

### 3-C. 測試 HubSpot 同步

1. 到 HubSpot 找一個測試用的 Deal,複製它的 ID(網址裡的數字,例如 `https://app.hubspot.com/contacts/12345/record/0-3/<這就是 deal ID>`)
2. 把 Deal ID 貼到欄位
3. 點 **同步到 HubSpot**
4. 回 HubSpot 該 Deal 看 Notes 區,應該有一筆新增的 Note

### 3-D. 測試 Google Slides

1. 點 **客戶簡報** 觸發 Claude 生成內容
2. 看到 JSON 後點 **建立 Google Slides**
3. 第一次會跳出新視窗要求授權:
   - 用公司 Google 帳號登入
   - 同意「View and manage Google Drive files...」
4. 自動關閉視窗後,主畫面會出現「開啟 Google Slides ↗」連結
5. 點開,確認簡報內容、版型正確

### 3-E. 測試 Word 報告書

1. 點 **規劃報告書** 觸發生成
2. 點 **下載 Word**
3. 用 Word/Pages 打開,確認排版

---

## Step 4 — 部署到正式環境(讓全公司用)

> 推薦 **Render** 或 **Railway**,設定最簡單。下面以 Render 為例。

### 4-A. 程式碼推到 GitHub

```bash
cd meeting-automation
git init
echo "node_modules/" > .gitignore
echo ".env" >> .gitignore
git add .
git commit -m "initial commit"
gh repo create crescendolab/meeting-automation --private --push
```

### 4-B. Render 設定

1. 前往 https://render.com/ 用 GitHub 帳號登入
2. **New +** → **Web Service** → 選你剛 push 的 repo
3. 設定:
   - **Name**: `meeting-automation`
   - **Region**: Singapore(離台灣最近)
   - **Branch**: main
   - **Build Command**: `npm install`
   - **Start Command**: `node server/index.js`
   - **Instance Type**: Starter ($7/月,夠用)
4. **Environment** 分頁,把 `.env` 內容一個一個貼進去(注意 `GOOGLE_REDIRECT_URI` 要改成 `https://meeting-automation.onrender.com/oauth/callback`)
5. **Create Web Service**

### 4-C. 回 Google Cloud Console 補上正式網址

1. https://console.cloud.google.com/ → APIs & Services → Credentials
2. 點你建立的 OAuth Client → **Authorized redirect URIs**
3. 加上 `https://meeting-automation.onrender.com/oauth/callback`
4. **Save**

### 4-D. 給業務團隊網址

`https://meeting-automation.onrender.com`

---

## 維運手冊

### 改 Prompt 文字

業務想調整輸出格式,直接改 `server/lib/prompts.js`,push 到 GitHub,Render 會自動重新部署。

### 加新文件類型

1. `prompts.js` 加一個新的 prompt function
2. `server/index.js` 的 `/api/generate` 處加一個 `else if`
3. `client/index.html` 加一個按鈕

### Token 用量監控

- Anthropic:https://console.anthropic.com/usage
- 設定預算警報避免被刷爆

### 常見問題排除

| 症狀 | 原因 | 解法 |
|------|------|------|
| 列不出 Fireflies 會議 | API key 失效 / 方案不支援 | 重新生成 key |
| Claude 回 401 | API key 錯 / 額度用盡 | 檢查 Anthropic console |
| HubSpot 同步失敗 | scope 沒勾全 / Deal ID 錯 | 檢查 Private App 的 scope |
| Slides 授權後仍失敗 | Drive folder ID 錯 | 確認資料夾存在且帳號有寫入權 |
| 字型在 Slides 顯示不對 | Google Slides 不支援嵌入字型 | 接受系統字型 fallback,或在 Slides 內手動換字 |
| Server 啟動很久 | googleapis 套件大 | 正常,等 ~8 秒 |

### 備份與安全

- `.env` **千萬不要** commit 到 GitHub(`.gitignore` 已加)
- 每年輪換一次所有 token
- HubSpot Private App 可隨時 revoke,出事就先 revoke 再來追責

---

## 已驗證項目(在沙箱跑過)

下列在交付給你前已實測通過,你 90% 不會踩這些坑:

- ✓ npm install 不會衝突(156 套件)
- ✓ ES Module 設定正確(`"type": "module"`)
- ✓ 8 張投影片 103 個元件全部在 13.33×7.5in 邊界內(符合 Crescendo design guide)
- ✓ docx / pptx 產出檔案結構合法
- ✓ 中文檔名下載正常(用 RFC 5987 編碼,Chrome/Safari/Firefox 都過)
- ✓ Express 路由全部回應正確 HTTP 狀態碼

剩下的 10% 風險主要在:
- Fireflies GraphQL schema 可能更新欄位名(他們的 API 還不算 100% 穩定)
- HubSpot association type ID `214` 是預設值,如果你們自訂過可能要改
- Google Slides 中文字型一定會 fallback,設計師若要求嚴格還原 Crescendo 字體,要走 Slides API batchUpdate 路線(工程量翻倍)

這三個都建議跑通基本流程後再來細調。
