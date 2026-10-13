---
title: "wINEQ: Inequality Measures for Weighted Data"
source: CRAN
source_url: https://cran.r-project.org/package=wINEQ
date: 2026-10-13
tags: [r, monitoreo-automatico]
---

## Resumen
wINEQ calcula medidas de desigualdad de una variable teniendo en cuenta los pesos, y es adecuado para escalas de razón, intervalo y ordinal. Incluye medidas desarrolladas por Gini, Theil, Leti, el ratio de Palma, el ratio 20:20, Allison y Foster, Jenkins, Cowell y Fléchet, Abul Naga y Yalcin, Apouey, y Blair y Lacy. El bootstrap provee la distribución de las medidas de desigualdad, lo que permite hacer pruebas de significancia.

## En simple
Sirve para medir qué tan desigualmente está repartida una variable (por ejemplo, ingresos) cuando cada dato tiene un peso distinto, y para saber si esas diferencias son estadísticamente confiables. Es como calcular el índice de Gini, pero respetando que unas observaciones representan a más gente que otras.

## Relevancia para DolphinStats
El paquete trabaja con datos ponderados, un componente central de los datos de encuesta, y ofrece medidas descriptivas de desigualdad con pruebas de significancia vía bootstrap. Eso lo vuelve un complemento posible para el análisis descriptivo de datos de encuesta del explorador ENDES, aunque el texto no menciona diseños complejos ni encuestas específicas.
