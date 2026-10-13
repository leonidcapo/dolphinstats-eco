// api/_lib/asesor-r-notas.js — notas de la pestaña R. A diferencia de las de Stata (repo
// privado en GitHub), son archivos estáticos del propio sitio (r-notas/), así que se leen
// con un fetch al mismo despliegue reenviando las credenciales del pedido (el sitio entero
// está detrás de Basic Auth). Nunca lanza: si algo falla devuelve vacío.

import { parseIndex } from './asesor-stata-github.js';

const MAX_CONTEXT_CHARS = 60000;

async function pedirEstatico(request, ruta) {
  const url = new URL('/r-notas/' + ruta, request.url);
  const headers = {};
  const auth = request.headers.get('authorization');
  if (auth) headers.authorization = auth;
  const res = await fetch(url.toString(), { headers: headers });
  if (!res.ok) return null;
  return (await res.text()).replace(/\r\n/g, '\n');
}

// -> { contexto: '### <path>\n<markdown>\n\n...', paths: [...] }
export async function cargarNotasR(request) {
  try {
    const indexText = await pedirEstatico(request, 'INDEX.md');
    if (indexText === null) return { contexto: '', paths: [] };
    const paths = [];
    parseIndex(indexText).temas.forEach(function (t) { t.notas.forEach(function (n) { paths.push(n.path); }); });
    const contenidos = await Promise.all(paths.map(function (p) { return pedirEstatico(request, p); }));
    const bloques = [];
    const usados = [];
    let total = 0;
    for (let i = 0; i < paths.length; i++) {
      if (contenidos[i] === null) continue;
      const bloque = '### ' + paths[i] + '\n' + contenidos[i];
      if (total + bloque.length > MAX_CONTEXT_CHARS) break;
      bloques.push(bloque);
      usados.push(paths[i]);
      total += bloque.length;
    }
    return { contexto: bloques.join('\n\n'), paths: usados };
  } catch (e) {
    return { contexto: '', paths: [] };
  }
}
