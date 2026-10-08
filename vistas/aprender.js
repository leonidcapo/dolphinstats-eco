/* vistas/aprender.js — lista de guías por tema, con filtro. */
(function () {
  'use strict';
  var A = window.AsesorStata;
  var N = A.N;
  var u = A.ui;
  var h = u.h;
  // La guía por la que se recomienda empezar.
  var EMPIEZA_AQUI = 'knowledge/stata-basics/tour-rapido-interfaz-flujo-trabajo.md';

  function total(lista) { return lista.temas.reduce(function (n, t) { return n + t.notas.length; }, 0); }
  function enlaceGuia(path) { return N.construirRuta({ vista: 'guia', origen: 'aprender', path: path }); }

  function tarjetaGuia(n) {
    return h('a', { class: 'guia-card', href: enlaceGuia(n.path) },
      h('span', { class: 'guia-titulo' }, n.titulo),
      n.resumen ? h('span', { class: 'guia-resumen' }, n.resumen) : null);
  }

  function destacada(partes) {
    var nota = null;
    partes.guias.temas.forEach(function (t) { t.notas.forEach(function (n) { if (n.path === EMPIEZA_AQUI) nota = n; }); });
    if (!nota) return null;
    return h('a', { class: 'destacada', href: enlaceGuia(nota.path) },
      h('span', { class: 'insignia' }, 'Empieza aquí'),
      h('span', { class: 'destacada-titulo' }, nota.titulo),
      nota.resumen ? h('span', { class: 'destacada-resumen' }, nota.resumen) : null);
  }

  function pintar(ctx, partes, cuerpo, entrada, conteo) {
    function dibujar() {
      var texto = entrada.value.trim();
      var temas = N.filtrarIndice(partes.guias, texto);
      var totalGuias = total(partes.guias);
      conteo.textContent = texto
        ? total({ temas: temas }) + ' de ' + totalGuias + ' guías'
        : totalGuias + ' guías en ' + temas.length + ' temas';
      cuerpo.replaceChildren();
      if (!totalGuias) {
        cuerpo.appendChild(u.estadoVacio('Todavía no hay guías publicadas.', 'Mientras tanto puedes mirar el Radar.',
          h('a', { class: 'btn', href: '#/radar' }, 'Ir al Radar')));
        return;
      }
      if (!texto) { var d = destacada(partes); if (d) cuerpo.appendChild(d); }
      if (!temas.length) {
        cuerpo.appendChild(u.estadoVacio('Ninguna guía coincide con «' + texto + '».', 'Prueba con otra palabra o pregúntalo directamente.',
          h('button', { type: 'button', class: 'btn', onclick: function () {
            A.estado.preguntaInicial = texto.slice(0, 500);
            location.hash = '#/preguntar';
          } }, 'Preguntar esto')));
        return;
      }
      temas.forEach(function (t, i) {
        var det = h('details', { class: 'tema' },
          h('summary', null, h('span', null, t.nombre), h('span', { class: 'tema-conteo' }, String(t.notas.length))),
          h('div', { class: 'guias' }, t.notas.map(tarjetaGuia)));
        det.open = texto ? true : i === 0; // con filtro se abren todos; sin filtro, solo el primero
        cuerpo.appendChild(det);
      });
    }
    entrada.addEventListener('input', dibujar);
    dibujar();
    ctx.restaurarScroll();
  }

  A.vistas.aprender = function (ctx) {
    var entrada = h('input', { type: 'search', class: 'busca-campo', placeholder: 'Filtrar guías por palabra…',
      'aria-label': 'Filtrar guías por palabra', autocomplete: 'off' });
    var conteo = h('span', { class: 'busca-conteo', 'aria-live': 'polite' });
    var cuerpo = h('div', { class: 'cuerpo' }, u.estadoCarga('Cargando las guías…'));
    ctx.montar(h('div', null,
      u.hero({
        kicker: 'Aprender', titulo: 'Aprender Stata',
        texto: 'Guías cortas, ordenadas para aprender. Cada una explica la idea en simple y trae un ejemplo para copiar.',
        extra: h('div', { class: 'busca' }, u.icono('buscar'), entrada, conteo),
      }), cuerpo), { titulo: 'Aprender', seccion: 'aprender' });
    ctx.cuando(A.cargarIndice(),
      function (partes) { pintar(ctx, partes, cuerpo, entrada, conteo); },
      function (e) { cuerpo.replaceChildren(u.estadoError(A.mensajeDeIndice(e), A.recargarVista)); });
  };
})();
