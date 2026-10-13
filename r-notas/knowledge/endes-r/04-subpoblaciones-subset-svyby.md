---
title: ENDES en R — analizar subpoblaciones sin romper el diseño (subset sobre el diseño)
source: guia
source_url: local — r/ejemplos_endes.R (ejecutado con datos simulados, R 4.6.1, survey)
date: 2026-10-13
tags: [r, endes, survey, subpoblacion, subset, svyby, lonely-psu]
---

## Resumen
Para estimar en un subgrupo (p. ej. mujeres < 25 años) se debe **filtrar el objeto de diseño**,
no la base antes de crear el diseño.
- Correcto: `subset(dis, v012 < 25)` (conserva todas las UPM y estratos para la varianza).
- Evitar: `svydesign(..., data = subset(endes, v012 < 25))`: puede subestimar el error estándar
  y generar estratos con una sola UPM (error «has only one primary sampling unit»).
- `svyby(~y, ~grupo, dis, svymean)` estima por varios subgrupos a la vez.
- Si aparece el error de una sola UPM, `options(survey.lonely.psu = "adjust")` lo evita, pero
  debe declararse en el método. Con muestras muy pequeñas en un subgrupo, reporta n y la
  precisión (IC) con cautela.

## En simple
Si solo te interesa un grupo (por ejemplo, adolescentes), no «recortes» la base y vuelvas a
declarar la encuesta: eso hace perder información sobre cómo se diseñó la muestra. Primero se
declara el diseño con todos los datos y luego se pide el subgrupo con `subset()`.

## Ejemplo
Continúa del diseño `dis` de la guía 01 (y 03 para `quintil`).

```r
dis_jov <- subset(dis, v012 < 25)
svymean(~anemia, dis_jov)

svyby(~anemia, ~quintil, dis, svymean)     # por quintil de riqueza
```

## Errores frecuentes
- Filtrar con `dplyr::filter()` antes de `svydesign()`.
- Olvidar que `subset()` sobre el diseño ya mantiene los pesos: no vuelvas a ponderar.
- Reportar subgrupos con pocos casos sin señalar su inestabilidad.
