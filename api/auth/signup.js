import { supabaseConfig, signUp } from '../../lib/supabase.js';
import { send, checkPost, body, isSecure, origin, validEmail, validPassword } from '../../lib/http.js';
import { sessionCookies } from '../../lib/cookies.js';

export default async function handler(req, res) {
  if (!checkPost(req, res)) return;
  const cfg = supabaseConfig();
  if (!cfg) return send(res, 503, { error: 'Servicio no configurado' });
  const { email, password, accept } = await body(req);
  if (!validEmail(email)) return send(res, 400, { error: 'Correo no válido.' });
  if (!validPassword(password)) return send(res, 400, { error: 'La contraseña debe tener entre 10 y 128 caracteres.' });
  if (accept !== true) return send(res, 400, { error: 'Debes aceptar los términos y la política de privacidad.' });
  const r = await signUp(cfg, email.trim().toLowerCase(), password, origin(req) + '/login/?confirmado=1').catch(() => ({ ok: false, status: 502 }));
  if (r.status === 429) return send(res, 429, { error: 'Demasiados intentos. Espera unos minutos.' });
  if (!r.ok) {
    const code = r.body && (r.body.error_code || r.body.code);
    if (code === 'weak_password') return send(res, 400, { error: 'La contraseña es demasiado débil.' });
    // Mismo mensaje si el correo ya existe: no revela qué cuentas están registradas.
    return send(res, 200, { ok: true, needsConfirmation: true });
  }
  if (r.body && r.body.access_token) return send(res, 200, { ok: true, needsConfirmation: false }, sessionCookies(r.body, isSecure(req)));
  return send(res, 200, { ok: true, needsConfirmation: true });
}
