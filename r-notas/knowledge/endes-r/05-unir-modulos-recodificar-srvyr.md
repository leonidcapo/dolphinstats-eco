---
title: ENDES en R — unir módulos (hhid/caseid), recodificar y usar srvyr
source: guia
source_url: local — r/ejemplos_endes.R (datos simulados) y r/validar_endes_anios.R (ENDES 2016-2025 reales)
date: 2026-10-13
tags: [r, endes, dplyr, left_join, recodificacion, srvyr, haven]
---

## Resumen
Los módulos ENDES se unen por llaves de identificación (revisa el diccionario del año usado):
hogar con `hhid`; personas con `caseid` (mujer) o `hhid` + número de línea según el módulo.
- **Caso real (ENDES 2024):** las variables de diseño (`HV021`, `HV022`, `HV005`) están solo en
  `RECH0` (una fila por hogar, `HHID` único). El módulo de niñas y niños `RECH6` (20 290 filas) se
  une con `left_join(RECH0, by = "HHID", relationship = "many-to-one")`: no se pierde ni duplica
  ninguna fila, y el `HHID` (que trae espacios al inicio) coincide sin limpiarlo. Para el módulo
  de mujeres `REC91`, que solo trae `CASEID`, el hogar se obtiene quitando los últimos 3
  caracteres: `substr(CASEID, 1, nchar(CASEID) - 3)` (en 2024 coinciden los 37 117 casos).
- **Anemia infantil:** `HC57` (1 grave, 2 moderada, 3 leve, 4 sin anemia) → `anemia = 1` si
  `HC57 %in% 1:3`, `0` si es 4; los 1 932 niños sin dato de anemia (`HC57` perdido) quedan como `NA`, y quedan
  18 358 con dato (igual que el extracto del explorador). En **2016–2025** el `HHID` de `RECH0` es
  único cada año, el `left_join` con `RECH6` conserva todas las filas (sin hogares sin pareja) y los
  códigos de `HC57` son siempre 1 a 4, pero sus **etiquetas cambian** (en inglés en 2016–2017, «No
  anémico» en 2018, «Sin anemia» desde 2019): recodifica por el número, no por el texto.
- Lectura de archivos `.sav`/`.dta`: `haven::read_sav()` / `haven::read_dta()`.
- `dplyr::left_join(x, y, by = "hhid", relationship = "many-to-one")` avisa si la unión
  duplica filas inesperadamente. Comprueba `nrow()` antes y después.
- Recodificar con `cut()` (intervalos) o `case_when()`; revisa con `table(x, useNA = "ifany")` cómo
  vienen los «sin dato»: en algunas variables son `NA` (como `HC57`) y en otras códigos como 8, 9 o 99,
  que deben pasarse a `NA` antes de calcular.
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
