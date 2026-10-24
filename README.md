# Prompter — Lector de guiones

Teleprompter web mobile-first en español: pega tu guion, fija la velocidad en palabras por minuto (ppm) y léelo frente a la cámara con cuenta atrás, línea guía y modo espejo.

Producto de suscripción (US$1/mes): sitio público, cuentas con Supabase, lector protegido en `/app/` y pagos con PayPal (preparados, aún desactivados). Arquitectura, seguridad y pasos de despliegue en [`docs/SUSCRIPCIONES.md`](docs/SUSCRIPCIONES.md).

## Ejecutar en local

```sh
node tests/local-server.mjs   # http://localhost:3000 — Supabase simulado, demostración activada
```

Los guiones se guardan en el navegador (localStorage); usa **Mis guiones → Exportar** para respaldarlos. La app no usa analítica ni fuentes o scripts de terceros.

## Pruebas

```sh
node tests/smoke.cjs && node --test tests/*.test.mjs
```

GitHub Actions (`.github/workflows/quality.yml`) ejecuta la misma comprobación en cada push y PR. Al modificar `public/app/index.html`, incrementa la versión de caché en `public/app/sw.js` (`prompter-static-vN`) y en la prueba.

## Archivos

| Ruta | Uso |
|---|---|
| `public/` | Único directorio publicado como estático (`outputDirectory`) |
| `public/index.html`, `public/assets/` | Página pública, estilos, logo y scripts compartidos |
| `public/login/`, `public/cuenta/`, `public/legal/` | Acceso, estado de suscripción y borradores legales |
| `public/app/` | Lector (HTML + CSS + JS sin dependencias), PWA y service worker |
| `middleware.js`, `lib/gate.js` | Acceso a `/app/` solo para suscriptores activos |
| `api/` | Funciones de Vercel: autenticación, estado, PayPal y demostración |
| `lib/` | Clientes de Supabase y PayPal, cookies y reglas de suscripción |
| `supabase/migrations/` | Tablas y políticas RLS |
| `vercel.json` | Cabeceras de seguridad y caché |
| `tests/` | Pruebas estáticas, unitarias del servidor y servidor local simulado |
| `docs/` | Suscripciones, PayPal, auditoría, validación, revisión jurídico-tecnológica y flujo multi-IA |
