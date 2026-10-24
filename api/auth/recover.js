import { supabaseConfig, recover } from '../../lib/supabase.js';
import { send, checkPost, body, origin, validEmail } from '../../lib/http.js';

export default async function handler(req, res) {
  if (!checkPost(req, res)) return;
  const cfg = supabaseConfig();
  if (!cfg) return send(res, 503, { error: 'Servicio no configurado' });
  const { email } = await body(req);
  if (!validEmail(email)) return send(res, 400, { error: 'Correo no válido.' });
  await recover(cfg, email.trim().toLowerCase(), origin(req) + '/login/?recuperar=1').catch(() => {});
  // Respuesta idéntica exista o no la cuenta.
  send(res, 200, { ok: true });
}
