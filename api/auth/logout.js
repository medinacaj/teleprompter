import { supabaseConfig, signOut } from '../../lib/supabase.js';
import { send, checkPost, isSecure } from '../../lib/http.js';
import { parseCookies, clearSessionCookies, ACCESS } from '../../lib/cookies.js';

export default async function handler(req, res) {
  if (!checkPost(req, res)) return;
  const cfg = supabaseConfig();
  const token = parseCookies(req.headers.cookie)[ACCESS];
  if (cfg && token) await signOut(cfg, token).catch(() => {});   // revoca también la sesión en Supabase
  send(res, 200, { ok: true }, clearSessionCookies(isSecure(req)));
}
