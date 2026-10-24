/* Estado de la cuenta para /cuenta/ y la verificación periódica del lector. */
import { supabaseConfig, getSubscription } from '../../lib/supabase.js';
import { paypalConfig } from '../../lib/paypal.js';
import { send, session } from '../../lib/http.js';
import { isActive } from '../../lib/subscription.js';
import { demoAllowed } from '../../lib/demo.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido' });
  const cfg = supabaseConfig();
  if (!cfg) return send(res, 503, { error: 'Servicio no configurado' });
  const s = await session(req, cfg);
  let paypalReady = false;
  try { paypalReady = !!paypalConfig(); } catch (e) { paypalReady = false; }
  const billing = { price: 'US$1,00', interval: 'mes', paypalReady, demoAvailable: demoAllowed() };
  if (!s.user) return send(res, 401, { authenticated: false, active: false, billing }, s.setCookies);
  let sub = null;
  try { sub = await getSubscription(cfg, s.user.id); } catch (e) { return send(res, 503, { error: 'No se pudo consultar la suscripción.' }, s.setCookies); }
  send(res, 200, {
    authenticated: true, email: s.user.email, active: isActive(sub),
    status: sub ? sub.status : 'none', provider: sub ? sub.provider : null,
    currentPeriodEnd: sub ? sub.current_period_end : null, billing
  }, s.setCookies);
}
