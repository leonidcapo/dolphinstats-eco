// Lee las variables de color de asesor-stata.css y comprueba que cada pareja de
// texto y fondo que se usa cumple el contraste AA (4,5) de WCAG.
// Correr con: node tests/test-asesor-stata-contraste.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const css = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'asesor-stata.css'), 'utf8');
const bloque = /:root\s*\{([^}]*)\}/.exec(css);
const tokens = {};
if (bloque) [...bloque[1].matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)].forEach(m => { tokens[m[1]] = m[2]; });

let pasados = 0, fallidos = 0;
function test(nombre, fn) {
  try { fn(); pasados++; console.log('OK   ' + nombre); }
  catch (e) { fallidos++; console.log('FALLO ' + nombre + ' -- ' + e.message); }
}

function luminancia(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a, b) {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

const NECESARIOS = ['marino', 'muted', 'azul', 'azul-oscuro', 'cian', 'cian-claro', 'violeta', 'naranja', 'rojo', 'blanco',
  'superficie', 'tinte-azul', 'tinte-rojo', 'sobre-marino-azul', 'sobre-marino-cian', 'banda-1', 'banda-2', 'banda-3',
  'marca-linea', 'marca-numero'];

test('el CSS define todas las variables de color de diseño', () => {
  for (const n of NECESARIOS) assert.ok(tokens[n], 'falta --' + n);
});

// [color del texto, color del fondo]: todas las parejas que el diseño usa para texto.
const PARES = [
  ['marino', 'blanco'], ['marino', 'superficie'], ['marino', 'tinte-azul'], ['marino', 'marca-linea'], ['marino', 'marca-numero'],
  ['muted', 'blanco'], ['muted', 'superficie'], ['muted', 'tinte-azul'],
  ['azul', 'blanco'], ['blanco', 'azul'], ['azul-oscuro', 'blanco'], ['azul-oscuro', 'superficie'], ['azul-oscuro', 'tinte-azul'],
  ['cian', 'blanco'], ['blanco', 'cian'], ['violeta', 'blanco'], ['blanco', 'violeta'], ['naranja', 'blanco'], ['blanco', 'naranja'],
  ['rojo', 'blanco'], ['rojo', 'tinte-rojo'], ['rojo', 'superficie'],
  ['blanco', 'marino'], ['sobre-marino-azul', 'marino'], ['sobre-marino-cian', 'marino'], ['blanco', 'banda-2'], ['blanco', 'banda-3'],
];
for (const [texto, fondo] of PARES) {
  test('contraste de ' + texto + ' sobre ' + fondo + ' >= 4,5', () => {
    assert.ok(tokens[texto] && tokens[fondo], 'faltan variables');
    const r = contraste(tokens[texto], tokens[fondo]);
    assert.ok(r >= 4.5, r.toFixed(2) + ' (' + tokens[texto] + ' sobre ' + tokens[fondo] + ')');
  });
}

test('el cian claro (solo bordes y degradados) nunca se usa como color de texto', () => {
  assert.ok(!/(^|[;{\s])color\s*:\s*(var\(--cian-claro\)|#0899a8)/i.test(css));
});

test('el rojo antiguo #ff3131 (contraste 3,7) ya no aparece', () => {
  assert.ok(!/#ff3131/i.test(css));
});

console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
process.exit(fallidos > 0 ? 1 : 0);
