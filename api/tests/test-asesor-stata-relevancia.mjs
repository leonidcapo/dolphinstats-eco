// Pruebas de api/_lib/asesor-stata-relevancia.js -- fetch global mockeado,
// sin credenciales reales.
// Correr con: node api/tests/test-asesor-stata-relevancia.mjs
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const MODULO_URL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '_lib', 'asesor-stata-relevancia.js');

function mockFetch(routerFn) {
  const original = globalThis.fetch;
  globalThis.fetch = async function (url, opts) { return routerFn(String(url), opts); };
  return function restore() { globalThis.fetch = original; };
}

function deepseekOkResponse(contentObj) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(contentObj) } }] }), { status: 200 });
}

const INDEX_EJEMPLO = '# Índice\n\n' +
  '## sampling\n' +
  '- [Nota A](knowledge/sampling/nota-a.md) — sobre calculadora de muestra. · 2026-09-29\n' +
  '- [Nota B](knowledge/sampling/nota-b.md) — sobre otra cosa de muestreo. · 2026-09-29\n\n' +
  '## regression\n' +
  '- [Nota C](knowledge/regression/nota-c.md) — sobre regresión logística. · 2026-09-29\n';

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
  const { elegirNotasRelevantes } = await import('file://' + MODULO_URL.replace(/\\/g, '/') + '?t=' + Date.now());

  await test('elige un subconjunto válido de paths', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('contents/INDEX.md') !== -1) return new Response(INDEX_EJEMPLO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) {
        return deepseekOkResponse({ paths: ['knowledge/sampling/nota-a.md'] });
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const paths = await elegirNotasRelevantes('fake-token', 'fake-key', '¿cómo calculo el tamaño de muestra?', 8);
    restore();
    assert.deepEqual(paths, ['knowledge/sampling/nota-a.md']);
  });

  await test('el router devuelve vacío -> array vacío', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('contents/INDEX.md') !== -1) return new Response(INDEX_EJEMPLO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) return deepseekOkResponse({ paths: [] });
      throw new Error('URL no mockeada: ' + url);
    });
    const paths = await elegirNotasRelevantes('fake-token', 'fake-key', 'algo sin relación', 8);
    restore();
    assert.deepEqual(paths, []);
  });

  await test('path alucinado (no está en el índice) se descarta', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('contents/INDEX.md') !== -1) return new Response(INDEX_EJEMPLO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) {
        return deepseekOkResponse({ paths: ['knowledge/sampling/nota-a.md', 'knowledge/inventado.md'] });
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const paths = await elegirNotasRelevantes('fake-token', 'fake-key', 'consulta', 8);
    restore();
    assert.deepEqual(paths, ['knowledge/sampling/nota-a.md']);
  });

  await test('respeta el límite pasado', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('contents/INDEX.md') !== -1) return new Response(INDEX_EJEMPLO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) {
        return deepseekOkResponse({ paths: ['knowledge/sampling/nota-a.md', 'knowledge/sampling/nota-b.md', 'knowledge/regression/nota-c.md'] });
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const paths = await elegirNotasRelevantes('fake-token', 'fake-key', 'consulta', 2);
    restore();
    assert.equal(paths.length, 2);
  });

  await test('fallo al traer INDEX.md -> array vacío, no lanza', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('contents/INDEX.md') !== -1) return new Response('error', { status: 500 });
      throw new Error('no debería llamar a ' + url);
    });
    const paths = await elegirNotasRelevantes('fake-token', 'fake-key', 'consulta', 8);
    restore();
    assert.deepEqual(paths, []);
  });

  await test('fallo del router en DeepSeek -> array vacío, no lanza', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('contents/INDEX.md') !== -1) return new Response(INDEX_EJEMPLO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) return new Response('error simulado', { status: 500 });
      throw new Error('URL no mockeada: ' + url);
    });
    const paths = await elegirNotasRelevantes('fake-token', 'fake-key', 'consulta', 8);
    restore();
    assert.deepEqual(paths, []);
  });

  await test('JSON malformado del router -> array vacío, no lanza', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('contents/INDEX.md') !== -1) return new Response(INDEX_EJEMPLO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) {
        return new Response(JSON.stringify({ choices: [{ message: { content: 'esto no es JSON' } }] }), { status: 200 });
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const paths = await elegirNotasRelevantes('fake-token', 'fake-key', 'consulta', 8);
    restore();
    assert.deepEqual(paths, []);
  });

  await test('índice sin notas -> array vacío, no llama a DeepSeek', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('contents/INDEX.md') !== -1) return new Response('# Índice\n\n## sampling\n_(sin notas aún)_\n', { status: 200 });
      throw new Error('no debería llamar a ' + url);
    });
    const paths = await elegirNotasRelevantes('fake-token', 'fake-key', 'consulta', 8);
    restore();
    assert.deepEqual(paths, []);
  });

  console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
  process.exit(fallidos > 0 ? 1 : 0);
}

main();
