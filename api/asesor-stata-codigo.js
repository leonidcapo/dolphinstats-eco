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
// Con un texto largo (p.ej. un do-file completo pegado en "Revisar") no se le
// pasa el archivo entero al router de relevancia: se le pasa un extracto
// (comentarios + comandos únicos), que dice qué análisis se hace sin inflar
// la llamada. Ver extractoParaRouter.
const MAX_CHARS_PARA_ROUTER = 3000;
// La respuesta al navegador se abre de inmediato y se mantiene viva con
// espacios mientras DeepSeek genera (una revisión de un do-file largo tarda
// más que el límite de ~25s para *empezar* a responder de una Edge Function;
// una vez empezada, puede seguir transmitiendo). El JSON final va al cierre
// -- JSON.parse ignora los espacios iniciales.
const TIMEOUT_DEEPSEEK_MS = 120000;
const INTERVALO_KEEPALIVE_MS = 5000;

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
  'Revisa el código y devuelve una lista de hallazgos: buenas prácticas faltantes, errores ' +
  'probables, riesgos de reproducibilidad, o mejoras metodológicas. Usa tu conocimiento general ' +
  'de Stata — no te limites a lo que aparezca en las notas. Si una nota de la base aplica ' +
  'directamente a un hallazgo, cítala por su título y path exactos (como aparecen en el ' +
  'encabezado "### <path>" de cada nota); si no aplica ninguna, deja nota_citada en null.\n\n' +
  'Si el código no tiene problemas relevantes, devolvé un array de hallazgos vacío — no ' +
  'inventes hallazgos triviales solo para tener algo que decir.\n\n' +
  'Devuelve como MÁXIMO 8 hallazgos, los más relevantes, ordenados con los "importante" primero. ' +
  'Cada campo de texto en 1-2 oraciones breves.\n\n' +
  'Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional antes ni después:\n' +
  '{"hallazgos": [{"severidad": "importante"|"sugerencia", "que": "<qué está mal o se puede ' +
  'mejorar>", "por_que": "<por qué importa>", "como_arreglar": "<cómo solucionarlo>", ' +
  '"nota_citada": {"titulo": "...", "path": "..."} | null}]}';

const PROMPT_GENERAR = 'Eres un generador de código Stata para DolphinStats (consultoría en ' +
  'investigación clínica y bioestadística). Se te da una descripción en lenguaje natural de un ' +
  'análisis y, opcionalmente, notas de una base de conocimiento interna que pueden ser ' +
  'relevantes.\n\n' +
  'Genera un do-file completo y funcional que haga lo que se describe, usando buenas prácticas ' +
  '(version fija, comandos claros, comentarios breves si ayudan). Usa tu conocimiento general de ' +
  'Stata — no te limites a lo que aparezca en las notas. Si una nota de la base aplica ' +
  'directamente, cítala en notas_citadas (título y path exactos); si no aplica ninguna, deja ese ' +
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

// Resume un do-file para el router: comentarios (qué se analiza) y la lista
// de comandos distintos usados (cómo), recortado a MAX_CHARS_PARA_ROUTER.
function extractoParaRouter(codigo) {
  if (codigo.length <= MAX_CHARS_PARA_ROUTER) return codigo;
  const comentarios = [];
  const comandos = [];
  const lineas = codigo.split(/\r?\n/);
  for (var i = 0; i < lineas.length; i++) {
    const l = lineas[i].trim();
    if (!l) continue;
    if (l.charAt(0) === '*' || l.indexOf('//') === 0) {
      const texto = l.replace(/^[*\/\s=\-#]+/, '').replace(/[*=\-#\s]+$/, '');
      if (texto && comentarios.indexOf(texto) === -1) comentarios.push(texto);
      continue;
    }
    const m = l.match(/^(?:quietly\s+|qui\s+|capture\s+|cap\s+|noisily\s+|bysort\s+[^:]+:\s*|by\s+[^:]+:\s*)*([a-z_][a-z0-9_]*)/i);
    if (m && comandos.indexOf(m[1].toLowerCase()) === -1) comandos.push(m[1].toLowerCase());
  }
  const extracto = 'Comandos usados: ' + comandos.join(', ') + '\n\nComentarios del do-file:\n' + comentarios.join('\n');
  return extracto.slice(0, MAX_CHARS_PARA_ROUTER);
}

async function construirContextoOpcional(textoConsulta) {
  const token = process.env.ASESOR_STATA_GITHUB_TOKEN;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (!token) return '';
  textoConsulta = extractoParaRouter(textoConsulta);
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

function mensajeError(e, accion) {
  if (e && e.message === 'timeout') {
    return 'La ' + accion + ' está tardando demasiado. Prueba con un texto más corto o intenta de nuevo.';
  }
  if (e && e.message === 'respuesta_truncada') {
    return 'La respuesta fue demasiado larga y se cortó. Prueba con un texto más corto.';
  }
  return 'No se pudo completar la ' + accion + ' en este momento. Intenta de nuevo.';
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

// Lee el stream SSE de DeepSeek acumulando solo el contenido visible (el
// razonamiento llega en otro campo y se descarta).
async function leerStreamDeepSeek(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let contenido = '';
  let finishReason = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lineas = buffer.split('\n');
    buffer = lineas.pop();
    for (const linea of lineas) {
      const l = linea.trim();
      if (l.indexOf('data:') !== 0) continue;
      const payload = l.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let evento;
      try { evento = JSON.parse(payload); } catch (e) { continue; }
      const choice = evento && evento.choices && evento.choices[0];
      if (!choice) continue;
      if (choice.delta && typeof choice.delta.content === 'string') contenido += choice.delta.content;
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
  }
  return { contenido: contenido, finishReason: finishReason };
}

async function llamarDeepSeek(promptSistema, promptUsuario, deepseekKey) {
  const controlador = new AbortController();
  const corteTimeout = setTimeout(function () { controlador.abort(); }, TIMEOUT_DEEPSEEK_MS);
  let resultado;
  try {
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
        max_tokens: 6000 + (Number(process.env.DEEPSEEK_REASONING_MARGIN) || 1500),
        temperature: 0.2,
        response_format: { type: 'json_object' },
        stream: true,
      }),
      signal: controlador.signal,
    });
    if (!upstream.ok || !upstream.body) {
      throw new Error('upstream_error');
    }
    resultado = await leerStreamDeepSeek(upstream.body);
  } catch (e) {
    if (e && e.name === 'AbortError') {
      throw new Error('timeout');
    }
    throw e;
  } finally {
    clearTimeout(corteTimeout);
  }
  try {
    return JSON.parse(resultado.contenido);
  } catch (e) {
    if (resultado.finishReason === 'length') {
      throw new Error('respuesta_truncada');
    }
    throw new Error('parse_error');
  }
}

// Abre la respuesta ya (status 200), manda un espacio cada pocos segundos y
// al final escribe el JSON que devuelva `trabajo`. Los errores que ocurren
// después de abrir llegan como {error} dentro del cuerpo.
function respuestaEnStreaming(trabajo) {
  const encoder = new TextEncoder();
  let intervalo;
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(' '));
      intervalo = setInterval(function () { controller.enqueue(encoder.encode(' ')); }, INTERVALO_KEEPALIVE_MS);
      let cuerpo;
      try {
        cuerpo = await trabajo();
      } catch (e) {
        cuerpo = { error: 'No se pudo procesar el pedido. Intenta de nuevo.' };
      }
      clearInterval(intervalo);
      controller.enqueue(encoder.encode(JSON.stringify(cuerpo)));
      controller.close();
    },
    cancel() { clearInterval(intervalo); },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
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
      return jsonResponse(400, { error: 'Pega el código a revisar.' });
    }

    return respuestaEnStreaming(async function () {
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
        return { error: mensajeError(e, 'revisión') };
      }

      const hallazgos = parsed ? validarHallazgos(parsed.hallazgos) : null;
      if (hallazgos === null) {
        return { error: 'No se pudo interpretar la respuesta. Intenta de nuevo.' };
      }
      return { hallazgos: hallazgos };
    });
  }

  // modo === 'generar'
  const descripcion = body && typeof body.descripcion === 'string' ? body.descripcion.trim().slice(0, MAX_DESCRIPCION_CHARS) : '';
  if (!descripcion) {
    return jsonResponse(400, { error: 'Describe qué análisis quieres generar.' });
  }

  return respuestaEnStreaming(async function () {
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
      return { error: mensajeError(e, 'generación') };
    }

    if (!parsed || typeof parsed.codigo !== 'string' || typeof parsed.explicacion !== 'string' || !Array.isArray(parsed.notas_citadas)) {
      return { error: 'No se pudo interpretar la respuesta. Intenta de nuevo.' };
    }

    const notasCitadas = parsed.notas_citadas.map(filtrarNotaCitada).filter(function (n) { return n !== null; });

    return { codigo: parsed.codigo, explicacion: parsed.explicacion, notas_citadas: notasCitadas };
  });
}
