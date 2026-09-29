// Pruebas de api/_lib/asesor-stata-github.js con fetch global mockeado.
// Correr con: node api/tests/test-asesor-stata-github.mjs
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const LIB_URL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '_lib', 'asesor-stata-github.js');

function mockFetchOnce(impl) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return function restore() { globalThis.fetch = original; };
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
  const { fetchFileRaw, fetchKnowledgeTree, GithubError } = await import('file://' + LIB_URL.replace(/\\/g, '/') + '?t=' + Date.now());

  await test('fetchFileRaw: archivo existente devuelve el texto', async () => {
    const restore = mockFetchOnce(async (url, opts) => {
      assert.equal(url, 'https://api.github.com/repos/leonidcapo/asesor-stata/contents/INDEX.md');
      assert.equal(opts.headers.Authorization, 'Bearer fake-token');
      return new Response('# Índice', { status: 200 });
    });
    const texto = await fetchFileRaw('fake-token', 'INDEX.md');
    restore();
    assert.equal(texto, '# Índice');
  });

  await test('fetchFileRaw: 404 devuelve null', async () => {
    const restore = mockFetchOnce(async () => new Response('no encontrado', { status: 404 }));
    const texto = await fetchFileRaw('fake-token', 'knowledge/no-existe.md');
    restore();
    assert.equal(texto, null);
  });

  await test('fetchFileRaw: error HTTP lanza GithubError', async () => {
    const restore = mockFetchOnce(async () => new Response('error', { status: 500 }));
    await assert.rejects(() => fetchFileRaw('fake-token', 'INDEX.md'), GithubError);
    restore();
  });

  await test('fetchKnowledgeTree: filtra solo blobs .md bajo knowledge/', async () => {
    const restore = mockFetchOnce(async () => new Response(JSON.stringify({
      tree: [
        { type: 'blob', path: 'knowledge/sampling/nota-1.md' },
        { type: 'blob', path: 'knowledge/sampling/nota-2.md' },
        { type: 'blob', path: 'README.md' },
        { type: 'tree', path: 'knowledge/sampling' },
        { type: 'blob', path: 'docs/2026-09-28-algo.md' },
      ],
    }), { status: 200 }));
    const paths = await fetchKnowledgeTree('fake-token');
    restore();
    assert.deepEqual(paths, ['knowledge/sampling/nota-1.md', 'knowledge/sampling/nota-2.md']);
  });

  await test('fetchKnowledgeTree: rama no encontrada lanza GithubError', async () => {
    const restore = mockFetchOnce(async () => new Response('no encontrado', { status: 404 }));
    await assert.rejects(() => fetchKnowledgeTree('fake-token'), GithubError);
    restore();
  });

  console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
  process.exit(fallidos > 0 ? 1 : 0);
}

main();
