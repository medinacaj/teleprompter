/* Crea la suscripción en PayPal y devuelve el enlace de aprobación. El acceso se activa solo tras verificarla. */
import { supabaseConfig, upsertSubscription, getSubscription } from '../../lib/supabase.js';
import { paypalConfig, createSubscription } from '../../lib/paypal.js';
import { send, checkPost, session, origin } from '../../lib/http.js';
import { isActive } from '../../lib/subscription.js';

export default async function handler(req, res) {
  if (!checkPost(req, res)) return;
  const cfg = supabaseConfig();
  let paypal = null;
  try { paypal = paypalConfig(); } catch (e) { paypal = null; }
  if (!cfg || !paypal) return send(res, 503, { error: 'El pago con PayPal estará disponible pronto.' });
  const s = await session(req, cfg);
  if (!s.user) return send(res, 401, { error: 'Inicia sesión.' }, s.setCookies);
  const current = await getSubscription(cfg, s.user.id).catch(() => null);
  if (current && current.provider === 'paypal' && isActive(current)) return send(res, 409, { error: 'Tu suscripción ya está activa.' }, s.setCookies);
  try {
    const base = origin(req);
    const created = await createSubscription(paypal, { referenceId: s.user.id, returnUrl: base + '/api/paypal/return', cancelUrl: base + '/cuenta/?pago=cancelado' });
    if (!created.approvalUrl) throw new Error('Sin enlace de aprobación');
    await upsertSubscription(cfg, { user_id: s.user.id, status: 'pending', provider: 'paypal', provider_subscription_id: created.id, plan_id: paypal.planId });
    send(res, 200, { approvalUrl: created.approvalUrl }, s.setCookies);
  } catch (e) {
    send(res, 502, { error: 'No se pudo iniciar el pago. Inténtalo más tarde.' }, s.setCookies);
  }
}
