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

  await test('parsearFrontmatter: quita las comillas que envuelven un valor', () => {
    const { meta } = parsearFrontmatter('---\ntitle: "SPLITPOPSURV: Stata module"\nsource: SSC\n---\n\ncuerpo');
    assert.equal(meta.title, 'SPLITPOPSURV: Stata module');
    assert.equal(meta.source, 'SSC');
  });

  await test('cuerpoMarkdownAHtml: `código` en línea se muestra como <code> y escapa su contenido', () => {
    const html = cuerpoMarkdownAHtml('Usa `tabulate a<b` y luego `summarize`.');
    assert.equal(html, '<p>Usa <code>tabulate a&lt;b</code> y luego <code>summarize</code>.</p>');
  });

  await test('cuerpoMarkdownAHtml: un acento grave sin cerrar queda como texto', () => {
    assert.equal(cuerpoMarkdownAHtml('Esto `queda abierto'), '<p>Esto `queda abierto</p>');
  });

  await test('cuerpoMarkdownAHtml: *cursiva* y **negrita** conviven; los asteriscos sueltos no se tocan', () => {
    const html = cuerpoMarkdownAHtml("Capítulo 28 del *Stata 19 User's Guide* y **clave**; 5 * 3 * 2.");
    assert.equal(html, '<p>Capítulo 28 del <em>Stata 19 User&#39;s Guide</em> y <strong>clave</strong>; 5 * 3 * 2.</p>');
  });

  await test('cuerpoMarkdownAHtml: las líneas con sangría continúan el ítem de la lista', () => {
    const html = cuerpoMarkdownAHtml('- **Reporte**: `describe`, `list`,\n  `table`, `summarize`.\n- **Gráficos**: `graph`.');
    assert.equal(html, '<ul><li><strong>Reporte</strong>: <code>describe</code>, <code>list</code>, <code>table</code>, <code>summarize</code>.</li>' +
      '<li><strong>Gráficos</strong>: <code>graph</code>.</li></ul>');
  });

  await test('cuerpoMarkdownAHtml: los sub-ítems se anidan en el ítem anterior', () => {
    const html = cuerpoMarkdownAHtml('- Padre\n  - hijo uno\n  - hijo dos\n- Otro');
    assert.equal(html, '<ul><li>Padre<ul><li>hijo uno</li><li>hijo dos</li></ul></li><li>Otro</li></ul>');
  });

  await test('cuerpoMarkdownAHtml: tolera finales de línea CRLF', () => {
    assert.equal(cuerpoMarkdownAHtml('## Titulo\r\n- uno\r\n- dos\r\n'), '<h2>Titulo</h2>\n<ul><li>uno</li><li>dos</li></ul>');
  });

  const { nombreTema, normalizarTexto, filtrarIndice, etiquetaFuente } = mod.default || mod;

  await test('nombreTema: traduce los temas conocidos y arma un nombre legible para los demás', () => {
    assert.equal(nombreTema('hypothesis-testing'), 'Pruebas de hipótesis');
    assert.equal(nombreTema('tema-nuevo-raro'), 'Tema nuevo raro');
  });

  await test('normalizarTexto: ignora mayúsculas, tildes y superíndices', () => {
    assert.equal(normalizarTexto('Regresión CHI²'), 'regresion chi2');
  });

  const INDICE = { temas: [
    { nombre: 'regression', notas: [
      { titulo: 'Regresión logística', resumen: 'Odds ratios con logit', path: 'knowledge/regression/a.md', fecha: null },
      { titulo: 'Regresión lineal', resumen: 'Errores robustos', path: 'knowledge/regression/b.md', fecha: null },
    ] },
    { nombre: 'panel-data', notas: [] },
    { nombre: 'sampling', notas: [
      { titulo: 'Diseño muestral ENDES', resumen: 'svy y pesos', path: 'knowledge/sampling/c.md', fecha: null },
    ] },
  ] };

  await test('filtrarIndice: sin texto devuelve todo salvo los temas vacíos', () => {
    const r = filtrarIndice(INDICE, '');
    assert.deepEqual(r.map(t => t.slug), ['regression', 'sampling']);
    assert.equal(r[0].nombre, 'Regresión');
  });

  await test('filtrarIndice: todas las palabras deben aparecer (título, resumen o tema), sin importar tildes', () => {
    assert.equal(filtrarIndice(INDICE, 'regresion odds')[0].notas.length, 1);
    assert.equal(filtrarIndice(INDICE, 'SVY').length, 1);
    assert.deepEqual(filtrarIndice(INDICE, 'muestreo xyz'), []);
  });

  await test('filtrarIndice: «chi2» y «chi cuadrado» encuentran una nota que dice «chi-cuadrado»', () => {
    const indice = { temas: [{ nombre: 'hypothesis-testing', notas: [
      { titulo: 'Asociación entre categóricas — chi-cuadrado, odds ratio', resumen: '', path: 'knowledge/hypothesis-testing/a.md', fecha: null },
    ] }] };
    assert.equal(filtrarIndice(indice, 'chi2').length, 1);
    assert.equal(filtrarIndice(indice, 'chi cuadrado').length, 1);
    assert.equal(filtrarIndice(indice, 'chi-cuadrado odds').length, 1);
    assert.equal(filtrarIndice(indice, 'fisher').length, 0);
  });

  await test('etiquetaFuente: nombres legibles para el tipo de fuente', () => {
    assert.equal(etiquetaFuente('SSC'), 'Módulo SSC');
    assert.equal(etiquetaFuente('libro'), 'Libro');
    assert.equal(etiquetaFuente('otra'), 'otra');
  });

  console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
  process.exit(fallidos > 0 ? 1 : 0);
}

main();
