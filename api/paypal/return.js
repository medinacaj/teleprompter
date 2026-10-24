/* Retorno desde PayPal: se verifica la suscripción directamente con PayPal; la URL por sí sola no activa nada. */
import { supabaseConfig } from '../../lib/supabase.js';
import { paypalConfig, validSubscriptionId } from '../../lib/paypal.js';
import { syncPaypalSubscription } from '../../lib/billing.js';
import { redirect, session } from '../../lib/http.js';

export default async function handler(req, res) {
  const cfg = supabaseConfig();
  let paypal = null;
  try { paypal = paypalConfig(); } catch (e) { paypal = null; }
  if (!cfg || !paypal) return redirect(res, '/cuenta/');
  const s = await session(req, cfg);
  if (!s.user) return redirect(res, '/login/?next=%2Fcuenta%2F', s.setCookies);
  const id = new URL(req.url, 'http://x').searchParams.get('subscription_id');
  if (!validSubscriptionId(id)) return redirect(res, '/cuenta/?pago=error', s.setCookies);
  try {
    const r = await syncPaypalSubscription({ db: cfg, paypal, subscriptionId: id, expectedUserId: s.user.id });
    redirect(res, '/cuenta/?pago=' + (r.status === 'active' ? 'ok' : 'pendiente'), s.setCookies);
  } catch (e) { redirect(res, '/cuenta/?pago=error', s.setCookies); }
}
