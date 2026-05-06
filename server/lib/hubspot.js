// server/lib/hubspot.js
// 把生成的文字同步到 HubSpot Deal 的 Notes
// 使用 HubSpot 官方 SDK

import { Client } from '@hubspot/api-client';

const hubspot = new Client({ accessToken: process.env.HUBSPOT_TOKEN });

/**
 * 搜尋 deal（給前端 autocomplete 用）
 * 用 deal name 模糊搜尋
 */
export async function searchDeals(query) {
  const res = await hubspot.crm.deals.searchApi.doSearch({
    query, // 名稱關鍵字
    limit: 10,
    properties: ['dealname', 'amount', 'dealstage', 'closedate'],
  });
  return res.results.map((d) => ({
    id: d.id,
    name: d.properties.dealname,
    amount: d.properties.amount,
    stage: d.properties.dealstage,
  }));
}

/**
 * 在 deal 上建立一個 Note，並把 note 與 deal 關聯
 *
 * HubSpot 的 Notes 屬於 Engagements V3，建立時要傳：
 *   - properties.hs_note_body（HTML）
 *   - properties.hs_timestamp（必要）
 *   - associations 指向 deal（associationTypeId 214 = note→deal）
 */
export async function createNoteOnDeal({ dealId, content, title }) {
  // 把純文字（含換行）轉成 HTML
  const body =
    (title ? `<h3>${escapeHtml(title)}</h3>` : '') +
    content
      .split('\n')
      .map((line) => `<p>${escapeHtml(line) || '&nbsp;'}</p>`)
      .join('');

  const note = await hubspot.crm.objects.notes.basicApi.create({
    properties: {
      hs_note_body: body,
      hs_timestamp: Date.now().toString(),
    },
    associations: [
      {
        to: { id: dealId },
        types: [
          {
            associationCategory: 'HUBSPOT_DEFINED',
            associationTypeId: 214, // Note → Deal
          },
        ],
      },
    ],
  });
  return note;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
