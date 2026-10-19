import { NextResponse } from 'next/server';
import { eMeuPluggy, pluggy, listItems, pluggyConfigured } from '../../../lib/pluggy';
import { limparCache } from '../../../lib/dados';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Called once a day by Vercel Cron (see vercel.json). Asks Pluggy to refresh each bank connection.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
  if (!pluggyConfigured()) return NextResponse.json({ erro: 'Pluggy não configurada.' }, { status: 500 });
  const resultado = [];
  // Only connections saved in PLUGGY_ITEM_IDS are refreshed here; the job has no browser cookie.
  for (const item of await listItems()) {
    if (eMeuPluggy(item)) { resultado.push({ banco: item.connector?.name, status: 'sincroniza sozinho' }); continue; }
    try {
      const atualizado = await pluggy().updateItem(item.id);
      resultado.push({ banco: item.connector?.name, status: atualizado.status });
    } catch (e) {
      // Open Finance connections also sync on Pluggy's own schedule, so a refused update is not fatal.
      resultado.push({ banco: item.connector?.name, erro: String(e?.message ?? e) });
    }
  }
  limparCache();
  return NextResponse.json({ ok: true, resultado });
}
