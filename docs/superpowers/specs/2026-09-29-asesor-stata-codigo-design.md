# Diseño: pestaña "Código" (Revisar + Generar) — Asesor Stata

Fecha: 2026-09-29

## Propósito

Asesor Stata hoy es un sistema de consulta (RAG de solo lectura sobre `knowledge/`): explora
notas guardadas o responde preguntas citando esas notas, nunca genera ni evalúa código propio
del usuario. Este subsistema agrega el primer paso hacia un asistente verdaderamente agéntico
sin necesitar ejecutar Stata de verdad (eso queda fuera de alcance, ver abajo): **Revisar**
código Stata que el usuario ya escribió, y **Generar** un do-file nuevo a partir de una
descripción en lenguaje natural — ambos sin correr nada, solo análisis/síntesis vía LLM.

## Arquitectura

Un endpoint nuevo, `api/asesor-stata-codigo.js`, mismo patrón que `api/asesor-stata-consulta.js`
(Edge Function, DeepSeek, contexto opcional de `knowledge/` vía la API de GitHub). Una pestaña
nueva "Código" en `asesor-stata.html`, con dos sub-modos conmutables (Revisar / Generar) que
comparten el mismo selector de nivel (Básico/Intermedio/Avanzado) ya implementado para Buscar.

Diferencia clave respecto a Buscar: **no restringe al modelo a solo lo documentado en
`knowledge/`** — usa su conocimiento general de Stata para revisar o generar código (limitarlo
a ~50 notas sería insuficiente para código arbitrario). El contexto de la base se sigue
mandando como apoyo, y el modelo cita una nota puntual solo cuando aplica de verdad (ej. la
nota sobre macros mal escritas, si el código pegado tiene ese problema).

```
api/asesor-stata-codigo.js   — Edge Function: revisar y generar, un solo archivo
asesor-stata.html            — agrega pestaña "Código" + sub-tabs Revisar/Generar
asesor-stata.js              — wiring de la pestaña nueva
```

Se descartaron dos alternativas: (a) dos endpoints separados (`-revisar.js`/`-generar.js`) —
comparten tanto código (contexto, llamada a DeepSeek, manejo de nivel) que separarlos duplicaría
lógica sin beneficio real; (b) restringir el modelo a la base como en Buscar — insuficiente
para generar código sobre pedidos arbitrarios del usuario.

## Flujo de datos

### Revisar

1. El usuario pega su `.do` en un textarea (sin upload de archivos — texto plano, mismo patrón
   que Buscar), elige nivel, envía.
2. El cliente hace `POST /api/asesor-stata-codigo` con
   `{ modo: "revisar", nivel, codigo }`.
3. El backend intenta traer el contexto de `knowledge/` (igual que `construirContexto` en
   `asesor-stata-consulta.js`) — si falla, lo loguea y sigue sin contexto, porque acá no es
   obligatorio como en Buscar.
4. Arma el prompt: código del usuario + contexto opcional + instrucción de nivel, y le pide al
   modelo una lista de hallazgos en JSON:
   `{ "hallazgos": [{ "severidad": "importante"|"sugerencia", "que": "...", "por_que": "...",
   "como_arreglar": "...", "nota_citada": {"titulo": "...", "path": "..."} | null }] }`.
5. El cliente renderiza cada hallazgo como una tarjeta (color según severidad), con el texto ya
   adaptado al nivel elegido por el prompt.

### Generar

1. El usuario describe en texto libre qué quiere hacer, elige nivel, envía.
2. `POST /api/asesor-stata-codigo` con `{ modo: "generar", nivel, descripcion }`.
3. Mismo intento de contexto opcional que Revisar.
4. El backend le pide al modelo `{ "codigo": "<do-file completo>", "explicacion": "<qué hace,
   en el nivel elegido>", "notas_citadas": [{"titulo","path"}] }`.
5. El cliente muestra el código en un `<pre>` con botón "Copiar" (usa `navigator.clipboard`,
   con fallback silencioso si no está disponible) y la explicación debajo.

## Manejo de errores

Mismo criterio que el resto del proyecto — nunca romper en silencio:

| Caso | Respuesta |
|---|---|
| Sin `DEEPSEEK_API_KEY` | 503 |
| `modo` ausente o distinto de `revisar`/`generar` | 400 |
| `codigo` vacío (modo revisar) / `descripcion` vacía (modo generar) | 400 |
| Fallo al traer contexto de `knowledge/` (sin `ASESOR_STATA_GITHUB_TOKEN`, o error de GitHub) | Se loguea y se continúa sin contexto — NO es un error fatal acá, a diferencia de Buscar |
| Error HTTP de DeepSeek | 502 |
| JSON de DeepSeek malformado o con forma inesperada (falta `hallazgos`/`codigo`, tipos incorrectos) | 502 |
| `nota_citada`/`notas_citadas` con un item malformado | Se filtra ese item, igual que en Buscar |

## Testing

Mismo patrón que `test-asesor-stata-consulta.mjs`: `fetch` global mockeado con router por URL,
sin credenciales reales, corrido con `node`. Casos a cubrir: cada validación 400, sin
`DEEPSEEK_API_KEY` → 503, modo revisar feliz (con y sin nota citada), modo generar feliz,
contexto de GitHub caído no bloquea la respuesta (fallback sin contexto), error de DeepSeek →
502, JSON malformado → 502, hallazgo/nota_citada con item malformado se filtra sin romper.

## Fuera de alcance

- Ejecutar el código generado o revisado contra Stata real (requiere infraestructura propia —
  licencia + servidor/sandbox de ejecución — evaluado como proyecto separado, no parte de esto).
- Subida de archivos `.do` (solo texto pegado, igual que Buscar).
- Historial de códigos revisados/generados entre sesiones (sin persistencia — cada consulta es
  independiente, igual que Buscar).
- Integración con el Modo 4 de `/asesor-stata` en Claude Code (ese sigue siendo el modo
  "completo", con acceso al filesystem real del usuario; esto es la versión web, más acotada).
