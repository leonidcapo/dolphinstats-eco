// Vercel Edge Function: proxy de DeepSeek para clasificar_diseno_ia (paso 4
// del roadmap "enriquecer con Epidat", puerto de chatbot.py en
// DolphinStatsBot). Existe porque el sitio es 100% estático (sin backend) y
// llamar a la API de DeepSeek directo desde el navegador expondría
// DEEPSEEK_API_KEY a cualquiera que mire el código fuente -- además el CSP
// del sitio (connect-src 'self') ya bloquearía ese fetch de todos modos. Acá
// la key vive solo en las variables de entorno de Vercel, nunca llega al
// cliente.
//
// Requiere que DEEPSEEK_API_KEY (y opcionalmente DEEPSEEK_MODEL,
// DEEPSEEK_REASONING_MARGIN) estén configuradas en Vercel -> Settings ->
// Environment Variables. Sin la key, responde 503 con un mensaje honesto en
// vez de romper.
//
// Mismo límite de responsabilidad que en chatbot.py: la IA NUNCA calcula el
// tamaño de muestra ni inventa un valor de p -- solo clasifica cuál de los 6
// diseños ya validados corresponde al título (mismo prompt, mismas 6
// opciones + "no_disponible" que ASISTENTE_ARBOL en calculadora-muestra.js).
// El cálculo lo sigue haciendo siempre la fórmula fija en el navegador.

export const config = { runtime: 'edge' };

const MAX_INPUT_CHARS = 600;

const DISENOS_VALIDOS = new Set([
  'proporcion_unica', 'dos_proporciones', 'dos_medias',
  'casos_controles', 'cohorte', 'correlacion', 'no_disponible',
]);

const PROMPT_CLASIFICADOR_DISENO = `Eres un clasificador de diseños de estudio para tesis de ciencias de la salud. Dado un título o pregunta de investigación, elige CUÁL de estos 6 diseños de cálculo de tamaño de muestra corresponde, o admite honestamente que ninguno aplica todavía. Nunca calcules un tamaño de muestra ni sugieras un valor de p -- solo clasifica el diseño.

Diseños disponibles (código exacto a usar):
- proporcion_unica: estimar una sola proporción o prevalencia (ej. "prevalencia de X en Y", "¿cuántos tienen X?")
- dos_proporciones: comparar una proporción (sí/no) entre dos grupos YA DEFINIDOS de antemano (ej. tratamiento vs. placebo, urbano vs. rural), sin que la selección de los grupos se base en tener o no la enfermedad, ni en estar o no expuestos
- dos_medias: comparar un promedio (variable numérica: peso, presión, puntaje) entre dos grupos independientes
- casos_controles: se parte de la enfermedad (casos vs. controles) y se mira hacia atrás la exposición pasada -- diseño retrospectivo; títulos con "factores de riesgo", "factores asociados a [enfermedad]"
- cohorte: se parte de la exposición y se sigue a los grupos en el tiempo para ver quién desarrolla la enfermedad -- diseño prospectivo
- correlacion: ver si dos variables numéricas están relacionadas entre sí, en las mismas personas, sin dividir en grupos (ej. "relación entre X y Y")

Si el título describe un diseño que NO es ninguno de estos 6 (ej. estimar una sola media/promedio con intervalo de confianza, o un diseño pareado/antes-después/antes-y-después en las mismas personas), responde con diseno="no_disponible" y en el motivo indica brevemente cuál sería el diseño correcto aunque todavía no esté disponible en la calculadora.

Si el título es ambiguo entre 2 diseños, elige el más probable dado cómo se suele plantear en tesis de salud, y dilo en el motivo (ej. "asumiendo que compararás dos grupos ya definidos; si en realidad partiste de los enfermos, sería casos y controles").

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional antes ni después, con esta forma exacta:
{"diseno": "<uno de: proporcion_unica, dos_proporciones, dos_medias, casos_controles, cohorte, correlacion, no_disponible>", "motivo": "<explicación breve, 1-2 oraciones, en español, dirigida directamente al estudiante>"}`;

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Método no permitido.' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return jsonResponse(503, { error: 'La clasificación automática no está disponible en este momento.' });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse(400, { error: 'Solicitud inválida.' });
  }

  const titulo = body && typeof body.titulo === 'string' ? body.titulo.trim().slice(0, MAX_INPUT_CHARS) : '';
  if (!titulo) {
    return jsonResponse(400, { error: 'Escribe tu título o pregunta de investigación.' });
  }

  const reasoningMargin = Number(process.env.DEEPSEEK_REASONING_MARGIN) || 1500;

  let upstream;
  try {
    upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: PROMPT_CLASIFICADOR_DISENO },
          { role: 'user', content: titulo },
        ],
        max_tokens: 300 + reasoningMargin,
        temperature: 0.2, // clasificación, no conversación -- se prefiere consistencia
        response_format: { type: 'json_object' },
      }),
    });
  } catch (e) {
    return jsonResponse(502, { error: 'No se pudo clasificar el diseño en este momento. Intenta de nuevo o usa el asistente de preguntas.' });
  }

  if (!upstream.ok) {
    return jsonResponse(502, { error: 'No se pudo clasificar el diseño en este momento. Intenta de nuevo o usa el asistente de preguntas.' });
  }

  let data;
  try {
    data = await upstream.json();
  } catch (e) {
    return jsonResponse(502, { error: 'No se pudo interpretar la respuesta. Intenta de nuevo o usa el asistente de preguntas.' });
  }

  var contenido = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content : null;
  var parsed;
  try {
    parsed = JSON.parse(contenido);
  } catch (e) {
    return jsonResponse(502, { error: 'No se pudo interpretar la respuesta. Intenta de nuevo o usa el asistente de preguntas.' });
  }

  if (!parsed || !DISENOS_VALIDOS.has(parsed.diseno)) {
    return jsonResponse(502, { error: 'No se pudo interpretar la respuesta. Intenta de nuevo o usa el asistente de preguntas.' });
  }

  return jsonResponse(200, { diseno: parsed.diseno, motivo: parsed.motivo || '' });
}
