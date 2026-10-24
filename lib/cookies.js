/* Cookies de sesión: HttpOnly (inaccesibles desde JavaScript), Secure y SameSite=Lax. */
export const ACCESS = 'tp_at';
export const REFRESH = 'tp_rt';

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const key = part.slice(0, i).trim();
    try { out[key] = decodeURIComponent(part.slice(i + 1).trim()); } catch (e) { /* valor inválido */ }
  }
  return out;
}

export function serializeCookie(name, value, { maxAge, secure = true } = {}) {
  const parts = [name + '=' + encodeURIComponent(value), 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (secure) parts.push('Secure');
  if (Number.isFinite(maxAge)) parts.push('Max-Age=' + Math.max(0, Math.floor(maxAge)));
  return parts.join('; ');
}

/* El token de acceso dura lo que indique Supabase (1 h por defecto); el de renovación, 30 días. */
export function sessionCookies(session, secure = true) {
  return [
    serializeCookie(ACCESS, session.access_token, { maxAge: Number(session.expires_in) || 3600, secure }),
    serializeCookie(REFRESH, session.refresh_token, { maxAge: 30 * 86400, secure })
  ];
}

export function clearSessionCookies(secure = true) {
  return [serializeCookie(ACCESS, '', { maxAge: 0, secure }), serializeCookie(REFRESH, '', { maxAge: 0, secure })];
}
