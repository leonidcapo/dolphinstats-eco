---
title: "nonprobsvy: An R Package for Modern Methods for Non-Probability Surveys"
source: Journal of Statistical Software
source_url: https://www.jstatsoft.org/index.php/jss/article/view/v117i02
date: 2026-10-13
tags: [r, monitoreo-automatico]
---

## Resumen
El paquete nonprobsvy implementa métodos modernos de inferencia para muestras no probabilísticas, organizados en tres enfoques: predicción basada en modelos, ponderación por probabilidad inversa y estimación doblemente robusta. Asume la existencia de datos poblacionales o información de una muestra probabilística y reutiliza el paquete survey para la inferencia, incluyendo estimación de varianza analítica y por bootstrap. El artículo presenta la teoría, las funcionalidades y un caso de estudio con datos de tipo big data, paneles web opt-in o redes sociales.

Autores: Łukasz Chrostowski, Piotr Chlebicki, Maciej Beręsewicz.

## En simple
Sirve para sacar conclusiones sobre una población cuando los datos no vienen de una encuesta hecha al azar, sino de fuentes como paneles voluntarios en internet o redes sociales. El paquete ajusta esos datos para que los resultados sean más confiables.

## Relevancia para DolphinStats
Aporta métodos de inferencia para muestras no probabilísticas y se apoya en el paquete survey, directamente alineado con el eje de muestreo y con el explorador ENDES de análisis de encuestas. Es útil para la calculadora de muestra y para evaluar cuándo una fuente no probabilística puede usarse en estimaciones poblacionales dentro del roadmap.
