---
title: "The R package LSJM for fitting location-scale joint models for a longitudinal marker and complex survival data"
source: arXiv
source_url: https://arxiv.org/abs/2610.03990v1
date: 2026-10-13
tags: [r, monitoreo-automatico]
---

## Resumen
El paquete LSJM de R ajusta modelos conjuntos (joint models) de tipo location-scale entre un marcador longitudinal y datos de supervivencia complejos. Permite modelar la varianza residual específica por sujeto (dependiente del tiempo o separando variabilidad intra-visita e inter-visita), y en el componente de supervivencia maneja riesgos competitivos y semi-competitivos, incluso con censura por intervalos, mediante un submodelo illness-death. La dependencia entre el marcador y los tiempos de evento se captura por el valor actual, la pendiente y/o la variabilidad residual del marcador, con estimación por máxima verosimilitud (Marquardt-Levenberg) e incluye funciones post-ajuste de bondad de ajuste y predicciones dinámicas individuales.

Autores: Léonie Courcoul, Hélène Jacqmin-Gadda, Antoine Barbieri.

## En simple
Sirve para estudiar, en un mismo análisis, cómo evoluciona una medición a lo largo del tiempo en un grupo de personas y cómo esa evolución se relaciona con el riesgo de que les ocurra un evento (por ejemplo, enfermar o fallecer). Es útil en estudios donde se sigue a pacientes durante años tomando mediciones repetidas.

## Relevancia para DolphinStats
Aporta directamente al eje de cohortes y al portal de seguimiento: los joint models longitudinal-supervivencia son la herramienta estándar para analizar marcadores repetidos y desenlaces en estudios de seguimiento, incluyendo escenarios de riesgos competitivos y censura por intervalos frecuentes en datos clínicos reales. Además, las predicciones dinámicas individuales son un insumo natural para funcionalidades de monitoreo longitudinal en el portal.
