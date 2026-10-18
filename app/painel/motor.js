// Drawing code for the painel, ported from the original Finanças C6 dashboard.
// `dados` is the JSON from /api/dados; the markup comes from template.js.
import * as d3 from 'd3';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ENTR = new Set(['Entrada', 'Transferência recebida']);
const SHADES = ['#ff7a1a', '#ff9a3d', '#ffbe7a', '#e85d04', '#c24c06', '#ffdcb5', '#a8430a', '#ff8f2e', '#d9a07a', '#7a2e06'];

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlK = (v) => 'R$ ' + (Math.abs(v) >= 1000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : Math.round(v).toLocaleString('pt-BR'));
const pct = (v, d = 2) => (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
const ddmm = (s) => s.slice(8, 10) + '/' + s.slice(5, 7);
const ddmmaa = (s) => ddmm(s) + '/' + s.slice(0, 4);
const diaLongo = (s) => Number(s.slice(8, 10)) + ' ' + CURTOS[Number(s.slice(5, 7)) - 1] + ' ' + s.slice(0, 4);
const mesNome = (m) => MESES[Number(m.slice(5, 7)) - 1];
const mesCurto = (m) => { const c = CURTOS[Number(m.slice(5, 7)) - 1]; return c[0].toUpperCase() + c.slice(1); };
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const hojeSP = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5) + 1;
const fimDoMes = (m) => d3.utcFormat('%Y-%m-%d')(d3.utcDay.offset(d3.utcMonth.offset(new Date(m + '-01T00:00:00Z'), 1), -1));

// Small stand-in for the dashboard runtime the original page ran on: filter params and redraw hooks.
function criarDash(datasets, inicial) {
  let params = { ...inicial };
  const fns = [];
  const run = () => { for (const fn of fns) fn(); };
  return {
    data: (id) => (datasets[id] ? { status: 'ok', data: datasets[id] } : { status: 'missing', data: [] }),
    params: () => params,
    setParams(o) {
      params = { ...params };
      for (const [k, v] of Object.entries(o)) { if (v == null || v === '') delete params[k]; else params[k] = v; }
      run();
    },
    resetParams() { params = { ...inicial }; run(); },
    onData(fn) { fns.push(fn); fn(); },
    setLink(name) { try { history.replaceState(null, '', name === 'gastos' ? location.pathname : '#' + name); } catch { /* ignore */ } },
    redraw: run,
  };
}

function utilidades(calm) {
  const counters = new Map();
  const paint = (el, text, split) => {
    if (!split) { el.textContent = text; return; }
    const i = text.lastIndexOf(',');
    const c = document.createElement('span'); c.className = 'cents'; c.textContent = text.slice(i);
    el.replaceChildren(document.createTextNode(text.slice(0, i)), c);
  };
  const countTo = (el, value, fmt, split) => {
    const from = counters.get(el) ?? 0; counters.set(el, value);
    if (calm || from === value) { paint(el, fmt(value), split); return; }
    const t0 = performance.now(), dur = 650;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      paint(el, fmt(from + (value - from) * e), split);
      if (k < 1 && counters.get(el) === value) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const tip = (box) => {
    let t = box.querySelector('.fc-tip');
    if (!t) { t = document.createElement('div'); t.className = 'fc-tip'; t.hidden = true; box.appendChild(t); }
    return {
      show(ev, title, line) {
        t.replaceChildren();
        const a = document.createElement('div'); a.className = 't'; a.textContent = title;
        const b = document.createElement('div'); b.textContent = line;
        t.append(a, b); t.hidden = false;
        const r = box.getBoundingClientRect();
        let x = ev.clientX - r.left + 12, y = ev.clientY - r.top - 48;
        x = Math.max(4, Math.min(x, box.clientWidth - t.offsetWidth - 4)); y = Math.max(0, y);
        t.style.left = x + 'px'; t.style.top = y + 'px';
      },
      hide() { t.hidden = true; },
    };
  };
  return { countTo, counters, tip };
}

function chipsCom(onPick) {
  return (box, items, current) => {
    box.replaceChildren(...items.map(([v, label]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'fc-chip'; b.textContent = label;
      b.setAttribute('aria-pressed', String((current ?? '') === v));
      b.addEventListener('click', () => onPick(v));
      return b;
    }));
  };
}

// ---------------------------------------------------------------- Gastos

function iniciarGastos(dash, $, calm) {
  const { countTo, counters, tip } = utilidades(calm);
  const P = () => dash.params();
  const set = (o) => dash.setParams(o);
  let catColor = {};
  let rows = [];
  let MS = [], inicio = '', fim = '', ultimoAno = '';
  const DIAS = {};
  const mesChip = (m) => cap(mesNome(m)) + (m.slice(0, 4) !== ultimoAno ? ' ' + m.slice(0, 4) : '');
  const mesTexto = (m) => mesNome(m) + ' de ' + m.slice(0, 4);
  const periodoTexto = () => diaLongo(inicio).replace(/ \d{4}$/, inicio.slice(0, 4) === fim.slice(0, 4) ? '' : ' ' + inicio.slice(0, 4)) + ' – ' + diaLongo(fim);
  const parcial = (m) => m === MS[0] ? inicio.slice(8, 10) !== '01' : m === MS.at(-1) ? fim !== fimDoMes(m) : false;

  const chips = (box, items, current, key) => chipsCom((v) => set({ [key]: v || null }))(box, items, current);

  $('f-limpar').addEventListener('click', () => { dash.resetParams(); $('t-busca').value = ''; });
  $('t-busca').addEventListener('input', () => drawTable());

  const filt = (r, skip = {}) => {
    const p = P();
    if (!skip.mes && p.mes && r.mes !== p.mes) return false;
    if (!skip.origem && p.origem && r.origem !== p.origem) return false;
    if (!skip.categoria && p.categoria && r.categoria !== p.categoria) return false;
    return true;
  };

  function drawControls() {
    const p = P();
    chips($('f-mes'), [['', 'Todo o período'], ...MS.map((m) => [m, mesChip(m)])], p.mes, 'mes');
    chips($('f-origem'), [['', 'Conta e cartão'], ['Conta', 'Só conta'], ['Cartão', 'Só cartão']], p.origem, 'origem');
    const totals = d3.rollups(rows.filter((r) => r.tipo === 'Gasto'), (v) => d3.sum(v, (r) => r.valor), (r) => r.categoria).sort((a, b) => b[1] - a[1]);
    catColor = Object.fromEntries(totals.map(([c], i) => [c, SHADES[i % SHADES.length]]));
    chips($('f-cat'), [['', 'Todas as categorias'], ...totals.map(([c]) => [c, c])], p.categoria, 'categoria');
    chips($('f-tipo'), [['Gasto', 'Gastos'], ['Entradas', 'Entradas'], ['', 'Tudo']], p.tipo, 'tipo');
    $('f-limpar').hidden = !(p.mes || p.origem || p.categoria);
    $('periodo').textContent = p.mes ? mesTexto(p.mes) : periodoTexto();
    const notas = [MS[0], MS.at(-1)].filter((m, i, a) => m && a.indexOf(m) === i && parcial(m));
    $('nota-mes').textContent = 'Toque num mês para filtrar.' + notas.map((m) => ' ' + cap(mesNome(m)) + (m === MS[0] ? ' começa em ' + ddmm(inicio) : ' vai até ' + ddmm(fim)) + '.').join('');
  }

  function drawKpis(saldo) {
    const p = P();
    const g = rows.filter((r) => r.tipo === 'Gasto' && filt(r));
    const gastos = d3.sum(g, (r) => r.valor);
    const base = rows.filter((r) => filt(r, { categoria: true }));
    const entradas = d3.sum(base.filter((r) => ENTR.has(r.tipo)), (r) => r.valor);
    const proprias = d3.sum(base.filter((r) => r.tipo === 'Transferência recebida'), (r) => r.valor);
    const invest = d3.sum(base.filter((r) => r.tipo === 'Investimento'), (r) => r.valor);
    $('h-lbl').textContent = 'Gastos' + (p.categoria ? ' com ' + p.categoria : '') + (p.origem ? ' no ' + (p.origem === 'Conta' ? 'débito e Pix' : 'cartão') : '') + (p.mes ? ' em ' + mesNome(p.mes) : ' no período');
    const all = rows.filter((r) => r.tipo === 'Gasto' && filt(r, { categoria: true }));
    const top = d3.rollups(all, (v) => d3.sum(v, (r) => r.valor), (r) => r.categoria).sort((a, b) => b[1] - a[1]);
    const tot = d3.sum(all, (r) => r.valor) || 1;
    countTo($('h-total'), gastos, brl, true);
    drawShare(top, tot);
    $('h-tk').textContent = p.categoria
      ? `${g.length} lançamentos, ${Math.round(gastos / tot * 100)}% de tudo que você gastou nesse recorte.`
      : top.length > 1 ? `${top[0][0]} e ${top[1][0]} levaram ${Math.round((top[0][1] + top[1][1]) / tot * 100)}% do dinheiro gasto.` : '';
    const noAcc = p.origem === 'Cartão';
    if (noAcc) { $('k-entradas').textContent = '—'; $('k-invest').textContent = '—'; counters.delete($('k-entradas')); counters.delete($('k-invest')); }
    else { countTo($('k-entradas'), entradas, brl); countTo($('k-invest'), invest, brl); }
    $('k-entradas-sub').textContent = noAcc ? 'Só aparecem na conta' : brl(proprias) + ' de outra conta sua';
    const dias = DIAS[p.mes ?? ''] || 1;
    countTo($('k-dia'), gastos / dias, brl);
    $('k-dia-sub').textContent = dias + ' dias';
    const lim = p.mes ? saldo.filter((s) => s.data.slice(0, 7) <= p.mes) : saldo;
    const last = lim.at(-1);
    if (last) {
      countTo($('k-saldo'), last.saldo, brl);
      $('k-saldo-sub').textContent = 'Em ' + ddmmaa(last.data);
    } else { $('k-saldo').textContent = '—'; $('k-saldo-sub').textContent = ''; }
  }

  function drawShare(top, tot) {
    const p = P();
    const bar = $('h-share'), leg = $('h-legend');
    bar.replaceChildren(...top.map(([c, v], i) => {
      const s = document.createElement('i');
      s.style.flex = String(Math.max(0, v)); s.style.background = catColor[c] ?? '#ff7a1a';
      s.style.opacity = !p.categoria || p.categoria === c ? '1' : '.25';
      s.title = c + ': ' + brl(v);
      s.addEventListener('click', () => set({ categoria: p.categoria === c ? null : c }));
      if (!calm) s.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 600, delay: i * 40, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
      return s;
    }));
    leg.replaceChildren(...top.slice(0, 4).map(([c, v]) => {
      const s = document.createElement('span'); s.style.setProperty('--c', catColor[c] ?? '#ff7a1a');
      s.append(document.createTextNode(c));
      const b = document.createElement('b'); b.textContent = Math.round(v / tot * 100) + '%'; s.append(b);
      return s;
    }));
  }

  function drawMes() {
    const box = $('ch-mes'); box.querySelector('svg')?.remove();
    const p = P();
    const g = rows.filter((r) => r.tipo === 'Gasto' && filt(r, { mes: true }));
    const data = MS.map((m) => ({ mes: m, Conta: d3.sum(g.filter((r) => r.mes === m && r.origem === 'Conta'), (r) => r.valor), 'Cartão': d3.sum(g.filter((r) => r.mes === m && r.origem === 'Cartão'), (r) => r.valor) }));
    const W = Math.max(260, box.clientWidth), H = 160, m = { t: 18, r: 4, b: 20, l: 4 };
    const x = d3.scaleBand(MS, [m.l, W - m.r]).padding(MS.length > 8 ? 0.2 : 0.28);
    const max = d3.max(data, (d) => d.Conta + d['Cartão']) || 1;
    const y = d3.scaleLinear([0, max * 1.12], [H - m.b, m.t]);
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Gastos por mês');
    const tt = tip(box);
    const col = { Conta: 'var(--o1)', 'Cartão': 'var(--o3)' };
    const base = H - m.b;
    const fs = x.bandwidth() < 30 ? 9 : 10.5;
    data.forEach((d, i) => {
      const dim = p.mes && p.mes !== d.mes;
      const gx = svg.append('g').attr('class', 'hit').on('click', () => set({ mes: p.mes === d.mes ? null : d.mes }));
      gx.append('rect').attr('x', x(d.mes) - 4).attr('y', m.t).attr('width', x.bandwidth() + 8).attr('height', base - m.t).attr('fill', 'transparent');
      let top = base;
      for (const k of ['Conta', 'Cartão']) {
        const h = base - y(Math.max(0, d[k]));
        if (h <= 0) continue;
        const r = gx.append('rect').attr('x', x(d.mes)).attr('width', x.bandwidth()).attr('rx', 4)
          .attr('fill', col[k]).attr('fill-opacity', dim ? 0.25 : 1)
          .on('mousemove', (ev) => tt.show(ev, mesTexto(d.mes) + ' · ' + k, brl(d[k]))).on('mouseleave', tt.hide);
        const yEnd = top - h;
        if (calm) r.attr('y', yEnd).attr('height', h);
        else r.attr('y', base).attr('height', 0).transition().duration(700).delay(i * 70).ease(d3.easeCubicOut).attr('y', yEnd).attr('height', h);
        top = yEnd;
      }
      const tot = d.Conta + d['Cartão'];
      // narrow bars get a compact label; class m keeps it hidden along with the other values
      const curto = x.bandwidth() < 44 ? (Math.abs(tot) >= 1000 ? (tot / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k' : String(Math.round(tot))) : brlK(tot);
      const lab = svg.append('text').attr('class', 'm').attr('x', x(d.mes) + x.bandwidth() / 2).attr('y', y(Math.max(0, tot)) - 7).attr('text-anchor', 'middle')
        .attr('font-size', fs).attr('fill', dim ? 'var(--dim)' : 'var(--fg)').text(curto);
      if (!calm) lab.attr('opacity', 0).transition().delay(450 + i * 70).duration(300).attr('opacity', 1);
      svg.append('text').attr('x', x(d.mes) + x.bandwidth() / 2).attr('y', H - 5).attr('text-anchor', 'middle')
        .attr('font-size', fs).attr('fill', p.mes === d.mes ? 'var(--o2)' : 'var(--muted)').text(mesCurto(d.mes));
    });
  }

  function drawCat() {
    const box = $('ch-cat'); box.querySelector('svg')?.remove();
    const p = P();
    const g = rows.filter((r) => r.tipo === 'Gasto' && filt(r, { categoria: true }));
    const data = d3.rollups(g, (v) => d3.sum(v, (r) => r.valor), (r) => r.categoria).filter((d) => d[1] > 0).sort((a, b) => b[1] - a[1]);
    const tot = d3.sum(data, (d) => d[1]) || 1;
    const W = Math.max(260, box.clientWidth), rh = 24, H = Math.max(40, data.length * rh + 4);
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Gastos por categoria');
    const probe = svg.append('text').attr('font-size', 10.5);
    const labW = d3.max(data, (d) => { probe.text(d[0]); return probe.node().getComputedTextLength(); }) || 0;
    const valW = d3.max(data, (d) => { probe.text(brlK(d[1]) + ' · 100%'); return probe.node().getComputedTextLength(); }) || 0;
    probe.remove();
    const x0 = labW + 12, x1 = W - valW - 10;
    const x = d3.scaleLinear([0, d3.max(data, (d) => d[1]) || 1], [0, Math.max(20, x1 - x0)]);
    const tt = tip(box);
    data.forEach((d, i) => {
      const yy = i * rh + 4, on = !p.categoria || p.categoria === d[0];
      const gr = svg.append('g').attr('class', 'hit').on('click', () => set({ categoria: p.categoria === d[0] ? null : d[0] }));
      gr.append('rect').attr('x', 0).attr('y', yy).attr('width', W).attr('height', rh - 4).attr('fill', 'transparent');
      gr.append('text').attr('x', x0 - 10).attr('y', yy + 13).attr('text-anchor', 'end').attr('font-size', 10.5)
        .attr('fill', on ? 'var(--fg)' : 'var(--dim)').text(d[0]);
      gr.append('rect').attr('x', x0).attr('y', yy + 5).attr('height', rh - 12).attr('rx', 5).attr('fill', 'var(--panel-2)').attr('width', Math.max(20, x1 - x0));
      const bar = gr.append('rect').attr('x', x0).attr('y', yy + 5).attr('height', rh - 12).attr('rx', 5)
        .attr('fill', catColor[d[0]] ?? 'var(--o1)').attr('fill-opacity', on ? 1 : 0.25)
        .on('mousemove', (ev) => tt.show(ev, d[0], brl(d[1]) + ' · ' + Math.round(d[1] / tot * 100) + '%')).on('mouseleave', tt.hide);
      if (calm) bar.attr('width', Math.max(3, x(d[1])));
      else bar.attr('width', 0).transition().duration(700).delay(i * 50).ease(d3.easeCubicOut).attr('width', Math.max(3, x(d[1])));
      gr.append('text').attr('x', x1 + 8).attr('y', yy + 13).attr('font-size', 10.5)
        .attr('fill', on ? 'var(--muted)' : 'var(--dim)').text(brlK(d[1]) + ' · ' + Math.round(d[1] / tot * 100) + '%');
    });
    if (!data.length) svg.append('text').attr('x', 0).attr('y', 20).attr('font-size', 10.5).attr('fill', 'var(--muted)').text('Nenhum gasto com esses filtros.');
  }

  function drawSaldo(saldo) {
    const box = $('ch-saldo'); box.querySelector('svg')?.remove();
    if (!saldo.length) return;
    const p = P();
    const pts = saldo.map((s) => ({ d: new Date(s.data + 'T12:00:00Z'), v: s.saldo, s }));
    const W = Math.max(260, box.clientWidth), H = 160, m = { t: 16, r: 12, b: 20, l: 12 };
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Saldo da conta');
    const vmax = d3.max(pts, (q) => q.v), vmin = Math.min(0, d3.min(pts, (q) => q.v));
    const probe = svg.append('text').attr('font-size', 10.5).text(brlK(Math.max(Math.abs(vmax), Math.abs(vmin))));
    m.l = probe.node().getComputedTextLength() + 10; probe.remove();
    const x = d3.scaleUtc(d3.extent(pts, (q) => q.d), [m.l, W - m.r]);
    const y = d3.scaleLinear([vmin * 1.1, (vmax || 1) * 1.1], [H - m.b, m.t]).nice();
    for (const t of y.ticks(4)) {
      svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', 'var(--line)');
      svg.append('text').attr('x', m.l - 8).attr('y', y(t) + 4).attr('text-anchor', 'end').attr('font-size', 10.5).attr('fill', 'var(--dim)').text(brlK(t));
    }
    if (p.mes) {
      const a = new Date(p.mes + '-01T00:00:00Z'), b = d3.utcMonth.offset(a, 1);
      const xa = Math.max(m.l, x(a)), xb = Math.min(W - m.r, x(b));
      if (xb > xa) svg.append('rect').attr('x', xa).attr('y', m.t).attr('width', xb - xa).attr('height', H - m.b - m.t).attr('fill', '#ff7a1a').attr('fill-opacity', 0.08).attr('rx', 6);
    }
    const marcos = d3.utcMonth.range(d3.utcMonth.ceil(x.domain()[0]), x.domain()[1]);
    const passo = marcos.length > 8 ? 2 : 1;
    marcos.forEach((mm, i) => {
      if (i % passo) return;
      svg.append('text').attr('x', x(mm)).attr('y', H - 5).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('fill', 'var(--muted)').text(mesCurto(d3.utcFormat('%Y-%m')(mm)));
    });
    svg.append('path').datum(pts).attr('fill', '#ff7a1a').attr('fill-opacity', 0.1).attr('d', d3.area((q) => x(q.d), y(Math.max(0, y.domain()[0])), (q) => y(q.v)));
    const line = svg.append('path').datum(pts).attr('fill', 'none').attr('stroke', 'var(--o1)').attr('stroke-width', 2.5).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round')
      .attr('d', d3.line((q) => x(q.d), (q) => y(q.v)));
    if (!calm) { const L = line.node().getTotalLength(); line.attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L).transition().duration(1100).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0); }
    const last = pts.at(-1);
    svg.append('circle').attr('cx', x(last.d)).attr('cy', y(last.v)).attr('r', 9).attr('fill', '#ff7a1a').attr('fill-opacity', .2);
    svg.append('circle').attr('cx', x(last.d)).attr('cy', y(last.v)).attr('r', 4.5).attr('fill', 'var(--o1)');
    svg.append('text').attr('x', x(last.d) - 10).attr('y', y(last.v) - 12).attr('text-anchor', 'end').attr('font-size', 10.5).attr('fill', 'var(--o2)').text(brl(last.v));
    const rule = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).attr('stroke', 'var(--o5)').attr('stroke-dasharray', '3 3').attr('visibility', 'hidden');
    const dot = svg.append('circle').attr('r', 5).attr('fill', 'var(--o6)').attr('stroke', 'var(--o1)').attr('stroke-width', 2).attr('visibility', 'hidden');
    const tt = tip(box);
    const bis = d3.bisector((q) => q.d).center;
    const move = (ev) => {
      const e = ev.touches ? ev.touches[0] : ev;
      const [mx] = d3.pointer(e, svg.node()); const q = pts[bis(pts, x.invert(mx))];
      dot.attr('cx', x(q.d)).attr('cy', y(q.v)).attr('visibility', 'visible');
      rule.attr('x1', x(q.d)).attr('x2', x(q.d)).attr('visibility', 'visible');
      tt.show(e, ddmmaa(q.s.data), brl(q.v));
    };
    const off = () => { dot.attr('visibility', 'hidden'); rule.attr('visibility', 'hidden'); tt.hide(); };
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent').style('touch-action', 'pan-y')
      .on('mousemove', move).on('touchmove', move, { passive: true }).on('mouseleave', off).on('touchend', off);
  }

  function drawTable() {
    const p = P();
    const q = $('t-busca').value.trim().toLocaleLowerCase('pt-BR');
    let list = rows.filter((r) => filt(r));
    if (p.tipo === 'Gasto') list = list.filter((r) => r.tipo === 'Gasto');
    else if (p.tipo === 'Entradas') list = list.filter((r) => ENTR.has(r.tipo));
    if (q) list = list.filter((r) => (r.descricao + ' ' + r.categoria + ' ' + r.origem + ' ' + r.fatura).toLocaleLowerCase('pt-BR').includes(q));
    list = list.slice().sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
    const mostrar = list.slice(0, 600);
    $('t-body').replaceChildren(...mostrar.map((r) => {
      const tr = document.createElement('tr'); tr.dataset.key = r.id;
      const td = (txt, cls) => { const c = document.createElement('td'); if (cls) c.className = cls; c.textContent = txt; return c; };
      const desc = td('', 'desc');
      const dot = document.createElement('span'); dot.className = 'dot';
      dot.style.background = r.tipo === 'Gasto' ? (catColor[r.categoria] ?? '#ff7a1a') : ENTR.has(r.tipo) ? '#7bd99a' : '#6f5f55';
      desc.append(dot, document.createTextNode(r.descricao));
      const meta = document.createElement('span'); meta.className = 'meta';
      meta.textContent = r.origem + (r.fatura ? ' · ' + r.fatura : '') + ' · ' + (r.tipo === 'Gasto' ? r.categoria : r.tipo);
      desc.appendChild(meta);
      const credit = ENTR.has(r.tipo) || r.tipo === 'Resgate' || r.valor < 0;
      const v = td((credit ? '+ ' : '') + brl(Math.abs(r.valor)), 'num' + (credit ? ' pos' : r.tipo !== 'Gasto' ? ' neu' : ''));
      tr.append(td(ddmm(r.data)), desc, td(r.tipo === 'Gasto' ? r.categoria : r.tipo, 'col-cat'), v);
      return tr;
    }));
    $('t-count').textContent = list.length + (list.length === 1 ? ' transação' : ' transações') + (list.length > mostrar.length ? ` (mostrando as ${mostrar.length} mais recentes)` : '');
  }

  const placeName = (s) => {
    let k = s.replace(/\s*-\s*Parcela.*$/i, '').replace(/^(IFD\*|DL\s*\*\s*|DM\*|MP\s*\*|JIM\.COM\*\s*|SHPP\s+)/i, '').trim();
    if (/uber/i.test(k)) return 'Uber';
    if (/^(shpp|shopee)/i.test(s)) return 'Shopee';
    if (/ingresso/i.test(k)) return 'Ingressos';
    if (/^\d{2}\.\d{3}\.\d{3}\s+/.test(k)) k = k.replace(/^\d{2}\.\d{3}\.\d{3}\s+/, '');
    if (/mercadoli|mercado\*/i.test(k)) return 'Mercado Livre';
    if (/aliexpress/i.test(k)) return 'AliExpress';
    if (/^oculus/i.test(k)) return 'Oculus';
    if (/youtub/i.test(k)) return 'YouTube';
    if (/spotify/i.test(k)) return 'Spotify';
    if (/^google/i.test(k)) return 'Google';
    if (/loterias/i.test(k)) return 'Loterias online';
    k = k.replace(/\s+\d{8,}$/, '');
    return k === k.toUpperCase() ? k.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : k;
  };
  $('d-fechar').addEventListener('click', () => set({ categoria: null }));

  function drawDetail() {
    const p = P(), box = $('categoria-detalhe');
    box.hidden = !p.categoria;
    if (!p.categoria) return;
    const c = p.categoria, col = catColor[c] ?? '#ff7a1a';
    box.style.setProperty('--cat', col);
    const list = rows.filter((r) => r.tipo === 'Gasto' && filt(r));
    const slice = rows.filter((r) => r.tipo === 'Gasto' && filt(r, { categoria: true }));
    const tot = d3.sum(list, (r) => r.valor), all = d3.sum(slice, (r) => r.valor) || 1;
    const dias = DIAS[p.mes ?? ''] || 1;
    $('d-eyebrow').textContent = (p.mes ? cap(mesTexto(p.mes)) : periodoTexto()) + (p.origem ? ' · ' + (p.origem === 'Conta' ? 'só conta' : 'só cartão') : ' · conta e cartão');
    $('d-nome').textContent = c;
    countTo($('d-total'), tot, brl, true);
    $('d-qtd').textContent = list.length + ' · ' + Math.round(tot / all * 100) + '% dos gastos';
    $('d-medio').textContent = list.length ? brl(tot / list.length) : '—';
    $('d-dia').textContent = brl(tot / dias);
    const big = d3.greatest(list, (r) => r.valor);
    $('d-maior').textContent = big ? brl(big.valor) : '—';
    $('d-maior-onde').textContent = big ? placeName(big.descricao) + ' · ' + ddmm(big.data) : '';
    // vs previous month
    const delta = $('d-delta');
    const i = MS.indexOf(p.mes);
    if (p.mes && i > 0) {
      const prevM = MS[i - 1];
      const prev = d3.sum(rows.filter((r) => r.tipo === 'Gasto' && r.categoria === c && r.mes === prevM && (!p.origem || r.origem === p.origem)), (r) => r.valor);
      if (prev > 0) {
        const d = (tot - prev) / prev;
        delta.hidden = false; delta.className = 'fc-delta ' + (d > 0 ? 'up' : 'down');
        delta.textContent = (d > 0 ? '▲ ' : '▼ ') + Math.abs(Math.round(d * 100)) + '% vs ' + mesNome(prevM) + ' (' + brl(prev) + ')' + (parcial(prevM) || parcial(p.mes) ? ' · mês parcial' : '');
      } else delta.hidden = true;
    } else delta.hidden = true;
    // conta x cartao
    const cc = ['Conta', 'Cartão'].map((o) => [o, d3.sum(list.filter((r) => r.origem === o), (r) => r.valor)]);
    const sp = $('d-split'); sp.replaceChildren();
    if (!p.origem && tot > 0) {
      const bar = document.createElement('div'); bar.className = 'bar';
      cc.forEach(([, v], k) => { if (v <= 0) return; const s = document.createElement('i'); s.style.flex = String(v); s.style.background = col; s.style.opacity = k ? '.45' : '1'; bar.appendChild(s); });
      const leg = document.createElement('div'); leg.className = 'leg';
      cc.forEach(([o, v]) => { const s = document.createElement('span'); s.textContent = (o === 'Conta' ? 'Conta (Pix e débito) ' : 'Cartão de crédito ') + brl(v); leg.appendChild(s); });
      sp.append(bar, leg);
    }
    // top places
    const places = d3.rollups(list, (v) => ({ v: d3.sum(v, (r) => r.valor), n: v.length }), (r) => placeName(r.descricao)).sort((a, b) => b[1].v - a[1].v).slice(0, 8);
    const maxP = places.length ? places[0][1].v : 1;
    $('d-lugares').replaceChildren(...places.map(([name, s], k) => {
      const li = document.createElement('li');
      const n = document.createElement('span'); n.className = 'n'; n.textContent = name;
      const sm = document.createElement('small'); sm.textContent = s.n + 'x'; n.appendChild(sm);
      const v = document.createElement('span'); v.className = 'v'; v.textContent = brl(s.v);
      const tr = document.createElement('div'); tr.className = 'track';
      const fi = document.createElement('i'); fi.style.width = Math.max(2, s.v / maxP * 100) + '%'; tr.appendChild(fi);
      if (!calm) fi.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 600, delay: k * 50, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
      li.append(n, v, tr); return li;
    }));
    // over time
    const ch = $('d-tempo'); ch.querySelector('svg')?.remove();
    const fimEx = d3.utcDay.offset(new Date(fim + 'T00:00:00Z'), 1);
    let buckets, label, tipText;
    if (p.mes) {
      const a = new Date(p.mes + '-01T00:00:00Z'), end = d3.min([d3.utcMonth.offset(a, 1), fimEx]);
      buckets = d3.utcDay.range(a, end).map((d) => ({ d, k: d3.utcFormat('%Y-%m-%d')(d) }));
      for (const b of buckets) b.v = d3.sum(list.filter((r) => r.data === b.k), (r) => r.valor);
      label = (b) => b.d.getUTCDate() % 5 === 1 ? String(b.d.getUTCDate()) : '';
      tipText = (b) => ddmmaa(b.k);
      $('d-tempo-tit').textContent = 'Dia a dia';
    } else {
      const a = d3.utcMonday.floor(new Date(inicio + 'T00:00:00Z'));
      buckets = d3.utcMonday.range(a, fimEx).map((d) => ({ d, k: d3.utcFormat('%Y-%m-%d')(d) }));
      for (const b of buckets) { const e = d3.utcFormat('%Y-%m-%d')(d3.utcDay.offset(b.d, 7)); b.v = d3.sum(list.filter((r) => r.data >= b.k && r.data < e), (r) => r.valor); }
      const mensal = buckets.length > 26;
      label = (b) => b.d.getUTCDate() <= 7 && (!mensal || b.d.getUTCMonth() % 2 === 0) ? mesCurto(d3.utcFormat('%Y-%m')(b.d)) : '';
      tipText = (b) => 'Semana de ' + ddmmaa(b.k);
      $('d-tempo-tit').textContent = 'Semana a semana';
    }
    const W = Math.max(260, ch.clientWidth), H = 130, m = { t: 16, r: 2, b: 18, l: 2 };
    const x = d3.scaleBand(buckets.map((b) => b.k), [m.l, W - m.r]).padding(0.25);
    const y = d3.scaleLinear([0, (d3.max(buckets, (b) => b.v) || 1) * 1.15], [H - m.b, m.t]);
    const svg = d3.select(ch).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Gastos de ' + c + ' ao longo do tempo');
    const tt = tip(ch);
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', H - m.b).attr('y2', H - m.b).attr('stroke', 'var(--line)');
    const peak = d3.greatest(buckets, (b) => b.v);
    buckets.forEach((b, k) => {
      const h = (H - m.b) - y(b.v);
      if (b.v > 0) {
        const r = svg.append('rect').attr('x', x(b.k)).attr('width', x.bandwidth()).attr('rx', Math.min(4, x.bandwidth() / 2)).attr('fill', col)
          .attr('fill-opacity', b === peak ? 1 : .55)
          .on('mousemove', (ev) => tt.show(ev, tipText(b), brl(b.v))).on('mouseleave', tt.hide);
        if (calm) r.attr('y', y(b.v)).attr('height', h);
        else r.attr('y', H - m.b).attr('height', 0).transition().duration(600).delay(k * 15).ease(d3.easeCubicOut).attr('y', y(b.v)).attr('height', h);
      }
      const l = label(b);
      if (l) svg.append('text').attr('x', x(b.k) + x.bandwidth() / 2).attr('y', H - 4).attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', 'var(--dim)').text(l);
    });
    if (peak && peak.v > 0) svg.append('text').attr('x', Math.min(W - 4, Math.max(4, x(peak.k) + x.bandwidth() / 2))).attr('y', y(peak.v) - 6)
      .attr('text-anchor', x(peak.k) > W * .8 ? 'end' : x(peak.k) < W * .2 ? 'start' : 'middle').attr('font-size', 10.5).attr('fill', 'var(--fg)').text(brlK(peak.v));
  }

  function draw() {
    if ($('pg-gastos').hidden) return;
    const t = dash.data('transacoes'), s = dash.data('saldo');
    rows = t.status === 'ok' ? t.data.map((r) => ({ ...r, valor: Number(r.valor) })) : [];
    const saldo = s.status === 'ok' ? s.data.map((r) => ({ data: String(r.data), saldo: Number(r.saldo) })) : [];
    MS = [...new Set(rows.map((r) => r.mes))].sort();
    inicio = rows.length ? rows[0].data : hojeSP();
    fim = d3.max([hojeSP(), rows.at(-1)?.data ?? '']);
    ultimoAno = fim.slice(0, 4);
    DIAS[''] = diasEntre(inicio, fim);
    for (const m of MS) DIAS[m] = diasEntre(m === MS[0] ? inicio : m + '-01', m === MS.at(-1) ? fim : fimDoMes(m));
    drawControls();
    if (!rows.length) {
      $('h-total').textContent = 'R$ 0,00';
      $('h-tk').textContent = 'Nenhuma transação nos últimos 12 meses ainda. Se você acabou de conectar o banco, a Pluggy pode levar alguns minutos para trazer o histórico.';
      return;
    }
    drawKpis(saldo);
    drawMes();
    drawCat();
    drawSaldo(saldo);
    drawTable();
    drawDetail();
  }

  dash.onData(draw);
  return draw;
}

// ---------------------------------------------------------------- Investimentos

const IDXC = { CDI: '#ffbe7a', 'Pré': '#ff7a1a', IPCA: '#e85d04', Outros: '#a8430a' };
const IDXL = { CDI: 'Pós-fixado (CDI)', 'Pré': 'Prefixado', IPCA: 'Inflação (IPCA)', Outros: 'Outros' };
const PRODUTO = { CDB: 'CDB', LCI: 'LCI', LCA: 'LCA', TREASURY: 'Tesouro', DEBENTURES: 'Debênture', CRI: 'CRI', CRA: 'CRA', LC: 'LC', FIXED_INCOME: 'Renda fixa', MUTUAL_FUND: 'Fundo', INVESTMENT_FUND: 'Fundo', FIXED_INCOME_FUND: 'Fundo de renda fixa', RETIREMENT: 'Previdência', STOCK: 'Ações', ETF: 'ETF', REAL_ESTATE_FUND: 'Fundo imobiliário' };

function iniciarInvest(dash, $, calm) {
  const { countTo, tip } = utilidades(calm);
  const st = { idx: '', titulo: null, prazo: 12, aporte: null };
  let rows = [], movs = [];

  const chips = (box, items, current, onPick) => chipsCom(onPick)(box, items, current);

  const base = () => rows.filter((r) => (!st.idx || r.indexador === st.idx) && (!st.titulo || r.titulo_id === st.titulo));
  const anualMedia = (list) => {
    const com = list.filter((r) => r.anual != null && r.bruto > 0);
    const peso = d3.sum(com, (r) => r.bruto);
    return peso ? d3.sum(com, (r) => r.anual * r.bruto) / peso : null;
  };
  const cdiRef = () => rows.find((r) => /^100% do CDI$/i.test(r.taxa) && r.anual != null)?.anual ?? null;

  function controls() {
    const idxs = [...new Set(rows.map((r) => r.indexador))];
    chips($('iv-f-idx'), [['', 'Todos'], ...Object.keys(IDXL).filter((k) => idxs.includes(k)).map((k) => [k, IDXL[k]])], st.idx, (v) => { st.idx = v; st.titulo = null; draw(); });
    chips($('iv-prazo'), [[6, '6 meses'], [12, '1 ano'], [24, '2 anos'], [60, '5 anos']], st.prazo, (v) => { st.prazo = v; drawSim(); });
    $('iv-limpar').hidden = !(st.idx || st.titulo);
  }
  $('iv-limpar').addEventListener('click', () => { st.idx = ''; st.titulo = null; draw(); });
  $('iv-aporte').addEventListener('input', () => { const v = Number($('iv-aporte').value); st.aporte = Number.isFinite(v) && v >= 0 ? v : 0; drawSim(); });

  function heroKpis() {
    const list = base();
    const t = st.titulo ? rows.find((r) => r.titulo_id === st.titulo) : null;
    const bruto = d3.sum(list, (r) => r.bruto);
    const comApl = list.filter((r) => r.aplicado != null);
    const apl = d3.sum(comApl, (r) => r.aplicado);
    const rend = d3.sum(list.filter((r) => r.rendimento != null), (r) => r.rendimento);
    $('iv-lbl').textContent = (t ? (PRODUTO[t.produto] ?? t.produto) + ' ' + t.taxa : st.idx ? IDXL[st.idx] : 'Patrimônio investido') + ' · hoje';
    countTo($('iv-total'), bruto, brl, true);
    $('iv-tk').textContent = comApl.length ? `${brl(rend)} de rendimento bruto sobre ${brl(apl)} aplicados.` : `${list.length} ${list.length === 1 ? 'título' : 'títulos'}.`;
    countTo($('iv-rend'), rend, brl);
    $('iv-rend-sub').textContent = apl ? pct(rend / apl) + ' sobre o aplicado' : '';
    const ann = anualMedia(list), cdi = cdiRef();
    $('iv-ret').textContent = ann != null ? pct(ann, 1) + ' a.a.' : '—';
    $('iv-ret-sub').textContent = ann == null ? 'O banco não informou' : (list.length > 1 ? 'média pelo saldo' : 'ao ano') + (cdi && cdi > 0 ? ' · ' + Math.round(ann / cdi * 100) + '% do CDI' : '');
    countTo($('iv-apl'), apl, brl);
    $('iv-apl-sub').textContent = list.length + (list.length === 1 ? ' título' : ' títulos');
    const ir = d3.sum(list, (r) => r.ir), iof = d3.sum(list, (r) => r.iof);
    countTo($('iv-liq'), d3.sum(list, (r) => r.liquido), brl);
    $('iv-liq-sub').textContent = ir || iof ? 'Desconta ' + brl(ir) + ' de IR' + (iof > 0.005 ? ' e ' + brl(iof) + ' de IOF' : '') : 'Valor líquido informado pelo banco';
    const parts = d3.rollups(rows, (v) => d3.sum(v, (r) => r.bruto), (r) => r.indexador).sort((a, b) => b[1] - a[1]);
    const tot = d3.sum(parts, (p) => p[1]) || 1;
    $('iv-share').replaceChildren(...parts.map(([k, v], i) => {
      const e = document.createElement('i'); e.style.flex = String(v); e.style.background = IDXC[k];
      e.style.opacity = !st.idx || st.idx === k ? '1' : '.25'; e.title = IDXL[k] + ': ' + brl(v);
      e.addEventListener('click', () => { st.idx = st.idx === k ? '' : k; st.titulo = null; draw(); });
      if (!calm) e.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 600, delay: i * 60, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
      return e;
    }));
    $('iv-legend').replaceChildren(...parts.map(([k, v]) => {
      const e = document.createElement('span'); e.style.setProperty('--c', IDXC[k]); e.append(document.createTextNode(IDXL[k]));
      const b = document.createElement('b'); b.textContent = Math.round(v / tot * 100) + '%'; e.append(b); return e;
    }));
  }

  function semDados(box, texto) {
    const p = document.createElement('div'); p.className = 'fc-empty-note'; p.textContent = texto;
    box.replaceChildren(p);
  }

  function evo() {
    const box = $('iv-ch-evo'); box.replaceChildren();
    const list = base();
    const ids = new Set(list.map((r) => r.titulo_id));
    const ms = movs.filter((m) => ids.has(m.titulo_id));
    $('iv-leg-evo').replaceChildren();
    if (!ms.length) { semDados(box, 'O banco não enviou o histórico de aplicações desses títulos.'); return; }
    const porDia = d3.rollups(ms, (v) => ({ apl: d3.sum(v.filter((m) => m.tipo === 'Aplicação'), (m) => m.valor), res: d3.sum(v.filter((m) => m.tipo === 'Resgate'), (m) => m.valor) }), (m) => m.data).sort((a, b) => a[0].localeCompare(b[0]));
    let acc = 0;
    const data = porDia.map(([k, o]) => { acc += o.apl - o.res; return { d: new Date(k + 'T12:00:00Z'), k, v: acc, apl: o.apl, res: o.res }; });
    const hoje = hojeSP(), atual = d3.sum(list, (r) => r.bruto);
    const fimPt = { d: new Date(hoje + 'T12:00:00Z'), k: hoje, v: atual };
    const W = Math.max(260, box.clientWidth), H = 170, m = { t: 14, r: 10, b: 20, l: 10 };
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Evolução do patrimônio');
    const top = d3.max([...data.map((o) => o.v), atual]) || 1;
    const probe = svg.append('text').attr('font-size', 10.5).text(brlK(top)); m.l = probe.node().getComputedTextLength() + 10; probe.remove();
    const x = d3.scaleUtc([data[0].d, fimPt.d], [m.l, W - m.r]);
    const y = d3.scaleLinear([Math.min(0, d3.min(data, (o) => o.v)), top * 1.08], [H - m.b, m.t]).nice();
    for (const t of y.ticks(4)) {
      svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', 'var(--line)');
      svg.append('text').attr('x', m.l - 6).attr('y', y(t) + 3).attr('text-anchor', 'end').attr('font-size', 10.5).attr('fill', 'var(--dim)').text(brlK(t));
    }
    const marcos = d3.utcMonth.range(d3.utcMonth.ceil(x.domain()[0]), x.domain()[1]);
    const passo = Math.ceil(marcos.length / 8) || 1;
    marcos.forEach((mm, i) => {
      if (i % passo) return;
      const k = d3.utcFormat('%Y-%m')(mm);
      svg.append('text').attr('x', x(mm)).attr('y', H - 5).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('fill', 'var(--muted)').text(mesCurto(k) + (k.endsWith('-01') ? ' ' + k.slice(2, 4) : ''));
    });
    const serie = [...data, { ...fimPt, v: data.at(-1).v }];
    const g = svg.append('g');
    g.append('path').datum(serie).attr('fill', '#ffbe7a').attr('fill-opacity', .18).attr('d', d3.area((o) => x(o.d), y(0), (o) => y(o.v)).curve(d3.curveStepAfter));
    g.append('path').datum(serie).attr('fill', 'none').attr('stroke', 'var(--o3)').attr('stroke-width', 2).attr('stroke-linejoin', 'round').attr('d', d3.line((o) => x(o.d), (o) => y(o.v)).curve(d3.curveStepAfter));
    g.append('line').attr('x1', x(fimPt.d)).attr('x2', x(fimPt.d)).attr('y1', y(data.at(-1).v)).attr('y2', y(atual)).attr('stroke', 'var(--o1)').attr('stroke-width', 2).attr('stroke-dasharray', '3 3');
    if (!calm) {
      const clip = 'ivclip' + Math.random().toString(36).slice(2, 7);
      const cr = svg.append('clipPath').attr('id', clip).append('rect').attr('x', 0).attr('y', 0).attr('height', H).attr('width', 0);
      g.attr('clip-path', `url(#${clip})`); cr.transition().duration(1000).ease(d3.easeCubicOut).attr('width', W);
    }
    const tt = tip(box);
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent').style('touch-action', 'pan-y')
      .on('mousemove', (ev) => {
        const e = ev.touches ? ev.touches[0] : ev;
        const [mx] = d3.pointer(e, svg.node()); const when = x.invert(mx);
        const o = data.filter((q) => q.d <= when).at(-1) ?? data[0];
        tt.show(e, 'Até ' + ddmmaa(o.k), 'Aplicado líquido ' + brl(o.v));
      }).on('mouseleave', tt.hide);
    for (const o of data.filter((q) => q.apl > 0)) {
      svg.append('circle').attr('cx', x(o.d)).attr('cy', y(o.v)).attr('r', 4).attr('fill', 'var(--bg)').attr('stroke', 'var(--o6)').attr('stroke-width', 2)
        .on('mousemove', (ev) => tt.show(ev, 'Aplicação em ' + ddmmaa(o.k), '+ ' + brl(o.apl))).on('mouseleave', tt.hide);
    }
    svg.append('circle').attr('cx', x(fimPt.d)).attr('cy', y(atual)).attr('r', 9).attr('fill', '#ff7a1a').attr('fill-opacity', .2);
    svg.append('circle').attr('cx', x(fimPt.d)).attr('cy', y(atual)).attr('r', 4.5).attr('fill', 'var(--o1)')
      .on('mousemove', (ev) => tt.show(ev, 'Hoje', brl(atual) + ' com rendimento')).on('mouseleave', tt.hide);
    svg.append('text').attr('x', x(fimPt.d) - 10).attr('y', y(atual) - 10).attr('text-anchor', 'end').attr('font-size', 10.5).attr('fill', 'var(--o2)').text(brl(atual));
    const item = (cor, texto) => { const s = document.createElement('span'); const i = document.createElement('i'); i.style.background = cor; s.append(i, document.createTextNode(texto)); return s; };
    $('iv-leg-evo').replaceChildren(item('#ffbe7a', 'Aplicado menos resgates'), item('#ff7a1a', 'Valor hoje'), Object.assign(document.createElement('span'), { textContent: '○ aplicação' }));
  }

  function porMes() {
    const box = $('iv-ch-mes'); box.replaceChildren();
    const ids = new Set(base().map((r) => r.titulo_id));
    const hoje = hojeSP();
    const months = d3.utcMonth.range(d3.utcMonth.offset(new Date(hoje.slice(0, 7) + '-01T00:00:00Z'), -11), d3.utcMonth.offset(new Date(hoje.slice(0, 7) + '-01T00:00:00Z'), 1)).map(d3.utcFormat('%Y-%m'));
    const ms = movs.filter((m) => ids.has(m.titulo_id) && months.includes(m.data.slice(0, 7)));
    if (!ms.length) { semDados(box, 'Nenhuma aplicação ou resgate nos últimos 12 meses.'); return; }
    const data = months.map((m) => ({ m, a: d3.sum(ms.filter((q) => q.data.slice(0, 7) === m && q.tipo === 'Aplicação'), (q) => q.valor), r: d3.sum(ms.filter((q) => q.data.slice(0, 7) === m && q.tipo === 'Resgate'), (q) => q.valor) }));
    const W = Math.max(240, box.clientWidth), H = 150, mg = { t: 18, b: 20 };
    const x = d3.scaleBand(months, [4, W - 4]).padding(0.2);
    const x2 = d3.scaleBand(['a', 'r'], [0, x.bandwidth()]).padding(0.1);
    const y = d3.scaleLinear([0, (d3.max(data, (d) => Math.max(d.a, d.r)) || 1) * 1.15], [H - mg.b, mg.t]);
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Aplicações e resgates por mês');
    const tt = tip(box);
    data.forEach((d, i) => {
      for (const [k, cor, nome] of [['a', 'var(--o1)', 'Aplicações'], ['r', 'var(--o3)', 'Resgates']]) {
        if (!d[k]) continue;
        const h = (H - mg.b) - y(d[k]);
        const r = svg.append('rect').attr('x', x(d.m) + x2(k)).attr('width', x2.bandwidth()).attr('rx', 3).attr('fill', cor)
          .on('mousemove', (ev) => tt.show(ev, cap(mesNome(d.m)) + ' de ' + d.m.slice(0, 4) + ' · ' + nome, brl(d[k]))).on('mouseleave', tt.hide);
        if (calm) r.attr('y', y(d[k])).attr('height', h);
        else r.attr('y', H - mg.b).attr('height', 0).transition().duration(700).delay(i * 50).ease(d3.easeCubicOut).attr('y', y(d[k])).attr('height', h);
      }
      if (i % (x.bandwidth() < 22 ? 2 : 1) === 0) svg.append('text').attr('x', x(d.m) + x.bandwidth() / 2).attr('y', H - 5).attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', 'var(--muted)').text(mesCurto(d.m));
    });
  }

  function titulos() {
    const list = rows.filter((r) => !st.idx || r.indexador === st.idx);
    const totEnd = d3.sum(list, (r) => r.bruto) || 1;
    const items = list.slice().sort((a, b) => b.bruto - a.bruto);
    $('iv-body').replaceChildren(...items.map((it) => {
      const tr = document.createElement('tr'); tr.dataset.key = it.titulo_id; tr.setAttribute('aria-selected', String(st.titulo === it.titulo_id));
      const td = (txt, cls) => { const c = document.createElement('td'); if (cls) c.className = cls; c.textContent = txt; return c; };
      const n = td('', 'desc');
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = IDXC[it.indexador];
      n.append(dot, document.createTextNode(it.taxa));
      const tag = document.createElement('span'); tag.className = 'fc-tag'; tag.textContent = { CDI: 'pós', 'Pré': 'pré', IPCA: 'ipca' }[it.indexador] ?? 'outro'; n.append(tag);
      const meta = document.createElement('span'); meta.className = 'meta';
      meta.textContent = [PRODUTO[it.produto] ?? it.produto, it.vencimento ? 'vence ' + ddmmaa(it.vencimento) : '', Math.round(it.bruto / totEnd * 100) + '% da carteira'].filter(Boolean).join(' · ');
      n.append(meta);
      tr.append(n, td(brl(it.bruto), 'num'), td(it.rendimento != null ? '+ ' + brl(it.rendimento) : '—', 'num col-cat pos'), td(it.anual != null ? pct(it.anual, 1) : '—', 'num'));
      tr.addEventListener('click', () => { st.titulo = st.titulo === it.titulo_id ? null : it.titulo_id; draw(); });
      return tr;
    }));
  }

  function drawSim() {
    const list = base();
    if (!list.length) return;
    if (st.aporte === null) {
      const desde = d3.utcFormat('%Y-%m-%d')(d3.utcMonth.offset(new Date(), -12));
      const liq = d3.sum(movs.filter((m) => m.data >= desde), (m) => (m.tipo === 'Aplicação' ? 1 : -1) * m.valor);
      st.aporte = liq > 0 ? Math.round(liq / 12 / 100) * 100 : 500;
      $('iv-aporte').value = st.aporte;
    }
    controls();
    const a = anualMedia(list) ?? 0, rm = Math.pow(1 + a, 1 / 12) - 1, n = st.prazo, A = st.aporte || 0, V = d3.sum(list, (r) => r.bruto);
    const series = d3.range(n + 1).map((k) => ({ k, v: V * Math.pow(1 + rm, k) + (rm > 0 ? A * (Math.pow(1 + rm, k) - 1) / rm : A * k), ap: V + A * k }));
    const fv = series.at(-1).v, ap = A * n;
    $('iv-sim-fv').textContent = brl(fv);
    $('iv-sim-when').textContent = 'daqui a ' + (n < 12 ? n + ' meses' : n / 12 === 1 ? '1 ano' : n / 12 + ' anos');
    $('iv-sim-ap').textContent = brl(ap);
    $('iv-sim-j').textContent = brl(fv - V - ap);
    $('iv-sim-tx').textContent = a ? 'a ' + pct(a, 1) + ' ao ano' : 'sem taxa informada';
    const box = $('iv-ch-sim'); box.querySelector('svg')?.remove();
    const W = Math.max(240, box.clientWidth), H = 110, m = { t: 8, b: 16, l: 4, r: 4 };
    const x = d3.scaleLinear([0, n], [m.l, W - m.r]), y = d3.scaleLinear([0, (fv || 1) * 1.05], [H - m.b, m.t]);
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Simulação do patrimônio');
    svg.append('path').datum(series).attr('fill', '#ff7a1a').attr('fill-opacity', .12).attr('d', d3.area((s) => x(s.k), H - m.b, (s) => y(s.v)));
    svg.append('path').datum(series).attr('fill', '#ffdcb5').attr('fill-opacity', .12).attr('d', d3.area((s) => x(s.k), H - m.b, (s) => y(s.ap)));
    svg.append('path').datum(series).attr('fill', 'none').attr('stroke', 'var(--o1)').attr('stroke-width', 2).attr('d', d3.line((s) => x(s.k), (s) => y(s.v)));
    svg.append('path').datum(series).attr('fill', 'none').attr('stroke', 'var(--o6)').attr('stroke-width', 1.5).attr('stroke-dasharray', '4 3').attr('d', d3.line((s) => x(s.k), (s) => y(s.ap)));
    svg.append('text').attr('x', m.l).attr('y', H - 3).attr('font-size', 10).attr('fill', 'var(--dim)').text('hoje');
    svg.append('text').attr('x', W - m.r).attr('y', H - 3).attr('text-anchor', 'end').attr('font-size', 10).attr('fill', 'var(--dim)').text('linha tracejada: só o que você aplicou');
  }

  function draw() {
    const d = dash.data('investimentos'), mv = dash.data('movimentos');
    rows = d.status === 'ok' ? d.data : [];
    movs = mv.status === 'ok' ? mv.data : [];
    controls();
    if ($('pg-invest').hidden) return;
    if (!rows.length) {
      $('iv-total').textContent = 'R$ 0,00';
      $('iv-tk').textContent = 'Nenhum investimento encontrado nos bancos conectados.';
      return;
    }
    heroKpis(); evo(); porMes(); titulos(); drawSim();
  }

  dash.onData(draw);
  return draw;
}

// ---------------------------------------------------------------- Valores ocultos

function iniciarPrivacidade(app, btn) {
  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  const label = () => {
    const hidden = app.classList.contains('privado');
    btn.innerHTML = (hidden ? EYE : EYE_OFF) + '<span>' + (hidden ? 'Mostrar valores' : 'Ocultar valores') + '</span>';
    btn.setAttribute('aria-pressed', String(!hidden));
  };
  btn.addEventListener('click', () => { app.classList.toggle('privado'); label(); });
  label();
  // mark every element that shows money so the blur covers it, including charts and redraws
  const scan = () => {
    const w = document.createTreeWalker(app, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement;
      if (el && /R\$/.test(n.nodeValue) && !el.closest('.fc-eye') && !el.classList.contains('m')) el.classList.add('m');
    }
    for (const i of app.querySelectorAll('input[type=number]')) i.classList.add('m');
  };
  let queued = false;
  const obs = new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; scan(); }); } });
  obs.observe(app, { subtree: true, childList: true, characterData: true });
  scan();
  return () => obs.disconnect();
}

// ---------------------------------------------------------------- Entrada

export function iniciar(root, dados) {
  const $ = (id) => root.querySelector('#' + id);
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dash = criarDash({ transacoes: dados.transacoes, saldo: dados.saldo, investimentos: dados.investimentos, movimentos: dados.movimentos }, { tipo: 'Gasto' });

  const desenharGastos = iniciarGastos(dash, $, calm);
  const desenharInvest = iniciarInvest(dash, $, calm);

  const tabs = [...root.querySelectorAll('.fc-tabs button')];
  const show = (name, link = true) => {
    for (const b of tabs) b.setAttribute('aria-selected', String(b.dataset.tab === name));
    $('pg-gastos').hidden = name !== 'gastos';
    $('periodo').hidden = name !== 'gastos';
    $('pg-invest').hidden = name !== 'investimentos';
    if (link) dash.setLink(name);
    if (name === 'investimentos') desenharInvest(); else desenharGastos();
  };
  for (const b of tabs) b.addEventListener('click', () => show(b.dataset.tab));
  if (location.hash.slice(1) === 'investimentos') show('investimentos', false);

  const parar = iniciarPrivacidade($('fc-app'), $('fc-eye'));

  let t;
  let largura = window.innerWidth;
  const onResize = () => {
    if (window.innerWidth === largura) return; // mobile toolbars fire resize on scroll
    largura = window.innerWidth;
    clearTimeout(t); t = setTimeout(() => dash.redraw(), 150);
  };
  window.addEventListener('resize', onResize);
  return () => { window.removeEventListener('resize', onResize); parar(); };
}
