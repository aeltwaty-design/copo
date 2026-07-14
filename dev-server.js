// Local-only dev server that emulates Vercel's static + api/ + middleware.js
// pipeline by importing the real production modules directly — so `node
// --env-file=.env dev-server.js` exercises the exact same auth code that
// runs on Vercel, no reimplementation to keep in sync.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import middleware, { config as middlewareConfig } from './middleware.js';
import loginHandler from './api/login.js';
import logoutHandler from './api/logout.js';
import boardHandler from './api/board.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4173;

// Vercel itself only invokes middleware for paths matching config.matcher —
// excluded paths (login.html, api/login) never reach the function at all.
// Replicate that here so the dev server behaves the same way.
const matcherRes = (middlewareConfig.matcher || []).map((p) => new RegExp('^' + p + '$'));
function matchesMiddleware(pathname) {
  return matcherRes.some((re) => re.test(pathname));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

function toWebRequest(req) {
  const url = `http://${req.headers.host}${req.url}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  }
  return new Request(url, { method: req.method, headers });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function wrapRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
  };
  return res;
}

const server = http.createServer(async (req, res) => {
  wrapRes(res);
  const urlPath = req.url.split('?')[0];

  try {
    if (urlPath === '/api/login' && req.method === 'POST') {
      const raw = await readBody(req);
      try { req.body = JSON.parse(raw.toString() || '{}'); } catch { req.body = {}; }
      await loginHandler(req, res);
      return;
    }
    if (urlPath === '/api/logout') {
      await logoutHandler(req, res);
      return;
    }
    if (urlPath === '/api/board') {
      if (req.method === 'PUT' || req.method === 'POST') {
        const raw = await readBody(req);
        try { req.body = JSON.parse(raw.toString() || '{}'); } catch { req.body = {}; }
      }
      await boardHandler(req, res);
      return;
    }

    if (matchesMiddleware(urlPath)) {
      const mwResult = await middleware(toWebRequest(req));
      if (mwResult) {
        res.statusCode = mwResult.status;
        res.setHeader('Location', mwResult.headers.get('location'));
        res.end();
        return;
      }
    }

    let filePath = urlPath === '/' ? '/index.html' : urlPath;
    filePath = path.join(__dirname, decodeURIComponent(filePath));
    if (!filePath.startsWith(__dirname)) { res.statusCode = 403; res.end('Forbidden'); return; }
    const data = await fs.readFile(filePath);
    res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT') { res.statusCode = 404; res.end('Not found'); return; }
    res.statusCode = 500;
    res.end('Server error: ' + err.message);
  }
});

server.listen(PORT, () => {
  console.log(`Dev server (with auth) running at http://localhost:${PORT}`);
});
