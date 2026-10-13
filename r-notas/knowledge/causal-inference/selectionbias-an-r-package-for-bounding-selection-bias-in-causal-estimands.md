---
title: "SelectionBias: An R Package for Bounding Selection Bias in Causal Estimands"
source: The R Journal
source_url: https://journal.r-project.org/articles/RJ-2026-049
date: 2026-10-13
tags: [r, monitoreo-automatico]
---

## Resumen
El paquete SelectionBias (The R Journal) implementa cotas (bounds) para el sesgo de selección en estimandos causales, concretamente para el riesgo relativo y la diferencia de riesgos causales, tanto en la población total como en la población seleccionada. Incluye cinco cotas: la de Smith y VanderWeele (SV), una cota sharp mejorada que usa los mismos parámetros de sensibilidad, la cota assumption-free (AF) basada solo en datos observados, y las cotas generalizada (GAF) y contrafactual (CAF) que combinan datos y parámetros de sensibilidad. Se ilustra con un dataset simulado inspirado en el estudio del efecto del virus Zika sobre microcefalia en Brasil. Es una herramienta de análisis de sensibilidad para cuando hay dropouts, datos faltantes o criterios de inclusión/exclusión que pueden invalidar el estudio.

Autores: Stina Zetterstrom, Ingeborg Waernbaum.

## En simple
Cuando en un estudio se pierde gente en el camino o se deja afuera a algunos participantes, el resultado puede quedar torcido sin que nos demos cuenta. Este paquete calcula hasta dónde podría llegar ese error, dando un rango de resultados posibles en lugar de un único número, para no sacar conclusiones falsely seguras.

## Relevancia para DolphinStats
Aporta directamente al módulo de cohortes y al portal de seguimiento, donde la pérdida de seguimiento y los criterios de selección son el riesgo principal de validez; permite ofrecer análisis de sensibilidad de sesgo de selección como entregable estándar en estudios clínicos observacionales.
