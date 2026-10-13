---
title: ENDES en R — declarar el diseño muestral complejo con survey::svydesign
source: guia
source_url: local — r/ejemplos_endes.R (ejecutado con datos simulados, R 4.6.1, survey)
date: 2026-10-13
tags: [r, endes, survey, svydesign, diseno-complejo, ponderacion]
---

## Resumen
Toda estimación con ENDES debe declarar el diseño: **conglomerado (UPM)**, **estrato** y
**factor de ponderación**. En R el equivalente de `svyset` de Stata es `survey::svydesign()`.
Variables habituales del módulo de mujeres/niños: `v021` (conglomerado/UPM), `v022`
(estrato), `v005` (factor de ponderación **multiplicado por 1 000 000**; hay que dividirlo).

- `ids = ~v021`, `strata = ~v022`, `weights = ~peso` (con `peso = v005/1e6`).
- `nest = TRUE` cuando los códigos de UPM se repiten entre estratos (caso habitual).
- `options(survey.lonely.psu = "adjust")` evita el error cuando un estrato queda con una sola UPM
  (por ejemplo al analizar un subgrupo). Es una decisión metodológica: indícala en el método.
- Si no se declara el diseño, los errores estándar salen demasiado pequeños y los IC demasiado estrechos.
- Verifica los nombres de variables según el año y módulo ENDES que uses (pueden variar).

## En simple
La ENDES no es una muestra al azar simple: se eligió por zonas y por etapas, y cada persona
«representa» a distinto número de peruanos. En R se le explica esto al programa con
`svydesign()`; si no se hace, los resultados parecen más precisos de lo que realmente son.

## Ejemplo
Con datos simulados de estructura ENDES (en datos reales, cambia `endes` por tu base).

```r
library(survey)
endes$peso <- endes$v005 / 1e6            # el factor viene multiplicado por 1,000,000
options(survey.lonely.psu = "adjust")
dis <- svydesign(ids = ~v021, strata = ~v022, weights = ~peso,
                 data = endes, nest = TRUE)
dis
```

## Errores frecuentes
- Olvidar dividir `v005` entre 1 000 000 (no cambia proporciones, sí totales poblacionales).
- Filtrar la base antes de `svydesign()` en lugar de usar `subset()` sobre el diseño (ver guía 04).
- Usar `weights = ~v005` sin `ids`/`strata`: da pesos, pero no corrige la varianza.
