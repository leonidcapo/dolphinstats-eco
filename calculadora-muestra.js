/* calculadora-muestra.js — puerto directo de DolphinStatsBot/calculadora_muestra.py
 * (mismas 3 fórmulas, misma referencia, mismas tablas Z fijas). Sin backend,
 * sin dependencias — cálculo 100% en el navegador.
 *
 * V2 (sesión 2026-09-17): fórmulas corregidas leyendo Ayuda/Muestreo.pdf de
 * Epidat 4.2 y validadas contra sus ejemplos resueltos. Ver el docstring de
 * calculadora_muestra.py (sección V2) para el detalle completo. */
(function () {
  'use strict';

  var REF_TEXTO = "Charan J, Biswas T. How to calculate sample size for different study " +
    "designs in medical research? Indian J Psychol Med. 2013;35(2):121-6.";

  // Valores exactos de tabla normal estándar (coinciden con los que usa
  // Epidat 4.2 — verificado reproduciendo sus ejemplos resueltos).
  var Z_ALFA = { 90: 1.6449, 95: 1.9600, 99: 2.5758 };
  var Z_BETA = { 80: 0.8416, 85: 1.0364, 90: 1.2816, 95: 1.6449 };
  // Z de una cola, para el contraste unilateral del coeficiente de correlación.
  var Z_ALFA_UNILATERAL = { 90: 1.2816, 95: 1.6449, 99: 2.3263 };

  function ParametroInvalido(mensaje) {
    this.message = mensaje;
    this.name = 'ParametroInvalido';
  }
  ParametroInvalido.prototype = Object.create(Error.prototype);

  function validarProporcion(valor, nombre) {
    if (!(valor > 0 && valor < 1)) {
      throw new ParametroInvalido(nombre + ' debe estar entre 0 y 1 (ej. 0.30 para 30%)');
    }
  }

  function proporcionUnica(p, d, confianza, nPoblacion) {
    validarProporcion(p, 'La proporción esperada');
    if (!(d > 0 && d < 1)) {
      throw new ParametroInvalido('La precisión deseada debe estar entre 0 y 1 (ej. 0.05 para ±5 puntos)');
    }
    if (nPoblacion != null && !(nPoblacion > 0)) {
      throw new ParametroInvalido('El tamaño de la población debe ser mayor a 0 (o dejarse en blanco si se desconoce)');
    }
    var z = Z_ALFA[confianza];
    var n0 = (z * z * p * (1 - p)) / (d * d);
    var n, formula, frasePoblacion;
    if (nPoblacion != null) {
      n = Math.ceil(n0 / (1 + n0 / nPoblacion));
      formula = 'n = n0/(1+n0/N), con n0 = Z²·p(1-p)/d²';
      frasePoblacion = ', en una población finita de ' + nPoblacion + ' personas';
    } else {
      n = Math.ceil(n0);
      formula = 'n = Z²·p(1-p)/d²';
      frasePoblacion = '';
    }
    var parrafo = 'El tamaño de muestra se calculó para estimar una proporción con una ' +
      'precisión absoluta de ±' + (d * 100).toFixed(0) + ' puntos porcentuales y un nivel de ' +
      'confianza del ' + confianza + '%, asumiendo una proporción esperada del ' +
      (p * 100).toFixed(0) + '%' + frasePoblacion + ', mediante la fórmula ' + formula +
      ' (' + REF_TEXTO + '). El tamaño de muestra mínimo requerido fue de ' + n + ' participantes.';
    return { n_total: n, n_por_grupo: null, formula: formula, parrafo_metodos: parrafo };
  }

  function dosProporciones(p1, p2, confianza, potencia) {
    validarProporcion(p1, 'La proporción del grupo 1');
    validarProporcion(p2, 'La proporción del grupo 2');
    if (p1 === p2) {
      throw new ParametroInvalido('Las dos proporciones no pueden ser iguales (no hay diferencia que detectar)');
    }
    var za = Z_ALFA[confianza], zb = Z_BETA[potencia];
    var pPool = (p1 + p2) / 2;
    var terminoA = za * Math.sqrt(2 * pPool * (1 - pPool));
    var terminoB = zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
    var nGrupo = Math.ceil(Math.pow(terminoA + terminoB, 2) / Math.pow(p1 - p2, 2));
    var total = nGrupo * 2;
    var formula = 'n = [Zα√(2p̄(1-p̄)) + Zβ√(p1(1-p1)+p2(1-p2))]² / (p1-p2)², p̄=(p1+p2)/2';
    var parrafo = 'El tamaño de muestra se calculó para comparar dos proporciones ' +
      'independientes (' + (p1 * 100).toFixed(0) + '% vs. ' + (p2 * 100).toFixed(0) + '%), con un nivel de ' +
      'confianza del ' + confianza + '% y una potencia estadística del ' + potencia + '%, ' +
      'mediante la prueba ji-cuadrado de Pearson con la fórmula ' + formula +
      ' (' + REF_TEXTO + '). Se requirieron ' + nGrupo + ' participantes por grupo ' +
      '(total: ' + total + ').';
    return {
      n_total: total, n_por_grupo: nGrupo,
      formula: formula,
      parrafo_metodos: parrafo
    };
  }

  function dosMedias(diferencia, sd, confianza, potencia) {
    if (!(diferencia > 0)) {
      throw new ParametroInvalido('La diferencia mínima a detectar debe ser mayor a 0');
    }
    if (!(sd > 0)) {
      throw new ParametroInvalido('La desviación estándar debe ser mayor a 0');
    }
    var za = Z_ALFA[confianza], zb = Z_BETA[potencia];
    var nGrupo = Math.ceil(2 * Math.pow(za + zb, 2) * sd * sd / (diferencia * diferencia) + (za * za) / 4);
    var total = nGrupo * 2;
    var formula = 'n = 2(Zα+Zβ)²σ²/Δ² + Zα²/4';
    var parrafo = 'El tamaño de muestra se calculó para comparar dos medias ' +
      'independientes, asumiendo una diferencia mínima clínicamente ' +
      'relevante de ' + diferencia + ' y una desviación estándar común esperada ' +
      'de ' + sd + ', con un nivel de confianza del ' + confianza + '% y una potencia ' +
      'estadística del ' + potencia + '%, mediante la fórmula ' + formula +
      ' (' + REF_TEXTO + '). Se requirieron ' + nGrupo + ' ' +
      'participantes por grupo (total: ' + total + ').';
    return {
      n_total: total, n_por_grupo: nGrupo,
      formula: formula,
      parrafo_metodos: parrafo
    };
  }

  function nGruposDesiguales(p1, p2, r, za, zb, conYates) {
    var pPool = (p1 + r * p2) / (r + 1);
    var terminoA = za * Math.sqrt((r + 1) * pPool * (1 - pPool));
    var terminoB = zb * Math.sqrt(r * p1 * (1 - p1) + p2 * (1 - p2));
    var n0 = Math.pow(terminoA + terminoB, 2) / (r * Math.pow(p1 - p2, 2));
    if (conYates) {
      n0 = n0 / 4 * Math.pow(1 + Math.sqrt(1 + 2 * (r + 1) / (r * n0 * Math.abs(p1 - p2))), 2);
    }
    return n0;
  }

  function orAP1(p2, orEsperada) {
    return (orEsperada * p2) / (1 - p2 + orEsperada * p2);
  }

  function casosControles(p2, orEsperada, controlesPorCaso, confianza, potencia, conYates) {
    validarProporcion(p2, 'La proporción de expuestos en los controles');
    if (!(orEsperada > 0)) {
      throw new ParametroInvalido('La odds ratio esperada debe ser mayor a 0');
    }
    if (orEsperada === 1) {
      throw new ParametroInvalido('Una OR de 1 significa que no hay asociación que detectar');
    }
    if (!(controlesPorCaso >= 1 && controlesPorCaso <= 10)) {
      throw new ParametroInvalido('El número de controles por caso debe estar entre 1 y 10');
    }
    var p1 = orAP1(p2, orEsperada);
    if (!(p1 > 0 && p1 < 1)) {
      throw new ParametroInvalido('Esa combinación de P2 y OR produce una proporción de expuestos en los casos fuera de 0-1; revisa los valores');
    }
    var za = Z_ALFA[confianza], zb = Z_BETA[potencia];
    var n0 = nGruposDesiguales(p1, p2, controlesPorCaso, za, zb, conYates);
    var nCasos = Math.ceil(n0);
    var nControles = Math.ceil(controlesPorCaso * nCasos);
    var total = nCasos + nControles;
    var yatesTxt = conYates ? ' con corrección de continuidad de Yates' : ' sin corrección de continuidad de Yates';
    var formula = 'Ji-cuadrado de Pearson para grupos desiguales' + yatesTxt;
    var parrafo = 'El tamaño de muestra se calculó para un estudio de casos y controles ' +
      'independientes, con ' + controlesPorCaso + ' control(es) por caso, asumiendo ' +
      'una prevalencia de la exposición del ' + (p2 * 100).toFixed(0) + '% en los controles ' +
      '(lo que implica un ' + (p1 * 100).toFixed(1) + '% en los casos) y una odds ratio esperada de ' +
      orEsperada + ', con un nivel de confianza del ' + confianza + '% y una potencia ' +
      'estadística del ' + potencia + '%, mediante ' + formula + ' (' + REF_TEXTO + '). ' +
      'Se requirieron ' + nCasos + ' casos y ' + nControles + ' controles (total: ' + total + ').';
    return { n_total: total, n_por_grupo: nCasos, formula: formula, parrafo_metodos: parrafo };
  }

  function cohorte(pExpuestos, pNoExpuestos, razonNoExpExp, confianza, potencia, conYates) {
    validarProporcion(pExpuestos, 'El riesgo en expuestos');
    validarProporcion(pNoExpuestos, 'El riesgo en no expuestos');
    if (pExpuestos === pNoExpuestos) {
      throw new ParametroInvalido('Los dos riesgos no pueden ser iguales (no hay riesgo relativo que detectar)');
    }
    if (!(razonNoExpExp > 0)) {
      throw new ParametroInvalido('La razón entre no expuestos y expuestos debe ser mayor a 0');
    }
    var za = Z_ALFA[confianza], zb = Z_BETA[potencia];
    var n0 = nGruposDesiguales(pExpuestos, pNoExpuestos, razonNoExpExp, za, zb, conYates);
    var nExpuestos = Math.ceil(n0);
    var nNoExpuestos = Math.ceil(razonNoExpExp * nExpuestos);
    var total = nExpuestos + nNoExpuestos;
    var rr = pExpuestos / pNoExpuestos;
    var yatesTxt = conYates ? ' con corrección de continuidad de Yates' : ' sin corrección de continuidad de Yates';
    var formula = 'Ji-cuadrado de Pearson para grupos desiguales' + yatesTxt;
    var parrafo = 'El tamaño de muestra se calculó para un estudio de cohortes, asumiendo ' +
      'un riesgo del ' + (pExpuestos * 100).toFixed(0) + '% en expuestos y del ' +
      (pNoExpuestos * 100).toFixed(0) + '% en no expuestos (riesgo relativo esperado de ' +
      rr.toFixed(2) + '), con una razón entre no expuestos y expuestos de ' + razonNoExpExp +
      ', un nivel de confianza del ' + confianza + '% y una potencia estadística del ' + potencia +
      '%, mediante ' + formula + ' (' + REF_TEXTO + '). Se requirieron ' + nExpuestos +
      ' expuestos y ' + nNoExpuestos + ' no expuestos (total: ' + total + ').';
    return { n_total: total, n_por_grupo: nExpuestos, formula: formula, parrafo_metodos: parrafo };
  }

  function coeficienteCorrelacion(rEsperado, confianza, potencia, bilateral) {
    if (!(rEsperado > -1 && rEsperado < 1)) {
      throw new ParametroInvalido('El coeficiente de correlación esperado debe estar entre -1 y 1');
    }
    if (rEsperado === 0) {
      throw new ParametroInvalido('Un coeficiente esperado de 0 significa que no hay correlación que detectar');
    }
    var c = 0.5 * Math.log((1 + Math.abs(rEsperado)) / (1 - Math.abs(rEsperado)));
    var za = bilateral ? Z_ALFA[confianza] : Z_ALFA_UNILATERAL[confianza];
    var zb = Z_BETA[potencia];
    var n = Math.ceil(Math.pow((za + zb) / c, 2) + 3);
    var tipoContraste = bilateral ? 'bilateral (H1: r≠0)' : 'unilateral (H1: r>0 o r<0, según el signo esperado)';
    var formula = 'n = [(Zα+Zβ)/C]² + 3, con C = transformación z de Fisher de r';
    var parrafo = 'El tamaño de muestra se calculó para contrastar si el coeficiente de ' +
      'correlación de Pearson es distinto de cero, asumiendo un valor esperado de r=' +
      rEsperado + ', con un contraste ' + tipoContraste + ', un nivel de confianza del ' +
      confianza + '% y una potencia estadística del ' + potencia + '%, mediante la fórmula ' +
      formula + ' (' + REF_TEXTO + '). El tamaño de muestra mínimo requerido fue de ' + n + ' sujetos.';
    return { n_total: n, n_por_grupo: null, formula: formula, parrafo_metodos: parrafo };
  }

  /* ---------------- Asistente de selección de diseño (sin IA) ----------------
   * Puerto directo de ASISTENTE_ARBOL / ASISTENTE_MOTIVOS en chatbot.py (paso 2
   * del roadmap "enriquecer con Epidat"). Mismo árbol de decisión fijo, mismas
   * 6 opciones + "no disponible" cuando el diseño que hace falta (media única,
   * pareado/McNemar) todavía no está en la calculadora. */
  var ASISTENTE_ARBOL = {
    inicio: {
      pregunta: '¿Qué quieres hacer con tu estudio?',
      opciones: [
        { texto: 'Estimar un solo valor (ej. una prevalencia, un porcentaje)', irA: 'unica' },
        { texto: 'Ver si dos variables numéricas están relacionadas en las mismas personas (ej. ¿el peso se relaciona con la presión?)', resultado: 'correlacion' },
        { texto: 'Comparar un desenlace entre dos grupos, o ver si una exposición se asocia a una enfermedad', irA: 'grupos_pareados' }
      ]
    },
    unica: {
      pregunta: '¿Tu variable es categórica (sí/no) o numérica (un promedio)?',
      opciones: [
        { texto: 'Categórica: sí/no, presente/ausente (ej. % con anemia)', resultado: 'proporcion_unica' },
        { texto: 'Numérica: un promedio (ej. hemoglobina promedio)', noDisponible: 'Estimar una media única (con un intervalo de confianza) todavía no está en la calculadora.' }
      ]
    },
    grupos_pareados: {
      pregunta: '¿Son dos grupos distintos de personas, o mides a las mismas personas dos veces (antes/después, pareado)?',
      opciones: [
        { texto: 'Dos grupos distintos de personas (independientes)', irA: 'tipo_variable' },
        { texto: 'Las mismas personas, medidas dos veces (pareado o antes/después)', noDisponible: 'El diseño pareado (prueba de McNemar o t pareada) todavía no está en la calculadora.' }
      ]
    },
    tipo_variable: {
      pregunta: '¿Qué tipo de variable comparas entre los dos grupos?',
      opciones: [
        { texto: 'Numérica (un promedio): peso, presión, puntaje…', resultado: 'dos_medias' },
        { texto: 'Categórica: sí/no', irA: 'como_armaste_grupos' }
      ]
    },
    como_armaste_grupos: {
      pregunta: '¿Cómo armaste tus dos grupos?',
      opciones: [
        { texto: 'Primero elegí quién tiene la enfermedad (casos) y quién no (controles), y reviso su exposición pasada', resultado: 'casos_controles' },
        { texto: 'Primero elegí quién estuvo expuesto y quién no, y los sigo en el tiempo para ver quién enferma', resultado: 'cohorte' },
        { texto: 'Ya tenía mis 2 grupos definidos de otra forma (ej. tratamiento vs. placebo, urbano vs. rural)', resultado: 'dos_proporciones' }
      ]
    }
  };

  var ASISTENTE_MOTIVOS = {
    proporcion_unica: 'Porque quieres estimar un porcentaje (una proporción) con cierta precisión, sin comparar grupos.',
    dos_medias: 'Porque comparas un promedio (variable numérica) entre dos grupos independientes.',
    correlacion: 'Porque quieres ver si dos variables numéricas están asociadas entre sí, en las mismas personas, sin dividir en grupos.',
    casos_controles: 'Porque partiste de la enfermedad (casos/controles) y miras hacia atrás la exposición — diseño retrospectivo.',
    cohorte: 'Porque partiste de la exposición y sigues a los grupos en el tiempo para ver quién enferma — diseño prospectivo.',
    dos_proporciones: 'Porque comparas una proporción (sí/no) entre dos grupos ya definidos, sin que la selección se base en enfermedad o exposición.'
  };

  var DISENOS_LABELS = {
    proporcion_unica: 'Proporción única (prevalencia)',
    dos_proporciones: 'Comparación de dos proporciones',
    dos_medias: 'Comparación de dos medias',
    casos_controles: 'Casos y controles (odds ratio)',
    cohorte: 'Cohorte (riesgo relativo)',
    correlacion: 'Coeficiente de correlación'
  };

  /* ---------------- Sugerencias de p con datos reales de ENDES Perú ----------------
   * Puerto directo de ENDES_PREVALENCIAS en chatbot.py (paso 3). Snapshot
   * embebido (ENDES 2025, sin fetch en vivo) de los 9 ejes que cubre el
   * Explorador ENDES V1. Si se regenera explorador/datos.json con más ejes o
   * años, actualizar este objeto a mano igual que su par en Python. */
  var ENDES_PREVALENCIAS = {
    'Higiene oral (niños 0-11 años)': { prevalenciaPct: 94.89, ic95Lo: 94.47, ic95Hi: 95.30, n: 32652, anio: 2025 },
    'Comparte cepillo dental, no debería (niños 0-11 años)': { prevalenciaPct: 0.08, ic95Lo: 0.04, ic95Hi: 0.12, n: 29898, anio: 2025 },
    'Hipertensión arterial (adultos 18+)': { prevalenciaPct: 13.38, ic95Lo: 12.59, ic95Hi: 14.18, n: 28610, anio: 2025 },
    'Tabaquismo (adultos 18+)': { prevalenciaPct: 15.52, ic95Lo: 14.70, ic95Hi: 16.33, n: 28612, anio: 2025 },
    'Síntomas depresivos moderados, PHQ-9≥10 (adultos 18+)': { prevalenciaPct: 7.67, ic95Lo: 7.06, ic95Hi: 8.29, n: 28599, anio: 2025 },
    'Anemia infantil (niños 0-11 años)': { prevalenciaPct: 33.58, ic95Lo: 32.65, ic95Hi: 34.52, n: 17616, anio: 2025 },
    'Desnutrición crónica infantil (niños 0-11 años)': { prevalenciaPct: 12.21, ic95Lo: 11.55, ic95Hi: 12.86, n: 18993, anio: 2025 },
    'Dificultad visual (adultos 60+)': { prevalenciaPct: 26.77, ic95Lo: 24.69, ic95Hi: 28.85, n: 5016, anio: 2025 },
    'Alguna dificultad funcional (adultos 60+)': { prevalenciaPct: 4.40, ic95Lo: 3.49, ic95Hi: 5.32, n: 5031, anio: 2025 }
  };

  /* ---------------- UI wiring ---------------- */

  var DISENOS = ['proporcion_unica', 'dos_proporciones', 'dos_medias',
    'casos_controles', 'cohorte', 'correlacion'];

  function $(id) { return document.getElementById(id); }

  function actualizarCamposVisibles() {
    var diseno = $('cm-diseno').value;
    DISENOS.forEach(function (d) {
      $('cm-campos-' + d).classList.toggle('campo-oculto', d !== diseno);
    });
    $('cm-potencia-wrap').classList.toggle('campo-oculto', diseno === 'proporcion_unica');
    $('cm-endes-toggle').classList.toggle('campo-oculto', diseno !== 'proporcion_unica');
    if (diseno !== 'proporcion_unica') {
      $('cm-endes-panel').classList.add('campo-oculto');
    }
  }

  /* ---- Asistente: estado y render ---- */
  var asistenteNodo = 'inicio';
  var asistenteHistorial = [];

  function reiniciarAsistente() {
    asistenteNodo = 'inicio';
    asistenteHistorial = [];
  }

  function renderAsistente() {
    var panel = $('cm-asistente-panel');
    panel.innerHTML = '';
    var nodo = ASISTENTE_ARBOL[asistenteNodo];
    var pregunta = document.createElement('p');
    pregunta.className = 'caja-pregunta';
    pregunta.textContent = nodo.pregunta;
    panel.appendChild(pregunta);
    nodo.opciones.forEach(function (opcion, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'caja-opcion';
      btn.textContent = opcion.texto;
      btn.addEventListener('click', function () {
        if (opcion.resultado) {
          mostrarResultadoAsistente(opcion.resultado, null);
        } else if (opcion.noDisponible) {
          mostrarNoDisponibleAsistente(opcion.noDisponible);
        } else {
          asistenteHistorial.push(asistenteNodo);
          asistenteNodo = opcion.irA;
          renderAsistente();
        }
      });
      panel.appendChild(btn);
    });
    if (asistenteHistorial.length) {
      var atras = document.createElement('button');
      atras.type = 'button';
      atras.className = 'caja-opcion';
      atras.textContent = '← Atrás';
      atras.addEventListener('click', function () {
        asistenteNodo = asistenteHistorial.pop();
        renderAsistente();
      });
      panel.appendChild(atras);
    }
    panel.appendChild(botonCerrarAsistente());
  }

  function botonCerrarAsistente() {
    var cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'caja-opcion';
    cerrar.style.textAlign = 'center';
    cerrar.textContent = 'Cerrar asistente';
    cerrar.addEventListener('click', function () {
      $('cm-asistente-panel').classList.add('campo-oculto');
      reiniciarAsistente();
    });
    return cerrar;
  }

  function mostrarResultadoAsistente(disenoReco, motivoExtra) {
    var panel = $('cm-asistente-panel');
    panel.innerHTML = '';
    var caja = document.createElement('div');
    caja.className = 'caja-info';
    var titulo = document.createElement('strong');
    titulo.textContent = 'Te recomendamos: ' + DISENOS_LABELS[disenoReco];
    caja.appendChild(titulo);
    caja.appendChild(document.createElement('br'));
    caja.appendChild(document.createTextNode(ASISTENTE_MOTIVOS[disenoReco]));
    if (motivoExtra) {
      caja.appendChild(document.createElement('br'));
      var em = document.createElement('em');
      em.textContent = motivoExtra;
      caja.appendChild(em);
    }
    panel.appendChild(caja);
    var fila = document.createElement('div');
    fila.className = 'caja-fila';
    var usar = document.createElement('button');
    usar.type = 'button';
    usar.textContent = 'Usar este diseño ✓';
    usar.addEventListener('click', function () {
      $('cm-diseno').value = disenoReco;
      actualizarCamposVisibles();
      $('cm-asistente-panel').classList.add('campo-oculto');
      reiniciarAsistente();
    });
    var otra = document.createElement('button');
    otra.type = 'button';
    otra.className = 'btn-secundario';
    otra.textContent = 'Volver a empezar';
    otra.addEventListener('click', function () {
      reiniciarAsistente();
      renderAsistente();
    });
    fila.appendChild(usar);
    fila.appendChild(otra);
    panel.appendChild(fila);
  }

  function mostrarNoDisponibleAsistente(mensaje) {
    var panel = $('cm-asistente-panel');
    panel.innerHTML = '';
    var caja = document.createElement('div');
    caja.className = 'caja-info';
    caja.textContent = mensaje;
    panel.appendChild(caja);
    var nota = document.createElement('p');
    nota.className = 'caja-nota';
    nota.textContent = 'Escríbenos y te ayudamos con ese diseño manualmente, o vuelve a intentarlo con otra respuesta.';
    panel.appendChild(nota);
    var volver = document.createElement('button');
    volver.type = 'button';
    volver.className = 'caja-opcion';
    volver.textContent = '← Volver a empezar';
    volver.addEventListener('click', function () {
      reiniciarAsistente();
      renderAsistente();
    });
    panel.appendChild(volver);
  }

  /* ---- ENDES: estado y render ---- */
  function poblarSelectEndes() {
    var select = $('cm-endes-select');
    select.innerHTML = '';
    Object.keys(ENDES_PREVALENCIAS).forEach(function (eje) {
      var opt = document.createElement('option');
      opt.value = eje;
      opt.textContent = eje;
      select.appendChild(opt);
    });
  }

  function actualizarInfoEndes() {
    var eje = $('cm-endes-select').value;
    var info = ENDES_PREVALENCIAS[eje];
    var contenedor = $('cm-endes-info');
    contenedor.innerHTML = '';
    var fuerte = document.createElement('strong');
    fuerte.textContent = info.prevalenciaPct.toFixed(1) + '%';
    contenedor.appendChild(fuerte);
    contenedor.appendChild(document.createTextNode(
      ' (IC95%: ' + info.ic95Lo.toFixed(1) + '–' + info.ic95Hi.toFixed(1) + '%, n=' +
      info.n.toLocaleString('es-PE') + ', ENDES ' + info.anio + ') — calculado de los microdatos ENDES ' +
      'con diseño muestral oficial (svy: mean por año), no es una estimación.'
    ));
  }

  function calcular() {
    var statusEl = $('cm-status');
    var resultadoEl = $('cm-resultado');
    statusEl.textContent = '';
    var diseno = $('cm-diseno').value;
    var confianza = Number($('cm-confianza').value);
    var potencia = Number($('cm-potencia').value);

    try {
      var r;
      if (diseno === 'proporcion_unica') {
        var p = Number($('cm-p').value);
        var d = Number($('cm-d').value);
        var nPoblacionRaw = $('cm-n-poblacion').value;
        var nPoblacion = nPoblacionRaw === '' ? null : Number(nPoblacionRaw);
        r = proporcionUnica(p, d, confianza, nPoblacion);
      } else if (diseno === 'dos_proporciones') {
        var p1 = Number($('cm-p1').value);
        var p2 = Number($('cm-p2').value);
        r = dosProporciones(p1, p2, confianza, potencia);
      } else if (diseno === 'dos_medias') {
        var diferencia = Number($('cm-diferencia').value);
        var sd = Number($('cm-sd').value);
        r = dosMedias(diferencia, sd, confianza, potencia);
      } else if (diseno === 'casos_controles') {
        var ccP2 = Number($('cm-cc-p2').value);
        var ccOr = Number($('cm-cc-or').value);
        var ccControles = Number($('cm-cc-controles').value);
        var ccYates = $('cm-cc-yates').checked;
        r = casosControles(ccP2, ccOr, ccControles, confianza, potencia, ccYates);
      } else if (diseno === 'cohorte') {
        var coPExp = Number($('cm-co-p-exp').value);
        var coPNoExp = Number($('cm-co-p-noexp').value);
        var coRazon = Number($('cm-co-razon').value);
        var coYates = $('cm-co-yates').checked;
        r = cohorte(coPExp, coPNoExp, coRazon, confianza, potencia, coYates);
      } else {
        var corrR = Number($('cm-corr-r').value);
        var corrBilateral = $('cm-corr-bilateral').checked;
        r = coeficienteCorrelacion(corrR, confianza, potencia, corrBilateral);
      }

      $('cm-n').textContent = r.n_total;
      if (diseno === 'casos_controles') {
        // Casos y controles no son del mismo tamaño -- "X por grupo" sería
        // engañoso (ej. 70 casos y 210 controles, no "70 por grupo").
        $('cm-n-label').textContent = 'Tamaño de muestra total';
        $('cm-n-por-grupo').textContent = r.n_por_grupo + ' casos, ' + (r.n_total - r.n_por_grupo) + ' controles';
      } else if (diseno === 'cohorte') {
        $('cm-n-label').textContent = 'Tamaño de muestra total';
        $('cm-n-por-grupo').textContent = r.n_por_grupo + ' expuestos, ' + (r.n_total - r.n_por_grupo) + ' no expuestos';
      } else {
        $('cm-n-label').textContent = r.n_por_grupo != null ? 'Tamaño de muestra total' : 'Tamaño de muestra';
        $('cm-n-por-grupo').textContent = r.n_por_grupo != null ? (r.n_por_grupo + ' por grupo') : '';
      }
      $('cm-formula').textContent = r.formula;
      $('cm-parrafo').textContent = r.parrafo_metodos;
      resultadoEl.classList.add('show');
      $('cm-copiar').disabled = false;
      $('cm-copiar').dataset.parrafo = r.parrafo_metodos;
    } catch (e) {
      resultadoEl.classList.remove('show');
      $('cm-copiar').disabled = true;
      statusEl.textContent = e.message || String(e);
    }
  }

  function copiarParrafo() {
    var texto = $('cm-copiar').dataset.parrafo || '';
    var statusEl = $('cm-status');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto)
        .then(function () { statusEl.style.color = ''; statusEl.textContent = 'Párrafo copiado.'; })
        .catch(function () { statusEl.textContent = 'No se pudo copiar.'; });
    } else {
      statusEl.textContent = 'No se pudo copiar.';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('cm-diseno').addEventListener('change', actualizarCamposVisibles);
    $('cm-calcular').addEventListener('click', calcular);
    $('cm-copiar').addEventListener('click', copiarParrafo);
    actualizarCamposVisibles();

    $('cm-asistente-toggle').addEventListener('click', function () {
      reiniciarAsistente();
      renderAsistente();
      $('cm-asistente-panel').classList.remove('campo-oculto');
    });

    poblarSelectEndes();
    actualizarInfoEndes();
    $('cm-endes-select').addEventListener('change', actualizarInfoEndes);
    $('cm-endes-toggle').addEventListener('click', function () {
      $('cm-endes-panel').classList.remove('campo-oculto');
    });
    $('cm-endes-cerrar').addEventListener('click', function () {
      $('cm-endes-panel').classList.add('campo-oculto');
    });
    $('cm-endes-usar').addEventListener('click', function () {
      var info = ENDES_PREVALENCIAS[$('cm-endes-select').value];
      $('cm-p').value = Math.max(1, Math.round(info.prevalenciaPct)) / 100;
      $('cm-endes-panel').classList.add('campo-oculto');
    });
  });

  window.CalculadoraMuestra = {
    proporcionUnica: proporcionUnica, dosProporciones: dosProporciones, dosMedias: dosMedias,
    casosControles: casosControles, cohorte: cohorte, coeficienteCorrelacion: coeficienteCorrelacion
  };
})();
