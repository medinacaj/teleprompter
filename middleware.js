/* Routing Middleware de Vercel: solo los suscriptores activos reciben el lector (/app/). */
import { gate } from './lib/gate.js';

export const config = { matcher: ['/app', '/app/:path*'] };

export default function middleware(request) {
  return gate(request, process.env, fetch);
}
