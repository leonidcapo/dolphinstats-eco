---
title: ENDES en R — unir módulos (hhid/caseid), recodificar y usar srvyr
source: guia
source_url: local — r/ejemplos_endes.R (ejecutado con datos simulados, R 4.6.1, dplyr, srvyr)
date: 2026-10-13
tags: [r, endes, dplyr, left_join, recodificacion, srvyr, haven]
---

## Resumen
Los módulos ENDES se unen por llaves de identificación (revisa el diccionario del año usado):
hogar con `hhid`; personas con `caseid` (mujer) o `hhid` + número de línea según el módulo.
- Lectura de archivos `.sav`/`.dta`: `haven::read_sav()` / `haven::read_dta()`.
- `dplyr::left_join(x, y, by = "hhid", relationship = "many-to-one")` avisa si la unión
  duplica filas inesperadamente. Comprueba `nrow()` antes y después.
- Recodificar con `cut()` (intervalos) o `case_when()`; los valores especiales de la ENDES
  (p. ej. 8, 9, 99 = «no sabe/sin dato») deben pasarse a `NA` antes de calcular.
- `srvyr` ofrece el mismo diseño con sintaxis dplyr: `as_survey_design()`, `group_by()`,
  `summarise(survey_mean(var, vartype = "ci"))`.
- Unir **antes** de declarar el diseño y no filtrar filas en ese paso.

## En simple
Cada módulo de la ENDES es una tabla distinta (hogar, mujeres, niños). Se pegan usando el
código que identifica el hogar o la persona. Después de pegar, conviene contar las filas para
asegurarte de que no se duplicó nada, y recién entonces recodificar variables y calcular.

## Ejemplo
Con `endes` simulada y una tabla `hogar` con una fila por hogar.

```r
library(dplyr); library(srvyr)
unido <- endes |>
  left_join(hogar, by = "hhid", relationship = "many-to-one") |>
  mutate(grupo_edad = cut(v012, c(14, 19, 29, 39, 49),
                          labels = c("15-19", "20-29", "30-39", "40-49")))
nrow(endes); nrow(unido)          # deben coincidir

unido |>
  as_survey_design(ids = v021, strata = v022, weights = peso, nest = TRUE) |>
  group_by(grupo_edad) |>
  summarise(prev = survey_mean(anemia, vartype = "ci"))
```

## Errores frecuentes
- Unir por una llave que no es única en el módulo «muchos» y duplicar casos.
- Dejar los códigos 9/99 de «sin dato» como valores reales.
- `cut()` con límites que dejan edades fuera (generan `NA`): revisa `table(..., useNA = "ifany")`.
