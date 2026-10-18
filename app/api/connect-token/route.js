import { NextResponse } from 'next/server';
import { pluggy, pluggyConfigured } from '../../../lib/pluggy';

export async function POST(request) {
  if (!pluggyConfigured()) return NextResponse.json({ erro: 'Cadastre PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET nas variáveis de ambiente da Vercel.' }, { status: 500 });
  const { itemId } = await request.json().catch(() => ({}));
  try {
    const { accessToken } = await pluggy().createConnectToken(itemId || undefined, { clientUserId: 'financeiro', avoidDuplicates: true });
    return NextResponse.json({ accessToken, sandbox: process.env.PLUGGY_SANDBOX === '1' });
  } catch (e) {
    return NextResponse.json({ erro: 'A Pluggy recusou o pedido: ' + (e?.message ?? e) }, { status: 502 });
  }
}
