/* Cliente PayPal de servidor (adaptado del PR #4). Los secretos solo existen en variables de entorno. */
import { randomUUID } from 'node:crypto';

const API = { sandbox: 'https://api-m.sandbox.paypal.com', live: 'https://api-m.paypal.com' };

/* Devuelve null si PayPal todavía no está configurado (modo «próximamente»). */
export function paypalConfig(env = process.env) {
  const keys = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_PLAN_ID', 'PAYPAL_WEBHOOK_ID'];
  if (keys.some(k => !env[k])) return null;
  const mode = env.PAYPAL_MODE || 'sandbox';
  if (!Object.hasOwn(API, mode)) throw new Error('PAYPAL_MODE debe ser sandbox o live');
  if (mode === 'live' && env.PAYPAL_LIVE_ENABLED !== 'true') throw new Error('Live bloqueado hasta aprobación explícita');
  return { mode, base: API[mode], clientId: env.PAYPAL_CLIENT_ID, secret: env.PAYPAL_CLIENT_SECRET, planId: env.PAYPAL_PLAN_ID, webhookId: env.PAYPAL_WEBHOOK_ID };
}

async function request(url, options, fetcher) {
  const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(12000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('PayPal API: HTTP ' + response.status);
  return payload;
}

export async function accessToken(cfg, fetcher = fetch) {
  const auth = Buffer.from(cfg.clientId + ':' + cfg.secret).toString('base64');
  const body = await request(cfg.base + '/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  }, fetcher);
  if (!body.access_token) throw new Error('PayPal no devolvió token');
  return body.access_token;
}

export async function createSubscription(cfg, { returnUrl, cancelUrl, referenceId }, fetcher = fetch) {
  if (!referenceId || typeof referenceId !== 'string' || referenceId.length > 127) throw new Error('Referencia interna inválida');
  for (const url of [returnUrl, cancelUrl]) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') throw new Error('URL de retorno no segura');
  }
  const token = await accessToken(cfg, fetcher);
  const data = await request(cfg.base + '/v1/billing/subscriptions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'PayPal-Request-Id': randomUUID() },
    body: JSON.stringify({
      plan_id: cfg.planId,
      custom_id: referenceId,
      application_context: { brand_name: 'Prompter', user_action: 'SUBSCRIBE_NOW', shipping_preference: 'NO_SHIPPING', return_url: returnUrl, cancel_url: cancelUrl }
    })
  }, fetcher);
  return { id: data.id, status: data.status, approvalUrl: data.links?.find(link => link.rel === 'approve')?.href || null };
}

export const validSubscriptionId = id => typeof id === 'string' && /^I-[A-Z0-9]{6,40}$/i.test(id);

export async function getSubscription(cfg, subscriptionId, fetcher = fetch) {
  if (!validSubscriptionId(subscriptionId)) throw new Error('ID de suscripción inválido');
  const token = await accessToken(cfg, fetcher);
  return request(cfg.base + '/v1/billing/subscriptions/' + encodeURIComponent(subscriptionId), {
    headers: { Authorization: 'Bearer ' + token }
  }, fetcher);
}

export async function verifyWebhook(cfg, headers, event, fetcher = fetch) {
  const get = key => headers[key] || headers[key.toLowerCase()];
  const required = ['paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id', 'paypal-transmission-sig', 'paypal-transmission-time'];
  if (required.some(key => !get(key))) return false;
  const token = await accessToken(cfg, fetcher);
  const result = await request(cfg.base + '/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo: get('paypal-auth-algo'), cert_url: get('paypal-cert-url'),
      transmission_id: get('paypal-transmission-id'), transmission_sig: get('paypal-transmission-sig'),
      transmission_time: get('paypal-transmission-time'), webhook_id: cfg.webhookId, webhook_event: event
    })
  }, fetcher);
  return result.verification_status === 'SUCCESS';
}
