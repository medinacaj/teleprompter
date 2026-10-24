/* Solo se almacenan archivos públicos de la aplicación, nunca guiones. */
const CACHE = 'prompter-static-v12';
const SCOPE = '/app/';
const ASSETS = ['/app/', '/app/manifest.webmanifest', '/app/icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('prompter-static-') && key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});
/* Una respuesta redirigida (al acceso o a la cuenta) nunca reemplaza la app guardada. */
const cacheable = response => response.ok && response.type === 'basic' && !response.redirected;
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        if (cacheable(response)) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then(cache => cache.put(SCOPE, copy)));
        }
        return response;
      }).catch(async () => (await caches.match(SCOPE)) || Response.error())
    );
    return;
  }
  if (!ASSETS.includes(url.pathname)) return;
  event.respondWith(caches.match(request, { ignoreSearch: true }).then(cached => cached || fetch(request).then(response => {
    if (cacheable(response)) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
    }
    return response;
  })));
});
