import { verifySession } from './lib/session.js';

export const config = {
  matcher: ['/((?!api/login|login.html|favicon.ico).*)'],
};

function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  const match = header.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export default async function middleware(request) {
  const secret = process.env.AUTH_SECRET;
  const cookie = getCookie(request, 'copo_session');
  const ok = await verifySession(secret, cookie);
  if (ok) return; // let the request through to static hosting

  const loginUrl = new URL('/login.html', request.url);
  const requestedPath = new URL(request.url).pathname;
  if (requestedPath !== '/') loginUrl.searchParams.set('next', requestedPath);
  return Response.redirect(loginUrl, 307);
}
