// Pruebas de api/asesor-stata-consulta.js con fetch global mockeado -- sin
// ASESOR_STATA_GITHUB_TOKEN ni DEEPSEEK_API_KEY reales.
// Correr con: node api/tests/test-asesor-stata-consulta.mjs
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HANDLER_URL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'asesor-stata-consulta.js');

function req(bodyObj, method) {
  return new Request('http://localhost/api/asesor-stata-consulta', {
    method: method || 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: bodyObj === undefined ? undefined : JSON.stringify(bodyObj),
  });
}

function mockFetch(routerFn) {
  const original = globalThis.fetch;
  globalThis.fetch = async function (url, opts) { return routerFn(String(url), opts); };
  return function restore() { globalThis.fetch = original; };
}

function deepseekOkResponse(contentObj) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(contentObj) } }] }), { status: 200 });
}

// La respuesta final llega en streaming SSE (el router de relevancia sigue
// siendo una llamada normal con deepseekOkResponse).
function deepseekStreamTexto(texto, finishReason) {
  const mitad = Math.floor(texto.length / 2);
  const eventos = [
    { choices: [{ delta: { reasoning_content: 'pensando...' }, finish_reason: null }] },
    { choices: [{ delta: { content: texto.slice(0, mitad) }, finish_reason: null }] },
    { choices: [{ delta: { content: texto.slice(mitad) }, finish_reason: finishReason || 'stop' }] },
  ];
  const sse = eventos.map(function (e) { return 'data: ' + JSON.stringify(e) + '\n\n'; }).join('') + 'data: [DONE]\n\n';
  return new Response(sse, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function deepseekStream(contentObj) {
  return deepseekStreamTexto(JSON.stringify(contentObj));
}

const INDEX_EJEMPLO = '# Índice\n\n## sampling\n' +
  '- [Una nota de prueba](knowledge/sampling/nota.md) — resumen. · 2026-09-29\n';
const NOTA_CONTENIDO = '---\ntitle: Una nota de prueba\n---\n\n## Resumen\nContenido de prueba.';

// Alterna entre respuesta de router y respuesta final según cuántas veces se llamó a DeepSeek.
function armarRouterSecuencial(respuestaFinal) {
  let llamadas = 0;
  return function (url, opts) {
    if (url.indexOf('contents/INDEX.md') !== -1) return new Response(INDEX_EJEMPLO, { status: 200 });
    if (url.indexOf('contents/knowledge/sampling/nota.md') !== -1) return new Response(NOTA_CONTENIDO, { status: 200 });
    if (url.indexOf('api.deepseek.com') !== -1) {
      llamadas++;
      if (llamadas === 1) return deepseekOkResponse({ paths: ['knowledge/sampling/nota.md'] });
      return deepseekStream(respuestaFinal);
    }
    throw new Error('URL no mockeada: ' + url);
  };
}

let pasados = 0, fallidos = 0;
async function test(nombre, fn) {
  try {
    await fn();
    pasados++;
    console.log('OK   ' + nombre);
  } catch (e) {
    fallidos++;
    console.log('FALLO ' + nombre + ' -- ' + e.message);
  }
}

async function main() {
  process.env.ASESOR_STATA_GITHUB_TOKEN = '';
  process.env.DEEPSEEK_API_KEY = '';
  const { default: handler } = await import('file://' + HANDLER_URL.replace(/\\/g, '/') + '?t=' + Date.now());

  await test('sin ASESOR_STATA_GITHUB_TOKEN -> 503, no llama a fetch', async () => {
    const restore = mockFetch(() => { throw new Error('no debería llamarse'); });
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    restore();
    assert.equal(res.status, 503);
  });

  process.env.ASESOR_STATA_GITHUB_TOKEN = 'fake-token';

  await test('sin DEEPSEEK_API_KEY -> 503, no llama a fetch', async () => {
    const restore = mockFetch(() => { throw new Error('no debería llamarse'); });
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    restore();
    assert.equal(res.status, 503);
  });

  process.env.DEEPSEEK_API_KEY = 'fake-key';

  await test('método GET -> 405', async () => {
    const res = await handler(req(undefined, 'GET'));
    assert.equal(res.status, 405);
  });

  await test('pregunta vacía -> 400', async () => {
    const res = await handler(req({ pregunta: '   ' }));
    assert.equal(res.status, 400);
  });

  await test('pregunta con nota relevante -> 200 con respuesta y notas_citadas', async () => {
    const restore = mockFetch(armarRouterSecuencial({
      respuesta: 'Resumen basado en la nota.',
      notas_citadas: [{ titulo: 'Una nota de prueba', path: 'knowledge/sampling/nota.md' }],
    }));
    const res = await handler(req({ pregunta: '¿qué sabemos de xtdhazard?' }));
    const data = await res.json();
    restore();
    assert.equal(res.status, 200);
    assert.equal(data.respuesta, 'Resumen basado en la nota.');
    assert.equal(data.notas_citadas.length, 1);
    assert.equal(data.notas_citadas[0].path, 'knowledge/sampling/nota.md');
  });

  await test('router no elige ninguna nota -> 200 sin llamar dos veces a DeepSeek', async () => {
    let llamadasDeepseek = 0;
    const restore = mockFetch((url) => {
      if (url.indexOf('contents/INDEX.md') !== -1) return new Response(INDEX_EJEMPLO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) {
        llamadasDeepseek++;
        return deepseekOkResponse({ paths: [] });
      }
      throw new Error('no debería llamar a ' + url);
    });
    const res = await handler(req({ pregunta: 'algo sin relación con la base' }));
    const data = await res.json();
    restore();
    assert.equal(res.status, 200);
    assert.deepEqual(data.notas_citadas, []);
    // Mensaje honesto: no dice que la base está vacía (tiene notas, ninguna relevante).
    assert.match(data.respuesta, /No encontré notas relacionadas/);
    assert.ok(!/todavía no tiene notas/.test(data.respuesta));
    assert.equal(llamadasDeepseek, 1); // solo el router, nunca la llamada de respuesta
  });

  await test('base sin notas en absoluto -> 200 sin llamar a DeepSeek', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('contents/INDEX.md') !== -1) return new Response('# Índice\n\n## sampling\n_(sin notas aún)_\n', { status: 200 });
      throw new Error('no debería llamar a ' + url);
    });
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    const data = await res.json();
    restore();
    assert.equal(res.status, 200);
    assert.deepEqual(data.notas_citadas, []);
    assert.match(data.respuesta, /No encontré notas relacionadas/);
  });

  await test('error de GitHub al traer INDEX.md -> el router cae a vacío, 200 sin notas', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('contents/INDEX.md') !== -1) return new Response('error', { status: 500 });
      throw new Error('no debería llamar a ' + url);
    });
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    const data = await res.json();
    restore();
    assert.equal(res.status, 200);
    assert.deepEqual(data.notas_citadas, []);
  });

  // Con streaming la respuesta ya salió con 200 cuando falla algo: el error
  // viaja como {error} dentro del cuerpo.
  await test('error HTTP de DeepSeek en la respuesta final -> {error} en el cuerpo', async () => {
    let llamadasDeepseek = 0;
    const restore = mockFetch((url) => {
      if (url.indexOf('contents/INDEX.md') !== -1) return new Response(INDEX_EJEMPLO, { status: 200 });
      if (url.indexOf('contents/knowledge/sampling/nota.md') !== -1) return new Response(NOTA_CONTENIDO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) {
        llamadasDeepseek++;
        if (llamadasDeepseek === 1) return deepseekOkResponse({ paths: ['knowledge/sampling/nota.md'] });
        return new Response('error simulado', { status: 500 });
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    const data = await res.json();
    restore();
    assert.match(data.error, /No se pudo completar la consulta/);
    assert.equal(data.respuesta, undefined);
  });

  await test('JSON malformado en el content de DeepSeek -> {error}', async () => {
    let llamadasDeepseek = 0;
    const restore = mockFetch((url) => {
      if (url.indexOf('contents/INDEX.md') !== -1) return new Response(INDEX_EJEMPLO, { status: 200 });
      if (url.indexOf('contents/knowledge/sampling/nota.md') !== -1) return new Response(NOTA_CONTENIDO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) {
        llamadasDeepseek++;
        if (llamadasDeepseek === 1) return deepseekOkResponse({ paths: ['knowledge/sampling/nota.md'] });
        return deepseekStreamTexto('esto no es JSON');
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    const data = await res.json();
    restore();
    assert.ok(data.error);
    assert.equal(data.respuesta, undefined);
  });

  await test('respuesta cortada por max_tokens -> mensaje específico de truncado', async () => {
    let llamadasDeepseek = 0;
    const restore = mockFetch((url) => {
      if (url.indexOf('contents/INDEX.md') !== -1) return new Response(INDEX_EJEMPLO, { status: 200 });
      if (url.indexOf('contents/knowledge/sampling/nota.md') !== -1) return new Response(NOTA_CONTENIDO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) {
        llamadasDeepseek++;
        if (llamadasDeepseek === 1) return deepseekOkResponse({ paths: ['knowledge/sampling/nota.md'] });
        return deepseekStreamTexto('{"respuesta": "se corta aq', 'length');
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    const data = await res.json();
    restore();
    assert.match(data.error, /demasiado larga/);
  });

  await test('respuesta de DeepSeek sin notas_citadas -> {error}', async () => {
    const restore = mockFetch(armarRouterSecuencial({ respuesta: 'sin citas' }));
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    const data = await res.json();
    restore();
    assert.ok(data.error);
  });

  await test('pide stream:true a DeepSeek en la respuesta final', async () => {
    let cuerpoFinal = null;
    let llamadasDeepseek = 0;
    const restore = mockFetch((url, opts) => {
      if (url.indexOf('contents/INDEX.md') !== -1) return new Response(INDEX_EJEMPLO, { status: 200 });
      if (url.indexOf('contents/knowledge/sampling/nota.md') !== -1) return new Response(NOTA_CONTENIDO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) {
        llamadasDeepseek++;
        if (llamadasDeepseek === 1) return deepseekOkResponse({ paths: ['knowledge/sampling/nota.md'] });
        cuerpoFinal = JSON.parse(opts.body);
        return deepseekStream({ respuesta: 'ok', notas_citadas: [] });
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    await res.json();
    restore();
    assert.equal(cuerpoFinal.stream, true);
  });

  await test('notas_citadas con item malformado -> se filtra, queda solo el válido', async () => {
    const restore = mockFetch(armarRouterSecuencial({
      respuesta: 'Resumen basado en la nota.',
      notas_citadas: [
        { titulo: 'Una nota de prueba', path: 'knowledge/sampling/nota.md' },
        { titulo: 123, path: 'knowledge/x.md' },
      ],
    }));
    const res = await handler(req({ pregunta: '¿qué sabemos de xtdhazard?' }));
    const data = await res.json();
    restore();
    assert.equal(res.status, 200);
    assert.equal(data.notas_citadas.length, 1);
    assert.equal(data.notas_citadas[0].path, 'knowledge/sampling/nota.md');
  });

  await test('nivel "basico" se pasa al prompt del sistema', async () => {
    let promptEnviado = '';
    let llamadasDeepseek = 0;
    const restore = mockFetch((url, opts) => {
      if (url.indexOf('contents/INDEX.md') !== -1) return new Response(INDEX_EJEMPLO, { status: 200 });
      if (url.indexOf('contents/knowledge/sampling/nota.md') !== -1) return new Response(NOTA_CONTENIDO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) {
        llamadasDeepseek++;
        if (llamadasDeepseek === 1) return deepseekOkResponse({ paths: ['knowledge/sampling/nota.md'] });
        promptEnviado = JSON.parse(opts.body).messages[0].content;
        return deepseekStream({ respuesta: 'ok', notas_citadas: [] });
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ pregunta: 'una pregunta', nivel: 'basico' }));
    await res.json();
    restore();
    assert.equal(res.status, 200);
    assert.match(promptEnviado, /Nivel de la respuesta: BÁSICO/);
  });

  await test('nivel inválido u omitido -> cae a intermedio', async () => {
    let promptEnviado = '';
    let llamadasDeepseek = 0;
    const restore = mockFetch((url, opts) => {
      if (url.indexOf('contents/INDEX.md') !== -1) return new Response(INDEX_EJEMPLO, { status: 200 });
      if (url.indexOf('contents/knowledge/sampling/nota.md') !== -1) return new Response(NOTA_CONTENIDO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) {
        llamadasDeepseek++;
        if (llamadasDeepseek === 1) return deepseekOkResponse({ paths: ['knowledge/sampling/nota.md'] });
        promptEnviado = JSON.parse(opts.body).messages[0].content;
        return deepseekStream({ respuesta: 'ok', notas_citadas: [] });
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ pregunta: 'una pregunta', nivel: 'experto-supremo' }));
    await res.json();
    restore();
    assert.equal(res.status, 200);
    assert.match(promptEnviado, /Nivel de la respuesta: INTERMEDIO/);
  });

  console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
  process.exit(fallidos > 0 ? 1 : 0);
}

main();
