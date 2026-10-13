---
title: ENDES en R — declarar el diseño muestral complejo con survey::svydesign
source: guia
source_url: local — r/ejemplos_endes.R (datos simulados) y r/validar_endes_anios.R (ENDES 2016-2025 reales, contrastado con Stata)
date: 2026-10-13
tags: [r, endes, survey, svydesign, diseno-complejo, ponderacion]
---

## Resumen
Toda estimación con ENDES debe declarar el diseño: **conglomerado (UPM)**, **estrato** y
**factor de ponderación**. En R el equivalente de `svyset` de Stata es `survey::svydesign()`.

- **Dónde están las variables de diseño.** En los módulos originales de la ENDES (`.sav`, 2016–2025)
  están **solo en el módulo del hogar (`RECH0`)**: `HV021` (UPM), `HV022` (estrato) y `HV005`
  (factor de ponderación **multiplicado por 1 000 000**; hay que dividirlo). Los demás módulos
  (niños `RECH6`, mujeres `REC91`, etc.) no las traen: se unen por `HHID` (ver guía 05). Los
  módulos de salud (`CSALUD01`, `CSALUD08`) traen su propio peso (`PESO15_AMAS`, `Pesomen12`):
  confirma en el diccionario cuál corresponde a tu módulo (ver guía 06: en salud el peso del hogar
  `HV005` mueve la prevalencia 1–2 puntos). Los nombres cambian por módulo y año
  (`HV021` o `V021`, etc.): verifícalos con `names()` antes de escribir el código.
- **Mayúsculas y minúsculas.** En 2016 `RECH0` trae `HV021` en mayúscula pero `hv022` y `hv005` en
  minúscula, y en 2016–2017 algunos archivos son `.SAV`. Para que el mismo código sirva en todos los
  años, pasa los nombres a mayúscula justo después de leer: `names(x) <- toupper(names(x))`.
- `ids = ~HV021`, `strata = ~HV022`, `weights = ~peso` (con `peso = HV005/1e6`).
- `nest = TRUE` solo hace falta si los códigos de UPM se repiten entre estratos. En ENDES 2016–2025 son
  únicos (se comprobó: ninguna UPM aparece en más de un estrato), así que con o sin `nest = TRUE`
  el resultado es idéntico; dejarlo es inofensivo.
- `options(survey.lonely.psu = "adjust")` evita el error cuando un estrato queda con una sola UPM
  (por ejemplo al analizar un subgrupo pequeño). Es el análogo de `singleunit(centered)` de Stata.
  Es una decisión metodológica: indícala en el método.
- **Comprobado contra Stata** (anemia en niñas y niños, ENDES 2024, n = 18 358): R da media 0.33803,
  EE 0.004437 y 2 979 grados de libertad, igual que `svyset HV021 [pw=HV005], strata(HV022)
  singleunit(centered)` + `svy: mean`. Se repitió para **2016–2025**: R coincide con Stata en los 10 años
  (media, EE, IC t y grados de libertad, con diferencias de orden 1e-16); los grados de libertad van de
  1 967 (2020, menos casos) a 3 147 (2017).
- Si no se declara el diseño, los errores estándar salen demasiado pequeños y los IC demasiado estrechos.

## En simple
La ENDES no es una muestra al azar simple: se eligió por zonas y por etapas, y cada persona
«representa» a distinto número de peruanos. En R se le explica esto al programa con
`svydesign()`; si no se hace, los resultados parecen más precisos de lo que realmente son. Las tres
piezas (zona, estrato y peso) vienen en el módulo del hogar y se pegan a los demás módulos.

## Ejemplo
Con una base ya unida a las variables de diseño (en datos reales, cambia `endes` por tu base).

```r
library(survey)
endes$peso <- endes$HV005 / 1e6           # el factor viene multiplicado por 1,000,000
options(survey.lonely.psu = "adjust")
dis <- svydesign(ids = ~HV021, strata = ~HV022, weights = ~peso,
                 data = endes, nest = TRUE)
dis
degf(dis)                                 # grados de libertad (UPM - estratos)
```

## Errores frecuentes
- Olvidar dividir `HV005` entre 1 000 000 (no cambia proporciones, sí totales poblacionales).
- Buscar `V021`/`V005` en un módulo que no las trae: hay que unirlo con `RECH0` por `HHID`.
- Usar el peso de la ENDES general en un módulo de salud que tiene el suyo.
- Filtrar la base antes de `svydesign()` en lugar de usar `subset()` sobre el diseño (ver guía 04).
- Usar `weights = ~HV005` sin `ids`/`strata`: da pesos, pero no corrige la varianza.
