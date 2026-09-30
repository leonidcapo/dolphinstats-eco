# Diseño: router de relevancia en dos pasos — Asesor Stata

Fecha: 2026-09-30

## Propósito

`Buscar` y `Código` arman su contexto trayendo **todas** las notas de `knowledge/` en cada
consulta (`fetchKnowledgeTree` + `fetchFileRaw` secuencial por cada path) y mandándolas enteras
a DeepSeek. Esto escala mal con el tamaño de la base: más notas → más tokens por consulta (más
costo en DeepSeek) y más llamadas secuenciales a GitHub antes de responder (más latencia,
riesgo de acercarse al límite de ejecución de la Edge Function en Vercel). La base ya pasó de
2 a ~78 notas tras la primera corrida real del monitoreo automático, y va a seguir creciendo
sola cada semana sin que nadie lo controle.

Este subsistema acota el contexto a un número fijo de notas relevantes por consulta, sin
importar cuánto crezca la base.

## Arquitectura

Router de dos pasos, reusando lo que ya existe (`INDEX.md`, mismo cliente DeepSeek) — sin
sumar infraestructura nueva (nada de embeddings ni base vectorial):

1. **Paso 1 (router, barato)**: un llamado chico a DeepSeek con solo `{titulo, path, resumen}`
   de cada nota (ya están en `INDEX.md`, un solo fetch) — le pide elegir hasta 8 paths
   relevantes para la consulta puntual, o ninguno.
2. **Paso 2 (respuesta, ya existente)**: se traen en paralelo (`Promise.all`, no secuencial)
   solo esas notas elegidas, se arma el contexto real, y se llama a DeepSeek como ya se hace
   hoy en `asesor-stata-consulta.js`/`asesor-stata-codigo.js`.

```
api/_lib/asesor-stata-github.js   — se le agrega parseIndex() (movido desde asesor-stata-base.js)
api/_lib/asesor-stata-relevancia.js — nuevo: elegirNotasRelevantes(...)
api/asesor-stata-base.js            — importa parseIndex desde _lib en vez de definirlo
api/asesor-stata-consulta.js        — construirContexto usa el router en vez de traer todo
api/asesor-stata-codigo.js          — construirContextoOpcional usa el router en vez de traer todo
```

Se descartaron: (B) filtro por palabras clave sin LLM — más barato pero pierde relevancia
semántica cuando la consulta no comparte vocabulario con la nota; (C) embeddings + búsqueda
vectorial — la solución correcta a gran escala, pero exige infraestructura nueva (generar y
guardar embeddings, índice vectorial) que no se justifica todavía con ~78 notas y rompe el
patrón del proyecto de no sumar servicios externos (mismo criterio que llevó a usar
`estado.json` en vez de Google Sheets para el pipeline de monitoreo).

## Flujo de datos

1. El handler (`asesor-stata-consulta.js` o `asesor-stata-codigo.js`) recibe la consulta del
   usuario (pregunta, o código a revisar, o descripción a generar).
2. Llama a `elegirNotasRelevantes(token, deepseekKey, textoConsulta, limite=8)`:
   a. Trae `INDEX.md` (`fetchFileRaw`, ya existente).
   b. Lo parsea con `parseIndex` (movido a `_lib`, reusado tal cual — mismo parser que ya usa
      `asesor-stata-base.js` para "Explorar").
   c. Arma una lista compacta `{titulo, path, resumen}` de todas las notas (sin traer el cuerpo
      de ninguna) y se la pasa a DeepSeek con un prompt corto: "elegí como máximo `limite` paths
      relevantes para esta consulta, devolvé un array vacío si ninguna aplica".
   d. Devuelve la lista de paths elegidos (validados: deben existir en el índice parseado — si
      el modelo inventa un path que no está en la lista, se descarta ese path puntual, no toda
      la respuesta).
3. Si el router devuelve una lista vacía o el paso 2 falla (ver Manejo de errores), el handler
   sigue con contexto vacío — mismo comportamiento ya existente para "sin nada relevante".
4. Con los paths elegidos, el handler trae esas notas puntuales en paralelo
   (`Promise.all(paths.map(p => fetchFileRaw(token, p)))`) en vez del loop secuencial actual.
5. Arma el contexto solo con esas notas y sigue el flujo ya existente (llamada real a DeepSeek
   con la pregunta/código/descripción + ese contexto acotado).

## Manejo de errores

- Si `elegirNotasRelevantes` falla (error de GitHub al traer `INDEX.md`, error de DeepSeek en
  el router, JSON malformado del router) → se loguea y se continúa con lista de paths vacía,
  igual que "nada relevante" — nunca bloquea la consulta principal por un fallo del router.
- Un path elegido por el router que no existe en el índice parseado (alucinación del modelo) se
  descarta individualmente, no invalida el resto de los paths elegidos.
- Un path elegido cuyo `fetchFileRaw` de todos modos devuelve `null` (borrado entre que se
  parseó el índice y se pidió el archivo — carrera improbable pero posible) se descarta de los
  resultados de `Promise.all`, no rompe el armado del contexto.
- El límite de 8 es una constante (`MAX_NOTAS_CONTEXTO`), no configurable desde el cliente.

## Testing

Mismo patrón que el resto del proyecto: `fetch` global mockeado, sin credenciales reales.
Casos nuevos a cubrir en `_lib/asesor-stata-relevancia.js`: router elige un subconjunto válido,
router devuelve vacío, router alucina un path que no existe (se descarta), fallo del router
(GitHub o DeepSeek) cae a lista vacía sin lanzar. Actualizar los tests existentes de
`asesor-stata-consulta.js`/`asesor-stata-codigo.js` para mockear también la llamada del router
(dos llamadas a DeepSeek por test en el camino feliz: router + respuesta real).

## Fuera de alcance

- Embeddings o cualquier forma de búsqueda semántica fuera de un llamado a LLM (ver Approach C
  descartado).
- Cachear el índice o las notas entre requests (cada consulta sigue siendo stateless e
  independiente, igual que hoy).
- Cambiar el límite de 8 dinámicamente según el tamaño de la base — es una constante fija por
  ahora; si hace falta ajustarla se cambia el número, no se rediseña el mecanismo.
