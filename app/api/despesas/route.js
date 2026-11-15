import { NextResponse } from 'next/server';
import { kvConfigured, kvGet, kvSet } from '../../../lib/kv';

const CHAVE = 'despesas-fixas';

// Without a store configured the painel keeps the list in the browser instead.
export async function GET() {
  if (!kvConfigured()) return NextResponse.json({ armazenamento: 'aparelho', despesas: [] });
  try {
    return NextResponse.json({ armazenamento: 'servidor', despesas: (await kvGet(CHAVE)) ?? [] });
  } catch (e) {
    return NextResponse.json({ erro: 'Não consegui ler as despesas fixas: ' + (e?.message ?? e) }, { status: 502 });
  }
}

export async function PUT(request) {
  if (!kvConfigured()) return NextResponse.json({ erro: 'Armazenamento não configurado.' }, { status: 409 });
  const body = await request.json().catch(() => ({}));
  if (!Array.isArray(body.despesas) || body.despesas.length > 300) return NextResponse.json({ erro: 'Lista inválida.' }, { status: 400 });
  const despesas = body.despesas.map(limpar).filter(Boolean);
  try {
    await kvSet(CHAVE, despesas);
    return NextResponse.json({ armazenamento: 'servidor', despesas });
  } catch (e) {
    return NextResponse.json({ erro: 'Não consegui salvar: ' + (e?.message ?? e) }, { status: 502 });
  }
}

const texto = (v, max) => String(v ?? '').trim().slice(0, max);

function limpar(d) {
  const valor = Number(d?.valor);
  const nome = texto(d?.nome, 80);
  if (!nome || !Number.isFinite(valor) || valor < 0) return null;
  return {
    id: texto(d.id, 40) || crypto.randomUUID(),
    nome,
    valor: Math.round(valor * 100) / 100,
    dia: Math.min(31, Math.max(1, Math.round(Number(d.dia) || 1))),
    categoria: texto(d.categoria, 40) || 'Outros',
    origem: ['Conta', 'Cartão'].includes(d.origem) ? d.origem : '',
    termo: texto(d.termo, 60),
    pagas: (Array.isArray(d.pagas) ? d.pagas : []).filter((m) => /^\d{4}-\d{2}$/.test(m)).slice(-36),
  };
}
