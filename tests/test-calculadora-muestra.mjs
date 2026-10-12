// Pruebas de calculadora-muestra.js, sin navegador (Node).
// 1) Los mismos casos que el chatbot: tests/casos-compartidos.json es una copia
//    idéntica de DolphinStatsBot/tests/casos_compartidos.json (n, desglose, avisos,
//    párrafo de Métodos completo y mensajes de error). Si una de las dos
//    implementaciones cambia sin la otra, esta prueba o la de Python falla.
//    Si el cambio es intencional: regenerar en el chatbot
//    (python tests/generar_casos_compartidos.py) y copiar el archivo aquí.
// 2) Que el HTML y el JS están enlazados: todo id que usa el JS existe en el HTML,
//    cada diseño tiene su bloque de campos y su opción en el selector.
//
// Correr con: node tests/test-calculadora-muestra.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = fs.readFileSync(path.join(RAIZ, 'calculadora-muestra.js'), 'utf8');
const HTML = fs.readFileSync(path.join(RAIZ, 'calculadora-muestra.html'), 'utf8');
const DATOS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests', 'casos-compartidos.json'), 'utf8'));

const ctx = { window: {}, document: { addEventListener() {}, getElementById() { return null; } } };
vm.createContext(ctx);
vm.runInContext(JS, ctx);
const C = ctx.window.CalculadoraMuestra;

let pasados = 0, fallidos = 0;
function test(nombre, fn) {
  try {
    fn();
    pasados++;
    console.log('OK   ' + nombre);
  } catch (e) {
    fallidos++;
    console.log('FALLO ' + nombre + ' -- ' + e.message.split('\n')[0]);
  }
}

for (const caso of DATOS.casos) {
  test('caso compartido ' + caso.id, () => {
    const nombreJs = DATOS.funciones_js[caso.funcion];
    assert.ok(C[nombreJs], 'falta window.CalculadoraMuestra.' + nombreJs);
    const esperado = caso.esperado;
    if ('error' in esperado) {
      assert.throws(() => C[nombreJs](...caso.args), (e) => e.message === esperado.error);
      return;
    }
    const r = C[nombreJs](...caso.args);
    assert.equal(r.n_total, esperado.n_total);
    assert.equal(r.n_por_grupo, esperado.n_por_grupo);
    // JSON: los arreglos creados dentro del vm tienen otro prototipo y deepEqual estricto los rechaza
    assert.equal(JSON.stringify(r.avisos || []), JSON.stringify(esperado.avisos));
    assert.equal(r.parrafo_metodos, esperado.parrafo);
  });
}

const DISENOS = Object.keys(DATOS.funciones_js);

test('el archivo compartido cubre los nueve diseños', () => {
  assert.equal(DISENOS.length, 9);
  assert.deepEqual([...new Set(DATOS.casos.map((c) => c.funcion))].sort(), [...DISENOS].sort());
});

const idsHtml = new Set([...HTML.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

test('todo id que usa el JS existe en el HTML', () => {
  const usados = new Set([...JS.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]));
  const faltan = [...usados].filter((id) => !idsHtml.has(id));
  // los bloques de campos se arman con 'cm-campos-' + diseño: se comprueban abajo
  assert.deepEqual(faltan.filter((id) => !id.startsWith('cm-campos-')), [], 'ids sin elemento en el HTML');
});

test('cada diseño tiene opción en el selector y su bloque de campos', () => {
  const opciones = new Set([...HTML.matchAll(/<option value="([^"]+)">/g)].map((m) => m[1]));
  const ordenJs = [...JS.matchAll(/var DISENOS = \[([^\]]+)\]/g)][0][1].match(/'([^']+)'/g).map((x) => x.slice(1, -1));
  assert.equal(ordenJs.length, 9);
  for (const d of ordenJs) {
    assert.ok(opciones.has(d), 'falta la opción ' + d + ' en el selector');
    assert.ok(idsHtml.has('cm-campos-' + d), 'falta el bloque cm-campos-' + d);
  }
});

test('los controles nuevos del paquete 4 están en el HTML', () => {
  for (const id of ['cm-dp-yates', 'cm-mn-prueba', 'cm-avisos', 'cm-ta-p0', 'cm-ta-rp', 'cm-ta-pe',
    'cm-ta-yates', 'cm-ta-perdidas', 'cm-ta-r2', 'cm-ta-k']) {
    assert.ok(idsHtml.has(id), 'falta #' + id);
  }
});

console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
process.exit(fallidos > 0 ? 1 : 0);
