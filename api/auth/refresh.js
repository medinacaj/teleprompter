/* Renueva la sesión con la cookie de renovación y vuelve a la página solicitada. */
import { supabaseConfig, refreshSession } from '../../lib/supabase.js';
import { send, redirect, isSecure } from '../../lib/http.js';
import { parseCookies, sessionCookies, clearSessionCookies, REFRESH } from '../../lib/cookies.js';
import { safeNext } from '../../lib/subscription.js';

export default async function handler(req, res) {
  const cfg = supabaseConfig();
  if (!cfg) return send(res, 503, { error: 'Servicio no configurado' });
  const next = safeNext(new URL(req.url, 'http://x').searchParams.get('next'));
  const token = parseCookies(req.headers.cookie)[REFRESH];
  const r = token ? await refreshSession(cfg, token).catch(() => ({ ok: false })) : { ok: false };
  if (r.ok && r.body && r.body.access_token) return redirect(res, next, sessionCookies(r.body, isSecure(req)));
  return redirect(res, '/login/?next=' + encodeURIComponent(next), clearSessionCookies(isSecure(req)));
}
