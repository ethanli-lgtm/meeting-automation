// server/lib/fireflies.js
// Fireflies GraphQL：列出會議、抓單場逐字稿

const FIREFLIES_URL = 'https://api.fireflies.ai/graphql';

async function gql(query, variables = {}) {
  const res = await fetch(FIREFLIES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.FIREFLIES_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error('Fireflies error: ' + JSON.stringify(json.errors));
  }
  return json.data;
}

/**
 * 列出最近會議。可加日期過濾或關鍵字。
 *
 * 注意：Fireflies 的 `title` GraphQL 參數實測是 **exact match**（連完整字串都對不上），
 * 對使用者沒幫助。這裡改成：用日期範圍從 Fireflies 拿一批回來，server 端再做
 * case-insensitive 的 substring 比對。有 keyword 時自動把 limit 拉大避免漏抓。
 */
export async function listMeetings({ fromDate, toDate, limit = 50, keyword }) {
  // Fireflies API 硬限制 limit ≤ 50
  const fetchLimit = Math.min(limit, 50);
  const query = `
    query Transcripts($fromDate: DateTime, $toDate: DateTime, $limit: Int) {
      transcripts(fromDate: $fromDate, toDate: $toDate, limit: $limit) {
        id
        title
        date
        duration
        meeting_attendees { displayName email }
        organizer_email
      }
    }
  `;
  const data = await gql(query, { fromDate, toDate, limit: fetchLimit });
  let list = data.transcripts || [];

  if (keyword?.trim()) {
    const k = keyword.trim().toLowerCase();
    list = list.filter((m) => (m.title || '').toLowerCase().includes(k));
  }
  return list.slice(0, limit);
}

/**
 * 抓單場會議完整逐字稿（含每句 speaker）
 */
export async function getTranscript(transcriptId) {
  const query = `
    query Transcript($transcriptId: String!) {
      transcript(id: $transcriptId) {
        id
        title
        date
        sentences {
          text
          speaker_name
          start_time
        }
        summary {
          overview
          action_items
        }
      }
    }
  `;
  const data = await gql(query, { transcriptId });
  return data.transcript;
}

/**
 * 一次抓多場（用 Promise.all）
 */
export async function getTranscripts(ids) {
  return Promise.all(ids.map(getTranscript));
}
