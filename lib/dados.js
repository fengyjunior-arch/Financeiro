import { pluggy, listItems, fetchAllPages, idsFixos } from './pluggy';
import { categoria } from './categorias';

// Pulls every connected account from Pluggy and shapes it into the rows the painel draws:
//   transacoes: { id, data, mes, origem: 'Conta'|'Cartão', tipo, categoria, descricao, valor, fatura }
//   saldo:      { data, saldo }   checking balance at the end of each day with movement
//   investimentos / movimentos: positions and their applications/redemptions

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dia = (d) => (d instanceof Date ? d.toISOString() : String(d ?? '')).slice(0, 10);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (v) => Math.round(v * 100) / 100;
const soDigitos = (s) => String(s ?? '').replace(/\D/g, '');
const normNome = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

const RE_FATURA = /PGTO\.? ?FAT|PAGAMENTO (DE )?FATURA|PAG\.? FATURA|PAGTO\.? FATURA|PAGAMENTO RECEBIDO|PAGAMENTO EFETUADO/i;
const RE_INVEST = /APLICA[CÇ][AÃ]O|RESGATE|\bCDB\b|\bRDB\b|\bLCI\b|\bLCA\b|TESOURO|INVESTIMENTO/i;

function mesesAtras(n) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n, 1);
  return d.toISOString().slice(0, 10);
}

function tipoConta(t, dono) {
  const cat = t.category ?? '';
  const credito = t.type === 'CREDIT';
  const desc = t.description ?? '';
  if (/credit card payment/i.test(cat) || RE_FATURA.test(desc)) return 'Pagamento de fatura';
  if (/^(investments?|automatic investment|fixed income|mutual funds|variable income)$/i.test(cat) || RE_INVEST.test(desc)) return credito ? 'Resgate' : 'Investimento';
  const outro = credito ? t.paymentData?.payer : t.paymentData?.receiver;
  const doc = soDigitos(outro?.documentNumber?.value);
  const mesmaPessoa = /same person transfer/i.test(cat)
    || (doc && dono.docs.has(doc))
    || (outro?.name && dono.nomes.has(normNome(outro.name)));
  if (mesmaPessoa) return credito ? 'Transferência recebida' : 'Transferência enviada';
  return credito ? 'Entrada' : 'Gasto';
}

function rotuloFatura(due) {
  if (!due) return '';
  const d = dia(due);
  return 'Fatura ' + MESES_CURTOS[Number(d.slice(5, 7)) - 1] + '/' + d.slice(2, 4);
}

function taxaTexto(inv) {
  const rt = String(inv.rateType ?? '').toUpperCase();
  const fmt = (v) => num(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  if (rt === 'CDI' || rt === 'SELIC') {
    const base = inv.rate ? fmt(inv.rate) + '% do ' + rt : rt;
    return inv.fixedAnnualRate ? rt + ' + ' + fmt(inv.fixedAnnualRate) + '% a.a.' : base;
  }
  if (rt && rt !== 'PRE' && rt !== 'PRÉ') return rt + (inv.fixedAnnualRate ? ' + ' + fmt(inv.fixedAnnualRate) + '% a.a.' : '');
  if (inv.fixedAnnualRate || inv.rate) return 'Pré ' + fmt(inv.fixedAnnualRate ?? inv.rate) + '% a.a.';
  return inv.name ?? 'Investimento';
}

function indexador(inv) {
  const rt = String(inv.rateType ?? '').toUpperCase();
  if (rt === 'CDI' || rt === 'SELIC') return 'CDI';
  if (rt === 'IPCA') return 'IPCA';
  if (!rt || rt === 'PRE' || rt === 'PRÉ') return inv.type === 'FIXED_INCOME' ? 'Pré' : 'Outros';
  return 'Outros';
}

// Annual rate: what the bank reports for the last 12 months, else derived from profit since purchase.
function taxaAnual(inv, bruto, aplicado) {
  if (inv.lastTwelveMonthsRate) return inv.lastTwelveMonthsRate / 100;
  if (inv.annualRate) return inv.annualRate / 100;
  const ini = inv.purchaseDate ?? inv.issueDate;
  const dias = ini ? (Date.now() - new Date(ini).getTime()) / 864e5 : 0;
  if (aplicado > 0 && bruto > 0 && dias >= 20) return Math.pow(bruto / aplicado, 365 / dias) - 1;
  return null;
}

async function dadosDoItem(item, desde) {
  const pl = pluggy();
  const transacoes = [], saldoContas = [], investimentos = [], movimentos = [], avisos = [];
  const banco = item.connector?.name ?? 'Banco';

  const dono = { docs: new Set(), nomes: new Set() };
  try {
    const id = await pl.fetchIdentityByItemId(item.id);
    if (id?.document) dono.docs.add(soDigitos(id.document));
    if (id?.taxNumber) dono.docs.add(soDigitos(id.taxNumber));
    if (id?.fullName) dono.nomes.add(normNome(id.fullName));
  } catch { /* identity is optional */ }

  const { results: contas = [] } = await pl.fetchAccounts(item.id);
  for (const conta of contas) {
    if (conta.owner) dono.nomes.add(normNome(conta.owner));
    if (conta.taxNumber) dono.docs.add(soDigitos(conta.taxNumber));
  }

  for (const conta of contas) {
    const cartao = conta.type === 'CREDIT';
    const lista = await pl.fetchAllTransactions(conta.id, { dateFrom: desde });
    let faturas = new Map();
    if (cartao) {
      try {
        const bills = await fetchAllPages((page) => pl.fetchCreditCardBills(conta.id, { page, pageSize: 100 }));
        faturas = new Map(bills.map((b) => [b.id, b.dueDate]));
      } catch { avisos.push('Não consegui ler as faturas do cartão ' + (conta.name ?? '')); }
    }
    for (const t of lista) {
      const data = dia(t.date);
      if (!data || data < desde) continue;
      const credito = t.type === 'CREDIT';
      const valorAbs = Math.abs(num(t.amount));
      let tipo, valor = valorAbs;
      if (cartao) {
        if (credito && (/credit card payment/i.test(t.category ?? '') || RE_FATURA.test(t.description ?? ''))) tipo = 'Pagamento de fatura';
        else { tipo = 'Gasto'; if (credito) valor = -valorAbs; } // estorno abate do gasto
      } else {
        tipo = tipoConta(t, dono);
      }
      const md = t.creditCardMetadata;
      let descricao = t.merchant?.name || t.description || t.descriptionRaw || '—';
      if (md?.totalInstallments > 1) descricao += ` - Parcela ${md.installmentNumber}/${md.totalInstallments}`;
      transacoes.push({
        id: t.id,
        data,
        mes: data.slice(0, 7),
        origem: cartao ? 'Cartão' : 'Conta',
        tipo,
        categoria: tipo === 'Gasto' ? categoria(t.category, t.description) : tipo,
        descricao,
        valor: r2(valor),
        fatura: cartao ? rotuloFatura(md?.billId ? faturas.get(md.billId) : md?.billForecastDate) : '',
        banco,
        conta: conta.marketingName || conta.name || '',
      });
    }
    if (!cartao) saldoContas.push({ atual: num(conta.balance), lista });
  }

  try {
    const invs = await fetchAllPages((page) => pl.fetchInvestments(item.id, undefined, { page, pageSize: 100 }));
    for (const inv of invs) {
      if (inv.status === 'TOTAL_WITHDRAWAL') continue;
      const liquido = num(inv.balance);
      const bruto = inv.amount != null ? num(inv.amount) : liquido;
      const aplicado = inv.amountOriginal != null ? num(inv.amountOriginal) : null;
      const rendimento = inv.amountProfit != null ? num(inv.amountProfit) : aplicado != null ? bruto - aplicado : null;
      investimentos.push({
        titulo_id: inv.id,
        nome: inv.name ?? '',
        produto: inv.subtype ?? inv.type ?? '',
        indexador: indexador(inv),
        taxa: taxaTexto(inv),
        bruto: r2(bruto),
        liquido: r2(inv.amountWithdrawal != null ? num(inv.amountWithdrawal) : liquido),
        aplicado: aplicado != null ? r2(aplicado) : null,
        rendimento: rendimento != null ? r2(rendimento) : null,
        ir: r2(num(inv.taxes)),
        iof: r2(num(inv.taxes2)),
        vencimento: inv.dueDate ? dia(inv.dueDate) : '',
        inicio: inv.purchaseDate || inv.issueDate ? dia(inv.purchaseDate ?? inv.issueDate) : '',
        anual: taxaAnual(inv, bruto, aplicado),
        banco,
      });
      let txs = inv.transactions;
      if (!txs?.length) {
        try { txs = await pl.fetchAllInvestmentTransactions(inv.id); } catch { txs = []; }
      }
      for (const m of txs ?? []) {
        const tipo = m.type === 'BUY' ? 'Aplicação' : m.type === 'SELL' ? 'Resgate' : null;
        if (!tipo) continue;
        movimentos.push({ data: dia(m.date), titulo_id: inv.id, tipo, valor: r2(Math.abs(num(m.netAmount ?? m.amount ?? m.value))) });
      }
    }
  } catch (e) {
    avisos.push('Não consegui ler os investimentos de ' + banco + ': ' + (e?.message ?? e));
  }

  return { transacoes, saldoContas, investimentos, movimentos, avisos };
}

// Balance at the end of each day: walk back from today's balance undoing each day's movement.
function saldoDiario(contas) {
  const porDia = new Map();
  let atual = 0;
  for (const { atual: a, lista } of contas) {
    atual += a;
    for (const t of lista) {
      const d = dia(t.date);
      const v = (t.type === 'CREDIT' ? 1 : -1) * Math.abs(num(t.amount));
      porDia.set(d, (porDia.get(d) ?? 0) + v);
    }
  }
  const dias = [...porDia.keys()].sort().reverse();
  const out = [];
  let s = atual;
  for (const d of dias) {
    out.push({ data: d, saldo: r2(s) });
    s -= porDia.get(d);
  }
  return out.reverse();
}

export async function carregarDados(extras = []) {
  const items = await listItems(extras);
  const fixos = new Set(idsFixos());
  const desde = mesesAtras(11);
  const partes = [];
  const avisos = [];
  for (const item of items) {
    if (item.status === 'LOGIN_ERROR' || item.status === 'WAITING_USER_INPUT') avisos.push(`${item.connector?.name ?? 'Banco'} pede nova autorização. Abra "Conectar banco".`);
    if (item.consentExpiresAt && new Date(item.consentExpiresAt) < new Date(Date.now() + 15 * 864e5)) avisos.push(`A autorização do ${item.connector?.name ?? 'banco'} vence em ${dia(item.consentExpiresAt).split('-').reverse().join('/')}. Renove em "Conectar banco".`);
    try {
      partes.push(await dadosDoItem(item, desde));
    } catch (e) {
      avisos.push(`Não consegui ler ${item.connector?.name ?? 'um banco'}: ${e?.message ?? e}`);
    }
  }
  const transacoes = partes.flatMap((p) => p.transacoes).sort((a, b) => a.data.localeCompare(b.data));
  return {
    atualizadoEm: new Date().toISOString(),
    sincronizadoEm: items.map((i) => i.lastUpdatedAt).filter(Boolean).map((d) => new Date(d).toISOString()).sort().at(-1) ?? null,
    bancos: items.map((i) => ({ id: i.id, salvo: fixos.has(i.id), nome: i.connector?.name ?? 'Banco', status: i.status, imagem: i.connector?.imageUrl ?? null, consenteAte: i.consentExpiresAt ? dia(i.consentExpiresAt) : null })),
    transacoes,
    saldo: saldoDiario(partes.flatMap((p) => p.saldoContas)),
    investimentos: partes.flatMap((p) => p.investimentos),
    movimentos: partes.flatMap((p) => p.movimentos).sort((a, b) => a.data.localeCompare(b.data)),
    avisos: [...avisos, ...partes.flatMap((p) => p.avisos)],
  };
}

// Pluggy calls are slow; keep the last result for a while per server instance.
const cache = new Map();
const TTL = 15 * 60 * 1000;

export async function dadosEmCache({ fresco = false, extras = [] } = {}) {
  const chave = [...new Set([...idsFixos(), ...extras])].sort().join(',');
  const c = cache.get(chave);
  if (!fresco && c && Date.now() - c.at < TTL) return c.dados;
  const dados = await carregarDados(extras);
  cache.set(chave, { at: Date.now(), dados });
  return dados;
}

export function limparCache() {
  cache.clear();
}
