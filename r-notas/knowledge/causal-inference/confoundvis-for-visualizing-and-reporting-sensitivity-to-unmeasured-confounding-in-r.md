---
title: "confoundvis for Visualizing and Reporting Sensitivity to Unmeasured Confounding in R"
source: arXiv
source_url: https://arxiv.org/abs/2610.13731v1
date: 2026-10-13
tags: [r, monitoreo-automatico]
---

## Resumen
confoundvis es un paquete de R para visualizar y reportar análisis de sensibilidad a confusión no medida en estudios observacionales. Organiza resultados de distintos métodos mediante un objeto común, calcula R2 parciales y umbrales de impacto desde modelos lineales, importa resultados de sensemakr, konfound y EValue, y ofrece benchmarks con covariables medidas. Lo ejemplifica con 5,735 pacientes del estudio de cateterismo cardíaco derecho, manteniendo claras las unidades y reglas de decisión de cada método. Está disponible en CRAN.

Autores: Subir Hait.

## En simple
Sirve para preguntarse cuánta 'explicación oculta' haría falta para que una conclusión de un estudio observacional dejara de ser válida. Ayuda a reportar de forma clara qué tan robustos son esos resultados.

## Relevancia para DolphinStats
Para el roadmap de cohortes y análisis observacionales de DolphinStats, permite evaluar y comunicar la robustez de los hallazgos frente a confusión no medida, un paso clave en estudios clínicos de cohorte. Encaja en el tema causal-inference.
