/* Utilidades para las funciones de Vercel (Node). */
import { parseCookies, sessionCookies, clearSessionCookies, ACCESS, REFRESH } from './cookies.js';
import { getUser, refreshSession } from './supabase.js';

export function send(res, status, body, cookies = []) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (cookies.length) res.setHeader('Set-Cookie', cookies);
  res.end(JSON.stringify(body));
}

export function redirect(res, location, cookies = []) {
  res.statusCode = 303;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  if (cookies.length) res.setHeader('Set-Cookie', cookies);
  res.end();
}

export const isSecure = req => !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(String(req.headers.host || ''));

export function origin(req) {
  const proto = isSecure(req) ? 'https' : 'http';
  return proto + '://' + req.headers.host;
}

/* Protección CSRF: las operaciones que cambian estado solo se aceptan desde el mismo origen y en JSON. */
export function checkPost(req, res) {
  if (req.method !== 'POST') { send(res, 405, { error: 'Método no permitido' }); return false; }
  const o = req.headers.origin;
  if (!o || o !== origin(req)) { send(res, 403, { error: 'Origen no permitido' }); return false; }
  if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) { send(res, 415, { error: 'Se esperaba JSON' }); return false; }
  return true;
}

export async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 65536) return {}; }
  try { return JSON.parse(raw || '{}'); } catch (e) { return {}; }
}

/* Sesión del usuario; renueva el token de acceso si expiró. */
export async function session(req, cfg, fetcher = fetch) {
  const cookies = parseCookies(req.headers.cookie);
  const secure = isSecure(req);
  let user = cookies[ACCESS] ? await getUser(cfg, cookies[ACCESS], fetcher) : null;
  if (user) return { user, accessToken: cookies[ACCESS], setCookies: [] };
  if (!cookies[REFRESH]) return { user: null, setCookies: [] };
  const r = await refreshSession(cfg, cookies[REFRESH], fetcher).catch(() => ({ ok: false }));
  if (!r.ok || !r.body || !r.body.access_token) return { user: null, setCookies: clearSessionCookies(secure) };
  user = await getUser(cfg, r.body.access_token, fetcher);
  return { user, accessToken: r.body.access_token, setCookies: user ? sessionCookies(r.body, secure) : clearSessionCookies(secure) };
}

export const validEmail = e => typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
export const validPassword = p => typeof p === 'string' && p.length >= 10 && p.length <= 128;
