# Rediseño del frontend de Asesor Stata — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer la interfaz de Asesor Stata (inicio por tareas, banda de color, código lado a lado con líneas resaltadas, guía como artículo) conservando todas sus funciones y sin tocar los endpoints.

**Architecture:** Una sola página (`asesor-stata.html`) con vistas dibujadas por JavaScript según una ruta en el `#`. El código se parte en un **núcleo de funciones puras** (probado con `node`) y una **interfaz** (router, componentes compartidos y una vista por archivo). Los estilos y las fuentes de marca salen a archivos propios porque la política de seguridad bloquea las fuentes de Google.

**Tech Stack:** HTML, CSS y JavaScript sin compilación ni librerías externas; pruebas con `node` (scripts `.mjs`); verificación visual con el navegador integrado y un servidor local.

**Spec:** `docs/superpowers/specs/2026-10-07-asesor-stata-rediseno-frontend-design.md` (léelo antes de empezar; el plan lo implementa sección por sección).

## Global Constraints

Copiadas del spec; los requisitos de cada tarea las incluyen implícitamente.

- No cambian los endpoints (`api/asesor-stata-*.js`) ni el contenido de las notas.
- Página estática sin compilación ni librerías externas. La política de `vercel.json` (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`) no se relaja.
- Los usuarios son 3 personas con el Basic Auth compartido de `middleware.js`.
- Marca DolphinStats: Syne para títulos, DM Sans para texto, azul y marino. Fuentes incluidas en el repositorio: Syne 700 y 800, DM Sans 400, 500 y 700, en woff2 de subconjunto latino, con `font-display: swap` y licencia SIL OFL.
- Debe funcionar bien en celular (375 px), sin desborde horizontal.
- Se conservan **todas** las funciones actuales (lista «No regresión» de la Tarea 12).
- Texto base de 16 px; texto secundario de 14 px.
- Contraste AA (≥ 4,5) en todo texto; objetivos táctiles de 44 px; foco visible de 2 px.
- `prefers-reduced-motion` desactiva animaciones y transiciones. Sin modo oscuro.
- Colores: marino `#003060`, gris azulado `#4a6285`, azul `#0075c6`, azul oscuro `#005a9c`, cian oscuro `#067583` (texto), cian claro `#0899a8` (**solo** bordes y degradados), violeta `#7b3ff2`, naranja `#c2410c` (Código), rojo de severidad `#c62828`, superficie `#f5f7fb`.
- Límites de caracteres iguales a los del servidor: código 20 000, descripción 1 000, pregunta 500, salida de Stata 8 000, contexto 500, ajuste 500.
- Español neutro en todos los textos de la interfaz.
- No usar glifos de flecha (`←`, `→`, `↗`) en el texto: el subconjunto latino de las fuentes no los trae. Usar los iconos SVG.
- Convención de commits: se hacen con la herramienta **Bash** (no PowerShell, que parte los mensajes con comillas dobles), sin comillas dobles dentro del mensaje, con un segundo `-m` que contiene la línea `Co-Authored-By` vigente que indique el sistema.
- Antes de cualquier rama, commit, push o descarga se necesita la confirmación del usuario: la Tarea 0 la pide una sola vez para todo el plan.

## Review Focus

Condiciones que el spec implica pero que ninguna prueba obvia cubre y que más probablemente le fallen a una persona real. Cada línea tiene su prueba en la tarea indicada.

1. **Una respuesta tardía no debe pintarse en la pantalla equivocada.** Si el usuario cambia de pantalla mientras algo carga, lo que llegue después se descarta. (Tarea 7 provee el mecanismo; prueba en la Tarea 8.)
2. **Enlace antiguo `#nota=` roto, inválido o de una nota que ya no existe** lleva a Inicio con un aviso, nunca a una pantalla en blanco. (Tarea 2 la función pura; prueba de punta a punta en la Tarea 8.)
3. **El índice no carga** (error de red o 503): Aprender y Radar muestran un error con «Reintentar» y Preguntar y Código siguen usables. (Tareas 8 y 9.)
4. **Código pegado con finales de línea de Windows, espacios o líneas en blanco al inicio, o con más de 20 000 caracteres:** los números de línea que ve el usuario deben ser los que usó el servidor. (Tarea 4 `prepararCodigo`; prueba visual en la Tarea 10.)
5. **Guía única de su tema, primera o última de todas:** «Anterior» y «Siguiente» no deben producir enlaces rotos ni textos engañosos. (Tarea 3 la función pura; prueba visual en la Tarea 8.)

## Estructura de archivos

Todo dentro de `dolphinstats-eco/` salvo indicación.

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `asesor-stata-nucleo.js` | Funciones puras sin DOM: Markdown, índice, filtros, informe, descripción guiada, rutas, guías vecinas, secciones de una nota, líneas de código | 1–4 |
| `asesor-stata.css` | Todo el estilo; las variables de diseño van al inicio | 6 en adelante |
| `fonts/` | Fuentes woff2, `fonts.css` y licencias | 5 |
| `asesor-stata-nuevo.html` | Estructura base nueva (mientras se construye; al final reemplaza a `asesor-stata.html`) | 7 |
| `asesor-stata-app.js` | Núcleo de la interfaz: ayudantes de DOM, router, índice, componentes compartidos (al final pasa a llamarse `asesor-stata.js`) | 7 |
| `vistas/inicio.js` | Pantalla Inicio | 7 |
| `vistas/aprender.js`, `vistas/guia.js` | Lista de guías y lectura de una guía o nota del Radar | 8 |
| `vistas/preguntar.js`, `vistas/radar.js` | Preguntar y Radar | 9 |
| `vistas/visor-codigo.js` | Componente: cuadro de código con números de línea y líneas resaltadas | 10 |
| `vistas/codigo.js` | Código: Revisar, Explicar y Generar | 10, 11 |
| `vistas/resultados.js` | Entender mis resultados | 11 |
| `tests/test-asesor-stata-markdown.mjs` | Pruebas actuales; pasan a importar el núcleo | 1 |
| `tests/test-asesor-stata-navegacion.mjs` | Rutas, guías vecinas, secciones, líneas | 2–4 |
| `tests/test-asesor-stata-fuentes.mjs` | Las fuentes existen y son woff2 válidas | 5 |
| `tests/test-asesor-stata-contraste.mjs` | Contraste de los colores del CSS | 6 |

**Refinamiento respecto al spec:** el spec describe «`asesor-stata.js`: interfaz». Para que cada archivo sea pequeño y se pueda razonar entero, la interfaz se divide en un archivo de núcleo (`asesor-stata.js`) y una vista por archivo en `vistas/`. El comportamiento no cambia.

**Mientras se construye**, la página vieja (`asesor-stata.html` + `asesor-stata.js`) sigue funcionando; lo nuevo vive en `asesor-stata-nuevo.html` y `asesor-stata-app.js`. En la Tarea 12 se intercambian los nombres y se borra lo viejo.

---

### Task 0: Preparación y autorización

**Files:**
- Modify: `.gitignore`
- Create (fuera del repositorio): `servidor-local.mjs` en el directorio temporal de la sesión; en los pasos siguientes su ruta se llama `$SERVIDOR`.

**Interfaces:**
- Produces: la rama `rediseno-asesor-stata`, `.superpowers/` ignorado, y un servidor local (`node $SERVIDOR --puerto=8791`, y con `--csp` para aplicar las cabeceras reales de `vercel.json`).

- [ ] **Step 1: Pedir autorización al usuario (una sola vez)**

Escribir al usuario, tal cual: «Para ejecutar el plan necesito tu autorización para: (1) crear la rama `rediseno-asesor-stata` desde `main`; (2) agregar `.superpowers/` al `.gitignore`; (3) hacer un commit por tarea en esa rama; (4) subir la rama al final de cada etapa (tareas 7, 9, 11 y 12) para que Vercel genere una vista previa (necesita que `SITE_USER`, `SITE_PASS`, `ASESOR_STATA_GITHUB_TOKEN` y `DEEPSEEK_API_KEY` estén activas también para «Preview»; si no, la vista previa no funciona y verifico solo en local); (5) en la Tarea 5, descargar las fuentes. ¿Autorizas todo, o qué dejamos fuera?». Esperar la respuesta. Si algo no se autoriza, saltar esa parte del plan y decirlo.

- [ ] **Step 2: Crear la rama y confirmar el estado inicial**

```bash
cd C:/Users/ASUS/Desktop/Claude/dolphinstats-eco
git fetch -q && git status -sb | head -1
git switch -c rediseno-asesor-stata
```
Expected: `## main...origin/main` (sin «behind») y `Switched to a new branch 'rediseno-asesor-stata'`. Si dice «behind», hacer `git pull --ff-only` antes de crear la rama.

- [ ] **Step 3: Ignorar `.superpowers/` y confirmar**

Agregar al final de `.gitignore` una línea con exactamente `.superpowers/` (si `.gitignore` termina sin salto de línea, añadirlo antes). Luego:

```bash
git check-ignore -q .superpowers && echo "ignorado"
git add .gitignore
git commit -m "chore: ignorar .superpowers (maquetas del proceso de diseño)" -m "Co-Authored-By: <modelo vigente> <noreply@anthropic.com>"
```
Expected: `ignorado` y un commit con 1 archivo.

- [ ] **Step 4: Crear el servidor de verificación (no se sube al repositorio)**

Guardar este código como `servidor-local.mjs` en el directorio temporal de la sesión (scratchpad) y anotar la ruta como `$SERVIDOR`:

```js
// servidor-local.mjs — verificación local de dolphinstats-eco (NO va al repositorio).
// Uso: node servidor-local.mjs [--puerto=8791] [--csp]
// Sirve los estáticos, ejecuta los handlers de /api con las llamadas a GitHub
// resueltas contra la copia local del repo asesor-stata, y con --csp aplica las
// cabeceras reales de vercel.json (incluida la política de seguridad).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ECO = 'C:/Users/ASUS/Desktop/Claude/dolphinstats-eco';
const NOTAS = 'C:/Users/ASUS/Desktop/Claude/asesor-stata';
const valor = (nombre, porDefecto) => (process.argv.find(a => a.startsWith('--' + nombre + '=')) || '').split('=')[1] || porDefecto;
const PUERTO = Number(valor('puerto', 8791));
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

let cabeceras = {};
if (process.argv.includes('--csp')) {
  const config = JSON.parse(await readFile(path.join(ECO, 'vercel.json'), 'utf8'));
  cabeceras = Object.fromEntries(config.headers[0].headers.map(h => [h.key, h.value]));
}

process.env.ASESOR_STATA_GITHUB_TOKEN = 'local';
const fetchReal = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const m = String(url).match(/api\.github\.com\/repos\/[^/]+\/[^/]+\/contents\/(.+)$/);
  if (!m) return fetchReal(url, opts);
  try {
    // La copia local en Windows tiene CRLF; GitHub sirve LF.
    const texto = (await readFile(path.join(NOTAS, decodeURIComponent(m[1])), 'utf8')).replace(/\r\n/g, '\n');
    return new Response(texto, { status: 200 });
  } catch (e) {
    return new Response('not found', { status: 404 });
  }
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:' + PUERTO);
  try {
    if (url.pathname.startsWith('/api/')) {
      const modulo = await import('file:///' + ECO + url.pathname + '.js');
      const trozos = [];
      for await (const t of req) trozos.push(t);
      const r = await modulo.default(new Request(url, { method: req.method, headers: req.headers, body: trozos.length ? Buffer.concat(trozos) : undefined }));
      res.writeHead(r.status, { ...cabeceras, ...Object.fromEntries(r.headers) });
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    const archivo = url.pathname === '/' ? '/index.html' : url.pathname;
    const datos = await readFile(path.join(ECO, archivo));
    res.writeHead(200, { ...cabeceras, 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
    res.end(datos);
  } catch (e) {
    res.writeHead(404, cabeceras);
    res.end('no encontrado');
  }
}).listen(PUERTO, () => console.log('http://localhost:' + PUERTO + (process.argv.includes('--csp') ? '  (con la política de seguridad de producción)' : '')));
```

Para mirar páginas con el navegador integrado hace falta una entrada temporal en `C:/Users/ASUS/Desktop/Claude/.claude/launch.json`: `{ "name": "asesor-stata-local", "runtimeExecutable": "node", "runtimeArgs": ["<ruta de $SERVIDOR>"], "port": 8791 }`. Agregarla cuando se necesite y **quitarla al terminar cada verificación**. Para la variante con política de seguridad usar otra entrada con `"runtimeArgs": ["<ruta de $SERVIDOR>", "--puerto=8792", "--csp"]` y `"port": 8792`.

- [ ] **Step 5: Anotar la línea base de pruebas**

```bash
cd C:/Users/ASUS/Desktop/Claude/dolphinstats-eco
for t in tests/test-asesor-stata-markdown.mjs api/tests/test-asesor-stata-codigo.mjs api/tests/test-asesor-stata-consulta.mjs api/tests/test-asesor-stata-base.mjs api/tests/test-asesor-stata-relevancia.mjs api/tests/test-asesor-stata-github.mjs; do printf "%-46s" "$t"; node $t | tail -1; done
```
Expected: `35 pasados` (markdown), `34` (código), `16` (consulta), `13` (base), `8` (relevancia), `5` (github), todos con `0 fallidos`. Si alguna cifra difiere, anotarla: esa es la línea base y no debe empeorar.

---

### Task 1: Extraer el núcleo de funciones puras

Refactor sin cambio de comportamiento: lo puro de `asesor-stata.js` pasa a su propio archivo.

**Files:**
- Create: `asesor-stata-nucleo.js`
- Modify: `asesor-stata.js` (queda solo la interfaz vieja), `asesor-stata.html` (carga el núcleo antes), `tests/test-asesor-stata-markdown.mjs`

**Interfaces:**
- Produces: `window.AsesorStataNucleo` en el navegador y `module.exports` en `node`, con las funciones: `escapeHtml(texto)`, `inlineMarkdown(texto)`, `parsearFrontmatter(markdown)`, `cuerpoMarkdownAHtml(cuerpo)`, `separarNotaInterna(cuerpo)`, `nombreTema(slug)`, `normalizarTexto(texto)`, `filtrarIndice(indice, texto)`, `separarPorOrigen(indice)`, `listarRadar(radar, texto)`, `etiquetaFuente(source)`, `etiquetaLineas(lineas)`, `armarInformeRevision(hallazgos, fechaIso)`, `armarDescripcionGuiada(campos)`. Las firmas y resultados no cambian.

- [ ] **Step 1: Escribir la prueba que falla**

En `tests/test-asesor-stata-markdown.mjs`, línea 8, cambiar el archivo que se importa:

```js
const MODULO_URL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'asesor-stata-nucleo.js');
```

- [ ] **Step 2: Verificar que falla**

Run: `node tests/test-asesor-stata-markdown.mjs`
Expected: error `Cannot find module` / `ERR_MODULE_NOT_FOUND` para `asesor-stata-nucleo.js`.

- [ ] **Step 3: Partir el archivo con un script**

Ejecutar este script desde `dolphinstats-eco/` (lee `asesor-stata.js`, escribe `asesor-stata-nucleo.js` y reescribe `asesor-stata.js` sin la parte pura):

```bash
node -e "
const fs = require('fs');
const src = fs.readFileSync('asesor-stata.js', 'utf8');
const usoEstricto = \"'use strict';\";
const iUso = src.indexOf(usoEstricto);
const iApi = src.indexOf('  var API = {');
const iFinApi = src.indexOf('};', iApi) + 2;
const marcaAsignacion = 'window.AsesorStata = API;';
const iAsignacion = src.indexOf(marcaAsignacion);
if ([iUso, iApi, iFinApi, iAsignacion].some(i => i < 0)) throw new Error('no se encontraron las marcas del archivo');

const pura = src.slice(iUso + usoEstricto.length, iFinApi)
  .replace('  var API = {', '  var API = {\n    escapeHtml: escapeHtml,\n    inlineMarkdown: inlineMarkdown,');
const nucleo = '/* asesor-stata-nucleo.js — funciones puras de Asesor Stata (sin DOM): conversor de Markdown,\n' +
  ' * índice, filtros, informe y descripción guiada. Se carga antes que la interfaz y se prueba con node. */\n' +
  '(function (raiz) {\n  ' + usoEstricto + pura + '\n\n' +
  '  if (typeof module !== \'undefined\' && module.exports) { module.exports = API; }\n' +
  '  else { raiz.AsesorStataNucleo = API; }\n' +
  '})(typeof window !== \'undefined\' ? window : globalThis);\n';
fs.writeFileSync('asesor-stata-nucleo.js', nucleo);

const nombres = ['escapeHtml', 'inlineMarkdown', 'parsearFrontmatter', 'cuerpoMarkdownAHtml', 'nombreTema', 'filtrarIndice',
  'etiquetaFuente', 'separarNotaInterna', 'separarPorOrigen', 'listarRadar', 'etiquetaLineas', 'armarInformeRevision', 'armarDescripcionGuiada'];
const reemplazo = '\n  var N = window.AsesorStataNucleo;\n  var ' + nombres.map(n => n + ' = N.' + n).join(',\n      ') + ';';
const ui = src.slice(0, iUso + usoEstricto.length) + reemplazo + src.slice(iAsignacion + marcaAsignacion.length);
fs.writeFileSync('asesor-stata.js', ui);
console.log('núcleo:', nucleo.split('\n').length, 'líneas | interfaz vieja:', ui.split('\n').length, 'líneas');
"
node --check asesor-stata-nucleo.js && node --check asesor-stata.js && echo "sintaxis OK"
```
Expected: dos cifras de líneas (el núcleo, unas 300; la interfaz, unas 950) y `sintaxis OK`.

- [ ] **Step 4: Cargar el núcleo antes en la página vieja**

En `asesor-stata.html`, reemplazar la línea `<script src="asesor-stata.js"></script>` por:

```html
<script src="asesor-stata-nucleo.js"></script>
<script src="asesor-stata.js"></script>
```

- [ ] **Step 5: Verificar que las pruebas pasan**

Run: `node tests/test-asesor-stata-markdown.mjs | tail -1`
Expected: `35 pasados, 0 fallidos`.

- [ ] **Step 6: Verificar que la página vieja sigue funcionando**

Levantar el servidor (`node $SERVIDOR --puerto=8791`), abrir `http://localhost:8791/asesor-stata.html` en el navegador integrado y ejecutar en la página:

```js
await new Promise(r => setTimeout(r, 2000));
({ nucleo: typeof window.AsesorStataNucleo, conteo: document.getElementById('as-conteo').textContent,
   tarjetasRadar: (document.getElementById('as-tab-radar').click(), document.querySelectorAll('#as-radar .ncard').length) })
```
Expected: `{ nucleo: 'object', conteo: '23 guías en 11 temas', tarjetasRadar: 15 }`. Revisar también que la consola no tenga errores.

- [ ] **Step 7: Commit**

```bash
git add asesor-stata-nucleo.js asesor-stata.js asesor-stata.html tests/test-asesor-stata-markdown.mjs
git commit -m "refactor(asesor-stata): separa las funciones puras en asesor-stata-nucleo.js" -m "Co-Authored-By: <modelo vigente> <noreply@anthropic.com>"
```

---

### Task 2: Núcleo — rutas

**Files:**
- Modify: `asesor-stata-nucleo.js`
- Create: `tests/test-asesor-stata-navegacion.mjs`

**Interfaces:**
- Consumes: `separarPorOrigen(indice)` → `{ guias: { temas: [...] }, radar: { temas: [...] } }`, donde cada tema es `{ nombre, notas: [{ path, titulo, ... }] }`.
- Produces (todas en `AsesorStataNucleo`):
  - `parsearRuta(hash: string)` → objeto de ruta: `{ vista: 'inicio' }`, `{ vista: 'inicio', desconocida: true }`, `{ vista: 'aprender' | 'radar' | 'preguntar' | 'resultados' }`, `{ vista: 'codigo', modo: 'revisar' | 'explicar' | 'generar' }`, `{ vista: 'guia', origen: 'aprender' | 'radar', path: 'knowledge/<tema>/<slug>.md' }`, `{ vista: 'enlace-antiguo', path }`.
  - `construirRuta(ruta)` → `string` (`'#/...'`), inversa de `parsearRuta`.
  - `existeNota(path, partes)` → `boolean`.
  - `rutaDeNota(path, partes)` → `'#/radar/...'` si la nota es del Radar, `'#/aprender/...'` en cualquier otro caso.
  - `traducirEnlaceViejo(hash, partes)` → ruta nueva (`string`) o `null` si no es un enlace antiguo válido o la nota no existe.

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `tests/test-asesor-stata-navegacion.mjs`:

```js
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

// ---- las tareas siguientes agregan pruebas arriba de esta línea ----

console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
process.exit(fallidos > 0 ? 1 : 0);
```

- [ ] **Step 2: Verificar que fallan**

Run: `node tests/test-asesor-stata-navegacion.mjs | tail -3`
Expected: `FALLO …` con `N.parsearRuta is not a function` en cada prueba; `0 pasados, 10 fallidos`.

- [ ] **Step 3: Implementar**

En `asesor-stata-nucleo.js`, justo antes de `var API = {`, agregar:

```js
  // ------------------------------------------------------------------ rutas

  var SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  var MODOS_CODIGO = ['revisar', 'explicar', 'generar'];
  var DESCONOCIDA = function () { return { vista: 'inicio', desconocida: true }; };

  function pathDeSegmentos(tema, slug) {
    return SLUG.test(tema) && SLUG.test(slug) ? 'knowledge/' + tema + '/' + slug + '.md' : null;
  }

  function segmentosDePath(path) {
    var m = /^knowledge\/([a-z0-9-]+)\/([a-z0-9-]+)\.md$/.exec(String(path || ''));
    return m && SLUG.test(m[1]) && SLUG.test(m[2]) ? { tema: m[1], slug: m[2] } : null;
  }

  // Convierte la parte posterior al # de la dirección en una ruta. Nunca lanza:
  // lo que no se reconoce devuelve { vista: 'inicio', desconocida: true }.
  function parsearRuta(hash) {
    var h = String(hash === undefined || hash === null ? '' : hash);
    var viejo = /^#nota=(.*)$/.exec(h);
    if (viejo) {
      var path = null;
      try { path = decodeURIComponent(viejo[1]); } catch (e) { path = null; }
      return segmentosDePath(path) ? { vista: 'enlace-antiguo', path: path } : DESCONOCIDA();
    }
    var partes = h.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (!partes.length) return { vista: 'inicio' };
    var guia = function (origen) {
      if (partes.length !== 3) return DESCONOCIDA();
      var p = pathDeSegmentos(partes[1], partes[2]);
      return p ? { vista: 'guia', origen: origen, path: p } : DESCONOCIDA();
    };
    switch (partes[0]) {
      case 'aprender': return partes.length === 1 ? { vista: 'aprender' } : guia('aprender');
      case 'radar': return partes.length === 1 ? { vista: 'radar' } : guia('radar');
      case 'preguntar': return partes.length === 1 ? { vista: 'preguntar' } : DESCONOCIDA();
      case 'resultados': return partes.length === 1 ? { vista: 'resultados' } : DESCONOCIDA();
      case 'codigo':
        if (partes.length === 1) return { vista: 'codigo', modo: 'revisar' };
        if (partes.length === 2 && MODOS_CODIGO.indexOf(partes[1]) !== -1) return { vista: 'codigo', modo: partes[1] };
        return DESCONOCIDA();
      default: return DESCONOCIDA();
    }
  }

  function construirRuta(ruta) {
    switch (ruta && ruta.vista) {
      case 'aprender': return '#/aprender';
      case 'radar': return '#/radar';
      case 'preguntar': return '#/preguntar';
      case 'resultados': return '#/resultados';
      case 'codigo': return '#/codigo/' + (MODOS_CODIGO.indexOf(ruta.modo) !== -1 ? ruta.modo : 'revisar');
      case 'guia': {
        var s = segmentosDePath(ruta.path);
        return s ? '#/' + (ruta.origen === 'radar' ? 'radar' : 'aprender') + '/' + s.tema + '/' + s.slug : '#/';
      }
      default: return '#/';
    }
  }

  function contieneNota(lista, path) {
    return lista.temas.some(function (t) { return t.notas.some(function (n) { return n.path === path; }); });
  }

  function existeNota(path, partes) {
    return contieneNota(partes.guias, path) || contieneNota(partes.radar, path);
  }

  function rutaDeNota(path, partes) {
    return construirRuta({ vista: 'guia', origen: contieneNota(partes.radar, path) ? 'radar' : 'aprender', path: path });
  }

  // Enlaces compartidos antes del rediseño (#nota=<ruta codificada>) -> ruta nueva.
  function traducirEnlaceViejo(hash, partes) {
    var r = parsearRuta(hash);
    if (r.vista !== 'enlace-antiguo' || !existeNota(r.path, partes)) return null;
    return rutaDeNota(r.path, partes);
  }

```

Y dentro del objeto `API`, agregar las propiedades `parsearRuta: parsearRuta`, `construirRuta: construirRuta`, `existeNota: existeNota`, `rutaDeNota: rutaDeNota`, `traducirEnlaceViejo: traducirEnlaceViejo` (con coma al final de cada una).

- [ ] **Step 4: Verificar que pasan**

Run: `node tests/test-asesor-stata-navegacion.mjs | tail -1 && node tests/test-asesor-stata-markdown.mjs | tail -1`
Expected: `10 pasados, 0 fallidos` y `35 pasados, 0 fallidos`.

- [ ] **Step 5: Commit**

```bash
git add asesor-stata-nucleo.js tests/test-asesor-stata-navegacion.mjs
git commit -m "feat(asesor-stata): rutas puras (parsear, construir y traducir enlaces antiguos)" -m "Co-Authored-By: <modelo vigente> <noreply@anthropic.com>"
```

---

### Task 3: Núcleo — secciones de una nota y guías vecinas

**Files:**
- Modify: `asesor-stata-nucleo.js`, `tests/test-asesor-stata-navegacion.mjs`

**Interfaces:**
- Consumes: `normalizarTexto(texto)`, `nombreTema(slug)`; `separarPorOrigen(indice).guias` → `{ temas: [{ nombre: slug, notas: [{ path, titulo }] }] }`.
- Produces:
  - `separarSecciones(cuerpo: string)` → `[{ clave, titulo, cuerpo }]` en el orden del archivo. `clave` es el título normalizado (`'resumen'`, `'en simple'`, `'ejemplo'`, `'relevancia para dolphinstats'`). Ignora los `## ` dentro de bloques ` ``` `. El texto previo al primer encabezado se descarta.
  - `vecinosDeGuia(guias, path)` → `null` si la guía no está; si está, `{ tema, temaSlug, posicion, totalTema, anterior, siguiente }`, donde `anterior` y `siguiente` son `null` o `{ path, titulo, temaSlug, tema, otroTema: boolean }`.

- [ ] **Step 1: Escribir las pruebas que fallan**

En `tests/test-asesor-stata-navegacion.mjs`, insertar **antes** de la línea `// ---- las tareas siguientes agregan pruebas arriba de esta línea ----`:

```js
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

```

- [ ] **Step 2: Verificar que fallan**

Run: `node tests/test-asesor-stata-navegacion.mjs | grep -c FALLO`
Expected: `7` (las dos de `separarSecciones` y las cinco de `vecinosDeGuia`).

- [ ] **Step 3: Implementar**

En `asesor-stata-nucleo.js`, antes de `var API = {`:

```js
  // ------------------------------------------------- secciones y guías vecinas

  // Parte el cuerpo de una nota en secciones por encabezado "## ". Un "## " dentro
  // de un bloque ``` no cuenta. El texto previo al primer encabezado se descarta.
  function separarSecciones(cuerpo) {
    var secciones = [];
    var actual = null;
    var enBloque = false;
    String(cuerpo === undefined || cuerpo === null ? '' : cuerpo).split(/\r?\n/).forEach(function (linea) {
      if (/^```/.test(linea.trim())) enBloque = !enBloque;
      var m = enBloque ? null : /^##\s+(.+?)\s*$/.exec(linea);
      if (m) {
        actual = { clave: normalizarTexto(m[1]), titulo: m[1], lineas: [] };
        secciones.push(actual);
      } else if (actual) {
        actual.lineas.push(linea);
      }
    });
    return secciones.map(function (s) {
      return { clave: s.clave, titulo: s.titulo, cuerpo: s.lineas.join('\n').replace(/^\n+|\n+$/g, '') };
    });
  }

  // Posición de una guía dentro de su tema y guías anterior y siguiente en el orden
  // del índice (los temas siguen el orden de INDEX.md). null si la ruta no es una guía.
  function vecinosDeGuia(guias, path) {
    var plano = [];
    guias.temas.forEach(function (t) {
      t.notas.forEach(function (n) {
        plano.push({ path: n.path, titulo: n.titulo, temaSlug: t.nombre, tema: nombreTema(t.nombre) });
      });
    });
    var i = -1;
    plano.forEach(function (n, k) { if (n.path === path) i = k; });
    if (i === -1) return null;
    var actual = plano[i];
    var delTema = plano.filter(function (n) { return n.temaSlug === actual.temaSlug; });
    function vecina(n) {
      return n ? { path: n.path, titulo: n.titulo, temaSlug: n.temaSlug, tema: n.tema, otroTema: n.temaSlug !== actual.temaSlug } : null;
    }
    return {
      tema: actual.tema,
      temaSlug: actual.temaSlug,
      posicion: delTema.indexOf(actual) + 1,
      totalTema: delTema.length,
      anterior: vecina(i > 0 ? plano[i - 1] : null),
      siguiente: vecina(i < plano.length - 1 ? plano[i + 1] : null),
    };
  }

```

Y en `API` agregar `separarSecciones: separarSecciones,` y `vecinosDeGuia: vecinosDeGuia,`.

- [ ] **Step 4: Verificar que pasan**

Run: `node tests/test-asesor-stata-navegacion.mjs | tail -1`
Expected: `17 pasados, 0 fallidos`.

- [ ] **Step 5: Commit**

```bash
git add asesor-stata-nucleo.js tests/test-asesor-stata-navegacion.mjs
git commit -m "feat(asesor-stata): secciones de una nota y guías vecinas (anterior y siguiente)" -m "Co-Authored-By: <modelo vigente> <noreply@anthropic.com>"
```

---

### Task 4: Núcleo — líneas de código

**Files:**
- Modify: `asesor-stata-nucleo.js`, `tests/test-asesor-stata-navegacion.mjs`

**Interfaces:**
- Produces:
  - `dividirLineas(texto)` → `string[]`; separa por `\n` o `\r\n`; `''` da `['']`; `null`/`undefined` dan `['']`. Es la **misma** separación que usa el servidor para numerar.
  - `prepararCodigo(texto, max)` → `string`: `texto.trim()` y luego `slice(0, max)`; **idéntico** a lo que hace el servidor antes de numerar.
  - `lineasDeRango(rango, total)` → `number[]`: `'12'` → `[12]`, `'12-15'` → `[12,13,14,15]`; `[]` si `rango` es `null`, mal formado, invertido, menor que 1 o mayor que `total`. Acepta guion largo (`–`) y espacios alrededor.
  - `hallazgosEnLinea(rangos, n, total)` → `number[]` con los índices (de `rangos`, ascendentes) cuyo rango contiene la línea `n`.
  - `siguienteEnCiclo(indices, actual)` → `number`: `-1` si `indices` está vacío; el primero si `actual` no está en `indices`; si no, el siguiente en orden circular.

- [ ] **Step 1: Escribir las pruebas que fallan**

Insertar antes de la línea `// ---- las tareas siguientes agregan pruebas arriba de esta línea ----`:

```js
test('dividirLineas: separa por LF y CRLF, y siempre devuelve al menos una línea', () => {
  assert.deepEqual(N.dividirLineas('a\nb'), ['a', 'b']);
  assert.deepEqual(N.dividirLineas('a\r\nb\r\n'), ['a', 'b', '']);
  assert.deepEqual(N.dividirLineas(''), ['']);
  assert.deepEqual(N.dividirLineas(null), ['']);
  assert.deepEqual(N.dividirLineas(undefined), ['']);
});

test('prepararCodigo: recorta espacios y líneas en blanco de los extremos y limita los caracteres', () => {
  assert.equal(N.prepararCodigo('\n\n  use x\r\ngen y\n\n', 20000), 'use x\r\ngen y');
  assert.equal(N.prepararCodigo('   ', 100), '');
  assert.equal(N.prepararCodigo(null, 100), '');
  assert.equal(N.prepararCodigo('abcdef', 3), 'abc');
  // el recorte es primero y el límite después, como en el servidor
  assert.equal(N.prepararCodigo('   abcdef', 3), 'abc');
});

test('prepararCodigo: el número de líneas coincide con el que cuenta el servidor (trim + CRLF)', () => {
  const crudo = '\r\n\r\n  use datos, clear\r\n\r\ngen edad_cat = 1\r\nreplace edad_cat = 2\r\n\r\n';
  const preparado = N.prepararCodigo(crudo, 20000);
  assert.equal(N.dividirLineas(preparado).length, 4);
  assert.equal(N.dividirLineas(preparado)[0], 'use datos, clear');
  const largo = ('di "linea"\n').repeat(3000);
  assert.equal(N.prepararCodigo(largo, 20000).length, 20000);
});

test('lineasDeRango: una línea, un rango, con guion largo y espacios', () => {
  assert.deepEqual(N.lineasDeRango('12', 50), [12]);
  assert.deepEqual(N.lineasDeRango('12-15', 50), [12, 13, 14, 15]);
  assert.deepEqual(N.lineasDeRango('3 – 5', 50), [3, 4, 5]);
  assert.deepEqual(N.lineasDeRango(7, 50), [7]);
  assert.deepEqual(N.lineasDeRango('50', 50), [50]);
});

test('lineasDeRango: nulo, mal formado, invertido, cero o fuera del archivo da lista vacía', () => {
  for (const r of [null, undefined, '', 'abc', '5-', '-5', '5-3', '0', '0-2', '51', '40-60', '1.5', 'toda la sección']) {
    assert.deepEqual(N.lineasDeRango(r, 50), [], String(r));
  }
});

test('hallazgosEnLinea: índices de los hallazgos que cubren una línea', () => {
  const rangos = ['2-3', null, '3', '10-12', 'basura'];
  assert.deepEqual(N.hallazgosEnLinea(rangos, 3, 20), [0, 2]);
  assert.deepEqual(N.hallazgosEnLinea(rangos, 11, 20), [3]);
  assert.deepEqual(N.hallazgosEnLinea(rangos, 1, 20), []);
  assert.deepEqual(N.hallazgosEnLinea([], 1, 20), []);
});

test('siguienteEnCiclo: recorre los índices en círculo', () => {
  assert.equal(N.siguienteEnCiclo([], 0), -1);
  assert.equal(N.siguienteEnCiclo([4], -1), 4);
  assert.equal(N.siguienteEnCiclo([0, 2, 5], -1), 0);
  assert.equal(N.siguienteEnCiclo([0, 2, 5], 1), 0);
  assert.equal(N.siguienteEnCiclo([0, 2, 5], 0), 2);
  assert.equal(N.siguienteEnCiclo([0, 2, 5], 5), 0);
  assert.equal(N.siguienteEnCiclo([4], 4), 4);
});

```

- [ ] **Step 2: Verificar que fallan**

Run: `node tests/test-asesor-stata-navegacion.mjs | grep -c FALLO`
Expected: `7`.

- [ ] **Step 3: Implementar**

En `asesor-stata-nucleo.js`, antes de `var API = {`:

```js
  // ----------------------------------------------------------- líneas de código

  // Misma separación que usa el servidor para numerar el código que le llega.
  function dividirLineas(texto) {
    return String(texto === undefined || texto === null ? '' : texto).split(/\r?\n/);
  }

  // Lo que el servidor hace antes de numerar: recortar y limitar. Si el visor
  // muestra este texto, sus números de línea son los mismos que ve el modelo.
  function prepararCodigo(texto, max) {
    return String(texto === undefined || texto === null ? '' : texto).trim().slice(0, max);
  }

  // "12" o "12-15" -> [12] o [12,13,14,15]; vacío si es nulo, mal formado,
  // invertido, menor que 1 o mayor que total.
  function lineasDeRango(rango, total) {
    var m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(String(rango === undefined || rango === null ? '' : rango).trim());
    if (!m) return [];
    var desde = Number(m[1]);
    var hasta = m[2] !== undefined ? Number(m[2]) : desde;
    if (desde < 1 || hasta < desde || hasta > total) return [];
    var lineas = [];
    for (var n = desde; n <= hasta; n++) lineas.push(n);
    return lineas;
  }

  function hallazgosEnLinea(rangos, n, total) {
    var indices = [];
    rangos.forEach(function (r, i) { if (lineasDeRango(r, total).indexOf(n) !== -1) indices.push(i); });
    return indices;
  }

  function siguienteEnCiclo(indices, actual) {
    if (!indices.length) return -1;
    var p = indices.indexOf(actual);
    return p === -1 ? indices[0] : indices[(p + 1) % indices.length];
  }

```

Y en `API`: `dividirLineas`, `prepararCodigo`, `lineasDeRango`, `hallazgosEnLinea`, `siguienteEnCiclo` (cada uno como `nombre: nombre,`).

- [ ] **Step 4: Verificar que pasan**

Run: `node tests/test-asesor-stata-navegacion.mjs | tail -1 && node tests/test-asesor-stata-markdown.mjs | tail -1`
Expected: `24 pasados, 0 fallidos` y `35 pasados, 0 fallidos`.

- [ ] **Step 5: Commit**

```bash
git add asesor-stata-nucleo.js tests/test-asesor-stata-navegacion.mjs
git commit -m "feat(asesor-stata): funciones puras de líneas de código (preparar, rangos y selección)" -m "Co-Authored-By: <modelo vigente> <noreply@anthropic.com>"
```

---
### Task 5: Fuentes de marca en el repositorio

**Files:**
- Create: `fonts/fonts.css`, `fonts/syne-700.woff2`, `fonts/syne-800.woff2`, `fonts/dm-sans-400.woff2`, `fonts/dm-sans-500.woff2`, `fonts/dm-sans-700.woff2`, `fonts/LICENSE-syne.txt`, `fonts/LICENSE-dm-sans.txt`, `tests/test-asesor-stata-fuentes.mjs`

**Interfaces:**
- Produces: `fonts/fonts.css` con cinco `@font-face` (familias `'Syne'` y `'DM Sans'`) que las páginas cargan con `<link rel="stylesheet" href="fonts/fonts.css">`. Los archivos se llaman exactamente como arriba; la Tarea 7 los precarga por nombre.

- [ ] **Step 1: Pedir permiso para descargar, con los datos exactos**

Obtener el tamaño de cada archivo (solo lectura de cabeceras):

```bash
B=https://cdn.jsdelivr.net/npm/@fontsource
for u in syne@5/files/syne-latin-700-normal.woff2 syne@5/files/syne-latin-800-normal.woff2 \
  dm-sans@5/files/dm-sans-latin-400-normal.woff2 dm-sans@5/files/dm-sans-latin-500-normal.woff2 dm-sans@5/files/dm-sans-latin-700-normal.woff2 \
  syne@5/LICENSE dm-sans@5/LICENSE; do printf "%s  " "$u"; curl -sIL "$B/$u" | grep -i -E "^HTTP|content-length" | tr '\r\n' ' '; echo; done
```
Si alguna ruta da 404, ver el listado real con `curl -s https://data.jsdelivr.com/v1/package/npm/@fontsource/syne@5` (y lo mismo para `dm-sans`) y usar los nombres que aparezcan.

Escribir al usuario: «Voy a descargar 5 archivos de fuentes (Syne 700 y 800, DM Sans 400, 500 y 700, woff2 subconjunto latino, <tamaño total> en total) y 2 licencias de texto, desde el paquete `@fontsource` publicado en jsDelivr (cdn.jsdelivr.net), con licencia SIL OFL. Se guardan en `dolphinstats-eco/fonts/`. ¿Autorizas la descarga?». Esperar el sí. Sin autorización, detener la tarea y avisar que las fuentes de marca seguirán sin cargar.

- [ ] **Step 2: Escribir la prueba que falla**

Crear `tests/test-asesor-stata-fuentes.mjs`:

```js
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
```

- [ ] **Step 3: Verificar que falla**

Run: `node tests/test-asesor-stata-fuentes.mjs | tail -2`
Expected: `0 pasados, 4 fallidos` (no existe `fonts/fonts.css`).

- [ ] **Step 4: Descargar los archivos autorizados**

```bash
mkdir -p fonts && cd fonts
B=https://cdn.jsdelivr.net/npm/@fontsource
curl -fL -o syne-700.woff2 $B/syne@5/files/syne-latin-700-normal.woff2
curl -fL -o syne-800.woff2 $B/syne@5/files/syne-latin-800-normal.woff2
curl -fL -o dm-sans-400.woff2 $B/dm-sans@5/files/dm-sans-latin-400-normal.woff2
curl -fL -o dm-sans-500.woff2 $B/dm-sans@5/files/dm-sans-latin-500-normal.woff2
curl -fL -o dm-sans-700.woff2 $B/dm-sans@5/files/dm-sans-latin-700-normal.woff2
curl -fL -o LICENSE-syne.txt $B/syne@5/LICENSE
curl -fL -o LICENSE-dm-sans.txt $B/dm-sans@5/LICENSE
cd .. && ls -l fonts
```
Expected: 7 archivos; los woff2 entre 4 KB y 120 KB. Si alguna licencia no contiene «SIL OPEN FONT LICENSE», buscar el texto OFL del propio paquete y no seguir sin él.

- [ ] **Step 5: Escribir `fonts/fonts.css`**

```css
/* Fuentes de marca de DolphinStats servidas desde el propio sitio: la política de
   seguridad (vercel.json) solo admite estilos y fuentes de 'self', así que las de
   fonts.googleapis.com no cargan en producción. Syne y DM Sans: SIL Open Font
   License 1.1 (ver LICENSE-syne.txt y LICENSE-dm-sans.txt). Subconjunto latino. */
@font-face {
  font-family: 'Syne'; font-style: normal; font-weight: 700; font-display: swap;
  src: url('syne-700.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Syne'; font-style: normal; font-weight: 800; font-display: swap;
  src: url('syne-800.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'DM Sans'; font-style: normal; font-weight: 400; font-display: swap;
  src: url('dm-sans-400.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'DM Sans'; font-style: normal; font-weight: 500; font-display: swap;
  src: url('dm-sans-500.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'DM Sans'; font-style: normal; font-weight: 700; font-display: swap;
  src: url('dm-sans-700.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
```

- [ ] **Step 6: Verificar que pasa**

Run: `node tests/test-asesor-stata-fuentes.mjs | tail -1`
Expected: `4 pasados, 0 fallidos`.

- [ ] **Step 7: Comprobar que se sirven con la política de producción**

Con el servidor `node $SERVIDOR --puerto=8792 --csp` en marcha:

```bash
curl -sI http://localhost:8792/fonts/syne-800.woff2 | grep -i -E "^HTTP|content-type"
curl -sI http://localhost:8792/fonts/fonts.css | grep -i -E "^HTTP|content-type|content-security"
```
Expected: `200` con `content-type: font/woff2`; y `200` con `text/css` y la cabecera `Content-Security-Policy: default-src 'self'; …`. (La prueba en un navegador real va en la Tarea 7, cuando exista la página nueva.) Cerrar el servidor.

- [ ] **Step 8: Commit**

```bash
git add fonts tests/test-asesor-stata-fuentes.mjs
git commit -m "feat(asesor-stata): fuentes de marca (Syne y DM Sans) servidas desde el propio sitio" -m "Co-Authored-By: <modelo vigente> <noreply@anthropic.com>"
```

---

### Task 6: Estilos base, variables de diseño y prueba de contraste

**Files:**
- Create: `asesor-stata.css`, `tests/test-asesor-stata-contraste.mjs`

**Interfaces:**
- Produces: `asesor-stata.css` con las variables de diseño en el bloque `:root` (nombres exactos en la tabla de la Step 3) y las clases base que usan las tareas siguientes: `.saltar`, `.barra`, `.marca`, `.nav`, `.portal`, `.hero`, `.hero-in`, `.kicker`, `.hero-texto`, `.miga`, `.cuerpo`, `.cuerpo-flota`, `.tareas`, `.tarea` (con `.tarea--azul|cian|naranja|violeta`, `.tarea-ico`, `.tarea-titulo`, `.tarea-texto`), `.btn`, `.btn-sec`, `.chips`, `.chip`, `.estado-vista`, `.giro`, `.linea-estado`, `.campo`, `.nivel`, `.pie-pagina`, `.campo-oculto`, `.ico`. Las tareas 7 a 11 **agregan** sus secciones al final del archivo; no reescriben lo anterior.

- [ ] **Step 1: Escribir la prueba de contraste que falla**

Crear `tests/test-asesor-stata-contraste.mjs`:

```js
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
```

- [ ] **Step 2: Verificar que falla**

Run: `node tests/test-asesor-stata-contraste.mjs | tail -2`
Expected: error `ENOENT … asesor-stata.css` (el archivo no existe todavía).

- [ ] **Step 3: Crear `asesor-stata.css`**

```css
/* asesor-stata.css — estilo de Asesor Stata (rediseño de octubre de 2026).
   Las variables de color van primero y en hexadecimal puro: la prueba
   tests/test-asesor-stata-contraste.mjs las lee de este bloque. */
:root {
  --marino: #003060;
  --muted: #4a6285;
  --azul: #0075c6;
  --azul-oscuro: #005a9c;
  --cian: #067583;
  --cian-claro: #0899a8;
  --violeta: #7b3ff2;
  --naranja: #c2410c;
  --rojo: #c62828;
  --blanco: #ffffff;
  --superficie: #f5f7fb;
  --tinte-azul: #e6f1fb;
  --tinte-rojo: #ffe9e8;
  --sobre-marino-azul: #bcd9f2;
  --sobre-marino-cian: #7fd6e0;
  --banda-1: #003060;
  --banda-2: #00508f;
  --banda-3: #0a7a9a;
  --marca-linea: #fff4c2;
  --marca-numero: #ffe58f;
  --borde: rgba(0, 48, 96, .12);
  --sombra: 0 8px 22px rgba(0, 48, 96, .12);
  --radio: 14px;
  --radio-sm: 10px;
  --alto-barra: 64px;
  --fuente-titulo: 'Syne', 'Segoe UI', system-ui, sans-serif;
  --fuente-texto: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
  --fuente-codigo: Consolas, 'Courier New', monospace;
}

/* ---------------------------------------------------------------- base */
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0; position: relative; min-height: 100vh;
  font-family: var(--fuente-texto); font-size: 1rem; line-height: 1.55;
  color: var(--marino); background: var(--blanco);
}
h1, h2, h3 { font-family: var(--fuente-titulo); font-weight: 800; letter-spacing: -.02em; line-height: 1.15; margin: 0; }
h2 { font-size: 1.5rem; }
h3 { font-size: 1.1rem; }
p { margin: 0 0 .8rem; }
a { color: var(--azul); }
code { font-family: var(--fuente-codigo); font-size: .88em; background: #eef2f8; border-radius: 4px; padding: .08rem .35rem; }
.campo-oculto { display: none !important; }
.ico { width: 1.15em; height: 1.15em; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.ico-mini { width: .85em; height: .85em; }
:focus-visible { outline: 2px solid var(--azul); outline-offset: 2px; }
.barra :focus-visible, .hero :focus-visible { outline-color: #fff; }

/* ------------------------------------------------- barra superior y banda */
.saltar { position: absolute; left: -999px; top: 0; z-index: 100; background: var(--marino); color: #fff; padding: .7rem 1rem; border-radius: 0 0 var(--radio-sm) 0; }
.saltar:focus { left: 0; }
.barra {
  display: flex; align-items: center; gap: 1rem; min-height: var(--alto-barra); padding: 0 1.25rem;
  background: var(--marino); color: #fff;
}
/* Con una banda debajo, la barra se funde con ella (la banda ya lleva el degradado). */
body.con-hero .barra { position: absolute; inset: 0 0 auto 0; z-index: 5; background: transparent; }
.marca { font-family: var(--fuente-titulo); font-weight: 800; color: #fff; text-decoration: none; white-space: nowrap; }
.marca span { font-family: var(--fuente-texto); font-weight: 500; font-size: .85rem; color: var(--sobre-marino-azul); margin-left: .45rem; }
.nav { display: flex; gap: .25rem; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.nav::-webkit-scrollbar { display: none; }
.nav a {
  display: inline-flex; align-items: center; gap: .4rem; min-height: 44px; padding: 0 .85rem; border-radius: 100px;
  color: var(--sobre-marino-azul); text-decoration: none; font-weight: 700; font-size: .9rem; white-space: nowrap;
  transition: background .15s;
}
.nav a:hover { background: rgba(255, 255, 255, .12); color: #fff; }
.nav a[aria-current="page"] { background: #fff; color: var(--marino); }
.portal { display: inline-flex; align-items: center; gap: .35rem; min-height: 44px; color: var(--sobre-marino-azul); text-decoration: none; font-size: .85rem; white-space: nowrap; }
.portal:hover { color: #fff; }
@media (max-width: 640px) {
  .barra { gap: .5rem; padding: 0 .75rem; }
  .marca span, .portal span { display: none; }
}

.hero {
  background: linear-gradient(135deg, var(--banda-1) 0%, var(--banda-2) 65%, var(--banda-3) 100%);
  color: #fff; padding: calc(var(--alto-barra) + 1.6rem) 1.25rem 4.2rem;
}
.hero-in { max-width: 880px; margin: 0 auto; }
.hero h1 { font-size: clamp(1.9rem, 4.2vw, 2.6rem); color: #fff; outline: none; }
.hero-texto { color: #fff; max-width: 560px; margin: .7rem 0 0; }
.kicker { display: flex; align-items: center; gap: .6rem; margin-bottom: .6rem; color: var(--sobre-marino-cian); font-size: .75rem; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
.kicker::before { content: ''; width: 22px; height: 1px; background: currentColor; }
.miga { display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; margin-bottom: .7rem; font-size: .85rem; font-weight: 700; color: var(--sobre-marino-cian); }
.miga a { color: inherit; text-decoration: none; }
.miga a:hover { text-decoration: underline; }
.cuerpo { max-width: 880px; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; }
.cuerpo-flota { position: relative; margin-top: -3rem; }

/* ----------------------------------------------------------- tarjetas de tarea */
.tareas { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
.tarea {
  --c: var(--azul);
  display: flex; flex-direction: column; gap: .5rem; padding: 1.15rem 1.25rem; background: #fff;
  border: 1px solid var(--borde); border-radius: var(--radio); box-shadow: var(--sombra);
  color: var(--marino); text-decoration: none; transition: transform .18s, box-shadow .18s;
}
.tarea:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(0, 48, 96, .18); }
.tarea--azul { --c: var(--azul); } .tarea--cian { --c: var(--cian); }
.tarea--naranja { --c: var(--naranja); } .tarea--violeta { --c: var(--violeta); }
.tarea-ico { display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: 50%; background: var(--c); color: #fff; }
.tarea-ico .ico { width: 1.3rem; height: 1.3rem; }
.tarea-titulo { font-weight: 700; font-size: 1.08rem; }
.tarea-texto { color: var(--muted); font-size: .9rem; }
@media (max-width: 640px) { .tareas { grid-template-columns: 1fr; } }

/* -------------------------------------------------------- botones y etiquetas */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: .45rem; min-height: 44px; padding: 0 1.3rem;
  border: 2px solid var(--azul); border-radius: 100px; background: var(--azul); color: #fff;
  font: 700 .95rem var(--fuente-texto); text-decoration: none; cursor: pointer;
}
.btn:hover { filter: brightness(.93); }
.btn:disabled { opacity: .55; cursor: wait; }
.btn-sec { background: #fff; color: var(--azul); }
.chips { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .9rem; }
.chip {
  display: inline-flex; align-items: center; gap: .3rem; min-height: 28px; padding: 0 .75rem; border-radius: 100px;
  background: var(--superficie); border: 1px solid var(--borde); color: var(--muted); font-size: .8rem; font-weight: 700; text-decoration: none;
}
.hero .chip { background: rgba(255, 255, 255, .14); border-color: rgba(255, 255, 255, .4); color: #fff; }

/* ------------------------------------------------------------------- estados */
.estado-vista { display: flex; align-items: center; gap: .7rem; padding: 1.4rem; color: var(--muted); }
.estado-vista.error { flex-direction: column; align-items: flex-start; border-radius: var(--radio-sm); background: var(--tinte-rojo); color: var(--rojo); }
.estado-vista.error p { margin: 0; font-weight: 700; }
.giro { flex: 0 0 auto; width: 18px; height: 18px; border: 2px solid var(--borde); border-top-color: var(--azul); border-radius: 50%; animation: giro .8s linear infinite; }
@keyframes giro { to { transform: rotate(360deg); } }
.linea-estado { min-height: 1.4rem; margin-top: .7rem; font-size: .9rem; color: var(--muted); }
.linea-estado.error { color: var(--rojo); font-weight: 700; }
.linea-estado.esperando { display: flex; align-items: center; gap: .6rem; }
.linea-estado.esperando::before { content: ''; flex: 0 0 auto; width: 14px; height: 14px; border: 2px solid var(--borde); border-top-color: var(--azul); border-radius: 50%; animation: giro .8s linear infinite; }

/* ------------------------------------------------------------------ formularios */
.campo {
  display: block; width: 100%; min-height: 44px; padding: .65rem .9rem; border: 1px solid #b8c6d8; border-radius: var(--radio-sm);
  background: #fff; color: var(--marino); font: inherit;
}
textarea.campo { min-height: 110px; resize: vertical; }
.contador { margin-top: .3rem; font-size: .8rem; color: var(--muted); }
.contador.sobre { color: var(--rojo); font-weight: 700; }
.nivel { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem; }
.nivel-rotulo { margin-right: .3rem; font-size: .78rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.nivel-op { position: relative; display: inline-flex; align-items: center; min-height: 44px; padding: 0 1rem; border: 1px solid var(--borde); border-radius: 100px; background: #fff; color: var(--muted); font-weight: 500; cursor: pointer; }
.nivel-op input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.nivel-op:has(input:checked) { background: var(--marino); border-color: var(--marino); color: #fff; font-weight: 700; }
.nivel-op:has(input:focus-visible) { outline: 2px solid var(--azul); outline-offset: 2px; }

/* --------------------------------------------------------------- pie y movimiento */
.pie-pagina { max-width: 880px; margin: 0 auto; padding: 1rem 1.25rem 3rem; border-top: 1px solid var(--borde); color: var(--muted); font-size: .85rem; }
#vista { outline: none; }
#vista.entra { animation: entra .18s ease-out; }
@keyframes entra { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `node tests/test-asesor-stata-contraste.mjs | tail -1`
Expected: `30 pasados, 0 fallidos` (1 de variables, 27 de parejas, 2 de reglas). Si alguna pareja falla, **no** relajar la prueba: ajustar el color en el CSS (y en el spec si cambia un valor documentado) hasta que cumpla.

- [ ] **Step 5: Commit**

```bash
git add asesor-stata.css tests/test-asesor-stata-contraste.mjs
git commit -m "feat(asesor-stata): estilos base con variables de diseño y prueba de contraste AA" -m "Co-Authored-By: <modelo vigente> <noreply@anthropic.com>"
```

---

### Task 7: Estructura base, router, componentes compartidos e Inicio

Primera pantalla visible de la página nueva. Al terminar se puede ver en `asesor-stata-nuevo.html`.

**Files:**
- Create: `asesor-stata-nuevo.html`, `asesor-stata-app.js`, `vistas/inicio.js`
- Modify: `asesor-stata.css` (agregar una sección al final)

**Interfaces:**
- Consumes: del núcleo, `parsearRuta`, `traducirEnlaceViejo`, `separarPorOrigen`, `listarRadar`, `filtrarIndice`.
- Produces: `window.AsesorStata` con
  - `N`: el núcleo; `vistas`: registro `{ nombre: function (ctx) }`; `estado`: `{ partes, cargaIndice, borrador: { codigo, descripcion, salida } }`; `avisoPendiente`: texto de un aviso para mostrar una vez en Inicio.
  - `cargarIndice()` → `Promise<partes>` con `partes = { guias, radar }` (resultado de `separarPorOrigen`); se pide una sola vez; si falla, la promesa se rechaza con un `Error` (con `.amigable = true` si el mensaje viene del servidor) y la siguiente llamada vuelve a intentar.
  - `recargarVista()` → vuelve a dibujar la pantalla actual.
  - `mensajeDeIndice(e)` → texto para mostrar cuando falla la carga del índice.
  - `rutaDeNota(path)` → `'#/aprender/…'` o `'#/radar/…'` si la nota existe; `null` si no (nunca un enlace roto).
  - `ui`: `h(tag, props, ...hijos)`, `icono(nombre, clase)`, `hero({ kicker, titulo, texto, miga, extra })`, `tarjetaTarea({ href, tono, icono, titulo, texto })`, `estadoCarga(texto)`, `estadoError(mensaje, reintentar)`, `estadoVacio(titulo, texto, accion)`, `avisoPrivacidad()`, `copiarTexto(texto, boton, etiqueta, elemento)`, `descargarArchivo(contenido, nombre, tipo)`, `hoyIso()`, `pedirJson(url, cuerpo, ms)`, `mensajeDeFallo(e)`, `iniciarEspera(el, frases, avisoLargo)` → función que detiene, `estadoLinea(el, tipo, texto)`, `enlazarContador(area, contador, max, textoSobre)`, `leerArchivoComoTexto(archivo)`, `agregarBarraCopiar(pre, rotulo)`, `bloqueCodigo(codigo, rotulo)`, `selectorNivel()` → `{ el, valor() }`, `leerGuardado(clave)`, `escribirGuardado(clave, valor)`.
  - Contrato de una vista: `A.vistas.<nombre> = function (ctx) {}` con `ctx = { ruta, montar(nodo, meta), activo(), cuando(promesa, ok, mal), restaurarScroll() }`. `meta = { titulo, seccion, inicio }`, donde `seccion` es `'aprender' | 'preguntar' | 'codigo' | 'resultados' | 'radar' | null`. `montar`, `restaurarScroll` y los callbacks de `cuando` **no hacen nada** si el usuario ya cambió de pantalla (Review Focus 1). `A.estado.preguntaInicial` (texto) lo deja Aprender para que Preguntar lo muestre precargado una sola vez.

- [ ] **Step 1: Crear la estructura base `asesor-stata-nuevo.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Asesor Stata — DolphinStats</title>
<meta name="robots" content="noindex, nofollow">
<link rel="preload" href="fonts/dm-sans-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/syne-800.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="fonts/fonts.css">
<link rel="stylesheet" href="asesor-stata.css">
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <symbol id="i-libro" viewBox="0 0 24 24"><path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"/></symbol>
  <symbol id="i-chat" viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/></symbol>
  <symbol id="i-codigo" viewBox="0 0 24 24"><path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13 6l-2 12"/></symbol>
  <symbol id="i-grafico" viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></symbol>
  <symbol id="i-estrella" viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></symbol>
  <symbol id="i-flecha-der" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
  <symbol id="i-flecha-izq" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></symbol>
  <symbol id="i-copiar" viewBox="0 0 24 24"><path d="M9 9h11v11H9zM5 15V5h10"/></symbol>
  <symbol id="i-descargar" viewBox="0 0 24 24"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></symbol>
  <symbol id="i-subir" viewBox="0 0 24 24"><path d="M12 20V9M7 13l5-5 5 5M5 4h14"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></symbol>
  <symbol id="i-alerta" viewBox="0 0 24 24"><path d="M12 3l10 18H2zM12 10v5M12 18h.01"/></symbol>
  <symbol id="i-buscar" viewBox="0 0 24 24"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5"/></symbol>
  <symbol id="i-externo" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></symbol>
  <symbol id="i-lapiz" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></symbol>
</svg>

<a class="saltar" href="#vista">Saltar al contenido</a>
<header class="barra">
  <a class="marca" href="#/">DolphinStats<span>Asesor Stata</span></a>
  <nav class="nav" aria-label="Secciones de Asesor Stata">
    <a href="#/aprender" data-seccion="aprender"><svg class="ico" aria-hidden="true"><use href="#i-libro"/></svg>Aprender</a>
    <a href="#/preguntar" data-seccion="preguntar"><svg class="ico" aria-hidden="true"><use href="#i-chat"/></svg>Preguntar</a>
    <a href="#/codigo/revisar" data-seccion="codigo"><svg class="ico" aria-hidden="true"><use href="#i-codigo"/></svg>Código</a>
    <a href="#/resultados" data-seccion="resultados"><svg class="ico" aria-hidden="true"><use href="#i-grafico"/></svg>Resultados</a>
    <a href="#/radar" data-seccion="radar"><svg class="ico" aria-hidden="true"><use href="#i-estrella"/></svg>Radar</a>
  </nav>
  <a class="portal" href="/"><svg class="ico" aria-hidden="true"><use href="#i-flecha-izq"/></svg><span>Portal</span></a>
</header>

<main id="vista" tabindex="-1"></main>

<footer class="pie-pagina">
  <p>Las respuestas de Preguntar, Revisar, Explicar, Generar e Interpretar las produce una inteligencia artificial y puede equivocarse: confirma lo importante en la documentación de Stata o con tu asesor.</p>
</footer>
<noscript><p style="padding:1rem">Asesor Stata necesita JavaScript para funcionar.</p></noscript>

<script src="asesor-stata-nucleo.js"></script>
<script src="asesor-stata-app.js"></script>
<script src="vistas/inicio.js"></script>
</body>
</html>
```

(Las tareas siguientes agregan sus `<script src="vistas/….js">` justo antes de `</body>`.)

- [ ] **Step 2: Crear el núcleo de la interfaz `asesor-stata-app.js`**

```js
/* asesor-stata-app.js — núcleo de la interfaz de Asesor Stata: ayudantes de DOM,
 * índice de notas, router por # y componentes compartidos. Cada pantalla vive en
 * vistas/*.js y se registra en AsesorStata.vistas. Usa AsesorStataNucleo (funciones
 * puras, probadas con node). */
(function () {
  'use strict';

  var N = window.AsesorStataNucleo;
  var A = window.AsesorStata = {
    N: N, vistas: {}, ui: {}, avisoPendiente: null,
    estado: { partes: null, cargaIndice: null, preguntaInicial: '', borrador: { codigo: '', descripcion: '', salida: '' } },
  };
  var u = A.ui;
  var CLAVE_NIVEL = 'asesor-stata-nivel';
  var SVG_NS = 'http://www.w3.org/2000/svg';

  // ------------------------------------------------------------------- DOM

  // h('div', { class: 'x', onclick: fn }, 'texto', otroNodo, [lista]). Los textos
  // se insertan como texto (nunca como HTML); `html` solo para HTML ya escapado
  // (la salida del conversor de Markdown del núcleo).
  function h(tag, props) {
    var el = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (function agregar(lista) {
      lista.forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        if (Array.isArray(c)) { agregar(c); return; }
        el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    })(Array.prototype.slice.call(arguments, 2));
    return el;
  }
  u.h = h;

  u.icono = function (nombre, clase) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'ico' + (clase ? ' ' + clase : ''));
    svg.setAttribute('aria-hidden', 'true');
    var uso = document.createElementNS(SVG_NS, 'use');
    uso.setAttribute('href', '#i-' + nombre);
    svg.appendChild(uso);
    return svg;
  };

  u.hero = function (o) {
    return h('section', { class: 'hero' }, h('div', { class: 'hero-in' },
      o.miga || null,
      o.kicker ? h('div', { class: 'kicker' }, o.kicker) : null,
      h('h1', null, o.titulo),
      o.texto ? h('p', { class: 'hero-texto' }, o.texto) : null,
      o.extra || null));
  };

  u.tarjetaTarea = function (o) {
    return h('a', { class: 'tarea tarea--' + o.tono, href: o.href },
      h('span', { class: 'tarea-ico' }, u.icono(o.icono)),
      h('span', { class: 'tarea-titulo' }, o.titulo),
      h('span', { class: 'tarea-texto' }, o.texto));
  };

  u.estadoCarga = function (texto) {
    return h('div', { class: 'estado-vista', role: 'status' }, h('span', { class: 'giro', 'aria-hidden': 'true' }), texto || 'Cargando…');
  };

  u.estadoError = function (mensaje, reintentar) {
    return h('div', { class: 'estado-vista error', role: 'alert' }, u.icono('alerta'), h('p', null, mensaje),
      reintentar ? h('button', { type: 'button', class: 'btn btn-sec', onclick: reintentar }, 'Reintentar') : null);
  };

  u.estadoVacio = function (titulo, texto, accion) {
    return h('div', { class: 'estado-vista vacio' }, h('div', null, h('p', { class: 'vacio-titulo' }, titulo), texto ? h('p', null, texto) : null, accion || null));
  };

  // Aviso de privacidad de las pantallas que mandan texto del usuario a un servicio de IA externo.
  u.avisoPrivacidad = function () {
    return h('p', { class: 'aviso' }, 'Tu texto se envía a un servicio de inteligencia artificial externo para analizarlo. ',
      h('strong', null, 'No pegues datos de pacientes ni información que permita identificar a alguien'),
      ' (si pegas salidas de Stata, quita los listados de personas). No se ejecuta nada en Stata: verifica el resultado antes de usarlo.');
  };

  // ------------------------------------------------------- almacenamiento

  u.leerGuardado = function (clave) {
    try { return window.localStorage.getItem(clave); } catch (e) { return null; }
  };
  u.escribirGuardado = function (clave, valor) {
    try { window.localStorage.setItem(clave, valor); } catch (e) { /* sin almacenamiento: no pasa nada */ }
  };

  // Nivel de la respuesta (básico / intermedio / avanzado), recordado entre pantallas y visitas.
  var contadorNivel = 0;
  u.selectorNivel = function () {
    var nombre = 'nivel-' + (++contadorNivel);
    var guardado = u.leerGuardado(CLAVE_NIVEL);
    var actual = ['basico', 'intermedio', 'avanzado'].indexOf(guardado) !== -1 ? guardado : 'intermedio';
    var el = h('div', { class: 'nivel', role: 'radiogroup', 'aria-label': 'Nivel de la respuesta' },
      h('span', { class: 'nivel-rotulo' }, 'Nivel'),
      [['basico', 'Básico'], ['intermedio', 'Intermedio'], ['avanzado', 'Avanzado']].map(function (o) {
        var entrada = h('input', { type: 'radio', name: nombre, value: o[0] });
        if (o[0] === actual) entrada.checked = true;
        entrada.addEventListener('change', function () { u.escribirGuardado(CLAVE_NIVEL, o[0]); });
        return h('label', { class: 'nivel-op' }, entrada, h('span', null, o[1]));
      }));
    return { el: el, valor: function () { var c = el.querySelector('input:checked'); return c ? c.value : 'intermedio'; } };
  };

  // ------------------------------------------------ copiar, descargar, archivos

  // Si el navegador no deja copiar, deja `elemento` seleccionado para usar Ctrl+C.
  u.copiarTexto = function (texto, boton, etiqueta, elemento) {
    function listo() {
      boton.textContent = '¡Copiado!';
      setTimeout(function () { boton.textContent = etiqueta; }, 1600);
    }
    function alternativa() {
      var area = document.createElement('textarea');
      area.value = texto;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(area);
      if (ok) { listo(); return; }
      if (elemento) {
        var rango = document.createRange();
        rango.selectNodeContents(elemento);
        var seleccion = window.getSelection();
        seleccion.removeAllRanges();
        seleccion.addRange(rango);
      }
      boton.textContent = 'Usa Ctrl+C';
      setTimeout(function () { boton.textContent = etiqueta; }, 3000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(listo, alternativa);
    else alternativa();
  };

  u.descargarArchivo = function (contenido, nombre, tipo) {
    var url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    var a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  u.hoyIso = function () {
    var d = new Date();
    function dos(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
  };

  // Los .do viejos pueden venir en Latin-1: si no es UTF-8 válido, se lee así.
  u.leerArchivoComoTexto = function (archivo) {
    return archivo.arrayBuffer().then(function (buffer) {
      try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
      catch (e) { return new TextDecoder('windows-1252').decode(buffer); }
    });
  };

  // Inserta sobre un <pre> una barra con el rótulo y un botón «Copiar».
  u.agregarBarraCopiar = function (pre, rotulo) {
    var boton = h('button', { type: 'button', class: 'btn btn-sec' }, 'Copiar');
    boton.addEventListener('click', function () { u.copiarTexto(pre.textContent, boton, 'Copiar', pre); });
    pre.parentNode.insertBefore(h('div', { class: 'bloque-barra' }, h('span', null, rotulo), boton), pre);
  };

  u.bloqueCodigo = function (codigo, rotulo) {
    var pre = h('pre', { class: 'bloque-codigo' }, h('code', null, codigo));
    var envoltura = h('div', { class: 'bloque' }, pre);
    u.agregarBarraCopiar(pre, rotulo);
    return envoltura;
  };

  // --------------------------------------------- pedidos al servidor y esperas

  u.pedirJson = function (url, cuerpo, ms) {
    var controlador = new AbortController();
    var corte = setTimeout(function () { controlador.abort(); }, ms);
    return fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: controlador.signal,
    })
      .then(function (res) {
        return res.json()
          .catch(function () { return { error: 'El servidor no respondió correctamente. Intenta de nuevo en un momento.' }; })
          .then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (r) { clearTimeout(corte); return r; }, function (e) { clearTimeout(corte); throw e; });
  };

  u.mensajeDeFallo = function (e) {
    if (e && e.name === 'AbortError') return 'Tardó demasiado en responder. Prueba con un texto más corto o intenta de nuevo.';
    return 'No se pudo completar el pedido. Revisa tu conexión e intenta de nuevo.';
  };

  u.estadoLinea = function (el, tipo, texto) {
    el.className = 'linea-estado' + (tipo ? ' ' + tipo : '');
    el.textContent = texto;
  };

  // Texto de espera que avanza solo (con los segundos transcurridos) para que una
  // respuesta lenta no parezca un cuelgue. Devuelve la función que lo detiene.
  u.iniciarEspera = function (el, frases, avisoLargo) {
    var inicio = Date.now();
    function pintar() {
      var seg = Math.floor((Date.now() - inicio) / 1000);
      var frase = frases[Math.min(Math.floor(seg / 7), frases.length - 1)];
      var extra = avisoLargo && seg >= 10 ? ' · los textos largos pueden tardar hasta 30 s' : '';
      u.estadoLinea(el, 'esperando', frase + ' (' + seg + ' s)' + extra);
    }
    pintar();
    var id = setInterval(pintar, 1000);
    return function () { clearInterval(id); };
  };

  u.enlazarContador = function (area, contador, max, textoSobre) {
    function actualizar() {
      var n = area.value.length;
      var sobre = n > max;
      contador.textContent = n.toLocaleString('es-PE') + ' / ' + max.toLocaleString('es-PE') + ' caracteres' + (sobre ? ' — ' + textoSobre : '');
      contador.classList.toggle('sobre', sobre);
    }
    area.addEventListener('input', actualizar);
    actualizar();
    return actualizar;
  };

  // ------------------------------------------------------------------ índice

  function errorDeIndice(mensaje, amigable) {
    var e = new Error(mensaje);
    e.amigable = !!amigable;
    return e;
  }

  // Se pide una sola vez; si falla, la próxima llamada vuelve a intentar.
  A.cargarIndice = function () {
    if (A.estado.cargaIndice) return A.estado.cargaIndice;
    A.estado.cargaIndice = fetch('/api/asesor-stata-base')
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (!r.ok) throw errorDeIndice(r.data.error || 'No se pudo cargar el índice.', true);
        A.estado.partes = N.separarPorOrigen(r.data);
        return A.estado.partes;
      })
      .catch(function (e) {
        A.estado.cargaIndice = null;
        throw e.amigable ? e : errorDeIndice('No se pudo cargar el índice. Revisa tu conexión e intenta de nuevo.', false);
      });
    return A.estado.cargaIndice;
  };

  A.mensajeDeIndice = function (e) {
    return e && e.message ? e.message : 'No se pudo cargar el índice. Revisa tu conexión e intenta de nuevo.';
  };

  // Ruta de una nota que cita el modelo, o null si no existe: el modelo puede inventar rutas,
  // y una nota inexistente no debe convertirse en un enlace roto. Sin índice (falló la carga),
  // se acepta cualquier ruta con la forma de una nota.
  A.rutaDeNota = function (path) {
    var partes = A.estado.partes;
    if (partes) return N.existeNota(path, partes) ? N.rutaDeNota(path, partes) : null;
    return /^knowledge\/[a-z0-9-]+\/[a-z0-9-]+\.md$/.test(String(path)) ? N.construirRuta({ vista: 'guia', origen: 'aprender', path: path }) : null;
  };

  // ------------------------------------------------------------------ router

  var raiz = null;
  var tokenActual = 0;
  var hashActual = '#/';
  var posiciones = {};

  function actualizarNav(seccion) {
    Array.prototype.forEach.call(document.querySelectorAll('.nav a[data-seccion]'), function (a) {
      if (a.getAttribute('data-seccion') === seccion) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function montar(token, nodo, meta) {
    if (token !== tokenActual) return; // el usuario ya cambió de pantalla
    meta = meta || {};
    raiz.replaceChildren(nodo);
    document.body.classList.toggle('con-hero', !!raiz.querySelector('.hero'));
    raiz.classList.remove('entra');
    void raiz.offsetWidth;
    raiz.classList.add('entra');
    document.title = meta.inicio ? 'Asesor Stata — DolphinStats' : (meta.titulo || 'Asesor Stata') + ' · Asesor Stata · DolphinStats';
    actualizarNav(meta.seccion || null);
    window.scrollTo(0, 0);
    var titulo = raiz.querySelector('h1');
    if (titulo) { titulo.setAttribute('tabindex', '-1'); titulo.focus({ preventScroll: true }); }
  }

  function reemplazarHash(nuevo) {
    history.replaceState(null, '', location.pathname + location.search + nuevo);
  }

  function traducirEnlaceAntiguo(ctx, hash) {
    ctx.montar(u.estadoCarga('Abriendo la nota…'), { titulo: 'Abriendo la nota' });
    ctx.cuando(A.cargarIndice(), function (partes) {
      var nueva = N.traducirEnlaceViejo(hash, partes);
      if (!nueva) A.avisoPendiente = 'No encontramos esa nota. Puede que se haya movido o renombrado.';
      reemplazarHash(nueva || '#/');
      navegar();
    }, function (e) {
      ctx.montar(h('div', { class: 'cuerpo' }, u.estadoError(A.mensajeDeIndice(e), navegar)), { titulo: 'No se pudo abrir' });
    });
  }

  function navegar() {
    posiciones[hashActual] = window.scrollY;
    var token = ++tokenActual;
    var hash = location.hash;
    var ruta = N.parsearRuta(hash);
    if (ruta.desconocida && hash && hash !== '#' && hash !== '#/') {
      A.avisoPendiente = 'No encontramos esa dirección; te llevamos al inicio.';
      reemplazarHash('#/');
      hash = '#/';
      ruta = { vista: 'inicio' };
    }
    hashActual = hash || '#/';
    var ctx = {
      ruta: ruta,
      montar: function (nodo, meta) { montar(token, nodo, meta); },
      activo: function () { return token === tokenActual; },
      // Para las listas largas: cuando ya tienen sus datos, vuelven a donde estaba el usuario
      // la última vez que salió de esta misma dirección (por ejemplo, al usar el botón atrás).
      restaurarScroll: function () {
        if (token === tokenActual && posiciones[hash || '#/']) window.scrollTo(0, posiciones[hash || '#/']);
      },
      cuando: function (promesa, ok, mal) {
        promesa.then(
          function (v) { if (token === tokenActual && ok) ok(v); },
          function (e) { if (token === tokenActual && mal) mal(e); });
      },
    };
    if (ruta.vista === 'enlace-antiguo') { traducirEnlaceAntiguo(ctx, hash); return; }
    var vista = A.vistas[ruta.vista];
    if (!vista) {
      ctx.montar(h('div', { class: 'cuerpo' }, u.estadoVacio('Esta pantalla no está disponible.', null, h('a', { class: 'btn', href: '#/' }, 'Ir al inicio'))), { titulo: 'No disponible' });
      return;
    }
    vista(ctx);
  }
  A.recargarVista = navegar;

  function arrancar() {
    raiz = document.getElementById('vista');
    // El enlace «Saltar al contenido» no puede cambiar el hash (es la ruta): solo mueve el foco.
    document.querySelector('.saltar').addEventListener('click', function (e) { e.preventDefault(); raiz.focus(); });
    window.addEventListener('hashchange', navegar);
    navegar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
```

- [ ] **Step 3: Crear la pantalla de Inicio `vistas/inicio.js`**

```js
/* vistas/inicio.js — pantalla de bienvenida: cuatro tareas y una franja con lo último del Radar. */
(function () {
  'use strict';
  var A = window.AsesorStata;
  var N = A.N;
  var u = A.ui;
  var h = u.h;

  A.vistas.inicio = function (ctx) {
    var aviso = A.avisoPendiente;
    A.avisoPendiente = null;

    var tarjetaAprender = u.tarjetaTarea({ href: '#/aprender', tono: 'azul', icono: 'libro', titulo: 'Aprender Stata',
      texto: 'Guías cortas con ejemplos para copiar. Empieza por el tour rápido.' });
    var textoAprender = tarjetaAprender.querySelector('.tarea-texto');

    var franja = h('div', { class: 'franja-radar campo-oculto', 'aria-live': 'polite' });

    var nodo = h('div', null,
      u.hero({
        kicker: 'Asesor Stata', titulo: '¿Qué necesitas hoy?',
        texto: 'Guías con ejemplos, respuestas de tu base de notas y ayuda con tu código de Stata.',
      }),
      h('div', { class: 'cuerpo cuerpo-flota' },
        aviso ? h('p', { class: 'aviso-vista', role: 'status' }, aviso) : null,
        h('div', { class: 'tareas' },
          tarjetaAprender,
          u.tarjetaTarea({ href: '#/preguntar', tono: 'cian', icono: 'chat', titulo: 'Preguntar a las notas',
            texto: 'Una respuesta basada solo en tu base de notas, con las notas citadas.' }),
          u.tarjetaTarea({ href: '#/codigo/revisar', tono: 'naranja', icono: 'codigo', titulo: 'Trabajar con mi código',
            texto: 'Revisa errores con su línea, entiende un do-file paso a paso o genera uno nuevo.' }),
          u.tarjetaTarea({ href: '#/resultados', tono: 'violeta', icono: 'grafico', titulo: 'Entender mis resultados',
            texto: 'Pega la salida de Stata y te explico qué dice, sin inventar números.' })),
        franja));

    ctx.montar(nodo, { titulo: 'Asesor Stata', inicio: true });

    // El Inicio no depende del índice: las cuatro tarjetas funcionan aunque falle.
    ctx.cuando(A.cargarIndice(), function (partes) {
      var guias = partes.guias.temas.reduce(function (n, t) { return n + t.notas.length; }, 0);
      if (guias) textoAprender.textContent = guias + ' guías cortas con ejemplos para copiar. Empieza por el tour rápido.';
      var lista = N.listarRadar(partes.radar, '');
      if (!lista.length) return;
      var ultima = lista[0];
      var resumen = ultima.simple || ultima.resumen;
      franja.classList.remove('campo-oculto');
      franja.appendChild(h('div', { class: 'franja-texto' },
        h('strong', null, 'Radar de la semana: ' + lista.length + ' notas del monitoreo. '),
        'Lo último: ' + ultima.titulo.split(':')[0] + (resumen ? ' — ' + (resumen.length > 110 ? resumen.slice(0, 107) + '…' : resumen) : '')));
      franja.appendChild(h('a', { class: 'franja-enlace', href: '#/radar' }, 'Ver el Radar', u.icono('flecha-der')));
    }, function () { /* sin índice no hay franja; el resto del Inicio sigue usable */ });
  };
})();
```

- [ ] **Step 4: Agregar los estilos de Inicio al final de `asesor-stata.css`**

```css

/* ---------------------------------------------------------------- Inicio */
.aviso-vista { margin: 0 0 1rem; padding: .8rem 1rem; border-radius: var(--radio-sm); background: var(--tinte-azul); color: var(--marino); font-weight: 700; box-shadow: var(--sombra); }
.franja-radar {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
  margin-top: 1rem; padding: .9rem 1.1rem; border-radius: var(--radio); background: var(--superficie); border: 1px solid var(--borde);
}
.franja-texto { color: var(--muted); font-size: .92rem; flex: 1 1 320px; }
.franja-texto strong { color: var(--marino); }
.franja-enlace { display: inline-flex; align-items: center; gap: .4rem; min-height: 44px; font-weight: 700; text-decoration: none; color: var(--azul); }
.franja-enlace:hover { text-decoration: underline; }
```

- [ ] **Step 5: Verificar la pantalla de Inicio en el navegador (con la política de producción)**

Levantar `node $SERVIDOR --puerto=8792 --csp`, abrir `http://localhost:8792/asesor-stata-nuevo.html` y ejecutar en la página:

```js
await new Promise(r => setTimeout(r, 2000));
const $ = s => document.querySelector(s);
({
  titulo: document.title,
  h1: $('h1').textContent,
  tarjetas: [...document.querySelectorAll('.tarea .tarea-titulo')].map(e => e.textContent),
  enlaces: [...document.querySelectorAll('.tarea')].map(a => a.getAttribute('href')),
  textoAprender: $('.tarea .tarea-texto').textContent,
  franja: $('.franja-radar').textContent.slice(0, 55),
  foco: document.activeElement === $('h1'),
  barra: getComputedStyle($('.barra')).position,
  navActivo: document.querySelectorAll('.nav a[aria-current]').length,
  fuentesRegistradas: [...document.fonts].map(f => f.family + ' ' + f.weight + ' ' + f.status).sort(),
  anchoSyne: (() => { const c = document.createElement('canvas').getContext('2d'); c.font = '800 40px Syne, sans-serif'; const a = c.measureText('¿Qué necesitas hoy?').width; c.font = '800 40px sans-serif'; return a !== c.measureText('¿Qué necesitas hoy?').width; })(),
  desborde: document.documentElement.scrollWidth > innerWidth,
})
```
Expected:
- `titulo: 'Asesor Stata — DolphinStats'`, `h1: '¿Qué necesitas hoy?'`.
- `tarjetas: ['Aprender Stata', 'Preguntar a las notas', 'Trabajar con mi código', 'Entender mis resultados']`.
- `enlaces: ['#/aprender', '#/preguntar', '#/codigo/revisar', '#/resultados']`.
- `textoAprender` empieza con `23 guías cortas con ejemplos`.
- `franja` empieza con `Radar de la semana: 28 notas del monitoreo.`.
- `foco: true`, `barra: 'absolute'`, `navActivo: 0` (Inicio no resalta ninguna sección).
- `fuentesRegistradas`: las cinco caras (`DM Sans 400/500/700`, `Syne 700/800`) **registradas con la política de producción** (antes de este rediseño eran 0) y al menos `DM Sans 400` y `Syne 800` en estado `loaded`; `anchoSyne: true`.
- `desborde: false`.

Luego en la barra de direcciones probar el enlace antiguo válido:
`http://localhost:8792/asesor-stata-nuevo.html#nota=knowledge%2Fstata-basics%2Ftour-rapido-interfaz-flujo-trabajo.md` y ejecutar `location.hash`.
Expected: `'#/aprender/stata-basics/tour-rapido-interfaz-flujo-trabajo'` (reescrito, sin añadir historial; la pantalla muestra «Esta pantalla no está disponible» porque la guía se construye en la Tarea 8).

Y un enlace antiguo roto: `…#nota=knowledge%2Fstata-basics%2Fno-existe.md` → ejecutar
`({ hash: location.hash, aviso: document.querySelector('.aviso-vista')?.textContent })`.
Expected: `{ hash: '#/', aviso: 'No encontramos esa nota. Puede que se haya movido o renombrado.' }`. Revisar que la consola no tenga errores y cerrar el servidor.

- [ ] **Step 6: Verificar que ninguna prueba existente se rompió**

```bash
for t in tests/test-asesor-stata-markdown.mjs tests/test-asesor-stata-navegacion.mjs tests/test-asesor-stata-fuentes.mjs tests/test-asesor-stata-contraste.mjs; do printf "%-46s" "$t"; node $t | tail -1; done
```
Expected: `35`, `24`, `4` y `30 pasados`, todos con `0 fallidos`.

- [ ] **Step 7: Commit y subir la rama (fin de la etapa 1)**

```bash
git add asesor-stata-nuevo.html asesor-stata-app.js vistas/inicio.js asesor-stata.css
git commit -m "feat(asesor-stata): estructura base, router y pantalla de Inicio del rediseño" -m "Co-Authored-By: <modelo vigente> <noreply@anthropic.com>"
git push -u origin rediseno-asesor-stata
```
Si la subida está autorizada (Tarea 0). Avisar al usuario de la dirección de la vista previa de Vercel si la hay (`/asesor-stata-nuevo.html`).

---
### Task 8: Aprender y Guía

**Files:**
- Create: `vistas/aprender.js`, `vistas/guia.js`
- Modify: `asesor-stata-nuevo.html` (dos `<script>`), `asesor-stata.css` (sección al final)

**Interfaces:**
- Consumes: `A.ui` (`h`, `icono`, `hero`, `estadoCarga`, `estadoError`, `estadoVacio`, `copiarTexto`, `agregarBarraCopiar`), `A.cargarIndice()`, `A.mensajeDeIndice(e)`, `A.recargarVista()`, `A.estado.preguntaInicial`, contrato de vista (`ctx.montar`, `ctx.cuando`, `ctx.restaurarScroll`); del núcleo `filtrarIndice`, `construirRuta`, `parsearFrontmatter`, `separarSecciones`, `cuerpoMarkdownAHtml`, `vecinosDeGuia`, `nombreTema`, `etiquetaFuente`.
- Produces: `A.vistas.aprender` (ruta `#/aprender`) y `A.vistas.guia` (rutas `#/aprender/<tema>/<guía>` y `#/radar/<tema>/<nota>`). Clases de estilo reutilizadas por la Tarea 9: `.busca`, `.busca-campo`, `.busca-conteo`, `.guias`, `.guia-card`, `.guia-titulo`, `.guia-resumen`, `.insignia`.

- [ ] **Step 1: Crear `vistas/aprender.js`**

```js
/* vistas/aprender.js — lista de guías por tema, con filtro. */
(function () {
  'use strict';
  var A = window.AsesorStata;
  var N = A.N;
  var u = A.ui;
  var h = u.h;
  // La guía por la que se recomienda empezar.
  var EMPIEZA_AQUI = 'knowledge/stata-basics/tour-rapido-interfaz-flujo-trabajo.md';

  function total(lista) { return lista.temas.reduce(function (n, t) { return n + t.notas.length; }, 0); }
  function enlaceGuia(path) { return N.construirRuta({ vista: 'guia', origen: 'aprender', path: path }); }

  function tarjetaGuia(n) {
    return h('a', { class: 'guia-card', href: enlaceGuia(n.path) },
      h('span', { class: 'guia-titulo' }, n.titulo),
      n.resumen ? h('span', { class: 'guia-resumen' }, n.resumen) : null);
  }

  function destacada(partes) {
    var nota = null;
    partes.guias.temas.forEach(function (t) { t.notas.forEach(function (n) { if (n.path === EMPIEZA_AQUI) nota = n; }); });
    if (!nota) return null;
    return h('a', { class: 'destacada', href: enlaceGuia(nota.path) },
      h('span', { class: 'insignia' }, 'Empieza aquí'),
      h('span', { class: 'destacada-titulo' }, nota.titulo),
      nota.resumen ? h('span', { class: 'destacada-resumen' }, nota.resumen) : null);
  }

  function pintar(ctx, partes, cuerpo, entrada, conteo) {
    function dibujar() {
      var texto = entrada.value.trim();
      var temas = N.filtrarIndice(partes.guias, texto);
      var totalGuias = total(partes.guias);
      conteo.textContent = texto
        ? total({ temas: temas }) + ' de ' + totalGuias + ' guías'
        : totalGuias + ' guías en ' + temas.length + ' temas';
      cuerpo.replaceChildren();
      if (!totalGuias) {
        cuerpo.appendChild(u.estadoVacio('Todavía no hay guías publicadas.', 'Mientras tanto puedes mirar el Radar.',
          h('a', { class: 'btn', href: '#/radar' }, 'Ir al Radar')));
        return;
      }
      if (!texto) { var d = destacada(partes); if (d) cuerpo.appendChild(d); }
      if (!temas.length) {
        cuerpo.appendChild(u.estadoVacio('Ninguna guía coincide con «' + texto + '».', 'Prueba con otra palabra o pregúntalo directamente.',
          h('button', { type: 'button', class: 'btn', onclick: function () {
            A.estado.preguntaInicial = texto.slice(0, 500);
            location.hash = '#/preguntar';
          } }, 'Preguntar esto')));
        return;
      }
      temas.forEach(function (t, i) {
        var det = h('details', { class: 'tema' },
          h('summary', null, h('span', null, t.nombre), h('span', { class: 'tema-conteo' }, String(t.notas.length))),
          h('div', { class: 'guias' }, t.notas.map(tarjetaGuia)));
        det.open = texto ? true : i === 0; // con filtro se abren todos; sin filtro, solo el primero
        cuerpo.appendChild(det);
      });
    }
    entrada.addEventListener('input', dibujar);
    dibujar();
    ctx.restaurarScroll();
  }

  A.vistas.aprender = function (ctx) {
    var entrada = h('input', { type: 'search', class: 'busca-campo', placeholder: 'Filtrar guías por palabra…',
      'aria-label': 'Filtrar guías por palabra', autocomplete: 'off' });
    var conteo = h('span', { class: 'busca-conteo', 'aria-live': 'polite' });
    var cuerpo = h('div', { class: 'cuerpo' }, u.estadoCarga('Cargando las guías…'));
    ctx.montar(h('div', null,
      u.hero({
        kicker: 'Aprender', titulo: 'Aprender Stata',
        texto: 'Guías cortas, ordenadas para aprender. Cada una explica la idea en simple y trae un ejemplo para copiar.',
        extra: h('div', { class: 'busca' }, u.icono('buscar'), entrada, conteo),
      }), cuerpo), { titulo: 'Aprender', seccion: 'aprender' });
    ctx.cuando(A.cargarIndice(),
      function (partes) { pintar(ctx, partes, cuerpo, entrada, conteo); },
      function (e) { cuerpo.replaceChildren(u.estadoError(A.mensajeDeIndice(e), A.recargarVista)); });
  };
})();
```

- [ ] **Step 2: Crear `vistas/guia.js`**

```js
/* vistas/guia.js — lectura de una guía (o de una nota del Radar) como artículo:
   «En simple», ejemplo, resumen técnico y, al final, la guía anterior y la siguiente. */
(function () {
  'use strict';
  var A = window.AsesorStata;
  var N = A.N;
  var u = A.ui;
  var h = u.h;
  var CLAVES_CONOCIDAS = ['resumen', 'en simple', 'ejemplo', 'relevancia para dolphinstats'];

  function pedirNota(path) {
    return fetch('/api/asesor-stata-base?nota=' + encodeURIComponent(path))
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, estado: res.status, data: data }; }); })
      .then(function (r) {
        if (!r.ok) { var e = new Error(r.data.error || 'No se pudo cargar la nota.'); e.estado = r.estado; throw e; }
        return r.data.markdown;
      });
  }

  function chipFuente(meta) {
    var etiqueta = N.etiquetaFuente(meta.source);
    if (/^https?:\/\//.test(meta.source_url || '')) {
      return h('a', { class: 'chip chip-enlace', href: meta.source_url, target: '_blank', rel: 'noopener noreferrer' },
        etiqueta + ' · ver fuente', u.icono('externo', 'ico-mini'));
    }
    return h('span', { class: 'chip' }, etiqueta);
  }

  function seccion(titulo, html) {
    return h('section', { class: 'seccion' }, h('h2', null, titulo), h('div', { class: 'texto-md', html: html }));
  }

  // Orden de lectura: En simple, Ejemplo, Resumen técnico, otras secciones y, al final
  // y plegada, la relevancia para DolphinStats (nota interna del equipo).
  function articulo(secciones) {
    var por = function (clave) { return secciones.filter(function (s) { return s.clave === clave; })[0] || null; };
    var art = h('article', { class: 'articulo' });
    var simple = por('en simple');
    if (simple && simple.cuerpo) {
      art.appendChild(h('aside', { class: 'callout' }, h('div', { class: 'callout-rotulo' }, 'En simple'),
        h('div', { class: 'texto-md', html: N.cuerpoMarkdownAHtml(simple.cuerpo) })));
    }
    var ejemplo = por('ejemplo');
    if (ejemplo && ejemplo.cuerpo) {
      var bloqueEjemplo = seccion('Ejemplo', N.cuerpoMarkdownAHtml(ejemplo.cuerpo));
      Array.prototype.forEach.call(bloqueEjemplo.querySelectorAll('pre.bloque-codigo'), function (pre) { u.agregarBarraCopiar(pre, 'Código Stata'); });
      art.appendChild(bloqueEjemplo);
    }
    var resumen = por('resumen');
    if (resumen && resumen.cuerpo) art.appendChild(seccion('Resumen técnico', N.cuerpoMarkdownAHtml(resumen.cuerpo)));
    secciones.forEach(function (s) {
      if (CLAVES_CONOCIDAS.indexOf(s.clave) === -1 && s.cuerpo) art.appendChild(seccion(s.titulo, N.cuerpoMarkdownAHtml(s.cuerpo)));
    });
    var interna = por('relevancia para dolphinstats');
    if (interna && interna.cuerpo) {
      art.appendChild(h('details', { class: 'nota-interna' }, h('summary', null, 'Nota interna: relevancia para DolphinStats'),
        h('div', { class: 'texto-md', html: N.cuerpoMarkdownAHtml(interna.cuerpo) })));
    }
    if (!art.children.length) art.appendChild(h('p', { class: 'vacio' }, 'Esta nota no tiene contenido para mostrar.'));
    return art;
  }

  // «Anterior / Siguiente» según el orden del índice. En los extremos no hay enlaces rotos:
  // la primera guía lo dice y la última lleva de vuelta a la lista.
  function navegacion(v) {
    function enlace(vecina, rol) {
      var rotulo = rol === 'anterior'
        ? (vecina.otroTema ? 'Tema anterior: ' + vecina.tema : 'Guía anterior')
        : (vecina.otroTema ? 'Siguiente tema: ' + vecina.tema : 'Siguiente guía');
      return h('a', { class: 'vecina ' + rol, href: N.construirRuta({ vista: 'guia', origen: 'aprender', path: vecina.path }) },
        h('span', { class: 'vecina-rotulo' }, rol === 'anterior' ? [u.icono('flecha-izq', 'ico-mini'), rotulo] : [rotulo, u.icono('flecha-der', 'ico-mini')]),
        h('strong', null, vecina.titulo));
    }
    return h('nav', { class: 'vecinas', 'aria-label': 'Guías vecinas' },
      v.anterior ? enlace(v.anterior, 'anterior') : h('div', { class: 'vecina vacia' }, 'Esta es la primera guía'),
      v.siguiente ? enlace(v.siguiente, 'siguiente')
        : h('a', { class: 'vecina siguiente', href: '#/aprender' }, h('span', { class: 'vecina-rotulo' }, 'Terminaste las guías'), h('strong', null, 'Volver a la lista')));
  }

  function pintar(ctx, path, esRadar, partes, markdown) {
    var parsed = N.parsearFrontmatter(markdown);
    var titulo = parsed.meta.title || path;
    var vecinos = !esRadar && partes ? N.vecinosDeGuia(partes.guias, path) : null;
    var volver = esRadar ? '#/radar' : '#/aprender';

    var botonEnlace = h('button', { type: 'button', class: 'btn btn-sec' }, 'Copiar enlace');
    botonEnlace.addEventListener('click', function () { u.copiarTexto(location.href, botonEnlace, 'Copiar enlace'); });
    var chips = h('div', { class: 'chips' },
      vecinos ? h('span', { class: 'chip' }, 'Guía ' + vecinos.posicion + ' de ' + vecinos.totalTema) : null,
      esRadar ? h('span', { class: 'chip' }, 'Radar') : null,
      parsed.meta.source ? chipFuente(parsed.meta) : null,
      parsed.meta.date ? h('span', { class: 'chip' }, parsed.meta.date) : null,
      botonEnlace);
    var miga = h('nav', { class: 'miga', 'aria-label': 'Ruta de navegación' },
      h('a', { href: volver }, esRadar ? 'Radar' : 'Aprender'), u.icono('flecha-der', 'ico-mini'),
      h('span', null, N.nombreTema(path.split('/')[1])));
    var cabecera = u.hero({ miga: miga, titulo: titulo, extra: chips });
    if (titulo.length > 70) cabecera.querySelector('h1').classList.add('largo');

    var pie = vecinos ? navegacion(vecinos)
      : h('p', null, h('a', { class: 'btn btn-sec', href: volver }, u.icono('flecha-izq'), esRadar ? 'Volver al Radar' : 'Volver a las guías'));
    ctx.montar(h('div', null, cabecera, h('div', { class: 'cuerpo' }, articulo(N.separarSecciones(parsed.cuerpo)), pie)),
      { titulo: titulo, seccion: esRadar ? 'radar' : 'aprender' });
  }

  A.vistas.guia = function (ctx) {
    var path = ctx.ruta.path;
    var esRadar = ctx.ruta.origen === 'radar';
    var seccionNav = esRadar ? 'radar' : 'aprender';
    ctx.montar(h('div', { class: 'cuerpo' }, u.estadoCarga('Cargando la nota…')), { titulo: 'Nota', seccion: seccionNav });
    // La nota se lee aunque falle el índice (solo se pierden la posición y los vecinos).
    var indice = A.cargarIndice().then(function (p) { return p; }, function () { return null; });
    ctx.cuando(Promise.all([indice, pedirNota(path)]),
      function (r) { pintar(ctx, path, esRadar, r[0], r[1]); },
      function (e) {
        var noExiste = e && e.estado === 404;
        ctx.montar(h('div', { class: 'cuerpo' },
          u.estadoError(noExiste ? 'No encontramos esa nota. Puede que se haya movido o renombrado.' : 'No se pudo cargar la nota. Revisa tu conexión e intenta de nuevo.',
            noExiste ? null : A.recargarVista),
          h('p', null, h('a', { href: esRadar ? '#/radar' : '#/aprender' }, esRadar ? 'Volver al Radar' : 'Volver a las guías'))),
        { titulo: 'Nota no disponible', seccion: seccionNav });
      });
  };
})();
```

- [ ] **Step 3: Cargar las dos vistas**

En `asesor-stata-nuevo.html`, justo después de la línea `<script src="vistas/inicio.js"></script>`, agregar:

```html
<script src="vistas/aprender.js"></script>
<script src="vistas/guia.js"></script>
```

- [ ] **Step 4: Agregar los estilos al final de `asesor-stata.css`**

```css

/* ------------------------------------------------------- Aprender y guía */
.hero h1, .guia-titulo, .destacada-titulo, .vecina strong { overflow-wrap: anywhere; }
.hero h1.largo { font-size: clamp(1.35rem, 3vw, 1.9rem); line-height: 1.25; }
.busca { position: relative; display: flex; align-items: center; flex-wrap: wrap; gap: .8rem; margin-top: 1.3rem; max-width: 620px; }
.busca .ico { position: absolute; left: .95rem; color: var(--muted); pointer-events: none; }
.busca-campo {
  flex: 1 1 280px; min-height: 48px; padding: .7rem 1rem .7rem 2.7rem; border: 0; border-radius: 100px;
  background: #fff; color: var(--marino); font: inherit;
}
.busca-conteo { color: #fff; font-size: .9rem; }

.destacada { display: block; margin-bottom: 1.3rem; padding: 1.15rem 1.3rem; border: 1px solid var(--borde); border-radius: var(--radio); background: var(--tinte-azul); color: var(--marino); text-decoration: none; transition: box-shadow .18s; }
.destacada:hover { box-shadow: var(--sombra); }
.destacada-titulo { display: block; font-family: var(--fuente-titulo); font-weight: 800; font-size: 1.2rem; line-height: 1.25; }
.destacada-resumen { display: block; margin-top: .35rem; color: var(--muted); font-size: .92rem; }
.insignia { display: inline-block; margin-bottom: .55rem; padding: .1rem .75rem; border-radius: 100px; background: var(--azul); color: #fff; font-size: .72rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }

details.tema { margin-bottom: .6rem; }
details.tema > summary { display: flex; align-items: center; gap: .6rem; min-height: 48px; cursor: pointer; list-style: none; font-size: .82rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
details.tema > summary::-webkit-details-marker { display: none; }
details.tema > summary::before { content: ''; width: .5rem; height: .5rem; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg); transition: transform .15s; }
details.tema[open] > summary::before { transform: rotate(45deg); }
.tema-conteo { margin-left: auto; min-width: 1.8rem; padding: 0 .55rem; border: 1px solid var(--borde); border-radius: 100px; background: #fff; text-align: center; font-weight: 500; letter-spacing: 0; text-transform: none; }
.guias { display: grid; grid-template-columns: repeat(2, 1fr); gap: .8rem; padding-bottom: .6rem; }
.guias-una { grid-template-columns: 1fr; }
.guia-card { display: flex; flex-direction: column; gap: .35rem; padding: 1rem 1.1rem; border: 1px solid var(--borde); border-left: 4px solid var(--azul); border-radius: var(--radio-sm); background: #fff; color: var(--marino); text-decoration: none; transition: transform .18s, box-shadow .18s; }
.guia-card:hover { transform: translateY(-2px); box-shadow: var(--sombra); }
.guia-titulo { font-weight: 700; line-height: 1.3; }
.guia-resumen { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; color: var(--muted); font-size: .88rem; }
.guia-meta { color: var(--azul-oscuro); font-size: .78rem; font-weight: 700; }
@media (max-width: 760px) { .guias { grid-template-columns: 1fr; } }

.articulo { max-width: 760px; }
.callout { margin: 0 0 1.7rem; padding: 1.1rem 1.25rem; border-left: 4px solid var(--azul); border-radius: var(--radio-sm); background: var(--tinte-azul); }
.callout-rotulo { margin-bottom: .3rem; font-size: .75rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--azul-oscuro); }
.callout .texto-md p:last-child { margin-bottom: 0; }
.seccion { margin-bottom: 1.8rem; }
.seccion > h2 { margin-bottom: .7rem; }
.texto-md ul { padding-left: 1.25rem; }
.texto-md li { margin-bottom: .35rem; }
.bloque { margin: 0 0 1rem; }
.bloque-barra { display: flex; align-items: center; justify-content: space-between; gap: .6rem; margin-top: .9rem; padding: .3rem .5rem .3rem 1rem; border: 1px solid var(--borde); border-bottom: 0; border-radius: var(--radio-sm) var(--radio-sm) 0 0; background: var(--tinte-azul); color: var(--muted); font-size: .8rem; font-weight: 700; }
pre.bloque-codigo { margin: 0 0 1rem; padding: .95rem 1.1rem; overflow-x: auto; border: 1px solid var(--borde); border-radius: 0 0 var(--radio-sm) var(--radio-sm); background: var(--superficie); color: var(--marino); font: .86rem/1.55 var(--fuente-codigo); tab-size: 4; }
pre.bloque-codigo code { padding: 0; background: none; font: inherit; }
details.nota-interna { margin-top: 1.5rem; padding-top: .9rem; border-top: 1px dashed var(--borde); }
details.nota-interna > summary { display: flex; align-items: center; min-height: 44px; cursor: pointer; color: var(--muted); font-size: .88rem; font-weight: 700; }
details.nota-interna .texto-md { color: var(--muted); font-size: .92rem; }
.chips { align-items: center; }
a.chip-enlace { min-height: 44px; color: #fff; text-decoration: underline; }

.vecinas { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; margin-top: 2rem; padding-top: 1.2rem; border-top: 1px dashed var(--borde); }
.vecina { display: flex; flex-direction: column; gap: .2rem; padding: .85rem 1rem; border: 1px solid var(--borde); border-radius: var(--radio-sm); background: #fff; color: var(--marino); text-decoration: none; }
a.vecina:hover { border-color: var(--azul); }
.vecina.siguiente { align-items: flex-end; border-color: var(--azul); text-align: right; }
.vecina.vacia { justify-content: center; color: var(--muted); }
.vecina-rotulo { display: inline-flex; align-items: center; gap: .35rem; color: var(--azul-oscuro); font-size: .78rem; font-weight: 700; }
@media (max-width: 640px) { .vecinas { grid-template-columns: 1fr; } }
```

- [ ] **Step 5: Verificar Aprender y la lectura de guías en el navegador**

Con `node $SERVIDOR --puerto=8792 --csp` en marcha, abrir `http://localhost:8792/asesor-stata-nuevo.html#/` y ejecutar cada bloque (los bloques se ejecutan por separado, en este orden).

**5a. Aprender:**

```js
const esperar = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
location.hash = '#/aprender'; await esperar(1600);
const out = {
  h1: $('h1').textContent, conteo: $('.busca-conteo').textContent, insignia: $('.destacada .insignia')?.textContent,
  temas: document.querySelectorAll('details.tema').length, abiertos: document.querySelectorAll('details.tema[open]').length,
  primerTema: $('details.tema summary span').textContent, tarjetasPrimerTema: document.querySelectorAll('details.tema')[0].querySelectorAll('.guia-card').length,
  navActivo: $('.nav a[aria-current="page"]')?.textContent.trim(), desborde: document.documentElement.scrollWidth > innerWidth,
};
const campo = $('.busca-campo'); campo.value = 'chi2'; campo.dispatchEvent(new Event('input'));
out.filtro = { conteo: $('.busca-conteo').textContent, sinDestacada: !$('.destacada'), primerTitulo: $('.guia-card .guia-titulo')?.textContent.slice(0, 70),
  todosAbiertos: [...document.querySelectorAll('details.tema')].every(d => d.open) };
campo.value = 'zzzz'; campo.dispatchEvent(new Event('input'));
out.vacio = { texto: $('.vacio-titulo')?.textContent, boton: $('.estado-vista.vacio button')?.textContent };
$('.estado-vista.vacio button').click(); await esperar(300);
out.alPreguntar = { hash: location.hash, precarga: AsesorStata.estado.preguntaInicial };
out
```
Expected: `h1: 'Aprender Stata'`, `conteo: '23 guías en 11 temas'`, `insignia: 'Empieza aquí'`, `temas: 11`, `abiertos: 1`, `primerTema: 'Primeros pasos en Stata'`, `tarjetasPrimerTema: 5`, `navActivo: 'Aprender'`, `desborde: false`; `filtro.conteo` con la forma `N de 23 guías` (N ≥ 1), `sinDestacada: true`, `primerTitulo` que contiene «chi» sin importar mayúsculas, `todosAbiertos: true`; `vacio.texto: 'Ninguna guía coincide con «zzzz».'`, `vacio.boton: 'Preguntar esto'`; `alPreguntar: { hash: '#/preguntar', precarga: 'zzzz' }` (la pantalla Preguntar aún no existe: se verá «Esta pantalla no está disponible»).

**5b. Primera guía (Review Focus 5, extremo inicial):**

```js
const esperar = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
location.hash = '#/aprender/stata-basics/tour-rapido-interfaz-flujo-trabajo'; await esperar(1600);
({
  h1: $('h1').textContent.slice(0, 22), miga: $('.miga').textContent,
  chips: [...document.querySelectorAll('.hero .chip, .hero .btn')].map(e => e.textContent.trim()),
  orden: [...document.querySelectorAll('.articulo > *')].map(e => e.className + (e.querySelector('h2') ? ':' + e.querySelector('h2').textContent : '')),
  barraCodigo: $('.bloque-barra span')?.textContent, notaInternaAbierta: $('details.nota-interna')?.open,
  vecinas: [...document.querySelectorAll('.vecina')].map(e => e.textContent.trim().slice(0, 60)),
  navActivo: $('.nav a[aria-current="page"]')?.textContent.trim(), titulo: document.title.slice(-36),
})
```
Expected: `h1: 'Tour rápido de Stata — '`, `miga: 'AprenderPrimeros pasos en Stata'`, `chips` contiene `'Guía 1 de 5'`, `'Libro'`, `'2026-09-29'` y `'Copiar enlace'`; `orden: ['callout', 'seccion:Ejemplo', 'seccion:Resumen técnico', 'nota-interna']`; `barraCodigo: 'Código Stata'`; `notaInternaAbierta: false`; `vecinas: ['Esta es la primera guía', 'Siguiente guíaComandos que todo usuario debería conocer']`; `navActivo: 'Aprender'`; `titulo` termina en `· Asesor Stata · DolphinStats`.

**5c. Guía única de su tema y última de todas (Review Focus 5, extremo final):**

```js
const esperar = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
location.hash = '#/aprender/sampling/sample-size-slopes-cluster-randomized-longitudinal'; await esperar(1600);
({
  chips: [...document.querySelectorAll('.hero .chip')].map(e => e.textContent.trim()),
  orden: [...document.querySelectorAll('.articulo > *')].map(e => e.className + (e.querySelector('h2') ? ':' + e.querySelector('h2').textContent : '')),
  anterior: $('.vecina.anterior')?.textContent.trim().slice(0, 22),
  siguiente: $('.vecina.siguiente')?.textContent.trim(), hrefSiguiente: $('.vecina.siguiente')?.getAttribute('href'),
})
```
Expected: `chips` incluye `'Guía 1 de 1'`; `orden: ['callout', 'seccion:Resumen técnico', 'nota-interna']` (esta guía no tiene ejemplo); `anterior` empieza con `'Tema anterior:'`; `siguiente: 'Terminaste las guíasVolver a la lista'`; `hrefSiguiente: '#/aprender'`.

**5d. Nota del Radar y enlace antiguo (Review Focus 2):**

```js
const esperar = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
const larga = 'calibra-stata-module-to-perform-calibracion-de-factores-de-expansion-pesos-muestrales-por-el-metodo-de-deville-y-sarndal-1992';
location.hash = '#nota=knowledge%2Fsampling%2F' + larga + '.md'; await esperar(2000);
const a = {
  hash: location.hash === '#/radar/sampling/' + larga, h1: $('h1').textContent.slice(0, 8), h1Largo: $('h1').classList.contains('largo'),
  chips: [...document.querySelectorAll('.hero .chip')].map(e => e.textContent.trim().slice(0, 28)),
  enlaceFuente: $('.chip-enlace')?.getAttribute('href').slice(0, 8), hayVecinas: !!$('.vecinas'), volver: $('.cuerpo .btn')?.textContent.trim(),
  navActivo: $('.nav a[aria-current="page"]')?.textContent.trim(),
};
location.hash = '#nota=knowledge%2Fstata-basics%2Fno-existe.md'; await esperar(1500);
a.rota = { hash: location.hash, aviso: $('.aviso-vista')?.textContent };
location.hash = '#/aprender/stata-basics/no-existe'; await esperar(1500);
a.inexistente = { error: $('.estado-vista.error p')?.textContent, hayReintentar: !!$('.estado-vista.error button'), volver: $('.cuerpo > p a')?.textContent };
a
```
Expected: `hash: true`, `h1: 'CALIBRA:'`, `h1Largo: true`, `chips` incluye `'Radar'` y uno que empieza con `'Módulo SSC · ver fuente'`, `enlaceFuente: 'https://'`, `hayVecinas: false`, `volver: 'Volver al Radar'`, `navActivo: 'Radar'`; `rota: { hash: '#/', aviso: 'No encontramos esa nota. Puede que se haya movido o renombrado.' }`; `inexistente: { error: 'No encontramos esa nota. Puede que se haya movido o renombrado.', hayReintentar: false, volver: 'Volver a las guías' }`.

**5e. Una respuesta tardía no se pinta en la pantalla equivocada (Review Focus 1):**

```js
const esperar = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
const real = window.fetch;
location.hash = '#/'; await esperar(400);
AsesorStata.estado.cargaIndice = null; AsesorStata.estado.partes = null;
window.fetch = (u, o) => (String(u).includes('asesor-stata-base') && !String(u).includes('nota='))
  ? new Promise(r => setTimeout(() => r(real(u, o)), 800)) : real(u, o);
location.hash = '#/aprender'; await esperar(150);   // empieza a esperar el índice lento
location.hash = '#/';                                // el usuario cambia de pantalla
await esperar(1500);                                 // el índice llega tarde
const r = { h1: $('h1').textContent, hayListaDeGuias: !!document.querySelector('details.tema'), hash: location.hash };
window.fetch = real; r
```
Expected: `{ h1: '¿Qué necesitas hoy?', hayListaDeGuias: false, hash: '#/' }`.

**5f. El índice no carga (Review Focus 3):**

```js
const esperar = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
const real = window.fetch;
location.hash = '#/'; await esperar(400);
AsesorStata.estado.cargaIndice = null; AsesorStata.estado.partes = null;
window.fetch = (u, o) => (String(u).includes('asesor-stata-base') && !String(u).includes('nota='))
  ? Promise.resolve(new Response(JSON.stringify({ error: 'La base de conocimiento no está disponible en este momento.' }), { status: 503 })) : real(u, o);
location.hash = '#/aprender'; await esperar(800);
const antes = { error: $('.estado-vista.error p')?.textContent, boton: $('.estado-vista.error button')?.textContent, hayHero: !!$('.hero') };
window.fetch = real;
$('.estado-vista.error button').click(); await esperar(1500);
({ antes, despues: { guias: document.querySelectorAll('.guia-card').length > 0, error: !!$('.estado-vista.error') } })
```
Expected: `antes: { error: 'La base de conocimiento no está disponible en este momento.', boton: 'Reintentar', hayHero: true }` y `despues: { guias: true, error: false }`.

- [ ] **Step 6: Verificar en 375 px y con teclado**

Con el navegador integrado en 375 px de ancho (`resize_window` preset `mobile`), repetir 5a y 5b y 5d y comprobar `document.documentElement.scrollWidth > innerWidth` → `false` en cada una (los títulos largos del Radar y los bloques de código no deben ensanchar la página). Volver a escritorio. Con teclado: desde la guía, `Tab` recorre «Copiar enlace», el botón «Copiar» del bloque, los enlaces vecinos; comprobar con
`document.activeElement.className` después de varios `Tab` (usar la herramienta `computer` con la tecla `Tab`) que ningún elemento interactivo queda sin foco visible.

- [ ] **Step 7: Verificar que las pruebas siguen verdes y hacer commit**

```bash
for t in tests/test-asesor-stata-markdown.mjs tests/test-asesor-stata-navegacion.mjs tests/test-asesor-stata-fuentes.mjs tests/test-asesor-stata-contraste.mjs; do printf "%-46s" "$t"; node $t | tail -1; done
git add vistas/aprender.js vistas/guia.js asesor-stata-nuevo.html asesor-stata.css
git commit -m "feat(asesor-stata): pantallas Aprender y Guía (artículo con anterior y siguiente)" -m "Co-Authored-By: <modelo vigente> <noreply@anthropic.com>"
```
Expected: `35`, `24`, `4` y `30 pasados`, todos con `0 fallidos`.

---

### Task 9: Preguntar y Radar

**Files:**
- Create: `vistas/preguntar.js`, `vistas/radar.js`
- Modify: `asesor-stata-nuevo.html` (dos `<script>`), `asesor-stata.css` (sección al final)

**Interfaces:**
- Consumes: `A.ui` (`h`, `icono`, `hero`, `estadoCarga`, `estadoError`, `estadoVacio`, `selectorNivel`, `enlazarContador`, `pedirJson`, `iniciarEspera`, `estadoLinea`, `mensajeDeFallo`), `A.cargarIndice()`, `A.mensajeDeIndice(e)`, `A.recargarVista()`, `A.estado.partes`, `A.estado.preguntaInicial`, `A.rutaDeNota(path)`, `ctx.activo()`, `ctx.restaurarScroll()`; del núcleo `listarRadar`, `construirRuta`. Endpoint: `POST /api/asesor-stata-consulta` con `{ pregunta, nivel }` → `{ respuesta, notas_citadas: [{ titulo, path }] }` o `{ error }`.
- Produces: `A.vistas.preguntar` (`#/preguntar`) y `A.vistas.radar` (`#/radar`). Clases reutilizadas por la Tarea 10: `.tarjeta-form`, `.ejemplos`, `.ejemplo`, `.ejemplos-titulo`, `.fila-acciones`.

- [ ] **Step 1: Crear `vistas/preguntar.js`**

```js
/* vistas/preguntar.js — pregunta en texto libre; la respuesta se basa solo en las notas. */
(function () {
  'use strict';
  var A = window.AsesorStata;
  var N = A.N;
  var u = A.ui;
  var h = u.h;
  var MAX_PREGUNTA = 500;
  var EJEMPLOS = [
    ['¿Fisher o chi²?', '¿Cuándo uso Fisher en vez de chi cuadrado?'],
    ['Diseño muestral ENDES', '¿Cómo declaro el diseño muestral de la ENDES en Stata?'],
    ['¿Qué es un do-file?', '¿Qué es un do-file y por qué conviene usarlo?'],
  ];
  var FRASES = ['Buscando en las notas…', 'Leyendo las notas relevantes…', 'Redactando la respuesta…'];

  function resumenDeNota(path, partes) {
    var resumen = '';
    if (partes) {
      [partes.guias, partes.radar].forEach(function (lista) {
        lista.temas.forEach(function (t) { t.notas.forEach(function (n) { if (n.path === path) resumen = n.simple || n.resumen || ''; }); });
      });
    }
    return resumen;
  }

  // Una nota citada por el modelo solo es un enlace si existe de verdad (el modelo puede inventar rutas).
  function tarjetaNota(nota, partes) {
    var ruta = A.rutaDeNota(nota.path);
    if (!ruta) return h('div', { class: 'guia-card nota-card sin-enlace' }, h('span', { class: 'guia-titulo' }, nota.titulo));
    var resumen = resumenDeNota(nota.path, partes);
    return h('a', { class: 'guia-card nota-card', href: ruta },
      h('span', { class: 'guia-titulo' }, nota.titulo),
      resumen ? h('span', { class: 'guia-resumen' }, resumen) : null);
  }

  function pintarRespuesta(panel, data, partes) {
    panel.replaceChildren(h('div', { class: 'respuesta' }, data.respuesta));
    if (data.notas_citadas.length) {
      panel.appendChild(h('div', { class: 'citas' }, h('h2', null, 'Notas en las que se basa esta respuesta'),
        h('div', { class: 'guias' }, data.notas_citadas.map(function (n) { return tarjetaNota(n, partes); }))));
    } else {
      panel.appendChild(h('div', { class: 'sugerencias' }, h('p', null, 'Esta respuesta no se apoyó en ninguna nota. Puedes:'),
        h('ul', null,
          h('li', null, 'probar con otras palabras;'),
          h('li', null, 'mirar las ', h('a', { href: '#/aprender' }, 'guías'), ' por tema;'),
          h('li', null, 'revisar las novedades del ', h('a', { href: '#/radar' }, 'Radar'), '.'))));
    }
  }

  A.vistas.preguntar = function (ctx) {
    var area = h('textarea', { class: 'campo', maxlength: String(MAX_PREGUNTA), 'aria-label': 'Tu pregunta',
      placeholder: 'Ej.: ¿cuándo uso Fisher en vez de chi cuadrado?' });
    var contador = h('div', { class: 'contador' });
    var nivel = u.selectorNivel();
    var estado = h('div', { class: 'linea-estado', role: 'status', 'aria-live': 'polite' });
    var boton = h('button', { type: 'submit', class: 'btn' }, 'Preguntar');
    var panel = h('div', { class: 'panel-respuesta', 'aria-live': 'polite' });
    var ejemplos = h('div', { class: 'ejemplos' }, h('span', { class: 'ejemplos-titulo' }, 'Prueba con:'),
      EJEMPLOS.map(function (e) {
        return h('button', { type: 'button', class: 'ejemplo', onclick: function () { area.value = e[1]; area.dispatchEvent(new Event('input')); area.focus(); } }, e[0]);
      }));
    var formulario = h('form', { class: 'tarjeta-form', novalidate: true }, area, contador, ejemplos,
      h('div', { class: 'fila-acciones' }, nivel.el, boton), estado);
    u.enlazarContador(area, contador, MAX_PREGUNTA, 'se recortará.');
    if (A.estado.preguntaInicial) { // viene de «Preguntar esto» en Aprender
      area.value = A.estado.preguntaInicial;
      A.estado.preguntaInicial = '';
      area.dispatchEvent(new Event('input'));
    }

    formulario.addEventListener('submit', function (e) {
      e.preventDefault();
      var pregunta = area.value.trim();
      if (!pregunta) { u.estadoLinea(estado, 'error', 'Escribe primero tu pregunta.'); return; }
      boton.disabled = true;
      panel.replaceChildren();
      var detener = u.iniciarEspera(estado, FRASES, false);
      u.pedirJson('/api/asesor-stata-consulta', { pregunta: pregunta, nivel: nivel.valor() }, 60000)
        .then(function (r) {
          detener();
          boton.disabled = false;
          if (!ctx.activo()) return; // el usuario ya cambió de pantalla
          if (!r.ok || r.data.error) { u.estadoLinea(estado, 'error', r.data.error || 'No se pudo responder la consulta.'); return; }
          u.estadoLinea(estado, '', '');
          pintarRespuesta(panel, r.data, A.estado.partes);
        })
        .catch(function (err) {
          detener();
          boton.disabled = false;
          if (ctx.activo()) u.estadoLinea(estado, 'error', u.mensajeDeFallo(err));
        });
    });

    ctx.montar(h('div', null,
      u.hero({ kicker: 'Preguntar', titulo: 'Pregunta a tus notas', texto: 'Recibirás una respuesta basada solo en las notas de la base, indicando en cuáles se apoya.' }),
      h('div', { class: 'cuerpo cuerpo-flota' }, formulario, panel)), { titulo: 'Preguntar', seccion: 'preguntar' });
    // El índice solo sirve para mostrar bien las notas citadas: si falla, se pregunta igual.
    A.cargarIndice().catch(function () { /* se usa el enlace por forma de ruta */ });
  };
})();
```

- [ ] **Step 2: Crear `vistas/radar.js`**

```js
/* vistas/radar.js — notas del monitoreo semanal: la más reciente primero, con filtro y tandas. */
(function () {
  'use strict';
  var A = window.AsesorStata;
  var N = A.N;
  var u = A.ui;
  var h = u.h;
  var TANDA = 15;

  function tarjetaRadar(n) {
    return h('a', { class: 'guia-card', href: N.construirRuta({ vista: 'guia', origen: 'radar', path: n.path }) },
      h('span', { class: 'guia-titulo' }, n.titulo),
      (n.simple || n.resumen) ? h('span', { class: 'guia-resumen' }, n.simple || n.resumen) : null,
      h('span', { class: 'guia-meta' }, n.tema + (n.fecha ? ' · ' + n.fecha : '')));
  }

  function pintar(ctx, partes, cuerpo, entrada, conteo) {
    var visibles = TANDA;
    function dibujar(reiniciar, enfocarDesde) {
      if (reiniciar) visibles = TANDA;
      var texto = entrada.value.trim();
      var lista = N.listarRadar(partes.radar, texto);
      var total = N.listarRadar(partes.radar, '').length;
      conteo.textContent = !total ? '' : (texto ? lista.length + ' de ' + total + ' notas' : total + ' notas del monitoreo');
      cuerpo.replaceChildren();
      if (!total) {
        cuerpo.appendChild(u.estadoVacio('Todavía no hay notas del monitoreo semanal.', 'Aparecerán aquí cuando corra la próxima búsqueda.'));
        return;
      }
      if (!lista.length) {
        cuerpo.appendChild(u.estadoVacio('Ninguna nota del Radar coincide con «' + texto + '».', 'Prueba con otra palabra.'));
        return;
      }
      cuerpo.appendChild(h('div', { class: 'guias guias-una' }, lista.slice(0, visibles).map(tarjetaRadar)));
      if (lista.length > visibles) {
        cuerpo.appendChild(h('button', { type: 'button', class: 'btn btn-sec', onclick: function () {
          var antes = visibles;
          visibles += TANDA;
          dibujar(false, antes);
        } }, 'Mostrar ' + Math.min(TANDA, lista.length - visibles) + ' más (quedan ' + (lista.length - visibles) + ')'));
      }
      if (enfocarDesde !== undefined) { // tras «Mostrar más», el foco pasa a la primera nota nueva
        var nueva = cuerpo.querySelectorAll('.guia-card')[enfocarDesde];
        if (nueva) nueva.focus();
      }
    }
    entrada.addEventListener('input', function () { dibujar(true); });
    dibujar(true);
    ctx.restaurarScroll();
  }

  A.vistas.radar = function (ctx) {
    var entrada = h('input', { type: 'search', class: 'busca-campo', placeholder: 'Filtrar el Radar por palabra…',
      'aria-label': 'Filtrar el Radar por palabra', autocomplete: 'off' });
    var conteo = h('span', { class: 'busca-conteo', 'aria-live': 'polite' });
    var cuerpo = h('div', { class: 'cuerpo' }, u.estadoCarga('Cargando el Radar…'));
    ctx.montar(h('div', null,
      u.hero({
        kicker: 'Radar', titulo: 'Radar de novedades',
        texto: 'Artículos y módulos de Stata que la búsqueda semanal en revistas de estadística consideró relevantes. Se agregan solos cada lunes, lo más reciente primero. Son notas técnicas, a veces con títulos en inglés: para aprender desde cero usa las guías.',
        extra: h('div', { class: 'busca' }, u.icono('buscar'), entrada, conteo),
      }), cuerpo), { titulo: 'Radar', seccion: 'radar' });
    ctx.cuando(A.cargarIndice(),
      function (partes) { pintar(ctx, partes, cuerpo, entrada, conteo); },
      function (e) { cuerpo.replaceChildren(u.estadoError(A.mensajeDeIndice(e), A.recargarVista)); });
  };
})();
```

- [ ] **Step 3: Cargar las vistas**

En `asesor-stata-nuevo.html`, después de `<script src="vistas/guia.js"></script>`, agregar:

```html
<script src="vistas/preguntar.js"></script>
<script src="vistas/radar.js"></script>
```

- [ ] **Step 4: Agregar los estilos al final de `asesor-stata.css`**

```css

/* ------------------------------------------------------- Preguntar y Radar */
.tarjeta-form { padding: 1.25rem 1.3rem; border: 1px solid var(--borde); border-radius: var(--radio); background: #fff; box-shadow: var(--sombra); }
.ejemplos { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin-top: .8rem; }
.ejemplos-titulo { color: var(--muted); font-size: .85rem; }
.ejemplo {
  display: inline-flex; align-items: center; min-height: 44px; padding: 0 .95rem; border: 1px dashed var(--azul); border-radius: 100px;
  background: #fff; color: var(--azul); font: 700 .85rem var(--fuente-texto); cursor: pointer;
}
.ejemplo:hover { background: var(--tinte-azul); }
.fila-acciones { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .8rem 1.2rem; margin-top: 1rem; }
.panel-respuesta:empty { display: none; }
.respuesta { margin-top: 1.3rem; padding: 1.25rem 1.35rem; border: 1px solid var(--borde); border-radius: var(--radio); background: #fff; box-shadow: var(--sombra); white-space: pre-wrap; line-height: 1.65; }
.citas h2 { margin: 1.5rem 0 .8rem; font-size: 1.05rem; }
.nota-card.sin-enlace { border-left-color: var(--muted); }
.sugerencias { margin-top: 1.2rem; padding: 1rem 1.2rem; border-radius: var(--radio-sm); background: var(--superficie); color: var(--muted); }
.sugerencias ul { margin: 0; padding-left: 1.2rem; }
```

- [ ] **Step 5: Verificar Preguntar en el navegador (con la política de producción)**

Con `node $SERVIDOR --puerto=8792 --csp` en marcha, abrir `http://localhost:8792/asesor-stata-nuevo.html#/` y ejecutar los bloques en orden. Todos simulan el endpoint de consulta (el servidor local no tiene la clave de DeepSeek).

**5a. Respuesta con notas citadas, espera y doble envío:**

```js
const esperar = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
const real = window.fetch;
const cita = 'calibra-stata-module-to-perform-calibracion-de-factores-de-expansion-pesos-muestrales-por-el-metodo-de-deville-y-sarndal-1992';
window.fetch = (u, o) => String(u).includes('asesor-stata-consulta')
  ? new Promise(r => setTimeout(() => r(new Response(' ' + JSON.stringify({ respuesta: 'Usa Fisher cuando hay pocas observaciones.', notas_citadas: [
      { titulo: 'Asociación entre categóricas', path: 'knowledge/hypothesis-testing/chi-cuadrado-riesgo-relativo-or-proporciones.md' },
      { titulo: 'CALIBRA', path: 'knowledge/sampling/' + cita + '.md' },
      { titulo: 'Nota inventada', path: 'knowledge/x/no-existe.md' }] }), { status: 200 })), 600))
  : real(u, o);
location.hash = '#/preguntar'; await esperar(900);
const out = { h1: $('h1').textContent, navActivo: $('.nav a[aria-current="page"]')?.textContent.trim() };
$('.ejemplo').click();
out.pregunta = $('textarea.campo').value;
$('form .btn[type=submit]').click(); await esperar(150);
out.durante = { estado: $('.linea-estado').textContent.slice(0, 32), deshabilitado: $('form .btn[type=submit]').disabled };
await esperar(1000);
out.despues = {
  respuesta: $('.respuesta')?.textContent, habilitado: !$('form .btn[type=submit]').disabled, estado: $('.linea-estado').textContent,
  hrefs: [...document.querySelectorAll('a.nota-card')].map(a => a.getAttribute('href').slice(0, 40)),
  sinEnlace: document.querySelectorAll('.nota-card.sin-enlace').length,
};
window.fetch = real; out
```
Expected: `h1: 'Pregunta a tus notas'`, `navActivo: 'Preguntar'`, `pregunta: '¿Cuándo uso Fisher en vez de chi cuadrado?'`; `durante: { estado: 'Buscando en las notas… (0 s)', deshabilitado: true }`; `despues`: `respuesta: 'Usa Fisher cuando hay pocas observaciones.'`, `habilitado: true`, `estado: ''`, `hrefs` con `'#/aprender/hypothesis-testing/chi-cuadra…'` y `'#/radar/sampling/calibra-stata-module-to…'` (la nota del Radar enlaza a `#/radar/…`), `sinEnlace: 1` (la nota inventada no es un enlace).

**5b. Sin notas relacionadas, y error del servidor:**

```js
const esperar = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
const real = window.fetch;
const responder = (cuerpo, estado) => { window.fetch = (u, o) => String(u).includes('asesor-stata-consulta') ? Promise.resolve(new Response(JSON.stringify(cuerpo), { status: estado })) : real(u, o); };
location.hash = '#/preguntar'; await esperar(500);
$('textarea.campo').value = 'algo sin relación'; $('textarea.campo').dispatchEvent(new Event('input'));
responder({ respuesta: 'No encontré notas relacionadas con tu pregunta en la base.', notas_citadas: [] }, 200);
$('form .btn[type=submit]').click(); await esperar(500);
const sinNotas = { sugerencias: !!$('.sugerencias'), citas: !!$('.citas'), enlaces: [...document.querySelectorAll('.sugerencias a')].map(a => a.getAttribute('href')) };
responder({ error: 'No se pudo completar la consulta en este momento. Intenta de nuevo.' }, 502);
$('form .btn[type=submit]').click(); await esperar(500);
const error = { estado: $('.linea-estado.error')?.textContent, sinRespuesta: !$('.respuesta') };
$('textarea.campo').value = '   '; $('form .btn[type=submit]').click(); await esperar(100);
const vacia = $('.linea-estado.error')?.textContent;
window.fetch = real; ({ sinNotas, error, vacia })
```
Expected: `sinNotas: { sugerencias: true, citas: false, enlaces: ['#/aprender', '#/radar'] }`; `error: { estado: 'No se pudo completar la consulta en este momento. Intenta de nuevo.', sinRespuesta: true }`; `vacia: 'Escribe primero tu pregunta.'`.

**5c. Una respuesta tardía no se pinta en otra pantalla (Review Focus 1):**

```js
const esperar = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
const real = window.fetch;
window.fetch = (u, o) => String(u).includes('asesor-stata-consulta')
  ? new Promise(r => setTimeout(() => r(new Response(JSON.stringify({ respuesta: 'Respuesta tardía', notas_citadas: [] }), { status: 200 })), 800))
  : real(u, o);
location.hash = '#/preguntar'; await esperar(500);
$('textarea.campo').value = 'una pregunta'; $('textarea.campo').dispatchEvent(new Event('input'));
$('form .btn[type=submit]').click(); await esperar(150);
location.hash = '#/';                       // el usuario se va antes de que llegue la respuesta
await esperar(1200);
const r = { h1: $('h1').textContent, hayRespuesta: !!$('.respuesta'), hash: location.hash };
window.fetch = real; r
```
Expected: `{ h1: '¿Qué necesitas hoy?', hayRespuesta: false, hash: '#/' }`.

**5d. Preguntar sigue usable si el índice falla (Review Focus 3), y la pregunta precargada desde Aprender:**

```js
const esperar = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
const real = window.fetch;
location.hash = '#/'; await esperar(400);
AsesorStata.estado.cargaIndice = null; AsesorStata.estado.partes = null;
window.fetch = (u, o) => {
  if (String(u).includes('asesor-stata-base') && !String(u).includes('nota=')) return Promise.resolve(new Response(JSON.stringify({ error: 'x' }), { status: 503 }));
  if (String(u).includes('asesor-stata-consulta')) return Promise.resolve(new Response(JSON.stringify({ respuesta: 'ok', notas_citadas: [{ titulo: 'Tour', path: 'knowledge/stata-basics/tour-rapido-interfaz-flujo-trabajo.md' }] }), { status: 200 }));
  return real(u, o);
};
AsesorStata.estado.preguntaInicial = 'texto que viene de Aprender';
location.hash = '#/preguntar'; await esperar(600);
const a = { hayFormulario: !!$('form.tarjeta-form'), sinError: !$('.estado-vista.error'), precarga: $('textarea.campo').value, consumida: AsesorStata.estado.preguntaInicial === '' };
$('form .btn[type=submit]').click(); await esperar(500);
a.enlaceDeNota = $('a.nota-card')?.getAttribute('href');
window.fetch = real; a
```
Expected: `{ hayFormulario: true, sinError: true, precarga: 'texto que viene de Aprender', consumida: true, enlaceDeNota: '#/aprender/stata-basics/tour-rapido-interfaz-flujo-trabajo' }` (sin índice, la nota se enlaza por la forma de su ruta).

- [ ] **Step 6: Verificar el Radar en el navegador**

```js
const esperar = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
location.hash = '#/radar'; await esperar(1600);
const out = {
  h1: $('h1').textContent, conteo: $('.busca-conteo').textContent, tarjetas: document.querySelectorAll('.guia-card').length,
  primera: $('.guia-card .guia-titulo').textContent.slice(0, 8), textoPrimera: $('.guia-card .guia-resumen').textContent.slice(0, 22),
  meta: $('.guia-card .guia-meta').textContent, boton: $('.cuerpo > .btn')?.textContent, navActivo: $('.nav a[aria-current="page"]')?.textContent.trim(),
};
$('.cuerpo > .btn').click(); await esperar(200);
out.trasMostrarMas = { tarjetas: document.querySelectorAll('.guia-card').length, boton: !!$('.cuerpo > .btn'), foco: document.activeElement.classList.contains('guia-card') };
const campo = $('.busca-campo'); campo.value = 'encuesta'; campo.dispatchEvent(new Event('input'));
out.filtro = { conteo: $('.busca-conteo').textContent, tarjetas: document.querySelectorAll('.guia-card').length };
campo.value = 'zzzz'; campo.dispatchEvent(new Event('input'));
out.vacio = $('.vacio-titulo')?.textContent;
campo.value = ''; campo.dispatchEvent(new Event('input'));
$('.guia-card').click(); await esperar(1500);
out.alAbrir = { hash: location.hash.slice(0, 16), h1: $('h1').textContent.slice(0, 8), navActivo: $('.nav a[aria-current="page"]')?.textContent.trim(), desborde: document.documentElement.scrollWidth > innerWidth };
out
```
Expected: `h1: 'Radar de novedades'`, `conteo: '28 notas del monitoreo'`, `tarjetas: 15`, `primera: 'SRIINEI:'`, `textoPrimera: 'Descarga directamente '` (la frase simple, no el resumen técnico), `meta: 'Manejo de datos · 2026-09-29'`, `boton: 'Mostrar 13 más (quedan 13)'`, `navActivo: 'Radar'`; `trasMostrarMas: { tarjetas: 28, boton: false, foco: true }`; `filtro: { conteo: '4 de 28 notas', tarjetas: 4 }`; `vacio: 'Ninguna nota del Radar coincide con «zzzz».'`; `alAbrir: { hash: '#/radar/data-mana', h1: 'SRIINEI:', navActivo: 'Radar', desborde: false }`.

Comprobar también en 375 px (`desborde: false`) y, en la consola, que no haya errores. Cerrar el servidor.

- [ ] **Step 7: Verificar pruebas, hacer commit y subir la rama (fin de la etapa 3)**

```bash
for t in tests/test-asesor-stata-markdown.mjs tests/test-asesor-stata-navegacion.mjs tests/test-asesor-stata-fuentes.mjs tests/test-asesor-stata-contraste.mjs; do printf "%-46s" "$t"; node $t | tail -1; done
git add vistas/preguntar.js vistas/radar.js asesor-stata-nuevo.html asesor-stata.css
git commit -m "feat(asesor-stata): pantallas Preguntar (notas citadas como tarjetas) y Radar" -m "Co-Authored-By: <modelo vigente> <noreply@anthropic.com>"
git push
```
Expected: las mismas cuatro cifras que en la Tarea 8. La subida solo si fue autorizada en la Tarea 0.

---
### Task 10: Visor de código, Revisar y Explicar

**Files:**
- Create: `vistas/visor-codigo.js`, `vistas/codigo.js`
- Modify: `asesor-stata-nuevo.html` (dos `<script>`), `asesor-stata.css` (sección al final)

**Interfaces:**
- Consumes: `A.ui` (`h`, `icono`, `hero`, `estadoVacio`, `selectorNivel`, `enlazarContador`, `leerArchivoComoTexto`, `pedirJson`, `iniciarEspera`, `estadoLinea`, `mensajeDeFallo`, `bloqueCodigo`, `copiarTexto`, `descargarArchivo`, `hoyIso`, `avisoPrivacidad`), `A.rutaDeNota(path)`, `A.estado.borrador.codigo`, `ctx.activo()`; del núcleo `prepararCodigo`, `dividirLineas`, `lineasDeRango`, `hallazgosEnLinea`, `siguienteEnCiclo`, `etiquetaLineas`, `inlineMarkdown`, `armarInformeRevision`, `construirRuta`. Endpoint: `POST /api/asesor-stata-codigo` con `{ modo: 'revisar' | 'explicar', nivel, codigo }` → `{ hallazgos: [{ severidad, lineas, que, por_que, como_arreglar, codigo_corregido, nota_citada }] }` o `{ resumen, pasos: [{ lineas, que_hace, ojo }] }` o `{ error }`.
- Produces:
  - `A.ui.crearVisor({ placeholder, etiqueta, alCambiar })` → `{ el, areaTexto, valor(), poner(texto), leer(texto), editar(), cubrir(numeros), seleccionar(numeros), irA(n), enLinea(fn), enModo(fn), enfocar(), modo() }`. `valor()` devuelve el texto vigente (en lectura, el texto preparado que se numeró); `leer(texto)` pasa a modo lectura con líneas numeradas; `editar()` y `poner(texto)` vuelven a modo edición; `cubrir(numeros)` marca las líneas que algún resultado cubre (se pueden tocar); `seleccionar(numeros)` marca las del resultado elegido; `enLinea(fn)` registra `fn(n)` para cuando se toca una línea cubierta; `enModo(fn)` registra `fn('edicion' | 'lectura')`.
  - `A.vistas.codigo` para `#/codigo/revisar`, `#/codigo/explicar` y `#/codigo/generar`. Para `generar` delega en `A.codigoGenerar(ctx, { nivel, estado, panel })` (lo define la Tarea 11) y devuelve el nodo de la columna izquierda; si esa función no existe, muestra «Esta pantalla no está disponible».

- [ ] **Step 1: Crear `vistas/visor-codigo.js`**

```js
/* vistas/visor-codigo.js — cuadro de código con números de línea. Dos modos que ocupan el
   mismo lugar: edición (un textarea con un canal de números) y lectura (líneas numeradas que
   los resultados pueden cubrir y seleccionar). Los números coinciden con los del servidor
   porque se numera el texto que devuelve prepararCodigo del núcleo. */
(function () {
  'use strict';
  var A = window.AsesorStata;
  var N = A.N;
  var h = A.ui.h;

  A.ui.crearVisor = function (o) {
    o = o || {};
    var area = h('textarea', { class: 'visor-texto', spellcheck: 'false', wrap: 'off',
      'aria-label': o.etiqueta || 'Código', placeholder: o.placeholder || '' });
    var canal = h('div', { class: 'visor-canal', 'aria-hidden': 'true' }, '1');
    var edicion = h('div', { class: 'visor-edicion' }, canal, area);
    var lectura = h('div', { class: 'visor-lectura campo-oculto', role: 'group', 'aria-label': 'Código con líneas numeradas' });
    var el = h('div', { class: 'visor' }, edicion, lectura);
    var texto = '';
    var alClick = null;
    var alModo = null;

    function modo() { return lectura.classList.contains('campo-oculto') ? 'edicion' : 'lectura'; }
    function avisarModo() { if (alModo) alModo(modo()); }

    function pintarCanal() {
      var n = N.dividirLineas(area.value).length;
      var numeros = [];
      for (var i = 1; i <= n; i++) numeros.push(i);
      canal.textContent = numeros.join('\n');
      canal.scrollTop = area.scrollTop;
    }
    area.addEventListener('input', function () { pintarCanal(); if (o.alCambiar) o.alCambiar(area.value); });
    area.addEventListener('scroll', function () { canal.scrollTop = area.scrollTop; });

    function filas() { return lectura.querySelectorAll('.vl'); }
    function fila(n) { return lectura.querySelector('.vl[data-n="' + n + '"]'); }
    function marcar(clase, numeros) {
      Array.prototype.forEach.call(filas(), function (f) { f.classList.remove(clase); });
      numeros.forEach(function (n) { var f = fila(n); if (f) f.classList.add(clase); });
    }
    function cubrir(numeros) { marcar('cubierta', numeros); }
    function seleccionar(numeros) { marcar('sel', numeros); }
    function irA(n) {
      var f = fila(n);
      if (f) lectura.scrollTop = Math.max(0, f.offsetTop - lectura.clientHeight / 3);
    }

    function leer(codigo) {
      texto = codigo;
      lectura.replaceChildren();
      N.dividirLineas(texto).forEach(function (linea, i) {
        lectura.appendChild(h('div', { class: 'vl', 'data-n': String(i + 1) },
          h('span', { class: 'vn' }, String(i + 1)), h('span', { class: 'vt' }, linea === '' ? ' ' : linea)));
      });
      edicion.classList.add('campo-oculto');
      lectura.classList.remove('campo-oculto');
      avisarModo();
    }

    function salirDeLectura() {
      lectura.classList.add('campo-oculto');
      edicion.classList.remove('campo-oculto');
      cubrir([]);
      seleccionar([]);
    }

    // Vuelve a editar el mismo texto que se numeró.
    function editar() {
      salirDeLectura();
      area.value = texto;
      pintarCanal();
      avisarModo();
      area.focus();
    }

    // Reemplaza el texto (subir un archivo, ejemplo, borrador) y deja el visor en edición.
    function poner(codigo) {
      var venia = modo();
      salirDeLectura();
      area.value = codigo;
      area.dispatchEvent(new Event('input'));
      if (venia === 'lectura') avisarModo();
    }

    lectura.addEventListener('click', function (e) {
      var f = e.target.closest('.vl.cubierta');
      if (f && alClick) alClick(Number(f.getAttribute('data-n')));
    });
    pintarCanal();

    return {
      el: el, areaTexto: area, modo: modo, leer: leer, editar: editar, poner: poner,
      valor: function () { return modo() === 'edicion' ? area.value : texto; },
      cubrir: cubrir, seleccionar: seleccionar, irA: irA,
      enLinea: function (fn) { alClick = fn; },
      enModo: function (fn) { alModo = fn; },
      enfocar: function () { area.focus(); },
    };
  };
})();
```

- [ ] **Step 2: Crear `vistas/codigo.js` (Revisar y Explicar)**

```js
/* vistas/codigo.js — Trabajar con mi código: Revisar y Explicar (Generar vive en
   vistas/codigo-generar.js). Código a la izquierda con números de línea y resultados a la
   derecha; al tocar un hallazgo o un paso se marcan sus líneas en el código. */
(function () {
  'use strict';
  var A = window.AsesorStata;
  var N = A.N;
  var u = A.ui;
  var h = u.h;
  var MAX_CODIGO = 20000;

  var EJEMPLO_DO = [
    'use "C:\\Users\\Lindsay\\Desktop\\tesis\\base_epe.dta", clear',
    '',
    'gen edad_cat = 1 if edad < 40',
    'replace edad_cat = 2 if edad >= 40',
    '',
    'tab edad_cat epe, chi2',
    'regress presion edad sexo',
    'logistic epe edad_cat sexo',
  ].join('\n');

  var MODOS = {
    revisar: {
      etiqueta: 'Revisar',
      ayuda: 'Pega tu do-file y te indico errores y mejoras, con la línea donde están y cómo corregirlos.',
      placeholder: 'Pega aquí tu do-file, o súbelo con el botón de abajo…',
      vacio: 'Aquí aparecerán los hallazgos, con la línea de cada uno y cómo corregirlo.',
      frases: ['Leyendo tu código…', 'Buscando notas relacionadas en la base…', 'Redactando los hallazgos…', 'Ordenando los hallazgos…'],
    },
    explicar: {
      etiqueta: 'Explicar',
      ayuda: 'Pega un do-file (tuyo o heredado) y te explico qué hace, paso a paso.',
      placeholder: 'Pega aquí el do-file que quieres entender, o súbelo con el botón de abajo…',
      vacio: 'Aquí aparecerá la explicación, paso a paso.',
      frases: ['Leyendo el do-file…', 'Agrupando las líneas en pasos…', 'Redactando la explicación…'],
    },
    generar: {
      etiqueta: 'Generar',
      ayuda: 'Describe el análisis y escribo el do-file. Después puedes pedir ajustes sobre el resultado.',
      vacio: 'Aquí aparecerá el do-file generado.',
    },
  };

  function contar(n, singular, plural) { return n + ' ' + (n === 1 ? singular : plural); }

  function selectorModo(modo) {
    return h('nav', { class: 'segmentado', 'aria-label': 'Qué quieres hacer con tu código' },
      ['revisar', 'explicar', 'generar'].map(function (m) {
        return h('a', { href: N.construirRuta({ vista: 'codigo', modo: m }), 'aria-current': m === modo ? 'page' : null }, MODOS[m].etiqueta);
      }));
  }

  // Une las tarjetas con el visor: tocar una tarjeta marca sus líneas y mueve el visor hasta
  // ellas; tocar una línea cubierta elige la tarjeta que la cubre (si son varias, las recorre).
  // items: [{ nodo, cab, rango (texto o null), lineas (números) }]
  function enlazarSeleccion(visor, items, total) {
    var actual = -1;
    var todas = [];
    items.forEach(function (it) { todas = todas.concat(it.lineas); });
    visor.cubrir(todas);
    function fijar(i) {
      actual = i;
      items.forEach(function (it, k) {
        it.nodo.classList.toggle('sel', k === i);
        it.cab.setAttribute('aria-pressed', k === i ? 'true' : 'false');
      });
      visor.seleccionar(i === -1 ? [] : items[i].lineas);
      if (i !== -1 && items[i].lineas.length) visor.irA(items[i].lineas[0]);
    }
    items.forEach(function (it, k) {
      it.cab.addEventListener('click', function () { fijar(actual === k ? -1 : k); });
      it.nodo.addEventListener('click', function (e) {
        if (e.target.closest('a, button, pre, .bloque-barra')) return;
        fijar(actual === k ? -1 : k);
      });
    });
    visor.enLinea(function (n) {
      var candidatos = N.hallazgosEnLinea(items.map(function (it) { return it.rango; }), n, total);
      var siguiente = N.siguienteEnCiclo(candidatos, actual);
      if (siguiente === -1) return;
      fijar(siguiente);
      items[siguiente].nodo.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function pintarHallazgos(panel, hallazgos, total, visor) {
    visor.cubrir([]);
    visor.seleccionar([]);
    if (!hallazgos.length) {
      panel.replaceChildren(u.estadoVacio('No encontré nada para observar en este código.', 'Eso no garantiza que esté perfecto: revísalo con calma antes de usarlo.'));
      return;
    }
    var ordenados = hallazgos.slice().sort(function (a, b) {
      return (a.severidad === 'importante' ? 0 : 1) - (b.severidad === 'importante' ? 0 : 1);
    });
    var importantes = ordenados.filter(function (x) { return x.severidad === 'importante'; }).length;
    function informe() { return N.armarInformeRevision(hallazgos, u.hoyIso()); }
    var copiar = h('button', { type: 'button', class: 'btn btn-sec' }, 'Copiar informe');
    copiar.addEventListener('click', function () { u.copiarTexto(informe(), copiar, 'Copiar informe'); });
    var descargar = h('button', { type: 'button', class: 'btn btn-sec', onclick: function () {
      u.descargarArchivo(informe(), 'informe-revision-' + u.hoyIso() + '.md', 'text/markdown');
    } }, u.icono('descargar'), 'Descargar informe (.md)');

    var items = ordenados.map(function (x) {
      var nums = N.lineasDeRango(x.lineas, total);
      var enAlerta = x.severidad === 'importante';
      var cab = h('button', { type: 'button', class: 'hz-cab', 'aria-pressed': 'false' },
        u.icono(enAlerta ? 'alerta' : 'check'),
        h('span', { class: 'hz-sev' }, enAlerta ? 'Importante' : 'Sugerencia'),
        nums.length ? h('span', { class: 'chip' }, N.etiquetaLineas(x.lineas)) : null);
      var cuerpo = h('div', { class: 'hz-cuerpo' },
        h('div', { class: 'hz-que', html: N.inlineMarkdown(x.que) }),
        h('p', { class: 'hz-det' }, h('b', null, 'Por qué: '), h('span', { html: N.inlineMarkdown(x.por_que) })),
        h('p', { class: 'hz-det' }, h('b', null, 'Cómo arreglarlo: '), h('span', { html: N.inlineMarkdown(x.como_arreglar) })));
      if (x.codigo_corregido) cuerpo.appendChild(u.bloqueCodigo(x.codigo_corregido, 'Así quedaría'));
      if (x.nota_citada) {
        var ruta = A.rutaDeNota(x.nota_citada.path);
        cuerpo.appendChild(ruta ? h('a', { class: 'hz-nota', href: ruta }, 'Ver la nota: ' + x.nota_citada.titulo)
          : h('span', { class: 'hz-nota' }, 'Nota relacionada: ' + x.nota_citada.titulo));
      }
      return { nodo: h('article', { class: 'hallazgo hz-' + x.severidad }, cab, cuerpo), cab: cab, rango: x.lineas, lineas: nums };
    });
    panel.replaceChildren(
      h('div', { class: 'res-barra' },
        h('div', { class: 'res-resumen' }, contar(ordenados.length, 'hallazgo', 'hallazgos') + ' · ' + contar(importantes, 'importante', 'importantes') + ' · ' +
          contar(ordenados.length - importantes, 'sugerencia', 'sugerencias')),
        h('div', { class: 'res-acciones' }, copiar, descargar)),
      h('div', { class: 'lista-res' }, items.map(function (it) { return it.nodo; })));
    enlazarSeleccion(visor, items, total);
  }

  function pintarPasos(panel, data, total, visor) {
    visor.cubrir([]);
    visor.seleccionar([]);
    var items = data.pasos.map(function (p, i) {
      var nums = N.lineasDeRango(p.lineas, total);
      var cab = h('button', { type: 'button', class: 'hz-cab', 'aria-pressed': 'false' },
        h('span', { class: 'hz-sev' }, 'Paso ' + (i + 1)),
        nums.length ? h('span', { class: 'chip' }, N.etiquetaLineas(p.lineas)) : null);
      var cuerpo = h('div', { class: 'hz-cuerpo' },
        h('div', { class: 'hz-que', html: N.inlineMarkdown(p.que_hace) }),
        p.ojo ? h('div', { class: 'ojo' }, h('b', null, 'Ojo: '), h('span', { html: N.inlineMarkdown(p.ojo) })) : null);
      return { nodo: h('article', { class: 'hallazgo paso' }, cab, cuerpo), cab: cab, rango: p.lineas, lineas: nums };
    });
    panel.replaceChildren(
      h('div', { class: 'res-resumen-bloque', html: '<p>' + N.inlineMarkdown(data.resumen) + '</p>' }),
      h('div', { class: 'lista-res' }, items.map(function (it) { return it.nodo; })));
    enlazarSeleccion(visor, items, total);
  }

  // Columna izquierda de Revisar y Explicar: el visor, las herramientas y el botón.
  function columnaCodigo(ctx, modo, nivel, estado, panel) {
    var def = MODOS[modo];
    var contador = h('div', { class: 'contador' });
    var editar = h('button', { type: 'button', class: 'ejemplo editar campo-oculto' }, u.icono('lapiz'), 'Editar');
    var visor = u.crearVisor({ placeholder: def.placeholder, etiqueta: 'Tu do-file', alCambiar: function (v) { A.estado.borrador.codigo = v; } });
    visor.enModo(function (m) { editar.classList.toggle('campo-oculto', m === 'edicion'); });
    editar.addEventListener('click', function () { visor.editar(); });
    u.enlazarContador(visor.areaTexto, contador, MAX_CODIGO, 'solo se usarán los primeros ' + MAX_CODIGO.toLocaleString('es-PE') + '.');
    visor.poner(A.estado.borrador.codigo); // recupera lo escrito (por ejemplo, al pasar de Revisar a Explicar)

    var archivo = h('input', { type: 'file', class: 'campo-oculto', accept: '.do,.ado,.txt,text/plain' });
    archivo.addEventListener('change', function () {
      var f = archivo.files && archivo.files[0];
      if (!f) return;
      if (f.size > 500000) { u.estadoLinea(estado, 'error', 'Ese archivo es demasiado grande para un do-file (más de 500 KB).'); archivo.value = ''; return; }
      u.leerArchivoComoTexto(f).then(
        function (t) { visor.poner(t); u.estadoLinea(estado, '', ''); archivo.value = ''; },
        function () { u.estadoLinea(estado, 'error', 'No se pudo leer el archivo.'); });
    });
    var herramientas = h('div', { class: 'herramientas' },
      h('button', { type: 'button', class: 'ejemplo', onclick: function () { archivo.click(); } }, u.icono('subir'), 'Subir archivo .do'),
      h('button', { type: 'button', class: 'ejemplo', onclick: function () { visor.poner(EJEMPLO_DO); visor.enfocar(); } }, 'Probar con un ejemplo'),
      editar, archivo);

    var boton = h('button', { type: 'button', class: 'btn' }, def.etiqueta);
    boton.addEventListener('click', function () {
      var codigo = N.prepararCodigo(visor.valor(), MAX_CODIGO);
      if (!codigo) {
        u.estadoLinea(estado, 'error', modo === 'revisar' ? 'Pega o sube primero el do-file que quieres revisar.' : 'Pega o sube primero el do-file que quieres entender.');
        return;
      }
      A.estado.borrador.codigo = visor.valor();
      boton.disabled = true;
      panel.replaceChildren();
      var detener = u.iniciarEspera(estado, def.frases, true);
      u.pedirJson('/api/asesor-stata-codigo', { modo: modo, nivel: nivel.valor(), codigo: codigo }, 90000)
        .then(function (r) {
          detener();
          boton.disabled = false;
          if (!ctx.activo()) return; // el usuario ya cambió de pantalla
          if (!r.ok || r.data.error) { u.estadoLinea(estado, 'error', r.data.error || 'No se pudo procesar el pedido.'); return; }
          u.estadoLinea(estado, '', '');
          visor.leer(codigo); // el visor muestra el mismo texto que numeró el servidor
          var total = N.dividirLineas(codigo).length;
          if (modo === 'revisar') pintarHallazgos(panel, r.data.hallazgos, total, visor);
          else pintarPasos(panel, r.data, total, visor);
          if (window.matchMedia('(max-width: 900px)').matches) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
        .catch(function (e) {
          detener();
          boton.disabled = false;
          if (ctx.activo()) u.estadoLinea(estado, 'error', u.mensajeDeFallo(e));
        });
    });

    return h('div', { class: 'col-codigo' }, visor.el, contador, herramientas, h('div', { class: 'fila-acciones' }, boton));
  }

  A.vistas.codigo = function (ctx) {
    var modo = ctx.ruta.modo;
    var def = MODOS[modo];
    var generar = A.codigoGenerar;
    if (modo === 'generar' && !generar) {
      ctx.montar(h('div', { class: 'cuerpo' }, u.estadoVacio('Esta pantalla no está disponible.', null, h('a', { class: 'btn', href: '#/codigo/revisar' }, 'Ir a Revisar'))),
        { titulo: 'Código', seccion: 'codigo' });
      return;
    }
    var nivel = u.selectorNivel();
    var estado = h('div', { class: 'linea-estado', role: 'status', 'aria-live': 'polite' });
    var panel = h('div', { class: 'panel-res', 'aria-live': 'polite' }, h('p', { class: 'panel-vacio' }, def.vacio));
    var izquierda = modo === 'generar' ? generar(ctx, { nivel: nivel, estado: estado, panel: panel }) : columnaCodigo(ctx, modo, nivel, estado, panel);
    ctx.montar(h('div', null,
      u.hero({ kicker: 'Código', titulo: 'Trabajar con mi código', texto: def.ayuda }),
      h('div', { class: 'cuerpo cuerpo-flota' }, h('div', { class: 'lienzo' },
        u.avisoPrivacidad(),
        h('div', { class: 'controles' }, selectorModo(modo), nivel.el),
        h('div', { class: 'dividido' }, h('div', { class: 'col-izq' }, izquierda, estado), h('div', { class: 'col-der' }, panel))))),
    { titulo: 'Código · ' + def.etiqueta, seccion: 'codigo' });
  };
})();
```

- [ ] **Step 3: Cargar los scripts**

En `asesor-stata-nuevo.html`, después de `<script src="vistas/radar.js"></script>`, agregar (el visor va **antes** que la vista):

```html
<script src="vistas/visor-codigo.js"></script>
<script src="vistas/codigo.js"></script>
```

- [ ] **Step 4: Agregar los estilos al final de `asesor-stata.css`**

```css

/* ------------------------------------------------------------------ Código */
.lienzo { padding: 1.25rem 1.3rem; border: 1px solid var(--borde); border-radius: var(--radio); background: #fff; box-shadow: var(--sombra); }
.aviso { margin: 0 0 1rem; padding: .75rem .95rem; border-radius: var(--radio-sm); background: var(--superficie); color: var(--muted); font-size: .85rem; }
.aviso strong { color: var(--marino); }
.controles { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .8rem 1.2rem; margin-bottom: 1.1rem; }
.segmentado { display: inline-flex; padding: 3px; border: 1px solid var(--borde); border-radius: 100px; background: var(--superficie); }
.segmentado a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 1.1rem; border-radius: 100px; color: var(--muted); font-weight: 700; text-decoration: none; }
.segmentado a[aria-current="page"] { background: var(--azul); color: #fff; }
.dividido { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 1.3rem; align-items: start; }
@media (max-width: 900px) { .dividido { grid-template-columns: minmax(0, 1fr); } }
.herramientas { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .7rem; }
.herramientas .ejemplo { gap: .4rem; }
.panel-vacio { margin: 0; padding: 1.4rem; border: 1px dashed var(--borde); border-radius: var(--radio-sm); color: var(--muted); }

/* Visor: edición (textarea con canal de números) y lectura (líneas numeradas). */
.visor { overflow: hidden; border: 1px solid #b8c6d8; border-radius: var(--radio-sm); background: #fff; font: 13px/20px var(--fuente-codigo); }
.visor-edicion { display: flex; height: min(60vh, 420px); }
.visor-canal { flex: 0 0 3.4rem; padding: 10px 8px 10px 0; overflow: hidden; background: var(--superficie); color: var(--muted); text-align: right; white-space: pre; user-select: none; }
.visor-texto { flex: 1; min-width: 0; padding: 10px 12px; border: 0; outline: none; resize: none; overflow: auto; background: #fff; color: var(--marino); font: inherit; white-space: pre; }
.visor-lectura { position: relative; max-height: min(60vh, 520px); overflow: auto; }
.vl { display: flex; min-height: 20px; }
.vn { flex: 0 0 3.4rem; padding-right: 8px; background: var(--superficie); color: var(--muted); text-align: right; user-select: none; }
.vt { flex: 1; padding: 0 12px; color: var(--marino); white-space: pre; }
.vl.cubierta { cursor: pointer; }
.vl.cubierta .vn { box-shadow: inset 3px 0 0 var(--azul); color: var(--azul-oscuro); font-weight: 700; }
.vl.sel { background: var(--marca-linea); }
.vl.sel .vn { background: var(--marca-numero); color: var(--marino); }
@media (max-width: 900px) { .visor-edicion { height: 300px; } .visor-lectura { max-height: 45vh; } }

/* Resultados de Revisar y Explicar. */
.res-barra { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .6rem 1rem; margin-bottom: .9rem; }
.res-resumen { font-weight: 700; color: var(--muted); }
.res-acciones { display: flex; flex-wrap: wrap; gap: .5rem; }
.res-resumen-bloque { margin-bottom: .9rem; padding: .9rem 1.1rem; border-radius: var(--radio-sm); background: var(--tinte-azul); }
.res-resumen-bloque p { margin: 0; }
.lista-res { display: flex; flex-direction: column; gap: .7rem; }
.hallazgo { border: 1px solid var(--borde); border-left: 4px solid var(--azul); border-radius: var(--radio-sm); background: #fff; }
.hallazgo.hz-importante { border-left-color: var(--rojo); }
.hallazgo.sel { box-shadow: 0 0 0 2px var(--azul); }
.hz-cab { display: flex; align-items: center; gap: .55rem; width: 100%; min-height: 44px; padding: .4rem 1rem; border: 0; background: none; color: var(--azul-oscuro); font: 700 .78rem var(--fuente-texto); letter-spacing: .05em; text-align: left; text-transform: uppercase; cursor: pointer; }
.hz-importante .hz-cab { color: var(--rojo); }
.hz-cab .chip { letter-spacing: 0; text-transform: none; }
.hz-cuerpo { padding: 0 1rem 1rem; }
.hz-que { margin-bottom: .4rem; font-weight: 700; }
.hz-det { margin: .25rem 0; color: var(--muted); font-size: .92rem; }
.hz-det b { color: var(--marino); }
.hz-nota { display: inline-block; margin-top: .6rem; font-size: .88rem; font-weight: 700; }
.ojo { margin-top: .5rem; padding: .5rem .75rem; border-radius: var(--radio-sm); background: var(--tinte-rojo); color: var(--rojo); font-size: .9rem; }
.hallazgo.paso .hz-cab { color: var(--azul-oscuro); }
```

- [ ] **Step 5: Verificar Revisar y Explicar en el navegador**

Con `node $SERVIDOR --puerto=8792 --csp` en marcha, abrir `http://localhost:8792/asesor-stata-nuevo.html#/` y ejecutar los bloques en orden. Cada bloque define lo mismo al principio (pegarlo completo cada vez).

**5a. Revisar de punta a punta, con selección de líneas y el informe:**

```js
const esperar = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
const real = window.fetch; window.__cuerpos = [];
const RESP = { revisar: { hallazgos: [
  { severidad: 'sugerencia', lineas: '1', que: 'Ruta absoluta en `use`', por_que: 'Solo existe en tu computadora.', como_arreglar: 'Usa una ruta relativa.', codigo_corregido: null, nota_citada: null },
  { severidad: 'importante', lineas: '2-3', que: 'Los missing cuentan como mayores que 40', por_que: '`edad >= 40` incluye perdidos.', como_arreglar: 'Agrega `& !missing(edad)`.', codigo_corregido: 'replace edad_cat = 2 if edad >= 40 & !missing(edad)', nota_citada: { titulo: 'Manejo de datos', path: 'knowledge/data-management/manejo-datos-variables-missing-labels-frames.md' } },
  { severidad: 'sugerencia', lineas: null, que: 'Falta `log using`', por_que: 'Sin registro no se reproduce.', como_arreglar: 'Abre un log al inicio.', codigo_corregido: null, nota_citada: null },
  { severidad: 'sugerencia', lineas: '3', que: 'Sin comentarios', por_que: 'Cuesta entender el paso.', como_arreglar: 'Comenta cada bloque.', codigo_corregido: null, nota_citada: null }] } };
window.fetch = (u, o) => String(u).includes('asesor-stata-codigo')
  ? (window.__cuerpos.push(JSON.parse(o.body)), new Promise(r => setTimeout(() => r(new Response(' ' + JSON.stringify(RESP[JSON.parse(o.body).modo]), { status: 200 })), 400)))
  : real(u, o);
location.hash = '#/codigo/revisar'; await esperar(700);
const out = { pantalla: { h1: $('h1').textContent, modo: $('.segmentado [aria-current]').textContent, nav: $('.nav a[aria-current="page"]').textContent.trim(), botones: [...document.querySelectorAll('.segmentado a')].map(a => a.textContent) } };
[...document.querySelectorAll('.ejemplo')].find(b => /ejemplo/i.test(b.textContent)).click();
out.edicion = { visible: !$('.visor-edicion').classList.contains('campo-oculto'), canal: $('.visor-canal').textContent.split('\n').length, contador: $('.contador').textContent };
$('.col-izq .btn').click(); await esperar(150);
out.espera = { texto: $('.linea-estado').textContent.slice(0, 28), deshabilitado: $('.col-izq .btn').disabled };
await esperar(800);
out.lectura = { visible: !$('.visor-lectura').classList.contains('campo-oculto'), filas: document.querySelectorAll('.vl').length, cubiertas: [...document.querySelectorAll('.vl.cubierta')].map(f => f.dataset.n), editar: !$('.editar').classList.contains('campo-oculto') };
out.tarjetas = [...document.querySelectorAll('.hallazgo')].map(c => c.querySelector('.hz-sev').textContent + ' ' + (c.querySelector('.chip')?.textContent || '-'));
out.resumen = $('.res-resumen').textContent;
out.cuerpo = { claves: Object.keys(window.__cuerpos[0]), nivel: window.__cuerpos[0].nivel, lineas: window.__cuerpos[0].codigo.split('\n').length };
const sel = () => [...document.querySelectorAll('.vl.sel')].map(f => f.dataset.n).join(',');
const t = document.querySelectorAll('.hallazgo');
t[0].querySelector('.hz-cab').click(); const s1 = sel(), p1 = t[0].querySelector('.hz-cab').getAttribute('aria-pressed');
document.querySelector('.vl[data-n="3"]').click(); const s2 = sel();
document.querySelector('.vl[data-n="3"]').click(); const s3 = sel();
document.querySelector('.vl[data-n="1"]').click(); const s4 = sel();
document.querySelector('.vl[data-n="7"]').click(); const s5 = sel();
t[1].querySelector('.hz-cab').click(); const s6 = sel();
out.seleccion = { s1, p1, s2, s3, s4, s5, s6 };
out.nota = $('.hz-nota')?.getAttribute('href').slice(0, 40);
out.codigoCorregido = !!document.querySelector('.hallazgo .bloque-barra');
let blob = null; const crear = URL.createObjectURL; URL.createObjectURL = b => { b.text().then(x => { blob = x; }); return 'blob:x'; };
const clic = HTMLAnchorElement.prototype.click; let nombre = null; HTMLAnchorElement.prototype.click = function () { nombre = this.download; };
[...document.querySelectorAll('.res-acciones .btn')].find(b => /Descargar/.test(b.textContent)).click(); await esperar(200);
URL.createObjectURL = crear; HTMLAnchorElement.prototype.click = clic;
out.informe = { archivo: /^informe-revision-\d{4}-\d{2}-\d{2}\.md$/.test(nombre), cabecera: (blob || '').split('\n')[0], conteo: (blob || '').split('\n')[3] };
$('.editar').click();
out.editar = { edicion: !$('.visor-edicion').classList.contains('campo-oculto'), sinMarcas: document.querySelectorAll('.vl').length === 0 || document.querySelectorAll('.vl.cubierta').length === 0, texto: $('textarea.visor-texto').value === window.__cuerpos[0].codigo, botonEditar: $('.editar').classList.contains('campo-oculto') };
window.fetch = real; out
```
Expected:
- `pantalla: { h1: 'Trabajar con mi código', modo: 'Revisar', nav: 'Código', botones: ['Revisar', 'Explicar', 'Generar'] }`.
- `edicion: { visible: true, canal: 8, contador: '199 / 20,000 caracteres' }`.
- `espera: { texto: 'Leyendo tu código… (0 s)', deshabilitado: true }`.
- `lectura: { visible: true, filas: 8, cubiertas: ['1','2','3'], editar: true }`.
- `tarjetas: ['Importante Líneas 2-3', 'Sugerencia Línea 1', 'Sugerencia -', 'Sugerencia Línea 3']`; `resumen: '4 hallazgos · 1 importante · 3 sugerencias'`.
- `cuerpo: { claves: ['modo','nivel','codigo'], nivel: 'intermedio', lineas: 8 }`.
- `seleccion: { s1: '2,3', p1: 'true', s2: '3', s3: '2,3', s4: '1', s5: '1', s6: '' }` (s2 y s3 comprueban el recorrido cuando dos hallazgos cubren la línea 3; s5, que tocar una línea sin hallazgo no cambia nada).
- `nota` empieza con `'#/aprender/data-management/manejo-datos'`; `codigoCorregido: true`.
- `informe: { archivo: true, cabecera: '# Informe de revisión de código — Asesor Stata', conteo: '4 hallazgos: 1 importante, 3 sugerencias.' }`.
- `editar: { edicion: true, sinMarcas: true, texto: true, botonEditar: true }`.

**5b. Los números de línea coinciden con los del servidor (Review Focus 4):**

```js
const esperar = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
const real = window.fetch; window.__cuerpos = [];
const N = AsesorStata.N;
window.fetch = (u, o) => String(u).includes('asesor-stata-codigo')
  ? (window.__cuerpos.push(JSON.parse(o.body)), Promise.resolve(new Response(JSON.stringify({ hallazgos: [
      { severidad: 'importante', lineas: '4', que: 'a', por_que: 'b', como_arreglar: 'c', codigo_corregido: null, nota_citada: null },
      { severidad: 'sugerencia', lineas: '99', que: 'd', por_que: 'e', como_arreglar: 'f', codigo_corregido: null, nota_citada: null }] }), { status: 200 })))
  : real(u, o);
location.hash = '#/'; await esperar(300); location.hash = '#/codigo/revisar'; await esperar(500);
const area = $('textarea.visor-texto');
const crudo = '\r\n\r\n  use datos, clear\r\n\r\ngen x = 1\r\nreplace x = 2\r\n\r\n';
area.value = crudo; area.dispatchEvent(new Event('input'));
const out = { canalCrudo: $('.visor-canal').textContent.split('\n').length };
$('.col-izq .btn').click(); await esperar(400);
out.enviado = window.__cuerpos[0].codigo === 'use datos, clear\n\ngen x = 1\nreplace x = 2'; // el navegador convierte CRLF en LF al leer un textarea
out.visor = { filas: document.querySelectorAll('.vl').length, primera: $('.vl[data-n="1"] .vt').textContent, cuarta: $('.vl[data-n="4"] .vt').textContent, cubiertas: [...document.querySelectorAll('.vl.cubierta')].map(f => f.dataset.n) };
out.chips = [...document.querySelectorAll('.hallazgo')].map(c => c.querySelector('.chip')?.textContent || '-');
// más de 20 000 caracteres
$('.editar').click();
const largo = 'di "x"\n'.repeat(5000);
$('textarea.visor-texto').value = largo; $('textarea.visor-texto').dispatchEvent(new Event('input'));
out.contador = $('.contador').textContent;
$('.col-izq .btn').click(); await esperar(400);
const enviado = window.__cuerpos[1].codigo;
out.largo = { caracteres: enviado.length, filasVisor: document.querySelectorAll('.vl').length === N.dividirLineas(enviado).length };
window.fetch = real; out
```
Expected: `canalCrudo: 8`; `enviado: true` (un textarea ya entrega LF; el caso CRLF de verdad lo cubre la prueba de `prepararCodigo` de la Tarea 4); `visor: { filas: 4, primera: 'use datos, clear', cuarta: 'replace x = 2', cubiertas: ['4'] }`; `chips: ['Línea 4', '-']` (el rango `99` fuera del archivo no muestra etiqueta ni marca líneas); `contador` contiene `'solo se usarán los primeros 20,000.'`; `largo: { caracteres: 20000, filasVisor: true }`.

**5c. Explicar, con el borrador compartido:**

```js
const esperar = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
const real = window.fetch; window.__cuerpos = [];
const RESP = { explicar: { resumen: 'Abre una base y corre dos modelos.', pasos: [
  { lineas: '1', que_hace: 'Abre la base desde una **ruta absoluta**.', ojo: 'Solo existe en tu computadora.' },
  { lineas: '3-4', que_hace: 'Crea `edad_cat`.', ojo: null },
  { lineas: null, que_hace: 'Paso general', ojo: null }] } };
window.fetch = (u, o) => String(u).includes('asesor-stata-codigo')
  ? (window.__cuerpos.push(JSON.parse(o.body)), Promise.resolve(new Response(JSON.stringify(RESP[JSON.parse(o.body).modo]), { status: 200 })))
  : real(u, o);
location.hash = '#/codigo/revisar'; await esperar(500);
[...document.querySelectorAll('.ejemplo')].find(b => /ejemplo/i.test(b.textContent)).click();
const codigoEscrito = $('textarea.visor-texto').value;
[...document.querySelectorAll('.segmentado a')].find(a => a.textContent === 'Explicar').click(); await esperar(500);
const out = { modo: $('.segmentado [aria-current]').textContent, borrador: $('textarea.visor-texto').value === codigoEscrito, boton: $('.col-izq .btn').textContent, h1: $('h1').textContent };
$('.col-izq .btn').click(); await esperar(400);
out.tarjetas = [...document.querySelectorAll('.hallazgo')].map(c => c.querySelector('.hz-sev').textContent + ' ' + (c.querySelector('.chip')?.textContent || '-'));
out.resumen = $('.res-resumen-bloque').textContent; out.ojos = document.querySelectorAll('.ojo').length; out.negrita = !!$('.hz-que strong');
document.querySelectorAll('.hallazgo')[1].querySelector('.hz-cab').click();
out.seleccion = [...document.querySelectorAll('.vl.sel')].map(f => f.dataset.n).join(',');
out.cuerpo = { modo: window.__cuerpos[0].modo, tieneCodigo: !!window.__cuerpos[0].codigo };
window.fetch = real; out
```
Expected: `modo: 'Explicar'`, `borrador: true`, `boton: 'Explicar'`; `tarjetas: ['Paso 1 Línea 1', 'Paso 2 Líneas 3-4', 'Paso 3 -']`; `resumen: 'Abre una base y corre dos modelos.'`; `ojos: 1`; `negrita: true`; `seleccion: '3,4'`; `cuerpo: { modo: 'explicar', tieneCodigo: true }`.

**5d. Una respuesta tardía no se pinta en otra pantalla (Review Focus 1), errores y botón bloqueado:**

```js
const esperar = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
const real = window.fetch;
location.hash = '#/codigo/revisar'; await esperar(500);
[...document.querySelectorAll('.ejemplo')].find(b => /ejemplo/i.test(b.textContent)).click();
window.fetch = (u, o) => String(u).includes('asesor-stata-codigo')
  ? new Promise(r => setTimeout(() => r(new Response(JSON.stringify({ hallazgos: [] }), { status: 200 })), 800)) : real(u, o);
$('.col-izq .btn').click(); await esperar(150);
location.hash = '#/'; await esperar(1200);          // el usuario se va antes de que llegue
const tardia = { h1: $('h1').textContent, hayResultados: !!$('.res-barra, .panel-res') };
window.fetch = (u, o) => String(u).includes('asesor-stata-codigo')
  ? Promise.resolve(new Response(JSON.stringify({ error: 'La revisión está tardando demasiado. Prueba con un texto más corto o intenta de nuevo.' }), { status: 200 })) : real(u, o);
location.hash = '#/codigo/revisar'; await esperar(500);
$('.col-izq .btn').click(); await esperar(300);
const error = { texto: $('.linea-estado.error')?.textContent, habilitado: !$('.col-izq .btn').disabled, sinResultados: !$('.hallazgo') };
$('textarea.visor-texto').value = '   '; $('textarea.visor-texto').dispatchEvent(new Event('input'));
$('.col-izq .btn').click(); await esperar(100);
const vacio = $('.linea-estado.error')?.textContent;
window.fetch = real; ({ tardia, error, vacio })
```
Expected: `tardia: { h1: '¿Qué necesitas hoy?', hayResultados: false }`; `error: { texto: 'La revisión está tardando demasiado. Prueba con un texto más corto o intenta de nuevo.', habilitado: true, sinResultados: true }`; `vacio: 'Pega o sube primero el do-file que quieres revisar.'`. (Nota: el borrador sigue lleno por el paso anterior, por eso el bloque vacía el texto antes de la última comprobación.)

**5e. Subir un `.do` en Latin-1 y que Generar aún no esté disponible:**

```js
const esperar = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
location.hash = '#/codigo/revisar'; await esperar(500);
const dt = new DataTransfer(); dt.items.add(new File([new Uint8Array([0x61, 0xF1, 0x6F, 0x0A, 0x68, 0x69])], 'viejo.do'));
const entrada = $('.herramientas input[type=file]'); entrada.files = dt.files; entrada.dispatchEvent(new Event('change')); await esperar(300);
const out = { primeraLinea: $('textarea.visor-texto').value.split('\n')[0], canal: $('.visor-canal').textContent.split('\n').length };
const grande = new DataTransfer(); grande.items.add(new File([new Uint8Array(600000)], 'enorme.do'));
entrada.files = grande.files; entrada.dispatchEvent(new Event('change')); await esperar(200);
out.grande = $('.linea-estado.error')?.textContent;
location.hash = '#/codigo/generar'; await esperar(400);
out.generar = $('.vacio-titulo')?.textContent;
out
```
Expected: `primeraLinea: 'año'`, `canal: 2`; `grande: 'Ese archivo es demasiado grande para un do-file (más de 500 KB).'`; `generar: 'Esta pantalla no está disponible.'` (se construye en la Tarea 11).

- [ ] **Step 6: Verificar en 375 px**

En 375 px (`resize_window` preset `mobile`, recargar `#/codigo/revisar` y repetir el principio de 5a): `document.documentElement.scrollWidth > innerWidth` → `false` en modo edición y en modo lectura con resultados; `getComputedStyle(document.querySelector('.dividido')).gridTemplateColumns` tiene una sola columna; el visor mide `≤ 45vh` en lectura. Volver a escritorio y cerrar el servidor.

- [ ] **Step 7: Verificar pruebas y hacer commit**

```bash
for t in tests/test-asesor-stata-markdown.mjs tests/test-asesor-stata-navegacion.mjs tests/test-asesor-stata-fuentes.mjs tests/test-asesor-stata-contraste.mjs; do printf "%-46s" "$t"; node $t | tail -1; done
git add vistas/visor-codigo.js vistas/codigo.js asesor-stata-nuevo.html asesor-stata.css
git commit -m "feat(asesor-stata): visor de código con líneas resaltadas, Revisar y Explicar lado a lado" -m "Co-Authored-By: <modelo vigente> <noreply@anthropic.com>"
```
Expected: `35`, `24`, `4` y `30 pasados`, todos con `0 fallidos`.

---

### Task 11: Generar con ajustes y Entender mis resultados

**Files:**
- Create: `vistas/codigo-generar.js`, `vistas/resultados.js`
- Modify: `asesor-stata-nuevo.html` (dos `<script>`), `asesor-stata.css` (sección al final)

**Interfaces:**
- Consumes: `A.ui` (todo lo ya listado más `bloqueCodigo`, `descargarArchivo`), `A.rutaDeNota(path)`, `A.estado.borrador`, `ctx.activo()`; del núcleo `armarDescripcionGuiada`, `inlineMarkdown`. Endpoints: `POST /api/asesor-stata-codigo` con `{ modo: 'generar', nivel, descripcion, codigo_previo?, ajuste? }` → `{ codigo, explicacion, notas_citadas }`, y con `{ modo: 'interpretar', nivel, salida, contexto? }` → `{ que_se_hizo, resultados: [{ dato, significado }], precauciones: [], como_reportarlo }`; ambos pueden devolver `{ error }`.
- Produces: `A.codigoGenerar(ctx, { nivel, estado, panel })` → nodo de la columna izquierda de Generar (lo usa `A.vistas.codigo` de la Tarea 10) y `A.vistas.resultados` (`#/resultados`).

- [ ] **Step 1: Crear `vistas/codigo-generar.js`**

```js
/* vistas/codigo-generar.js — modo Generar de «Trabajar con mi código»: formulario guiado,
   descripción, resultado (do-file) y ajustes sobre el resultado. La llama vistas/codigo.js. */
(function () {
  'use strict';
  var A = window.AsesorStata;
  var N = A.N;
  var u = A.ui;
  var h = u.h;
  var MAX_DESCRIPCION = 1000;
  var MAX_AJUSTE = 500;
  var EJEMPLOS = [
    ['Tabla 1 por grupo', 'Tabla 1 por grupo (variable grupo): edad con media y desviación estándar, sexo con n y porcentaje, y chi cuadrado para las variables categóricas.'],
    ['Regresión logística con OR', 'Regresión logística de enfermedad (0/1) en edad, sexo e IMC, mostrando odds ratios con intervalos de confianza al 95%.'],
    ['Kaplan-Meier por grupo', 'Curva de supervivencia de Kaplan-Meier por grupo, con prueba log-rank y tabla de número en riesgo.'],
  ];
  var FRASES = ['Entendiendo tu pedido…', 'Buscando notas relacionadas…', 'Escribiendo el do-file…'];
  var FRASES_AJUSTE = ['Leyendo tu código…', 'Aplicando el ajuste…', 'Reescribiendo el do-file…'];
  var SALIDAS = [
    ['tabla 1 por grupo', 'Tabla 1'], ['una prueba de hipótesis', 'Prueba de hipótesis'], ['un modelo de regresión', 'Modelo de regresión'],
    ['un gráfico', 'Gráfico'], ['una tabla lista para el artículo', 'Tabla para el artículo'],
  ];
  var ESTUDIOS = ['Estudio transversal', 'Estudio de casos y controles', 'Estudio de cohorte', 'Ensayo clínico aleatorizado', 'Estudio antes y después'];
  var TIPOS = ['numérica continua', 'sí/no (0/1)', 'categórica de varios niveles', 'tiempo hasta un evento', 'conteo'];

  function opciones(lista, vacio) {
    return (vacio ? [h('option', { value: '' }, vacio)] : []).concat(lista.map(function (t) { return h('option', { value: t }, t); }));
  }

  function formularioGuiado(alArmar) {
    var estudio = h('select', { class: 'campo' }, opciones(ESTUDIOS, '(sin indicar)'));
    var resultado = h('input', { type: 'text', class: 'campo', maxlength: '60', placeholder: 'Ej.: presion_sistolica' });
    var tipo = h('select', { class: 'campo' }, opciones(TIPOS));
    var explicativas = h('input', { type: 'text', class: 'campo', maxlength: '200', placeholder: 'Ej.: edad, sexo, imc' });
    var grupos = h('input', { type: 'text', class: 'campo', maxlength: '60', placeholder: 'Ej.: tratamiento' });
    var casillas = SALIDAS.map(function (s) {
      var c = h('input', { type: 'checkbox', value: s[0] });
      return { entrada: c, nodo: h('label', null, c, s[1]) };
    });
    var armar = h('button', { type: 'button', class: 'ejemplo' }, 'Armar la descripción');
    armar.addEventListener('click', function () {
      alArmar(N.armarDescripcionGuiada({
        estudio: estudio.value, resultado: resultado.value, tipoResultado: resultado.value.trim() ? tipo.value : '',
        explicativas: explicativas.value, grupos: grupos.value,
        salidas: casillas.filter(function (c) { return c.entrada.checked; }).map(function (c) { return c.entrada.value; }),
      }));
    });
    return h('details', { class: 'guia-form' },
      h('summary', null, 'Ayuda guiada: responde unas preguntas y armo la descripción por ti'),
      h('div', { class: 'guia-grid' },
        h('label', null, 'Tipo de estudio', estudio), h('label', null, 'Variable de resultado', resultado),
        h('label', null, 'Tipo del resultado', tipo), h('label', null, 'Variables explicativas', explicativas),
        h('label', null, 'Grupos a comparar', grupos)),
      h('div', { class: 'guia-salidas' }, h('span', { class: 'ejemplos-titulo' }, 'Quiero:'), casillas.map(function (c) { return c.nodo; })),
      armar);
  }

  A.codigoGenerar = function (ctx, comun) {
    var nivel = comun.nivel;
    var estado = comun.estado;
    var panel = comun.panel;
    var ultimaDescripcion = ''; // con la que se generó el código que se ve (los ajustes parten de ella)

    var area = h('textarea', { class: 'campo', maxlength: String(MAX_DESCRIPCION), 'aria-label': 'Descripción del análisis',
      placeholder: 'Describe el análisis. Cuanto más concreto (variables, tipo de estudio, qué quieres reportar), mejor.' });
    var contador = h('div', { class: 'contador' });
    area.value = A.estado.borrador.descripcion;
    area.addEventListener('input', function () { A.estado.borrador.descripcion = area.value; });
    u.enlazarContador(area, contador, MAX_DESCRIPCION, 'se recortará.');

    var guia = formularioGuiado(function (descripcion) {
      if (!descripcion) { u.estadoLinea(estado, 'error', 'Completa al menos un campo del formulario para armar la descripción.'); return; }
      u.estadoLinea(estado, '', '');
      area.value = descripcion;
      area.dispatchEvent(new Event('input'));
      area.focus();
    });
    var ejemplos = h('div', { class: 'ejemplos' }, h('span', { class: 'ejemplos-titulo' }, 'Prueba con:'),
      EJEMPLOS.map(function (e) {
        return h('button', { type: 'button', class: 'ejemplo', onclick: function () { area.value = e[1]; area.dispatchEvent(new Event('input')); area.focus(); } }, e[0]);
      }));
    var boton = h('button', { type: 'button', class: 'btn' }, 'Generar');

    function pintarCodigo(data) {
      var ajuste = h('textarea', { class: 'campo', maxlength: String(MAX_AJUSTE), 'aria-label': '¿Quieres cambiar algo?',
        placeholder: 'Ej.: agrega una tabla por sexo; usa errores estándar robustos; guarda los gráficos como PNG' });
      var aplicar = h('button', { type: 'button', class: 'btn' }, 'Aplicar ajuste');
      aplicar.addEventListener('click', function () {
        var pedido = ajuste.value.trim();
        if (!pedido) { u.estadoLinea(estado, 'error', 'Escribe qué quieres cambiar del código.'); return; }
        enviar({ ajuste: pedido, codigoPrevio: data.codigo });
      });
      var notas = data.notas_citadas.map(function (n) {
        var ruta = A.rutaDeNota(n.path);
        return ruta ? h('a', { class: 'hz-nota', href: ruta }, 'Ver la nota: ' + n.titulo) : h('span', { class: 'hz-nota' }, 'Nota relacionada: ' + n.titulo);
      });
      panel.replaceChildren(h('div', { class: 'gen-res' },
        u.bloqueCodigo(data.codigo, 'Código Stata (do-file)'),
        h('div', { class: 'res-acciones' }, h('button', { type: 'button', class: 'btn btn-sec', onclick: function () {
          u.descargarArchivo(data.codigo, 'analisis.do', 'text/plain');
        } }, u.icono('descargar'), 'Descargar .do')),
        h('p', { class: 'gen-explicacion' }, data.explicacion),
        notas.length ? h('div', { class: 'gen-notas' }, notas) : null,
        h('div', { class: 'ajuste' }, h('div', { class: 'ajuste-titulo' }, '¿Quieres cambiar algo?'), ajuste, aplicar)));
    }

    function enviar(extra) {
      extra = extra || {};
      var descripcion = extra.ajuste ? ultimaDescripcion : area.value.trim();
      if (!descripcion) { u.estadoLinea(estado, 'error', 'Describe primero el análisis que quieres generar.'); return; }
      var cuerpo = { modo: 'generar', nivel: nivel.valor(), descripcion: descripcion };
      if (extra.ajuste) { cuerpo.codigo_previo = extra.codigoPrevio; cuerpo.ajuste = extra.ajuste; }
      boton.disabled = true;
      panel.replaceChildren();
      var detener = u.iniciarEspera(estado, extra.ajuste ? FRASES_AJUSTE : FRASES, false);
      u.pedirJson('/api/asesor-stata-codigo', cuerpo, 90000)
        .then(function (r) {
          detener();
          boton.disabled = false;
          if (!ctx.activo()) return; // el usuario ya cambió de pantalla
          if (!r.ok || r.data.error) { u.estadoLinea(estado, 'error', r.data.error || 'No se pudo procesar el pedido.'); return; }
          u.estadoLinea(estado, '', '');
          ultimaDescripcion = descripcion;
          pintarCodigo(r.data);
          if (window.matchMedia('(max-width: 900px)').matches) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
        .catch(function (e) {
          detener();
          boton.disabled = false;
          if (ctx.activo()) u.estadoLinea(estado, 'error', u.mensajeDeFallo(e));
        });
    }
    boton.addEventListener('click', function () { enviar(); });

    return h('div', { class: 'col-generar' }, guia, area, contador, ejemplos, h('div', { class: 'fila-acciones' }, boton));
  };
})();
```

- [ ] **Step 2: Crear `vistas/resultados.js`**

```js
/* vistas/resultados.js — Entender mis resultados: se pega la salida de Stata y se obtiene
   una interpretación que cita solo los números que aparecen en ella. */
(function () {
  'use strict';
  var A = window.AsesorStata;
  var N = A.N;
  var u = A.ui;
  var h = u.h;
  var MAX_SALIDA = 8000;
  var MAX_CONTEXTO = 500;
  var FRASES = ['Leyendo la salida…', 'Interpretando los resultados…', 'Redactando la explicación…'];
  var EJEMPLO_CONTEXTO = 'Bajo peso al nacer (low) según si la madre fumó (smoke)';
  var EJEMPLO_SALIDA = [
    '. tab smoke low, row chi2',
    '',
    '           |          low',
    '     smoke |         0          1 |     Total',
    '-----------+----------------------+----------',
    '         0 |        86         29 |       115',
    '           |     74.78      25.22 |    100.00',
    '-----------+----------------------+----------',
    '         1 |        44         30 |        74',
    '           |     59.46      40.54 |    100.00',
    '-----------+----------------------+----------',
    '     Total |       130         59 |       189',
    '           |     68.78      31.22 |    100.00',
    '',
    '          Pearson chi2(1) =   4.9237   Pr = 0.026',
  ].join('\n');

  function bloque(titulo, contenido) {
    return h('section', { class: 'interp-bloque' }, h('h2', { class: 'interp-titulo' }, titulo), contenido);
  }

  function pintar(panel, d) {
    var nodos = [bloque('Qué análisis es', h('p', { html: N.inlineMarkdown(d.que_se_hizo) }))];
    if (d.resultados.length) {
      nodos.push(bloque('Qué dicen los números', h('div', null, d.resultados.map(function (r) {
        return h('div', { class: 'resultado' }, h('div', { class: 'resultado-dato' }, r.dato),
          h('div', { class: 'resultado-significado', html: N.inlineMarkdown(r.significado) }));
      }))));
    }
    if (d.precauciones.length) {
      nodos.push(bloque('Precauciones', h('ul', { class: 'precauciones' }, d.precauciones.map(function (p) { return h('li', { html: N.inlineMarkdown(p) }); }))));
    }
    if (d.como_reportarlo) {
      var copiar = h('button', { type: 'button', class: 'btn btn-sec' }, 'Copiar frase');
      copiar.addEventListener('click', function () { u.copiarTexto(d.como_reportarlo, copiar, 'Copiar frase'); });
      nodos.push(bloque('Cómo reportarlo', h('div', null, h('blockquote', { class: 'reporte' }, d.como_reportarlo), copiar)));
    }
    panel.replaceChildren(h('div', { class: 'lienzo' }, nodos));
  }

  A.vistas.resultados = function (ctx) {
    var area = h('textarea', { class: 'campo salida-campo', spellcheck: 'false', wrap: 'off', 'aria-label': 'Salida de Stata',
      placeholder: 'Pega aquí la salida de Stata: una tabla de regresión, un chi cuadrado, un t-test, el resultado de un modelo de Cox…' });
    var contador = h('div', { class: 'contador' });
    var contexto = h('input', { type: 'text', class: 'campo', maxlength: String(MAX_CONTEXTO),
      placeholder: 'Ej.: factores asociados a bajo peso al nacer en un hospital de Lima' });
    var nivel = u.selectorNivel();
    var estado = h('div', { class: 'linea-estado', role: 'status', 'aria-live': 'polite' });
    var panel = h('div', { class: 'panel-res', 'aria-live': 'polite' },
      h('p', { class: 'panel-vacio' }, 'Aquí aparecerá la interpretación: qué análisis es, qué dicen los números y qué cuidados tener.'));
    area.value = A.estado.borrador.salida;
    area.addEventListener('input', function () { A.estado.borrador.salida = area.value; });
    u.enlazarContador(area, contador, MAX_SALIDA, 'solo se usarán los primeros ' + MAX_SALIDA.toLocaleString('es-PE') + '.');

    var ejemplo = h('button', { type: 'button', class: 'ejemplo', onclick: function () {
      area.value = EJEMPLO_SALIDA;
      area.dispatchEvent(new Event('input'));
      contexto.value = EJEMPLO_CONTEXTO;
      area.focus();
    } }, 'Probar con un ejemplo');
    var boton = h('button', { type: 'button', class: 'btn' }, 'Interpretar');
    boton.addEventListener('click', function () {
      var salida = area.value.trim().slice(0, MAX_SALIDA);
      if (!salida) { u.estadoLinea(estado, 'error', 'Pega primero la salida de Stata que quieres interpretar.'); return; }
      var cuerpo = { modo: 'interpretar', nivel: nivel.valor(), salida: salida };
      var ctxto = contexto.value.trim();
      if (ctxto) cuerpo.contexto = ctxto;
      boton.disabled = true;
      panel.replaceChildren();
      var detener = u.iniciarEspera(estado, FRASES, false);
      u.pedirJson('/api/asesor-stata-codigo', cuerpo, 90000)
        .then(function (r) {
          detener();
          boton.disabled = false;
          if (!ctx.activo()) return; // el usuario ya cambió de pantalla
          if (!r.ok || r.data.error) { u.estadoLinea(estado, 'error', r.data.error || 'No se pudo procesar el pedido.'); return; }
          u.estadoLinea(estado, '', '');
          pintar(panel, r.data);
          if (window.matchMedia('(max-width: 900px)').matches) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
        .catch(function (e) {
          detener();
          boton.disabled = false;
          if (ctx.activo()) u.estadoLinea(estado, 'error', u.mensajeDeFallo(e));
        });
    });

    ctx.montar(h('div', null,
      u.hero({ kicker: 'Resultados', titulo: 'Entender mis resultados',
        texto: 'Pega la salida de Stata (una tabla, un modelo, una prueba) y te explico qué dice, citando solo los números que aparecen.' }),
      h('div', { class: 'cuerpo cuerpo-flota' }, h('div', { class: 'lienzo' },
        u.avisoPrivacidad(),
        h('div', { class: 'dividido' },
          h('div', { class: 'col-izq' }, area, contador,
            h('label', { class: 'campo-etiqueta' }, 'Contexto del estudio (opcional, ayuda a interpretar mejor)', contexto),
            h('div', { class: 'herramientas' }, ejemplo),
            h('div', { class: 'fila-acciones' }, nivel.el, boton), estado),
          h('div', { class: 'col-der' }, panel))))),
    { titulo: 'Resultados', seccion: 'resultados' });
  };
})();
```

- [ ] **Step 3: Cargar los scripts**

En `asesor-stata-nuevo.html`, después de `<script src="vistas/codigo.js"></script>`, agregar:

```html
<script src="vistas/codigo-generar.js"></script>
<script src="vistas/resultados.js"></script>
```

- [ ] **Step 4: Agregar los estilos al final de `asesor-stata.css`**

```css

/* ----------------------------------------------------- Generar y Resultados */
details.guia-form { margin-bottom: .9rem; padding: .3rem 1rem; border: 1px solid var(--borde); border-radius: var(--radio-sm); background: var(--superficie); }
details.guia-form > summary { display: flex; align-items: center; min-height: 44px; cursor: pointer; color: var(--azul-oscuro); font-size: .9rem; font-weight: 700; }
.guia-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: .8rem; margin: .5rem 0 .9rem; }
.guia-grid label { display: block; color: var(--muted); font-size: .8rem; font-weight: 700; }
.guia-grid .campo { margin-top: .3rem; font-weight: 400; }
.guia-salidas { display: flex; flex-wrap: wrap; align-items: center; gap: .2rem 1rem; margin-bottom: .9rem; }
.guia-salidas label { display: inline-flex; align-items: center; gap: .4rem; min-height: 44px; cursor: pointer; font-size: .9rem; }
.guia-salidas input { width: 1.1rem; height: 1.1rem; }
.gen-explicacion { margin: .9rem 0; line-height: 1.6; }
.gen-notas { display: flex; flex-direction: column; gap: .3rem; margin-bottom: .8rem; }
.ajuste { margin-top: 1.3rem; padding-top: 1rem; border-top: 1px dashed var(--borde); }
.ajuste-titulo { margin-bottom: .4rem; color: var(--muted); font-size: .78rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
.ajuste .campo { min-height: 72px; margin-bottom: .7rem; }

.salida-campo { min-height: 260px; font-family: var(--fuente-codigo); font-size: .85rem; white-space: pre; }
.campo-etiqueta { display: block; margin-top: .9rem; color: var(--muted); font-size: .8rem; font-weight: 700; }
.campo-etiqueta .campo { margin-top: .3rem; font-weight: 400; }
.interp-bloque { margin-bottom: 1.3rem; }
.interp-bloque:last-child { margin-bottom: 0; }
.interp-titulo { margin: 0 0 .5rem; color: var(--muted); font-family: var(--fuente-texto); font-size: .78rem; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
.interp-bloque p { margin: 0; }
.resultado { margin-bottom: .6rem; padding: .8rem 1rem; border: 1px solid var(--borde); border-radius: var(--radio-sm); background: var(--superficie); }
.resultado-dato { font: 700 .88rem var(--fuente-codigo); word-break: break-word; }
.resultado-significado { margin-top: .3rem; }
.precauciones { margin: 0; padding-left: 1.2rem; }
.precauciones li { margin-bottom: .3rem; }
.reporte { margin: 0 0 .7rem; padding: .8rem 1rem; border-left: 4px solid var(--violeta); border-radius: 0 var(--radio-sm) var(--radio-sm) 0; background: var(--superficie); }
```

- [ ] **Step 5: Verificar Generar en el navegador**

Con `node $SERVIDOR --puerto=8792 --csp` en marcha y la página en `#/`, ejecutar:

```js
const esperar = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
const real = window.fetch; window.__cuerpos = [];
const CODIGO = 'version 18\nsysuse auto, clear\nregress price mpg';
window.fetch = (u, o) => String(u).includes('asesor-stata-codigo')
  ? (window.__cuerpos.push(JSON.parse(o.body)), new Promise(r => setTimeout(() => r(new Response(' ' + JSON.stringify({ codigo: CODIGO, explicacion: 'Corre una regresión simple.',
      notas_citadas: [{ titulo: 'Regresión', path: 'knowledge/regression/regresion-logistica-binaria-multinomial-poisson.md' }, { titulo: 'Inventada', path: 'knowledge/x/no.md' }] }), { status: 200 })), 400)))
  : real(u, o);
location.hash = '#/codigo/generar'; await esperar(700);
const out = { modo: $('.segmentado [aria-current]').textContent, boton: $('.col-generar .btn').textContent, guiaCerrada: $('details.guia-form').open === false };
// vacío
$('.col-generar .btn').click(); await esperar(100);
out.vacio = $('.linea-estado.error')?.textContent;
// formulario guiado
$('.guia-form summary').click();
const campos = document.querySelectorAll('.guia-grid .campo');
campos[0].value = 'Estudio de cohorte'; campos[1].value = 'tiempo_a_muerte'; campos[2].value = 'tiempo hasta un evento'; campos[3].value = 'edad, sexo'; campos[4].value = 'tratamiento';
document.querySelectorAll('.guia-salidas input')[0].checked = true; document.querySelectorAll('.guia-salidas input')[2].checked = true;
[...document.querySelectorAll('.guia-form .ejemplo')].find(b => /Armar/.test(b.textContent)).click();
out.descripcion = $('textarea.campo').value; out.contador = $('.contador').textContent;
// generar
$('.col-generar .btn').click(); await esperar(150);
out.espera = { texto: $('.linea-estado').textContent.slice(0, 32), deshabilitado: $('.col-generar .btn').disabled };
await esperar(700);
out.resultado = { lineas: $('.gen-res pre code').textContent.split('\n').length, botones: [...document.querySelectorAll('.gen-res .btn')].map(b => b.textContent.trim()), explicacion: $('.gen-explicacion').textContent,
  notas: [...document.querySelectorAll('.gen-notas > *')].map(n => n.tagName + ':' + (n.getAttribute('href') || '').slice(0, 24)) };
out.cuerpo1 = { claves: Object.keys(window.__cuerpos[0]), nivel: window.__cuerpos[0].nivel };
const original = window.__cuerpos[0].descripcion;
// ajuste: vacío primero, y con el cuadro de descripción editado a propósito
$('.ajuste .btn').click(); await esperar(100);
out.ajusteVacio = $('.linea-estado.error')?.textContent;
$('textarea.campo').value = 'otra cosa distinta'; $('textarea.campo').dispatchEvent(new Event('input'));
$('.ajuste .campo').value = 'agrega una tabla por sexo';
$('.ajuste .btn').click(); await esperar(800);
const aj = window.__cuerpos[1];
out.ajuste = { claves: Object.keys(aj), usaDescripcionOriginal: aj.descripcion === original, codigo_previo: aj.codigo_previo === CODIGO, ajuste: aj.ajuste };
// descarga del .do
let nombre = null, blob = null; const clic = HTMLAnchorElement.prototype.click; const crear = URL.createObjectURL;
URL.createObjectURL = b => { b.text().then(x => { blob = x; }); return 'blob:x'; }; HTMLAnchorElement.prototype.click = function () { nombre = this.download; };
[...document.querySelectorAll('.gen-res .btn')].find(b => /Descargar/.test(b.textContent)).click(); await esperar(200);
HTMLAnchorElement.prototype.click = clic; URL.createObjectURL = crear;
out.descarga = { nombre, contenido: blob === CODIGO };
window.fetch = real; out
```
Expected:
- `modo: 'Generar'`, `boton: 'Generar'`, `guiaCerrada: true`, `vacio: 'Describe primero el análisis que quieres generar.'`.
- `descripcion: 'Estudio de cohorte. Variable de resultado: tiempo_a_muerte (tiempo hasta un evento). Variables explicativas: edad, sexo. Grupos a comparar: tratamiento. Quiero: tabla 1 por grupo, un modelo de regresión.'` y `contador: '203 / 1,000 caracteres'`.
- `espera: { texto: 'Entendiendo tu pedido… (0 s)', deshabilitado: true }`.
- `resultado: { lineas: 3, botones: ['Copiar', 'Descargar .do', 'Aplicar ajuste'], explicacion: 'Corre una regresión simple.', notas: ['A:#/aprender/regression/reg', 'SPAN:'] }`.
- `cuerpo1: { claves: ['modo','nivel','descripcion'], nivel: 'intermedio' }`.
- `ajusteVacio: 'Escribe qué quieres cambiar del código.'`; `ajuste: { claves: ['modo','nivel','descripcion','codigo_previo','ajuste'], usaDescripcionOriginal: true, codigo_previo: true, ajuste: 'agrega una tabla por sexo' }`.
- `descarga: { nombre: 'analisis.do', contenido: true }`.

- [ ] **Step 6: Verificar Entender mis resultados en el navegador**

```js
const esperar = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
const real = window.fetch; window.__cuerpos = [];
const RESP = { que_se_hizo: 'Un chi cuadrado de asociación entre fumar y **bajo peso** al nacer.',
  resultados: [{ dato: 'Bajo peso: 40.54% en fumadoras vs 25.22% en no fumadoras', significado: 'Las fumadoras tuvieron **más** bajo peso.' }, { dato: 'Pearson chi2(1) = 4.9237, p = 0.026', significado: 'Poco probable por azar.' }],
  precauciones: ['Es una asociación, no prueba causalidad.', 'No ajusta por otras variables.'], como_reportarlo: 'El bajo peso fue más frecuente en hijos de fumadoras (40.5% vs 25.2%; p = 0.026).' };
window.fetch = (u, o) => String(u).includes('asesor-stata-codigo')
  ? (window.__cuerpos.push(JSON.parse(o.body)), new Promise(r => setTimeout(() => r(new Response(JSON.stringify(RESP), { status: 200 })), 400)))
  : real(u, o);
location.hash = '#/resultados'; await esperar(700);
const out = { h1: $('h1').textContent, nav: $('.nav a[aria-current="page"]').textContent.trim() };
$('.col-izq .btn').click(); await esperar(100);
out.vacio = $('.linea-estado.error')?.textContent;
[...document.querySelectorAll('.ejemplo')].find(b => /ejemplo/i.test(b.textContent)).click();
out.ejemplo = { lineas: $('textarea.campo').value.split('\n').length, contexto: $('.campo-etiqueta input').value, contador: $('.contador').textContent };
$('.col-izq .btn').click(); await esperar(150);
out.espera = { texto: $('.linea-estado').textContent.slice(0, 30), deshabilitado: $('.col-izq .btn').disabled };
await esperar(700);
out.interpretacion = { titulos: [...document.querySelectorAll('.interp-titulo')].map(t => t.textContent), resultados: document.querySelectorAll('.resultado').length,
  precauciones: document.querySelectorAll('.precauciones li').length, frase: $('.reporte').textContent.slice(0, 28), negrita: !!$('.interp-bloque strong'), copiar: [...document.querySelectorAll('.panel-res .btn')].map(b => b.textContent) };
out.cuerpo = { claves: Object.keys(window.__cuerpos[0]), modo: window.__cuerpos[0].modo, contexto: window.__cuerpos[0].contexto };
// límite de 8 000 caracteres
$('textarea.campo').value = 'a'.repeat(9000); $('textarea.campo').dispatchEvent(new Event('input'));
out.limite = $('.contador').textContent;
$('.col-izq .btn').click(); await esperar(700);
out.recortada = window.__cuerpos[1].salida.length;
window.fetch = real; out
```
Expected: `h1: 'Entender mis resultados'`, `nav: 'Resultados'`, `vacio: 'Pega primero la salida de Stata que quieres interpretar.'`; `ejemplo: { lineas: 15, contexto: 'Bajo peso al nacer (low) según si la madre fumó (smoke)', contador: '563 / 8,000 caracteres' }`; `espera: { texto: 'Leyendo la salida… (0 s)', deshabilitado: true }`; `interpretacion: { titulos: ['Qué análisis es','Qué dicen los números','Precauciones','Cómo reportarlo'], resultados: 2, precauciones: 2, frase: 'El bajo peso fue más frecuen', negrita: true, copiar: ['Copiar frase'] }`; `cuerpo: { claves: ['modo','nivel','salida','contexto'], modo: 'interpretar', contexto: 'Bajo peso al nacer (low) según si la madre fumó (smoke)' }`; `limite` contiene `'solo se usarán los primeros 8,000.'`; `recortada: 8000`.

Repetir en 375 px comprobando `scrollWidth > innerWidth` → `false` en `#/codigo/generar` (con resultado) y `#/resultados` (con interpretación). Cerrar el servidor.

- [ ] **Step 7: Verificar pruebas, hacer commit y subir la rama (fin de la etapa 4)**

```bash
for t in tests/test-asesor-stata-markdown.mjs tests/test-asesor-stata-navegacion.mjs tests/test-asesor-stata-fuentes.mjs tests/test-asesor-stata-contraste.mjs; do printf "%-46s" "$t"; node $t | tail -1; done
git add vistas/codigo-generar.js vistas/resultados.js asesor-stata-nuevo.html asesor-stata.css
git commit -m "feat(asesor-stata): Generar con formulario guiado y ajustes, y Entender mis resultados" -m "Co-Authored-By: <modelo vigente> <noreply@anthropic.com>"
git push
```
Expected: `35`, `24`, `4` y `30 pasados`, todos con `0 fallidos`. La subida solo si fue autorizada (Tarea 0).

---
### Task 12: Cambio de nombres, limpieza, documentación y verificación final

**Files:**
- Delete: `asesor-stata.html` y `asesor-stata.js` (viejos)
- Rename: `asesor-stata-nuevo.html` → `asesor-stata.html`; `asesor-stata-app.js` → `asesor-stata.js`
- Modify: `asesor-stata-nucleo.js` (quitar `separarNotaInterna` y `escapeHtml` si ninguna vista los usa), `README.md`, `.gitignore`, memoria del asistente
- Test: todas las pruebas de `tests/`

**Interfaces:**
- Consumes: todo lo producido por las Tareas 1–11.
- Produces: la página final en `asesor-stata.html` (la URL que ya usan las 3 personas y el enlace de `index.html`), sin archivos de transición.

- [ ] **Step 1: Buscar usos antes de borrar nada**

```bash
grep -rn "separarNotaInterna\|escapeHtml" asesor-stata-app.js vistas/ asesor-stata-nuevo.html tests/ | grep -v "^tests/test-asesor-stata-markdown"
grep -rn "asesor-stata-nuevo\|asesor-stata-app" --include=*.html --include=*.js --include=*.mjs --include=*.json --include=*.md . | grep -v "^./.superpowers\|^./docs/superpowers/plans"
```
Expected: la primera búsqueda no muestra ninguna vista que use esas dos funciones (si alguna aparece, **no** se borra esa función); la segunda lista solo `asesor-stata-nuevo.html` (su propia referencia a `asesor-stata-app.js`) y `tests/` si alguna prueba carga la página.

- [ ] **Step 2: Cambiar los nombres**

```bash
git rm -q asesor-stata.html asesor-stata.js
git mv asesor-stata-nuevo.html asesor-stata.html
git mv asesor-stata-app.js asesor-stata.js
sed -i 's#asesor-stata-app\.js#asesor-stata.js#' asesor-stata.html
grep -n "<script\|<link" asesor-stata.html
```
Expected: los `<script>` apuntan a `asesor-stata-nucleo.js`, `asesor-stata.js` y a `vistas/*.js`; el `<link>` a `asesor-stata.css` y a `fonts/fonts.css`; ninguna referencia a `-nuevo` ni a `-app`.

- [ ] **Step 3: Quitar el código sin uso del núcleo**

Si el paso 1 confirmó que `separarNotaInterna` y `escapeHtml` no se usan fuera de las pruebas, borrar sus definiciones y sus entradas en el objeto exportado de `asesor-stata-nucleo.js`, y quitar de `tests/test-asesor-stata-markdown.mjs` las pruebas que solo cubrían esas dos funciones. Después:

```bash
node tests/test-asesor-stata-markdown.mjs | tail -1
```
Expected: `N pasados, 0 fallidos` (N baja de 35 solo por las pruebas retiradas; anotar el número nuevo y usarlo en los pasos siguientes).

- [ ] **Step 4: Actualizar la documentación**

En `README.md`, en el párrafo de Asesor Stata, reemplazar la descripción de la interfaz por: «Interfaz de una sola página con rutas por `#` (`asesor-stata.html` + `asesor-stata.js` + una vista por archivo en `vistas/`), núcleo de funciones puras en `asesor-stata-nucleo.js`, estilos en `asesor-stata.css` y fuentes propias en `fonts/` (la política de seguridad bloquea las de Google).» Agregar la ruta del diseño: `docs/superpowers/specs/2026-10-07-asesor-stata-rediseno-frontend-design.md` y la lista de pruebas (`node tests/test-asesor-stata-*.mjs`).

Verificar:

```bash
grep -n "nuevo\|asesor-stata-app" README.md docs/superpowers/specs/2026-10-07-asesor-stata-rediseno-frontend-design.md || echo "sin referencias de transición"
```
Expected: `sin referencias de transición`.

- [ ] **Step 5: Correr todas las pruebas**

```bash
for t in tests/test-asesor-stata-*.mjs; do printf "%-48s" "$t"; node "$t" | tail -1; done
```
Expected: cero fallidos en cada archivo: `markdown` (N del paso 3), `navegacion` 24, `fuentes` 4, `contraste` 30, y las pruebas de la API que ya existían (`codigo` 34, `consulta` 16, `base` 13, `relevancia` 8, `github` 5, estas con su nombre real en `tests/`).

- [ ] **Step 6: Verificación final de no regresión (navegador, servidor local con CSP)**

Con `node $SERVIDOR --puerto=8792 --csp`, abrir `http://localhost:8792/asesor-stata.html` y comprobar cada punto, con los endpoints simulados como en las Tareas 8 a 11 (`window.fetch` reemplazado):

| # | Función conservada | Cómo se comprueba | Esperado |
|---|---|---|---|
| 1 | Inicio por tareas | `#/` | 4 tarjetas de tarea + accesos a Aprender y Radar; sin errores en consola |
| 2 | Lista de guías con filtro por tema | `#/aprender`, elegir un tema | Solo guías de ese tema; el resumen técnico y la frase «En simple» visibles |
| 3 | Leer una guía y su navegación | abrir una guía | Índice lateral, secciones, «Anterior/Siguiente» sin enlaces rotos |
| 4 | Radar | `#/radar` y una nota | Notas con fecha; la nota abre en formato artículo |
| 5 | Preguntar con y sin notas relevantes | `#/preguntar` | Respuesta con fuentes, o el aviso `MENSAJE_SIN_NOTAS` |
| 6 | Revisar, Explicar, Generar con ajuste e Interpretar | `#/codigo/*`, `#/resultados` | Los pasos 5a–5e de la Tarea 10 y 5–6 de la Tarea 11 vuelven a dar lo esperado |
| 7 | Copiar, descargar `.do` e informe `.md`, subir `.do` | botones | Textos «¡Copiado!», archivos con el nombre correcto |
| 8 | Selector de nivel en todas las pantallas que lo usan | `nivel` en los cuerpos enviados | `principiante`, `intermedio` o `avanzado` según lo elegido |
| 9 | Enlaces antiguos `#nota=<ruta>` | `#nota=knowledge%2Fregression%2F...` con una nota existente, una inexistente y una mal formada | Existente: abre la guía y la URL pasa a `#/aprender/...`; las otras dos: Inicio con aviso |
| 10 | Borradores entre pantallas | escribir en Revisar, pasar a Explicar | El código se conserva |
| 11 | Teclado | recorrer `#/` con Tab | Foco visible de 2 px, orden lógico, sin trampas |
| 12 | Movimiento reducido | `matchMedia('(prefers-reduced-motion: reduce)')` activado en emulación | Sin transiciones ni animaciones |

Comprobaciones de medidas, en una consola de la página, en cada una de las 8 rutas (`#/`, `#/aprender`, una guía, `#/preguntar`, `#/codigo/revisar`, `#/codigo/generar`, `#/resultados`, `#/radar`):

```js
const esperar = ms => new Promise(r => setTimeout(r, ms));
const rutas = ['#/', '#/aprender', '#/preguntar', '#/codigo/revisar', '#/codigo/explicar', '#/codigo/generar', '#/resultados', '#/radar'];
const informe = {};
for (const r of rutas) {
  location.hash = r; await esperar(900);
  const chicos = [...document.querySelectorAll('a, button, select, summary, input:not([type=file]), textarea')]
    .filter(el => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.height < 44 && !el.closest('.campo-oculto') && getComputedStyle(el).display !== 'inline'; })
    .map(el => el.tagName + '.' + el.className.toString().split(' ')[0] + ' ' + Math.round(el.getBoundingClientRect().height));
  informe[r] = { chicos, desborde: document.documentElement.scrollWidth > innerWidth, errores: 0 };
}
informe
```
Expected: `chicos: []` y `desborde: false` en las 8 rutas; los enlaces de texto dentro de párrafos (`display: inline`) se excluyen a propósito.

Repetir en 375 px (`resize_window` preset `mobile`, recargando antes de cada ruta): `desborde: false` en las 8 rutas y las columnas de `.dividido` en una sola. Volver a escritorio.

Con `read_console_messages` (`onlyErrors: true`) en todo el recorrido: **ninguna** violación de CSP ni error.

Fuentes bajo CSP real: en `#/`, ejecutar

```js
await document.fonts.ready;
[...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight)
```
Expected: aparecen `Syne 800` (o `700`) y `DM Sans 400` como mínimo; esto es lo que no ocurría en producción antes del rediseño.

- [ ] **Step 7: Actualizar la memoria del asistente**

Editar `C:\Users\ASUS\.claude\projects\C--Users-ASUS-Desktop-Claude\memory\asesor-stata-web.md` para reflejar: rediseño del frontend hecho (rutas por `#`, núcleo + vistas, fuentes propias por CSP, tokens de contraste con prueba), dónde está el diseño y el plan, y qué falta de parte del usuario (probar con DeepSeek real, ejecutar los ejemplos en Stata, revisar las frases del Radar). Mantener la línea del índice `MEMORY.md` en una sola línea. Esto es memoria local, no va al repositorio.

- [ ] **Step 8: Commit de la etapa final**

```bash
git add -A asesor-stata.html asesor-stata.js asesor-stata-nucleo.js tests/ README.md .gitignore
git status --short
git commit -m "feat(asesor-stata): rediseño del frontend en producción (cambio de nombres, limpieza y documentación)" -m "Co-Authored-By: <modelo vigente> <noreply@anthropic.com>"
```
Expected: `git status --short` no muestra `.superpowers/` (está en `.gitignore`) ni archivos con `-nuevo` o `-app`.

- [ ] **Step 9: Vista previa en Vercel y publicación (solo con la aprobación del usuario)**

1. `git push` de la rama y esperar el estado `success` de la vista previa de Vercel. Abrir la URL de vista previa y repetir los puntos 1, 5, 6 y 9 de la tabla del paso 6 con los endpoints **reales** (con las variables de entorno de Preview definidas en la Tarea 0): una pregunta en Preguntar, un Revisar con el ejemplo y un Interpretar con el ejemplo.
2. Mostrar al usuario el resultado y pedirle su aprobación explícita para publicar.
3. Con esa aprobación: `git checkout main && git merge --ff-only rediseno-asesor-stata && git push`. Esperar el estado `success` del despliegue de producción y repetir allí los puntos 1 y 9 y la comprobación de fuentes.
4. Si algo falla en producción, volver atrás con `git revert` de la fusión (no con reescritura de historia) y avisar.

---
