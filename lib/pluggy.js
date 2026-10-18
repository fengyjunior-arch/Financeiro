import { PluggyClient } from 'pluggy-sdk';

let client;

export function pluggyConfigured() {
  return !!(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);
}

export function pluggy() {
  if (!pluggyConfigured()) throw new Error('Faltam PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET nas variáveis de ambiente.');
  client ??= new PluggyClient({ clientId: process.env.PLUGGY_CLIENT_ID, clientSecret: process.env.PLUGGY_CLIENT_SECRET });
  return client;
}

export const COOKIE_ITENS = 'fin_itens';

// Item ids saved in Vercel (PLUGGY_ITEM_IDS). Pluggy only lists a team's items on paid plans,
// so the app keeps the ids itself.
export function idsFixos() {
  return (process.env.PLUGGY_ITEM_IDS ?? '').split(/[\s,;]+/).filter(Boolean);
}

// Ids connected on this device but not yet saved in Vercel live in a cookie.
export function idsDoCookie(valor) {
  return (valor ?? '').split(',').filter((s) => /^[0-9a-f-]{36}$/i.test(s));
}

export async function listItems(extras = []) {
  const ids = [...new Set([...idsFixos(), ...extras])];
  const items = await Promise.all(ids.map((id) => pluggy().fetchItem(id).catch((e) => {
    if (e?.code === 404 || /not found/i.test(e?.message ?? '')) return null; // removed in Pluggy
    throw e;
  })));
  return items.filter(Boolean);
}

export async function fetchAllPages(fn) {
  const out = [];
  for (let page = 1; ; page++) {
    const res = await fn(page);
    out.push(...(res.results ?? []));
    if (!res.totalPages || page >= res.totalPages) return out;
  }
}
