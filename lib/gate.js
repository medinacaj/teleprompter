/* Control de acceso a /app/: se ejecuta en el servidor antes de entregar el HTML del lector. */
import { parseCookies, ACCESS, REFRESH } from './cookies.js';
import { supabaseConfig, getUser, getSubscription } from './supabase.js';
import { isActive } from './subscription.js';

/* Recursos que el navegador pide sin cookies (manifiesto, icono) o sin valor de copia. */
const PUBLIC_IN_APP = /^\/app\/(manifest\.webmanifest|icon\.svg|sw\.js)$/;

const go = (url, path) => new Response(null, { status: 307, headers: { Location: new URL(path, url).toString(), 'Cache-Control': 'no-store' } });

export async function gate(request, env = process.env, fetcher = fetch) {
  const url = new URL(request.url);
  if (PUBLIC_IN_APP.test(url.pathname)) return undefined;
  const cfg = supabaseConfig(env);
  if (!cfg) return new Response('Servicio no configurado', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const next = encodeURIComponent(url.pathname + url.search);
  const cookies = parseCookies(request.headers.get('cookie'));
  const user = cookies[ACCESS] ? await getUser(cfg, cookies[ACCESS], fetcher) : null;
  if (!user) return go(url, cookies[REFRESH] ? '/api/auth/refresh?next=' + next : '/login/?next=' + next);
  let sub = null;
  try { sub = await getSubscription(cfg, user.id, fetcher); }
  catch (e) { return new Response('No se pudo verificar la suscripción. Inténtalo de nuevo.', { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' } }); }
  if (!isActive(sub)) return go(url, '/cuenta/?motivo=suscripcion');
  return undefined;   // acceso permitido: Vercel entrega el archivo estático
}
