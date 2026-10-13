---
title: "DiagnostySize: App for Calculating the Sample Size in a Diagnostic Study"
source: CRAN
source_url: https://cran.r-project.org/package=DiagnostySize
date: 2026-10-13
tags: [r, monitoreo-automatico]
---

## Resumen
DiagnostySize es un paquete de CRAN que implementa una aplicación 'shiny' para calcular el tamaño de muestra óptimo en estudios de exactitud diagnóstica, siguiendo el enfoque propuesto en Stark y Zapf (2020) y Stark et al. (2022). El método busca que ningún endpoint (sensibilidad o especificidad) quede sobrepotenciado. La app permite ejecutar cálculos de tamaño de muestra y potencia para distintos diseños de estudio a través de una interfaz de usuario, sin necesidad de programar, ya que hasta ahora el enfoque solo estaba disponible mediante scripts de R.

## En simple
Es una aplicación con ventanas y botones que sirve para calcular cuántos pacientes hay que estudiar en una investigación que evalúa qué tan bien funciona una prueba diagnóstica, sin necesidad de saber programar.

## Relevancia para DolphinStats
Aporta directamente al tema de calculadora de muestra del roadmap DolphinStats, en el contexto de investigación clínica y bioestadística. Además, al ofrecer una interfaz de usuario para un método que antes requería scripts de R, resulta un antecedente útil de cómo empaquetar cálculos de tamaño de muestra para usuarios no programadores.
