import { NextResponse } from 'next/server';
import { COOKIE, validSession } from './lib/session';

// Everything except the login page, the daily job and static assets needs a session.
export async function proxy(request) {
  if (await validSession(request.cookies.get(COOKIE)?.value)) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith('/api/')) return NextResponse.json({ erro: 'Faça login.' }, { status: 401 });
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!login|api/login|api/cron|_next/|icon|apple-icon|manifest.webmanifest|favicon.ico).*)'],
};
