// Shared board store for near-live collaboration.
//
// GET  /api/board  -> the current shared board { version, items, wires, idc, writerId, updatedAt }
//                    (or { version: 0, items: null } if it has never been written).
// PUT  /api/board  -> replace the shared board (whole-board last-write-wins); body
//                    { items, wires, idc, writerId }. Bumps a monotonic version and
//                    returns { ok, version }.
//
// Persistence is Upstash Redis over its REST API (plain fetch, no SDK, no build step),
// matching the Web-standard-only style of lib/session.js. When the KV env vars are
// absent (local `npm run dev`), it falls back to an in-memory store — the dev server is
// one long-lived process, so multi-tab local testing works without an Upstash account.
//
// Auth is inherited: middleware.js gates /api/board behind the copo_session cookie, and
// the Upstash token stays server-side and never reaches the browser.

const BOARD_KEY = 'copo:board';
const VERSION_KEY = 'copo:version';

const kvUrl = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const kvToken = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const hasKV = () => Boolean(kvUrl() && kvToken());

// Local-dev fallback store (module-scoped, lives for the dev server process).
const mem = { board: null, version: 0 };

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

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const raw = hasKV() ? await redis(['GET', BOARD_KEY]) : mem.board;
      if (!raw) {
        res.status(200).json({ version: 0, items: null });
        return;
      }
      const blob = typeof raw === 'string' ? JSON.parse(raw) : raw;
      res.status(200).json(blob);
      return;
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const { items, wires, idc, writerId } = req.body || {};
      if (!Array.isArray(items)) {
        res.status(400).json({ ok: false, error: 'items array required' });
        return;
      }
      const base = {
        items,
        wires: Array.isArray(wires) ? wires : [],
        idc: Number(idc) || 0,
        writerId: writerId || null,
        updatedAt: Date.now(),
      };
      let version;
      if (hasKV()) {
        version = await redis(['INCR', VERSION_KEY]);
        await redis(['SET', BOARD_KEY, JSON.stringify({ ...base, version })]);
      } else {
        version = ++mem.version;
        mem.board = { ...base, version };
      }
      res.status(200).json({ ok: true, version });
      return;
    }

    res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ ok: false, error: String((err && err.message) || err) });
  }
}
