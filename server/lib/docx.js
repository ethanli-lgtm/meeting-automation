// server/lib/docx.js
// 用 docx 套件把報告書 JSON 組成 .docx Buffer

import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  AlignmentType,
} from 'docx';

const BRAND_BLUE = '5090FF';
const TEXT_DARK = '334155';

/**
 * @param {Object} data - reportPrompt 產出的 JSON
 * @returns {Promise<Buffer>}
 */
export async function generateReportDocx(data) {
  const children = [];

  // 封面
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${data.companyName} 規劃報告書`,
          bold: true,
          size: 48,
          color: BRAND_BLUE,
        }),
      ],
      spacing: { before: 1200, after: 400 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'Crescendo Lab × ' + data.companyName, size: 28, color: TEXT_DARK }),
      ],
      spacing: { after: 1600 },
    })
  );

  // Executive Summary
  children.push(
    h1('專案摘要'),
    p(data.executiveSummary)
  );

  // 各章節
  section(children, data.currentState);
  section(children, data.painPoints);
  section(children, data.objectives);

  // Solution（4 個子段）
  children.push(h1(data.solution?.title || '漸強建議方案'));
  if (data.solution) {
    children.push(h2('行銷面'));
    (data.solution.marketing || []).forEach((b) => children.push(bullet(b)));
    children.push(h2('客服面'));
    (data.solution.service || []).forEach((b) => children.push(bullet(b)));
    children.push(h2('簡訊面'));
    (data.solution.sms || []).forEach((b) => children.push(bullet(b)));
    children.push(h2('EDM 面'));
    (data.solution.edm || []).forEach((b) => children.push(bullet(b)));
  }

  // Roadmap
  children.push(h1('導入時程'));
  (data.roadmap || []).forEach((phase) => {
    children.push(h2(`${phase.phase}（${phase.duration || ''}）`));
    (phase.tasks || []).forEach((t) => children.push(bullet(t)));
  });

  // Metrics
  children.push(h1('成功指標'));
  (data.successMetrics || []).forEach((m) => children.push(bullet(m)));

  // Next Steps
  children.push(h1('下一步'));
  (data.nextSteps || []).forEach((n) => children.push(bullet(n)));

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Noto Sans TC', size: 22 } },
      },
    },
    sections: [{ children }],
  });

  return await Packer.toBuffer(doc);
}

// --- helpers ---
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 600, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, color: BRAND_BLUE })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: TEXT_DARK })],
  });
}
function p(text) {
  return new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({ text: text || '', size: 22 })],
  });
}
function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    children: [new TextRun({ text: text || '', size: 22 })],
  });
}
function section(children, sec) {
  if (!sec) return;
  children.push(h1(sec.title));
  (sec.items || []).forEach((it) => children.push(bullet(it)));
}
