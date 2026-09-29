// api/asesor-stata-base.js — Vercel Edge Function: índice y notas de la base
// de conocimiento de Asesor Stata (repo privado leonidcapo/asesor-stata),
// para el modo "Explorar" de la página asesor-stata.html. Solo lectura.
//
// Requiere ASESOR_STATA_GITHUB_TOKEN (Personal Access Token de solo lectura
// sobre ese repo) en Vercel -> Settings -> Environment Variables. Sin el
// token, responde 503 con un mensaje honesto en vez de romper.

import { fetchFileRaw, GithubError } from './_lib/asesor-stata-github.js';

export const config = { runtime: 'edge' };

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function parseIndex(markdown) {
  var lineas = markdown.split('\n');
  var temas = [];
  var actual = null;
  for (var i = 0; i < lineas.length; i++) {
    var linea = lineas[i];
    var temaMatch = linea.match(/^##\s+(.+)$/);
    if (temaMatch) {
      actual = { nombre: temaMatch[1].trim(), notas: [] };
      temas.push(actual);
      continue;
    }
    if (!actual) continue;
    var notaMatch = linea.match(/^-\s*\[(.+?)\]\((.+?)\)(?:\s*—\s*(.*?))?(?:\s*·\s*(\d{4}-\d{2}-\d{2}))?$/);
    if (notaMatch) {
      actual.notas.push({
        titulo: notaMatch[1].trim(),
        path: notaMatch[2].trim(),
        resumen: (notaMatch[3] || '').trim(),
        fecha: notaMatch[4] || null,
      });
    }
  }
  return { temas: temas };
}

export default async function handler(request) {
  if (request.method !== 'GET') {
    return jsonResponse(405, { error: 'Método no permitido.' });
  }

  const token = process.env.ASESOR_STATA_GITHUB_TOKEN;
  if (!token) {
    return jsonResponse(503, { error: 'La base de conocimiento no está disponible en este momento.' });
  }

  const url = new URL(request.url);
  const nota = url.searchParams.get('nota');

  try {
    if (nota) {
      if (nota.indexOf('knowledge/') !== 0 || nota.slice(-3) !== '.md') {
        return jsonResponse(400, { error: 'Ruta de nota inválida.' });
      }
      // Check for path traversal attempts (..)
      const segments = nota.split('/');
      if (segments.includes('..')) {
        return jsonResponse(400, { error: 'Ruta de nota inválida.' });
      }
      const markdown = await fetchFileRaw(token, nota);
      if (markdown === null) {
        return jsonResponse(404, { error: 'No se encontró esa nota.' });
      }
      return jsonResponse(200, { path: nota, markdown: markdown });
    }

    const indexText = await fetchFileRaw(token, 'INDEX.md');
    const indice = parseIndex(indexText || '');
    return jsonResponse(200, indice);
  } catch (e) {
    if (e instanceof GithubError) {
      return jsonResponse(502, { error: 'No se pudo conectar con la base de conocimiento. Intenta de nuevo.' });
    }
    return jsonResponse(502, { error: 'Ocurrió un error inesperado. Intenta de nuevo.' });
  }
}
