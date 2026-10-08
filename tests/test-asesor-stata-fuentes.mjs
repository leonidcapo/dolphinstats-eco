// Comprueba que la tipografía es Arial del sistema, sin fuentes externas ni archivos de fuentes.
// Correr con: node tests/test-asesor-stata-fuentes.mjs
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(path.join(RAIZ, 'asesor-stata.css'), 'utf8');
const html = readFileSync(path.join(RAIZ, 'asesor-stata.html'), 'utf8');

let pasados = 0, fallidos = 0;
function test(nombre, fn) {
  try { fn(); pasados++; console.log('OK   ' + nombre); }
  catch (e) { fallidos++; console.log('FALLO ' + nombre + ' -- ' + e.message); }
}

test('los tokens de títulos y de texto usan Arial', () => {
  for (const token of ['--fuente-titulo', '--fuente-texto']) {
    const m = new RegExp(token + ':\s*([^;]+);').exec(css);
    assert.ok(m, 'falta ' + token);
    assert.match(m[1].trim(), /^Arial,/, token + ' no empieza con Arial: ' + m[1]);
  }
});

test('el CSS no declara @font-face ni nombra las fuentes anteriores', () => {
  assert.doesNotMatch(css, /@font-face/);
  assert.doesNotMatch(css, /Syne|DM Sans/);
});

test('la página no carga fuentes externas ni de la carpeta fonts/', () => {
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic|fonts\/|rel="preload"[^>]*as="font"/);
});

test('la carpeta fonts/ ya no existe', () => {
  assert.equal(existsSync(path.join(RAIZ, 'fonts')), false);
});

console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
process.exit(fallidos > 0 ? 1 : 0);
