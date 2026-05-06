// server/lib/slides.js
// 走 pptxgenjs 產 pptx → Drive 上傳並轉 Google Slides 的路線（與 playbook 一致）
//
// 設計遵循漸強實驗室規範：
//   - 16:9 LAYOUT_WIDE（13.333 × 7.5 in）
//   - 主藍 #5090FF / 紫 #801FF9（AI 裝飾）/ 薄荷 #47D7AC（✓）
//   - 每頁固定結構：左上 4px 藍直線 + 標題 + 副標 / 右上 section tag
//   - 漸層用 3 個 rect 疊加模擬（pptxgenjs 不支援漸層）
//   - 抽 helper：addContentBackground / addTitleBar / addSectionTag

import pptxgen from 'pptxgenjs';
import { google } from 'googleapis';
import { Readable } from 'node:stream';

const COLOR = {
  PRIMARY: '5090FF',
  PRIMARY_LIGHT: 'EFF6FF',
  PURPLE: '801FF9',
  PURPLE_LIGHT: 'F3E8FF',
  MINT: '47D7AC',
  TITLE: '334155',
  TEXT: '4B5563',
  MUTED: '94A3B8',
  WHITE: 'FFFFFF',
  LIGHT_BG: 'F8FAFC',
  BORDER: 'E5E7EB',
};

const FONT = 'Noto Sans TC';
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

/**
 * @param {Object} data - slidesPrompt 產出的 JSON
 * @returns {Promise<Buffer>}
 */
export async function buildPptxBuffer(data) {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = `${data.companyName} 提案簡報`;

  // ====== 1. 封面 ======
  addCoverSlide(pres, data);

  // ====== 2. Agenda ======
  addAgendaSlide(pres, data);

  // ====== 3. Section divider：洞察客戶 ======
  addSectionDivider(pres, '01', '洞察客戶現況', '從會議紀錄中萃取的關鍵資訊');

  // ====== 4. 客戶現況 ======
  if (data.currentState) addCurrentStateSlide(pres, data);

  // ====== 5. 痛點分析 ======
  if (data.painPoints?.length) addPainPointsSlide(pres, data);

  // ====== 6. Section divider：建議方案 ======
  addSectionDivider(pres, '02', '漸強建議方案', '行銷 × 客服 × 簡訊 × EDM 整合');

  // ====== 7. 解決方案（4 個區塊）======
  if (data.solution) addSolutionSlide(pres, data);

  // ====== 8. 導入時程 ======
  if (data.timeline?.length) addTimelineSlide(pres, data);

  // ====== 9. 成功指標 ======
  if (data.metrics?.length) addMetricsSlide(pres, data);

  // ====== 10. 下一步 ======
  if (data.nextSteps?.length) addNextStepsSlide(pres, data);

  // ====== 11. 結語 ======
  addClosingSlide(pres, data);

  return await pres.write({ outputType: 'nodebuffer' });
}

// =====================================================
// 共用 Helpers
// =====================================================

/**
 * 內容頁背景：淡藍 → 白 → 淡紫的「漸層」用 3 個 rect 模擬
 */
function addContentBackground(slide) {
  slide.background = { color: COLOR.WHITE };
  slide.addShape('rect', {
    x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, fill: { color: COLOR.LIGHT_BG },
  });
  // 左上一抹藍
  slide.addShape('rect', {
    x: 0, y: 0, w: 4.5, h: 2.5, fill: { color: COLOR.PRIMARY_LIGHT, transparency: 40 },
    line: { type: 'none' },
  });
  // 右下一抹紫
  slide.addShape('rect', {
    x: 8.5, y: 5, w: 4.833, h: 2.5, fill: { color: COLOR.PURPLE_LIGHT, transparency: 50 },
    line: { type: 'none' },
  });
}

/**
 * 左上 4px 藍直線 + 標題 + 副標
 */
function addTitleBar(slide, title, subtitle) {
  slide.addShape('rect', {
    x: 0.6, y: 0.55, w: 0.06, h: 0.5, fill: { color: COLOR.PRIMARY }, line: { type: 'none' },
  });
  slide.addText(title, {
    x: 0.8, y: 0.4, w: 11, h: 0.6,
    fontSize: 26, bold: true, color: COLOR.TITLE, fontFace: FONT,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.8, y: 1.0, w: 11, h: 0.4,
      fontSize: 14, color: COLOR.TEXT, fontFace: FONT,
    });
  }
}

/**
 * 右上 section tag（小膠囊）
 */
function addSectionTag(slide, num, label) {
  slide.addShape('roundRect', {
    x: SLIDE_W - 2.4, y: 0.45, w: 1.8, h: 0.35,
    fill: { color: COLOR.PRIMARY_LIGHT },
    line: { color: COLOR.PRIMARY, width: 0.5 },
    rectRadius: 0.18,
  });
  slide.addText(`${num} · ${label}`, {
    x: SLIDE_W - 2.4, y: 0.45, w: 1.8, h: 0.35,
    fontSize: 10, color: COLOR.PRIMARY, fontFace: FONT, align: 'center', valign: 'middle',
  });
}

/**
 * 共用內容頁版型
 */
function contentSlide(pres, { title, subtitle, sectionNum, sectionLabel }, draw) {
  const slide = pres.addSlide();
  addContentBackground(slide);
  addTitleBar(slide, title, subtitle);
  if (sectionNum) addSectionTag(slide, sectionNum, sectionLabel);
  draw(slide);
  return slide;
}

// =====================================================
// 各 Slide
// =====================================================

function addCoverSlide(pres, data) {
  const slide = pres.addSlide();
  // 背景：3 段色塊組成大膽封面
  slide.background = { color: COLOR.LIGHT_BG };
  slide.addShape('rect', {
    x: 0, y: 0, w: 5, h: SLIDE_H, fill: { color: COLOR.PRIMARY }, line: { type: 'none' },
  });
  slide.addShape('rect', {
    x: 5, y: 0, w: 0.5, h: SLIDE_H, fill: { color: COLOR.PURPLE }, line: { type: 'none' },
  });
  // 左側白色 brand
  slide.addText('Crescendo Lab', {
    x: 0.6, y: 0.6, w: 4, h: 0.4, fontSize: 14, color: COLOR.WHITE, bold: true, fontFace: FONT,
  });
  slide.addText('漸強實驗室', {
    x: 0.6, y: 6.6, w: 4, h: 0.4, fontSize: 12, color: COLOR.WHITE, fontFace: FONT, transparency: 30,
  });
  // 右側標題
  slide.addText(data.companyName, {
    x: 5.8, y: 2.6, w: 7.2, h: 1.4, fontSize: 44, bold: true, color: COLOR.TITLE, fontFace: FONT,
  });
  slide.addText(data.subtitle || 'LINE 行銷與客服整合規劃', {
    x: 5.8, y: 4.0, w: 7.2, h: 0.7, fontSize: 22, color: COLOR.TEXT, fontFace: FONT,
  });
  // 日期
  const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
  slide.addText(today, {
    x: 5.8, y: 5.0, w: 7.2, h: 0.4, fontSize: 14, color: COLOR.MUTED, fontFace: FONT,
  });
}

function addAgendaSlide(pres, data) {
  contentSlide(pres, { title: '本日議程', subtitle: 'Agenda' }, (slide) => {
    (data.agenda || []).slice(0, 7).forEach((item, i) => {
      const y = 1.8 + i * 0.65;
      // 編號
      slide.addText(String(i + 1).padStart(2, '0'), {
        x: 1.2, y, w: 0.7, h: 0.5,
        fontSize: 22, bold: true, color: COLOR.PRIMARY, fontFace: FONT,
      });
      // 內容
      slide.addText(item, {
        x: 2.1, y, w: 9.5, h: 0.5,
        fontSize: 18, color: COLOR.TITLE, fontFace: FONT, valign: 'middle',
      });
      // 分隔線
      slide.addShape('rect', {
        x: 1.2, y: y + 0.55, w: 10.5, h: 0.01,
        fill: { color: COLOR.BORDER }, line: { type: 'none' },
      });
    });
  });
}

function addSectionDivider(pres, num, title, subtitle) {
  const slide = pres.addSlide();
  slide.background = { color: COLOR.PRIMARY };
  // 大編號浮水印
  slide.addText(num, {
    x: 0.5, y: 0.3, w: 6, h: 6,
    fontSize: 320, bold: true, color: COLOR.WHITE, transparency: 80, fontFace: FONT,
  });
  // 主標
  slide.addText(title, {
    x: 6.5, y: 3.0, w: 6.5, h: 1, fontSize: 44, bold: true, color: COLOR.WHITE, fontFace: FONT,
  });
  // 副標
  slide.addText(subtitle, {
    x: 6.5, y: 4.2, w: 6.5, h: 0.6, fontSize: 18, color: COLOR.WHITE, fontFace: FONT, transparency: 25,
  });
  // 底部裝飾線
  slide.addShape('rect', {
    x: 6.5, y: 4.0, w: 1.2, h: 0.05, fill: { color: COLOR.MINT }, line: { type: 'none' },
  });
}

function addCurrentStateSlide(pres, data) {
  contentSlide(pres, {
    title: data.currentState.title || '客戶現況',
    subtitle: '依會議紀錄整理',
    sectionNum: '01', sectionLabel: '現況',
  }, (slide) => {
    // 數字卡：最多放 4 張
    const stats = (data.currentState.stats || []).slice(0, 4);
    const cardW = 2.8, gap = 0.2;
    const totalW = stats.length * cardW + (stats.length - 1) * gap;
    const startX = (SLIDE_W - totalW) / 2;
    stats.forEach((s, i) => {
      const x = startX + i * (cardW + gap);
      slide.addShape('roundRect', {
        x, y: 1.7, w: cardW, h: 1.6,
        fill: { color: COLOR.WHITE },
        line: { color: COLOR.PRIMARY, width: 1 },
        rectRadius: 0.1,
      });
      slide.addText(s.value || '—', {
        x, y: 1.85, w: cardW, h: 0.8,
        fontSize: 26, bold: true, color: COLOR.PRIMARY, fontFace: FONT, align: 'center', valign: 'middle',
      });
      slide.addText(s.label || '', {
        x, y: 2.7, w: cardW, h: 0.5,
        fontSize: 13, color: COLOR.TEXT, fontFace: FONT, align: 'center', valign: 'middle',
      });
    });
    // bullets
    const bullets = (data.currentState.bullets || []).slice(0, 6);
    bullets.forEach((b, i) => {
      const y = 4 + i * 0.45;
      slide.addShape('ellipse', {
        x: 1.2, y: y + 0.13, w: 0.12, h: 0.12,
        fill: { color: COLOR.PRIMARY }, line: { type: 'none' },
      });
      slide.addText(b, {
        x: 1.45, y, w: 10.5, h: 0.4,
        fontSize: 14, color: COLOR.TEXT, fontFace: FONT, valign: 'middle',
      });
    });
  });
}

function addPainPointsSlide(pres, data) {
  contentSlide(pres, {
    title: '痛點分析', subtitle: '客戶目前面臨的核心挑戰',
    sectionNum: '02', sectionLabel: '痛點',
  }, (slide) => {
    const items = data.painPoints.slice(0, 4);
    items.forEach((p, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.8 + col * 6;
      const y = 1.85 + row * 2.55;
      slide.addShape('roundRect', {
        x, y, w: 5.6, h: 2.3,
        fill: { color: COLOR.WHITE },
        line: { color: COLOR.PURPLE, width: 1 },
        rectRadius: 0.12,
      });
      // 編號圓圈
      slide.addShape('ellipse', {
        x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6,
        fill: { color: COLOR.PURPLE }, line: { type: 'none' },
      });
      slide.addText(String(i + 1), {
        x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6,
        fontSize: 18, bold: true, color: COLOR.WHITE, align: 'center', valign: 'middle', fontFace: FONT,
      });
      slide.addText(p.title || `痛點 ${i + 1}`, {
        x: x + 1.05, y: y + 0.3, w: 4.4, h: 0.5,
        fontSize: 17, bold: true, color: COLOR.PURPLE, fontFace: FONT, valign: 'middle',
      });
      slide.addText(p.description || '', {
        x: x + 0.4, y: y + 1.0, w: 5, h: 1.2,
        fontSize: 12, color: COLOR.TEXT, fontFace: FONT,
      });
    });
  });
}

function addSolutionSlide(pres, data) {
  contentSlide(pres, {
    title: '漸強建議方案', subtitle: '一站式整合行銷 × 客服 × 簡訊 × EDM',
    sectionNum: '03', sectionLabel: '方案',
  }, (slide) => {
    const keys = ['marketing', 'service', 'sms', 'edm'];
    const labels = { marketing: '行銷', service: '客服', sms: '簡訊', edm: 'EDM' };
    const sols = keys.map((k) => ({ key: k, ...(data.solution[k] || {}) })).filter(s => s.title || s.bullets);
    sols.slice(0, 4).forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.8 + col * 6;
      const y = 1.85 + row * 2.55;
      // 主色卡
      slide.addShape('roundRect', {
        x, y, w: 5.6, h: 2.3,
        fill: { color: COLOR.PRIMARY }, line: { type: 'none' }, rectRadius: 0.12,
      });
      // 角標
      slide.addShape('rect', {
        x, y, w: 0.6, h: 0.4, fill: { color: COLOR.PURPLE }, line: { type: 'none' },
      });
      slide.addText(labels[s.key], {
        x, y, w: 0.6, h: 0.4, fontSize: 11, bold: true, color: COLOR.WHITE, align: 'center', valign: 'middle', fontFace: FONT,
      });
      slide.addText(s.title || labels[s.key], {
        x: x + 0.8, y: y + 0.25, w: 4.6, h: 0.5,
        fontSize: 17, bold: true, color: COLOR.WHITE, fontFace: FONT, valign: 'middle',
      });
      const bullets = (s.bullets || []).slice(0, 4).map(b => `• ${b}`).join('\n');
      slide.addText(bullets, {
        x: x + 0.4, y: y + 0.9, w: 5, h: 1.3,
        fontSize: 12, color: COLOR.WHITE, fontFace: FONT,
      });
    });
  });
}

function addTimelineSlide(pres, data) {
  contentSlide(pres, {
    title: '導入時程', subtitle: 'Roadmap',
    sectionNum: '04', sectionLabel: '時程',
  }, (slide) => {
    const items = (data.timeline || []).slice(0, 5);
    const n = items.length || 1;
    const totalW = SLIDE_W - 2; // 兩側各 1 in
    const stepW = totalW / n;
    // 主軸線
    slide.addShape('rect', {
      x: 1.2, y: 3.4, w: SLIDE_W - 2.4, h: 0.04,
      fill: { color: COLOR.BORDER }, line: { type: 'none' },
    });
    items.forEach((t, i) => {
      const x = 1 + i * stepW + stepW / 2;
      // 圓點
      slide.addShape('ellipse', {
        x: x - 0.3, y: 3.1, w: 0.6, h: 0.6,
        fill: { color: COLOR.MINT }, line: { color: COLOR.WHITE, width: 2 },
      });
      slide.addText(String(i + 1), {
        x: x - 0.3, y: 3.1, w: 0.6, h: 0.6,
        fontSize: 16, bold: true, color: COLOR.WHITE, align: 'center', valign: 'middle', fontFace: FONT,
      });
      // 上方：stage
      slide.addText(t.stage || `Phase ${i + 1}`, {
        x: x - 1.1, y: 2.2, w: 2.2, h: 0.4,
        fontSize: 12, bold: true, color: COLOR.PRIMARY, align: 'center', fontFace: FONT,
      });
      // 下方：title
      slide.addText(t.title || '', {
        x: x - 1.1, y: 4.0, w: 2.2, h: 0.6,
        fontSize: 15, color: COLOR.TITLE, align: 'center', fontFace: FONT, valign: 'top',
      });
      // 時間
      slide.addText(t.duration || '', {
        x: x - 1.1, y: 4.7, w: 2.2, h: 0.4,
        fontSize: 12, color: COLOR.MUTED, align: 'center', fontFace: FONT,
      });
    });
  });
}

function addMetricsSlide(pres, data) {
  contentSlide(pres, {
    title: '成功指標', subtitle: 'KPIs',
    sectionNum: '05', sectionLabel: 'KPI',
  }, (slide) => {
    const items = (data.metrics || []).slice(0, 6);
    const n = Math.min(items.length, 3);
    const cardW = 3.4, gap = 0.3;
    items.forEach((m, i) => {
      const col = i % n;
      const row = Math.floor(i / n);
      const totalW = n * cardW + (n - 1) * gap;
      const startX = (SLIDE_W - totalW) / 2;
      const x = startX + col * (cardW + gap);
      const y = 2.0 + row * 2.2;
      slide.addShape('roundRect', {
        x, y, w: cardW, h: 1.9,
        fill: { color: COLOR.WHITE },
        line: { color: COLOR.MINT, width: 1.5 },
        rectRadius: 0.12,
      });
      slide.addText(m.target || '—', {
        x, y: y + 0.2, w: cardW, h: 0.9,
        fontSize: 32, bold: true, color: COLOR.PRIMARY, align: 'center', valign: 'middle', fontFace: FONT,
      });
      slide.addText(m.label || '', {
        x, y: y + 1.1, w: cardW, h: 0.7,
        fontSize: 14, color: COLOR.TEXT, align: 'center', valign: 'middle', fontFace: FONT,
      });
    });
  });
}

function addNextStepsSlide(pres, data) {
  contentSlide(pres, {
    title: '下一步', subtitle: 'Next Steps',
    sectionNum: '06', sectionLabel: '下一步',
  }, (slide) => {
    (data.nextSteps || []).slice(0, 6).forEach((n, i) => {
      const y = 1.9 + i * 0.7;
      slide.addShape('ellipse', {
        x: 1.2, y: y + 0.05, w: 0.4, h: 0.4,
        fill: { color: COLOR.MINT }, line: { type: 'none' },
      });
      slide.addText('✓', {
        x: 1.2, y: y + 0.05, w: 0.4, h: 0.4,
        fontSize: 16, bold: true, color: COLOR.WHITE, align: 'center', valign: 'middle', fontFace: FONT,
      });
      slide.addText(n, {
        x: 1.8, y, w: 10.5, h: 0.5,
        fontSize: 17, color: COLOR.TITLE, fontFace: FONT, valign: 'middle',
      });
    });
  });
}

function addClosingSlide(pres, data) {
  const slide = pres.addSlide();
  slide.background = { color: COLOR.LIGHT_BG };
  slide.addShape('rect', {
    x: 0, y: 3.4, w: SLIDE_W, h: 0.05, fill: { color: COLOR.PRIMARY }, line: { type: 'none' },
  });
  slide.addText('Thank You', {
    x: 0, y: 2.6, w: SLIDE_W, h: 1.0,
    fontSize: 56, bold: true, color: COLOR.TITLE, fontFace: FONT, align: 'center',
  });
  slide.addText(`期待與 ${data.companyName} 攜手成長`, {
    x: 0, y: 3.7, w: SLIDE_W, h: 0.6,
    fontSize: 18, color: COLOR.TEXT, fontFace: FONT, align: 'center',
  });
  slide.addText('Crescendo Lab · 漸強實驗室', {
    x: 0, y: 4.5, w: SLIDE_W, h: 0.5,
    fontSize: 14, color: COLOR.PRIMARY, bold: true, fontFace: FONT, align: 'center',
  });
}

// =====================================================
// 上傳到 Drive 並轉成 Google Slides
// =====================================================

/**
 * @param {Buffer} buffer pptx buffer
 * @param {Object} tokens  使用者 OAuth tokens
 * @param {string} fileName
 * @returns {Promise<{id:string, webViewLink:string}>}
 */
export async function uploadAsGoogleSlides(buffer, tokens, fileName) {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2.setCredentials(tokens);
  const drive = google.drive({ version: 'v3', auth: oauth2 });

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: 'application/vnd.google-apps.presentation',
      parents: process.env.GOOGLE_DRIVE_FOLDER_ID ? [process.env.GOOGLE_DRIVE_FOLDER_ID] : undefined,
    },
    media: {
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      body: Readable.from(buffer),
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  if (process.env.COMPANY_DOMAIN) {
    try {
      await drive.permissions.create({
        fileId: res.data.id,
        requestBody: { role: 'reader', type: 'domain', domain: process.env.COMPANY_DOMAIN },
        supportsAllDrives: true,
      });
    } catch (e) {
      console.warn('domain share failed (個人帳號限制？)：', e.message);
    }
  }

  return res.data;
}
