/* vistas/codigo-generar.js — modo Generar de «Trabajar con mi código»: formulario guiado,
   descripción, resultado (do-file) y ajustes sobre el resultado. La llama vistas/codigo.js. */
(function () {
  'use strict';
  var A = window.AsesorStata;
  var N = A.N;
  var u = A.ui;
  var h = u.h;
  var MAX_DESCRIPCION = 1000;
  var MAX_AJUSTE = 500;
  var EJEMPLOS = [
    ['Tabla 1 por grupo', 'Tabla 1 por grupo (variable grupo): edad con media y desviación estándar, sexo con n y porcentaje, y chi cuadrado para las variables categóricas.'],
    ['Regresión logística con OR', 'Regresión logística de enfermedad (0/1) en edad, sexo e IMC, mostrando odds ratios con intervalos de confianza al 95%.'],
    ['Kaplan-Meier por grupo', 'Curva de supervivencia de Kaplan-Meier por grupo, con prueba log-rank y tabla de número en riesgo.'],
  ];
  var FRASES = ['Entendiendo tu pedido…', 'Buscando notas relacionadas…', 'Escribiendo el do-file…'];
  var FRASES_AJUSTE = ['Leyendo tu código…', 'Aplicando el ajuste…', 'Reescribiendo el do-file…'];
  var SALIDAS = [
    ['tabla 1 por grupo', 'Tabla 1'], ['una prueba de hipótesis', 'Prueba de hipótesis'], ['un modelo de regresión', 'Modelo de regresión'],
    ['un gráfico', 'Gráfico'], ['una tabla lista para el artículo', 'Tabla para el artículo'],
  ];
  var ESTUDIOS = ['Estudio transversal', 'Estudio de casos y controles', 'Estudio de cohorte', 'Ensayo clínico aleatorizado', 'Estudio antes y después'];
  var TIPOS = ['numérica continua', 'sí/no (0/1)', 'categórica de varios niveles', 'tiempo hasta un evento', 'conteo'];

  function opciones(lista, vacio) {
    return (vacio ? [h('option', { value: '' }, vacio)] : []).concat(lista.map(function (t) { return h('option', { value: t }, t); }));
  }

  function formularioGuiado(alArmar) {
    var estudio = h('select', { class: 'campo' }, opciones(ESTUDIOS, '(sin indicar)'));
    var resultado = h('input', { type: 'text', class: 'campo', maxlength: '60', placeholder: 'Ej.: presion_sistolica' });
    var tipo = h('select', { class: 'campo' }, opciones(TIPOS));
    var explicativas = h('input', { type: 'text', class: 'campo', maxlength: '200', placeholder: 'Ej.: edad, sexo, imc' });
    var grupos = h('input', { type: 'text', class: 'campo', maxlength: '60', placeholder: 'Ej.: tratamiento' });
    var casillas = SALIDAS.map(function (s) {
      var c = h('input', { type: 'checkbox', value: s[0] });
      return { entrada: c, nodo: h('label', null, c, s[1]) };
    });
    var armar = h('button', { type: 'button', class: 'ejemplo' }, 'Armar la descripción');
    armar.addEventListener('click', function () {
      alArmar(N.armarDescripcionGuiada({
        estudio: estudio.value, resultado: resultado.value, tipoResultado: resultado.value.trim() ? tipo.value : '',
        explicativas: explicativas.value, grupos: grupos.value,
        salidas: casillas.filter(function (c) { return c.entrada.checked; }).map(function (c) { return c.entrada.value; }),
      }));
    });
    return h('details', { class: 'guia-form' },
      h('summary', null, 'Ayuda guiada: responde unas preguntas y armo la descripción por ti'),
      h('div', { class: 'guia-grid' },
        h('label', null, 'Tipo de estudio', estudio), h('label', null, 'Variable de resultado', resultado),
        h('label', null, 'Tipo del resultado', tipo), h('label', null, 'Variables explicativas', explicativas),
        h('label', null, 'Grupos a comparar', grupos)),
      h('div', { class: 'guia-salidas' }, h('span', { class: 'ejemplos-titulo' }, 'Quiero:'), casillas.map(function (c) { return c.nodo; })),
      armar);
  }

  A.codigoGenerar = function (ctx, comun) {
    var nivel = comun.nivel;
    var estado = comun.estado;
    var panel = comun.panel;
    var ultimaDescripcion = ''; // con la que se generó el código que se ve (los ajustes parten de ella)

    var area = h('textarea', { class: 'campo', maxlength: String(MAX_DESCRIPCION), 'aria-label': 'Descripción del análisis',
      placeholder: 'Describe el análisis. Cuanto más concreto (variables, tipo de estudio, qué quieres reportar), mejor.' });
    var contador = h('div', { class: 'contador' });
    area.value = A.estado.borrador.descripcion;
    area.addEventListener('input', function () { A.estado.borrador.descripcion = area.value; });
    u.enlazarContador(area, contador, MAX_DESCRIPCION, 'se recortará.');

    var guia = formularioGuiado(function (descripcion) {
      if (!descripcion) { u.estadoLinea(estado, 'error', 'Completa al menos un campo del formulario para armar la descripción.'); return; }
      u.estadoLinea(estado, '', '');
      area.value = descripcion;
      area.dispatchEvent(new Event('input'));
      area.focus();
    });
    var ejemplos = h('div', { class: 'ejemplos' }, h('span', { class: 'ejemplos-titulo' }, 'Prueba con:'),
      EJEMPLOS.map(function (e) {
        return h('button', { type: 'button', class: 'ejemplo', onclick: function () { area.value = e[1]; area.dispatchEvent(new Event('input')); area.focus(); } }, e[0]);
      }));
    var boton = h('button', { type: 'button', class: 'btn' }, 'Generar');

    function pintarCodigo(data) {
      var ajuste = h('textarea', { class: 'campo', maxlength: String(MAX_AJUSTE), 'aria-label': '¿Quieres cambiar algo?',
        placeholder: 'Ej.: agrega una tabla por sexo; usa errores estándar robustos; guarda los gráficos como PNG' });
      var aplicar = h('button', { type: 'button', class: 'btn' }, 'Aplicar ajuste');
      aplicar.addEventListener('click', function () {
        var pedido = ajuste.value.trim();
        if (!pedido) { u.estadoLinea(estado, 'error', 'Escribe qué quieres cambiar del código.'); return; }
        enviar({ ajuste: pedido, codigoPrevio: data.codigo });
      });
      var notas = data.notas_citadas.map(function (n) {
        var ruta = A.rutaDeNota(n.path);
        return ruta ? h('a', { class: 'hz-nota', href: ruta }, 'Ver la nota: ' + n.titulo) : h('span', { class: 'hz-nota' }, 'Nota relacionada: ' + n.titulo);
      });
      panel.replaceChildren(h('div', { class: 'gen-res' },
        u.bloqueCodigo(data.codigo, 'Código Stata (do-file)'),
        h('div', { class: 'res-acciones' }, h('button', { type: 'button', class: 'btn btn-sec', onclick: function () {
          u.descargarArchivo(data.codigo, 'analisis.do', 'text/plain');
        } }, u.icono('descargar'), 'Descargar .do')),
        h('p', { class: 'gen-explicacion' }, data.explicacion),
        notas.length ? h('div', { class: 'gen-notas' }, notas) : null,
        h('div', { class: 'ajuste' }, h('div', { class: 'ajuste-titulo' }, '¿Quieres cambiar algo?'), ajuste, aplicar)));
    }

    function enviar(extra) {
      extra = extra || {};
      var descripcion = extra.ajuste ? ultimaDescripcion : area.value.trim();
      if (!descripcion) { u.estadoLinea(estado, 'error', 'Describe primero el análisis que quieres generar.'); return; }
      var cuerpo = { modo: 'generar', nivel: nivel.valor(), descripcion: descripcion };
      if (extra.ajuste) { cuerpo.codigo_previo = extra.codigoPrevio; cuerpo.ajuste = extra.ajuste; }
      boton.disabled = true;
      panel.replaceChildren();
      var detener = u.iniciarEspera(estado, extra.ajuste ? FRASES_AJUSTE : FRASES, false);
      u.pedirJson('/api/asesor-stata-codigo', cuerpo, 90000)
        .then(function (r) {
          detener();
          boton.disabled = false;
          if (!ctx.activo()) return; // el usuario ya cambió de pantalla
          if (!r.ok || r.data.error) { u.estadoLinea(estado, 'error', r.data.error || 'No se pudo procesar el pedido.'); return; }
          u.estadoLinea(estado, '', '');
          ultimaDescripcion = descripcion;
          pintarCodigo(r.data);
          if (window.matchMedia('(max-width: 900px)').matches) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
        .catch(function (e) {
          detener();
          boton.disabled = false;
          if (ctx.activo()) u.estadoLinea(estado, 'error', u.mensajeDeFallo(e));
        });
    }
    boton.addEventListener('click', function () { enviar(); });

    return h('div', { class: 'col-generar' }, guia, area, contador, ejemplos, h('div', { class: 'fila-acciones' }, boton));
  };
})();
