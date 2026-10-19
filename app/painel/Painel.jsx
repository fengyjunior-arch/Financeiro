'use client';
import { useEffect, useRef, useState } from 'react';
import { TEMPLATE } from './template';

const hora = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function Painel() {
  const ref = useRef(null);
  const [estado, setEstado] = useState({ fase: 'carregando' });

  async function carregar(fresco, avisosExtras = []) {
    try {
      const res = await fetch('/api/dados' + (fresco ? '?fresco=1' : ''), { cache: 'no-store' });
      if (res.status === 401) { window.location.href = '/login'; return; }
      const body = await res.json();
      if (!res.ok) throw new Error(body.erro ?? 'Erro ao carregar.');
      setEstado({ fase: 'ok', dados: { ...body, avisos: [...avisosExtras, ...(body.avisos ?? [])] } });
    } catch (e) {
      setEstado({ fase: 'erro', erro: String(e?.message ?? e) });
    }
  }

  // Asks Pluggy to pull fresh data from the bank, waits for it to finish, then reloads the painel.
  async function sincronizar(btn) {
    btn.disabled = true;
    btn.textContent = 'Buscando no banco…';
    let avisos = [];
    try {
      const res = await fetch('/api/sincronizar', { method: 'POST' });
      let body = await res.json();
      avisos = (body.bancos ?? []).filter((b) => b.erro).map((b) => `${b.banco} não aceitou atualizar agora: ${b.erro}`);
      const fim = Date.now() + 120000;
      while (body.emAndamento && Date.now() < fim) {
        await new Promise((r) => setTimeout(r, 4000));
        body = await (await fetch('/api/sincronizar', { cache: 'no-store' })).json();
      }
      if (body.emAndamento) avisos.push('O banco ainda está enviando os dados. Toque em Atualizar de novo em alguns minutos.');
    } catch {
      avisos.push('Não consegui pedir a atualização ao banco agora.');
    }
    btn.textContent = 'Carregando…';
    await carregar(true, avisos);
  }

  useEffect(() => { carregar(false); }, []);

  useEffect(() => {
    if (estado.fase !== 'ok' || !estado.dados.bancos.length || !ref.current) return;
    const root = ref.current, dados = estado.dados;
    root.innerHTML = TEMPLATE;
    let parar = () => {};
    import('./motor').then(({ iniciar }) => {
      parar = iniciar(root, dados);
      const q = (id) => root.querySelector('#' + id);
      q('fc-sync').textContent = 'Dados de ' + hora(dados.atualizadoEm) + (dados.sincronizadoEm ? ' · banco sincronizado em ' + hora(dados.sincronizadoEm) : '');
      const btn = q('fc-atualizar');
      btn.addEventListener('click', () => sincronizar(btn));
      q('fc-sair').addEventListener('click', async () => { await fetch('/api/logout', { method: 'POST' }); window.location.href = '/login'; });
      q('fc-avisos').replaceChildren(...dados.avisos.map((a) => Object.assign(document.createElement('div'), { className: 'fc-aviso', textContent: a })));
    });
    return () => parar();
  }, [estado]);

  if (estado.fase === 'carregando') return <Casca><div className="fc-vazio"><p>Carregando seus dados…</p></div></Casca>;
  if (estado.fase === 'erro') {
    return (
      <Casca>
        <div className="fc-aviso">{estado.erro}</div>
        <div className="fc-row"><button type="button" className="fc-btn" onClick={() => { setEstado({ fase: 'carregando' }); carregar(true); }}>Tentar de novo</button></div>
      </Casca>
    );
  }
  if (!estado.dados.bancos.length) {
    return (
      <Casca>
        <section className="fc-vazio">
          <h2>Conecte o C6 Bank</h2>
          <p>Nenhum banco conectado ainda. A autorização é feita via Open Finance, pelo app do banco, e leva um minuto.</p>
          <a className="fc-btn primario" href="/conectar">Conectar banco</a>
        </section>
      </Casca>
    );
  }
  return <div ref={ref} />;
}

function Casca({ children }) {
  return (
    <div className="fc">
      <div className="fc-top"><h1>Finanças <span>C6</span></h1></div>
      {children}
    </div>
  );
}
