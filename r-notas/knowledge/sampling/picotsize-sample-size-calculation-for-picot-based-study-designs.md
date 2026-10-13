---
title: "PICOTsize: Sample Size Calculation for PICOT-Based Study Designs"
source: CRAN
source_url: https://cran.r-project.org/package=PICOTsize
date: 2026-10-13
tags: [r, monitoreo-automatico]
---

## Resumen
PICOTsize es un paquete de CRAN que provee calculadoras de tamaño de muestra para los diseños de estudio cubiertos por el marco PICOT: transversales, casos y controles, cohortes, ensayos clínicos de superioridad, no inferioridad y equivalencia, y estudios de precisión de pruebas diagnósticas, siguiendo a Bhardwaj et al. (2024). Los cálculos se realizan usando el paquete 'epiR' como backend computacional validado. Incluye una aplicación 'shiny' con un asistente de diseño basado en PICOT, un gráfico interactivo de sensibilidad y la generación automática de texto para la sección de Métodos de manuscritos.

## En simple
Sirve para calcular cuántas personas hay que reclutar en un estudio para que sus resultados sean confiables, según el tipo de estudio que se planee. Además arma automáticamente un texto listo para pegar en la sección de métodos de un artículo.

## Relevancia para DolphinStats
Aporta directamente a la calculadora de muestra del roadmap, ya que cubre diseños de cohorte, de pruebas diagnósticas y ensayos clínicos, y ofrece texto de métodos autogenerado que puede integrarse en el flujo de trabajo de consultoría. El asistente tipo PICOT y el gráfico de sensibilidad son componentes reutilizables para ese módulo.
