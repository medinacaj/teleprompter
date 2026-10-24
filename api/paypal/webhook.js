/* Webhook de PayPal: firma verificada, idempotente y sin guardar datos personales del pagador. */
import { supabaseConfig, recordEvent } from '../../lib/supabase.js';
import { paypalConfig, verifyWebhook, validSubscriptionId } from '../../lib/paypal.js';
import { syncPaypalSubscription } from '../../lib/billing.js';
import { send, body } from '../../lib/http.js';

/* Identificador de la suscripción según el tipo de evento. */
export function subscriptionIdOf(event) {
  const r = event && event.resource || {};
  if (String(event && event.event_type).startsWith('BILLING.SUBSCRIPTION.')) return r.id;
  return r.billing_agreement_id || null;   // PAYMENT.SALE.*
}

export async function handleWebhook({ headers, event, db, paypal, fetcher = fetch }) {
  if (!event || typeof event.id !== 'string' || typeof event.event_type !== 'string') return { status: 400 };
  if (!(await verifyWebhook(paypal, headers, event, fetcher))) return { status: 401 };
  const subId = subscriptionIdOf(event);
  // Se sincroniza antes de registrar el evento: si falla, PayPal reintenta y el reintento no se descarta.
  // La sincronización consulta el estado real en PayPal, así que repetirla es inofensivo.
  if (validSubscriptionId(subId)) await syncPaypalSubscription({ db, paypal, subscriptionId: subId, fetcher });
  const fresh = await recordEvent(db, { id: event.id.slice(0, 100), provider: 'paypal', type: event.event_type.slice(0, 100), resource_id: validSubscriptionId(subId) ? subId : null }, fetcher);
  return { status: 200, duplicate: !fresh };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  const db = supabaseConfig();
  let paypal = null;
  try { paypal = paypalConfig(); } catch (e) { paypal = null; }
  if (!db || !paypal) return send(res, 503, { error: 'No configurado' });
  try {
    const r = await handleWebhook({ headers: req.headers, event: await body(req), db, paypal });
    send(res, r.status, { ok: r.status === 200 });
  } catch (e) {
    send(res, 500, { ok: false });   // PayPal reintenta los webhooks fallidos
  }
}
