---
title: ENDES en R — regresión logística con diseño complejo (svyglm) y tabla de OR
source: guia
source_url: local — r/ejemplos_endes.R (ejecutado con datos simulados, R 4.6.1, survey, gtsummary)
date: 2026-10-13
tags: [r, endes, survey, svyglm, regresion-logistica, odds-ratio, gtsummary]
---

## Resumen
Equivalente a `svy: logit` de Stata: `svyglm(y ~ x, design = dis, family = quasibinomial())`.
- Se usa `quasibinomial()` (no `binomial()`) para evitar la advertencia de «non-integer #successes»
  con pesos; las estimaciones son las mismas.
- Odds ratios con IC: `exp(cbind(OR = coef(m), confint(m)))`.
- Tabla lista para tesis: `gtsummary::tbl_regression(m, exponentiate = TRUE)` (requiere también
  los paquetes `broom` y `broom.helpers`).
- Las variables categóricas deben ser `factor` con la categoría de referencia deseada
  (`relevel()` o el orden de los niveles). Los p-valores de `svyglm` usan la distribución t con
  los grados de libertad del diseño.

## En simple
La regresión logística mide cuánto cambia la probabilidad de tener algo (por ejemplo anemia)
según otras características. Con encuestas hay que usar `svyglm` para que el cálculo respete el
diseño de la muestra. El resultado se suele presentar como OR (odds ratio): un OR > 1 indica
más probabilidad respecto a la categoría de referencia.

## Ejemplo
Continúa del diseño `dis` de la guía 01.

```r
endes$rural   <- factor(endes$v025, labels = c("Urbano", "Rural"))
endes$quintil <- factor(endes$v190, labels = paste0("Q", 1:5))
dis <- update(dis, rural = endes$rural, quintil = endes$quintil)

m <- svyglm(anemia ~ rural + quintil + v012, design = dis, family = quasibinomial())
summary(m)
round(exp(cbind(OR = coef(m), confint(m))), 2)

library(gtsummary)
tbl_regression(m, exponentiate = TRUE)     # tabla de OR con IC y p
```

## Errores frecuentes
- Usar `glm()` en vez de `svyglm()`: ignora el diseño y subestima el error.
- Dejar una variable categórica como número (p. ej. `v190` 1–5): se estima una sola pendiente lineal.
- Interpretar OR como riesgo relativo cuando el desenlace es frecuente.
