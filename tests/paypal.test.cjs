'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { config, createSubscription, getSubscription, verifyWebhook } = require('../server/paypal');

const env = {
  PAYPAL_MODE: 'sandbox',
  PAYPAL_CLIENT_ID: 'sandbox-id',
  PAYPAL_CLIENT_SECRET: 'sandbox-secret',
  PAYPAL_PLAN_ID: 'P-TEST',
  PAYPAL_WEBHOOK_ID: 'WH-TEST'
};
const cfg = config(env);
const fake = (responses, calls) => async (url, options) => {
  calls.push({ url, options });
  const next = responses.shift();
  return { ok: true, json: async () => next };
};

test('sandbox default and live opt-in', () => {
  assert.match(cfg.base, /sandbox/);
  assert.throws(() => config({ ...env, PAYPAL_MODE: 'live' }), /bloqueado/);
  assert.equal(config({ ...env, PAYPAL_MODE: 'live', PAYPAL_LIVE_ENABLED: 'true' }).mode, 'live');
});
test('subscription creation returns approval URL without exposing credentials', async () => {
  const calls = [];
  const result = await createSubscription(cfg, {
    referenceId: 'user-internal-123',
    returnUrl: 'https://example.com/return',
    cancelUrl: 'https://example.com/cancel'
  }, fake([{ access_token: 'token' }, { id: 'I-123', status: 'APPROVAL_PENDING', links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/approve' }] }], calls));
  assert.equal(result.id, 'I-123');
  assert.match(result.approvalUrl, /sandbox.paypal.com/);
  assert.equal(JSON.parse(calls[1].options.body).plan_id, 'P-TEST');
});
test('subscription lookup validates ID', async () => {
  await assert.rejects(getSubscription(cfg, '../secrets'), /inválido/);
});
test('webhook requires headers and verified signature', async () => {
  assert.equal(await verifyWebhook(cfg, {}, { id: 'WH-1' }), false);
  const headers = Object.fromEntries(['auth-algo', 'cert-url', 'transmission-id', 'transmission-sig', 'transmission-time'].map(k => ['paypal-' + k, 'sample']));
  const calls = [];
  assert.equal(await verifyWebhook(cfg, headers, { id: 'WH-1' }, fake([{ access_token: 'token' }, { verification_status: 'SUCCESS' }], calls)), true);
  assert.equal(JSON.parse(calls[1].options.body).webhook_id, 'WH-TEST');
});
