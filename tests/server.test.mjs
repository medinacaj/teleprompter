import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isActive, fromPaypalStatus, safeNext } from '../lib/subscription.js';
import { parseCookies, sessionCookies, clearSessionCookies } from '../lib/cookies.js';
import { supabaseConfig } from '../lib/supabase.js';
import { paypalConfig, createSubscription, verifyWebhook } from '../lib/paypal.js';
import { syncPaypalSubscription } from '../lib/billing.js';
import { gate } from '../lib/gate.js';
import { demoAllowed } from '../lib/demo.js';
import { handleWebhook, subscriptionIdOf } from '../api/paypal/webhook.js';
import { checkPost } from '../lib/http.js';

const USER = '11111111-2222-4333-8444-555555555555';
const env = { SUPABASE_URL: 'https://abcdefgh.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' };
const ppEnv = { PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'secret', PAYPAL_PLAN_ID: 'P-MONTHLY', PAYPAL_WEBHOOK_ID: 'WH-1' };
const db = supabaseConfig(env);
const paypal = paypalConfig(ppEnv);

/* Simula fetch por ruta; registra las llamadas. */
function mockFetch(routes, calls = []) {
  return async (url, options = {}) => {
    calls.push({ url: String(url), options });
    for (const [pattern, reply] of routes) {
      if (String(url).includes(pattern)) {
        const r = typeof reply === 'function' ? reply(url, options) : reply;
        return { ok: (r.status || 200) < 400, status: r.status || 200, json: async () => r.body };
      }
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
}

test('reglas de acceso de la suscripción', () => {
  const now = Date.parse('2026-10-24T00:00:00Z');
  assert.equal(isActive(null, now), false);
  assert.equal(isActive({ status: 'active', current_period_end: '2026-11-24T00:00:00Z' }, now), true);
  assert.equal(isActive({ status: 'active', current_period_end: '2026-10-01T00:00:00Z' }, now), false);
  assert.equal(isActive({ status: 'canceled', current_period_end: '2026-11-01T00:00:00Z' }, now), true, 'cancelada conserva el periodo pagado');
  assert.equal(isActive({ status: 'canceled', current_period_end: null }, now), false);
  for (const s of ['pending', 'suspended', 'expired', 'past_due', 'inventado']) assert.equal(isActive({ status: s }, now), false);
  assert.equal(fromPaypalStatus('ACTIVE'), 'active');
  assert.equal(fromPaypalStatus('CANCELLED'), 'canceled');
  assert.equal(fromPaypalStatus('OTRO'), null);
});

test('solo redirecciones internas', () => {
  assert.equal(safeNext('/app/'), '/app/');
  assert.equal(safeNext('/cuenta/?x=1'), '/cuenta/?x=1');
  for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '/api/auth/logout', '']) assert.equal(safeNext(bad), '/app/');
});

test('cookies de sesión seguras', () => {
  const set = sessionCookies({ access_token: 'A', refresh_token: 'R', expires_in: 3600 });
  assert.match(set[0], /^tp_at=A; Path=\/; HttpOnly; SameSite=Lax; Secure; Max-Age=3600$/);
  assert.match(set[1], /^tp_rt=R;.*HttpOnly.*Max-Age=2592000/);
  assert.ok(clearSessionCookies().every(c => /Max-Age=0/.test(c)));
  assert.deepEqual(parseCookies('a=1; tp_at=x%20y; bad'), { a: '1', tp_at: 'x y' });
});

test('configuración: sin variables no hay servicio; live requiere aprobación', () => {
  assert.equal(supabaseConfig({}), null);
  assert.equal(supabaseConfig({ ...env, SUPABASE_URL: 'https://evil.example.com' }), null);
  assert.equal(paypalConfig({}), null, 'sin PayPal: modo «próximamente»');
  assert.throws(() => paypalConfig({ ...ppEnv, PAYPAL_MODE: 'live' }), /bloqueado/);
  assert.equal(paypalConfig({ ...ppEnv, PAYPAL_MODE: 'live', PAYPAL_LIVE_ENABLED: 'true' }).mode, 'live');
});

test('la demostración nunca se habilita en producción', () => {
  assert.equal(demoAllowed({ BILLING_DEMO: 'true', VERCEL_ENV: 'preview' }), true);
  assert.equal(demoAllowed({ BILLING_DEMO: 'true', VERCEL_ENV: 'production' }), false);
  assert.equal(demoAllowed({}), false);
});

const req = (cookie = '', path = '/app/') => new Request('https://prompter.example' + path, { headers: cookie ? { cookie } : {} });
const authOk = ['/auth/v1/user', { body: { id: USER, email: 'a@b.cl' } }];

test('middleware: sin sesión → login; con renovación → refresh', async () => {
  let r = await gate(req(), env, mockFetch([]));
  assert.equal(r.status, 307);
  assert.equal(new URL(r.headers.get('location')).pathname, '/login/');
  r = await gate(req('tp_rt=R'), env, mockFetch([]));
  assert.match(r.headers.get('location'), /\/api\/auth\/refresh\?next=%2Fapp%2F$/);
});

test('middleware: token inválido no da acceso', async () => {
  const r = await gate(req('tp_at=falso'), env, mockFetch([['/auth/v1/user', { status: 401, body: {} }]]));
  assert.equal(new URL(r.headers.get('location')).pathname, '/login/');
});

test('middleware: sin suscripción activa → cuenta; activa → continúa', async () => {
  let r = await gate(req('tp_at=ok'), env, mockFetch([authOk, ['/rest/v1/subscriptions', { body: [] }]]));
  assert.match(r.headers.get('location'), /\/cuenta\/\?motivo=suscripcion$/);
  r = await gate(req('tp_at=ok'), env, mockFetch([authOk, ['/rest/v1/subscriptions', { body: [{ status: 'expired' }] }]]));
  assert.match(r.headers.get('location'), /\/cuenta\//);
  r = await gate(req('tp_at=ok'), env, mockFetch([authOk, ['/rest/v1/subscriptions', { body: [{ status: 'active', current_period_end: new Date(Date.now() + 86400000).toISOString() }] }]]));
  assert.equal(r, undefined);
});

test('middleware: error de base de datos no concede acceso; sin configuración responde 503', async () => {
  const r = await gate(req('tp_at=ok'), env, mockFetch([authOk, ['/rest/v1/subscriptions', { status: 500, body: {} }]]));
  assert.equal(r.status, 503);
  assert.equal((await gate(req('tp_at=ok'), {}, mockFetch([]))).status, 503);
  assert.equal(await gate(req('', '/app/manifest.webmanifest'), {}, mockFetch([])), undefined, 'el manifiesto es público');
});

test('crear suscripción usa el plan configurado y el usuario interno', async () => {
  const calls = [];
  const r = await createSubscription(paypal, { referenceId: USER, returnUrl: 'https://x.cl/api/paypal/return', cancelUrl: 'https://x.cl/cuenta/' },
    mockFetch([['/oauth2/token', { body: { access_token: 't' } }], ['/billing/subscriptions', { body: { id: 'I-ABC123', links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/ok' }] } }]], calls));
  assert.equal(r.approvalUrl, 'https://www.sandbox.paypal.com/ok');
  const sent = JSON.parse(calls[1].options.body);
  assert.equal(sent.plan_id, 'P-MONTHLY');
  assert.equal(sent.custom_id, USER);
  await assert.rejects(createSubscription(paypal, { referenceId: USER, returnUrl: 'http://x.cl/', cancelUrl: 'https://x.cl/' }), /no segura/);
});

const ppSub = over => ['/v1/billing/subscriptions/I-', { body: { id: 'I-ABC123', status: 'ACTIVE', plan_id: 'P-MONTHLY', custom_id: USER, billing_info: { next_billing_time: '2026-11-24T00:00:00Z' }, ...over } }];
const token = ['/oauth2/token', { body: { access_token: 't' } }];

test('sincronización: verifica dueño y plan antes de activar', async () => {
  const calls = [];
  const ok = await syncPaypalSubscription({ db, paypal, subscriptionId: 'I-ABC123', expectedUserId: USER,
    fetcher: mockFetch([token, ppSub(), ['/rest/v1/subscriptions', { status: 201, body: null }]], calls) });
  assert.equal(ok.status, 'active');
  const row = JSON.parse(calls.find(c => c.url.includes('/rest/v1/subscriptions')).options.body);
  assert.equal(row.current_period_end, '2026-11-24T00:00:00Z');
  assert.equal(row.provider, 'paypal');
  await assert.rejects(syncPaypalSubscription({ db, paypal, subscriptionId: 'I-ABC123', expectedUserId: '99999999-2222-4333-8444-555555555555',
    fetcher: mockFetch([token, ppSub()]) }), /otro usuario/);
  await assert.rejects(syncPaypalSubscription({ db, paypal, subscriptionId: 'I-ABC123',
    fetcher: mockFetch([token, ppSub({ plan_id: 'P-BARATO' })]) }), /Plan no autorizado/);
});

test('webhook: rechaza firmas inválidas y procesa eventos verificados', async () => {
  const event = { id: 'WH-EVT-1', event_type: 'BILLING.SUBSCRIPTION.CANCELLED', resource: { id: 'I-ABC123' } };
  assert.equal((await handleWebhook({ headers: {}, event, db, paypal, fetcher: mockFetch([]) })).status, 401);
  const headers = Object.fromEntries(['auth-algo', 'cert-url', 'transmission-id', 'transmission-sig', 'transmission-time'].map(k => ['paypal-' + k, 'x']));
  const bad = mockFetch([token, ['/verify-webhook-signature', { body: { verification_status: 'FAILURE' } }]]);
  assert.equal((await handleWebhook({ headers, event, db, paypal, fetcher: bad })).status, 401);
  const calls = [];
  const good = mockFetch([token, ['/verify-webhook-signature', { body: { verification_status: 'SUCCESS' } }], ppSub({ status: 'CANCELLED', billing_info: {} }),
    ['/rest/v1/subscriptions', { status: 201 }], ['/rest/v1/billing_events', { status: 201 }]], calls);
  const r = await handleWebhook({ headers, event, db, paypal, fetcher: good });
  assert.equal(r.status, 200);
  const row = JSON.parse(calls.find(c => c.url.includes('/rest/v1/subscriptions')).options.body);
  assert.equal(row.status, 'canceled');
  assert.ok(!('current_period_end' in row), 'conserva la fecha de fin ya pagada');
  const logged = JSON.parse(calls.find(c => c.url.includes('billing_events')).options.body);
  assert.deepEqual(Object.keys(logged).sort(), ['id', 'provider', 'resource_id', 'type'], 'no guarda datos del pagador');
  assert.equal(subscriptionIdOf({ event_type: 'PAYMENT.SALE.COMPLETED', resource: { billing_agreement_id: 'I-XYZ999' } }), 'I-XYZ999');
  assert.equal(await verifyWebhook(paypal, {}, event), false);
});

test('CSRF: POST solo desde el mismo origen y con JSON', () => {
  const res = () => ({ headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } });
  const base = { method: 'POST', headers: { host: 'prompter.example', origin: 'https://prompter.example', 'content-type': 'application/json' } };
  assert.equal(checkPost(base, res()), true);
  const r1 = res(); assert.equal(checkPost({ ...base, headers: { ...base.headers, origin: 'https://evil.example' } }, r1), false); assert.equal(r1.statusCode, 403);
  const r2 = res(); assert.equal(checkPost({ ...base, headers: { ...base.headers, 'content-type': 'text/plain' } }, r2), false); assert.equal(r2.statusCode, 415);
  const r3 = res(); assert.equal(checkPost({ ...base, method: 'GET' }, r3), false); assert.equal(r3.statusCode, 405);
});
