// Signed, expiring session tokens using Web Crypto — runs unchanged on both
// Vercel's Node serverless runtime (api/*.js) and the Edge runtime (middleware.js).
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toB64Url(bytes) {
  let str = '';
  bytes.forEach(b => { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign', 'verify']
  );
}

export async function signSession(secret, maxAgeMs) {
  const exp = Date.now() + maxAgeMs;
  const payload = toB64Url(encoder.encode(String(exp)));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
  return payload + '.' + toB64Url(sig);
}

export async function verifySession(secret, token) {
  if (!secret || !token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  let sigBytes;
  try { sigBytes = fromB64Url(sig); } catch { return false; }
  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payload));
  if (!valid) return false;
  const exp = Number(decoder.decode(fromB64Url(payload)));
  return Number.isFinite(exp) && Date.now() < exp;
}
