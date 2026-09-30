// api/asesor-stata-codigo.js — Vercel Edge Function: revisa código Stata
// pegado por el usuario o genera un do-file nuevo a partir de una
// descripción, sintetizando con DeepSeek. A diferencia de
// asesor-stata-consulta.js, NO restringe al modelo a solo lo documentado en
// knowledge/ -- usa su conocimiento general de Stata; el contexto de la base
// es apoyo opcional (si falla traerlo, se sigue sin él, no es fatal acá).
//
// Requiere DEEPSEEK_API_KEY en Vercel -> Settings -> Environment Variables.
// Sin ella, responde 503.

import { fetchFileRaw } from './_lib/asesor-stata-github.js';
import { elegirNotasRelevantes } from './_lib/asesor-stata-relevancia.js';

export const config = { runtime: 'edge' };

const MAX_CODIGO_CHARS = 20000;
const MAX_DESCRIPCION_CHARS = 1000;
const MAX_CONTEXT_CHARS = 60000;
const MAX_NOTAS_CONTEXTO = 8;

const NIVEL_DEFAULT = 'intermedio';

const INSTRUCCION_NIVEL = {
  basico: 'Nivel de la respuesta: BÁSICO. Quien pregunta no está familiarizado con Stata ni con ' +
    'jerga estadística. Usa lenguaje simple, explica cualquier término técnico la primera vez que ' +
    'aparece, y no asumas que sabe qué es un comando de Stata.',
  intermedio: 'Nivel de la respuesta: INTERMEDIO. Quien pregunta entiende estadística pero no ' +
    'necesariamente los comandos específicos de Stata — explica qué hace cada comando que menciones.',
  avanzado: 'Nivel de la respuesta: AVANZADO. Quien pregunta ya sabe estadística y Stata. Sé ' +
    'directo: sintaxis exacta, sin explicaciones introductorias de conceptos básicos.',
};

const PROMPT_REVISAR = 'Eres un revisor experto de código Stata para DolphinStats (consultoría ' +
  'en investigación clínica y bioestadística). Se te da un script .do y, opcionalmente, notas de ' +
  'una base de conocimiento interna que pueden ser relevantes.\n\n' +
  'Revisá el código y devolvé una lista de hallazgos: buenas prácticas faltantes, errores ' +
  'probables, riesgos de reproducibilidad, o mejoras metodológicas. Usá tu conocimiento general ' +
  'de Stata — no te limites a lo que aparezca en las notas. Si una nota de la base aplica ' +
  'directamente a un hallazgo, citala por su título y path exactos (como aparecen en el ' +
  'encabezado "### <path>" de cada nota); si no aplica ninguna, dejá nota_citada en null.\n\n' +
  'Si el código no tiene problemas relevantes, devolvé un array de hallazgos vacío — no ' +
  'inventes hallazgos triviales solo para tener algo que decir.\n\n' +
  'Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional antes ni después:\n' +
  '{"hallazgos": [{"severidad": "importante"|"sugerencia", "que": "<qué está mal o se puede ' +
  'mejorar>", "por_que": "<por qué importa>", "como_arreglar": "<cómo solucionarlo>", ' +
  '"nota_citada": {"titulo": "...", "path": "..."} | null}]}';

const PROMPT_GENERAR = 'Eres un generador de código Stata para DolphinStats (consultoría en ' +
  'investigación clínica y bioestadística). Se te da una descripción en lenguaje natural de un ' +
  'análisis y, opcionalmente, notas de una base de conocimiento interna que pueden ser ' +
  'relevantes.\n\n' +
  'Generá un do-file completo y funcional que haga lo que se describe, usando buenas prácticas ' +
  '(version fija, comandos claros, comentarios breves si ayudan). Usá tu conocimiento general de ' +
  'Stata — no te limites a lo que aparezca en las notas. Si una nota de la base aplica ' +
  'directamente, citala en notas_citadas (título y path exactos); si no aplica ninguna, dejá ese ' +
  'array vacío.\n\n' +
  'Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional antes ni después:\n' +
  '{"codigo": "<do-file completo>", "explicacion": "<2-4 oraciones, qué hace el código>", ' +
  '"notas_citadas": [{"titulo": "...", "path": "..."}]}';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function construirContextoOpcional(textoConsulta) {
  const token = process.env.ASESOR_STATA_GITHUB_TOKEN;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (!token) return '';
  try {
    const paths = await elegirNotasRelevantes(token, deepseekKey, textoConsulta, MAX_NOTAS_CONTEXTO);
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
  } catch (e) {
    return '';
  }
}

function filtrarNotaCitada(n) {
  if (!n || typeof n !== 'object') return null;
  if (typeof n.titulo === 'string' && n.titulo.trim() && typeof n.path === 'string' && n.path.trim()) {
    return { titulo: n.titulo, path: n.path };
  }
  return null;
}

function validarHallazgos(lista) {
  if (!Array.isArray(lista)) return null;
  var validos = [];
  for (var i = 0; i < lista.length; i++) {
    const h = lista[i];
    if (!h || typeof h !== 'object') continue;
    if (h.severidad !== 'importante' && h.severidad !== 'sugerencia') continue;
    if (typeof h.que !== 'string' || typeof h.por_que !== 'string' || typeof h.como_arreglar !== 'string') continue;
    validos.push({
      severidad: h.severidad,
      que: h.que,
      por_que: h.por_que,
      como_arreglar: h.como_arreglar,
      nota_citada: filtrarNotaCitada(h.nota_citada),
    });
  }
  return validos;
}

async function llamarDeepSeek(promptSistema, promptUsuario, deepseekKey) {
  const upstream = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + deepseekKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: promptSistema },
        { role: 'user', content: promptUsuario },
      ],
      max_tokens: 1500 + (Number(process.env.DEEPSEEK_REASONING_MARGIN) || 1500),
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });
  if (!upstream.ok) {
    throw new Error('upstream_error');
  }
  const data = await upstream.json();
  const contenido = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content : null;
  return JSON.parse(contenido);
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Método no permitido.' });
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (!deepseekKey) {
    return jsonResponse(503, { error: 'Esta función no está disponible en este momento.' });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse(400, { error: 'Solicitud inválida.' });
  }

  const modo = body && typeof body.modo === 'string' ? body.modo : '';
  if (modo !== 'revisar' && modo !== 'generar') {
    return jsonResponse(400, { error: 'El modo debe ser "revisar" o "generar".' });
  }

  const nivelPedido = body && typeof body.nivel === 'string' ? body.nivel.trim().toLowerCase() : '';
  const nivel = INSTRUCCION_NIVEL[nivelPedido] ? nivelPedido : NIVEL_DEFAULT;

  if (modo === 'revisar') {
    const codigo = body && typeof body.codigo === 'string' ? body.codigo.trim().slice(0, MAX_CODIGO_CHARS) : '';
    if (!codigo) {
      return jsonResponse(400, { error: 'Pegá el código a revisar.' });
    }

    const contexto = await construirContextoOpcional(codigo);
    const bloqueContexto = contexto ? '\n\nNotas de la base de conocimiento (usalas solo si aplican):\n' + contexto : '';

    let parsed;
    try {
      parsed = await llamarDeepSeek(
        PROMPT_REVISAR + '\n\n' + INSTRUCCION_NIVEL[nivel],
        'Código a revisar:\n```\n' + codigo + '\n```' + bloqueContexto,
        deepseekKey
      );
    } catch (e) {
      return jsonResponse(502, { error: 'No se pudo revisar el código en este momento. Intenta de nuevo.' });
    }

    const hallazgos = parsed ? validarHallazgos(parsed.hallazgos) : null;
    if (hallazgos === null) {
      return jsonResponse(502, { error: 'No se pudo interpretar la respuesta. Intenta de nuevo.' });
    }
    return jsonResponse(200, { hallazgos: hallazgos });
  }

  // modo === 'generar'
  const descripcion = body && typeof body.descripcion === 'string' ? body.descripcion.trim().slice(0, MAX_DESCRIPCION_CHARS) : '';
  if (!descripcion) {
    return jsonResponse(400, { error: 'Describí qué análisis querés generar.' });
  }

  const contexto = await construirContextoOpcional(descripcion);
  const bloqueContexto = contexto ? '\n\nNotas de la base de conocimiento (usalas solo si aplican):\n' + contexto : '';

  let parsed;
  try {
    parsed = await llamarDeepSeek(
      PROMPT_GENERAR + '\n\n' + INSTRUCCION_NIVEL[nivel],
      'Descripción del análisis:\n' + descripcion + bloqueContexto,
      deepseekKey
    );
  } catch (e) {
    return jsonResponse(502, { error: 'No se pudo generar el código en este momento. Intenta de nuevo.' });
  }

  if (!parsed || typeof parsed.codigo !== 'string' || typeof parsed.explicacion !== 'string' || !Array.isArray(parsed.notas_citadas)) {
    return jsonResponse(502, { error: 'No se pudo interpretar la respuesta. Intenta de nuevo.' });
  }

  const notasCitadas = parsed.notas_citadas.map(filtrarNotaCitada).filter(function (n) { return n !== null; });

  return jsonResponse(200, { codigo: parsed.codigo, explicacion: parsed.explicacion, notas_citadas: notasCitadas });
}
