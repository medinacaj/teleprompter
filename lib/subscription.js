/* Reglas de acceso, compartidas por el middleware, la API y las pruebas. */
export const STATUSES = ['pending', 'active', 'trialing', 'past_due', 'suspended', 'canceled', 'expired'];

/* Activa o en prueba con periodo vigente; una cancelación conserva el acceso hasta el fin del periodo pagado. */
export function isActive(sub, now = Date.now()) {
  if (!sub || !STATUSES.includes(sub.status)) return false;
  const end = sub.current_period_end ? Date.parse(sub.current_period_end) : NaN;
  if (sub.status === 'active' || sub.status === 'trialing') return !Number.isFinite(end) || end > now;
  if (sub.status === 'canceled') return Number.isFinite(end) && end > now;
  return false;
}

/* Estados de PayPal → estados internos. */
export function fromPaypalStatus(status) {
  return ({
    APPROVAL_PENDING: 'pending', APPROVED: 'pending', ACTIVE: 'active',
    SUSPENDED: 'suspended', CANCELLED: 'canceled', EXPIRED: 'expired'
  })[status] || null;
}

/* Solo rutas internas: evita redirecciones abiertas hacia otros dominios. */
export function safeNext(value, fallback = '/app/') {
  const v = String(value || '');
  return /^\/(?![\/\\])[^\s]*$/.test(v) && !v.startsWith('/api/') ? v : fallback;
}
