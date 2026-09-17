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
  });

  window.CalculadoraMuestra = {
    proporcionUnica: proporcionUnica, dosProporciones: dosProporciones, dosMedias: dosMedias,
    casosControles: casosControles, cohorte: cohorte, coeficienteCorrelacion: coeficienteCorrelacion
  };
})();
