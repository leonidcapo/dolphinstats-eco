// Pruebas de api/asesor-stata-codigo.js con fetch global mockeado -- sin
// ASESOR_STATA_GITHUB_TOKEN ni DEEPSEEK_API_KEY reales.
// Correr con: node api/tests/test-asesor-stata-codigo.mjs
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HANDLER_URL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'asesor-stata-codigo.js');

function req(bodyObj, method) {
  return new Request('http://localhost/api/asesor-stata-codigo', {
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

// Respuesta SSE como la de DeepSeek con stream:true: el contenido partido en
// dos deltas (más uno de razonamiento, que debe ignorarse) y un finish_reason.
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

function routerSinContexto(deepseekRespuesta) {
  return function (url) {
    if (url.indexOf('git/trees/master') !== -1) return new Response('error', { status: 500 });
    if (url.indexOf('api.deepseek.com') !== -1) return deepseekStream(deepseekRespuesta);
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
  process.env.DEEPSEEK_API_KEY = '';
  const { default: handler } = await import('file://' + HANDLER_URL.replace(/\\/g, '/') + '?t=' + Date.now());

  await test('sin DEEPSEEK_API_KEY -> 503, no llama a fetch', async () => {
    const restore = mockFetch(() => { throw new Error('no debería llamarse'); });
    const res = await handler(req({ modo: 'revisar', codigo: 'regress y x' }));
    restore();
    assert.equal(res.status, 503);
  });

  process.env.DEEPSEEK_API_KEY = 'fake-key';

  await test('método GET -> 405', async () => {
    const res = await handler(req(undefined, 'GET'));
    assert.equal(res.status, 405);
  });

  await test('modo ausente -> 400', async () => {
    const res = await handler(req({ codigo: 'regress y x' }));
    assert.equal(res.status, 400);
  });

  await test('modo inválido -> 400', async () => {
    const res = await handler(req({ modo: 'ejecutar', codigo: 'regress y x' }));
    assert.equal(res.status, 400);
  });

  await test('modo revisar sin codigo -> 400', async () => {
    const res = await handler(req({ modo: 'revisar', codigo: '   ' }));
    assert.equal(res.status, 400);
  });

  await test('modo generar sin descripcion -> 400', async () => {
    const res = await handler(req({ modo: 'generar', descripcion: '' }));
    assert.equal(res.status, 400);
  });

  await test('modo revisar feliz, sin ASESOR_STATA_GITHUB_TOKEN -> sigue sin contexto', async () => {
    const restore = mockFetch(routerSinContexto({
      hallazgos: [{
        severidad: 'importante', que: 'Falta version fija', por_que: 'Riesgo de romper en otra versión de Stata',
        como_arreglar: 'Agregar version 18 al inicio del do-file', nota_citada: null,
      }],
    }));
    const res = await handler(req({ modo: 'revisar', codigo: 'regress y x' }));
    const data = await res.json();
    restore();
    assert.equal(res.status, 200);
    assert.equal(data.hallazgos.length, 1);
    assert.equal(data.hallazgos[0].severidad, 'importante');
  });

  await test('modo revisar con nota_citada válida', async () => {
    const restore = mockFetch(routerSinContexto({
      hallazgos: [{
        severidad: 'sugerencia', que: 'Macro sin comillas', por_que: 'Puede fallar silenciosamente',
        como_arreglar: 'Revisar el nombre de la macro',
        nota_citada: { titulo: 'Macros, loops y programas propios', path: 'knowledge/programming/macros-loops-programas-propios.md' },
      }],
    }));
    const res = await handler(req({ modo: 'revisar', codigo: 'local x foo\ndisplay `y`' }));
    const data = await res.json();
    restore();
    assert.equal(res.status, 200);
    assert.equal(data.hallazgos[0].nota_citada.path, 'knowledge/programming/macros-loops-programas-propios.md');
  });

  await test('modo revisar sin hallazgos -> 200 con array vacío', async () => {
    const restore = mockFetch(routerSinContexto({ hallazgos: [] }));
    const res = await handler(req({ modo: 'revisar', codigo: 'regress y x' }));
    const data = await res.json();
    restore();
    assert.equal(res.status, 200);
    assert.deepEqual(data.hallazgos, []);
  });

  await test('modo revisar con hallazgo malformado -> se filtra', async () => {
    const restore = mockFetch(routerSinContexto({
      hallazgos: [
        { severidad: 'importante', que: 'ok', por_que: 'ok', como_arreglar: 'ok', nota_citada: null },
        { severidad: 'otra-cosa', que: 'malo' },
      ],
    }));
    const res = await handler(req({ modo: 'revisar', codigo: 'regress y x' }));
    const data = await res.json();
    restore();
    assert.equal(res.status, 200);
    assert.equal(data.hallazgos.length, 1);
  });

  await test('con ASESOR_STATA_GITHUB_TOKEN, arma contexto vía router y lo manda a la respuesta final', async () => {
    process.env.ASESOR_STATA_GITHUB_TOKEN = 'fake-token';
    const INDEX_EJEMPLO = '# Índice\n\n## programming\n' +
      '- [Macros mal escritas](knowledge/programming/macros-loops-programas-propios.md) — trampa de macros. · 2026-09-29\n';
    const NOTA_CONTENIDO = '---\ntitle: Macros mal escritas\n---\n\n## Resumen\nCuidado con las macros.';
    let promptEnviado = '';
    let llamadasDeepseek = 0;
    const restore = mockFetch((url, opts) => {
      if (url.indexOf('contents/INDEX.md') !== -1) return new Response(INDEX_EJEMPLO, { status: 200 });
      if (url.indexOf('contents/knowledge/programming/macros-loops-programas-propios.md') !== -1) return new Response(NOTA_CONTENIDO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) {
        llamadasDeepseek++;
        if (llamadasDeepseek === 1) return deepseekOkResponse({ paths: ['knowledge/programming/macros-loops-programas-propios.md'] });
        promptEnviado = JSON.parse(opts.body).messages[1].content;
        return deepseekStream({ hallazgos: [] });
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ modo: 'revisar', codigo: 'local x foo' }));
    await res.json();
    restore();
    delete process.env.ASESOR_STATA_GITHUB_TOKEN;
    assert.equal(res.status, 200);
    assert.match(promptEnviado, /Macros mal escritas/);
  });

  await test('código largo -> se salta el router (una sola llamada a DeepSeek, sin pedir INDEX.md)', async () => {
    process.env.ASESOR_STATA_GITHUB_TOKEN = 'fake-token';
    let llamadasDeepseek = 0;
    const restore = mockFetch((url) => {
      if (url.indexOf('contents/INDEX.md') !== -1) throw new Error('no debería pedir INDEX.md con código largo');
      if (url.indexOf('api.deepseek.com') !== -1) {
        llamadasDeepseek++;
        return deepseekStream({ hallazgos: [] });
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const codigoLargo = 'di "linea"\n'.repeat(400); // > MAX_CHARS_PARA_ROUTER
    const res = await handler(req({ modo: 'revisar', codigo: codigoLargo }));
    await res.json();
    restore();
    delete process.env.ASESOR_STATA_GITHUB_TOKEN;
    assert.equal(res.status, 200);
    assert.equal(llamadasDeepseek, 1);
  });

  await test('modo generar feliz', async () => {
    const restore = mockFetch(routerSinContexto({
      codigo: 'regress y x1 x2, vce(robust)',
      explicacion: 'Corre una regresión lineal con errores robustos.',
      notas_citadas: [],
    }));
    const res = await handler(req({ modo: 'generar', descripcion: 'regresión con errores robustos' }));
    const data = await res.json();
    restore();
    assert.equal(res.status, 200);
    assert.equal(data.codigo, 'regress y x1 x2, vce(robust)');
    assert.match(data.explicacion, /errores robustos/);
  });

  await test('nivel se pasa al prompt del sistema', async () => {
    let promptEnviado = '';
    const restore = mockFetch((url, opts) => {
      if (url.indexOf('git/trees/master') !== -1) return new Response('error', { status: 500 });
      if (url.indexOf('api.deepseek.com') !== -1) {
        promptEnviado = JSON.parse(opts.body).messages[0].content;
        return deepseekStream({ codigo: 'x', explicacion: 'y', notas_citadas: [] });
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ modo: 'generar', descripcion: 'algo', nivel: 'basico' }));
    await res.json();
    restore();
    assert.equal(res.status, 200);
    assert.match(promptEnviado, /Nivel de la respuesta: BÁSICO/);
  });

  // Con streaming la respuesta ya salió con 200 cuando falla DeepSeek: el
  // error viaja como {error} dentro del cuerpo.
  await test('error HTTP de DeepSeek -> {error} en el cuerpo', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('git/trees/master') !== -1) return new Response('error', { status: 500 });
      if (url.indexOf('api.deepseek.com') !== -1) return new Response('error simulado', { status: 500 });
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ modo: 'revisar', codigo: 'regress y x' }));
    const data = await res.json();
    restore();
    assert.match(data.error, /No se pudo completar la revisión/);
  });

  await test('JSON malformado de DeepSeek -> {error}', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('git/trees/master') !== -1) return new Response('error', { status: 500 });
      if (url.indexOf('api.deepseek.com') !== -1) return deepseekStreamTexto('esto no es JSON');
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ modo: 'generar', descripcion: 'algo' }));
    const data = await res.json();
    restore();
    assert.ok(data.error);
    assert.equal(data.codigo, undefined);
  });

  await test('respuesta cortada por max_tokens -> mensaje específico de truncado', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('api.deepseek.com') !== -1) return deepseekStreamTexto('{"hallazgos": [{"severidad": "impor', 'length');
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ modo: 'revisar', codigo: 'regress y x' }));
    const data = await res.json();
    restore();
    assert.match(data.error, /demasiado larga/);
  });

  await test('respuesta de DeepSeek con forma inesperada para el modo -> {error}', async () => {
    const restore = mockFetch(routerSinContexto({ respuesta: 'esto no tiene el campo codigo' }));
    const res = await handler(req({ modo: 'generar', descripcion: 'algo' }));
    const data = await res.json();
    restore();
    assert.ok(data.error);
  });

  await test('pide stream:true a DeepSeek', async () => {
    let bodyEnviado = null;
    const restore = mockFetch((url, opts) => {
      if (url.indexOf('api.deepseek.com') !== -1) {
        bodyEnviado = JSON.parse(opts.body);
        return deepseekStream({ hallazgos: [] });
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ modo: 'revisar', codigo: 'regress y x' }));
    await res.json();
    restore();
    assert.equal(bodyEnviado.stream, true);
  });

  console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
  process.exit(fallidos > 0 ? 1 : 0);
}

main();
