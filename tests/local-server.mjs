/*
 * Servidor local para probar el flujo completo sin cuentas reales:
 * imita el enrutamiento de Vercel (estáticos, /api/*, middleware de /app/) y un Supabase en memoria.
 *   node tests/local-server.mjs            → http://localhost:3000
 * Variables: PORT, BILLING_DEMO (true por defecto).
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.xml': 'application/xml' };

/* ---------- Supabase en memoria (solo lo que usa la app) ---------- */
export function fakeSupabase() {
  const users = new Map(), tokens = new Map(), refresh = new Map(), subs = new Map(), events = new Set();
  const issue = user => {
    const at = 'at-' + randomUUID(), rt = 'rt-' + randomUUID();
    tokens.set(at, user.id); refresh.set(rt, user.id);
    return { access_token: at, refresh_token: rt, expires_in: 3600, token_type: 'bearer', user: { id: user.id, email: user.email } };
  };
  const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
  const server = http.createServer(async (req, res) => {
    let raw = ''; for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : {};
    const url = new URL(req.url, 'http://x');
    const bearer = String(req.headers.authorization || '').replace(/^Bearer /, '');
    const service = bearer === 'service-key';
    if (url.pathname === '/auth/v1/signup') {
      if ([...users.values()].some(u => u.email === body.email)) return json(res, 422, { code: 'user_already_exists' });
      const user = { id: randomUUID(), email: body.email, password: body.password };
      users.set(user.id, user);
      return json(res, 200, issue(user));          // confirmación automática en local
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      const user = [...users.values()].find(u => u.email === body.email && u.password === body.password);
      return user ? json(res, 200, issue(user)) : json(res, 400, { error_code: 'invalid_credentials' });
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      const id = refresh.get(body.refresh_token); refresh.delete(body.refresh_token);
      return id ? json(res, 200, issue(users.get(id))) : json(res, 400, { error_code: 'refresh_token_not_found' });
    }
    if (url.pathname === '/auth/v1/user') {
      const id = tokens.get(bearer);
      if (!id) return json(res, 401, { code: 'bad_jwt' });
      if (req.method === 'PUT') users.get(id).password = body.password;
      return json(res, 200, { id, email: users.get(id).email });
    }
    if (url.pathname === '/auth/v1/logout') { tokens.delete(bearer); return json(res, 204); }
    if (url.pathname === '/auth/v1/recover') return json(res, 200, {});
    if (url.pathname === '/rest/v1/subscriptions') {
      if (!service) return json(res, 401, {});
      if (req.method === 'GET') {
        const id = (url.searchParams.get('user_id') || '').replace(/^eq\./, '');
        return json(res, 200, subs.has(id) ? [subs.get(id)] : []);
      }
      subs.set(body.user_id, { ...(subs.get(body.user_id) || {}), ...body });
      return json(res, 201);
    }
    if (url.pathname === '/rest/v1/billing_events') {
      if (events.has(body.id)) return json(res, 409, {});
      events.add(body.id); return json(res, 201);
    }
    json(res, 404, {});
  });
  return { server, users, subs };
}

/* ---------- Adaptador de las funciones de Vercel ---------- */
function vercelRes(res) {
  return Object.assign(res, { statusCode: 200 });
}

async function serveStatic(pathname, res) {
  const PUB = path.join(ROOT, 'public');
  let file = path.join(PUB, decodeURIComponent(pathname));
  if (!file.startsWith(PUB)) { res.writeHead(404); return res.end('No encontrado'); }
  try {
    let s = await stat(file).catch(() => null);
    if (s && s.isDirectory()) { file = path.join(file, 'index.html'); s = await stat(file).catch(() => null); }
    if (!s && !path.extname(file)) { file += '.html'; s = await stat(file).catch(() => null); }
    if (!s) { res.writeHead(404); return res.end('No encontrado'); }
    const headers = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' };
    if (pathname.startsWith('/app/')) headers['Cache-Control'] = 'private, no-store';
    res.writeHead(200, headers); res.end(await readFile(file));
  } catch (e) { res.writeHead(500); res.end('Error'); }
}

export async function startLocal({ port = 3000, supabasePort = 0, env = {} } = {}) {
  const fake = fakeSupabase();
  await new Promise(r => fake.server.listen(supabasePort, '127.0.0.1', r));
  Object.assign(process.env, {
    SUPABASE_URL: 'http://127.0.0.1:' + fake.server.address().port,
    SUPABASE_ANON_KEY: 'anon-key', SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    BILLING_DEMO: 'true', VERCEL_ENV: 'development', ...env
  });
  const { gate } = await import(pathToFileURL(path.join(ROOT, 'lib/gate.js')));
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://' + req.headers.host);
    try {
      if (url.pathname === '/app' || url.pathname.startsWith('/app/')) {
        const request = new Request(url, { headers: { cookie: req.headers.cookie || '' } });
        const out = await gate(request, process.env, fetch);
        if (out) {
          res.writeHead(out.status, Object.fromEntries(out.headers));
          return res.end(await out.text());
        }
        if (url.pathname === '/app') { res.writeHead(308, { Location: '/app/' }); return res.end(); }
      }
      if (url.pathname.startsWith('/api/')) {
        const file = path.join(ROOT, url.pathname.replace(/\/$/, '') + '.js');
        if (!file.startsWith(path.join(ROOT, 'api'))) { res.writeHead(404); return res.end(); }
        const mod = await import(pathToFileURL(file)).catch(() => null);
        if (!mod) { res.writeHead(404); return res.end('{}'); }
        let raw = ''; for await (const c of req) raw += c;
        if (/json/.test(req.headers['content-type'] || '')) { try { req.body = JSON.parse(raw || '{}'); } catch (e) { req.body = {}; } }
        return await mod.default(req, vercelRes(res));
      }
      return serveStatic(url.pathname, res);
    } catch (e) { console.error(e); res.writeHead(500); res.end('Error'); }
  });
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  return { server, fake, url: 'http://localhost:' + server.address().port };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { url } = await startLocal({ port: Number(process.env.PORT) || 3000 });
  console.log('Prompter local en ' + url + ' (Supabase simulado, demostración activada)');
}
