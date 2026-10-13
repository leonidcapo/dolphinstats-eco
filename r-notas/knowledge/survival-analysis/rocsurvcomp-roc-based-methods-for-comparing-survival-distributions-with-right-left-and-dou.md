---
title: "ROCsurvcomp: ROC-Based Methods for Comparing Survival Distributions with Right, Left, and Doubly Censored Data"
source: CRAN
source_url: https://cran.r-project.org/package=ROCsurvcomp
date: 2026-10-13
tags: [r, monitoreo-automatico]
---

## Resumen
ROCsurvcomp implementa métodos no paramétricos y semiparamétricos para comparar dos distribuciones de supervivencia bajo riesgos no proporcionales (non-PH) con datos censurados por derecha, izquierda o doblemente censurados. Los métodos se basan en la longitud de la curva ROC y su estimador kernel (Bantis et al. 2021), el coeficiente de solapamiento (OVL) y su estimador kernel (Schmid y Schmidt 2006), y un nuevo enfoque de inferencia conjunta que combina ambos. No requieren conocer de antemano el patrón non-PH y manejan el fenómeno 'last is censored' para datos censurados por derecha mediante enfoques paramétricos flexibles solo en la cola más allá del último evento observado, y el análogo 'first is censored' para datos censurados por izquierda.

## En simple
Este paquete sirve para comparar dos grupos cuando se estudia el tiempo hasta que ocurre un evento (por ejemplo, recuperación o muerte), incluso si algunos casos no se observan hasta el final. Ofrece métodos que no necesitan saber de antemano si el riesgo de evento cambia con el tiempo entre los grupos.

## Relevancia para DolphinStats
Es relevante para el tema de cohortes del roadmap, ya que provee métodos para comparar distribuciones de supervivencia con datos censurados, un análisis típico en estudios de seguimiento. Además, aborda escenarios de riesgos no proporcionales sin asumir un patrón previo, lo que puede ser útil en la evaluación de intervenciones en cohortes clínicas.
