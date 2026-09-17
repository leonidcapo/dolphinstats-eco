// Pruebas de api/clasificar-diseno.js con fetch global mockeado -- sin
// DEEPSEEK_API_KEY real. Espejo de tests/test_chatbot_clasificador.py en
// DolphinStatsBot (mismos 8 casos), para verificar la función serverless
// antes de subirla a Vercel.
//
// Correr con: node api/tests/test-clasificar-diseno.mjs
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HANDLER_URL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'clasificar-diseno.js');

function req(bodyObj, method) {
  return new Request('http://localhost/api/clasificar-diseno', {
    method: method || 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: bodyObj === undefined ? undefined : JSON.stringify(bodyObj),
  });
}

function mockFetchOnce(impl) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return function restore() { globalThis.fetch = original; };
}

function deepseekOkResponse(contentObj) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(contentObj) } }] }), { status: 200 });
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
  process.env.DEEPSEEK_API_KEY = ''; // vacío a propósito para el primer test
  const { default: handler } = await import('file://' + HANDLER_URL.replace(/\\/g, '/') + '?t=' + Date.now());

  await test('sin API key -> 503, no llama a fetch', async () => {
    const restore = mockFetchOnce(() => { throw new Error('no debería llamarse'); });
    const res = await handler(req({ titulo: 'cualquier título' }));
    restore();
    assert.equal(res.status, 503);
    const data = await res.json();
    assert.ok(data.error);
  });

  process.env.DEEPSEEK_API_KEY = 'fake-key';

  await test('método GET -> 405', async () => {
    const res = await handler(req(undefined, 'GET'));
    assert.equal(res.status, 405);
  });

  await test('título vacío -> 400', async () => {
    const res = await handler(req({ titulo: '   ' }));
    assert.equal(res.status, 400);
  });

  await test('respuesta válida -> 200 con diseno y motivo', async () => {
    const restore = mockFetchOnce(async () => deepseekOkResponse({
      diseno: 'casos_controles',
      motivo: 'Partiste de la enfermedad y miras hacia atrás la exposición.',
    }));
    const res = await handler(req({ titulo: 'Factores asociados a anemia en niños menores de 5 años, Puno 2025' }));
    restore();
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.diseno, 'casos_controles');
    assert.match(data.motivo, /enfermedad/);
  });

  await test('diseno "no_disponible" es válido', async () => {
    const restore = mockFetchOnce(async () => deepseekOkResponse({
      diseno: 'no_disponible',
      motivo: 'Esto es estimar una media única.',
    }));
    const res = await handler(req({ titulo: 'Promedio de hemoglobina en gestantes' }));
    restore();
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.diseno, 'no_disponible');
  });

  await test('diseno inventado por el modelo -> 502, no se acepta', async () => {
    const restore = mockFetchOnce(async () => deepseekOkResponse({ diseno: 'diseno_que_no_existe', motivo: '...' }));
    const res = await handler(req({ titulo: 'un título cualquiera' }));
    restore();
    assert.equal(res.status, 502);
  });

  await test('JSON malformado en el content -> 502, no rompe', async () => {
    const restore = mockFetchOnce(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'esto no es JSON' } }] }), { status: 200 }));
    const res = await handler(req({ titulo: 'un título cualquiera' }));
    restore();
    assert.equal(res.status, 502);
  });

  await test('error HTTP de DeepSeek -> 502, no rompe', async () => {
    const restore = mockFetchOnce(async () => new Response('error simulado', { status: 500 }));
    const res = await handler(req({ titulo: 'un título cualquiera' }));
    restore();
    assert.equal(res.status, 502);
  });

  await test('excepción de red -> 502, no rompe', async () => {
    const restore = mockFetchOnce(async () => { throw new Error('timeout simulado'); });
    const res = await handler(req({ titulo: 'un título cualquiera' }));
    restore();
    assert.equal(res.status, 502);
  });

  await test('los 6 diseños válidos + no_disponible son aceptados', async () => {
    const validos = ['proporcion_unica', 'dos_proporciones', 'dos_medias', 'casos_controles', 'cohorte', 'correlacion', 'no_disponible'];
    for (const d of validos) {
      const restore = mockFetchOnce(async () => deepseekOkResponse({ diseno: d, motivo: 'motivo de prueba' }));
      const res = await handler(req({ titulo: 'un título cualquiera' }));
      restore();
      assert.equal(res.status, 200, 'diseno ' + d);
      const data = await res.json();
      assert.equal(data.diseno, d);
    }
  });

  console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
  process.exit(fallidos > 0 ? 1 : 0);
}

main();
