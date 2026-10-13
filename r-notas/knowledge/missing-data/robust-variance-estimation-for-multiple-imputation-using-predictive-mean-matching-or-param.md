---
title: "Robust variance estimation for multiple imputation using predictive mean matching or parametric imputation models"
source: arXiv
source_url: https://arxiv.org/abs/2610.12215v1
date: 2026-10-13
tags: [r, monitoreo-automatico]
---

## Resumen
El artículo presenta el paquete de R 'rw', que implementa el estimador de varianza de Robins y Wang (RW) para imputación múltiple, el cual no requiere congenialidad entre el modelo de imputación y el de análisis, a diferencia de las reglas de Rubin. Los autores construyen los componentes de varianza RW para modelos de imputación condicional normal y logístico ajustados con mice, y proponen una aproximación RW para predictive mean matching (PMM) que conserva las imputaciones y donantes originales, definiendo probabilidades diferenciables de donante y aproximando el momento cruzado entre scores de análisis e imputación. En simulaciones de referencia y en simulaciones motivadas por datos de historia clínica electrónica, las reglas de Rubin mostraron coberturas hasta 23 puntos porcentuales por debajo del nominal del 95%, mientras que el enfoque propuesto corrige esa calibración. El aporte central es hacer práctico y accesible un estimador de varianza robusto para flujos modernos de imputación múltiple.

Autores: Suyang Yu, Lucy D'Agostino McGowan, Brian D. Williamson.

## En simple
Cuando en un estudio faltan datos de algunos pacientes, se suelen 'rellenar' con valores estimados; el problema es que así el margen de error que se reporta puede quedar mal calculado y dar una falsa sensación de precisión. Este trabajo ofrece una forma más confiable de calcular ese margen y la empaqueta en una herramienta gratuita de R para que sea fácil de usar.

## Relevancia para DolphinStats
El manejo de datos faltantes es transversal a los análisis de cohortes y a los estudios clínicos con datos de historia clínica electrónica que DolphinStats aborda, donde la imputación múltiple es práctica habitual. Contar con una estimación de varianza calibrada y software accesible mejora la validez de los intervalos de confianza reportados y la reproducibilidad de los análisis. Justifica un tema propio ('missing-data') porque no se solapa con ninguno de los temas existentes del roadmap.
