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
 * Fireflies API 的 `transcripts` query 支援 `fromDate`、`toDate`、`limit`、`title`
 */
export async function listMeetings({ fromDate, toDate, limit = 25, keyword }) {
  const query = `
    query Transcripts($fromDate: DateTime, $toDate: DateTime, $limit: Int, $title: String) {
      transcripts(fromDate: $fromDate, toDate: $toDate, limit: $limit, title: $title) {
        id
        title
        date
        duration
        meeting_attendees { displayName email }
        organizer_email
      }
    }
  `;
  const data = await gql(query, {
    fromDate,
    toDate,
    limit,
    title: keyword || undefined,
  });
  return data.transcripts;
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
