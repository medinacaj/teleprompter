# Integración PayPal — diseño y puerta de activación

**Objetivo:** US$1,00/mes, sin prueba gratuita; entorno de pruebas primero. No activar cobros ni bloqueo de usuarios hasta completar el backend y pruebas.

## Requisitos
- Cuenta PayPal **Business** apta para suscripciones, acceso a PayPal Developer, aplicación Sandbox y Live.
- Crear producto digital y plan mensual USD 1,00 (sin trial) en la cuenta del comercio; registrar IDs por entorno.
- Backend HTTPS con secretos solo en servidor, identidad autenticada, base de datos de suscripciones y permisos de acceso.
- Webhook PayPal con **verificación criptográfica**, deduplicación de eventos y procesamiento idempotente.
- La aplicación actual está en GitHub Pages: su HTML y JS son públicos. Ocultar botones o comprobar `localStorage` no protege el producto.

## Flujo propuesto
1. El usuario inicia sesión; el servidor asocia su identidad con una solicitud de suscripción.
2. El backend crea la suscripción con el plan configurado y devuelve el enlace de aprobación de PayPal.
3. PayPal solicita consentimiento del comprador; la vuelta al sitio **no** activa por sí sola el acceso.
4. Backend verifica el estado real con PayPal, procesa webhooks firmados y registra eventos sin duplicados.
5. El backend autoriza operaciones protegidas según estado vigente, pagos y política de gracia documentada.
6. Cancelaciones, suspensiones, expiraciones, contracargos y fallos de pago actualizan el acceso; se permite gestionar la suscripción.

## Eventos mínimos
`BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.CANCELLED`, `BILLING.SUBSCRIPTION.SUSPENDED`, `BILLING.SUBSCRIPTION.EXPIRED`, `BILLING.SUBSCRIPTION.PAYMENT.FAILED`, `PAYMENT.SALE.COMPLETED`, `PAYMENT.SALE.REFUNDED`, `PAYMENT.SALE.REVERSED`.

## Seguridad y datos
- Nunca publicar `PAYPAL_CLIENT_SECRET`, tokens OAuth, claves de firma ni credenciales de base de datos.
- Separar Sandbox y Live; limitar CORS, autenticar sesiones y validar autorización del lado servidor.
- Datos mínimos: ID interno de usuario, ID de suscripción PayPal, plan, estado, fechas, IDs de eventos, historial técnico limitado.
- Política de privacidad, términos, precio final, impuestos aplicables, renovación y cancelación requieren revisión para Chile y jurisdicciones de venta.
- Verificar vigencia de documentación y comisiones antes del lanzamiento.

## Pruebas de aceptación
- Suscripción aprobada y confirmada, pendiente, rechazada, cancelada, suspendida, expirada y pago fallido.
- Webhook repetido, falso, fuera de orden y temporalmente no disponible.
- Sin sesión o sin suscripción: backend deniega recursos protegidos.
- Reconciliación de estados con PayPal y recuperación tras interrupciones.
- Pruebas con cuenta compradora Sandbox y validación final Live antes de habilitar cobros.

**Estado:** diseño técnico preparado. **No implementado:** backend, interfaz de cobro, credenciales, webhooks, base de datos, autenticación, despliegue y pruebas end-to-end. No afirmar integración activa.
