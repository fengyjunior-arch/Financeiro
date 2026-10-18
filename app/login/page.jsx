'use client';
import { useState } from 'react';

export default function Login() {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setEnviando(true); setErro('');
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senha }) }).catch(() => null);
    if (res?.ok) { window.location.href = '/'; return; }
    const body = await res?.json().catch(() => ({}));
    setErro(body?.erro ?? 'Não consegui entrar. Tente de novo.');
    setEnviando(false);
  }

  return (
    <main className="fc-login">
      <form onSubmit={entrar}>
        <h1>Finanças <span>C6</span></h1>
        <input type="password" autoComplete="current-password" placeholder="Senha" aria-label="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus />
        {erro && <p className="erro">{erro}</p>}
        <button type="submit" disabled={enviando || !senha}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  );
}
