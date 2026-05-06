// server/lib/prompts.js
// 4 種文件的 Prompt 模板。修改文字格式直接改這裡，不用動程式邏輯。

/**
 * 把多場會議的逐字稿合併成單一字串給 Claude
 */
export function combineTranscripts(meetings) {
  return meetings
    .map((m) => {
      const sentences = (m.sentences || [])
        .map((s) => `${s.speaker_name || '?'}：${s.text}`)
        .join('\n');
      return `===== 會議：${m.title}（${m.date}）=====\n${sentences}`;
    })
    .join('\n\n');
}

/**
 * (1) 需求蒐集 - 業務原始 prompt 直接照搬
 */
export function requirementPrompt({ companyName, transcript }) {
  return `以下是會議逐字稿：

<transcript>
${transcript}
</transcript>

請幫我把資料整理成以下文字格式（列點文字）：
如果沒有討論到的內容請幫我寫"未討論到"，請不要自己新增任何跟提供內容無關的資訊

1. 目前該公司現況？
    - 人力配置
    - LINE 官方帳號好友數
    - 投放廣告的渠道有哪些
    - 系統預計導入時間
    - 本次專案預算
    - 其他有討論到的細節
2. 目前該公司自己在 LINE 官方帳號的操作行銷和客服有哪些？
    - 目前行銷操作
    - 目前客服操作
    - 目前簡訊操作
    - 目前 EDM 操作
3. 行銷和客服分別的需求列表？
    - 行銷需求
    - 客服需求
    - 簡訊需求
    - EDM 需求

最後的產出規則：
- 不要有額外的摘要、只需要回答上面的問題
- 給我的答案不要有 () 內的文字
- 我要可以直接複製用的
- 最前面標題寫 "${companyName}公司需求搜集"`;
}

/**
 * (4) BD x CS 交接文件 - 業務原始 prompt
 */
export function handoverPrompt({ transcript }) {
  return `以下是會議逐字稿：

<transcript>
${transcript}
</transcript>

請幫我把資料整理成以下文字格式（列點文字）：
如果沒有討論到的內容請幫我寫"未討論到"，請不要自己新增任何跟提供內容無關的資訊

BD x CS 交接文件 - L2

- 預計正式開通時間：
- 希望 OB 課程時間：
- 聯繫窗口：
    - xxx-行銷
    - xxx-客服
- 原先使用系統：
- 系統導入主要目標：
- 本次購買項目：
- Upsell 機會：
- 有提到但尚無法解決的需求：
- 其他備註：
- Assignee：

規則：
- "BD x CS 交接文件 - L2" 標題永遠保留
- 不要有額外的摘要、只需要回答上面的問題
- 我要可以直接複製用的`;
}

/**
 * (2) 規劃報告書 - 產出結構化 JSON 給 docx 模組組裝
 */
export function reportPrompt({ companyName, transcript }) {
  return `以下是漸強實驗室與「${companyName}」的會議逐字稿：

<transcript>
${transcript}
</transcript>

請依逐字稿產出一份規劃報告書內容，**只回 JSON**（不要有 markdown 或其他文字），格式如下：

{
  "companyName": "${companyName}",
  "executiveSummary": "2-3 句話總結這個案子的核心目的",
  "currentState": {
    "title": "客戶現況",
    "items": ["條列重點 1", "條列重點 2", ...]
  },
  "painPoints": {
    "title": "痛點與挑戰",
    "items": [...]
  },
  "objectives": {
    "title": "本次專案目標",
    "items": [...]
  },
  "solution": {
    "title": "漸強建議方案",
    "marketing": ["行銷面建議"],
    "service": ["客服面建議"],
    "sms": ["簡訊面建議"],
    "edm": ["EDM 面建議"]
  },
  "roadmap": [
    {"phase": "Phase 1: 系統導入", "duration": "第 1-2 週", "tasks": ["任務..."]},
    {"phase": "Phase 2: ...", "duration": "...", "tasks": [...]}
  ],
  "successMetrics": ["KPI 1", "KPI 2", ...],
  "nextSteps": ["下一步行動 1", ...]
}

未討論到的欄位請填 ["未討論到"]。不要編造逐字稿沒提到的內容。`;
}

/**
 * (3) Google Slides 內容 - 產出結構化 JSON 給 pptxgenjs 渲染
 *     版型參考漸強實驗室設計規範
 */
export function slidesPrompt({ companyName, transcript }) {
  return `以下是漸強實驗室與「${companyName}」的會議逐字稿：

<transcript>
${transcript}
</transcript>

請產出一份提案簡報的內容大綱，**只回 JSON**（不要 markdown 或其他文字），格式如下：

{
  "companyName": "${companyName}",
  "subtitle": "副標：例如『LINE 官方帳號 × 全通路行銷導入規劃』",
  "agenda": ["客戶現況", "痛點分析", "解決方案", "導入時程", "成功指標"],
  "currentState": {
    "title": "客戶現況",
    "stats": [
      {"label": "好友數", "value": "..."},
      {"label": "團隊規模", "value": "..."}
    ],
    "bullets": ["重點 1", "重點 2"]
  },
  "painPoints": [
    {"title": "痛點 1", "description": "說明..."},
    {"title": "痛點 2", "description": "..."}
  ],
  "solution": {
    "marketing": {"title": "行銷自動化", "bullets": [...]},
    "service": {"title": "智能客服", "bullets": [...]},
    "sms": {"title": "簡訊整合", "bullets": [...]},
    "edm": {"title": "EDM 整合", "bullets": [...]}
  },
  "timeline": [
    {"stage": "Phase 1", "title": "系統導入", "duration": "1-2 週"},
    {"stage": "Phase 2", "title": "...", "duration": "..."}
  ],
  "metrics": [
    {"label": "互動率", "target": "+30%"},
    {"label": "客服 SLA", "target": "5 分鐘內"}
  ],
  "nextSteps": ["...", "..."]
}

未討論到的欄位請填 ["未討論到"] 或 "未討論到"。不要編造。`;
}
