/* vistas/resultados.js — Entender mis resultados: se pega la salida de Stata y se obtiene
   una interpretación que cita solo los números que aparecen en ella. */
(function () {
  'use strict';
  var A = window.AsesorStata;
  var N = A.N;
  var u = A.ui;
  var h = u.h;
  var MAX_SALIDA = 8000;
  var MAX_CONTEXTO = 500;
  var FRASES = ['Leyendo la salida…', 'Interpretando los resultados…', 'Redactando la explicación…'];
  var EJEMPLO_CONTEXTO = 'Bajo peso al nacer (low) según si la madre fumó (smoke)';
  var EJEMPLO_SALIDA = [
    '. tab smoke low, row chi2',
    '',
    '           |          low',
    '     smoke |         0          1 |     Total',
    '-----------+----------------------+----------',
    '         0 |        86         29 |       115',
    '           |     74.78      25.22 |    100.00',
    '-----------+----------------------+----------',
    '         1 |        44         30 |        74',
    '           |     59.46      40.54 |    100.00',
    '-----------+----------------------+----------',
    '     Total |       130         59 |       189',
    '           |     68.78      31.22 |    100.00',
    '',
    '          Pearson chi2(1) =   4.9237   Pr = 0.026',
  ].join('\n');

  function bloque(titulo, contenido) {
    return h('section', { class: 'interp-bloque' }, h('h2', { class: 'interp-titulo' }, titulo), contenido);
  }

  function pintar(panel, d) {
    var nodos = [bloque('Qué análisis es', h('p', { html: N.inlineMarkdown(d.que_se_hizo) }))];
    if (d.resultados.length) {
      nodos.push(bloque('Qué dicen los números', h('div', null, d.resultados.map(function (r) {
        return h('div', { class: 'resultado' }, h('div', { class: 'resultado-dato' }, r.dato),
          h('div', { class: 'resultado-significado', html: N.inlineMarkdown(r.significado) }));
      }))));
    }
    if (d.precauciones.length) {
      nodos.push(bloque('Precauciones', h('ul', { class: 'precauciones' }, d.precauciones.map(function (p) { return h('li', { html: N.inlineMarkdown(p) }); }))));
    }
    if (d.como_reportarlo) {
      var copiar = h('button', { type: 'button', class: 'btn btn-sec' }, 'Copiar frase');
      copiar.addEventListener('click', function () { u.copiarTexto(d.como_reportarlo, copiar, 'Copiar frase'); });
      nodos.push(bloque('Cómo reportarlo', h('div', null, h('blockquote', { class: 'reporte' }, d.como_reportarlo), copiar)));
    }
    panel.replaceChildren(h('div', { class: 'lienzo' }, nodos));
  }

  A.vistas.resultados = function (ctx) {
    var area = h('textarea', { class: 'campo salida-campo', spellcheck: 'false', wrap: 'off', 'aria-label': 'Salida de Stata',
      placeholder: 'Pega aquí la salida de Stata: una tabla de regresión, un chi cuadrado, un t-test, el resultado de un modelo de Cox…' });
    var contador = h('div', { class: 'contador' });
    var contexto = h('input', { type: 'text', class: 'campo', maxlength: String(MAX_CONTEXTO),
      placeholder: 'Ej.: factores asociados a bajo peso al nacer en un hospital de Lima' });
    var nivel = u.selectorNivel();
    var estado = h('div', { class: 'linea-estado', role: 'status', 'aria-live': 'polite' });
    var panel = h('div', { class: 'panel-res', 'aria-live': 'polite' },
      h('p', { class: 'panel-vacio' }, 'Aquí aparecerá la interpretación: qué análisis es, qué dicen los números y qué cuidados tener.'));
    area.value = A.estado.borrador.salida;
    area.addEventListener('input', function () { A.estado.borrador.salida = area.value; });
    u.enlazarContador(area, contador, MAX_SALIDA, 'solo se usarán los primeros ' + MAX_SALIDA.toLocaleString('es-PE') + '.');

    var ejemplo = h('button', { type: 'button', class: 'ejemplo', onclick: function () {
      area.value = EJEMPLO_SALIDA;
      area.dispatchEvent(new Event('input'));
      contexto.value = EJEMPLO_CONTEXTO;
      area.focus();
    } }, 'Probar con un ejemplo');
    var boton = h('button', { type: 'button', class: 'btn' }, 'Interpretar');
    boton.addEventListener('click', function () {
      var salida = area.value.trim().slice(0, MAX_SALIDA);
      if (!salida) { u.estadoLinea(estado, 'error', 'Pega primero la salida de Stata que quieres interpretar.'); return; }
      var cuerpo = { modo: 'interpretar', nivel: nivel.valor(), salida: salida };
      var ctxto = contexto.value.trim();
      if (ctxto) cuerpo.contexto = ctxto;
      boton.disabled = true;
      panel.replaceChildren();
      var detener = u.iniciarEspera(estado, FRASES, false);
      u.pedirJson('/api/asesor-stata-codigo', cuerpo, 90000)
        .then(function (r) {
          detener();
          boton.disabled = false;
          if (!ctx.activo()) return; // el usuario ya cambió de pantalla
          if (!r.ok || r.data.error) { u.estadoLinea(estado, 'error', r.data.error || 'No se pudo procesar el pedido.'); return; }
          u.estadoLinea(estado, '', '');
          pintar(panel, r.data);
          if (window.matchMedia('(max-width: 900px)').matches) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
        .catch(function (e) {
          detener();
          boton.disabled = false;
          if (ctx.activo()) u.estadoLinea(estado, 'error', u.mensajeDeFallo(e));
        });
    });

    ctx.montar(h('div', null,
      u.hero({ kicker: 'Resultados', titulo: 'Entender mis resultados',
        texto: 'Pega la salida de Stata (una tabla, un modelo, una prueba) y te explico qué dice, citando solo los números que aparecen.' }),
      h('div', { class: 'cuerpo cuerpo-flota' }, h('div', { class: 'lienzo' },
        u.avisoPrivacidad(),
        h('div', { class: 'dividido' },
          h('div', { class: 'col-izq' }, area, contador,
            h('label', { class: 'campo-etiqueta' }, 'Contexto del estudio (opcional, ayuda a interpretar mejor)', contexto),
            h('div', { class: 'herramientas' }, ejemplo),
            h('div', { class: 'fila-acciones' }, nivel.el, boton), estado),
          h('div', { class: 'col-der' }, panel))))),
    { titulo: 'Resultados', seccion: 'resultados' });
  };
})();
