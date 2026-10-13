/* vistas/radar.js — notas del monitoreo semanal: la más reciente primero, con filtro y tandas. */
(function () {
  'use strict';
  var A = window.AsesorStata;
  var N = A.N;
  var u = A.ui;
  var h = u.h;
  var TANDA = 15;

  function tarjetaRadar(n, esR) {
    return h('a', { class: 'guia-card', href: N.construirRuta({ vista: 'guia', origen: esR ? 'r' : 'radar', path: n.path }) },
      h('span', { class: 'guia-titulo' }, n.titulo),
      (n.simple || n.resumen) ? h('span', { class: 'guia-resumen' }, n.simple || n.resumen) : null,
      h('span', { class: 'guia-meta' }, n.tema + (n.fecha ? ' · ' + n.fecha : '')));
  }

  function pintar(ctx, partes, cuerpo, entrada, conteo, esR) {
    var visibles = TANDA;
    function dibujar(reiniciar, enfocarDesde) {
      if (reiniciar) visibles = TANDA;
      var texto = entrada.value.trim();
      var lista = N.listarRadar(partes.radar, texto);
      var total = N.listarRadar(partes.radar, '').length;
      conteo.textContent = !total ? '' : (texto ? lista.length + ' de ' + total + ' notas' : total + ' notas del monitoreo');
      cuerpo.replaceChildren();
      if (!total) {
        cuerpo.appendChild(u.estadoVacio('Todavía no hay notas del monitoreo semanal.', esR ? 'Aparecerán aquí cuando se publiquen las notas de la próxima corrida del monitor de R.' : 'Aparecerán aquí cuando corra la próxima búsqueda.'));
        return;
      }
      if (!lista.length) {
        cuerpo.appendChild(u.estadoVacio('Ninguna nota del Radar coincide con «' + texto + '».', 'Prueba con otra palabra.'));
        return;
      }
      cuerpo.appendChild(h('div', { class: 'guias guias-una' }, lista.slice(0, visibles).map(function (n) { return tarjetaRadar(n, esR); })));
      if (lista.length > visibles) {
        cuerpo.appendChild(h('button', { type: 'button', class: 'btn btn-sec', onclick: function () {
          var antes = visibles;
          visibles += TANDA;
          dibujar(false, antes);
        } }, 'Mostrar ' + Math.min(TANDA, lista.length - visibles) + ' más (quedan ' + (lista.length - visibles) + ')'));
      }
      if (enfocarDesde !== undefined) { // tras «Mostrar más», el foco pasa a la primera nota nueva
        var nueva = cuerpo.querySelectorAll('.guia-card')[enfocarDesde];
        if (nueva) nueva.focus();
      }
    }
    entrada.addEventListener('input', function () { dibujar(true); });
    dibujar(true);
    ctx.restaurarScroll();
  }

  A.vistas.radar = function (ctx) {
    var esR = ctx.ruta.lenguaje === 'r';
    var entrada = h('input', { type: 'search', class: 'busca-campo', placeholder: 'Filtrar el Radar por palabra…',
      'aria-label': 'Filtrar el Radar por palabra', autocomplete: 'off' });
    var conteo = h('span', { class: 'busca-conteo', 'aria-live': 'polite' });
    var cuerpo = h('div', { class: 'cuerpo' }, u.estadoCarga('Cargando el Radar…'));
    ctx.montar(h('div', null,
      u.hero({
        kicker: esR ? 'R · Radar' : 'Radar', titulo: esR ? 'Radar de novedades de R' : 'Radar de novedades',
        texto: esR
          ? 'Paquetes de CRAN y artículos de R que el monitor consideró relevantes para DolphinStats, lo más reciente primero. Son notas técnicas, a veces con títulos en inglés: para aprender desde cero usa las guías.'
          : 'Artículos y módulos de Stata que la búsqueda semanal en revistas de estadística consideró relevantes. Se agregan solos cada lunes, lo más reciente primero. Son notas técnicas, a veces con títulos en inglés: para aprender desde cero usa las guías.',
        extra: h('div', null, esR ? u.subnavR('radar') : null, h('div', { class: 'busca' }, u.icono('buscar'), entrada, conteo)),
      }), cuerpo), { titulo: esR ? 'R · Radar' : 'Radar', seccion: esR ? 'r' : 'radar' });
    ctx.cuando(esR ? A.cargarIndiceR().then(function (indice) { return N.separarPorOrigen(indice); }) : A.cargarIndice(),
      function (partes) { pintar(ctx, partes, cuerpo, entrada, conteo, esR); },
      function (e) { cuerpo.replaceChildren(u.estadoError(esR ? e.message : A.mensajeDeIndice(e), A.recargarVista)); });
  };
})();
