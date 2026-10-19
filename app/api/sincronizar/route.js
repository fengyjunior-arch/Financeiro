import { NextResponse } from 'next/server';
import { COOKIE_ITENS, idsDoCookie, listItems, pluggy, pluggyConfigured } from '../../../lib/pluggy';
import { limparCache } from '../../../lib/dados';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const EM_ANDAMENTO = new Set(['UPDATING', 'MERGING']);
const resumo = (i, erro) => ({ id: i.id, banco: i.connector?.name ?? 'Banco', status: i.status, sincronizadoEm: i.lastUpdatedAt ?? null, ...(erro ? { erro } : {}) });

// GET: where each bank connection's sync stands. POST: asks Pluggy to fetch fresh data from the bank now.
export async function GET(request) {
  if (!pluggyConfigured()) return NextResponse.json({ erro: 'Pluggy não configurada.' }, { status: 500 });
  const items = await listItems(idsDoCookie(request.cookies.get(COOKIE_ITENS)?.value));
  const bancos = items.map((i) => resumo(i));
  return NextResponse.json({ bancos, emAndamento: bancos.some((b) => EM_ANDAMENTO.has(b.status)) });
}

export async function POST(request) {
  if (!pluggyConfigured()) return NextResponse.json({ erro: 'Pluggy não configurada.' }, { status: 500 });
  const items = await listItems(idsDoCookie(request.cookies.get(COOKIE_ITENS)?.value));
  const bancos = await Promise.all(items.map(async (i) => {
    if (EM_ANDAMENTO.has(i.status)) return resumo(i);
    try {
      return resumo(await pluggy().updateItem(i.id));
    } catch (e) {
      return resumo(i, String(e?.message ?? e));
    }
  }));
  limparCache();
  return NextResponse.json({ bancos, emAndamento: bancos.some((b) => EM_ANDAMENTO.has(b.status)) });
}
