// Basic Auth para todo el sitio (plan Hobby de Vercel, sin costo).
// Credenciales via variables de entorno del proyecto en Vercel
// (Settings -> Environment Variables): SITE_USER, SITE_PASS.
// Nunca hardcodear usuario/contraseña acá ni commitearlos.

export const config = {
  matcher: '/((?!_vercel|favicon.ico).*)',
};

export default function middleware(request) {
  const expectedUser = process.env.SITE_USER;
  const expectedPass = process.env.SITE_PASS;

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Basic ')) {
    const decoded = atob(authHeader.slice(6));
    const sep = decoded.indexOf(':');
    const user = decoded.slice(0, sep);
    const pass = decoded.slice(sep + 1);
    if (user === expectedUser && pass === expectedPass) {
      return; // credenciales correctas: deja pasar la request
    }
  }

  return new Response('Autenticación requerida', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="DolphinStats Eco"' },
  });
}
