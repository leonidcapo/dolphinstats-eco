# dolphinstats-eco

Sitio privado, sin indexar, para herramientas internas de DolphinStats que
todavía no se anexan al sitio público (`dolphinstats-web`). Sin backend:
HTML/JS estático, protegido con Basic Auth vía `middleware.js` (Vercel Edge
Middleware, funciona en el plan Hobby gratuito).

## Herramientas

- **Journal Match** (`journal-match.html`): buscador de revistas por
  título/palabras clave, dataset Scimago Journal Rank (`data/journals.json`,
  generado desde `endes-generator/scripts/build_journals.py`, ver ese repo).

- **Asesor Stata** (`asesor-stata.html`): guías con ejemplos, radar semanal de
  novedades, preguntas sobre la base de notas y asistente de código Stata
  (Revisar, Explicar, Generar e Interpretar resultados), sobre la base de
  conocimiento del repo privado `leonidcapo/asesor-stata` (ver ese repo para
  el sistema completo: monitoreo automático semanal + comando `/asesor-stata`
  de Claude Code). Backend en `api/asesor-stata-base.js` (índice y notas),
  `api/asesor-stata-consulta.js` (preguntas, solo con las notas) y
  `api/asesor-stata-codigo.js` (código y resultados), los dos últimos con
  DeepSeek en streaming (`api/_lib/asesor-stata-llm.js`). Diseño en
  `docs/superpowers/specs/`; el más reciente es
  `2026-10-07-asesor-stata-usabilidad-etapas-1-3-design.md`.

## Deploy en Vercel

1. Conectar este repo en [vercel.com/new](https://vercel.com/new) (framework:
   Other / static, sin build command).
2. En **Settings → Environment Variables**, agregar `SITE_USER` y
   `SITE_PASS` (elegí un usuario y contraseña — no van en el repo).
3. Agregar también `ASESOR_STATA_GITHUB_TOKEN` (Personal Access Token de
   GitHub, permiso de solo lectura sobre el repo privado
   `leonidcapo/asesor-stata` — Settings → Developer settings → Personal
   access tokens → Fine-grained, con acceso de solo ese repo) y
   `DEEPSEEK_API_KEY` (la misma que ya usa `clasificar-diseno.js`, si no
   está configurada todavía).
4. Deploy. El sitio pedirá esas credenciales (Basic Auth del navegador)
   antes de mostrar cualquier página.

## Actualizar el dataset de Journal Match

Cuando se regenere `journals.json` en `endes-generator`
(`python scripts/build_journals.py knowledge/scimago.csv <salida>`), copiar
el resultado a `data/journals.json` acá y hacer commit.
