// server/lib/claude.js
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * 通用呼叫：回傳純文字
 */
export async function generateText(prompt, { model = 'claude-sonnet-4-6', maxTokens = 4000 } = {}) {
  const msg = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  // 拼接所有 text block
  return msg.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

/**
 * 要求結構化 JSON 輸出。會自動把 ```json fence 拆掉
 */
export async function generateJSON(prompt, opts = {}) {
  const text = await generateText(prompt, { maxTokens: 6000, ...opts });
  // 移除可能的 markdown fence
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('JSON parse failed. Raw output:', text);
    throw new Error('Claude 沒回合法 JSON：' + e.message);
  }
}
