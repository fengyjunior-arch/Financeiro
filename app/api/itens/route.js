import { NextResponse } from 'next/server';
import { COOKIE_ITENS, idsDoCookie, pluggy } from '../../../lib/pluggy';

// Remembers a bank connection made in the Pluggy widget on this device until its id is saved in Vercel.
export async function POST(request) {
  const { itemId } = await request.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/i.test(itemId ?? '')) return NextResponse.json({ erro: 'Código de conexão inválido.' }, { status: 400 });
  try {
    await pluggy().fetchItem(itemId);
  } catch (e) {
    return NextResponse.json({ erro: 'A Pluggy não encontrou essa conexão: ' + (e?.message ?? e) }, { status: 404 });
  }
  const ids = [...new Set([...idsDoCookie(request.cookies.get(COOKIE_ITENS)?.value), itemId])];
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_ITENS, ids.join(','), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
  return res;
}
