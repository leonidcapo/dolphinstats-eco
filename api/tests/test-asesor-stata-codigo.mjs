// Pruebas de api/asesor-stata-codigo.js con fetch global mockeado -- sin
// ASESOR_STATA_GITHUB_TOKEN ni DEEPSEEK_API_KEY reales.
// Correr con: node api/tests/test-asesor-stata-codigo.mjs
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HANDLER_URL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'asesor-stata-codigo.js');

function req(bodyObj, method) {
  return new Request('http://localhost/api/asesor-stata-codigo', {
    method: method || 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: bodyObj === undefined ? undefined : JSON.stringify(bodyObj),
  });
}

function mockFetch(routerFn) {
  const original = globalThis.fetch;
  globalThis.fetch = async function (url, opts) { return routerFn(String(url), opts); };
  return function restore() { globalThis.fetch = original; };
}

function deepseekOkResponse(contentObj) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(contentObj) } }] }), { status: 200 });
}

// Respuesta SSE como la de DeepSeek con stream:true: el contenido partido en
// dos deltas (más uno de razonamiento, que debe ignorarse) y un finish_reason.
function deepseekStreamTexto(texto, finishReason) {
  const mitad = Math.floor(texto.length / 2);
  const eventos = [
    { choices: [{ delta: { reasoning_content: 'pensando...' }, finish_reason: null }] },
    { choices: [{ delta: { content: texto.slice(0, mitad) }, finish_reason: null }] },
    { choices: [{ delta: { content: texto.slice(mitad) }, finish_reason: finishReason || 'stop' }] },
  ];
  const sse = eventos.map(function (e) { return 'data: ' + JSON.stringify(e) + '\n\n'; }).join('') + 'data: [DONE]\n\n';
  return new Response(sse, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function deepseekStream(contentObj) {
  return deepseekStreamTexto(JSON.stringify(contentObj));
}

function routerSinContexto(deepseekRespuesta) {
  return function (url) {
    if (url.indexOf('git/trees/master') !== -1) return new Response('error', { status: 500 });
    if (url.indexOf('api.deepseek.com') !== -1) return deepseekStream(deepseekRespuesta);
    throw new Error('URL no mockeada: ' + url);
  };
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
  process.env.DEEPSEEK_API_KEY = '';
  const { default: handler } = await import('file://' + HANDLER_URL.replace(/\\/g, '/') + '?t=' + Date.now());

  await test('sin DEEPSEEK_API_KEY -> 503, no llama a fetch', async () => {
    const restore = mockFetch(() => { throw new Error('no debería llamarse'); });
    const res = await handler(req({ modo: 'revisar', codigo: 'regress y x' }));
    restore();
    assert.equal(res.status, 503);
  });

  process.env.DEEPSEEK_API_KEY = 'fake-key';

  await test('método GET -> 405', async () => {
    const res = await handler(req(undefined, 'GET'));
    assert.equal(res.status, 405);
  });

  await test('modo ausente -> 400', async () => {
    const res = await handler(req({ codigo: 'regress y x' }));
    assert.equal(res.status, 400);
  });

  await test('modo inválido -> 400', async () => {
    const res = await handler(req({ modo: 'ejecutar', codigo: 'regress y x' }));
    assert.equal(res.status, 400);
  });

  await test('modo revisar sin codigo -> 400', async () => {
    const res = await handler(req({ modo: 'revisar', codigo: '   ' }));
    assert.equal(res.status, 400);
  });

  await test('modo generar sin descripcion -> 400', async () => {
    const res = await handler(req({ modo: 'generar', descripcion: '' }));
    assert.equal(res.status, 400);
  });

  await test('modo revisar feliz, sin ASESOR_STATA_GITHUB_TOKEN -> sigue sin contexto', async () => {
    const restore = mockFetch(routerSinContexto({
      hallazgos: [{
        severidad: 'importante', que: 'Falta version fija', por_que: 'Riesgo de romper en otra versión de Stata',
        como_arreglar: 'Agregar version 18 al inicio del do-file', nota_citada: null,
      }],
    }));
    const res = await handler(req({ modo: 'revisar', codigo: 'regress y x' }));
    const data = await res.json();
    restore();
    assert.equal(res.status, 200);
    assert.equal(data.hallazgos.length, 1);
    assert.equal(data.hallazgos[0].severidad, 'importante');
  });

  await test('modo revisar con nota_citada válida', async () => {
    const restore = mockFetch(routerSinContexto({
      hallazgos: [{
        severidad: 'sugerencia', que: 'Macro sin comillas', por_que: 'Puede fallar silenciosamente',
        como_arreglar: 'Revisar el nombre de la macro',
        nota_citada: { titulo: 'Macros, loops y programas propios', path: 'knowledge/programming/macros-loops-programas-propios.md' },
      }],
    }));
    const res = await handler(req({ modo: 'revisar', codigo: 'local x foo\ndisplay `y`' }));
    const data = await res.json();
    restore();
    assert.equal(res.status, 200);
    assert.equal(data.hallazgos[0].nota_citada.path, 'knowledge/programming/macros-loops-programas-propios.md');
  });

  await test('modo revisar sin hallazgos -> 200 con array vacío', async () => {
    const restore = mockFetch(routerSinContexto({ hallazgos: [] }));
    const res = await handler(req({ modo: 'revisar', codigo: 'regress y x' }));
    const data = await res.json();
    restore();
    assert.equal(res.status, 200);
    assert.deepEqual(data.hallazgos, []);
  });

  await test('modo revisar con hallazgo malformado -> se filtra', async () => {
    const restore = mockFetch(routerSinContexto({
      hallazgos: [
        { severidad: 'importante', que: 'ok', por_que: 'ok', como_arreglar: 'ok', nota_citada: null },
        { severidad: 'otra-cosa', que: 'malo' },
      ],
    }));
    const res = await handler(req({ modo: 'revisar', codigo: 'regress y x' }));
    const data = await res.json();
    restore();
    assert.equal(res.status, 200);
    assert.equal(data.hallazgos.length, 1);
  });

  await test('con ASESOR_STATA_GITHUB_TOKEN, arma contexto vía router y lo manda a la respuesta final', async () => {
    process.env.ASESOR_STATA_GITHUB_TOKEN = 'fake-token';
    const INDEX_EJEMPLO = '# Índice\n\n## programming\n' +
      '- [Macros mal escritas](knowledge/programming/macros-loops-programas-propios.md) — trampa de macros. · 2026-09-29\n';
    const NOTA_CONTENIDO = '---\ntitle: Macros mal escritas\n---\n\n## Resumen\nCuidado con las macros.';
    let promptEnviado = '';
    let llamadasDeepseek = 0;
    const restore = mockFetch((url, opts) => {
      if (url.indexOf('contents/INDEX.md') !== -1) return new Response(INDEX_EJEMPLO, { status: 200 });
      if (url.indexOf('contents/knowledge/programming/macros-loops-programas-propios.md') !== -1) return new Response(NOTA_CONTENIDO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) {
        llamadasDeepseek++;
        if (llamadasDeepseek === 1) return deepseekOkResponse({ paths: ['knowledge/programming/macros-loops-programas-propios.md'] });
        promptEnviado = JSON.parse(opts.body).messages[1].content;
        return deepseekStream({ hallazgos: [] });
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ modo: 'revisar', codigo: 'local x foo' }));
    await res.json();
    restore();
    delete process.env.ASESOR_STATA_GITHUB_TOKEN;
    assert.equal(res.status, 200);
    assert.match(promptEnviado, /Macros mal escritas/);
  });

  await test('código largo -> el router recibe un extracto (comentarios + comandos), el análisis el código completo', async () => {
    process.env.ASESOR_STATA_GITHUB_TOKEN = 'fake-token';
    const INDEX_EJEMPLO = '# Índice\n\n## estadistica\n' +
      '- [Chi² vs Fisher](knowledge/estadistica/chi2-fisher.md) — cuándo usar exacta. · 2026-09-29\n';
    let promptRouter = '';
    let promptAnalisis = '';
    let llamadasDeepseek = 0;
    const restore = mockFetch((url, opts) => {
      if (url.indexOf('contents/INDEX.md') !== -1) return new Response(INDEX_EJEMPLO, { status: 200 });
      if (url.indexOf('contents/knowledge/estadistica/chi2-fisher.md') !== -1) return new Response('## Resumen\nUsar Fisher con celdas < 5.', { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) {
        llamadasDeepseek++;
        if (llamadasDeepseek === 1) {
          promptRouter = JSON.parse(opts.body).messages[1].content;
          return deepseekOkResponse({ paths: ['knowledge/estadistica/chi2-fisher.md'] });
        }
        promptAnalisis = JSON.parse(opts.body).messages[1].content;
        return deepseekStream({ hallazgos: [] });
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const codigoLargo = '*=== 5. BIVARIADO: Chi2 + Fisher ===*\n' +
      'quietly tabulate sexo epe, chi2 exact\n' +
      'bysort grupo: summarize edad\n' +
      'di "linea de relleno"\n'.repeat(300); // > MAX_CHARS_PARA_ROUTER
    const res = await handler(req({ modo: 'revisar', codigo: codigoLargo }));
    await res.json();
    restore();
    delete process.env.ASESOR_STATA_GITHUB_TOKEN;
    assert.equal(llamadasDeepseek, 2);
    assert.match(promptRouter, /BIVARIADO: Chi2 \+ Fisher/);
    assert.match(promptRouter, /Comandos usados: tabulate, summarize, di/);
    assert.ok(promptRouter.length < 3500, 'el router no debe recibir el do-file entero');
    assert.match(promptAnalisis, /linea de relleno/);
    assert.match(promptAnalisis, /Usar Fisher con celdas < 5/);
  });

  await test('modo generar feliz', async () => {
    const restore = mockFetch(routerSinContexto({
      codigo: 'regress y x1 x2, vce(robust)',
      explicacion: 'Corre una regresión lineal con errores robustos.',
      notas_citadas: [],
    }));
    const res = await handler(req({ modo: 'generar', descripcion: 'regresión con errores robustos' }));
    const data = await res.json();
    restore();
    assert.equal(res.status, 200);
    assert.equal(data.codigo, 'regress y x1 x2, vce(robust)');
    assert.match(data.explicacion, /errores robustos/);
  });

  await test('nivel se pasa al prompt del sistema', async () => {
    let promptEnviado = '';
    const restore = mockFetch((url, opts) => {
      if (url.indexOf('git/trees/master') !== -1) return new Response('error', { status: 500 });
      if (url.indexOf('api.deepseek.com') !== -1) {
        promptEnviado = JSON.parse(opts.body).messages[0].content;
        return deepseekStream({ codigo: 'x', explicacion: 'y', notas_citadas: [] });
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ modo: 'generar', descripcion: 'algo', nivel: 'basico' }));
    await res.json();
    restore();
    assert.equal(res.status, 200);
    assert.match(promptEnviado, /Nivel de la respuesta: BÁSICO/);
  });

  // Con streaming la respuesta ya salió con 200 cuando falla DeepSeek: el
  // error viaja como {error} dentro del cuerpo.
  await test('error HTTP de DeepSeek -> {error} en el cuerpo', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('git/trees/master') !== -1) return new Response('error', { status: 500 });
      if (url.indexOf('api.deepseek.com') !== -1) return new Response('error simulado', { status: 500 });
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ modo: 'revisar', codigo: 'regress y x' }));
    const data = await res.json();
    restore();
    assert.match(data.error, /No se pudo completar la revisión/);
  });

  await test('JSON malformado de DeepSeek -> {error}', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('git/trees/master') !== -1) return new Response('error', { status: 500 });
      if (url.indexOf('api.deepseek.com') !== -1) return deepseekStreamTexto('esto no es JSON');
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ modo: 'generar', descripcion: 'algo' }));
    const data = await res.json();
    restore();
    assert.ok(data.error);
    assert.equal(data.codigo, undefined);
  });

  await test('respuesta cortada por max_tokens -> mensaje específico de truncado', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('api.deepseek.com') !== -1) return deepseekStreamTexto('{"hallazgos": [{"severidad": "impor', 'length');
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ modo: 'revisar', codigo: 'regress y x' }));
    const data = await res.json();
    restore();
    assert.match(data.error, /demasiado larga/);
  });

  await test('respuesta de DeepSeek con forma inesperada para el modo -> {error}', async () => {
    const restore = mockFetch(routerSinContexto({ respuesta: 'esto no tiene el campo codigo' }));
    const res = await handler(req({ modo: 'generar', descripcion: 'algo' }));
    const data = await res.json();
    restore();
    assert.ok(data.error);
  });

  await test('pide stream:true a DeepSeek', async () => {
    let bodyEnviado = null;
    const restore = mockFetch((url, opts) => {
      if (url.indexOf('api.deepseek.com') !== -1) {
        bodyEnviado = JSON.parse(opts.body);
        return deepseekStream({ hallazgos: [] });
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ modo: 'revisar', codigo: 'regress y x' }));
    await res.json();
    restore();
    assert.equal(bodyEnviado.stream, true);
  });

  // ---- Etapa 3: líneas numeradas, explicar, interpretar, ajuste de generar ----

  function capturar(respuestaDeepseek) {
    const cap = { sistema: '', usuario: '', cuerpo: null, urls: [] };
    const restore = mockFetch((url, opts) => {
      cap.urls.push(url);
      if (url.indexOf('api.deepseek.com') !== -1) {
        cap.cuerpo = JSON.parse(opts.body);
        cap.sistema = cap.cuerpo.messages[0].content;
        cap.usuario = cap.cuerpo.messages[1].content;
        return deepseekStream(respuestaDeepseek);
      }
      throw new Error('URL no mockeada: ' + url);
    });
    return { cap, restore };
  }

  await test('revisar: el código llega al modelo con las líneas numeradas', async () => {
    const { cap, restore } = capturar({ hallazgos: [] });
    const res = await handler(req({ modo: 'revisar', codigo: 'use datos, clear\nregress y x' }));
    await res.json();
    restore();
    assert.match(cap.usuario, /1\| use datos, clear\n2\| regress y x/);
    assert.match(cap.sistema, /NO son parte del código/);
  });

  await test('revisar: la numeración se alinea a la derecha cuando hay 10 o más líneas', async () => {
    const { cap, restore } = capturar({ hallazgos: [] });
    const res = await handler(req({ modo: 'revisar', codigo: Array.from({ length: 12 }, (_, i) => 'di ' + (i + 1)).join('\n') }));
    await res.json();
    restore();
    assert.match(cap.usuario, / 1\| di 1\n 2\| di 2/);
    assert.match(cap.usuario, /12\| di 12/);
  });

  await test('revisar: conserva lineas válidas, descarta las fuera del archivo o mal formadas', async () => {
    const restore = mockFetch(routerSinContexto({
      hallazgos: [
        { severidad: 'importante', lineas: '2-3', que: 'a', por_que: 'a', como_arreglar: 'a', nota_citada: null },
        { severidad: 'importante', lineas: 2, que: 'b', por_que: 'b', como_arreglar: 'b', nota_citada: null },
        { severidad: 'sugerencia', lineas: '2 - 3', que: 'c', por_que: 'c', como_arreglar: 'c', nota_citada: null },
        { severidad: 'sugerencia', lineas: '99', que: 'd', por_que: 'd', como_arreglar: 'd', nota_citada: null },
        { severidad: 'sugerencia', lineas: '3-2', que: 'e', por_que: 'e', como_arreglar: 'e', nota_citada: null },
        { severidad: 'sugerencia', lineas: 'toda la sección 4', que: 'f', por_que: 'f', como_arreglar: 'f', nota_citada: null },
        { severidad: 'sugerencia', que: 'g', por_que: 'g', como_arreglar: 'g', nota_citada: null },
      ],
    }));
    const res = await handler(req({ modo: 'revisar', codigo: 'a\nb\nc\nd' }));
    const data = await res.json();
    restore();
    assert.deepEqual(data.hallazgos.map(h => h.lineas), ['2-3', '2', '2-3', null, null, null, null]);
  });

  await test('revisar: codigo_corregido se conserva, se le quita el prefijo "N| " y se recorta', async () => {
    const restore = mockFetch(routerSinContexto({
      hallazgos: [
        { severidad: 'importante', lineas: '1', que: 'a', por_que: 'a', como_arreglar: 'a', codigo_corregido: '1| gen x = y if !missing(y)\n2| tab x', nota_citada: null },
        { severidad: 'sugerencia', que: 'b', por_que: 'b', como_arreglar: 'b', codigo_corregido: '   ', nota_citada: null },
        { severidad: 'sugerencia', que: 'c', por_que: 'c', como_arreglar: 'c', codigo_corregido: 'z'.repeat(5000), nota_citada: null },
        { severidad: 'sugerencia', que: 'd', por_que: 'd', como_arreglar: 'd', codigo_corregido: 42, nota_citada: null },
      ],
    }));
    const res = await handler(req({ modo: 'revisar', codigo: 'gen x = y' }));
    const data = await res.json();
    restore();
    assert.equal(data.hallazgos[0].codigo_corregido, 'gen x = y if !missing(y)\ntab x');
    assert.equal(data.hallazgos[1].codigo_corregido, null);
    assert.equal(data.hallazgos[2].codigo_corregido.length, 1500);
    assert.equal(data.hallazgos[3].codigo_corregido, null);
  });

  await test('modo inválido -> 400 y el mensaje lista los cuatro modos', async () => {
    const res = await handler(req({ modo: 'ejecutar', codigo: 'x' }));
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /revisar.*explicar.*interpretar.*generar/);
  });

  await test('explicar: sin código -> 400', async () => {
    const res = await handler(req({ modo: 'explicar', codigo: '  ' }));
    assert.equal(res.status, 400);
  });

  await test('explicar: devuelve resumen y pasos validados, sin consultar la base de notas', async () => {
    process.env.ASESOR_STATA_GITHUB_TOKEN = 'fake-token';
    const { cap, restore } = capturar({
      resumen: 'Importa datos, crea una variable y corre una regresión.',
      pasos: [
        { lineas: '1-2', que_hace: 'Abre la base.', ojo: 'La ruta es absoluta.' },
        { lineas: '3', que_hace: 'Corre la regresión.', ojo: null },
        { lineas: '40', que_hace: 'Línea que no existe.' },
        { que_hace: '' },
        'basura',
      ],
    });
    const res = await handler(req({ modo: 'explicar', codigo: 'use "C:\\a.dta", clear\ngen x = 1\nregress y x', nivel: 'basico' }));
    const data = await res.json();
    restore();
    delete process.env.ASESOR_STATA_GITHUB_TOKEN;
    assert.equal(data.resumen, 'Importa datos, crea una variable y corre una regresión.');
    assert.deepEqual(data.pasos.map(p => p.lineas), ['1-2', '3', null]);
    assert.equal(data.pasos[0].ojo, 'La ruta es absoluta.');
    assert.equal(data.pasos[1].ojo, null);
    assert.equal(data.pasos.length, 3);
    assert.match(cap.usuario, /3\| regress y x/);
    assert.match(cap.sistema, /Nivel de la respuesta: BÁSICO/);
    assert.equal(cap.urls.filter(u => u.indexOf('github') !== -1).length, 0);
    assert.equal(cap.cuerpo.stream, true);
  });

  await test('explicar: respuesta sin resumen o sin pasos válidos -> {error}', async () => {
    for (const mala of [{ pasos: [{ que_hace: 'x' }] }, { resumen: 'ok', pasos: [] }, { resumen: 'ok', pasos: [{ que_hace: '' }] }]) {
      const { restore } = capturar(mala);
      const res = await handler(req({ modo: 'explicar', codigo: 'di 1' }));
      const data = await res.json();
      restore();
      assert.ok(data.error, 'debería ser error para ' + JSON.stringify(mala));
    }
  });

  await test('interpretar: sin salida -> 400', async () => {
    const res = await handler(req({ modo: 'interpretar', salida: '   ' }));
    assert.equal(res.status, 400);
  });

  await test('interpretar: devuelve la interpretación validada; el contexto del estudio llega al prompt', async () => {
    process.env.ASESOR_STATA_GITHUB_TOKEN = 'fake-token';
    const { cap, restore } = capturar({
      que_se_hizo: 'Una regresión logística de bajo peso al nacer.',
      resultados: [
        { dato: 'OR de fumar = 2.0 (IC95% 0.9–4.2; p = 0.07)', significado: 'Más odds, pero el IC incluye 1.' },
        { dato: 'sin significado' },
        { dato: '', significado: 'vacío' },
      ],
      precauciones: ['Es una asociación, no causalidad.', '', 7],
      como_reportarlo: 'Fumar se asoció con OR 2.0 (IC95% 0.9–4.2).',
    });
    const res = await handler(req({ modo: 'interpretar', salida: 'low | Odds ratio  Std. err.\nsmoke | 2.0  0.7', contexto: 'Estudio de bajo peso al nacer' }));
    const data = await res.json();
    restore();
    delete process.env.ASESOR_STATA_GITHUB_TOKEN;
    assert.equal(data.que_se_hizo, 'Una regresión logística de bajo peso al nacer.');
    assert.equal(data.resultados.length, 1);
    assert.match(data.resultados[0].dato, /OR de fumar = 2.0/);
    assert.deepEqual(data.precauciones, ['Es una asociación, no causalidad.']);
    assert.match(data.como_reportarlo, /OR 2.0/);
    assert.match(cap.usuario, /Contexto del estudio: Estudio de bajo peso al nacer/);
    assert.match(cap.usuario, /smoke \| 2.0/);
    assert.equal(cap.urls.filter(u => u.indexOf('github') !== -1).length, 0);
  });

  await test('interpretar: sin contexto no inventa la línea de contexto; recorta salidas enormes', async () => {
    const { cap, restore } = capturar({ que_se_hizo: 'x', resultados: [], precauciones: [] });
    const res = await handler(req({ modo: 'interpretar', salida: 'a'.repeat(20000) }));
    const data = await res.json();
    restore();
    assert.equal(data.como_reportarlo, null);
    assert.ok(!/Contexto del estudio/.test(cap.usuario));
    assert.ok(cap.usuario.length < 8200, 'la salida debe recortarse a 8000 caracteres');
  });

  await test('interpretar: respuesta sin que_se_hizo -> {error}', async () => {
    const { restore } = capturar({ resultados: [] });
    const res = await handler(req({ modo: 'interpretar', salida: 'algo' }));
    const data = await res.json();
    restore();
    assert.ok(data.error);
  });

  await test('generar con ajuste: el código actual y el ajuste llegan al prompt', async () => {
    const { cap, restore } = capturar({ codigo: 'di 2', explicacion: 'Cambié el 1 por 2.', notas_citadas: [] });
    const res = await handler(req({ modo: 'generar', descripcion: 'mostrar un número', codigo_previo: 'di 1', ajuste: 'que sea 2' }));
    const data = await res.json();
    restore();
    assert.equal(data.codigo, 'di 2');
    assert.match(cap.usuario, /Código actual:\n```\ndi 1\n```/);
    assert.match(cap.usuario, /Ajuste pedido: que sea 2/);
    assert.match(cap.sistema, /COMPLETO ya modificado/);
  });

  await test('generar sin ajuste: el prompt no menciona código actual', async () => {
    const { cap, restore } = capturar({ codigo: 'di 1', explicacion: 'x', notas_citadas: [] });
    const res = await handler(req({ modo: 'generar', descripcion: 'mostrar un número' }));
    await res.json();
    restore();
    assert.ok(!/Código actual/.test(cap.usuario));
    assert.ok(!/Ajuste pedido/.test(cap.usuario));
  });

  await test('generar: ajuste sin código previo (o al revés) -> 400', async () => {
    let res = await handler(req({ modo: 'generar', descripcion: 'algo', ajuste: 'cambia esto' }));
    assert.equal(res.status, 400);
    res = await handler(req({ modo: 'generar', descripcion: 'algo', codigo_previo: 'di 1' }));
    assert.equal(res.status, 400);
  });

  console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
  process.exit(fallidos > 0 ? 1 : 0);
}

main();
