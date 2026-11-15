// Small key-value store for what the app itself keeps (fixed expenses). Uses Upstash Redis over its
// REST API, which Vercel sets up from Storage → Upstash Redis with these variables.
const url = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const kvConfigured = () => !!(url() && token());

async function comando(...args) {
  const res = await fetch(url(), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(body.error ?? 'Erro ' + res.status + ' no armazenamento.');
  return body.result;
}

export async function kvGet(key) {
  const v = await comando('GET', key);
  return v == null ? null : JSON.parse(v);
}

export const kvSet = (key, value) => comando('SET', key, JSON.stringify(value));
