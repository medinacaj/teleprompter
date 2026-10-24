import { supabaseConfig, updatePassword } from '../../lib/supabase.js';
import { send, checkPost, body, session, validPassword } from '../../lib/http.js';

export default async function handler(req, res) {
  if (!checkPost(req, res)) return;
  const cfg = supabaseConfig();
  if (!cfg) return send(res, 503, { error: 'Servicio no configurado' });
  const s = await session(req, cfg);
  if (!s.user) return send(res, 401, { error: 'Inicia sesión de nuevo.' }, s.setCookies);
  const { password } = await body(req);
  if (!validPassword(password)) return send(res, 400, { error: 'La contraseña debe tener entre 10 y 128 caracteres.' }, s.setCookies);
  const r = await updatePassword(cfg, s.accessToken, password).catch(() => ({ ok: false }));
  if (!r.ok) return send(res, 400, { error: 'No se pudo cambiar la contraseña.' }, s.setCookies);
  send(res, 200, { ok: true }, s.setCookies);
}
