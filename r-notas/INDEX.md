# Índice — Asesor R

Registro de las notas de la base de conocimiento, agrupadas por tema. Mismo formato que el
Asesor Stata: cada línea enlaza a la nota, da un resumen de una frase y termina con la fecha
(`· YYYY-MM-DD`, igual al `date:` del frontmatter).

## endes-r
- [ENDES en R — declarar el diseño muestral complejo con survey::svydesign](knowledge/endes-r/01-diseno-muestral-complejo-svydesign.md) — ids, strata y pesos (v005/1e6); equivalente a svyset. · 2026-10-13
- [ENDES en R — prevalencias con IC 95 % (svymean, svyciprop, svyby)](knowledge/endes-r/02-prevalencias-ic95-svymean-svyciprop.md) — proporciones ponderadas con IC logit y por grupos. · 2026-10-13
- [ENDES en R — regresión logística con diseño complejo (svyglm) y tabla de OR](knowledge/endes-r/03-regresion-logistica-svyglm.md) — quasibinomial, OR con IC y tbl_regression. · 2026-10-13
- [ENDES en R — analizar subpoblaciones sin romper el diseño](knowledge/endes-r/04-subpoblaciones-subset-svyby.md) — subset() sobre el diseño, no filtrar antes. · 2026-10-13
- [ENDES en R — unir módulos (hhid/caseid), recodificar y usar srvyr](knowledge/endes-r/05-unir-modulos-recodificar-srvyr.md) — left_join con control de filas, cut() y srvyr. · 2026-10-13
