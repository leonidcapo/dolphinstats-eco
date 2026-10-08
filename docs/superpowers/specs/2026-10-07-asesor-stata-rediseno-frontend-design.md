# Diseño: rediseño del frontend de Asesor Stata

> **Actualización 2026-10-08:** por pedido del usuario la tipografía pasó a **Arial** del sistema (títulos y texto) y se eliminó la carpeta `fonts/`. Las menciones de Syne y DM Sans de este documento describen el diseño original y ya no aplican.

Fecha: 2026-10-07

## Propósito y qué se busca

La función de Asesor Stata ya está (guías, preguntas sobre las notas, radar, y cuatro modos de
código; ver [las etapas 1 a 3](2026-10-07-asesor-stata-usabilidad-etapas-1-3-design.md)). Lo que
falla es la **experiencia**: la primera pantalla es casi solo texto, lo más potente (Revisar,
Explicar, Interpretar) está dos niveles adentro, las pestañas parecen texto suelto y la página no
tiene la identidad del resto del portal. Este rediseño busca que estudiantes y profesionales
**entiendan al entrar qué pueden hacer** y que usarlo sea agradable.

Lo que pidió el usuario: un frontend «más intuitivo, con mayor experiencia visual». Al elegir
prioridades marcó las cuatro: saber qué hacer al entrar, mejor aspecto e identidad, comodidad al
trabajar con código, y leer y aprender mejor.

Restricciones que se mantienen (no son negociables en este diseño):

- Los usuarios siguen siendo 3 personas, con el Basic Auth compartido de `middleware.js`.
- **No cambian los endpoints** (`api/asesor-stata-*.js`) **ni el contenido de las notas**.
- Página estática sin compilación ni librerías externas. La política de seguridad de
  `vercel.json` (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`) no se
  relaja.
- Marca DolphinStats: Syne para títulos, DM Sans para texto, azul y marino.
- Debe funcionar bien en celular (375 px).
- Se conservan **todas** las funciones actuales (ver «No regresión»).

## Decisiones de diseño tomadas

Se eligieron mirando maquetas con el contenido real:

| Decisión | Elegido |
|---|---|
| Estructura de entrada | **Inicio por tareas**: cuatro tarjetas y una barra superior delgada |
| Estilo visual | **Banda de color con carácter**: franja marino con degradado y tarjetas encima |
| Pantalla de código | **Lado a lado**: código con números de línea y resultados al lado, con las líneas resaltadas |
| Lectura de guías | **Artículo**: «En simple», ejemplo, resumen técnico, y «Siguiente guía» |
| Construcción | **Vistas en una sola página con rutas por `#`** (frente a varias páginas o solo reestilizar) |

Preguntar, Resultados y Radar no tuvieron maqueta propia: se derivan del mismo sistema.

## Hallazgo previo: las fuentes de marca no cargan en producción

Se comprobó sirviendo la página con las cabeceras reales de `vercel.json` y sin ellas:

| | Con la política de producción | Sin la política |
|---|---|---|
| Fuentes registradas (`document.fonts`) | 0 | 12 |
| Ancho del título con Syne frente a la fuente genérica | 748 = 748 | 1072 frente a 748 |

La política solo admite estilos y fuentes del propio sitio, y hoy las fuentes se piden a
`fonts.googleapis.com`. Por eso en producción Syne y DM Sans no se aplican. El mismo problema
afecta a las otras páginas del portal (`index.html`, calculadora, Journal Match), que quedan
**fuera de este rediseño**.

**Solución:** incluir las fuentes en el repositorio (carpeta `fonts/`), en formato woff2, con
`font-display: swap`:

- Syne 700 y 800; DM Sans 400, 500 y 700; subconjunto latino (cubre á é í ó ú ñ ¿ ¡).
- Licencia SIL OFL (se incluye el archivo de licencia junto a las fuentes).
- No hace falta cambiar `vercel.json`: las fuentes y la hoja de estilos salen de `'self'`.
- Descargar los archivos requiere permiso explícito del usuario (nombre, fuente y tamaño), que
  se pide al ejecutar el plan, no antes.

## Navegación y rutas

Una sola página (`asesor-stata.html`) que dibuja cada pantalla según la parte de la dirección
posterior al `#`:

| Ruta | Pantalla |
|---|---|
| `#/` | Inicio |
| `#/aprender` | Lista de guías |
| `#/aprender/<tema>/<guía>` | Una guía (la nota `knowledge/<tema>/<guía>.md`) |
| `#/preguntar` | Preguntar a las notas |
| `#/codigo`, `#/codigo/revisar`, `#/codigo/explicar`, `#/codigo/generar` | Trabajar con mi código (`#/codigo` equivale a revisar) |
| `#/resultados` | Entender mis resultados (interpretar salidas de Stata) |
| `#/radar`, `#/radar/<tema>/<nota>` | Radar y una nota del monitoreo |

- Una ruta desconocida lleva a Inicio.
- **Compatibilidad:** `#nota=<ruta codificada>` (los enlaces compartidos hoy) se traduce a la ruta
  nueva (Aprender si es guía, Radar si la nota lleva la marca `auto` en el índice) y se reemplaza
  en la barra de direcciones sin añadir una entrada al historial. Si el índice aún no cargó, se
  espera a que cargue; si la nota no existe, se muestra Inicio con un aviso.
- El índice (`/api/asesor-stata-base`) se pide una sola vez al arrancar y se guarda en memoria;
  las pantallas que lo necesitan muestran un estado de carga y, si falla, un error con
  «Reintentar».
- Cada cambio de pantalla actualiza `document.title` («Aprender · Asesor Stata · DolphinStats»).
- **Barra superior:** logotipo, Aprender, Preguntar, Código, Resultados, Radar y «← Portal». La
  ruta activa lleva `aria-current="page"`. En celular los enlaces se desplazan horizontalmente en
  una sola fila; no hay menú hamburguesa.
- **Inicio:** banda «¿Qué necesitas hoy?», cuatro tarjetas (Aprender, Preguntar, **Trabajar con
  mi código**, Entender mis resultados) y una franja con lo último del Radar. «Generar» vive
  dentro de Código, como tercera opción del selector.

## Sistema visual

**Colores** (valores verificados con la fórmula de contraste WCAG; la columna indica lo que
cumplen sobre blanco):

| Uso | Valor | Contraste | Para qué |
|---|---|---|---|
| Marino | `#003060` | 13,2 | texto, banda |
| Gris azulado | `#4a6285` | 6,2 | texto secundario |
| Azul | `#0075c6` | 4,8 | acciones, enlaces, Aprender |
| Azul oscuro | `#005a9c` | 7,1 | rótulos sobre fondos azul claro (6,2 sobre ellos; el azul normal baja a 4,2) |
| Cian oscuro | `#067583` | 5,4 | Preguntar (texto y relleno) |
| Cian claro | `#0899a8` | 3,4 | **solo** bordes y degradados, nunca texto |
| Violeta | `#7b3ff2` | 5,5 | Entender mis resultados |
| Naranja | `#c2410c` | 5,2 | Código (el `#d9480f` de las maquetas daba 4,3: no cumplía) |
| Rojo de severidad | `#c62828` | 5,6 | «Importante» y errores (el `#ff3131` actual da 3,7) |
| Fondo / superficie | `#ffffff` / `#f5f7fb` | — | |

Código usa naranja y no rojo para que «sección de código» no se confunda con «hay un error».

**Tipografía:** Syne 800 para títulos (portada fluida de 2,2 a 2,6 rem, h2 de 1,5 rem, h3 de
1,1 rem); DM Sans para texto con base de **16 px** (hoy 14,4 px) y 14 px para texto secundario;
Consolas para código.

**Iconos:** SVG de línea (trazo 2, 24 px) en un sprite incrustado en el HTML, del color del texto;
unos doce (libro, mensaje, código, gráfico, estrella para el Radar, flecha, copiar, descargar,
subir, comprobación, alerta, buscar).

**Componentes:** banda con degradado marino a azul; tarjetas de tarea con icono en círculo de
color, que se elevan 2 px con sombra al pasar el cursor; botón principal en pastilla de 44 px de
alto y secundario de contorno; etiquetas; recuadro «En simple»; bloque de código con barra y
«Copiar»; tarjetas de hallazgo con borde izquierdo por severidad; estados de carga, vacío y error
con mensaje y acción.

**Movimiento:** transiciones de 150 a 200 ms en hover y foco, y un fundido de 150 ms al cambiar de
pantalla. Todo se desactiva con `prefers-reduced-motion`. Sin modo oscuro (el portal no lo tiene).

## Pantallas

1. **Inicio:** descrita arriba. La franja del Radar muestra el total de notas y la nota más
   reciente con su frase simple.
2. **Aprender:** banda con un buscador grande; tarjeta destacada «Empieza aquí» (el tour rápido,
   como hoy); temas plegables con las guías en dos columnas en escritorio (una en celular). Con un
   filtro activo, los temas se abren y se muestra «N de M guías»; si no hay coincidencias, se
   ofrece «Preguntar esto» con el texto escrito.
3. **Guía:** camino de navegación («Aprender › Primeros pasos en Stata»), título, etiquetas (posición
   «Guía 2 de 5» dentro del tema, tipo de fuente, fecha, enlace a la fuente si es una dirección
   web), «Copiar enlace»; luego el recuadro «En simple», el «Ejemplo» (bloque de código con
   «Copiar»), el «Resumen técnico», la «Nota interna» plegada, y al final **Anterior / Siguiente**.
   El orden es el del índice; al terminar un tema se pasa al primero del siguiente («Siguiente
   tema: …»), y al terminar todas se muestra «Terminaste las guías» con enlace a Aprender.
4. **Preguntar:** caja grande de pregunta con contador, ejemplos clicables y selector de nivel.
   La respuesta aparece en una tarjeta, y las notas en las que se basa son **tarjetas clicables**
   (título y resumen corto tomados del índice) en lugar de enlaces de texto. Si no hay notas
   relacionadas, se muestra el mensaje con sugerencias («Prueba con otras palabras», enlace a
   Aprender).
5. **Código** (lado a lado): selector Revisar · Explicar · Generar y selector de nivel arriba.
   - **Revisar:** a la izquierda el visor de código; a la derecha el resumen («2 hallazgos · 1
     importante · 1 sugerencia»), los botones del informe y las tarjetas de hallazgo (línea,
     por qué, cómo arreglarlo, «Así quedaría», nota relacionada).
   - **Explicar:** igual, con el resumen y los pasos (línea, qué hace, «Ojo»).
   - **Generar:** a la izquierda el formulario guiado y la descripción; a la derecha el código
     generado con «Copiar» y «Descargar .do», la explicación y «¿Quieres cambiar algo?».
   - Subir `.do` y «Probar con un ejemplo» se mantienen sobre el visor.
6. **Resultados:** misma disposición. Izquierda: la salida de Stata (caja monoespaciada con
   contador), el contexto opcional y el ejemplo. Derecha: la interpretación en tarjetas («Qué
   análisis es», «Qué dicen los números», «Precauciones») y «Cómo reportarlo» con «Copiar frase».
7. **Radar:** banda con buscador; tarjetas con título, frase simple, tema y fecha; «Mostrar
   más» de 15 en 15; abrir una nota usa la vista de guía sin posición ni «Siguiente».

## Visor de código y líneas resaltadas

Un solo componente con dos modos que ocupan el mismo lugar (para que al cambiar no salte la
página):

- **Edición:** un `textarea` con un canal de números de línea a la izquierda, que se actualiza al
  escribir y se desplaza junto con el texto.
- **Lectura** (cuando hay resultados): el mismo código en un bloque de solo lectura con las
  líneas numeradas y un botón **Editar** que vuelve al modo de edición conservando el texto.

Al **tocar un hallazgo o un paso** (son botones con `aria-pressed`): se marcan sus líneas (un rango
`"12-15"` marca las líneas 12 a 15), el visor se desplaza hasta la primera y la tarjeta queda
seleccionada. Al **tocar una línea marcada** se selecciona el primer hallazgo que la cubre (si hay
varios, los recorre). Un hallazgo sin línea (`lineas: null`) no marca nada. Los números salen de la
misma numeración que el servidor le dio al modelo, así que coinciden con el archivo.

En pantallas angostas el visor y los resultados se apilan; el visor se limita a la mitad de la
altura de la pantalla con desplazamiento propio, para que los hallazgos sigan a la vista.

## Accesibilidad

- Enlace «Saltar al contenido» al principio; la barra es un `nav` con etiqueta.
- Al cambiar de pantalla, el foco pasa al título (`h1`, con `tabindex="-1"`) y el título del
  documento cambia.
- Foco visible de 2 px en todo elemento interactivo; todo se usa con teclado (los plegables son
  `details`, las acciones son botones).
- Contraste AA (≥ 4,5) en todo texto; objetivos táctiles de 44 px.
- La severidad no depende solo del color: lleva etiqueta de texto e icono.
- Los mensajes de espera y de error se anuncian con `role="status"`.

## Estructura de archivos y pruebas

| Archivo | Contenido |
|---|---|
| `asesor-stata.html` | Estructura base: cabecera, barra, sprite de iconos, `main`, carga de estilos y scripts |
| `asesor-stata.css` | Todo el estilo, con las variables de diseño al inicio (hoy está dentro del HTML) |
| `fonts/` | Fuentes woff2, su `@font-face` y las licencias |
| `asesor-stata-nucleo.js` | Funciones puras, sin DOM: conversor de Markdown, índice, filtros, separación guías/radar, informe, descripción guiada, **rutas** (analizar y construir), **traducción de enlaces viejos**, **guías vecinas**, **rango de líneas a lista de líneas** |
| `asesor-stata.js` | Interfaz: router, vistas, componentes, visor de código y llamadas a la API |

- El núcleo se carga antes que la interfaz y se expone como `window.AsesorStataNucleo` (y por
  `module.exports` para probarlo con `node`).
- Las pruebas actuales (`tests/test-asesor-stata-markdown.mjs`) pasan a importar el núcleo y se
  amplían con las funciones nuevas. Se agrega una prueba de **contraste** que lee los colores de
  `asesor-stata.css` y verifica que cada pareja usada para texto cumple 4,5.
- La interfaz se verifica con un servidor local que lee las notas de la copia local y respuestas
  simuladas del endpoint, como hasta ahora, en escritorio y en 375 px, y se comprueba que las
  fuentes quedan **registradas** al servir la página con la política de producción.

## Construcción por etapas

Cada etapa deja algo verificable:

1. Fuentes propias, hoja de estilos con las variables, estructura base, router, barra superior,
   **Inicio** y compatibilidad de enlaces viejos.
2. **Aprender** y **Guía** (incluye las guías vecinas).
3. **Preguntar** y **Radar**.
4. **Código** (visor, resaltado, Revisar, Explicar, Generar) y **Resultados**.
5. Pulido: celular, accesibilidad, estados de carga, vacío y error, y verificación final contra
   la lista de no regresión.

## No regresión: lo que debe seguir funcionando

Filtro de guías y del Radar (con alias como «chi2»); notas con bloques de código y «Copiar»;
«Nota interna» plegada; subir `.do` (UTF-8 o Latin-1); contadores y límites; nivel recordado;
ejemplos con un clic; mensajes de espera con segundos y botón bloqueado al enviar; informe de
revisión (copiar y descargar); formulario guiado y ajuste de Generar; descarga del `.do`
generado; errores mostrados dentro de las pantallas; enlaces `#nota=` antiguos; aviso de
privacidad y de que la IA puede equivocarse.

## Criterios de éxito

- Desde Inicio, cada tarea se alcanza en un clic; revisar un código de ejemplo, en tres.
- Alguien que nunca lo usó dice, en pocos segundos, qué puede hacer aquí (se prueba con una o dos
  personas del equipo).
- Todas las funciones de «No regresión» siguen funcionando.
- En la página servida con la política de producción, Syne y DM Sans aparecen registradas.
- Sin desborde horizontal a 375 px; contraste y teclado cumplidos.
- Todos los tests pasan, incluida la prueba de contraste.

## Riesgos

- **Es un cambio grande sobre un JavaScript de 1 248 líneas y un HTML de 341.** Se mitiga con la construcción por
  etapas, conservando las funciones puras ya probadas y moviéndolas al núcleo sin reescribirlas.
- **Foco y desplazamiento al cambiar de pantalla** (propio de las páginas de una sola vista): se
  prueban a mano en cada pantalla y con teclado.
- **El visor numerado** sustituye al cuadro de texto simple; se comprueba que pegar, escribir,
  subir un archivo y los límites siguen igual.
- **Probar sin exponer el sitio:** la vista previa de Vercel por rama exige habilitar las variables
  de entorno (`SITE_USER`, `SITE_PASS`, `ASESOR_STATA_GITHUB_TOKEN`, `DEEPSEEK_API_KEY`) también
  para el entorno de vista previa; ver decisiones pendientes.

## Fuera de alcance

- Cambios en los endpoints o en el contenido de las notas.
- Modo oscuro; login individual; límites de uso.
- Rediseñar o corregir las fuentes de las demás páginas del portal.
- Un nivel de dificultad en cada guía (no existe en los datos; sería un cambio futuro del
  formato de las notas).
- Ilustraciones o imágenes pesadas.

## Decisiones pendientes del usuario

1. **Cómo ver el avance antes de publicar.** Opción recomendada: trabajar en una **rama**
   (`rediseno-asesor-stata`) y mirar la vista previa que Vercel genera por cada subida, protegida
   con la misma contraseña; `main` solo se actualiza al aprobar. Requiere activar las cuatro
   variables de entorno para «Preview» en Vercel. Alternativa: verificar solo en local y publicar
   en `main` al terminar cada etapa.
2. **Ignorar `.superpowers/` en git.** Hoy no está en `.gitignore` y ahí se guardan las maquetas de
   este proceso.
3. **Permiso para descargar las fuentes** al llegar a la etapa 1 del plan.
