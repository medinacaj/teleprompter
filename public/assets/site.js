/* Comportamiento común del sitio: animaciones de aparición y llamadas a la API. */
(() => {
  'use strict';
  // Solo se ocultan los elementos que aún no están en pantalla: sin JavaScript, todo queda visible.
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.remove('pre'); io.unobserve(e.target); }
  }, { threshold: 0.12 });
  for (const el of document.querySelectorAll('.reveal')) {
    if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('pre'); io.observe(el); }
  }
})();

/* POST JSON al mismo origen; devuelve { ok, status, data }. */
window.api = async function api(path, payload, method = 'POST') {
  try {
    const r = await fetch(path, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(payload || {})
    });
    let data = {};
    try { data = await r.json(); } catch (e) { /* sin cuerpo */ }
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { error: 'Sin conexión. Revisa tu red e inténtalo de nuevo.' } };
  }
};
