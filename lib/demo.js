/* Modo demostración: permite recorrer el flujo sin cobrar. Nunca disponible en producción. */
export const demoAllowed = (env = process.env) => env.BILLING_DEMO === 'true' && env.VERCEL_ENV !== 'production';
