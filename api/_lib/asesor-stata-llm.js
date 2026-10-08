// api/_lib/asesor-stata-llm.js — llamada a DeepSeek en streaming y respuesta
// "abierta de inmediato" para las Edge Functions de Asesor Stata (consulta y
// código).
//
// Una Edge Function debe *empezar* a responder en ~25 s, pero una vez empezada
// puede seguir transmitiendo. Por eso la respuesta al navegador se abre ya y se
// mantiene viva con espacios mientras DeepSeek genera; el JSON final va al
// cierre (JSON.parse ignora los espacios iniciales).

const TIMEOUT_DEEPSEEK_MS = 120000;
const INTERVALO_KEEPALIVE_MS = 5000;

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

// Devuelve el JSON que respondió el modelo. Lanza Error con message:
// 'timeout' | 'upstream_error' | 'respuesta_truncada' | 'parse_error'.
// opciones.maxTokens: tokens de la respuesta visible (se suma el margen de
// razonamiento, DEEPSEEK_REASONING_MARGIN); opciones.temperature.
export async function llamarDeepSeek(promptSistema, promptUsuario, deepseekKey, opciones) {
  opciones = opciones || {};
  const maxTokens = opciones.maxTokens || 6000;
  const temperature = opciones.temperature != null ? opciones.temperature : 0.2;
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
        max_tokens: maxTokens + (Number(process.env.DEEPSEEK_REASONING_MARGIN) || 1500),
        temperature: temperature,
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

// Abre la respuesta ya (status 200), manda un espacio cada pocos segundos y al
// final escribe el JSON que devuelva `trabajo`. Los errores que ocurren después
// de abrir llegan como {error} dentro del cuerpo.
export function respuestaEnStreaming(trabajo) {
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

// Mensaje para el usuario según el error de llamarDeepSeek. `accion` va con
// artículo implícito femenino: 'revisión', 'consulta', 'generación'...
export function mensajeError(e, accion) {
  if (e && e.message === 'timeout') {
    return 'La ' + accion + ' está tardando demasiado. Prueba con un texto más corto o intenta de nuevo.';
  }
  if (e && e.message === 'respuesta_truncada') {
    return 'La respuesta fue demasiado larga y se cortó. Prueba con un texto más corto.';
  }
  return 'No se pudo completar la ' + accion + ' en este momento. Intenta de nuevo.';
}
