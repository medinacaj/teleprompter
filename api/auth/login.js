import { supabaseConfig, signIn } from '../../lib/supabase.js';
import { send, checkPost, body, isSecure, validEmail } from '../../lib/http.js';
import { sessionCookies } from '../../lib/cookies.js';

export default async function handler(req, res) {
  if (!checkPost(req, res)) return;
  const cfg = supabaseConfig();
  if (!cfg) return send(res, 503, { error: 'Servicio no configurado' });
  const { email, password } = await body(req);
  if (!validEmail(email) || typeof password !== 'string' || !password) return send(res, 400, { error: 'Escribe tu correo y contraseña.' });
  const r = await signIn(cfg, email.trim().toLowerCase(), password).catch(() => ({ ok: false, status: 502 }));
  if (r.ok && r.body && r.body.access_token) return send(res, 200, { ok: true }, sessionCookies(r.body, isSecure(req)));
  const code = r.body && (r.body.error_code || r.body.code);
  if (code === 'email_not_confirmed') return send(res, 403, { error: 'Confirma tu correo con el enlace que te enviamos.' });
  if (r.status === 429) return send(res, 429, { error: 'Demasiados intentos. Espera unos minutos.' });
  return send(res, 401, { error: 'Correo o contraseña incorrectos.' });
}
