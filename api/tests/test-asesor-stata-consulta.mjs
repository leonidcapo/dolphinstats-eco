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
  globalThis.fetch = async function (url) { return routerFn(String(url)); };
  return function restore() { globalThis.fetch = original; };
}

function deepseekOkResponse(contentObj) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(contentObj) } }] }), { status: 200 });
}

const TREE_UNA_NOTA = { tree: [{ type: 'blob', path: 'knowledge/sampling/nota.md' }] };
const NOTA_CONTENIDO = '---\ntitle: Una nota de prueba\n---\n\n## Resumen\nContenido de prueba.';

function routerConNota(url) {
  if (url.indexOf('git/trees/master') !== -1) {
    return new Response(JSON.stringify(TREE_UNA_NOTA), { status: 200 });
  }
  if (url.indexOf('contents/knowledge/sampling/nota.md') !== -1) {
    return new Response(NOTA_CONTENIDO, { status: 200 });
  }
  if (url.indexOf('api.deepseek.com') !== -1) {
    return deepseekOkResponse({
      respuesta: 'Resumen basado en la nota.',
      notas_citadas: [{ titulo: 'Una nota de prueba', path: 'knowledge/sampling/nota.md' }],
    });
  }
  throw new Error('URL no mockeada: ' + url);
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
    const restore = mockFetch(routerConNota);
    const res = await handler(req({ pregunta: '¿qué sabemos de xtdhazard?' }));
    restore();
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.respuesta, 'Resumen basado en la nota.');
    assert.equal(data.notas_citadas.length, 1);
    assert.equal(data.notas_citadas[0].path, 'knowledge/sampling/nota.md');
  });

  await test('base sin notas -> 200 sin llamar a DeepSeek', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('git/trees/master') !== -1) {
        return new Response(JSON.stringify({ tree: [] }), { status: 200 });
      }
      throw new Error('no debería llamar a ' + url);
    });
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    restore();
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data.notas_citadas, []);
    assert.match(data.respuesta, /todavía no tiene notas/);
  });

  await test('error de GitHub al traer el árbol -> 502', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('git/trees/master') !== -1) {
        return new Response('error', { status: 500 });
      }
      throw new Error('no debería llamar a ' + url);
    });
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    restore();
    assert.equal(res.status, 502);
  });

  await test('error HTTP de DeepSeek -> 502', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('git/trees/master') !== -1) return new Response(JSON.stringify(TREE_UNA_NOTA), { status: 200 });
      if (url.indexOf('contents/knowledge/sampling/nota.md') !== -1) return new Response(NOTA_CONTENIDO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) return new Response('error simulado', { status: 500 });
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    restore();
    assert.equal(res.status, 502);
  });

  await test('JSON malformado en el content de DeepSeek -> 502', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('git/trees/master') !== -1) return new Response(JSON.stringify(TREE_UNA_NOTA), { status: 200 });
      if (url.indexOf('contents/knowledge/sampling/nota.md') !== -1) return new Response(NOTA_CONTENIDO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) {
        return new Response(JSON.stringify({ choices: [{ message: { content: 'esto no es JSON' } }] }), { status: 200 });
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    restore();
    assert.equal(res.status, 502);
  });

  await test('respuesta de DeepSeek sin notas_citadas -> 502', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('git/trees/master') !== -1) return new Response(JSON.stringify(TREE_UNA_NOTA), { status: 200 });
      if (url.indexOf('contents/knowledge/sampling/nota.md') !== -1) return new Response(NOTA_CONTENIDO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) return deepseekOkResponse({ respuesta: 'sin citas' });
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    restore();
    assert.equal(res.status, 502);
  });

  await test('notas_citadas con item malformado -> se filtra, queda solo el válido', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('git/trees/master') !== -1) return new Response(JSON.stringify(TREE_UNA_NOTA), { status: 200 });
      if (url.indexOf('contents/knowledge/sampling/nota.md') !== -1) return new Response(NOTA_CONTENIDO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) {
        return deepseekOkResponse({
          respuesta: 'Resumen basado en la nota.',
          notas_citadas: [
            { titulo: 'Una nota de prueba', path: 'knowledge/sampling/nota.md' },
            { titulo: 123, path: 'knowledge/x.md' },
          ],
        });
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ pregunta: '¿qué sabemos de xtdhazard?' }));
    restore();
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.notas_citadas.length, 1);
    assert.equal(data.notas_citadas[0].path, 'knowledge/sampling/nota.md');
  });

  console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
  process.exit(fallidos > 0 ? 1 : 0);
}

main();
