import { NextResponse } from 'next/server';
import { COOKIE, checkPassword, createSession } from '../../../lib/session';

export async function POST(request) {
  if (!process.env.APP_PASSWORD) return NextResponse.json({ erro: 'Cadastre APP_PASSWORD nas variáveis de ambiente da Vercel.' }, { status: 500 });
  const { senha } = await request.json().catch(() => ({}));
  if (!(await checkPassword(senha))) {
    await new Promise((r) => setTimeout(r, 800)); // slows down guessing
    return NextResponse.json({ erro: 'Senha incorreta.' }, { status: 401 });
  }
  const { value, maxAge } = await createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, value, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge });
  return res;
}
