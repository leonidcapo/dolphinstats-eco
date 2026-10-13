---
title: "Factorial Multivariate Bayesian Causal Forests: heterogeneous main and interaction effects of multiple treatments on correlated outcomes"
source: arXiv
source_url: https://arxiv.org/abs/2609.31332v1
date: 2026-10-13
tags: [r, monitoreo-automatico]
---

## Resumen
El artículo introduce el factorial multivariate Bayesian causal forest, un modelo bayesiano no paramétrico que descompone la superficie de respuesta factorial sobre el retículo de tratamientos en un término pronóstico más un conjunto de sum-of-trees, uno por cada efecto principal o de interacción, con parámetros de hoja multivariados correlacionados estimados conjuntamente. Un único kernel ponderado por indicadores muestrea todos los componentes, de modo que el modelo de dos tratamientos, el causal forest multivariado de un solo tratamiento y una truncación general de orden r comparten el mismo sampler. Incluye la identificación ANOVA/Möbius de cada estimando, un motor eficiente en Rcpp y una capa de interpretabilidad basada en mapas de incertidumbre que suprimen valores. En simulaciones los estimadores de efecto promedio resultan insesgados, con cobertura nominal, consistentes y robustos ante mala especificación, fallando solo bajo confusión no medida (lo cual se señala explícitamente); se ilustra con datos clínicos, agrícolas, económicos y una aplicación a la encuesta NHANES. El software se distribuye como paquete de R.

Autores: Danilo A. Sarti.

## En simple
Sirve para estudios donde se aplican varios tratamientos a la vez y se miden varios resultados que están relacionados entre sí, en lugar de analizar cada combinación por separado y perder las interacciones. Permite estimar qué tratamiento funciona mejor y para qué tipo de pacientes, con una herramienta ya empaquetada para usar en R.

## Relevancia para DolphinStats
Aporta un método y software en R para estimar efectos heterogéneos con múltiples exposiciones y desenlaces correlacionados en datos observacionales, escenario frecuente en los estudios de cohorte que el roadmap busca cubrir. Además, su enfoque de motor Rcpp y de manejo conjunto de la incertidumbre es reutilizable en los módulos analíticos de DolphinStats.
