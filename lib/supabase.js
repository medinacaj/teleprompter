/* Cliente mínimo de Supabase (Auth + REST) sin dependencias. Solo se usa en el servidor. */
export function supabaseConfig(env = process.env) {
  const url = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const anon = env.SUPABASE_ANON_KEY || '';
  const service = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) return null;
  if (!anon || !service) return null;
  return { url, anon, service };
}

async function call(fetcher, url, options) {
  const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(10000) });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

const authHeaders = (cfg, token) => ({
  apikey: cfg.anon, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {})
});
const serviceHeaders = cfg => ({
  apikey: cfg.service, Authorization: 'Bearer ' + cfg.service, 'Content-Type': 'application/json'
});

export const signIn = (cfg, email, password, fetcher = fetch) =>
  call(fetcher, cfg.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: authHeaders(cfg), body: JSON.stringify({ email, password }) });

export const signUp = (cfg, email, password, redirectTo, fetcher = fetch) =>
  call(fetcher, cfg.url + '/auth/v1/signup?redirect_to=' + encodeURIComponent(redirectTo), { method: 'POST', headers: authHeaders(cfg), body: JSON.stringify({ email, password }) });

export const refreshSession = (cfg, refreshToken, fetcher = fetch) =>
  call(fetcher, cfg.url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: authHeaders(cfg), body: JSON.stringify({ refresh_token: refreshToken }) });

export const recover = (cfg, email, redirectTo, fetcher = fetch) =>
  call(fetcher, cfg.url + '/auth/v1/recover?redirect_to=' + encodeURIComponent(redirectTo), { method: 'POST', headers: authHeaders(cfg), body: JSON.stringify({ email }) });

export const updatePassword = (cfg, accessToken, password, fetcher = fetch) =>
  call(fetcher, cfg.url + '/auth/v1/user', { method: 'PUT', headers: authHeaders(cfg, accessToken), body: JSON.stringify({ password }) });

export const signOut = (cfg, accessToken, fetcher = fetch) =>
  call(fetcher, cfg.url + '/auth/v1/logout', { method: 'POST', headers: authHeaders(cfg, accessToken) });

/* Valida el token con Supabase (no basta con decodificarlo). Devuelve el usuario o null. */
export async function getUser(cfg, accessToken, fetcher = fetch) {
  if (!accessToken || accessToken.length > 4096) return null;
  try {
    const r = await call(fetcher, cfg.url + '/auth/v1/user', { headers: authHeaders(cfg, accessToken) });
    return r.ok && r.body && typeof r.body.id === 'string' ? { id: r.body.id, email: r.body.email || '' } : null;
  } catch (e) { return null; }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = v => typeof v === 'string' && UUID.test(v);

export async function getSubscription(cfg, userId, fetcher = fetch) {
  if (!isUuid(userId)) return null;
  const r = await call(fetcher, cfg.url + '/rest/v1/subscriptions?user_id=eq.' + userId +
    '&select=status,provider,provider_subscription_id,plan_id,current_period_end&limit=1', { headers: serviceHeaders(cfg) });
  if (!r.ok) throw new Error('Supabase: HTTP ' + r.status);
  return Array.isArray(r.body) && r.body[0] ? r.body[0] : null;
}

export async function upsertSubscription(cfg, row, fetcher = fetch) {
  if (!isUuid(row.user_id)) throw new Error('Usuario inválido');
  const r = await call(fetcher, cfg.url + '/rest/v1/subscriptions?on_conflict=user_id', {
    method: 'POST',
    headers: { ...serviceHeaders(cfg), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ ...row, updated_at: new Date().toISOString() })
  });
  if (!r.ok) throw new Error('Supabase: HTTP ' + r.status);
}

/* Registro idempotente de eventos: devuelve false si el evento ya se había procesado. */
export async function recordEvent(cfg, event, fetcher = fetch) {
  const r = await call(fetcher, cfg.url + '/rest/v1/billing_events', {
    method: 'POST',
    headers: { ...serviceHeaders(cfg), Prefer: 'return=minimal' },
    body: JSON.stringify(event)
  });
  if (r.status === 409) return false;
  if (!r.ok) throw new Error('Supabase: HTTP ' + r.status);
  return true;
}
