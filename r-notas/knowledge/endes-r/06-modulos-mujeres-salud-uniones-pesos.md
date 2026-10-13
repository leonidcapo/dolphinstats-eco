---
title: ENDES en R — módulos de mujeres y de salud: cómo unirlos y qué peso usar
source: guia
source_url: local — r/validar_endes_todos.R (33 indicadores x 2016-2025 contra Stata) y r/validar_modulos_anios.R (uniones y pesos, ENDES 2016-2025 reales)
date: 2026-10-13
tags: [r, endes, survey, caseid, hhid, csalud01, csalud08, peso15-amas, pesomen12]
---

## Resumen
Los módulos de mujeres (`REC91`, `REC21`, `REC41`, `REC44`, `REC94`, `RE223132`) y de salud
(`CSALUD01` para personas de 15 años o más, `CSALUD08` para menores de 12) **no traen** el diseño
muestral: se une al módulo del hogar `RECH0` (`HV021`, `HV022`, `HV005`) y, en salud, se elige el peso
con cuidado.

- **Mujeres (llave `CASEID`).** El hogar es `HHID = trimws(substr(CASEID, 1, 15))`: el `CASEID` mide
  18 caracteres en todos los años (2016–2025) y en los 6 módulos el 100 % de los casos encuentra su
  hogar en `RECH0`. `REC41`, `REC44` y `REC94` son de nacimientos (varias filas por mujer posibles).
- **Salud (llave `HHID`).** `CSALUD01` trae `HHID` y coincide al 100 % con `RECH0` en todos los años.
  `CSALUD01` tiene **una sola persona por hogar** (p. ej. 33 543 filas y 33 543 hogares en 2016), es decir,
  el cuestionario se aplica a una persona de 15 años o más elegida en cada hogar.
- **El peso del cuestionario de salud no es `HV005`.** `CSALUD01` trae su propio «factor ponderado»,
  `PESO15_AMAS`, y `CSALUD08` trae `Pesomen12`. `HV005` es el peso del hogar y no incluye la elección
  de una persona dentro del hogar (la correlación entre ambos pesos es de 0.6 a 0.76). Con datos reales,
  la hipertensión diagnosticada en personas de 15 años o más cambia así según el peso:
  2016: 9.98 % (`HV005`) frente a 8.57 % (`PESO15_AMAS`); 2020: 10.83 % frente a 10.08 %;
  2024: 12.38 % frente a 10.89 %; 2025: 12.74 % frente a 10.73 %. La diferencia es de 0.7 a 2 puntos
  porcentuales, con errores estándar parecidos.
- **Lo confirma el INEI.** La ficha técnica del informe *Perú: Enfermedades No Transmisibles y Transmisibles,
  2020* (INEI, pp. 191–193) indica: «Para personas de 15 años a más (`PESO15_AMAS`)» y «Para niñas y niños
  menores de 12 (`Pesomen12`)», que se ubican en `CSALUD01` y `CSALUD08`, y para muestras complejas pide
  `qhcluster` (conglomerado), `HV022` (estrato) y `peso = PESO15_AMAS / 1000000` (o `Pesomen12 / 1000000`).
  En los datos, `QHCLUSTER` coincide al 100 % con `HV021` en los 10 años, así que usar `HV021` es equivalente.
  La ficha técnica de la ENDES 2022 indica que el Cuestionario de Salud se aplica a una «persona de 15 años
  a más de edad seleccionada en el hogar».
- **Filas sin peso.** Algunas personas de `CSALUD01` no tienen `PESO15_AMAS` (1 027 en 2017; 2 714 en 2024;
  3 343 en 2025): no se pueden ponderar y quedan fuera.
- **Nombres que cambian por año.** `CSALUD08` de **2016 no trae `HHID`**: se reconstruye como
  `sprintf("%04d", QHCLUSTER)` + `sprintf("%03d", QHNUMBER)` + `sprintf("%02d", QHHOME)` (coincide al 100 %
  con `RECH0`). Los pesos aparecen como `PESO15_AMAS`, `Peso15_amas` o `Peso15_AMAS` (y `pesomen12`
  en minúscula en 2019–2020): pasa los nombres a mayúscula al leer. El `HHID` de algunos módulos trae
  espacios al inicio y el de otros no: aplica `trimws()` a ambos lados antes de unir.
- **Mecánica validada contra Stata.** Con el diseño `HV021`/`HV022`/`HV005` y la media ponderada, R
  coincide con el Stata del explorador en 323 de 323 resultados (33 indicadores, 2016–2025): media, error
  estándar, IC con t y grados de libertad, con diferencias de orden 1e-16. Eso valida la mecánica de R,
  no la elección del peso.

## En simple
Los módulos de mujeres y de salud son tablas aparte que no traen la información de cómo se eligió la
muestra: hay que pegársela desde el módulo del hogar. En el cuestionario de salud solo se entrevistó a
una persona por hogar, así que no sirve el peso del hogar: cada persona trae su propio peso
(`PESO15_AMAS`). Usar el peso equivocado puede mover una prevalencia uno o dos puntos.

## Ejemplo
Con datos reales de la ENDES 2024 (el código se probó con ellos).

```r
library(survey); library(haven); library(dplyr)
options(survey.lonely.psu = "adjust")

rech0 <- read_sav("RECH0.sav") |> transmute(HHID = trimws(HHID), HV021, HV022)

# --- Salud (15 años o más): peso propio del cuestionario ---
salud <- read_sav("CSALUD01.sav") |> mutate(HHID = trimws(HHID))
j <- salud |>
  left_join(rech0, by = "HHID", relationship = "many-to-one") |>
  mutate(hta  = case_when(QS102 == 1 ~ 1, QS102 == 2 ~ 0, TRUE ~ NA_real_),  # 8 = no sabe -> NA
         peso = PESO15_AMAS / 1e6) |>
  filter(!is.na(peso))                         # sin peso no se puede ponderar
dis <- svydesign(ids = ~HV021, strata = ~HV022, weights = ~peso, data = j, nest = TRUE)
svymean(~hta, dis, na.rm = TRUE)               # 2024: 10.89 % (EE 0.32)

# --- Mujeres: CASEID -> HHID ---
mujeres <- read_sav("REC91.sav", col_select = c(CASEID)) |>
  mutate(HHID = trimws(substr(CASEID, 1, 15))) |>
  left_join(rech0, by = "HHID", relationship = "many-to-one")
sum(is.na(mujeres$HV021))                      # 0: todas encuentran su hogar
```

## Errores frecuentes
- Usar `HV005` (peso del hogar) en indicadores del cuestionario de salud.
- Dividir por 1 000 000 o no: solo importan los pesos relativos, pero sé consistente.
- Unir sin `trimws()` y perder hogares por espacios al inicio del `HHID`.
- Buscar `HHID` en `CSALUD08` de 2016 (no existe; hay que reconstruirlo).
- Tratar el código 8 («no sabe») como «no» en un desenlace clínico: mejor `NA`.
