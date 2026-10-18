// Login session: a cookie holding "<expiry>.<hmac>", signed with a key derived from APP_PASSWORD.
// Uses Web Crypto so the same code runs in the proxy and in route handlers.

export const COOKIE = 'fin_sessao';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function key() {
  const pass = process.env.APP_PASSWORD;
  if (!pass) return null;
  return crypto.subtle.importKey('raw', enc.encode('financeiro-sessao|' + pass), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function sign(text) {
  const k = await key();
  return k ? hex(await crypto.subtle.sign('HMAC', k, enc.encode(text))) : null;
}

function sameText(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSession() {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  return { value: exp + '.' + (await sign(exp)), maxAge: MAX_AGE };
}

export async function validSession(value) {
  if (!value) return false;
  const [exp, mac] = value.split('.');
  if (!exp || !mac || Number(exp) < Date.now() / 1000) return false;
  const expected = await sign(exp);
  return !!expected && sameText(mac, expected);
}

export async function checkPassword(input) {
  const pass = process.env.APP_PASSWORD;
  if (!pass || typeof input !== 'string') return false;
  // compare digests so length differences don't leak
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(input)), crypto.subtle.digest('SHA-256', enc.encode(pass))]);
  return sameText(hex(a), hex(b));
}
