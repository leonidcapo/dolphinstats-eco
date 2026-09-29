# Frontend + backend web para Asesor Stata — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Darle a Asesor Stata una interfaz web de solo lectura dentro de `dolphinstats-eco` — explorar la base de conocimiento guardada y consultarla con síntesis por LLM — sin tocar el repo `asesor-stata` en sí.

**Architecture:** Dos Vercel Edge Functions nuevas (`api/asesor-stata-base.js`, `api/asesor-stata-consulta.js`) que leen el repo privado `leonidcapo/asesor-stata` vía API de GitHub (token de solo lectura en variable de entorno) y, para la consulta, sintetizan con DeepSeek. Una página estática nueva (`asesor-stata.html` + `asesor-stata.js`) consume esas dos funciones. Mismo patrón que `api/clasificar-diseno.js` + `calculadora-muestra.html/js` ya existentes en el repo: sin build, sin dependencias nuevas, Basic Auth y CSP del sitio ya cubren todo esto.

**Tech Stack:** Vercel Edge Functions (JS, runtime `edge`), HTML/CSS/JS vanilla sin build, Node.js `--test`-less scripts con `node:assert/strict` para los tests (mismo patrón que `api/tests/test-clasificar-diseno.mjs`).

## Global Constraints

- Sin build step: el proyecto es HTML/JS estático + Vercel Edge Functions (`vercel.json`/README actuales).
- Sin dependencias nuevas (ni npm ni CDN): todo el código es local, sin excepciones — mismo criterio que `calculadora-muestra.js` ("sin scipy").
- CSP del sitio (`vercel.json`) exige `script-src 'self'` y `connect-src 'self'`: ningún fetch a GitHub/DeepSeek puede salir del navegador; solo desde las Edge Functions.
- El Basic Auth de `middleware.js` ya cubre todo el sitio, incluido `/api/*` — no hay que agregar auth propia.
- Ninguna función rompe sin capturar: siempre responde JSON con `{ error }` y el status HTTP correspondiente (503 config faltante, 502 upstream falló, 400 input inválido, 404 no encontrado, 405 método no permitido) — mismo criterio que `api/clasificar-diseno.js`.
- Tests: un archivo `.mjs` por módulo nuevo, `fetch` global mockeado, sin tokens/keys reales, corridos con `node <archivo>.mjs`.
- Esta interfaz es de **solo lectura** — nunca escribe al repo `asesor-stata`.

---

### Task 1: Cliente GitHub compartido

**Files:**
- Create: `api/_lib/asesor-stata-github.js`
- Test: `api/tests/test-asesor-stata-github.mjs`

**Interfaces:**
- Produces: `GithubError` (clase de error), `fetchFileRaw(token, path) -> Promise<string|null>` (contenido crudo de un archivo del repo, o `null` si no existe), `fetchKnowledgeTree(token) -> Promise<string[]>` (paths de todos los `.md` bajo `knowledge/`, lanza `GithubError` si la rama no existe o la API falla).

- [ ] **Step 1: Escribir el test (falla porque el módulo no existe todavía)**

Crear `api/tests/test-asesor-stata-github.mjs`:

```js
// Pruebas de api/_lib/asesor-stata-github.js con fetch global mockeado.
// Correr con: node api/tests/test-asesor-stata-github.mjs
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const LIB_URL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '_lib', 'asesor-stata-github.js');

function mockFetchOnce(impl) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return function restore() { globalThis.fetch = original; };
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
  const { fetchFileRaw, fetchKnowledgeTree, GithubError } = await import('file://' + LIB_URL.replace(/\\/g, '/') + '?t=' + Date.now());

  await test('fetchFileRaw: archivo existente devuelve el texto', async () => {
    const restore = mockFetchOnce(async (url, opts) => {
      assert.equal(url, 'https://api.github.com/repos/leonidcapo/asesor-stata/contents/INDEX.md');
      assert.equal(opts.headers.Authorization, 'Bearer fake-token');
      return new Response('# Índice', { status: 200 });
    });
    const texto = await fetchFileRaw('fake-token', 'INDEX.md');
    restore();
    assert.equal(texto, '# Índice');
  });

  await test('fetchFileRaw: 404 devuelve null', async () => {
    const restore = mockFetchOnce(async () => new Response('no encontrado', { status: 404 }));
    const texto = await fetchFileRaw('fake-token', 'knowledge/no-existe.md');
    restore();
    assert.equal(texto, null);
  });

  await test('fetchFileRaw: error HTTP lanza GithubError', async () => {
    const restore = mockFetchOnce(async () => new Response('error', { status: 500 }));
    await assert.rejects(() => fetchFileRaw('fake-token', 'INDEX.md'), GithubError);
    restore();
  });

  await test('fetchKnowledgeTree: filtra solo blobs .md bajo knowledge/', async () => {
    const restore = mockFetchOnce(async () => new Response(JSON.stringify({
      tree: [
        { type: 'blob', path: 'knowledge/sampling/nota-1.md' },
        { type: 'blob', path: 'knowledge/sampling/nota-2.md' },
        { type: 'blob', path: 'README.md' },
        { type: 'tree', path: 'knowledge/sampling' },
        { type: 'blob', path: 'docs/2026-09-28-algo.md' },
      ],
    }), { status: 200 }));
    const paths = await fetchKnowledgeTree('fake-token');
    restore();
    assert.deepEqual(paths, ['knowledge/sampling/nota-1.md', 'knowledge/sampling/nota-2.md']);
  });

  await test('fetchKnowledgeTree: rama no encontrada lanza GithubError', async () => {
    const restore = mockFetchOnce(async () => new Response('no encontrado', { status: 404 }));
    await assert.rejects(() => fetchKnowledgeTree('fake-token'), GithubError);
    restore();
  });

  console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
  process.exit(fallidos > 0 ? 1 : 0);
}

main();
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `node api/tests/test-asesor-stata-github.mjs`
Expected: FALLA (error al importar `api/_lib/asesor-stata-github.js` — el archivo no existe).

- [ ] **Step 3: Crear el módulo**

Crear `api/_lib/asesor-stata-github.js`:

```js
// api/_lib/asesor-stata-github.js — cliente mínimo de la API de GitHub para
// leer el repo privado leonidcapo/asesor-stata (solo lectura). Compartido por
// api/asesor-stata-base.js y api/asesor-stata-consulta.js.

var REPO = 'leonidcapo/asesor-stata';
var API_BASE = 'https://api.github.com';

export function GithubError(mensaje) {
  this.message = mensaje;
  this.name = 'GithubError';
}
GithubError.prototype = Object.create(Error.prototype);

async function githubRequest(pathAndQuery, token, accept) {
  var res = await fetch(API_BASE + pathAndQuery, {
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new GithubError('GitHub API respondió ' + res.status);
  return res;
}

export async function fetchFileRaw(token, path) {
  var res = await githubRequest('/repos/' + REPO + '/contents/' + path, token, 'application/vnd.github.raw+json');
  if (res === null) return null;
  return await res.text();
}

export async function fetchKnowledgeTree(token) {
  var res = await githubRequest('/repos/' + REPO + '/git/trees/master?recursive=1', token, 'application/vnd.github+json');
  if (res === null) throw new GithubError('No se encontró la rama master del repo');
  var data = await res.json();
  return (data.tree || [])
    .filter(function (item) {
      return item.type === 'blob' && item.path.indexOf('knowledge/') === 0 && item.path.slice(-3) === '.md';
    })
    .map(function (item) { return item.path; });
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `node api/tests/test-asesor-stata-github.mjs`
Expected: `5 pasados, 0 fallidos`

- [ ] **Step 5: Commit**

```bash
git add api/_lib/asesor-stata-github.js api/tests/test-asesor-stata-github.mjs
git commit -m "feat(asesor-stata): cliente GitHub compartido para leer el repo privado"
```

---

### Task 2: `api/asesor-stata-base.js` — índice y notas (modo Explorar)

**Files:**
- Create: `api/asesor-stata-base.js`
- Test: `api/tests/test-asesor-stata-base.mjs`

**Interfaces:**
- Consumes: `fetchFileRaw`, `GithubError` de `./​_lib/asesor-stata-github.js` (Task 1).
- Produces: handler `default` (Edge Function GET), `parseIndex(markdown) -> { temas: [{ nombre, notas: [{ titulo, path, resumen }] }] }` (exportado para test directo). Respuestas: `GET /api/asesor-stata-base` → `{ temas }`; `GET /api/asesor-stata-base?nota=<path>` → `{ path, markdown }`.

- [ ] **Step 1: Escribir el test (falla porque el handler no existe todavía)**

Crear `api/tests/test-asesor-stata-base.mjs`:

```js
// Pruebas de api/asesor-stata-base.js con fetch global mockeado -- sin
// ASESOR_STATA_GITHUB_TOKEN real.
// Correr con: node api/tests/test-asesor-stata-base.mjs
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HANDLER_URL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'asesor-stata-base.js');

function req(query, method) {
  const qs = query ? '?' + new URLSearchParams(query).toString() : '';
  return new Request('http://localhost/api/asesor-stata-base' + qs, { method: method || 'GET' });
}

function mockFetchOnce(impl) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return function restore() { globalThis.fetch = original; };
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

const INDEX_EJEMPLO = '# Índice — Asesor Stata\n\n' +
  '## survival-analysis\n' +
  '- [xtdhazard y cfbinout](knowledge/survival-analysis/xtdhazard-cfbinout.md) — IV por own-differences.\n\n' +
  '## panel-data\n' +
  '_(sin notas aún)_\n';

async function main() {
  process.env.ASESOR_STATA_GITHUB_TOKEN = ''; // vacío a propósito para el primer test
  const { default: handler, parseIndex } = await import('file://' + HANDLER_URL.replace(/\\/g, '/') + '?t=' + Date.now());

  await test('parseIndex: agrupa notas por tema y arma temas vacíos', () => {
    const indice = parseIndex(INDEX_EJEMPLO);
    assert.equal(indice.temas.length, 2);
    assert.equal(indice.temas[0].nombre, 'survival-analysis');
    assert.equal(indice.temas[0].notas.length, 1);
    assert.equal(indice.temas[0].notas[0].titulo, 'xtdhazard y cfbinout');
    assert.equal(indice.temas[0].notas[0].path, 'knowledge/survival-analysis/xtdhazard-cfbinout.md');
    assert.equal(indice.temas[0].notas[0].resumen, 'IV por own-differences.');
    assert.equal(indice.temas[1].nombre, 'panel-data');
    assert.equal(indice.temas[1].notas.length, 0);
  });

  await test('sin token -> 503, no llama a fetch', async () => {
    const restore = mockFetchOnce(() => { throw new Error('no debería llamarse'); });
    const res = await handler(req());
    restore();
    assert.equal(res.status, 503);
  });

  process.env.ASESOR_STATA_GITHUB_TOKEN = 'fake-token';

  await test('método POST -> 405', async () => {
    const res = await handler(req(undefined, 'POST'));
    assert.equal(res.status, 405);
  });

  await test('sin ?nota -> 200 con el índice parseado', async () => {
    const restore = mockFetchOnce(async () => new Response(INDEX_EJEMPLO, { status: 200 }));
    const res = await handler(req());
    restore();
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.temas.length, 2);
  });

  await test('INDEX.md no encontrado -> 200 con índice vacío', async () => {
    const restore = mockFetchOnce(async () => new Response('no encontrado', { status: 404 }));
    const res = await handler(req());
    restore();
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data.temas, []);
  });

  await test('?nota con path inválido -> 400', async () => {
    const res = await handler(req({ nota: 'README.md' }));
    assert.equal(res.status, 400);
  });

  await test('?nota existente -> 200 con el markdown', async () => {
    const restore = mockFetchOnce(async () => new Response('# Una nota', { status: 200 }));
    const res = await handler(req({ nota: 'knowledge/sampling/nota.md' }));
    restore();
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.markdown, '# Una nota');
    assert.equal(data.path, 'knowledge/sampling/nota.md');
  });

  await test('?nota inexistente -> 404', async () => {
    const restore = mockFetchOnce(async () => new Response('no encontrado', { status: 404 }));
    const res = await handler(req({ nota: 'knowledge/sampling/no-existe.md' }));
    restore();
    assert.equal(res.status, 404);
  });

  await test('error de GitHub -> 502', async () => {
    const restore = mockFetchOnce(async () => new Response('error', { status: 500 }));
    const res = await handler(req());
    restore();
    assert.equal(res.status, 502);
  });

  console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
  process.exit(fallidos > 0 ? 1 : 0);
}

main();
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `node api/tests/test-asesor-stata-base.mjs`
Expected: FALLA (el archivo `api/asesor-stata-base.js` no existe).

- [ ] **Step 3: Crear el handler**

Crear `api/asesor-stata-base.js`:

```js
// api/asesor-stata-base.js — Vercel Edge Function: índice y notas de la base
// de conocimiento de Asesor Stata (repo privado leonidcapo/asesor-stata),
// para el modo "Explorar" de la página asesor-stata.html. Solo lectura.
//
// Requiere ASESOR_STATA_GITHUB_TOKEN (Personal Access Token de solo lectura
// sobre ese repo) en Vercel -> Settings -> Environment Variables. Sin el
// token, responde 503 con un mensaje honesto en vez de romper.

import { fetchFileRaw, GithubError } from './_lib/asesor-stata-github.js';

export const config = { runtime: 'edge' };

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function parseIndex(markdown) {
  var lineas = markdown.split('\n');
  var temas = [];
  var actual = null;
  for (var i = 0; i < lineas.length; i++) {
    var linea = lineas[i];
    var temaMatch = linea.match(/^##\s+(.+)$/);
    if (temaMatch) {
      actual = { nombre: temaMatch[1].trim(), notas: [] };
      temas.push(actual);
      continue;
    }
    if (!actual) continue;
    var notaMatch = linea.match(/^-\s*\[(.+?)\]\((.+?)\)(?:\s*—\s*(.*))?$/);
    if (notaMatch) {
      actual.notas.push({
        titulo: notaMatch[1].trim(),
        path: notaMatch[2].trim(),
        resumen: (notaMatch[3] || '').trim(),
      });
    }
  }
  return { temas: temas };
}

export default async function handler(request) {
  if (request.method !== 'GET') {
    return jsonResponse(405, { error: 'Método no permitido.' });
  }

  const token = process.env.ASESOR_STATA_GITHUB_TOKEN;
  if (!token) {
    return jsonResponse(503, { error: 'La base de conocimiento no está disponible en este momento.' });
  }

  const url = new URL(request.url);
  const nota = url.searchParams.get('nota');

  try {
    if (nota) {
      if (nota.indexOf('knowledge/') !== 0 || nota.slice(-3) !== '.md') {
        return jsonResponse(400, { error: 'Ruta de nota inválida.' });
      }
      const markdown = await fetchFileRaw(token, nota);
      if (markdown === null) {
        return jsonResponse(404, { error: 'No se encontró esa nota.' });
      }
      return jsonResponse(200, { path: nota, markdown: markdown });
    }

    const indexText = await fetchFileRaw(token, 'INDEX.md');
    const indice = parseIndex(indexText || '');
    return jsonResponse(200, indice);
  } catch (e) {
    return jsonResponse(502, { error: 'No se pudo conectar con la base de conocimiento. Intenta de nuevo.' });
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `node api/tests/test-asesor-stata-base.mjs`
Expected: `9 pasados, 0 fallidos`

- [ ] **Step 5: Commit**

```bash
git add api/asesor-stata-base.js api/tests/test-asesor-stata-base.mjs
git commit -m "feat(asesor-stata): endpoint de índice y notas (modo Explorar)"
```

---

### Task 3: `api/asesor-stata-consulta.js` — consulta con síntesis por LLM (modo Buscar)

**Files:**
- Create: `api/asesor-stata-consulta.js`
- Test: `api/tests/test-asesor-stata-consulta.mjs`

**Interfaces:**
- Consumes: `fetchFileRaw`, `fetchKnowledgeTree`, `GithubError` de `./_lib/asesor-stata-github.js` (Task 1).
- Produces: handler `default` (Edge Function POST). `POST /api/asesor-stata-consulta` con `{ pregunta: string }` → `{ respuesta: string, notas_citadas: [{ titulo, path }] }`.

- [ ] **Step 1: Escribir el test (falla porque el handler no existe todavía)**

Crear `api/tests/test-asesor-stata-consulta.mjs`:

```js
// Pruebas de api/asesor-stata-consulta.js con fetch global mockeado -- sin
// ASESOR_STATA_GITHUB_TOKEN ni DEEPSEEK_API_KEY reales.
// Correr con: node api/tests/test-asesor-stata-consulta.mjs
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HANDLER_URL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'asesor-stata-consulta.js');

function req(bodyObj, method) {
  return new Request('http://localhost/api/asesor-stata-consulta', {
    method: method || 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: bodyObj === undefined ? undefined : JSON.stringify(bodyObj),
  });
}

function mockFetch(routerFn) {
  const original = globalThis.fetch;
  globalThis.fetch = async function (url) { return routerFn(String(url)); };
  return function restore() { globalThis.fetch = original; };
}

function deepseekOkResponse(contentObj) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(contentObj) } }] }), { status: 200 });
}

const TREE_UNA_NOTA = { tree: [{ type: 'blob', path: 'knowledge/sampling/nota.md' }] };
const NOTA_CONTENIDO = '---\ntitle: Una nota de prueba\n---\n\n## Resumen\nContenido de prueba.';

function routerConNota(url) {
  if (url.indexOf('git/trees/master') !== -1) {
    return new Response(JSON.stringify(TREE_UNA_NOTA), { status: 200 });
  }
  if (url.indexOf('contents/knowledge/sampling/nota.md') !== -1) {
    return new Response(NOTA_CONTENIDO, { status: 200 });
  }
  if (url.indexOf('api.deepseek.com') !== -1) {
    return deepseekOkResponse({
      respuesta: 'Resumen basado en la nota.',
      notas_citadas: [{ titulo: 'Una nota de prueba', path: 'knowledge/sampling/nota.md' }],
    });
  }
  throw new Error('URL no mockeada: ' + url);
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
  process.env.ASESOR_STATA_GITHUB_TOKEN = '';
  process.env.DEEPSEEK_API_KEY = '';
  const { default: handler } = await import('file://' + HANDLER_URL.replace(/\\/g, '/') + '?t=' + Date.now());

  await test('sin ASESOR_STATA_GITHUB_TOKEN -> 503, no llama a fetch', async () => {
    const restore = mockFetch(() => { throw new Error('no debería llamarse'); });
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    restore();
    assert.equal(res.status, 503);
  });

  process.env.ASESOR_STATA_GITHUB_TOKEN = 'fake-token';

  await test('sin DEEPSEEK_API_KEY -> 503, no llama a fetch', async () => {
    const restore = mockFetch(() => { throw new Error('no debería llamarse'); });
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    restore();
    assert.equal(res.status, 503);
  });

  process.env.DEEPSEEK_API_KEY = 'fake-key';

  await test('método GET -> 405', async () => {
    const res = await handler(req(undefined, 'GET'));
    assert.equal(res.status, 405);
  });

  await test('pregunta vacía -> 400', async () => {
    const res = await handler(req({ pregunta: '   ' }));
    assert.equal(res.status, 400);
  });

  await test('pregunta con nota relevante -> 200 con respuesta y notas_citadas', async () => {
    const restore = mockFetch(routerConNota);
    const res = await handler(req({ pregunta: '¿qué sabemos de xtdhazard?' }));
    restore();
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.respuesta, 'Resumen basado en la nota.');
    assert.equal(data.notas_citadas.length, 1);
    assert.equal(data.notas_citadas[0].path, 'knowledge/sampling/nota.md');
  });

  await test('base sin notas -> 200 sin llamar a DeepSeek', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('git/trees/master') !== -1) {
        return new Response(JSON.stringify({ tree: [] }), { status: 200 });
      }
      throw new Error('no debería llamar a ' + url);
    });
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    restore();
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data.notas_citadas, []);
    assert.match(data.respuesta, /todavía no tiene notas/);
  });

  await test('error de GitHub al traer el árbol -> 502', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('git/trees/master') !== -1) {
        return new Response('error', { status: 500 });
      }
      throw new Error('no debería llamar a ' + url);
    });
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    restore();
    assert.equal(res.status, 502);
  });

  await test('error HTTP de DeepSeek -> 502', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('git/trees/master') !== -1) return new Response(JSON.stringify(TREE_UNA_NOTA), { status: 200 });
      if (url.indexOf('contents/knowledge/sampling/nota.md') !== -1) return new Response(NOTA_CONTENIDO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) return new Response('error simulado', { status: 500 });
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    restore();
    assert.equal(res.status, 502);
  });

  await test('JSON malformado en el content de DeepSeek -> 502', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('git/trees/master') !== -1) return new Response(JSON.stringify(TREE_UNA_NOTA), { status: 200 });
      if (url.indexOf('contents/knowledge/sampling/nota.md') !== -1) return new Response(NOTA_CONTENIDO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) {
        return new Response(JSON.stringify({ choices: [{ message: { content: 'esto no es JSON' } }] }), { status: 200 });
      }
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    restore();
    assert.equal(res.status, 502);
  });

  await test('respuesta de DeepSeek sin notas_citadas -> 502', async () => {
    const restore = mockFetch((url) => {
      if (url.indexOf('git/trees/master') !== -1) return new Response(JSON.stringify(TREE_UNA_NOTA), { status: 200 });
      if (url.indexOf('contents/knowledge/sampling/nota.md') !== -1) return new Response(NOTA_CONTENIDO, { status: 200 });
      if (url.indexOf('api.deepseek.com') !== -1) return deepseekOkResponse({ respuesta: 'sin citas' });
      throw new Error('URL no mockeada: ' + url);
    });
    const res = await handler(req({ pregunta: 'una pregunta cualquiera' }));
    restore();
    assert.equal(res.status, 502);
  });

  console.log('\n' + pasados + ' pasados, ' + fallidos + ' fallidos');
  process.exit(fallidos > 0 ? 1 : 0);
}

main();
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `node api/tests/test-asesor-stata-consulta.mjs`
Expected: FALLA (el archivo `api/asesor-stata-consulta.js` no existe).

- [ ] **Step 3: Crear el handler**

Crear `api/asesor-stata-consulta.js`:

```js
// api/asesor-stata-consulta.js — Vercel Edge Function: responde preguntas
// sobre la base de conocimiento ya guardada de Asesor Stata (repo privado
// leonidcapo/asesor-stata), sintetizando con DeepSeek. Nunca investiga fuera
// de esa base -- para eso está el Modo 2 de /asesor-stata en Claude Code.
//
// Requiere ASESOR_STATA_GITHUB_TOKEN y DEEPSEEK_API_KEY en Vercel ->
// Settings -> Environment Variables. Sin cualquiera de las dos, responde 503.

import { fetchFileRaw, fetchKnowledgeTree } from './_lib/asesor-stata-github.js';

export const config = { runtime: 'edge' };

const MAX_PREGUNTA_CHARS = 500;
const MAX_CONTEXT_CHARS = 100000;

const PROMPT_SISTEMA = 'Eres el asistente de consulta de la base de conocimiento "Asesor Stata": ' +
  'notas en español sobre Stata, estadística aplicada y metodología, relevantes para ' +
  'DolphinStats. Se te da el contenido completo de todas las notas guardadas hasta ahora. ' +
  'Reglas estrictas:\n\n' +
  '1. Respondé la pregunta del usuario ÚNICAMENTE con información que esté en las notas de ' +
  'abajo. Nunca uses conocimiento externo ni inventes referencias.\n' +
  '2. Si tu respuesta usa contenido de una o más notas, citalas por su título exacto y su ' +
  'path exacto, tal como aparecen en el encabezado "### <path>" de cada nota.\n' +
  '3. Si ninguna nota de la base es relevante para la pregunta, decilo honestamente ("no hay ' +
  'nada en la base sobre esto todavía") en vez de inventar una respuesta, y sugerí ' +
  'investigarlo con /asesor-stata en Claude Code.\n\n' +
  'Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional antes ni después, con ' +
  'esta forma exacta:\n' +
  '{"respuesta": "<respuesta en español, 2-6 oraciones>", "notas_citadas": ' +
  '[{"titulo": "<título exacto de la nota>", "path": "<path exacto>"}]}\n' +
  'Si no citás ninguna nota, "notas_citadas" debe ser un array vacío.';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function construirContexto(token) {
  const paths = await fetchKnowledgeTree(token);
  var bloques = [];
  var total = 0;
  for (var i = 0; i < paths.length; i++) {
    const markdown = await fetchFileRaw(token, paths[i]);
    if (markdown === null) continue;
    const bloque = '### ' + paths[i] + '\n' + markdown;
    if (total + bloque.length > MAX_CONTEXT_CHARS) break;
    bloques.push(bloque);
    total += bloque.length;
  }
  return bloques.join('\n\n');
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Método no permitido.' });
  }

  const githubToken = process.env.ASESOR_STATA_GITHUB_TOKEN;
  if (!githubToken) {
    return jsonResponse(503, { error: 'La base de conocimiento no está disponible en este momento.' });
  }
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (!deepseekKey) {
    return jsonResponse(503, { error: 'La consulta no está disponible en este momento.' });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse(400, { error: 'Solicitud inválida.' });
  }

  const pregunta = body && typeof body.pregunta === 'string' ? body.pregunta.trim().slice(0, MAX_PREGUNTA_CHARS) : '';
  if (!pregunta) {
    return jsonResponse(400, { error: 'Escribe tu pregunta.' });
  }

  let contexto;
  try {
    contexto = await construirContexto(githubToken);
  } catch (e) {
    return jsonResponse(502, { error: 'No se pudo conectar con la base de conocimiento. Intenta de nuevo.' });
  }

  if (!contexto) {
    return jsonResponse(200, { respuesta: 'La base de conocimiento todavía no tiene notas guardadas.', notas_citadas: [] });
  }

  let upstream;
  try {
    upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + deepseekKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: PROMPT_SISTEMA },
          { role: 'user', content: contexto + '\n\nPregunta: ' + pregunta },
        ],
        max_tokens: 800 + (Number(process.env.DEEPSEEK_REASONING_MARGIN) || 1500),
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });
  } catch (e) {
    return jsonResponse(502, { error: 'No se pudo responder la consulta en este momento. Intenta de nuevo.' });
  }

  if (!upstream.ok) {
    return jsonResponse(502, { error: 'No se pudo responder la consulta en este momento. Intenta de nuevo.' });
  }

  let data;
  try {
    data = await upstream.json();
  } catch (e) {
    return jsonResponse(502, { error: 'No se pudo interpretar la respuesta. Intenta de nuevo.' });
  }

  const contenido = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content : null;
  let parsed;
  try {
    parsed = JSON.parse(contenido);
  } catch (e) {
    return jsonResponse(502, { error: 'No se pudo interpretar la respuesta. Intenta de nuevo.' });
  }

  if (!parsed || typeof parsed.respuesta !== 'string' || !Array.isArray(parsed.notas_citadas)) {
    return jsonResponse(502, { error: 'No se pudo interpretar la respuesta. Intenta de nuevo.' });
  }

  return jsonResponse(200, { respuesta: parsed.respuesta, notas_citadas: parsed.notas_citadas });
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `node api/tests/test-asesor-stata-consulta.mjs`
Expected: `10 pasados, 0 fallidos`

- [ ] **Step 5: Commit**

```bash
git add api/asesor-stata-consulta.js api/tests/test-asesor-stata-consulta.mjs
git commit -m "feat(asesor-stata): endpoint de consulta con síntesis por LLM (modo Buscar)"
```

---

### Task 4: `asesor-stata.html` — página estática

**Files:**
- Create: `asesor-stata.html`

**Interfaces:**
- Produces: markup con ids que Task 5/6 van a usar: `#as-tabs`, `#as-tab-explorar`, `#as-tab-buscar`, `#as-explorar-panel`, `#as-buscar-panel`, `#as-indice`, `#as-nota-vista`, `#as-buscar-form`, `#as-buscar-input`, `#as-buscar-resultado`, `#as-buscar-status`.

- [ ] **Step 1: Crear la página**

Crear `asesor-stata.html` (mismo lenguaje visual que `calculadora-muestra.html`: nav con logo y "volver al inicio", `.wrap`, `.panel`):

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Asesor Stata — DolphinStats</title>
<meta name="robots" content="noindex, nofollow">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  :root{
    --ocean:#ffffff; --aqua:#0075c6; --white:#003060; --muted:#4a6285;
    --accent:#ff3131; --surface:#f5f7fb; --border:rgba(0,48,96,.10);
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{font-family:'DM Sans',sans-serif;color:var(--white);background:var(--ocean);line-height:1.5}
  .wrap{max-width:820px;margin:0 auto;padding:2rem 1.25rem 4rem}
  nav{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--border)}
  .logo{font-family:Arial,sans-serif;font-weight:800;font-size:1.2rem;color:var(--aqua);text-decoration:none}
  .logo span{color:#0899a8}
  nav a.back{color:var(--muted);text-decoration:none;font-size:.85rem}
  h1{font-family:'Syne',sans-serif;font-size:1.9rem;margin:0 0 .4rem}
  p.lead{color:var(--muted);margin:0 0 1.75rem;max-width:640px}
  .tabs{display:flex;gap:.5rem;margin-bottom:1.25rem;border-bottom:1px solid var(--border)}
  .tab{cursor:pointer;border:none;background:none;padding:.7rem 1rem;font-family:inherit;font-size:.9rem;font-weight:700;color:var(--muted);border-bottom:2px solid transparent}
  .tab.activo{color:var(--aqua);border-bottom-color:var(--aqua)}
  .campo-oculto{display:none !important}
  .panel{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.5rem}
  .tema-titulo{font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin:1.5rem 0 .6rem}
  .tema-titulo:first-child{margin-top:0}
  .ncard{display:block;width:100%;text-align:left;background:#fff;border:1px solid var(--border);border-radius:10px;padding:.9rem 1.1rem;margin-bottom:.6rem;cursor:pointer;font-family:inherit}
  .ncard:hover{border-color:var(--aqua)}
  .ncard .ntitulo{font-weight:700;font-size:.95rem;color:var(--white)}
  .ncard .nresumen{color:var(--muted);font-size:.82rem;margin-top:.25rem}
  .vacio{color:var(--muted);font-size:.85rem;font-style:italic}
  #as-nota-vista{margin-top:1.5rem;background:#fff;border:1px solid var(--border);border-radius:14px;padding:1.5rem}
  #as-nota-vista h2{font-size:1.05rem;margin:1.2rem 0 .5rem}
  #as-nota-vista h2:first-child{margin-top:0}
  #as-nota-vista p{font-size:.9rem;color:var(--white)}
  #as-nota-vista ul{font-size:.9rem;color:var(--white);padding-left:1.2rem}
  textarea{width:100%;padding:.7rem .8rem;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:.9rem;background:#fff;color:var(--white);min-height:70px;resize:vertical}
  button.enviar{cursor:pointer;border:none;border-radius:100px;padding:.65rem 1.4rem;font-weight:700;font-size:.9rem;font-family:inherit;background:var(--aqua);color:#fff;margin-top:.9rem}
  #as-buscar-status{margin-top:.8rem;font-size:.85rem;color:var(--accent)}
  #as-buscar-resultado{margin-top:1.5rem;background:#fff;border:1px solid var(--border);border-radius:14px;padding:1.5rem}
  #as-buscar-resultado .respuesta{font-size:.92rem;color:var(--white);line-height:1.6}
  #as-buscar-resultado .citas{margin-top:1rem;padding-top:1rem;border-top:1px dashed var(--border)}
  #as-buscar-resultado .citas a{display:block;font-size:.82rem;color:var(--aqua);text-decoration:none;margin-bottom:.3rem}
</style>
</head>
<body>
<nav>
  <a class="logo" href="/">Dolphin<span>Stats</span></a>
  <a class="back" href="/">&larr; Volver al inicio</a>
</nav>
<div class="wrap">
  <h1>Asesor Stata</h1>
  <p class="lead">Base de conocimiento sobre Stata, estadística aplicada y metodología relevante para DolphinStats. Explorá las notas ya guardadas o hacé una pregunta para que se responda solo con lo que hay en la base.</p>

  <div class="tabs" id="as-tabs">
    <button type="button" class="tab activo" id="as-tab-explorar">Explorar</button>
    <button type="button" class="tab" id="as-tab-buscar">Buscar</button>
  </div>

  <div id="as-explorar-panel">
    <div class="panel" id="as-indice">
      <p class="vacio">Cargando índice…</p>
    </div>
    <div id="as-nota-vista" class="campo-oculto"></div>
  </div>

  <div id="as-buscar-panel" class="campo-oculto">
    <div class="panel">
      <form id="as-buscar-form">
        <textarea id="as-buscar-input" placeholder="Ej.: ¿hay algo sobre modelos de hazard con datos de panel?"></textarea>
        <button type="submit" class="enviar">Preguntar</button>
      </form>
      <div id="as-buscar-status"></div>
    </div>
    <div id="as-buscar-resultado" class="campo-oculto"></div>
  </div>
</div>
<script src="asesor-stata.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verificar visualmente en el navegador**

Abrir `asesor-stata.html` con el Browser pane (o `file://` local), confirmar que se ven el header, el lead, las dos pestañas ("Explorar" activa por default) y el panel vacío con "Cargando índice…" sin errores de consola (`asesor-stata.js` todavía no existe, así que un 404 de ese script es esperado en este paso — se resuelve en la Task 5).

- [ ] **Step 3: Commit**

```bash
git add asesor-stata.html
git commit -m "feat(asesor-stata): página estática (Explorar + Buscar)"
```

---

### Task 5: `asesor-stata.js` — conversor Markdown + modo Explorar

**Files:**
- Create: `asesor-stata.js`
- Test: `tests/test-asesor-stata-markdown.mjs`

**Interfaces:**
- Consumes: markup de Task 4 (ids `#as-indice`, `#as-nota-vista`, `#as-tab-explorar`, `#as-tab-buscar`, `#as-explorar-panel`, `#as-buscar-panel`).
- Produces: `window.AsesorStata = { parsearFrontmatter, cuerpoMarkdownAHtml }` (también exportado vía `module.exports` cuando `window` no existe, para poder testear con Node). `parsearFrontmatter(markdown) -> { meta: object, cuerpo: string }`. `cuerpoMarkdownAHtml(cuerpo) -> string` (HTML).

- [ ] **Step 1: Escribir el test del conversor (falla porque el archivo no existe todavía)**

Crear `tests/test-asesor-stata-markdown.mjs`:

```js
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
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `node tests/test-asesor-stata-markdown.mjs`
Expected: FALLA (el archivo `asesor-stata.js` no existe).

- [ ] **Step 3: Crear `asesor-stata.js` con el conversor y el modo Explorar**

Crear `asesor-stata.js`:

```js
/* asesor-stata.js — cliente de la página asesor-stata.html: consume
 * api/asesor-stata-base.js (Explorar) y api/asesor-stata-consulta.js
 * (Buscar). Sin dependencias -- conversor Markdown propio, chico, escrito
 * para el formato fijo que siguen las notas de knowledge/ (frontmatter YAML
 * + ## headings + listas + negritas). */
(function () {
  'use strict';

  function escapeHtml(texto) {
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function inlineMarkdown(texto) {
    return escapeHtml(texto).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  function parsearFrontmatter(markdown) {
    var lineas = markdown.split('\n');
    if (lineas[0] !== '---') {
      return { meta: {}, cuerpo: markdown };
    }
    var fin = -1;
    for (var i = 1; i < lineas.length; i++) {
      if (lineas[i] === '---') { fin = i; break; }
    }
    if (fin === -1) {
      return { meta: {}, cuerpo: markdown };
    }
    var meta = {};
    for (var j = 1; j < fin; j++) {
      var linea = lineas[j];
      var sep = linea.indexOf(':');
      if (sep === -1) continue;
      var clave = linea.slice(0, sep).trim();
      var valor = linea.slice(sep + 1).trim();
      if (valor.charAt(0) === '[' && valor.charAt(valor.length - 1) === ']') {
        valor = valor.slice(1, -1).split(',').map(function (v) { return v.trim(); }).filter(Boolean);
      }
      meta[clave] = valor;
    }
    var cuerpo = lineas.slice(fin + 1).join('\n').replace(/^\n+/, '');
    return { meta: meta, cuerpo: cuerpo };
  }

  function cuerpoMarkdownAHtml(cuerpo) {
    var lineas = cuerpo.split('\n');
    var html = [];
    var listaActual = null;
    var parrafoActual = null;

    function flushLista() {
      if (listaActual) { html.push('<ul>' + listaActual.join('') + '</ul>'); listaActual = null; }
    }
    function flushParrafo() {
      if (parrafoActual) { html.push('<p>' + parrafoActual.join(' ') + '</p>'); parrafoActual = null; }
    }

    for (var i = 0; i < lineas.length; i++) {
      var linea = lineas[i];
      if (linea.trim() === '') { flushLista(); flushParrafo(); continue; }

      var encabezado = linea.match(/^##\s+(.+)$/);
      if (encabezado) {
        flushLista(); flushParrafo();
        html.push('<h2>' + inlineMarkdown(encabezado[1]) + '</h2>');
        continue;
      }

      var item = linea.match(/^-\s+(.+)$/);
      if (item) {
        flushParrafo();
        if (!listaActual) listaActual = [];
        listaActual.push('<li>' + inlineMarkdown(item[1]) + '</li>');
        continue;
      }

      flushLista();
      if (!parrafoActual) parrafoActual = [];
      parrafoActual.push(inlineMarkdown(linea));
    }
    flushLista();
    flushParrafo();
    return html.join('\n');
  }

  var API = {
    parsearFrontmatter: parsearFrontmatter,
    cuerpoMarkdownAHtml: cuerpoMarkdownAHtml,
  };

  if (typeof window === 'undefined') {
    if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
    return; // el resto de este archivo maneja el DOM -- no aplica fuera del navegador
  }

  window.AsesorStata = API;

  function $(id) { return document.getElementById(id); }

  function mostrarTab(nombre) {
    var esExplorar = nombre === 'explorar';
    $('as-tab-explorar').classList.toggle('activo', esExplorar);
    $('as-tab-buscar').classList.toggle('activo', !esExplorar);
    $('as-explorar-panel').classList.toggle('campo-oculto', !esExplorar);
    $('as-buscar-panel').classList.toggle('campo-oculto', esExplorar);
  }

  function renderIndice(indice) {
    var cont = $('as-indice');
    cont.innerHTML = '';
    if (!indice.temas.length) {
      cont.innerHTML = '<p class="vacio">La base de conocimiento todavía no tiene notas guardadas.</p>';
      return;
    }
    indice.temas.forEach(function (tema) {
      var titulo = document.createElement('div');
      titulo.className = 'tema-titulo';
      titulo.textContent = tema.nombre;
      cont.appendChild(titulo);

      if (!tema.notas.length) {
        var vacio = document.createElement('p');
        vacio.className = 'vacio';
        vacio.textContent = 'Sin notas todavía.';
        cont.appendChild(vacio);
        return;
      }

      tema.notas.forEach(function (nota) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ncard';
        btn.innerHTML = '<div class="ntitulo"></div><div class="nresumen"></div>';
        btn.querySelector('.ntitulo').textContent = nota.titulo;
        btn.querySelector('.nresumen').textContent = nota.resumen;
        btn.addEventListener('click', function () { verNota(nota.path); });
        cont.appendChild(btn);
      });
    });
  }

  function verNota(path) {
    var vista = $('as-nota-vista');
    vista.classList.remove('campo-oculto');
    vista.innerHTML = '<p class="vacio">Cargando…</p>';
    fetch('/api/asesor-stata-base?nota=' + encodeURIComponent(path))
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (!r.ok) { vista.innerHTML = '<p class="vacio">' + escapeHtml(r.data.error || 'No se pudo cargar la nota.') + '</p>'; return; }
        var parsed = parsearFrontmatter(r.data.markdown);
        var titulo = parsed.meta.title || path;
        vista.innerHTML = '<h2 style="margin-top:0">' + escapeHtml(titulo) + '</h2>' + cuerpoMarkdownAHtml(parsed.cuerpo);
      })
      .catch(function () { vista.innerHTML = '<p class="vacio">No se pudo cargar la nota. Intenta de nuevo.</p>'; });
  }

  function cargarIndice() {
    fetch('/api/asesor-stata-base')
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (!r.ok) { $('as-indice').innerHTML = '<p class="vacio">' + escapeHtml(r.data.error || 'No se pudo cargar el índice.') + '</p>'; return; }
        renderIndice(r.data);
      })
      .catch(function () { $('as-indice').innerHTML = '<p class="vacio">No se pudo cargar el índice. Intenta de nuevo.</p>'; });
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('as-tab-explorar').addEventListener('click', function () { mostrarTab('explorar'); });
    $('as-tab-buscar').addEventListener('click', function () { mostrarTab('buscar'); });
    cargarIndice();
  });
})();
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `node tests/test-asesor-stata-markdown.mjs`
Expected: `5 pasados, 0 fallidos`

- [ ] **Step 5: Verificar visualmente el modo Explorar en el navegador**

Con el Browser pane, abrir `asesor-stata.html`. Como no hay `ASESOR_STATA_GITHUB_TOKEN` real en este entorno local, `GET /api/asesor-stata-base` va a fallar (no hay servidor Vercel corriendo) — confirmar que el panel muestra el mensaje de error amigable ("No se pudo cargar el índice...") en vez de romper o quedar en blanco, y que no hay excepciones sin capturar en la consola del navegador (`read_console_messages`). La verificación completa del fetch real se hace en la Task 7, después del deploy.

- [ ] **Step 6: Commit**

```bash
git add asesor-stata.js tests/test-asesor-stata-markdown.mjs
git commit -m "feat(asesor-stata): conversor Markdown y modo Explorar"
```

---

### Task 6: `asesor-stata.js` — modo Buscar

**Files:**
- Modify: `asesor-stata.js` (agregar wiring del formulario de búsqueda, dentro del bloque `document.addEventListener('DOMContentLoaded', ...)` de la Task 5)

**Interfaces:**
- Consumes: `#as-buscar-form`, `#as-buscar-input`, `#as-buscar-status`, `#as-buscar-resultado` (Task 4); `POST /api/asesor-stata-consulta` (Task 3); `verNota(path)` (definida en Task 5, misma clausura).

- [ ] **Step 1: Agregar las funciones de Buscar antes del `document.addEventListener` existente**

En `asesor-stata.js`, insertar justo antes de `document.addEventListener('DOMContentLoaded', function () {`:

```js
  function renderResultadoBusqueda(data) {
    var cont = $('as-buscar-resultado');
    cont.classList.remove('campo-oculto');
    var html = '<div class="respuesta">' + escapeHtml(data.respuesta) + '</div>';
    if (data.notas_citadas.length) {
      html += '<div class="citas">';
      data.notas_citadas.forEach(function (nota) {
        html += '<a href="#" data-path="' + escapeHtml(nota.path) + '">' + escapeHtml(nota.titulo) + '</a>';
      });
      html += '</div>';
    }
    cont.innerHTML = html;
    cont.querySelectorAll('.citas a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        mostrarTab('explorar');
        verNota(a.getAttribute('data-path'));
      });
    });
  }

  function enviarConsulta(pregunta) {
    var status = $('as-buscar-status');
    var resultado = $('as-buscar-resultado');
    status.textContent = 'Consultando…';
    resultado.classList.add('campo-oculto');
    fetch('/api/asesor-stata-consulta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pregunta: pregunta }),
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (!r.ok) { status.textContent = r.data.error || 'No se pudo responder la consulta.'; return; }
        status.textContent = '';
        renderResultadoBusqueda(r.data);
      })
      .catch(function () { status.textContent = 'No se pudo responder la consulta. Intenta de nuevo.'; });
  }
```

- [ ] **Step 2: Conectar el formulario dentro de `document.addEventListener('DOMContentLoaded', ...)`**

Reemplazar el cuerpo actual de ese listener:

```js
  document.addEventListener('DOMContentLoaded', function () {
    $('as-tab-explorar').addEventListener('click', function () { mostrarTab('explorar'); });
    $('as-tab-buscar').addEventListener('click', function () { mostrarTab('buscar'); });
    cargarIndice();
  });
```

por:

```js
  document.addEventListener('DOMContentLoaded', function () {
    $('as-tab-explorar').addEventListener('click', function () { mostrarTab('explorar'); });
    $('as-tab-buscar').addEventListener('click', function () { mostrarTab('buscar'); });
    cargarIndice();

    $('as-buscar-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var pregunta = $('as-buscar-input').value.trim();
      if (!pregunta) return;
      enviarConsulta(pregunta);
    });
  });
```

- [ ] **Step 3: Correr de nuevo el test del conversor para confirmar que no se rompió nada**

Run: `node tests/test-asesor-stata-markdown.mjs`
Expected: `5 pasados, 0 fallidos`

- [ ] **Step 4: Verificar visualmente el modo Buscar en el navegador**

Con el Browser pane, abrir `asesor-stata.html`, ir a la pestaña "Buscar", escribir cualquier pregunta y enviar el formulario. Como no hay backend real corriendo en este entorno local, confirmar que aparece el mensaje de error amigable en `#as-buscar-status` (no una excepción sin capturar) — la verificación end-to-end contra el backend real se hace en la Task 7, después del deploy.

- [ ] **Step 5: Commit**

```bash
git add asesor-stata.js
git commit -m "feat(asesor-stata): modo Buscar (consulta con síntesis por LLM)"
```

---

### Task 7: Integrar al portal, documentar y desplegar

**Files:**
- Modify: `index.html` (la tarjeta de Asesor Stata agregada en la sesión anterior)
- Modify: `README.md`

**Interfaces:**
- Ninguna nueva — conecta lo ya construido en Tasks 1-6 al resto del sitio.

- [ ] **Step 1: Cambiar la tarjeta de Asesor Stata en `index.html` para que apunte a la página local**

Buscar la tarjeta agregada previamente (empieza con `<a class="card" href="https://github.com/leonidcapo/asesor-stata"`) y reemplazarla por:

```html
    <a class="card" href="asesor-stata.html">
      <div class="card-top">
        <div class="name">Asesor Stata <span class="tag local">Local</span></div>
        <div class="arrow">→</div>
      </div>
      <div class="desc">Base de conocimiento y agente de monitoreo sobre Stata, estadística aplicada y metodología relevante para DolphinStats: explorá las notas guardadas o consultá algo puntual con síntesis por LLM. El repo completo (con el monitoreo semanal automático y el comando <code>/asesor-stata</code> de Claude Code) está en <a href="https://github.com/leonidcapo/asesor-stata" target="_blank" rel="noopener" onclick="event.stopPropagation()">GitHub</a>.</div>
      <div class="stats">
        <span class="stat">Explorar + Buscar</span>
        <span class="stat">Solo lectura</span>
      </div>
      <div class="verified">Verificado 29-sep-2026</div>
    </a>
```

- [ ] **Step 2: Documentar la env var nueva y la herramienta en `README.md`**

En `README.md`, en la lista de "Herramientas" (después de la entrada de Journal Match), agregar:

```markdown
- **Asesor Stata** (`asesor-stata.html`): explorador y buscador de solo lectura
  sobre la base de conocimiento del repo privado `leonidcapo/asesor-stata`
  (ver ese repo para el sistema completo: monitoreo automático semanal +
  comando `/asesor-stata` de Claude Code). Backend en `api/asesor-stata-base.js`
  (índice y notas) y `api/asesor-stata-consulta.js` (consulta con síntesis por
  DeepSeek).
```

Y en la sección de variables de entorno del deploy (después de `SITE_USER`/`SITE_PASS`), agregar:

```markdown
3. Agregar también `ASESOR_STATA_GITHUB_TOKEN` (Personal Access Token de
   GitHub, permiso de solo lectura sobre el repo privado
   `leonidcapo/asesor-stata` — Settings → Developer settings → Personal
   access tokens → Fine-grained, con acceso de solo ese repo) y
   `DEEPSEEK_API_KEY` (la misma que ya usa `clasificar-diseno.js`, si no
   está configurada todavía).
```

- [ ] **Step 3: Commit**

```bash
git add index.html README.md
git commit -m "feat(asesor-stata): conectar la página al portal y documentar el deploy"
```

- [ ] **Step 4: Push**

```bash
git push
```

(Recordar avisar al usuario antes de este push, como con los pushes anteriores de la sesión.)

- [ ] **Step 5: Checklist de verificación post-deploy (manual, la corre el usuario)**

Esto no lo puede correr el agente: configurar `ASESOR_STATA_GITHUB_TOKEN` en Vercel → Settings → Environment Variables es una acción sobre una cuenta/servicio externo. Después de que el usuario la configure y Vercel redespliegue:

1. Abrir `https://dolphinstats-eco.vercel.app/asesor-stata.html`, confirmar que la pestaña "Explorar" carga el índice real (temas `panel-data`, `survival-analysis`, `sampling`, `simulation`, `causal-inference`).
2. Hacer click en la nota de `xtdhazard` y confirmar que el contenido se ve bien formateado.
3. Ir a "Buscar", preguntar algo relacionado a esa nota (ej. "¿hay algo sobre heterogeneidad no observada en modelos de panel?") y confirmar que la respuesta cita esa nota.
4. Preguntar algo que no esté en la base (ej. "¿qué es xtabond2?") y confirmar que responde honestamente que no hay nada, en vez de inventar.

## Self-Review

- **Cobertura del spec:** Explorar (índice + nota individual) → Tasks 4-5. Buscar (síntesis por LLM sobre la base) → Tasks 3 y 6. Cliente GitHub con token → Task 1. Manejo de errores de la tabla del spec → cubierto por los tests de Tasks 1-3 (503 sin token/key, 502 upstream, 404 nota inexistente, 400 input vacío, 200 con lista/contexto vacío). Integración al portal + env var nueva documentada → Task 7. Fuera de alcance (Modo 2 completo, Modo 3, Modo 4, escritura desde la web, caché) — respetado, ninguna task lo implementa.
- **Placeholders:** ninguno — cada step tiene código completo o un comando exacto con su output esperado.
- **Consistencia de tipos:** `parseIndex`/`fetchFileRaw`/`fetchKnowledgeTree`/`GithubError` se usan con la misma firma en Tasks 2 y 3 que en su definición en Task 1. `parsearFrontmatter`/`cuerpoMarkdownAHtml` se definen en Task 5 y se consumen con la misma firma en Task 6 (misma clausura de módulo, sin reimportar).
