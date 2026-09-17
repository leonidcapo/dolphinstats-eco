/* calculadora-muestra.js — puerto directo de DolphinStatsBot/calculadora_muestra.py
 * (mismas 3 fórmulas, misma referencia, mismas tablas Z fijas). Sin backend,
 * sin dependencias — cálculo 100% en el navegador. */
(function () {
  'use strict';

  var REF_TEXTO = "Charan J, Biswas T. How to calculate sample size for different study " +
    "designs in medical research? Indian J Psychol Med. 2013;35(2):121-6.";

  var Z_ALFA = { 90: 1.645, 95: 1.96, 99: 2.576 };
  var Z_BETA = { 80: 0.84, 85: 1.04, 90: 1.28, 95: 1.645 };

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

  function proporcionUnica(p, d, confianza) {
    validarProporcion(p, 'La proporción esperada');
    if (!(d > 0 && d < 1)) {
      throw new ParametroInvalido('La precisión deseada debe estar entre 0 y 1 (ej. 0.05 para ±5 puntos)');
    }
    var z = Z_ALFA[confianza];
    var n = Math.ceil((z * z * p * (1 - p)) / (d * d));
    var parrafo = 'El tamaño de muestra se calculó para estimar una proporción con una ' +
      'precisión absoluta de ±' + (d * 100).toFixed(0) + ' puntos porcentuales y un nivel de ' +
      'confianza del ' + confianza + '%, asumiendo una proporción esperada del ' +
      (p * 100).toFixed(0) + '%, mediante la fórmula n = Z²·p(1-p)/d² (' + REF_TEXTO + '). ' +
      'El tamaño de muestra mínimo requerido fue de ' + n + ' participantes.';
    return { n_total: n, n_por_grupo: null, formula: 'n = Z²·p(1-p)/d²', parrafo_metodos: parrafo };
  }

  function dosProporciones(p1, p2, confianza, potencia) {
    validarProporcion(p1, 'La proporción del grupo 1');
    validarProporcion(p2, 'La proporción del grupo 2');
    if (p1 === p2) {
      throw new ParametroInvalido('Las dos proporciones no pueden ser iguales (no hay diferencia que detectar)');
    }
    var za = Z_ALFA[confianza], zb = Z_BETA[potencia];
    var nGrupo = Math.ceil(Math.pow(za + zb, 2) * (p1 * (1 - p1) + p2 * (1 - p2)) / Math.pow(p1 - p2, 2));
    var total = nGrupo * 2;
    var parrafo = 'El tamaño de muestra se calculó para comparar dos proporciones ' +
      'independientes (' + (p1 * 100).toFixed(0) + '% vs. ' + (p2 * 100).toFixed(0) + '%), con un nivel de ' +
      'confianza del ' + confianza + '% y una potencia estadística del ' + potencia + '%, ' +
      'mediante la fórmula n = (Zα+Zβ)²·[p1(1-p1)+p2(1-p2)]/(p1-p2)² ' +
      '(' + REF_TEXTO + '). Se requirieron ' + nGrupo + ' participantes por grupo ' +
      '(total: ' + total + ').';
    return {
      n_total: total, n_por_grupo: nGrupo,
      formula: 'n = (Zα+Zβ)²·[p1(1-p1)+p2(1-p2)]/(p1-p2)²',
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
    var nGrupo = Math.ceil(2 * Math.pow(za + zb, 2) * sd * sd / (diferencia * diferencia));
    var total = nGrupo * 2;
    var parrafo = 'El tamaño de muestra se calculó para comparar dos medias ' +
      'independientes, asumiendo una diferencia mínima clínicamente ' +
      'relevante de ' + diferencia + ' y una desviación estándar común esperada ' +
      'de ' + sd + ', con un nivel de confianza del ' + confianza + '% y una potencia ' +
      'estadística del ' + potencia + '%, mediante la fórmula ' +
      'n = 2(Zα+Zβ)²σ²/(μ1-μ2)² (' + REF_TEXTO + '). Se requirieron ' + nGrupo + ' ' +
      'participantes por grupo (total: ' + total + ').';
    return {
      n_total: total, n_por_grupo: nGrupo,
      formula: 'n = 2(Zα+Zβ)²σ²/(μ1-μ2)²',
      parrafo_metodos: parrafo
    };
  }

  /* ---------------- UI wiring ---------------- */

  var DISENOS = ['proporcion_unica', 'dos_proporciones', 'dos_medias'];

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
        r = proporcionUnica(p, d, confianza);
      } else if (diseno === 'dos_proporciones') {
        var p1 = Number($('cm-p1').value);
        var p2 = Number($('cm-p2').value);
        r = dosProporciones(p1, p2, confianza, potencia);
      } else {
        var diferencia = Number($('cm-diferencia').value);
        var sd = Number($('cm-sd').value);
        r = dosMedias(diferencia, sd, confianza, potencia);
      }

      $('cm-n-label').textContent = r.n_por_grupo != null ? 'Tamaño de muestra total' : 'Tamaño de muestra';
      $('cm-n').textContent = r.n_total;
      $('cm-n-por-grupo').textContent = r.n_por_grupo != null ? (r.n_por_grupo + ' por grupo') : '';
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

  window.CalculadoraMuestra = { proporcionUnica: proporcionUnica, dosProporciones: dosProporciones, dosMedias: dosMedias };
})();
