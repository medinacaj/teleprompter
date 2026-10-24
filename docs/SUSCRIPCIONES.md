# Plataforma de suscripción — arquitectura, seguridad y puesta en marcha

**Estado (2026-10-24):** el código está implementado y probado en local, con Supabase y PayPal simulados. **No hay nada desplegado** en Supabase ni en Vercel, y los cobros siguen **desactivados**: PayPal aparece como «próximamente».

## Arquitectura

```
Navegador ──► Vercel
  /                 página pública (index.html)
  /login/ /cuenta/  acceso y estado de suscripción
  /app/             lector ──► middleware.js verifica sesión + suscripción ANTES de entregar el HTML
  /api/auth/*       inicio de sesión vía Supabase Auth; tokens en cookies HttpOnly
  /api/subscription/status
  /api/paypal/*     crear suscripción, retorno verificado y webhook firmado
                         │
                         ├──► Supabase: auth.users, public.subscriptions, public.billing_events (RLS)
                         └──► PayPal: suscripción de US$1/mes (Sandbox primero)
```

- **Sin dependencias ni compilación.** Las funciones usan `fetch` contra las API REST de Supabase y PayPal.
- **La fuente de verdad es PayPal.** El retorno desde PayPal y los webhooks no confían en lo que diga la URL ni el cuerpo del evento: consultan la suscripción en PayPal y comprueban que pertenezca al usuario (`custom_id`) y que use el plan configurado (`PAYPAL_PLAN_ID`).
- **Una cancelación conserva el acceso hasta el fin del periodo pagado.** Estados como `pending`, `suspended`, `expired`, `past_due` o desconocidos no dan acceso.

## Protección contra clonación y uso sin pago

Ningún sitio web puede impedir al 100 % que se copie el código que llega al navegador. El objetivo es que copiarlo no sirva para usar el servicio y que el uso no autorizado tenga consecuencias legales.

| Control | Qué impide | Límite |
|---|---|---|
| `middleware.js` entrega `/app/` solo a sesiones válidas con suscripción activa (verificadas contra Supabase, no solo decodificadas) | Abrir el lector sin pagar | Un suscriptor puede guardar el HTML |
| La app verifica `/api/subscription/status` al abrir, cada 30 min y al volver a la pestaña | Que una copia funcione en otro dominio, en `file://` o tras vencer la suscripción | Un atacante puede editar el JS de su copia |
| Tolerancia sin conexión de 72 h desde la última verificación | Uso indefinido sin conexión | Se acepta para no bloquear grabaciones sin red |
| Cookies `HttpOnly; Secure; SameSite=Lax` y CSRF por `Origin` + JSON | Robo de sesión por XSS y peticiones de otros sitios | — |
| CSP (`connect-src 'self'`, `frame-ancestors 'none'`), `X-Frame-Options`, HSTS, `no-store` en `/app/` | Incrustar la app en otro sitio y cachés compartidas | `unsafe-inline` es necesario mientras el JS vaya inline |
| Términos: licencia personal, prohibición de copia y reventa; «Todos los derechos reservados» | Base legal para retirar clones | **Borrador:** requiere datos del titular y revisión profesional |
| **Repositorio privado y GitHub Pages desactivado** | Que el código completo sea público | **Pendiente: lo decide el titular.** Hoy el repositorio es público |

Trabajo futuro, si el riesgo lo justifica: mover funciones de valor al servidor, por ejemplo sincronizar los guiones en Supabase con una RLS basada en `has_active_subscription()`. Así, una copia del HTML no tendría esas funciones.

## Puesta en marcha (en orden)

1. **Repositorio privado.** GitHub → Settings → General → Change visibility. Luego desactiva Pages en Settings → Pages. Mientras sea público, cualquiera puede descargar la app.
2. **Supabase.** Reactiva el proyecto (está pausado) o crea uno nuevo. Aplica `supabase/migrations/20261024000000_subscriptions.sql`. En Authentication → URL Configuration:
   - Site URL: el dominio de Vercel.
   - Redirect URLs: `https://DOMINIO/login/*`.
3. **Vercel.** Proyecto `teleprompter`, dominio `https://teleprompter-medinacaj.vercel.app` (`teleprompter.vercel.app` pertenece a otra cuenta; para un nombre sin sufijo hace falta un dominio propio). Importa el repositorio (el preset de framework es «Other»; no hay comando de build) y carga las variables de `.env.example`. En previews puedes usar `BILLING_DEMO=true` para probar sin cobro.
4. **PayPal Sandbox**, cuando quieras activar los cobros:
   - Crea la app REST, el producto y el plan mensual de US$1,00.
   - Crea un webhook a `https://DOMINIO/api/paypal/webhook` con los eventos de `docs/PAYPAL_INTEGRACION.md`.
   - Carga `PAYPAL_*`. Prueba con cuentas Sandbox.
5. **Live:** `PAYPAL_MODE=live` y `PAYPAL_LIVE_ENABLED=true`, solo después de pruebas end-to-end, revisión de términos, privacidad e impuestos, y aprobación explícita.

## Probar en local

```sh
node tests/local-server.mjs     # http://localhost:3000 con Supabase en memoria y demostración activada
node tests/smoke.cjs && node --test tests/*.test.mjs
```

## Datos personales (minimización)

- Supabase guarda el correo, la contraseña (hash de Supabase Auth) y la suscripción: estado, ID de PayPal, plan y fechas.
- `billing_events` guarda solo ID, tipo y recurso del evento, **no** el contenido del pagador.
- Los guiones siguen en el `localStorage` del usuario.
- Riesgos abiertos: regiones de datos de Vercel y Supabase, transferencias internacionales, plazo de conservación, impuestos sobre servicios digitales (Chile y países de venta) y derecho de retracto. Deben revisarse con un profesional antes de cobrar.
