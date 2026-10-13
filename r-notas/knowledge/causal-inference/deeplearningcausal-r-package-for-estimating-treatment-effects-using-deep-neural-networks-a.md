---
title: "DeepLearningCausal: R Package for Estimating Treatment Effects Using Deep Neural Networks and Ensemble Learning"
source: The R Journal
source_url: https://journal.r-project.org/articles/RJ-2026-035
date: 2026-10-13
tags: [r, monitoreo-automatico]
---

## Resumen
El artículo presenta DeepLearningCausal, un paquete de R que estima efectos causales usando redes neuronales profundas y meta-aprendizaje. Permite calcular efectos condicionales promedio (CATE) mediante meta-learners y efectos promedio poblacionales sobre los tratados (PATT) contemplando escenarios de incumplimiento del tratamiento. Además incorpora intervalos de predicción conformal para los efectos individuales (ITE), visualización de efectos heterogéneos y estimación por ensamble ponderado.

Autores: Nguyen Khoi Huynh, Yang Yang, Bumba Mukherjee.

## En simple
Es una herramienta que ayuda a responder, a partir de datos de personas seguidas en el tiempo, qué tan bien o mal funciona un tratamiento y cómo varía su efecto según las características de cada persona. Sirve para sacar conclusiones más confiables cuando no todos siguen el tratamiento tal como estaba indicado.

## Relevancia para DolphinStats
Aporta métodos de inferencia causal aplicables directamente al módulo de cohortes, donde DolphinStats necesita estimar efectos de tratamiento en datos observacionales con adherencia imperfecta. Los intervalos conformales y las visualizaciones de efectos heterogéneos son reutilizables en reportes de seguimiento de cohortes clínicas.
