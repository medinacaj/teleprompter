/* Activa 7 días de acceso de demostración (solo en entornos de vista previa con BILLING_DEMO=true). */
import { supabaseConfig, upsertSubscription, getSubscription } from '../../lib/supabase.js';
import { send, checkPost, session } from '../../lib/http.js';
import { demoAllowed } from '../../lib/demo.js';

export default async function handler(req, res) {
  if (!checkPost(req, res)) return;
  if (!demoAllowed()) return send(res, 404, { error: 'No disponible' });
  const cfg = supabaseConfig();
  if (!cfg) return send(res, 503, { error: 'Servicio no configurado' });
  const s = await session(req, cfg);
  if (!s.user) return send(res, 401, { error: 'Inicia sesión.' }, s.setCookies);
  const current = await getSubscription(cfg, s.user.id).catch(() => null);
  if (current && current.provider === 'paypal') return send(res, 409, { error: 'Ya tienes una suscripción de PayPal.' }, s.setCookies);
  await upsertSubscription(cfg, { user_id: s.user.id, status: 'trialing', provider: 'demo', provider_subscription_id: null, plan_id: 'demo',
    current_period_end: new Date(Date.now() + 7 * 86400000).toISOString() });
  send(res, 200, { ok: true }, s.setCookies);
}
