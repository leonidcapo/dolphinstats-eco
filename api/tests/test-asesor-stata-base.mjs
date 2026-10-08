// Pruebas de api/asesor-stata-base.js con fetch global mockeado -- sin
// ASESOR_STATA_GITHUB_TOKEN real.
// Correr con: node api/tests/test-asesor-stata-base.mjs
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HANDLER_URL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'asesor-stata-base.js');

function req(query, method) {
  const qs = query ? '?' + new URLSearchParams(query).toString() : '';
  return new Request('http://localhost/api/asesor-stata-base' + qs, { method: method || 'GET' });
}

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

const INDEX_EJEMPLO = '# Índice — Asesor Stata\n\n' +
  '## survival-analysis\n' +
  '- [xtdhazard y cfbinout](knowledge/survival-analysis/xtdhazard-cfbinout.md) — IV por own-differences. · 2026-09-28\n\n' +
  '## panel-data\n' +
  '_(sin notas aún)_\n';

async function main() {
  process.env.ASESOR_STATA_GITHUB_TOKEN = ''; // vacío a propósito para el primer test
  const { default: handler, parseIndex } = await import('file://' + HANDLER_URL.replace(/\\/g, '/') + '?t=' + Date.now());

  await test('parseIndex: agrupa notas por tema y arma temas vacíos', () => {
    const indice = parseIndex(INDEX_EJEMPLO);
    assert.equal(indice.temas.length, 2);
    assert.equal(indice.temas[0].nombre, 'survival-analysis');
    assert.equal(indice.temas[0].notas.length, 1);
    assert.equal(indice.temas[0].notas[0].titulo, 'xtdhazard y cfbinout');
    assert.equal(indice.temas[0].notas[0].path, 'knowledge/survival-analysis/xtdhazard-cfbinout.md');
    assert.equal(indice.temas[0].notas[0].resumen, 'IV por own-differences.');
    assert.equal(indice.temas[0].notas[0].fecha, '2026-09-28');
    assert.equal(indice.temas[1].nombre, 'panel-data');
    assert.equal(indice.temas[1].notas.length, 0);
  });

  await test('parseIndex: nota sin fecha (formato viejo) deja fecha null', () => {
    const indice = parseIndex('## sampling\n- [Una nota](knowledge/sampling/n.md) — resumen sin fecha.\n');
    assert.equal(indice.temas[0].notas[0].resumen, 'resumen sin fecha.');
    assert.equal(indice.temas[0].notas[0].fecha, null);
  });

  await test('parseIndex: la marca "· auto" tras la fecha identifica una nota del monitoreo y no ensucia el resumen', () => {
    const indice = parseIndex('## sampling\n' +
      '- [Del monitoreo](knowledge/sampling/a.md) — resumen A. · 2026-09-29 · auto\n' +
      '- [Guía](knowledge/sampling/g.md) — resumen G. · 2026-09-29\n' +
      '- [Vieja](knowledge/sampling/v.md) — sin fecha ni marca.\n');
    const [a, g, v] = indice.temas[0].notas;
    assert.equal(a.auto, true);
    assert.equal(a.resumen, 'resumen A.');
    assert.equal(a.fecha, '2026-09-29');
    assert.equal(g.auto, false);
    assert.equal(g.fecha, '2026-09-29');
    assert.equal(v.auto, false);
    assert.equal(v.fecha, null);
  });

  await test('sin token -> 503, no llama a fetch', async () => {
    const restore = mockFetchOnce(() => { throw new Error('no debería llamarse'); });
    const res = await handler(req());
    restore();
    assert.equal(res.status, 503);
  });

  process.env.ASESOR_STATA_GITHUB_TOKEN = 'fake-token';

  await test('método POST -> 405', async () => {
    const res = await handler(req(undefined, 'POST'));
    assert.equal(res.status, 405);
  });

  await test('sin ?nota -> 200 con el índice parseado', async () => {
    const restore = mockFetchOnce(async () => new Response(INDEX_EJEMPLO, { status: 200 }));
    const res = await handler(req());
    restore();
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.temas.length, 2);
  });

  await test('INDEX.md no encontrado -> 200 con índice vacío', async () => {
    const restore = mockFetchOnce(async () => new Response('no encontrado', { status: 404 }));
    const res = await handler(req());
    restore();
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data.temas, []);
  });

  await test('?nota con path inválido -> 400', async () => {
    const res = await handler(req({ nota: 'README.md' }));
    assert.equal(res.status, 400);
  });

  await test('?nota con path traversal (..) -> 400, no llama a fetch', async () => {
    const restore = mockFetchOnce(() => { throw new Error('no debería llamarse'); });
    const res = await handler(req({ nota: 'knowledge/../README.md' }));
    restore();
    assert.equal(res.status, 400);
  });

  await test('?nota existente -> 200 con el markdown', async () => {
    const restore = mockFetchOnce(async () => new Response('# Una nota', { status: 200 }));
    const res = await handler(req({ nota: 'knowledge/sampling/nota.md' }));
    restore();
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.markdown, '# Una nota');
    assert.equal(data.path, 'knowledge/sampling/nota.md');
  });

  await test('?nota inexistente -> 404', async () => {
    const restore = mockFetchOnce(async () => new Response('no encontrado', { status: 404 }));
    const res = await handler(req({ nota: 'knowledge/sampling/no-existe.md' }));
    restore();
    assert.equal(res.status, 404);
  });

  await test('error de GitHub -> 502', async () => {
    const restore = mockFetchOnce(async () => new Response('error', { status: 500 }));
    const res = await handler(req());
    restore();
    assert.equal(res.status, 502);
  });

  console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
  process.exit(fallidos > 0 ? 1 : 0);
}

main();
