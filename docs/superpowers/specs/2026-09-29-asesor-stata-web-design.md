# Diseño: Frontend + backend web para Asesor Stata

Fecha: 2026-09-29

## Propósito

[Asesor Stata](https://github.com/leonidcapo/asesor-stata) (base de conocimiento + monitoreo
automático + skill `/asesor-stata` de Claude Code) hoy no tiene nada navegable en un browser:
para leer una nota hay que abrir el repo en GitHub, y para consultar algo hay que abrir Claude
Code. Este subsistema le agrega una interfaz web dentro de `dolphinstats-eco` para:

1. **Explorar** la base de conocimiento ya guardada (equivalente web al Modo 1 del skill).
2. **Buscar** con síntesis por LLM sobre esa misma base (equivalente web, acotado, al Modo 2).

Fuera de alcance explícito: investigación externa en vivo (Modo 2 completo, con
scite/consensus/elicit/WebSearch), revisión de fuentes bloqueadas (Modo 3), y el asistente de
código Stata (Modo 4) — esos siguen siendo exclusivos de `/asesor-stata` en Claude Code, porque
dependen de conectores que no existen fuera de esa sesión.

## Arquitectura

Se descartaron dos alternativas antes de esta:

- **App Node/Next separada**: rompe el patrón 100% estático (sin build) del proyecto y suma
  complejidad de deploy sin necesidad real.
- **Fetch directo desde el navegador a GitHub/DeepSeek**: expondría el token de GitHub y la key
  de DeepSeek en el código fuente cliente, y el CSP del sitio (`connect-src 'self'`) ya lo
  bloquea de todos modos.

Arquitectura elegida: dos Vercel Edge Functions nuevas, mismo patrón que
`api/clasificar-diseno.js` (key/token solo en variables de entorno de Vercel, nunca llega al
cliente; mensajes de error honestos en vez de romper). Protegidas por el mismo Basic Auth
(`middleware.js`) que ya cubre todo el sitio, incluido `/api/*`.

```
asesor-stata.html          — página nueva, misma estética que index.html/calculadora-muestra.html
asesor-stata.js            — lógica de cliente (fetch a las 2 funciones, render, conversor MD)
api/asesor-stata-base.js       — GET: índice y notas individuales desde el repo GitHub
api/asesor-stata-consulta.js   — POST {pregunta}: síntesis por LLM sobre la base guardada
api/_lib/asesor-stata-github.js — cliente GitHub compartido por las dos funciones de arriba
api/tests/test-asesor-stata-base.mjs
api/tests/test-asesor-stata-consulta.mjs
```

Nueva variable de entorno en Vercel: `ASESOR_STATA_GITHUB_TOKEN` (Personal Access Token de
GitHub, permiso de solo lectura sobre el repo `leonidcapo/asesor-stata`, que es privado).
Reusa la `DEEPSEEK_API_KEY` que ya existe para `clasificar-diseno.js`.

## Flujo de datos

### Explorar

1. Al cargar `asesor-stata.html`, el cliente pide `GET /api/asesor-stata-base`.
2. La función trae `INDEX.md` del repo vía API de GitHub (Contents API, con el token) y lo
   parsea a JSON: `{ temas: [{ nombre, notas: [{ titulo, resumen, path }] }] }`.
3. El cliente renderiza tarjetas agrupadas por tema, mismo lenguaje visual que el resto del
   portal (`.card`, `.tag`, etc. de `index.html`).
4. Al hacer click en una nota, el cliente pide `GET /api/asesor-stata-base?nota=<path>`.
5. La función trae el Markdown crudo de esa nota puntual (Contents API sobre el path exacto).
6. El cliente convierte ese Markdown a HTML con un conversor propio, chico, escrito a mano
   para el formato fijo que siguen las notas (frontmatter YAML + `##` headings + listas +
   negritas — ver plantilla en `2026-09-28-base-conocimiento-design.md` del repo
   `asesor-stata`). No se suma una librería de Markdown externa: el CSP (`script-src 'self'`)
   exige que todo el JS sea local de todos modos, y el formato de las notas es simple y
   estable.

### Buscar

1. El usuario escribe una pregunta libre y el cliente hace `POST /api/asesor-stata-consulta`
   con `{ pregunta }`.
2. La función usa el cliente GitHub compartido para traer el árbol completo de `knowledge/`
   (Git Trees API, recursivo) y el contenido de cada nota `.md`.
3. Arma un contexto con todas las notas (title, tema, tags, resumen y cuerpo) y llama a
   DeepSeek con un system prompt que fija tres reglas: (a) responder solo con lo que está en
   el contexto, (b) citar explícitamente qué nota(s) usó, (c) si nada del contexto es
   relevante, decirlo honestamente en vez de inventar, y sugerir seguir la investigación con
   `/asesor-stata` en Claude Code (Modo 2).
4. Devuelve `{ respuesta, notas_citadas: [{ titulo, path }] }`. El cliente muestra la
   respuesta y cada nota citada enlaza a su vista en "Explorar" (mismo conversor MD del punto
   anterior).

## Manejo de errores

Mismo criterio que `clasificar-diseno.js`: mensajes honestos en español, nunca una excepción
sin capturar.

| Caso | Respuesta |
|---|---|
| Sin `ASESOR_STATA_GITHUB_TOKEN` configurado | 503 — "la base de conocimiento no está disponible en este momento" |
| Error o rate-limit de la API de GitHub | 502 — sugiere reintentar |
| Base sin notas todavía (`INDEX.md` sin entradas) | 200 con lista vacía — el cliente muestra un estado vacío amigable, no un error |
| `?nota=<path>` que no existe en el repo | 404 |
| Sin `DEEPSEEK_API_KEY` (solo afecta a Buscar) | 503 |
| `pregunta` vacía o ausente | 400, antes de llamar a GitHub o DeepSeek |
| Respuesta de DeepSeek no parseable como el JSON esperado | 502 |

## Testing

Un archivo de test por función nueva, mismo patrón que
`api/tests/test-clasificar-diseno.mjs` (`fetch` global mockeado, sin tokens/keys reales,
correr con `node api/tests/<archivo>.mjs`):

- `test-asesor-stata-base.mjs`: índice con notas, índice vacío, nota puntual existente, nota
  inexistente (404), sin token (503), error de GitHub (502).
- `test-asesor-stata-consulta.mjs`: pregunta con nota(s) citada(s) correctamente, pregunta sin
  nada relevante (respuesta honesta, no inventada), pregunta vacía (400), sin
  `DEEPSEEK_API_KEY` (503), error de GitHub o DeepSeek (502), respuesta no parseable (502).

## Fuera de alcance

- Investigación externa en vivo (Modo 2 completo) y revisión de fuentes bloqueadas (Modo 3) —
  siguen siendo exclusivos de `/asesor-stata` en Claude Code.
- Asistente de código Stata (Modo 4) — no tiene sentido fuera de una sesión de Claude Code con
  acceso al script del usuario.
- Guardar notas nuevas desde la web (el flujo de escritura sigue siendo Claude Code → commit a
  `asesor-stata`) — esta interfaz es de solo lectura.
- Caché entre invocaciones de la función serverless — el volumen de uso (personal, interno) no
  lo justifica todavía; se puede agregar más adelante si la base crece mucho o el rate-limit de
  GitHub se vuelve un problema real.
