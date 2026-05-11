// server/lib/gemini.js
// Gemini API helper — 取代原本的 Claude API。
// 用 @google/generative-ai SDK。Key 從 https://aistudio.google.com/apikey 拿。
//
// 進階：要走公司 GCP / Vertex AI 計費，可改用 @google-cloud/vertexai
// （初始化方式不同，但 generateContent 的呼叫介面幾乎一樣）

import { GoogleGenerativeAI } from '@google/generative-ai';

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 模型選擇：
// - gemini-2.5-pro：品質最高、最會跟複雜指令，用在我們所有 prompt
// - gemini-2.5-flash：快 & 便宜，但中文細節/結構化輸出穩定性差一階
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';

/**
 * 通用呼叫：回傳純文字。
 */
export async function generateText(prompt, { maxOutputTokens = 4000 } = {}) {
  const model = genai.getGenerativeModel({
    model: MODEL,
    generationConfig: { maxOutputTokens, temperature: 0.4 },
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * 要求結構化 JSON 輸出。
 * 用 Gemini 內建的 responseMimeType=application/json，比 Claude 純 prompt 約束更穩。
 */
export async function generateJSON(prompt, { maxOutputTokens = 8000 } = {}) {
  const model = genai.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      maxOutputTokens,
      temperature: 0.4,
      responseMimeType: 'application/json',
    },
  });
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    // 萬一還是夾了 markdown fence，清一下再 parse
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      console.error('JSON parse failed. Raw output:', text);
      throw new Error('Gemini 沒回合法 JSON：' + e2.message);
    }
  }
}
