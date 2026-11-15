// Despesas fixas: the list the user registers, checked against the month's transactions to tell
// what is already paid. Saved on the server when a store is configured, otherwise in this browser.
import { CATEGORIAS } from '../../lib/categorias';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const LOCAL = 'fin_despesas_fixas';

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const hojeSP = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const ultimoDia = (m) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate();
const mesNome = (m) => MESES[Number(m.slice(5, 7)) - 1];
const ddmm = (s) => s.slice(8, 10) + '/' + s.slice(5, 7);
const soma = (xs) => xs.reduce((a, b) => a + b, 0);
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const el = (tag, props = {}, ...filhos) => { const e = Object.assign(document.createElement(tag), props); e.append(...filhos.filter((f) => f != null)); return e; };

const lerLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL) ?? '[]'); } catch { return []; } };
const gravarLocal = (lista) => { try { localStorage.setItem(LOCAL, JSON.stringify(lista)); } catch { /* private mode */ } };

async function carregarLista() {
  const res = await fetch('/api/despesas', { cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.erro ?? 'Não consegui carregar as despesas fixas.');
  if (body.armazenamento !== 'servidor') return { servidor: false, lista: lerLocal() };
  // First time the store is available: move what was kept in this browser up to it.
  const locais = lerLocal();
  if (!body.despesas.length && locais.length) {
    const lista = await salvarServidor(locais);
    gravarLocal([]);
    return { servidor: true, lista };
  }
  return { servidor: true, lista: body.despesas };
}

async function salvarServidor(lista) {
  const res = await fetch('/api/despesas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ despesas: lista }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.erro ?? 'Não consegui salvar.');
  return body.despesas;
}

export function iniciarFixas($, dados) {
  const hoje = hojeSP(), mesAtual = hoje.slice(0, 7);
  const gastos = dados.transacoes.filter((t) => t.tipo === 'Gasto');
  const meses = [...new Set([...dados.transacoes.map((t) => t.mes), mesAtual])].sort().slice(-6);
  let mes = mesAtual, lista = [], servidor = false, editando = null, carregado = false, erro = '';

  for (const c of CATEGORIAS) $('fx-categoria').append(el('option', { value: c, textContent: c }));

  async function salvar(nova) {
    const anterior = lista;
    lista = nova; draw();
    try {
      if (servidor) lista = await salvarServidor(nova); else gravarLocal(nova);
      erro = '';
    } catch (e) {
      lista = anterior; erro = String(e?.message ?? e);
    }
    draw();
  }

  // Paid when a spend in the month contains the expense's text; the closest value wins.
  function situacao(d, m) {
    const termo = norm(d.termo || d.nome);
    const achados = gastos.filter((t) => t.mes === m && (!d.origem || t.origem === d.origem) && norm(t.descricao).includes(termo));
    if (achados.length) {
      const t = achados.reduce((a, b) => (Math.abs(b.valor - d.valor) < Math.abs(a.valor - d.valor) ? b : a));
      return { paga: true, auto: true, texto: 'Paga em ' + ddmm(t.data), valor: t.valor };
    }
    if (d.pagas?.includes(m)) return { paga: true, texto: 'Marcada como paga', valor: d.valor };
    const venc = Math.min(d.dia, ultimoDia(m));
    if (m < mesAtual) return { classe: 'alerta', texto: 'Não apareceu no extrato' };
    if (m > mesAtual) return { texto: 'Vence dia ' + venc };
    const faltam = venc - Number(hoje.slice(8, 10));
    if (faltam < 0) return { classe: 'alerta', texto: 'Venceu dia ' + venc };
    if (faltam === 0) return { classe: 'perto', texto: 'Vence hoje' };
    if (faltam <= 5) return { classe: 'perto', texto: 'Vence em ' + faltam + (faltam === 1 ? ' dia' : ' dias') };
    return { texto: 'Vence dia ' + venc };
  }

  // Spends that repeat in at least 3 months with a steady value, not yet registered.
  function sugestoes() {
    const ja = lista.map((d) => norm(d.termo || d.nome));
    const grupos = new Map();
    for (const t of gastos) {
      const k = norm(t.descricao).replace(/\d+\/\d+$/, '').trim();
      if (k.length < 3 || ja.some((j) => k.includes(j))) continue;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(t);
    }
    return [...grupos.values()]
      .map((ts) => ({ ts, meses: new Set(ts.map((t) => t.mes)).size, valores: ts.map((t) => t.valor) }))
      .filter((g) => g.meses >= 3 && g.ts.length <= g.meses + 1 && Math.max(...g.valores) <= Math.min(...g.valores) * 1.3)
      .sort((a, b) => b.meses - a.meses || soma(b.valores) - soma(a.valores))
      .slice(0, 6)
      .map(({ ts }) => {
        const t = ts.at(-1);
        return { nome: cap(t.descricao.toLowerCase()), valor: mediana(ts.map((x) => x.valor)), dia: mediana(ts.map((x) => Number(x.data.slice(8, 10)))), categoria: t.categoria, origem: t.origem, termo: t.descricao };
      });
  }
  function abrirForm(d) {
    editando = d?.id ?? null;
    const f = $('fx-form');
    f.reset();
    $('fx-form-tit').textContent = editando ? 'Editar despesa' : 'Nova despesa fixa';
    $('fx-nome').value = d?.nome ?? '';
    $('fx-valor').value = d?.valor != null ? d.valor.toFixed(2) : '';
    $('fx-dia').value = d?.dia ?? '';
    $('fx-categoria').value = d?.categoria && CATEGORIAS.includes(d.categoria) ? d.categoria : 'Casa e contas';
    $('fx-origem').value = d?.origem ?? '';
    $('fx-termo').value = d?.termo ?? '';
    $('fx-excluir').hidden = !editando;
    $('fx-excluir').textContent = 'Excluir';
    $('fx-excluir').dataset.confirmar = '';
    $('fx-form-card').hidden = false;
    $('fx-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('fx-nome').focus({ preventScroll: true });
  }
  const fecharForm = () => { editando = null; $('fx-form-card').hidden = true; };

  $('fx-nova').addEventListener('click', () => abrirForm(null));
  $('fx-cancelar').addEventListener('click', fecharForm);
  $('fx-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const d = {
      id: editando ?? crypto.randomUUID(),
      nome: $('fx-nome').value.trim(),
      valor: Number(String($('fx-valor').value).replace(',', '.')),
      dia: Number($('fx-dia').value) || 1,
      categoria: $('fx-categoria').value,
      origem: $('fx-origem').value,
      termo: $('fx-termo').value.trim(),
      pagas: lista.find((x) => x.id === editando)?.pagas ?? [],
    };
    if (!d.nome || !Number.isFinite(d.valor)) return;
    fecharForm();
    salvar(editando && lista.some((x) => x.id === d.id) ? lista.map((x) => (x.id === d.id ? d : x)) : [...lista, d]);
  });
  // Two taps to delete, so a stray tap doesn't lose an entry (no browser dialogs).
  $('fx-excluir').addEventListener('click', (ev) => {
    const b = ev.currentTarget;
    if (!b.dataset.confirmar) { b.dataset.confirmar = '1'; b.textContent = 'Toque de novo para excluir'; return; }
    const id = editando;
    fecharForm();
    salvar(lista.filter((x) => x.id !== id));
  });

  function draw() {
    if (!carregado) return;
    const sits = lista.map((d) => [d, situacao(d, mes)]);
    const total = soma(lista.map((d) => d.valor));
    const pagas = sits.filter(([, s]) => s.paga);
    const pagoValor = soma(pagas.map(([d]) => d.valor));
    const falta = Math.max(0, total - pagoValor);

    $('fx-total').textContent = brl(total);
    $('fx-tk').textContent = lista.length
      ? `${lista.length} ${lista.length === 1 ? 'conta' : 'contas'} · ${pagas.length} ${pagas.length === 1 ? 'paga' : 'pagas'} em ${mesNome(mes)}` + (falta > 0 ? ` · faltam ${brl(falta)}` : ' · tudo pago')
      : 'Cadastre as contas que se repetem todo mês para acompanhar o que já foi pago.';
    $('fx-prog').style.width = total ? (pagoValor / total) * 100 + '%' : '0';
    $('fx-prog').parentElement.hidden = !lista.length;
    $('fx-mes').hidden = !lista.length;

    $('fx-mes').replaceChildren(...[...meses].reverse().map((m) => {
      const b = el('button', { type: 'button', className: 'fc-chip', textContent: cap(mesNome(m)) + (m.slice(0, 4) !== mesAtual.slice(0, 4) ? ' ' + m.slice(0, 4) : '') });
      b.setAttribute('aria-pressed', String(m === mes));
      b.addEventListener('click', () => { mes = m; draw(); });
      return b;
    }));

    const avisos = [];
    if (erro) avisos.push(erro);
    if (!servidor && lista.length) avisos.push('Estas despesas estão salvas só neste aparelho. Para vê-las no celular e no computador, crie um banco Upstash Redis na Vercel (veja o README).');
    $('fx-aviso').hidden = !avisos.length;
    $('fx-aviso').textContent = avisos.join(' ');

    const ord = [...sits].sort(([a], [b]) => a.dia - b.dia || a.nome.localeCompare(b.nome));
    $('fx-lista').replaceChildren(...ord.map(([d, s]) => {
      const check = el('button', { type: 'button', className: 'fc-fx-check', innerHTML: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' });
      check.setAttribute('aria-pressed', String(!!s.paga));
      check.setAttribute('aria-label', (s.paga ? 'Desmarcar ' : 'Marcar como paga ') + d.nome);
      if (s.auto) { check.disabled = true; check.title = 'Encontrada nas transações'; }
      check.addEventListener('click', () => {
        const pagas = d.pagas?.includes(mes) ? d.pagas.filter((m) => m !== mes) : [...(d.pagas ?? []), mes];
        salvar(lista.map((x) => (x.id === d.id ? { ...x, pagas } : x)));
      });
      const meta = ['Dia ' + d.dia, d.categoria, d.origem].filter(Boolean).join(' · ');
      const main = el('button', { type: 'button', className: 'fc-fx-main' },
        el('span', { className: 'n', textContent: d.nome }),
        el('span', { className: 'meta', textContent: meta }));
      main.setAttribute('aria-label', 'Editar ' + d.nome);
      main.addEventListener('click', () => abrirForm(d));
      const valor = el('span', { className: 'fc-fx-v' },
        el('b', { textContent: brl(d.valor) }),
        el('span', { className: 'fc-pill' + (s.paga ? ' ok' : s.classe ? ' ' + s.classe : ''), textContent: s.texto + (s.auto && Math.abs(s.valor - d.valor) >= 0.01 ? ' · ' + brl(s.valor) : '') }));
      return el('li', { className: 'fc-fx' + (s.paga ? ' paga' : '') }, check, main, valor);
    }));
    $('fx-vazio').hidden = lista.length > 0;

    const sug = sugestoes();
    $('fx-sug-card').hidden = !sug.length;
    $('fx-sug').replaceChildren(...sug.map((g) => {
      const b = el('button', { type: 'button', className: 'fc-sug' },
        el('span', { className: 'n', textContent: g.nome }),
        el('span', { className: 'meta', textContent: brl(g.valor) + ' · por volta do dia ' + g.dia }));
      b.addEventListener('click', () => abrirForm(g));
      return b;
    }));
  }

  carregarLista()
    .then((r) => { servidor = r.servidor; lista = r.lista; })
    .catch((e) => { erro = String(e?.message ?? e); lista = lerLocal(); })
    .finally(() => { carregado = true; draw(); });

  return draw;
}
