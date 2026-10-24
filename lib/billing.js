/* Sincroniza una suscripción de PayPal con la base de datos, usando a PayPal como fuente de verdad. */
import { getSubscription as getPaypal } from './paypal.js';
import { upsertSubscription, isUuid } from './supabase.js';
import { fromPaypalStatus } from './subscription.js';

/*
 * expectedUserId: si se indica (retorno desde PayPal), la suscripción debe pertenecer a ese usuario.
 * Se rechaza un plan distinto del configurado: impide activar acceso con un plan más barato creado por terceros.
 */
export async function syncPaypalSubscription({ db, paypal, subscriptionId, expectedUserId = null, fetcher = fetch }) {
  const sub = await getPaypal(paypal, subscriptionId, fetcher);
  const userId = sub.custom_id;
  if (!isUuid(userId)) throw new Error('Suscripción sin usuario interno');
  if (expectedUserId && userId !== expectedUserId) throw new Error('La suscripción pertenece a otro usuario');
  if (sub.plan_id !== paypal.planId) throw new Error('Plan no autorizado');
  const status = fromPaypalStatus(sub.status);
  if (!status) throw new Error('Estado de PayPal desconocido');
  const next = sub.billing_info && sub.billing_info.next_billing_time;
  const row = { user_id: userId, status, provider: 'paypal', provider_subscription_id: sub.id, plan_id: sub.plan_id };
  // Al cancelar, PayPal ya no informa el próximo cobro: se conserva la fecha de fin guardada.
  if (next) row.current_period_end = next;
  await upsertSubscription(db, row, fetcher);
  return { userId, status };
}
