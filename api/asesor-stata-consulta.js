// api/asesor-stata-consulta.js — Vercel Edge Function: responde preguntas
// sobre la base de conocimiento ya guardada de Asesor Stata (repo privado
// leonidcapo/asesor-stata), sintetizando con DeepSeek. Nunca investiga fuera
// de esa base -- para eso está el Modo 2 de /asesor-stata en Claude Code.
//
// Requiere ASESOR_STATA_GITHUB_TOKEN y DEEPSEEK_API_KEY en Vercel ->
// Settings -> Environment Variables. Sin cualquiera de las dos, responde 503.

import { fetchFileRaw } from './_lib/asesor-stata-github.js';
import { elegirNotasRelevantes } from './_lib/asesor-stata-relevancia.js';

export const config = { runtime: 'edge' };

const MAX_PREGUNTA_CHARS = 500;
const MAX_CONTEXT_CHARS = 100000;
const MAX_NOTAS_CONTEXTO = 8;

const NIVEL_DEFAULT = 'intermedio';

const INSTRUCCION_NIVEL = {
  basico: 'Nivel de la respuesta: BÁSICO. Quien pregunta no está familiarizado con Stata ni con ' +
    'jerga estadística. Usa lenguaje simple, explica cualquier término técnico la primera vez que ' +
    'aparece, usa analogías si ayudan, y no asumas que sabe qué es un comando de Stata.',
  intermedio: 'Nivel de la respuesta: INTERMEDIO. Quien pregunta entiende estadística pero no ' +
    'necesariamente los comandos específicos de Stata — explica qué hace cada comando que menciones.',
  avanzado: 'Nivel de la respuesta: AVANZADO. Quien pregunta ya sabe estadística y Stata. Sé ' +
    'directo: sintaxis exacta, sin explicaciones introductorias de conceptos básicos.',
};

const PROMPT_SISTEMA = 'Eres el asistente de consulta de la base de conocimiento "Asesor Stata": ' +
  'notas en español sobre Stata, estadística aplicada y metodología, relevantes para ' +
  'DolphinStats. Se te da el contenido completo de todas las notas guardadas hasta ahora. ' +
  'Reglas estrictas:\n\n' +
  '1. Responde la pregunta del usuario ÚNICAMENTE con información que esté en las notas de ' +
  'abajo. Nunca uses conocimiento externo ni inventes referencias.\n' +
  '2. Si tu respuesta usa contenido de una o más notas, cítalas por su título exacto y su ' +
  'path exacto, tal como aparecen en el encabezado "### <path>" de cada nota.\n' +
  '3. Si ninguna nota de la base es relevante para la pregunta, dilo honestamente ("no hay ' +
  'nada en la base sobre esto todavía") en vez de inventar una respuesta, y sugiere ' +
  'investigarlo con /asesor-stata en Claude Code.\n\n' +
  'Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional antes ni después, con ' +
  'esta forma exacta:\n' +
  '{"respuesta": "<respuesta en español, 2-6 oraciones>", "notas_citadas": ' +
  '[{"titulo": "<título exacto de la nota>", "path": "<path exacto>"}]}\n' +
  'Si no citás ninguna nota, "notas_citadas" debe ser un array vacío.';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function construirContexto(token, deepseekKey, pregunta) {
  const paths = await elegirNotasRelevantes(token, deepseekKey, pregunta, MAX_NOTAS_CONTEXTO);
  if (!paths.length) return '';

  const contenidos = await Promise.all(paths.map(function (p) { return fetchFileRaw(token, p); }));
  var bloques = [];
  var total = 0;
  for (var i = 0; i < paths.length; i++) {
    const markdown = contenidos[i];
    if (markdown === null) continue;
    const bloque = '### ' + paths[i] + '\n' + markdown;
    if (total + bloque.length > MAX_CONTEXT_CHARS) break;
    bloques.push(bloque);
    total += bloque.length;
  }
  return bloques.join('\n\n');
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Método no permitido.' });
  }

  const githubToken = process.env.ASESOR_STATA_GITHUB_TOKEN;
  if (!githubToken) {
    return jsonResponse(503, { error: 'La base de conocimiento no está disponible en este momento.' });
  }
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (!deepseekKey) {
    return jsonResponse(503, { error: 'La consulta no está disponible en este momento.' });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse(400, { error: 'Solicitud inválida.' });
  }

  const pregunta = body && typeof body.pregunta === 'string' ? body.pregunta.trim().slice(0, MAX_PREGUNTA_CHARS) : '';
  if (!pregunta) {
    return jsonResponse(400, { error: 'Escribe tu pregunta.' });
  }

  const nivelPedido = body && typeof body.nivel === 'string' ? body.nivel.trim().toLowerCase() : '';
  const nivel = INSTRUCCION_NIVEL[nivelPedido] ? nivelPedido : NIVEL_DEFAULT;

  let contexto;
  try {
    contexto = await construirContexto(githubToken, deepseekKey, pregunta);
  } catch (e) {
    return jsonResponse(502, { error: 'No se pudo conectar con la base de conocimiento. Intenta de nuevo.' });
  }

  if (!contexto) {
    return jsonResponse(200, { respuesta: 'La base de conocimiento todavía no tiene notas guardadas.', notas_citadas: [] });
  }

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
          { role: 'system', content: PROMPT_SISTEMA + '\n\n' + INSTRUCCION_NIVEL[nivel] },
          { role: 'user', content: contexto + '\n\nPregunta: ' + pregunta },
        ],
        max_tokens: 800 + (Number(process.env.DEEPSEEK_REASONING_MARGIN) || 1500),
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });
  } catch (e) {
    return jsonResponse(502, { error: 'No se pudo responder la consulta en este momento. Intenta de nuevo.' });
  }

  if (!upstream.ok) {
    return jsonResponse(502, { error: 'No se pudo responder la consulta en este momento. Intenta de nuevo.' });
  }

  let data;
  try {
    data = await upstream.json();
  } catch (e) {
    return jsonResponse(502, { error: 'No se pudo interpretar la respuesta. Intenta de nuevo.' });
  }

  const contenido = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content : null;
  let parsed;
  try {
    parsed = JSON.parse(contenido);
  } catch (e) {
    return jsonResponse(502, { error: 'No se pudo interpretar la respuesta. Intenta de nuevo.' });
  }

  if (!parsed || typeof parsed.respuesta !== 'string' || !Array.isArray(parsed.notas_citadas)) {
    return jsonResponse(502, { error: 'No se pudo interpretar la respuesta. Intenta de nuevo.' });
  }

  const notasCitadas = parsed.notas_citadas.filter(function (n) {
    return n && typeof n.titulo === 'string' && n.titulo.trim() && typeof n.path === 'string' && n.path.trim();
  });

  return jsonResponse(200, { respuesta: parsed.respuesta, notas_citadas: notasCitadas });
}
