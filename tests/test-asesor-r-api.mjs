// Pruebas de los endpoints con lenguaje "r" (Preguntar y Código de la pestaña R), con el
// sitio (r-notas/) y DeepSeek simulados -- sin red. Correr con: node tests/test-asesor-r-api.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pasados = 0, fallidos = 0;
async function test(nombre, fn) {
  try { await fn(); pasados++; console.log('OK   ' + nombre); }
  catch (e) { fallidos++; console.log('FALLO ' + nombre + ' -- ' + e.message); }
}

// ---- simulación de fetch: sitio estático y DeepSeek ----
let llamadasDeepSeek = [];
let authRecibidas = [];
let respuestaModelo = {};
function sse(obj) {
  const texto = 'data: ' + JSON.stringify({ choices: [{ delta: { content: JSON.stringify(obj) }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n';
  return new Response(new TextEncoder().encode(texto), { status: 200 });
}
globalThis.fetch = async function (url, opciones) {
  const u = String(url);
  if (u.indexOf('https://api.deepseek.com') === 0) {
    const cuerpo = JSON.parse(opciones.body);
    llamadasDeepSeek.push({ sistema: cuerpo.messages[0].content, usuario: cuerpo.messages[1].content });
    return sse(respuestaModelo);
  }
  const m = /\/r-notas\/(.+)$/.exec(u);
  if (m) {
    authRecibidas.push(opciones && opciones.headers && opciones.headers.authorization);
    try { return new Response(readFileSync(path.join(RAIZ, 'r-notas', m[1]), 'utf8'), { status: 200 }); }
    catch (e) { return new Response('no', { status: 404 }); }
  }
  throw new Error('fetch inesperado: ' + u);
};

delete process.env.ASESOR_STATA_GITHUB_TOKEN; // R no debe necesitarlo
process.env.DEEPSEEK_API_KEY = 'clave-de-prueba';

const consulta = (await import('../api/asesor-stata-consulta.js')).default;
const codigo = (await import('../api/asesor-stata-codigo.js')).default;

function pedido(url, cuerpo, conAuth) {
  return new Request('https://sitio.test' + url, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, conAuth ? { authorization: 'Basic abc' } : {}),
    body: JSON.stringify(cuerpo),
  });
}
async function leer(res) { return JSON.parse((await res.text()).trim()); }
function reiniciar() { llamadasDeepSeek = []; authRecibidas = []; }

await test('Preguntar R: no pide el token de GitHub, usa las notas de r-notas y el prompt de R', async () => {
  reiniciar();
  respuestaModelo = { respuesta: 'Declara el diseño con svydesign.', notas_citadas: [{ titulo: 'ENDES en R — diseño', path: 'knowledge/endes-r/01-diseno-muestral-complejo-svydesign.md' }] };
  const res = await consulta(pedido('/api/asesor-stata-consulta', { pregunta: '¿Cómo declaro el diseño?', lenguaje: 'r' }, true));
  assert.equal(res.status, 200);
  const datos = await leer(res);
  assert.equal(datos.notas_citadas.length, 1);
  assert.match(llamadasDeepSeek[0].sistema, /Asesor R/);
  assert.match(llamadasDeepSeek[0].sistema, /INTERMEDIO/);
  assert.match(llamadasDeepSeek[0].usuario, /### knowledge\/endes-r\/01-diseno-muestral-complejo-svydesign\.md/);
  assert.match(llamadasDeepSeek[0].usuario, /### knowledge\/endes-r\/05-/);
  assert.ok(authRecibidas.length >= 6 && authRecibidas.every((a) => a === 'Basic abc'), 'reenvía las credenciales');
});

await test('Preguntar sin lenguaje (Stata) sigue exigiendo el token de GitHub', async () => {
  reiniciar();
  const res = await consulta(pedido('/api/asesor-stata-consulta', { pregunta: 'hola' }, true));
  assert.equal(res.status, 503);
  assert.equal(llamadasDeepSeek.length, 0);
});

await test('Preguntar R sin notas disponibles responde el mensaje honesto', async () => {
  reiniciar();
  const original = globalThis.fetch;
  globalThis.fetch = async (u, o) => (String(u).indexOf('/r-notas/') !== -1 ? new Response('no', { status: 404 }) : original(u, o));
  const datos = await leer(await consulta(pedido('/api/asesor-stata-consulta', { pregunta: 'algo', lenguaje: 'r' }, true)));
  globalThis.fetch = original;
  assert.match(datos.respuesta, /No encontré notas/);
  assert.equal(llamadasDeepSeek.length, 0);
});

await test('Código R · revisar: prompt de R, nivel de R, código numerado y notas en el contexto', async () => {
  reiniciar();
  respuestaModelo = { hallazgos: [{ severidad: 'importante', lineas: '2', que: 'glm ignora el diseño', por_que: 'SE subestimados', como_arreglar: 'usa svyglm', codigo_corregido: '2| svyglm(y ~ x, dis)', nota_citada: null }] };
  const res = await codigo(pedido('/api/asesor-stata-codigo', { modo: 'revisar', nivel: 'avanzado', lenguaje: 'r', codigo: 'library(survey)\nm <- glm(y ~ x, data = d)' }, true));
  const datos = await leer(res);
  assert.equal(datos.hallazgos.length, 1);
  assert.equal(datos.hallazgos[0].lineas, '2');
  assert.equal(datos.hallazgos[0].codigo_corregido, 'svyglm(y ~ x, dis)'); // quita el prefijo "2| "
  const l = llamadasDeepSeek[0];
  assert.match(l.sistema, /código R/);
  assert.match(l.sistema, /AVANZADO/);
  assert.doesNotMatch(l.sistema, /Stata/);
  assert.match(l.usuario, /1\| library\(survey\)/);
  assert.match(l.usuario, /### knowledge\/endes-r\//);
});

await test('Código R · explicar y generar usan prompts de R', async () => {
  reiniciar();
  respuestaModelo = { resumen: 'Carga datos.', pasos: [{ lineas: '1', que_hace: 'Carga el paquete', ojo: null }] };
  const e = await leer(await codigo(pedido('/api/asesor-stata-codigo', { modo: 'explicar', lenguaje: 'r', codigo: 'library(survey)' }, true)));
  assert.equal(e.pasos.length, 1);
  assert.match(llamadasDeepSeek[0].sistema, /tutor de R/);
  assert.match(llamadasDeepSeek[0].usuario, /Script de R a explicar/);

  respuestaModelo = { codigo: 'library(survey)', explicacion: 'Carga survey.', notas_citadas: [] };
  const g = await leer(await codigo(pedido('/api/asesor-stata-codigo', { modo: 'generar', lenguaje: 'r', descripcion: 'prevalencia de anemia' }, true)));
  assert.equal(g.codigo, 'library(survey)');
  assert.match(llamadasDeepSeek[1].sistema, /generador de código R/);
});

await test('Código R · interpretar: prompt de R, salida de R y validación; sin salida es 400', async () => {
  reiniciar();
  respuestaModelo = { que_se_hizo: 'Prevalencia por área.', resultados: [{ dato: 'rural 0.240', significado: 'Mayor que urbano 0.167' }], precauciones: ['Revisa el diseño'], como_reportarlo: 'La prevalencia fue 24 % en el área rural.' };
  const d = await leer(await codigo(pedido('/api/asesor-stata-codigo', { modo: 'interpretar', lenguaje: 'r', salida: '2    2 0.2403859', contexto: 'ENDES' }, true)));
  assert.equal(d.resultados.length, 1);
  assert.match(d.como_reportarlo, /24 %/);
  const l = llamadasDeepSeek[0];
  assert.match(l.sistema, /resultados de R/);
  assert.doesNotMatch(l.sistema, /Stata/);
  assert.match(l.usuario, /Contexto del estudio: ENDES/);
  assert.match(l.usuario, /Salida de R:/);
  const vacio = await codigo(pedido('/api/asesor-stata-codigo', { modo: 'interpretar', lenguaje: 'r', salida: '   ' }, true));
  assert.equal(vacio.status, 400);
  assert.match((await vacio.json()).error, /salida de R/);
});

await test('Código sin lenguaje sigue siendo Stata (explicar e interpretar) y no lee r-notas', async () => {
  reiniciar();
  respuestaModelo = { resumen: 'ok', pasos: [{ lineas: '1', que_hace: 'x', ojo: null }] };
  await leer(await codigo(pedido('/api/asesor-stata-codigo', { modo: 'explicar', codigo: 'use datos' }, true)));
  assert.match(llamadasDeepSeek[0].sistema, /tutor de Stata/);
  respuestaModelo = { que_se_hizo: 'x', resultados: [], precauciones: [], como_reportarlo: null };
  await leer(await codigo(pedido('/api/asesor-stata-codigo', { modo: 'interpretar', salida: 'tab x y' }, true)));
  assert.match(llamadasDeepSeek[1].usuario, /Salida de Stata:/);
  assert.equal(authRecibidas.length, 0, 'Stata no lee r-notas');
});

console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
process.exit(fallidos > 0 ? 1 : 0);
