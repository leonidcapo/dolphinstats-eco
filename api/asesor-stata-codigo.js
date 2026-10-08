// api/asesor-stata-codigo.js — Vercel Edge Function con cuatro modos sobre
// código y resultados de Stata, sintetizados con DeepSeek:
//   revisar     -> hallazgos sobre un do-file (con número de línea y arreglo)
//   explicar    -> qué hace un do-file, paso a paso
//   interpretar -> qué dice la salida pegada de Stata (tabla, modelo, prueba)
//   generar     -> do-file nuevo a partir de una descripción (o ajuste de uno previo)
// A diferencia de asesor-stata-consulta.js, NO restringe al modelo a solo lo
// documentado en knowledge/ -- usa su conocimiento general de Stata; en
// revisar y generar el contexto de la base es apoyo opcional (si falla traerlo,
// se sigue sin él, no es fatal acá).
//
// Requiere DEEPSEEK_API_KEY en Vercel -> Settings -> Environment Variables.
// Sin ella, responde 503.

import { fetchFileRaw } from './_lib/asesor-stata-github.js';
import { elegirNotasRelevantes } from './_lib/asesor-stata-relevancia.js';
import { llamarDeepSeek, respuestaEnStreaming, mensajeError } from './_lib/asesor-stata-llm.js';

export const config = { runtime: 'edge' };

const MAX_CODIGO_CHARS = 20000;
const MAX_DESCRIPCION_CHARS = 1000;
const MAX_AJUSTE_CHARS = 500;
const MAX_CODIGO_PREVIO_CHARS = 12000;
const MAX_SALIDA_CHARS = 8000;
const MAX_CONTEXTO_ESTUDIO_CHARS = 500;
const MAX_CODIGO_CORREGIDO_CHARS = 1500;
const MAX_CONTEXT_CHARS = 60000;
const MAX_NOTAS_CONTEXTO = 8;
// Con un texto largo (p.ej. un do-file completo pegado en "Revisar") no se le
// pasa el archivo entero al router de relevancia: se le pasa un extracto
// (comentarios + comandos únicos), que dice qué análisis se hace sin inflar
// la llamada. Ver extractoParaRouter.
const MAX_CHARS_PARA_ROUTER = 3000;

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

const NOTA_LINEAS = 'El código llega con las líneas numeradas ("  12| comando"): el número y la barra ' +
  'NO son parte del código; úsalos solo para indicar líneas y no los copies en ningún fragmento de código.';

const PROMPT_REVISAR = 'Eres un revisor experto de código Stata para DolphinStats (consultoría ' +
  'en investigación clínica y bioestadística). Se te da un script .do y, opcionalmente, notas de ' +
  'una base de conocimiento interna que pueden ser relevantes.\n\n' +
  'Revisa el código y devuelve una lista de hallazgos: buenas prácticas faltantes, errores ' +
  'probables, riesgos de reproducibilidad, o mejoras metodológicas. Usa tu conocimiento general ' +
  'de Stata — no te limites a lo que aparezca en las notas. Si una nota de la base aplica ' +
  'directamente a un hallazgo, cítala por su título y path exactos (como aparecen en el ' +
  'encabezado "### <path>" de cada nota); si no aplica ninguna, deja nota_citada en null.\n\n' +
  'Si el código no tiene problemas relevantes, devuelve un array de hallazgos vacío — no ' +
  'inventes hallazgos triviales solo para tener algo que decir.\n\n' +
  NOTA_LINEAS + ' En "lineas" pon la línea o el rango donde está el problema ("12" o "12-15"); ' +
  'null si el hallazgo es general. En "codigo_corregido" pon cómo debería quedar ese fragmento ' +
  '(máximo 6 líneas) solo cuando el arreglo se entiende mejor viéndolo; si no, null.\n\n' +
  'Devuelve como MÁXIMO 8 hallazgos, los más relevantes, ordenados con los "importante" primero. ' +
  'Cada campo de texto en 1-2 oraciones breves.\n\n' +
  'Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional antes ni después:\n' +
  '{"hallazgos": [{"severidad": "importante"|"sugerencia", "lineas": "12-15"|null, "que": "<qué ' +
  'está mal o se puede mejorar>", "por_que": "<por qué importa>", "como_arreglar": "<cómo ' +
  'solucionarlo>", "codigo_corregido": "<fragmento>"|null, ' +
  '"nota_citada": {"titulo": "...", "path": "..."} | null}]}';

const PROMPT_EXPLICAR = 'Eres un tutor de Stata para DolphinStats (consultoría en investigación ' +
  'clínica y bioestadística). Se te da un do-file y debes explicar qué hace, paso a paso, para que ' +
  'quien lo escribió o lo heredó lo entienda.\n\n' +
  'Agrupa las líneas consecutivas que forman un mismo paso (por ejemplo, "importar y limpiar", ' +
  '"crear variables", "tabla 1", "modelo") en MÁXIMO 12 pasos, en el orden del archivo. Para cada ' +
  'paso explica qué hace y para qué sirve en el análisis. Si un paso tiene una trampa o un riesgo ' +
  'real (valores perdidos tratados como números grandes, una ruta absoluta, un modelo sin revisar ' +
  'supuestos), señálalo en "ojo"; si no, null. No inventes lo que no está en el código.\n\n' +
  NOTA_LINEAS + ' En "lineas" pon la línea o el rango del paso ("5" o "5-12").\n\n' +
  'Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional antes ni después:\n' +
  '{"resumen": "<2-3 oraciones: qué hace el do-file en conjunto>", "pasos": [{"lineas": "5-12", ' +
  '"que_hace": "<explicación del paso>", "ojo": "<advertencia>"|null}]}';

const PROMPT_INTERPRETAR = 'Eres un bioestadístico que explica resultados de Stata a quien los ' +
  'obtuvo, para DolphinStats (consultoría en investigación clínica). Se te da la salida pegada de ' +
  'Stata (una tabla, un modelo, una prueba) y, opcionalmente, una frase con el contexto del estudio.\n\n' +
  'Interpreta lo que dicen los números, citando valores CONCRETOS de la salida (coeficiente, OR, ' +
  'HR, diferencia de medias, IC y valor p según corresponda). No inventes números que no estén en ' +
  'la salida. Distingue asociación de causalidad, comenta la precisión (ancho del IC, tamaño de ' +
  'muestra) y menciona los supuestos que conviene verificar. Si el texto no parece una salida de ' +
  'Stata interpretable, déjalo claro en "que_se_hizo" y devuelve "resultados" vacío.\n\n' +
  'Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional antes ni después:\n' +
  '{"que_se_hizo": "<1-2 oraciones: qué análisis es>", "resultados": [{"dato": "<nombre del ' +
  'resultado con su valor citado de la salida>", "significado": "<qué significa>"}], ' +
  '"precauciones": ["<cuidado al interpretar o supuesto a verificar>"], ' +
  '"como_reportarlo": "<una frase modelo para la sección de resultados>"|null}\n' +
  'Máximo 6 resultados y 4 precauciones, cada texto en 1-2 oraciones.';

const PROMPT_GENERAR = 'Eres un generador de código Stata para DolphinStats (consultoría en ' +
  'investigación clínica y bioestadística). Se te da una descripción en lenguaje natural de un ' +
  'análisis y, opcionalmente, notas de una base de conocimiento interna que pueden ser ' +
  'relevantes.\n\n' +
  'Genera un do-file completo y funcional que haga lo que se describe, usando buenas prácticas ' +
  '(version fija, comandos claros, comentarios breves si ayudan). Usa tu conocimiento general de ' +
  'Stata — no te limites a lo que aparezca en las notas. Si una nota de la base aplica ' +
  'directamente, cítala en notas_citadas (título y path exactos); si no aplica ninguna, deja ese ' +
  'array vacío.\n\n' +
  'Si además se te da el código actual y un ajuste pedido, devuelve el do-file COMPLETO ya ' +
  'modificado con ese ajuste (no solo el cambio) y di en "explicacion" qué cambiaste.\n\n' +
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

function bloqueDeContexto(contexto) {
  return contexto ? '\n\nNotas de la base de conocimiento (úsalas solo si aplican):\n' + contexto : '';
}

// "  1| linea" -- el modelo cita líneas reales en vez de contarlas a ojo.
function numerarLineas(codigo) {
  const lineas = codigo.split(/\r?\n/);
  const ancho = String(lineas.length).length;
  return {
    texto: lineas.map(function (l, i) { return String(i + 1).padStart(ancho, ' ') + '| ' + l; }).join('\n'),
    total: lineas.length,
  };
}

// "12", "12-15" o 12 -> "12" / "12-15"; cualquier otra cosa, o fuera del
// archivo, o rango invertido -> null.
function normalizarLineas(valor, totalLineas) {
  if (typeof valor === 'number') valor = String(valor);
  if (typeof valor !== 'string') return null;
  const m = valor.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
  if (!m) return null;
  const desde = Number(m[1]);
  const hasta = m[2] !== undefined ? Number(m[2]) : desde;
  if (desde < 1 || hasta < desde || hasta > totalLineas) return null;
  return desde === hasta ? String(desde) : desde + '-' + hasta;
}

function filtrarNotaCitada(n) {
  if (!n || typeof n !== 'object') return null;
  if (typeof n.titulo === 'string' && n.titulo.trim() && typeof n.path === 'string' && n.path.trim()) {
    return { titulo: n.titulo, path: n.path };
  }
  return null;
}

// Si el modelo copió el prefijo "12| " de las líneas numeradas, se quita.
function limpiarCodigoCorregido(valor) {
  if (typeof valor !== 'string') return null;
  const limpio = valor.replace(/^[ \t]*\d+\|[ ]?/gm, '').trim();
  return limpio ? limpio.slice(0, MAX_CODIGO_CORREGIDO_CHARS) : null;
}

function validarHallazgos(lista, totalLineas) {
  if (!Array.isArray(lista)) return null;
  var validos = [];
  for (var i = 0; i < lista.length; i++) {
    const h = lista[i];
    if (!h || typeof h !== 'object') continue;
    if (h.severidad !== 'importante' && h.severidad !== 'sugerencia') continue;
    if (typeof h.que !== 'string' || typeof h.por_que !== 'string' || typeof h.como_arreglar !== 'string') continue;
    validos.push({
      severidad: h.severidad,
      lineas: normalizarLineas(h.lineas, totalLineas),
      que: h.que,
      por_que: h.por_que,
      como_arreglar: h.como_arreglar,
      codigo_corregido: limpiarCodigoCorregido(h.codigo_corregido),
      nota_citada: filtrarNotaCitada(h.nota_citada),
    });
  }
  return validos;
}

function textoONull(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

// {resumen, pasos:[{lineas, que_hace, ojo}]} o null si no sirve.
function validarExplicacion(parsed, totalLineas) {
  if (!parsed || typeof parsed.resumen !== 'string' || !parsed.resumen.trim() || !Array.isArray(parsed.pasos)) return null;
  const pasos = [];
  for (var i = 0; i < parsed.pasos.length; i++) {
    const p = parsed.pasos[i];
    if (!p || typeof p !== 'object' || typeof p.que_hace !== 'string' || !p.que_hace.trim()) continue;
    pasos.push({ lineas: normalizarLineas(p.lineas, totalLineas), que_hace: p.que_hace.trim(), ojo: textoONull(p.ojo) });
  }
  if (!pasos.length) return null;
  return { resumen: parsed.resumen.trim(), pasos: pasos };
}

// {que_se_hizo, resultados:[{dato, significado}], precauciones:[str], como_reportarlo} o null.
function validarInterpretacion(parsed) {
  if (!parsed || typeof parsed.que_se_hizo !== 'string' || !parsed.que_se_hizo.trim()) return null;
  const resultados = [];
  (Array.isArray(parsed.resultados) ? parsed.resultados : []).forEach(function (r) {
    if (r && typeof r.dato === 'string' && r.dato.trim() && typeof r.significado === 'string' && r.significado.trim()) {
      resultados.push({ dato: r.dato.trim(), significado: r.significado.trim() });
    }
  });
  const precauciones = (Array.isArray(parsed.precauciones) ? parsed.precauciones : [])
    .filter(function (p) { return typeof p === 'string' && p.trim(); })
    .map(function (p) { return p.trim(); });
  return {
    que_se_hizo: parsed.que_se_hizo.trim(),
    resultados: resultados,
    precauciones: precauciones,
    como_reportarlo: textoONull(parsed.como_reportarlo),
  };
}

function textoDe(body, campo, max) {
  return body && typeof body[campo] === 'string' ? body[campo].trim().slice(0, max) : '';
}

const ERROR_INTERPRETAR = 'No se pudo interpretar la respuesta. Intenta de nuevo.';

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
  if (modo !== 'revisar' && modo !== 'explicar' && modo !== 'interpretar' && modo !== 'generar') {
    return jsonResponse(400, { error: 'El modo debe ser "revisar", "explicar", "interpretar" o "generar".' });
  }

  const nivelPedido = body && typeof body.nivel === 'string' ? body.nivel.trim().toLowerCase() : '';
  const nivel = INSTRUCCION_NIVEL[nivelPedido] ? nivelPedido : NIVEL_DEFAULT;
  const sistema = function (prompt) { return prompt + '\n\n' + INSTRUCCION_NIVEL[nivel]; };

  if (modo === 'revisar') {
    const codigo = textoDe(body, 'codigo', MAX_CODIGO_CHARS);
    if (!codigo) {
      return jsonResponse(400, { error: 'Pega el código a revisar.' });
    }
    const numerado = numerarLineas(codigo);

    return respuestaEnStreaming(async function () {
      const contexto = await construirContextoOpcional(codigo);
      let parsed;
      try {
        parsed = await llamarDeepSeek(
          sistema(PROMPT_REVISAR),
          'Código a revisar:\n```\n' + numerado.texto + '\n```' + bloqueDeContexto(contexto),
          deepseekKey
        );
      } catch (e) {
        return { error: mensajeError(e, 'revisión') };
      }
      const hallazgos = parsed ? validarHallazgos(parsed.hallazgos, numerado.total) : null;
      if (hallazgos === null) return { error: ERROR_INTERPRETAR };
      return { hallazgos: hallazgos };
    });
  }

  if (modo === 'explicar') {
    const codigo = textoDe(body, 'codigo', MAX_CODIGO_CHARS);
    if (!codigo) {
      return jsonResponse(400, { error: 'Pega el do-file que quieres que te explique.' });
    }
    const numerado = numerarLineas(codigo);

    return respuestaEnStreaming(async function () {
      let parsed;
      try {
        parsed = await llamarDeepSeek(
          sistema(PROMPT_EXPLICAR),
          'Do-file a explicar:\n```\n' + numerado.texto + '\n```',
          deepseekKey,
          { maxTokens: 5000 }
        );
      } catch (e) {
        return { error: mensajeError(e, 'explicación') };
      }
      const explicacion = validarExplicacion(parsed, numerado.total);
      if (!explicacion) return { error: ERROR_INTERPRETAR };
      return explicacion;
    });
  }

  if (modo === 'interpretar') {
    const salida = textoDe(body, 'salida', MAX_SALIDA_CHARS);
    if (!salida) {
      return jsonResponse(400, { error: 'Pega la salida de Stata que quieres interpretar.' });
    }
    const contextoEstudio = textoDe(body, 'contexto', MAX_CONTEXTO_ESTUDIO_CHARS);

    return respuestaEnStreaming(async function () {
      let parsed;
      try {
        parsed = await llamarDeepSeek(
          sistema(PROMPT_INTERPRETAR),
          (contextoEstudio ? 'Contexto del estudio: ' + contextoEstudio + '\n\n' : '') +
            'Salida de Stata:\n```\n' + salida + '\n```',
          deepseekKey,
          { maxTokens: 3500 }
        );
      } catch (e) {
        return { error: mensajeError(e, 'interpretación') };
      }
      const interpretacion = validarInterpretacion(parsed);
      if (!interpretacion) return { error: ERROR_INTERPRETAR };
      return interpretacion;
    });
  }

  // modo === 'generar'
  const descripcion = textoDe(body, 'descripcion', MAX_DESCRIPCION_CHARS);
  if (!descripcion) {
    return jsonResponse(400, { error: 'Describe qué análisis quieres generar.' });
  }
  const codigoPrevio = textoDe(body, 'codigo_previo', MAX_CODIGO_PREVIO_CHARS);
  const ajuste = textoDe(body, 'ajuste', MAX_AJUSTE_CHARS);
  if (!!codigoPrevio !== !!ajuste) {
    return jsonResponse(400, { error: 'Para pedir un ajuste hace falta el código actual y lo que quieres cambiar.' });
  }

  return respuestaEnStreaming(async function () {
    const contexto = await construirContextoOpcional(descripcion);
    const bloqueAjuste = codigoPrevio
      ? '\n\nCódigo actual:\n```\n' + codigoPrevio + '\n```\n\nAjuste pedido: ' + ajuste
      : '';

    let parsed;
    try {
      parsed = await llamarDeepSeek(
        sistema(PROMPT_GENERAR),
        'Descripción del análisis:\n' + descripcion + bloqueAjuste + bloqueDeContexto(contexto),
        deepseekKey
      );
    } catch (e) {
      return { error: mensajeError(e, 'generación') };
    }

    if (!parsed || typeof parsed.codigo !== 'string' || typeof parsed.explicacion !== 'string' || !Array.isArray(parsed.notas_citadas)) {
      return { error: ERROR_INTERPRETAR };
    }

    const notasCitadas = parsed.notas_citadas.map(filtrarNotaCitada).filter(function (n) { return n !== null; });

    return { codigo: parsed.codigo, explicacion: parsed.explicacion, notas_citadas: notasCitadas };
  });
}
