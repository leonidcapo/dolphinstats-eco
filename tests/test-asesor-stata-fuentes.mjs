// Comprueba que las fuentes de marca están en el repositorio y son woff2 válidas.
// Correr con: node tests/test-asesor-stata-fuentes.mjs
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FUENTES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fonts');

let pasados = 0, fallidos = 0;
function test(nombre, fn) {
  try { fn(); pasados++; console.log('OK   ' + nombre); }
  catch (e) { fallidos++; console.log('FALLO ' + nombre + ' -- ' + e.message); }
}

function caras() {
  const css = readFileSync(path.join(FUENTES, 'fonts.css'), 'utf8');
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(m => {
    const c = m[1];
    return {
      familia: (/font-family:\s*'([^']+)'/.exec(c) || [])[1],
      peso: (/font-weight:\s*(\d+)/.exec(c) || [])[1],
      swap: /font-display:\s*swap/.test(c),
      rango: /unicode-range:\s*U\+0000-00FF/.test(c),
      url: (/url\('?([^')]+)'?\)\s*format\('woff2'\)/.exec(c) || [])[1],
    };
  });
}

test('fonts.css declara exactamente las cinco caras de la marca', () => {
  assert.deepEqual(caras().map(c => c.familia + ' ' + c.peso).sort(),
    ['DM Sans 400', 'DM Sans 500', 'DM Sans 700', 'Syne 700', 'Syne 800']);
});

test('cada cara usa font-display: swap y el subconjunto latino', () => {
  for (const c of caras()) {
    assert.ok(c.swap, c.familia + ' ' + c.peso + ' sin font-display: swap');
    assert.ok(c.rango, c.familia + ' ' + c.peso + ' sin unicode-range latino');
  }
});

test('cada archivo woff2 existe, empieza con la firma wOF2 y pesa entre 4 KB y 120 KB', () => {
  for (const c of caras()) {
    const ruta = path.join(FUENTES, c.url);
    assert.ok(existsSync(ruta), 'falta ' + c.url);
    assert.equal(readFileSync(ruta).subarray(0, 4).toString('latin1'), 'wOF2', c.url + ' no es woff2');
    const kb = statSync(ruta).size / 1024;
    assert.ok(kb >= 4 && kb <= 120, c.url + ' pesa ' + kb.toFixed(1) + ' KB');
  }
});

test('las licencias SIL OFL acompañan a las fuentes', () => {
  for (const f of ['LICENSE-syne.txt', 'LICENSE-dm-sans.txt']) {
    assert.ok(existsSync(path.join(FUENTES, f)), 'falta ' + f);
    assert.match(readFileSync(path.join(FUENTES, f), 'utf8'), /SIL OPEN FONT LICENSE/i);
  }
});

console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
process.exit(fallidos > 0 ? 1 : 0);
