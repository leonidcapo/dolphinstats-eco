// api/_lib/asesor-stata-relevancia.js — router de relevancia en dos pasos:
// dado el título+resumen de cada nota (ya están en INDEX.md, sin traer el
// cuerpo de ninguna), le pide a DeepSeek que elija hasta `limite` paths
// relevantes para una consulta puntual. Acota el contexto real de
// Buscar/Código a un número fijo de notas sin importar cuánto crezca la
// base -- ver docs/superpowers/specs/2026-09-30-asesor-stata-router-relevancia-design.md.
//
// Nunca lanza: cualquier fallo (GitHub, DeepSeek, JSON malformado) cae a un
// array vacío, igual que "nada relevante" -- nunca bloquea la consulta
// principal por un fallo del router.

import { fetchFileRaw, parseIndex } from './asesor-stata-github.js';

const LIMITE_DEFAULT = 8;
const TIMEOUT_ROUTER_MS = 8000;

const PROMPT_ROUTER = 'Sos un router de relevancia para la base de conocimiento "Asesor Stata". ' +
  'Se te da una lista de notas (path, título, resumen) y una consulta. Elegí como máximo ' +
  '{{LIMITE}} paths de notas realmente relevantes para esa consulta -- si ninguna aplica, ' +
  'devolvé un array vacío. Usá EXACTAMENTE los paths tal como aparecen en la lista, no ' +
  'inventes ni modifiques ninguno.\n\n' +
  'Responde ÚNICAMENTE con este JSON, sin texto alrededor: {"paths": ["...", ...]}';

export async function elegirNotasRelevantes(token, deepseekKey, textoConsulta, limite) {
  limite = limite || LIMITE_DEFAULT;
  try {
    const indexText = await fetchFileRaw(token, 'INDEX.md');
    const indice = parseIndex(indexText || '');

    var notas = [];
    indice.temas.forEach(function (tema) {
      tema.notas.forEach(function (nota) {
        notas.push({ titulo: nota.titulo, path: nota.path, resumen: nota.resumen });
      });
    });
    if (!notas.length) return [];

    const listado = notas.map(function (n) {
      return '- ' + n.path + ' — ' + n.titulo + ': ' + n.resumen;
    }).join('\n');

    const controlador = new AbortController();
    const corteTimeout = setTimeout(function () { controlador.abort(); }, TIMEOUT_ROUTER_MS);
    let upstream;
    try {
      upstream = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + deepseekKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: PROMPT_ROUTER.replace('{{LIMITE}}', String(limite)) },
            { role: 'user', content: 'Consulta: ' + textoConsulta + '\n\nNotas disponibles:\n' + listado },
          ],
          max_tokens: 500 + (Number(process.env.DEEPSEEK_REASONING_MARGIN) || 1500),
          temperature: 0,
          response_format: { type: 'json_object' },
        }),
        signal: controlador.signal,
      });
    } finally {
      clearTimeout(corteTimeout);
    }
    if (!upstream.ok) return [];

    const data = await upstream.json();
    const contenido = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content : null;
    const parsed = JSON.parse(contenido);
    if (!parsed || !Array.isArray(parsed.paths)) return [];

    const pathsValidos = new Set(notas.map(function (n) { return n.path; }));
    return parsed.paths
      .filter(function (p) { return typeof p === 'string' && pathsValidos.has(p); })
      .slice(0, limite);
  } catch (e) {
    return [];
  }
}
