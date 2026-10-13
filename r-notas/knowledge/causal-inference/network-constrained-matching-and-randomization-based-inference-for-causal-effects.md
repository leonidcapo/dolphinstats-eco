---
title: "Network-Constrained Matching and Randomization-Based Inference for Causal Effects"
source: arXiv
source_url: https://arxiv.org/abs/2610.04102v1
date: 2026-10-13
tags: [r, monitoreo-automatico]
---

## Resumen
El artículo propone un método de emparejamiento (matching) que, además de balancear covariables observadas, impone restricciones de proximidad en la red para evitar que las unidades emparejadas queden más conectadas entre sí de lo esperable por azar, lo que generaría asociaciones espurias entre tratamiento y desenlace cuando ambos presentan autocorrelación en la red. Para la inferencia post-emparejamiento desarrolla un procedimiento basado en aleatorización que testea la hipótesis nula fuerte de ausencia de efecto causal, usando aproximación normal asintótica y acomodando la dependencia entre los estadísticos de cada conjunto emparejado sin especificar explícitamente su estructura de correlación. Los métodos se evalúan por simulación y se aplican al Framingham Heart Study, y están implementados en el paquete de R netmatchRI.

Autores: Zhejia Dong, Youjin Lee.

## En simple
Cuando no se puede hacer un experimento aleatorio, se intenta comparar grupos armando parejas de personas muy similares. Si esas personas están conectadas entre sí (por ejemplo, viven en la misma zona o se conocen), esa cercanía puede hacer parecer que un tratamiento funciona cuando no es así; este trabajo ofrece una forma de armar las parejas y de chequear si el efecto observado es real, con un paquete de R listo para usar.

## Relevancia para DolphinStats
Aporta herramientas concretas para el análisis causal de datos observacionales con estructura de red, un escenario frecuente en estudios de cohorte clínicos donde los sujetos comparten centros, comunidades o contactos. Es directamente aplicable al roadmap de cohortes y al portal de seguimiento de DolphinStats, y refuerza la línea de inferencia causal con software reproducible en R.
