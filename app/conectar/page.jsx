'use client';
import { useEffect, useState } from 'react';

// Opens the Pluggy Connect widget so the bank (C6 via Open Finance) can be authorized,
// or re-authorized when a consent expires.
export default function Conectar() {
  const [bancos, setBancos] = useState(null);
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [novo, setNovo] = useState(null);

  useEffect(() => {
    fetch('/api/dados').then((r) => r.json()).then((d) => setBancos(d.bancos ?? [])).catch(() => setBancos([]));
  }, []);

  async function abrir(itemId) {
    setOcupado(true); setMsg('');
    try {
      const res = await fetch('/api/connect-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.erro);
      const { PluggyConnect } = await import('pluggy-connect-sdk');
      const widget = new PluggyConnect({
        connectToken: body.accessToken,
        includeSandbox: body.sandbox,
        updateItem: itemId,
        language: 'pt',
        theme: 'dark',
        countries: ['BR'],
        onSuccess: async ({ item }) => {
          await fetch('/api/itens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: item.id }) }).catch(() => null);
          setNovo({ id: item.id, nome: item.connector?.name ?? 'Banco', jaSalvo: !!bancos?.find((b) => b.id === item.id)?.salvo });
          setOcupado(false);
        },
        onError: (e) => { setMsg('A conexão não deu certo: ' + (e?.message ?? 'erro desconhecido')); setOcupado(false); },
        onClose: () => setOcupado(false),
      });
      await widget.init();
    } catch (e) {
      setMsg(String(e?.message ?? e)); setOcupado(false);
    }
  }

  return (
    <div className="fc">
      <div className="fc-top">
        <h1>Finanças <span>C6</span></h1>
        <div className="acoes"><a className="fc-btn" href="/">Voltar</a></div>
      </div>
      <section className="fc-vazio">
        <h2>Conectar banco</h2>
        <p>A autorização é feita pela Pluggy, via Open Finance. Você escolhe o C6 Bank, confirma no app do banco e volta para cá. O app só lê os dados, não faz pagamentos.</p>
        <button type="button" className="fc-btn primario" disabled={ocupado} onClick={() => abrir()}>Conectar um banco</button>
      </section>
      {novo && (
        <section className="fc-vazio" style={{ border: '1px solid var(--o1)' }}>
          <h2>{novo.nome} conectado</h2>
          {novo.jaSalvo ? <p>Autorização renovada. Nada mais a fazer.</p> : (
            <>
              <p>Já funciona neste aparelho. Para valer em todos e para a atualização diária, cadastre este código na Vercel como <b>PLUGGY_ITEM_IDS</b> e faça um novo deploy:</p>
              <code style={{ background: 'var(--panel-2)', padding: '.5rem .7rem', borderRadius: 8, userSelect: 'all', overflowWrap: 'anywhere' }}>{novo.id}</code>
              <button type="button" className="fc-btn" onClick={() => navigator.clipboard?.writeText(novo.id).then(() => setMsg('Código copiado.'))}>Copiar código</button>
            </>
          )}
          <a className="fc-btn primario" href="/">Ir para o painel</a>
        </section>
      )}
      {bancos?.length > 0 && (
        <section className="fc-vazio">
          <h2>Bancos conectados</h2>
          {bancos.map((b) => (
            <div key={b.id} className="fc-row" style={{ justifyContent: 'space-between', width: '100%' }}>
              <span>{b.nome}{b.consenteAte ? ` · autorizado até ${b.consenteAte.split('-').reverse().join('/')}` : ''}{b.status !== 'UPDATED' ? ` · ${b.status}` : ''}{b.salvo ? '' : ' · só neste aparelho'}</span>
              <button type="button" className="fc-btn" disabled={ocupado} onClick={() => abrir(b.id)}>Renovar autorização</button>
            </div>
          ))}
        </section>
      )}
      {msg && <div className="fc-aviso">{msg}</div>}
    </div>
  );
}
