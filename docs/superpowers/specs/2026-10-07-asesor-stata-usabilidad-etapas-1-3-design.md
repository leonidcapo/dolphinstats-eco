# Diseño: usabilidad de Asesor Stata — Etapas 1 a 3

Fecha: 2026-10-07

## Propósito

Asesor Stata nació como herramienta personal: los textos, la organización y los mensajes
asumían que quien entraba conocía DolphinStats, Claude Code y el repo de notas. Estas tres
etapas la vuelven usable por **estudiantes y profesionales** que no conocen nada de eso, sin
cambiar su arquitectura (página estática + Vercel Edge Functions + DeepSeek + repo privado
`leonidcapo/asesor-stata` como base de notas).

Decisiones de producto que fijan el alcance:

- **Son 3 usuarios.** Basta el Basic Auth compartido de `middleware.js`; no hay login
  individual ni límites de uso por persona (se descartó esa etapa).
- **«Preguntar» responde solo con las notas de la base**, que crecen con el monitoreo semanal.
  No usa conocimiento general del modelo. Código (Revisar/Explicar/Generar/Interpretar) sí lo usa.
- Debe servir **para aprender y para trabajar**.

Complementa, no reemplaza, los diseños anteriores:
[web](2026-09-29-asesor-stata-web-design.md), [código](2026-09-29-asesor-stata-codigo-design.md),
[router de relevancia](2026-09-30-asesor-stata-router-relevancia-design.md).

## Pestañas

| Pestaña | Qué muestra |
|---|---|
| Explorar | Solo **guías** (notas escritas a mano), por tema y en orden de aprendizaje; filtro por palabra; «Empieza aquí» en el tour rápido |
| Preguntar | Respuesta sintetizada solo con las notas, con las notas citadas |
| Radar | Notas del **monitoreo semanal**, la más reciente primero, por tandas de 15, con filtro |
| Código | Cuatro modos: Revisar, Explicar, Generar, Interpretar resultados |

Una nota se abre arriba de la página con «Volver» (recupera pestaña y scroll de origen) y
dirección propia (`#nota=<path>`), así que se puede compartir y el botón atrás funciona. Mientras
se lee, queda resaltada la pestaña de origen; tocar cualquier pestaña cierra la nota.

## Formato de las notas y del índice

El contrato vive en el repo de notas (`docs/2026-09-28-base-conocimiento-design.md`). Lo que la
web espera:

- Secciones de una nota: `## Resumen`, `## En simple`, `## Ejemplo` (opcional, bloque
  ` ```stata `), `## Relevancia para DolphinStats`. Esta última se muestra **plegada** al final
  como «Nota interna».
- Línea de `INDEX.md`:
  `- [Título](path) — resumen[ || explicación en simple][ · YYYY-MM-DD[ · auto]]`
  - ` · auto` la escribe solo el monitoreo: separa **Radar** (con marca) de **guías** (sin marca).
  - ` || ` separa el resumen técnico de la explicación simple. Las tarjetas del Radar muestran
    la simple; el resumen técnico es el que usa el router de relevancia.
- `parseIndex` (`api/_lib/asesor-stata-github.js`) devuelve por nota
  `{titulo, path, resumen, simple, fecha, auto}`.

Al cambiar este formato hay que publicar **primero la web y después el repo de notas**: una web
vieja con un índice nuevo muestra restos del formato en los resúmenes.

## Conversor de Markdown

Sigue siendo propio y chico (el CSP exige `script-src 'self'`). Soporta lo que usan las notas:
`##`, listas con líneas de continuación y un nivel de sub-ítems, `**negrita**`, `*cursiva*`,
`` `código` `` y bloques ` ``` ` (a los que la página les agrega un botón «Copiar»). Todo el
texto se escapa antes de formatear; los hallazgos del modelo se pintan con el mismo conversor.

## Respuestas en streaming

Una Edge Function debe *empezar* a responder en ~25 s. Una revisión de un do-file real tarda
más, así que los endpoints de consulta y de código:

1. Validan la entrada y, si falla, responden con su código HTTP (400/405/503) como siempre.
2. Si es válida, abren la respuesta ya (200), mandan un espacio cada 5 s y escriben el JSON al
   final (`JSON.parse` ignora los espacios iniciales).
3. Llaman a DeepSeek con `stream: true` y acumulan solo el contenido visible.

Consecuencia: los fallos posteriores a la validación llegan como `{error}` **dentro de un 200**;
el cliente trata `r.data.error` como error. Todo esto está en `api/_lib/asesor-stata-llm.js`
(`llamarDeepSeek`, `respuestaEnStreaming`, `mensajeError`). Tope del servidor: 120 s; del
navegador: 90 s.

## Endpoint de código (`POST /api/asesor-stata-codigo`)

Campo común: `nivel` (`basico` | `intermedio` | `avanzado`).

| `modo` | Entrada | Salida |
|---|---|---|
| `revisar` | `codigo` (≤ 20 000) | `{hallazgos: [{severidad, lineas, que, por_que, como_arreglar, codigo_corregido, nota_citada}]}` — máx. 8 |
| `explicar` | `codigo` (≤ 20 000) | `{resumen, pasos: [{lineas, que_hace, ojo}]}` — máx. 12 pasos |
| `interpretar` | `salida` (≤ 8 000), `contexto` opcional (≤ 500) | `{que_se_hizo, resultados: [{dato, significado}], precauciones: [], como_reportarlo}` |
| `generar` | `descripcion` (≤ 1 000); opcional `codigo_previo` (≤ 12 000) + `ajuste` (≤ 500), los dos o ninguno | `{codigo, explicacion, notas_citadas}` |

- En `revisar` y `explicar` el código llega al modelo con las **líneas numeradas** (`  12| …`)
  para que cite líneas reales. El servidor normaliza `lineas` a `"12"` o `"12-15"` y lo deja en
  `null` si está fuera del archivo, invertido o mal formado; a `codigo_corregido` le quita
  prefijos `N| ` copiados y lo recorta a 1 500 caracteres.
- `revisar` y `generar` consultan la base de notas (router de relevancia). Con textos de más de
  3 000 caracteres el router recibe un **extracto** (comentarios + comandos usados), no el
  archivo entero. `explicar` e `interpretar` no consultan la base.
- Los ítems malformados de las listas se descartan uno a uno; si falta lo esencial se responde
  `{error}`.

Los límites de caracteres están duplicados en `asesor-stata.js` (contadores) y deben coincidir.

## Lado del cliente

- Mensajes de espera que avanzan con los segundos y botón bloqueado mientras se espera.
- Subida de `.do` (UTF-8 o, si no es válido, Latin-1), contadores con aviso al pasar el límite.
- Ejemplos con un clic en cada modo; nivel elegido recordado en `localStorage`.
- Informe de revisión en Markdown (copiar o descargar), armado en el navegador.
- Formulario guiado de Generar: arma la `descripcion`; no cambia el contrato del endpoint.
- Aviso de privacidad (el texto va a un servicio externo) y de que la IA puede equivocarse.
- Español neutro en la página, los mensajes de error y los prompts.

## Testing

Mismo patrón que el resto: `fetch` global simulado, sin credenciales, corrido con `node`
(`tests/test-asesor-stata-markdown.mjs` y `api/tests/test-asesor-stata-*.mjs`). Las funciones
puras del cliente (conversor, filtros, separación guías/radar, informe, descripción guiada) se
exportan desde `asesor-stata.js` para probarlas sin DOM. El monitor se prueba con `pytest` en el
repo de notas.

La interfaz se verificó a mano con un servidor local que lee las notas de la copia local y con
respuestas simuladas del endpoint.

## Límites conocidos

- **Las respuestas reales del modelo no están cubiertas por tests**: dependen de los prompts.
  Falta medir con DeepSeek real cuánto tarda Revisar ahora que pide línea y código corregido.
- **Los ejemplos de las guías no se ejecutaron en Stata** al escribirlos; deben verificarse.
- Las explicaciones «En simple» del Radar se redactaron solo a partir del resumen de cada nota.
- El filtro de Explorar y del Radar busca en título, resumen y explicación simple, no en el
  cuerpo de la nota.

## Fuera de alcance

- Ejecutar Stata (sigue sin infraestructura para eso).
- «Preguntar» con conocimiento general del modelo (decisión de producto).
- Login individual, límites por usuario e historial entre sesiones.
