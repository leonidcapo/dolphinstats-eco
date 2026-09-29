// Pruebas de las funciones puras de asesor-stata.js (parsearFrontmatter,
// cuerpoMarkdownAHtml) -- sin DOM, corridas con Node.
// Correr con: node tests/test-asesor-stata-markdown.mjs
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const MODULO_URL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'asesor-stata.js');

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
  const mod = await import('file://' + MODULO_URL.replace(/\\/g, '/') + '?t=' + Date.now());
  const { parsearFrontmatter, cuerpoMarkdownAHtml } = mod.default || mod;

  await test('parsearFrontmatter: separa meta y cuerpo', () => {
    const md = '---\ntitle: Una nota\ntags: [a, b, c]\n---\n\n## Resumen\nTexto.';
    const { meta, cuerpo } = parsearFrontmatter(md);
    assert.equal(meta.title, 'Una nota');
    assert.deepEqual(meta.tags, ['a', 'b', 'c']);
    assert.equal(cuerpo, '## Resumen\nTexto.');
  });

  await test('parsearFrontmatter: sin frontmatter devuelve meta vacía y el markdown completo', () => {
    const md = '## Resumen\nTexto.';
    const { meta, cuerpo } = parsearFrontmatter(md);
    assert.deepEqual(meta, {});
    assert.equal(cuerpo, md);
  });

  await test('cuerpoMarkdownAHtml: convierte encabezados, párrafos y negritas', () => {
    const html = cuerpoMarkdownAHtml('## Resumen\nEsto es **importante** de leer.');
    assert.equal(html, '<h2>Resumen</h2>\n<p>Esto es <strong>importante</strong> de leer.</p>');
  });

  await test('cuerpoMarkdownAHtml: convierte listas', () => {
    const html = cuerpoMarkdownAHtml('## Puntos\n- primero\n- segundo');
    assert.equal(html, '<h2>Puntos</h2>\n<ul><li>primero</li><li>segundo</li></ul>');
  });

  await test('cuerpoMarkdownAHtml: escapa HTML en el texto', () => {
    const html = cuerpoMarkdownAHtml('Comparar A < B.');
    assert.equal(html, '<p>Comparar A &lt; B.</p>');
  });

  console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
  process.exit(fallidos > 0 ? 1 : 0);
}

main();
