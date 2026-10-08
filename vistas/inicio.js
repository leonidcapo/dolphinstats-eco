/* vistas/inicio.js — pantalla de bienvenida: cuatro tareas y una franja con lo último del Radar. */
(function () {
  'use strict';
  var A = window.AsesorStata;
  var N = A.N;
  var u = A.ui;
  var h = u.h;

  A.vistas.inicio = function (ctx) {
    var aviso = A.avisoPendiente;
    A.avisoPendiente = null;

    var tarjetaAprender = u.tarjetaTarea({ href: '#/aprender', tono: 'azul', icono: 'libro', titulo: 'Aprender Stata',
      texto: 'Guías cortas con ejemplos para copiar. Empieza por el tour rápido.' });
    var textoAprender = tarjetaAprender.querySelector('.tarea-texto');

    var franja = h('div', { class: 'franja-radar campo-oculto', 'aria-live': 'polite' });

    var nodo = h('div', null,
      u.hero({
        kicker: 'Asesor Stata', titulo: '¿Qué necesitas hoy?',
        texto: 'Guías con ejemplos, respuestas de tu base de notas y ayuda con tu código de Stata.',
      }),
      h('div', { class: 'cuerpo cuerpo-flota' },
        aviso ? h('p', { class: 'aviso-vista', role: 'status' }, aviso) : null,
        h('div', { class: 'tareas' },
          tarjetaAprender,
          u.tarjetaTarea({ href: '#/preguntar', tono: 'cian', icono: 'chat', titulo: 'Preguntar a las notas',
            texto: 'Una respuesta basada solo en tu base de notas, con las notas citadas.' }),
          u.tarjetaTarea({ href: '#/codigo/revisar', tono: 'naranja', icono: 'codigo', titulo: 'Trabajar con mi código',
            texto: 'Revisa errores con su línea, entiende un do-file paso a paso o genera uno nuevo.' }),
          u.tarjetaTarea({ href: '#/resultados', tono: 'violeta', icono: 'grafico', titulo: 'Entender mis resultados',
            texto: 'Pega la salida de Stata y te explico qué dice, sin inventar números.' })),
        franja));

    ctx.montar(nodo, { titulo: 'Asesor Stata', inicio: true });

    // El Inicio no depende del índice: las cuatro tarjetas funcionan aunque falle.
    ctx.cuando(A.cargarIndice(), function (partes) {
      var guias = partes.guias.temas.reduce(function (n, t) { return n + t.notas.length; }, 0);
      if (guias) textoAprender.textContent = guias + ' guías cortas con ejemplos para copiar. Empieza por el tour rápido.';
      var lista = N.listarRadar(partes.radar, '');
      if (!lista.length) return;
      var ultima = lista[0];
      var resumen = ultima.simple || ultima.resumen;
      franja.classList.remove('campo-oculto');
      franja.appendChild(h('div', { class: 'franja-texto' },
        h('strong', null, 'Radar de la semana: ' + lista.length + ' notas del monitoreo. '),
        'Lo último: ' + ultima.titulo.split(':')[0] + (resumen ? ' — ' + (resumen.length > 110 ? resumen.slice(0, 107) + '…' : resumen) : '')));
      franja.appendChild(h('a', { class: 'franja-enlace', href: '#/radar' }, 'Ver el Radar', u.icono('flecha-der')));
    }, function () { /* sin índice no hay franja; el resto del Inicio sigue usable */ });
  };
})();
