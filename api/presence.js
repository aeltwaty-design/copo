// Ephemeral presence store for live multiplayer cursors.
//
// POST /api/presence  body { writerId, name, emoji, color, x, y, active }
//   -> upserts this user's cursor with a short TTL, then returns every current
//      cursor: { cursors: [ { writerId, name, emoji, color, x, y, active, ts } ] }.
//      One request both publishes mine and fetches everyone else's.
// GET  /api/presence   -> { cursors: [...] } (debugging).
//
// Persistence is Upstash Redis over REST (plain fetch, no SDK) — the same store
// and env vars as api/board.js. Each cursor is its own key with an 8s TTL, so a
// user who leaves or goes idle auto-expires. When the KV env vars are absent
// (local `npm run dev`), an in-memory Map (pruned by timestamp) is used instead.
//
// Presence is throwaway: nothing here is ever written to the durable board.

const PREFIX = 'copo:presence:';
const TTL_S = 8;                 // Redis key expiry
const TTL_MS = TTL_S * 1000;     // in-memory prune window

const kvUrl = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const kvToken = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const hasKV = () => Boolean(kvUrl() && kvToken());

// Local-dev fallback store: writerId -> cursor object (with ts).
const mem = new Map();

async function redis(command) {
  const resp = await fetch(kvUrl(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${kvToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!resp.ok) throw new Error(`Upstash ${resp.status}`);
  const data = await resp.json();
  return data.result;
}

async function listCursors() {
  if (!hasKV()) {
    const now = Date.now();
    const out = [];
    for (const [id, cur] of mem) {
      if (now - cur.ts > TTL_MS) mem.delete(id);
      else out.push(cur);
    }
    return out;
  }
  // Enumerate all presence keys (SCAN loop), then MGET their values.
  const keys = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis(['SCAN', cursor, 'MATCH', PREFIX + '*', 'COUNT', 200]);
    cursor = next;
    if (batch && batch.length) keys.push(...batch);
  } while (cursor !== '0');
  if (!keys.length) return [];
  const values = await redis(['MGET', ...keys]);
  return values
    .filter(Boolean)
    .map((v) => { try { return JSON.parse(v); } catch { return null; } })
    .filter(Boolean);
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST' || req.method === 'PUT') {
      const { writerId, name, emoji, color, x, y, active } = req.body || {};
      if (!writerId) {
        res.status(400).json({ ok: false, error: 'writerId required' });
        return;
      }
      const cur = {
        writerId,
        name: String(name || 'Guest').slice(0, 40),
        emoji: String(emoji || '🐣').slice(0, 8),
        color: String(color || '#7fe8f2').slice(0, 16),
        x: Number(x) || 0,
        y: Number(y) || 0,
        active: active !== false,
        ts: Date.now(),
      };
      if (hasKV()) {
        await redis(['SET', PREFIX + writerId, JSON.stringify(cur), 'EX', TTL_S]);
      } else {
        mem.set(writerId, cur);
      }
      res.status(200).json({ cursors: await listCursors() });
      return;
    }

    if (req.method === 'GET') {
      res.status(200).json({ cursors: await listCursors() });
      return;
    }

    res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ ok: false, error: String((err && err.message) || err) });
  }
}
