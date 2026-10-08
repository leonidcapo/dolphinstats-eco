// Pruebas de las funciones puras de navegación de asesor-stata-nucleo.js (rutas,
// guías vecinas, secciones de una nota y líneas de código) -- sin DOM.
// Correr con: node tests/test-asesor-stata-navegacion.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const N = createRequire(import.meta.url)('../asesor-stata-nucleo.js');

let pasados = 0, fallidos = 0;
function test(nombre, fn) {
  try { fn(); pasados++; console.log('OK   ' + nombre); }
  catch (e) { fallidos++; console.log('FALLO ' + nombre + ' -- ' + e.message); }
}

const PARTES = {
  guias: { temas: [{ nombre: 'stata-basics', notas: [{ path: 'knowledge/stata-basics/tour.md', titulo: 'Tour' }] }] },
  radar: { temas: [{ nombre: 'sampling', notas: [{ path: 'knowledge/sampling/calibra.md', titulo: 'CALIBRA' }] }] },
};
const DESCONOCIDA = { vista: 'inicio', desconocida: true };

test('parsearRuta: inicio y variantes vacías', () => {
  for (const h of ['', '#', '#/', '#//']) assert.deepEqual(N.parsearRuta(h), { vista: 'inicio' });
  assert.deepEqual(N.parsearRuta(undefined), { vista: 'inicio' });
});

test('parsearRuta: secciones simples (con o sin barra final)', () => {
  assert.deepEqual(N.parsearRuta('#/aprender'), { vista: 'aprender' });
  assert.deepEqual(N.parsearRuta('#/aprender/'), { vista: 'aprender' });
  assert.deepEqual(N.parsearRuta('#/radar'), { vista: 'radar' });
  assert.deepEqual(N.parsearRuta('#/preguntar'), { vista: 'preguntar' });
  assert.deepEqual(N.parsearRuta('#/resultados'), { vista: 'resultados' });
});

test('parsearRuta: código con modo; sin modo equivale a revisar; modo desconocido es ruta desconocida', () => {
  assert.deepEqual(N.parsearRuta('#/codigo'), { vista: 'codigo', modo: 'revisar' });
  assert.deepEqual(N.parsearRuta('#/codigo/explicar'), { vista: 'codigo', modo: 'explicar' });
  assert.deepEqual(N.parsearRuta('#/codigo/generar'), { vista: 'codigo', modo: 'generar' });
  assert.deepEqual(N.parsearRuta('#/codigo/borrar'), DESCONOCIDA);
});

test('parsearRuta: una guía y una nota del Radar', () => {
  assert.deepEqual(N.parsearRuta('#/aprender/stata-basics/tour'),
    { vista: 'guia', origen: 'aprender', path: 'knowledge/stata-basics/tour.md' });
  assert.deepEqual(N.parsearRuta('#/radar/sampling/calibra'),
    { vista: 'guia', origen: 'radar', path: 'knowledge/sampling/calibra.md' });
});

test('parsearRuta: rutas inválidas o peligrosas son desconocidas', () => {
  for (const h of ['#/foo', '#/aprender/solo-tema', '#/aprender/a/b/c', '#/aprender/Stata Basics/tour',
    '#/aprender/..%2F/x', '#/aprender/../x', '#/preguntar/extra', '#/resultados/x', '#/radar/UPPER/x']) {
    assert.deepEqual(N.parsearRuta(h), DESCONOCIDA, h);
  }
});

test('parsearRuta: enlace antiguo #nota= válido', () => {
  assert.deepEqual(N.parsearRuta('#nota=knowledge%2Fsampling%2Fcalibra.md'),
    { vista: 'enlace-antiguo', path: 'knowledge/sampling/calibra.md' });
});

test('parsearRuta: enlace antiguo roto, sin tema, con .. o mal codificado es ruta desconocida', () => {
  for (const h of ['#nota=', '#nota=../../etc/passwd', '#nota=knowledge%2Fx.md', '#nota=knowledge%2Fa%2F..%2Fb.md',
    '#nota=%E0%A4%A', '#nota=knowledge%2Fsampling%2Fcalibra.txt']) {
    assert.deepEqual(N.parsearRuta(h), DESCONOCIDA, h);
  }
});

test('construirRuta: es la inversa de parsearRuta', () => {
  for (const h of ['#/', '#/aprender', '#/radar', '#/preguntar', '#/resultados', '#/codigo/revisar', '#/codigo/explicar',
    '#/codigo/generar', '#/aprender/stata-basics/tour', '#/radar/sampling/calibra']) {
    assert.equal(N.construirRuta(N.parsearRuta(h)), h);
  }
  assert.equal(N.construirRuta({ vista: 'codigo' }), '#/codigo/revisar');
  assert.equal(N.construirRuta({ vista: 'guia', origen: 'aprender', path: 'no-valida' }), '#/');
  assert.equal(N.construirRuta({ vista: 'cualquier-cosa' }), '#/');
});

test('existeNota y rutaDeNota: guía -> aprender, nota del Radar -> radar, desconocida -> aprender', () => {
  assert.equal(N.existeNota('knowledge/stata-basics/tour.md', PARTES), true);
  assert.equal(N.existeNota('knowledge/sampling/calibra.md', PARTES), true);
  assert.equal(N.existeNota('knowledge/x/y.md', PARTES), false);
  assert.equal(N.rutaDeNota('knowledge/stata-basics/tour.md', PARTES), '#/aprender/stata-basics/tour');
  assert.equal(N.rutaDeNota('knowledge/sampling/calibra.md', PARTES), '#/radar/sampling/calibra');
  assert.equal(N.rutaDeNota('knowledge/x/y.md', PARTES), '#/aprender/x/y');
});

test('traducirEnlaceViejo: traduce los válidos y devuelve null si no es antiguo o la nota no existe', () => {
  assert.equal(N.traducirEnlaceViejo('#nota=knowledge%2Fstata-basics%2Ftour.md', PARTES), '#/aprender/stata-basics/tour');
  assert.equal(N.traducirEnlaceViejo('#nota=knowledge%2Fsampling%2Fcalibra.md', PARTES), '#/radar/sampling/calibra');
  assert.equal(N.traducirEnlaceViejo('#nota=knowledge%2Fx%2Fy.md', PARTES), null);
  assert.equal(N.traducirEnlaceViejo('#nota=../../etc/passwd', PARTES), null);
  assert.equal(N.traducirEnlaceViejo('#/aprender', PARTES), null);
});

test('separarSecciones: reparte por encabezado ## y normaliza la clave', () => {
  const md = 'Texto previo\n\n## Resumen\nTécnico.\n\n## En simple\nSencillo.\n\n## Ejemplo\nIntro.\n\n```stata\nsummarize\n```\n\n## Relevancia para DolphinStats\nInterna.\n';
  const s = N.separarSecciones(md);
  assert.deepEqual(s.map(x => x.clave), ['resumen', 'en simple', 'ejemplo', 'relevancia para dolphinstats']);
  assert.equal(s[1].cuerpo, 'Sencillo.');
  assert.equal(s[2].cuerpo, 'Intro.\n\n```stata\nsummarize\n```');
});

test('separarSecciones: un ## dentro de un bloque de código no parte la sección; tolera CRLF y texto vacío', () => {
  const s = N.separarSecciones('## Ejemplo\r\n```\r\n## no es encabezado\r\n```\r\n## Resumen\r\nok');
  assert.deepEqual(s.map(x => x.clave), ['ejemplo', 'resumen']);
  assert.match(s[0].cuerpo, /## no es encabezado/);
  assert.deepEqual(N.separarSecciones(''), []);
  assert.deepEqual(N.separarSecciones(undefined), []);
});

const GUIAS = { temas: [
  { nombre: 'stata-basics', notas: [
    { path: 'knowledge/stata-basics/a.md', titulo: 'A' }, { path: 'knowledge/stata-basics/b.md', titulo: 'B' }, { path: 'knowledge/stata-basics/c.md', titulo: 'C' } ] },
  { nombre: 'graphics', notas: [{ path: 'knowledge/graphics/solo.md', titulo: 'Sola' }] },
  { nombre: 'regression', notas: [
    { path: 'knowledge/regression/x.md', titulo: 'X' }, { path: 'knowledge/regression/y.md', titulo: 'Y' } ] },
] };

test('vecinosDeGuia: guía del medio de un tema', () => {
  const v = N.vecinosDeGuia(GUIAS, 'knowledge/stata-basics/b.md');
  assert.equal(v.tema, 'Primeros pasos en Stata');
  assert.equal(v.posicion, 2);
  assert.equal(v.totalTema, 3);
  assert.equal(v.anterior.titulo, 'A');
  assert.equal(v.anterior.otroTema, false);
  assert.equal(v.siguiente.titulo, 'C');
  assert.equal(v.siguiente.otroTema, false);
});

test('vecinosDeGuia: el límite entre temas marca otroTema y nombra el otro tema', () => {
  const v = N.vecinosDeGuia(GUIAS, 'knowledge/stata-basics/c.md');
  assert.equal(v.siguiente.titulo, 'Sola');
  assert.equal(v.siguiente.otroTema, true);
  assert.equal(v.siguiente.tema, 'Gráficos');
  const w = N.vecinosDeGuia(GUIAS, 'knowledge/regression/x.md');
  assert.equal(w.anterior.titulo, 'Sola');
  assert.equal(w.anterior.otroTema, true);
});

test('vecinosDeGuia: guía única de su tema (Guía 1 de 1) con vecinos de otros temas', () => {
  const v = N.vecinosDeGuia(GUIAS, 'knowledge/graphics/solo.md');
  assert.equal(v.posicion, 1);
  assert.equal(v.totalTema, 1);
  assert.equal(v.anterior.titulo, 'C');
  assert.equal(v.siguiente.titulo, 'X');
});

test('vecinosDeGuia: la primera de todas no tiene anterior y la última no tiene siguiente', () => {
  assert.equal(N.vecinosDeGuia(GUIAS, 'knowledge/stata-basics/a.md').anterior, null);
  assert.equal(N.vecinosDeGuia(GUIAS, 'knowledge/regression/y.md').siguiente, null);
  assert.equal(N.vecinosDeGuia(GUIAS, 'knowledge/regression/y.md').anterior.titulo, 'X');
});

test('vecinosDeGuia: una ruta que no es una guía devuelve null; un índice vacío también', () => {
  assert.equal(N.vecinosDeGuia(GUIAS, 'knowledge/otra/cosa.md'), null);
  assert.equal(N.vecinosDeGuia({ temas: [] }, 'knowledge/a/b.md'), null);
});

// ---- las tareas siguientes agregan pruebas arriba de esta línea ----

console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
process.exit(fallidos > 0 ? 1 : 0);
