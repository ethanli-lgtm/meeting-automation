// server/index.js
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

import * as fireflies from './lib/fireflies.js';
import * as claude from './lib/claude.js';
import * as prompts from './lib/prompts.js';
import * as hubspot from './lib/hubspot.js';
import * as slides from './lib/slides.js';
import { generateReportDocx } from './lib/docx.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '..', 'client')));

// ---- 簡易 in-memory token store（正式環境換 Redis / DB）----
const tokenStore = new Map(); // sessionId → tokens

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// ===========================================
// 1) Fireflies：列出會議
// ===========================================
app.get('/api/meetings', async (req, res) => {
  try {
    const { from, to, keyword } = req.query;
    const list = await fireflies.listMeetings({
      fromDate: from || undefined,
      toDate: to || undefined,
      keyword,
      limit: 50,
    });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===========================================
// 2) 生成 4 種文件
//    body: { meetingIds: string[], type, companyName }
//    type: 'requirement' | 'handover' | 'report' | 'slides'
// ===========================================
app.post('/api/generate', async (req, res) => {
  try {
    const { meetingIds, type, companyName } = req.body;
    if (!meetingIds?.length) return res.status(400).json({ error: '請選擇至少一場會議' });

    const meetings = await fireflies.getTranscripts(meetingIds);
    const transcript = prompts.combineTranscripts(meetings);
    const company = companyName || meetings[0]?.title?.split(/[×x_-]/)[0]?.trim() || '客戶';

    let result;
    if (type === 'requirement') {
      const text = await claude.generateText(prompts.requirementPrompt({ companyName: company, transcript }));
      result = { kind: 'text', content: text, companyName: company };
    } else if (type === 'handover') {
      const text = await claude.generateText(prompts.handoverPrompt({ transcript }));
      result = { kind: 'text', content: text, companyName: company };
    } else if (type === 'report') {
      const data = await claude.generateJSON(prompts.reportPrompt({ companyName: company, transcript }));
      result = { kind: 'report', data, companyName: company };
    } else if (type === 'slides') {
      const data = await claude.generateJSON(prompts.slidesPrompt({ companyName: company, transcript }));
      result = { kind: 'slides', data, companyName: company };
    } else {
      return res.status(400).json({ error: 'unknown type' });
    }
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ===========================================
// 3) HubSpot 同步
// ===========================================
app.get('/api/hubspot/deals', async (req, res) => {
  try {
    const { q } = req.query;
    res.json(await hubspot.searchDeals(q || ''));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/hubspot/sync', async (req, res) => {
  try {
    const { dealId, content, title } = req.body;
    if (!dealId) return res.status(400).json({ error: 'missing dealId' });
    const note = await hubspot.createNoteOnDeal({ dealId, content, title });
    res.json({ ok: true, noteId: note.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===========================================
// 4) 下載 Word
// ===========================================
app.post('/api/docx', async (req, res) => {
  try {
    const { data, companyName } = req.body;
    const buffer = await generateReportDocx(data);
    const fileName = `${companyName}_規劃報告書.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    // RFC 5987: filename* 用 UTF-8 編碼,瀏覽器會優先採用
    res.setHeader('Content-Disposition', `attachment; filename="report.docx"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===========================================
// 5) Google OAuth
// ===========================================
app.get('/oauth/start', (req, res) => {
  const oauth2 = getOAuthClient();
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive.file'],
    state: req.query.sessionId || 'default',
  });
  res.redirect(url);
});

app.get('/oauth/callback', async (req, res) => {
  try {
    const oauth2 = getOAuthClient();
    const { tokens } = await oauth2.getToken(req.query.code);
    tokenStore.set(req.query.state || 'default', tokens);
    res.send('<script>window.opener?.postMessage("oauth-done","*");window.close();</script>授權完成，可以關閉本視窗。');
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// ===========================================
// 6) 建立 Google Slides
// ===========================================
app.post('/api/slides/create', async (req, res) => {
  try {
    const { data, companyName, sessionId = 'default' } = req.body;
    const tokens = tokenStore.get(sessionId);
    if (!tokens) return res.status(401).json({ error: 'NEED_OAUTH' });

    const buffer = await slides.buildPptxBuffer(data);
    const fileName = `${companyName}_提案簡報_${new Date().toISOString().slice(0, 10)}`;
    const file = await slides.uploadAsGoogleSlides(buffer, tokens, fileName);
    res.json({ ok: true, link: file.webViewLink, id: file.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ===========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
