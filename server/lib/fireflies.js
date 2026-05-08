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
 * 注意：
 * 1. Fireflies 的 `title` GraphQL 參數實測是 exact match，對使用者沒幫助 —
 *    改成 server 端 case-insensitive substring 比對。
 * 2. Fireflies API 硬限制 limit ≤ 50，且總是回最新的，所以高頻用戶
 *    很容易讓「想找的會議」掉在 50 筆之外 —
 *    用 `skip` 平行分頁掃 5 批（最多 250 筆）增加命中率。
 */
const QUERY = `
  query Transcripts($fromDate: DateTime, $toDate: DateTime, $limit: Int, $skip: Int) {
    transcripts(fromDate: $fromDate, toDate: $toDate, limit: $limit, skip: $skip) {
      id
      title
      date
      duration
      meeting_attendees { displayName email }
      organizer_email
    }
  }
`;

const PAGE_SIZE = 50;
const SCAN_PAGES_WITH_KEYWORD = 5; // 有 keyword 時掃 5×50 = 250 筆

export async function listMeetings({ fromDate, toDate, limit = 50, keyword }) {
  const k = keyword?.trim().toLowerCase();

  if (!k) {
    // 沒 keyword：拿最新一批就好
    const data = await gql(QUERY, { fromDate, toDate, limit: Math.min(limit, PAGE_SIZE), skip: 0 });
    return data.transcripts || [];
  }

  // 有 keyword：平行掃多頁（每頁 50），合併後 substring filter
  const requests = [];
  for (let i = 0; i < SCAN_PAGES_WITH_KEYWORD; i++) {
    requests.push(
      gql(QUERY, { fromDate, toDate, limit: PAGE_SIZE, skip: i * PAGE_SIZE })
        .catch(() => ({ transcripts: [] })) // 單頁失敗不要拖累全部
    );
  }
  const batches = await Promise.all(requests);
  const all = batches.flatMap((d) => d.transcripts || []);
  // 去重（萬一分頁邊界重疊）
  const seen = new Set();
  const matches = all.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return (m.title || '').toLowerCase().includes(k);
  });
  return matches.slice(0, limit);
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
