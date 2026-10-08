// Pruebas de las funciones puras de asesor-stata.js (parsearFrontmatter,
// cuerpoMarkdownAHtml) -- sin DOM, corridas con Node.
// Correr con: node tests/test-asesor-stata-markdown.mjs
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const MODULO_URL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'asesor-stata-nucleo.js');

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

  await test('cuerpoMarkdownAHtml: un bloque ``` se muestra como <pre> con el código escapado', () => {
    const html = cuerpoMarkdownAHtml('## Ejemplo\n```stata\nsysuse auto, clear   // base\nsummarize if x < 3\n```\nTexto después.');
    assert.equal(html, '<h2>Ejemplo</h2>\n<pre class="bloque-codigo"><code>sysuse auto, clear   // base\nsummarize if x &lt; 3</code></pre>\n<p>Texto después.</p>');
  });

  await test('cuerpoMarkdownAHtml: dentro de un bloque se respetan sangría, líneas en blanco y asteriscos', () => {
    const html = cuerpoMarkdownAHtml('```\n* comentario con **asteriscos**\n\n    sangrado\n```');
    assert.equal(html, '<pre class="bloque-codigo"><code>* comentario con **asteriscos**\n\n    sangrado</code></pre>');
  });

  await test('cuerpoMarkdownAHtml: un bloque sin cerrar toma el resto del texto como código', () => {
    const html = cuerpoMarkdownAHtml('Antes.\n```stata\nlinea1\nlinea2');
    assert.equal(html, '<p>Antes.</p>\n<pre class="bloque-codigo"><code>linea1\nlinea2</code></pre>');
  });

  await test('cuerpoMarkdownAHtml: un bloque cierra la lista que lo precede', () => {
    const html = cuerpoMarkdownAHtml('- uno\n- dos\n```\ncodigo\n```');
    assert.equal(html, '<ul><li>uno</li><li>dos</li></ul>\n<pre class="bloque-codigo"><code>codigo</code></pre>');
  });

  await test('cuerpoMarkdownAHtml: los bloques toleran CRLF', () => {
    assert.equal(cuerpoMarkdownAHtml('```\r\na\r\nb\r\n```\r\n'), '<pre class="bloque-codigo"><code>a\nb</code></pre>');
  });

  const { nombreTema, normalizarTexto, filtrarIndice, etiquetaFuente, separarNotaInterna } = mod.default || mod;

  await test('separarNotaInterna: parte la nota en el encabezado «Relevancia para DolphinStats»', () => {
    const r = separarNotaInterna('## Resumen\nTexto.\n\n## Ejemplo\nAlgo.\n\n## Relevancia para DolphinStats\nImporta porque sí.\nSegunda línea.');
    assert.equal(r.principal, '## Resumen\nTexto.\n\n## Ejemplo\nAlgo.');
    assert.equal(r.interna, 'Importa porque sí.\nSegunda línea.');
  });

  await test('separarNotaInterna: sin ese encabezado devuelve todo como principal', () => {
    const r = separarNotaInterna('## Resumen\nTexto.');
    assert.equal(r.principal, '## Resumen\nTexto.');
    assert.equal(r.interna, '');
  });

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

  const { separarPorOrigen, listarRadar } = mod.default || mod;

  const INDICE_MIXTO = { temas: [
    { nombre: 'regression', notas: [
      { titulo: 'Paquete nuevo', resumen: 'logit raro', path: 'knowledge/regression/p1.md', fecha: '2026-10-06', auto: true },
      { titulo: 'Regresión lineal', resumen: 'guía', path: 'knowledge/regression/g1.md', fecha: '2026-09-29', auto: false },
    ] },
    { nombre: 'panel-data', notas: [] },
    { nombre: 'sampling', notas: [
      { titulo: 'Artículo viejo', resumen: 'muestra', path: 'knowledge/sampling/a1.md', fecha: '2026-09-29', auto: true },
      { titulo: 'Artículo reciente', resumen: 'muestra', path: 'knowledge/sampling/a2.md', fecha: '2026-10-06', auto: true },
      { titulo: 'Sin fecha', resumen: 'muestra', path: 'knowledge/sampling/a3.md', fecha: null, auto: true },
    ] },
  ] };

  await test('separarPorOrigen: guías (sin marca auto) y radar (con marca), sin temas vacíos', () => {
    const { guias, radar } = separarPorOrigen(INDICE_MIXTO);
    assert.deepEqual(guias.temas.map(t => t.nombre), ['regression']);
    assert.deepEqual(guias.temas[0].notas.map(n => n.titulo), ['Regresión lineal']);
    assert.deepEqual(radar.temas.map(t => t.nombre), ['regression', 'sampling']);
    assert.equal(radar.temas[1].notas.length, 3);
  });

  await test('separarPorOrigen: una nota sin el campo auto cuenta como guía', () => {
    const { guias, radar } = separarPorOrigen({ temas: [{ nombre: 'x', notas: [{ titulo: 'T', resumen: '', path: 'knowledge/x/t.md', fecha: null }] }] });
    assert.equal(guias.temas[0].notas.length, 1);
    assert.equal(radar.temas.length, 0);
  });

  await test('listarRadar: lista plana, la más reciente primero, sin fecha al final y con el tema en español', () => {
    const { radar } = separarPorOrigen(INDICE_MIXTO);
    const lista = listarRadar(radar, '');
    assert.deepEqual(lista.map(n => n.titulo), ['Paquete nuevo', 'Artículo reciente', 'Artículo viejo', 'Sin fecha']);
    assert.equal(lista[0].tema, 'Regresión');
    assert.equal(lista[1].tema, 'Muestreo');
  });

  await test('listarRadar: conserva la explicación simple y el filtro también busca en ella', () => {
    const radar = { temas: [{ nombre: 'sampling', notas: [
      { titulo: 'CALIBRA: Stata module', resumen: 'Calibración por Deville y Särndal.', simple: 'Ajusta los pesos de una encuesta.', path: 'knowledge/sampling/c.md', fecha: '2026-09-29', auto: true },
      { titulo: 'OTRO: Stata module', resumen: 'Algo técnico.', path: 'knowledge/sampling/o.md', fecha: '2026-09-29', auto: true },
    ] }] };
    const lista = listarRadar(radar, '');
    assert.equal(lista[0].simple, 'Ajusta los pesos de una encuesta.');
    assert.equal(lista[1].simple, '');
    assert.deepEqual(listarRadar(radar, 'encuesta').map(n => n.titulo), ['CALIBRA: Stata module']);
    assert.deepEqual(listarRadar(radar, 'deville').map(n => n.titulo), ['CALIBRA: Stata module']);
  });

  await test('listarRadar: respeta el filtro de palabras', () => {
    const { radar } = separarPorOrigen(INDICE_MIXTO);
    assert.deepEqual(listarRadar(radar, 'logit').map(n => n.titulo), ['Paquete nuevo']);
    assert.deepEqual(listarRadar(radar, 'zzz'), []);
  });

  const { etiquetaLineas, armarInformeRevision, armarDescripcionGuiada } = mod.default || mod;

  await test('etiquetaLineas: «Línea N», «Líneas N-M» o vacío', () => {
    assert.equal(etiquetaLineas('12'), 'Línea 12');
    assert.equal(etiquetaLineas('12-15'), 'Líneas 12-15');
    assert.equal(etiquetaLineas(null), '');
    assert.equal(etiquetaLineas(''), '');
  });

  const HALLAZGOS = [
    { severidad: 'sugerencia', lineas: null, que: 'Falta `log using`', por_que: 'Sin registro no se reproduce', como_arreglar: 'Abrir un log', codigo_corregido: null, nota_citada: null },
    { severidad: 'importante', lineas: '3-4', que: 'Los missing cuentan como mayores que 40', por_que: 'edad >= 40 incluye perdidos', como_arreglar: 'Agregar !missing(edad)',
      codigo_corregido: 'replace edad_cat = 2 if edad >= 40 & !missing(edad)', nota_citada: { titulo: 'Manejo de datos', path: 'knowledge/data-management/manejo.md' } },
  ];

  await test('armarInformeRevision: encabezado, conteo, importantes primero, líneas, código y nota', () => {
    const md = armarInformeRevision(HALLAZGOS, '2026-10-07');
    assert.match(md, /^# Informe de revisión de código — Asesor Stata\nFecha: 2026-10-07\n/);
    assert.match(md, /2 hallazgos: 1 importante, 1 sugerencia\./);
    assert.ok(md.indexOf('## 1. Importante — Los missing') !== -1);
    assert.ok(md.indexOf('## 1. Importante') < md.indexOf('## 2. Sugerencia'));
    assert.match(md, /Líneas 3-4/);
    assert.match(md, /- \*\*Por qué:\*\* edad >= 40 incluye perdidos/);
    assert.match(md, /- \*\*Cómo arreglarlo:\*\* Agregar !missing\(edad\)/);
    assert.match(md, /```stata\nreplace edad_cat = 2 if edad >= 40 & !missing\(edad\)\n```/);
    assert.match(md, /Nota relacionada: Manejo de datos \(knowledge\/data-management\/manejo\.md\)/);
    assert.match(md, /inteligencia artificial; verifica/);
  });

  await test('armarInformeRevision: el hallazgo general no lleva línea ni bloque de código; singular y vacío', () => {
    const md = armarInformeRevision([HALLAZGOS[0]], '2026-10-07');
    assert.match(md, /1 hallazgo: 0 importantes, 1 sugerencia\./);
    assert.ok(!/Líneas?\s\d/.test(md));
    assert.ok(!/```stata/.test(md));
    assert.match(armarInformeRevision([], '2026-10-07'), /Sin hallazgos/);
  });

  await test('armarDescripcionGuiada: junta solo los campos con contenido', () => {
    const d = armarDescripcionGuiada({
      estudio: 'Estudio transversal', resultado: 'presion', tipoResultado: 'numérica continua',
      explicativas: 'edad, sexo, imc', grupos: 'tratamiento', salidas: ['tabla 1 por grupo', 'modelo de regresión'],
    });
    assert.equal(d, 'Estudio transversal. Variable de resultado: presion (numérica continua). ' +
      'Variables explicativas: edad, sexo, imc. Grupos a comparar: tratamiento. Quiero: tabla 1 por grupo, modelo de regresión.');
    assert.equal(armarDescripcionGuiada({ resultado: '  enfermo  ', salidas: [] }), 'Variable de resultado: enfermo.');
    assert.equal(armarDescripcionGuiada({}), '');
  });

  await test('armarDescripcionGuiada: no pasa de 1000 caracteres', () => {
    assert.ok(armarDescripcionGuiada({ explicativas: 'x'.repeat(3000) }).length <= 1000);
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
