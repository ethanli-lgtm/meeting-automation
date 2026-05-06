// server/lib/extract.js
// 從上傳檔案抽純文字。支援 .txt / .md / .pdf / .docx，其他類型回空字串。

import path from 'node:path';

/**
 * @param {{ originalname: string, mimetype: string, buffer: Buffer }} file
 * @returns {Promise<string>}
 */
export async function extractText(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype || '';

  // 純文字
  if (ext === '.txt' || ext === '.md' || mime.startsWith('text/')) {
    return file.buffer.toString('utf-8');
  }

  // PDF
  if (ext === '.pdf' || mime === 'application/pdf') {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(file.buffer);
    return result.text || '';
  }

  // DOCX
  if (ext === '.docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value || '';
  }

  // 不支援的格式直接略過
  console.warn(`[extract] 略過不支援的檔案：${file.originalname} (${mime})`);
  return '';
}

/**
 * 把多個檔案的文字組合，每個檔案前加標題
 */
export async function extractMany(files) {
  if (!files?.length) return '';
  const parts = await Promise.all(files.map(async (f) => {
    const text = await extractText(f);
    if (!text.trim()) return '';
    return `===== 補充檔案：${f.originalname} =====\n${text.trim()}`;
  }));
  return parts.filter(Boolean).join('\n\n');
}
