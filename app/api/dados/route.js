import { NextResponse } from 'next/server';
import { dadosEmCache } from '../../../lib/dados';
import { COOKIE_ITENS, idsDoCookie, pluggyConfigured } from '../../../lib/pluggy';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  if (!pluggyConfigured()) return NextResponse.json({ erro: 'Cadastre PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET nas variáveis de ambiente da Vercel.' }, { status: 500 });
  try {
    const fresco = new URL(request.url).searchParams.has('fresco');
    const extras = idsDoCookie(request.cookies.get(COOKIE_ITENS)?.value);
    const dados = await dadosEmCache({ fresco, extras });
    return NextResponse.json(dados, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ erro: 'Não consegui falar com a Pluggy: ' + (e?.message ?? e) }, { status: 502 });
  }
}
