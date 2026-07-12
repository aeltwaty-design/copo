import { signSession } from '../lib/session.js';

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const { username, password } = req.body || {};
  const validUser = process.env.AUTH_USER;
  const validPass = process.env.AUTH_PASS;
  const secret = process.env.AUTH_SECRET;

  if (!validUser || !validPass || !secret) {
    res.status(500).json({ ok: false, error: 'Auth is not configured on the server' });
    return;
  }

  if (username !== validUser || password !== validPass) {
    res.status(401).json({ ok: false, error: 'Invalid username or password' });
    return;
  }

  const token = await signSession(secret, MAX_AGE_MS);
  res.setHeader(
    'Set-Cookie',
    `copo_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.floor(MAX_AGE_MS / 1000)}`
  );
  res.status(200).json({ ok: true });
}
