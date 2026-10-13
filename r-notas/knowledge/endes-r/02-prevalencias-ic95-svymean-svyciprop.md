---
title: ENDES en R — prevalencias con IC 95 % (svymean, svyciprop, svyby)
source: guia
source_url: local — r/ejemplos_endes.R (datos simulados) y r/validar_endes_anios.R (ENDES 2024 real, contrastado con Stata)
date: 2026-10-13
tags: [r, endes, survey, prevalencia, intervalo-de-confianza, svyby]
---

## Resumen
Para una variable binaria (0/1) la prevalencia ponderada es su media.
- `svymean(~var, dis)`: media/proporción con error estándar.
- `svyciprop(~var, dis, method = "logit")`: proporción con **IC 95 %** (el método `logit` evita
  límites fuera de 0–1; es una opción habitual en informes de encuestas).
- `svyby(~var, ~grupo, dis, svymean, vartype = c("ci","se"))`: prevalencia por categorías.
- `svytable(~a + b, dis)` con `prop.table(..., 1)`: porcentajes por fila ponderados.
- La variable debe estar codificada 0/1 (no 1/2) para que la media sea la prevalencia.
- **IC que coincida con Stata.** `svy: mean` de Stata usa la distribución t con los grados de
  libertad del diseño: en R, `confint(svymean(~y, dis), df = degf(dis))`. `svyciprop(method =
  "logit")` da un IC ligeramente distinto (parecido al IC logit de `svy: proportion`). Ejemplo real, anemia
  infantil ENDES 2024: Stata/`svymean` con t → 33.80 % (IC 32.93–34.67); `svyciprop` logit →
  33.80 % (IC 32.94–34.68). Por área: urbano 30.2 % (29.2–31.2) y rural 42.4 % (40.7–44.0).

## En simple
Para saber «qué porcentaje de mujeres tiene anemia» no basta contar filas: cada persona pesa
distinto. `svymean` y `svyciprop` calculan ese porcentaje ya ponderado y te dan el margen de
error (intervalo de confianza). `svyby` hace lo mismo por grupos (urbano/rural, región, etc.).

## Ejemplo
Continúa del diseño `dis` de la guía 01.

```r
svymean(~anemia, dis)                              # proporción y error estándar
svyciprop(~anemia, dis, method = "logit")          # proporción con IC 95 %
svyby(~anemia, ~v025, dis, svymean, vartype = c("ci", "se"))   # por área
round(100 * prop.table(svytable(~v025 + anemia, dis), 1), 1)   # % por fila
```

## Errores frecuentes
- Usar `mean()` o `table()` sin ponderar: da la prevalencia de la muestra, no de la población.
- Variable 1/2 en vez de 0/1: la media no es la prevalencia; recodifica antes.
- Reportar el IC sin indicar el método (`logit`, `beta`, etc.).
