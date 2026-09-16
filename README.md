# dolphinstats-eco

Sitio privado, sin indexar, para herramientas internas de DolphinStats que
todavía no se anexan al sitio público (`dolphinstats-web`). Sin backend:
HTML/JS estático, protegido con Basic Auth vía `middleware.js` (Vercel Edge
Middleware, funciona en el plan Hobby gratuito).

## Herramientas

- **Journal Match** (`journal-match.html`): buscador de revistas por
  título/palabras clave, dataset Scimago Journal Rank (`data/journals.json`,
  generado desde `endes-generator/scripts/build_journals.py`, ver ese repo).

## Deploy en Vercel

1. Conectar este repo en [vercel.com/new](https://vercel.com/new) (framework:
   Other / static, sin build command).
2. En **Settings → Environment Variables**, agregar `SITE_USER` y
   `SITE_PASS` (elegí un usuario y contraseña — no van en el repo).
3. Deploy. El sitio pedirá esas credenciales (Basic Auth del navegador)
   antes de mostrar cualquier página.

## Actualizar el dataset de Journal Match

Cuando se regenere `journals.json` en `endes-generator`
(`python scripts/build_journals.py knowledge/scimago.csv <salida>`), copiar
el resultado a `data/journals.json` acá y hacer commit.
