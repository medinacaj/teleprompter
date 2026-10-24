/* Recibe los tokens del enlace de confirmación o recuperación (fragmento #) y los guarda como cookies HttpOnly. */
import { supabaseConfig, getUser } from '../../lib/supabase.js';
import { send, checkPost, body, isSecure } from '../../lib/http.js';
import { sessionCookies } from '../../lib/cookies.js';

export default async function handler(req, res) {
  if (!checkPost(req, res)) return;
  const cfg = supabaseConfig();
  if (!cfg) return send(res, 503, { error: 'Servicio no configurado' });
  const { access_token, refresh_token, expires_in } = await body(req);
  if (typeof access_token !== 'string' || typeof refresh_token !== 'string' || refresh_token.length > 512) return send(res, 400, { error: 'Enlace no válido.' });
  const user = await getUser(cfg, access_token);
  if (!user) return send(res, 401, { error: 'El enlace expiró. Solicita uno nuevo.' });
  return send(res, 200, { ok: true }, sessionCookies({ access_token, refresh_token, expires_in }, isSecure(req)));
}
