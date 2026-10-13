// Pruebas del reintento automático de llamarDeepSeek (api/_lib/asesor-stata-llm.js), con fetch
// simulado y sin esperas. Correr con: node tests/test-asesor-llm-reintento.mjs
import assert from 'node:assert/strict';
import { llamarDeepSeek, mensajeError } from '../api/_lib/asesor-stata-llm.js';

let pasados = 0, fallidos = 0;
async function test(nombre, fn) {
  try { await fn(); pasados++; console.log('OK   ' + nombre); }
  catch (e) { fallidos++; console.log('FALLO ' + nombre + ' -- ' + e.message); }
}

function flujo(contenido, finish) {
  const texto = 'data: ' + JSON.stringify({ choices: [{ delta: { content: contenido }, finish_reason: finish || 'stop' }] }) + '\n\ndata: [DONE]\n\n';
  return new Response(new TextEncoder().encode(texto), { status: 200 });
}
const OK = () => flujo(JSON.stringify({ ok: true }));
const estado = (n) => () => new Response('x', { status: n });

// Guion de respuestas: cada elemento es una función que devuelve Response (o lanza).
let guion = [];
let llamadas = 0;
globalThis.fetch = async () => {
  llamadas++;
  const paso = guion.shift();
  if (!paso) throw new Error('fetch inesperado');
  return paso();
};
async function llamar(opciones) {
  llamadas = 0;
  return llamarDeepSeek('sis', 'usr', 'clave', Object.assign({ esperaReintentoMs: 0 }, opciones));
}
async function fallaCon(opciones) {
  try { await llamar(opciones); } catch (e) { return e; }
  throw new Error('debía fallar');
}

await test('éxito a la primera: una sola llamada', async () => {
  guion = [OK];
  assert.deepEqual(await llamar(), { ok: true });
  assert.equal(llamadas, 1);
});

for (const codigo of [429, 500, 503]) {
  await test('error ' + codigo + ' y luego éxito: se reintenta una vez', async () => {
    guion = [estado(codigo), OK];
    assert.deepEqual(await llamar(), { ok: true });
    assert.equal(llamadas, 2);
  });
}

await test('JSON malformado y luego éxito: se reintenta', async () => {
  guion = [() => flujo('esto no es json'), OK];
  assert.deepEqual(await llamar(), { ok: true });
  assert.equal(llamadas, 2);
});

await test('caída de red y luego éxito: se reintenta', async () => {
  guion = [() => { throw new TypeError('fetch failed'); }, OK];
  assert.deepEqual(await llamar(), { ok: true });
  assert.equal(llamadas, 2);
});

await test('falla dos veces seguidas: lanza el último error (solo 2 llamadas)', async () => {
  guion = [estado(503), estado(503), OK];
  const e = await fallaCon();
  assert.equal(e.message, 'upstream_error');
  assert.equal(llamadas, 2);
  assert.match(mensajeError(e, 'revisión'), /No se pudo completar la revisión/);
});

await test('error 4xx (p. ej. 400 o 401): no se reintenta', async () => {
  for (const codigo of [400, 401]) {
    guion = [estado(codigo), OK];
    const e = await fallaCon();
    assert.equal(e.message, 'upstream_error');
    assert.equal(llamadas, 1);
  }
});

await test('respuesta cortada por longitud: no se reintenta', async () => {
  guion = [() => flujo('{"a": "texto largo que se cor', 'length'), OK];
  const e = await fallaCon();
  assert.equal(e.message, 'respuesta_truncada');
  assert.equal(llamadas, 1);
});

await test('timeout: no se reintenta', async () => {
  guion = [() => { const e = new Error('abortado'); e.name = 'AbortError'; throw e; }, OK];
  const e = await fallaCon();
  assert.equal(e.message, 'timeout');
  assert.equal(llamadas, 1);
});

await test('opciones.reintentos = 0 desactiva el reintento; = 2 permite dos', async () => {
  guion = [estado(503), OK];
  assert.equal((await fallaCon({ reintentos: 0 })).message, 'upstream_error');
  assert.equal(llamadas, 1);
  guion = [estado(503), estado(503), OK];
  assert.deepEqual(await llamar({ reintentos: 2 }), { ok: true });
  assert.equal(llamadas, 3);
});

console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
process.exit(fallidos > 0 ? 1 : 0);
