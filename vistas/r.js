/* vistas/r.js — pestaña «R»: guías de R (hoy, ENDES con el paquete survey). Las notas son
   archivos estáticos del sitio (r-notas/), no del repo privado de Stata. */
(function () {
  'use strict';
  var A = window.AsesorStata;
  var N = A.N;
  var u = A.ui;
  var h = u.h;

  // Se pide una sola vez; si falla, la próxima llamada vuelve a intentar.
  A.cargarIndiceR = function () {
    if (A.estado.cargaIndiceR) return A.estado.cargaIndiceR;
    A.estado.cargaIndiceR = fetch('/r-notas/INDEX.md')
      .then(function (res) {
        if (!res.ok) throw new Error('No se pudo cargar las guías de R.');
        return res.text();
      })
      .then(function (texto) { A.estado.indiceR = N.parsearIndiceMarkdown(texto); return A.estado.indiceR; })
      .catch(function (e) {
        A.estado.cargaIndiceR = null;
        throw new Error(e && e.message === 'No se pudo cargar las guías de R.' ? e.message : 'No se pudieron cargar las guías de R. Revisa tu conexión e intenta de nuevo.');
      });
    return A.estado.cargaIndiceR;
  };

  // Ruta de una nota de R que cita el modelo, o null si no existe (el modelo puede inventar rutas).
  // Sin índice cargado se acepta cualquier ruta con la forma de una nota.
  A.rutaDeNotaR = function (path) {
    var indice = A.estado.indiceR;
    var existe = indice
      ? indice.temas.some(function (t) { return t.notas.some(function (n) { return n.path === path; }); })
      : /^knowledge\/[a-z0-9-]+\/[a-z0-9-]+\.md$/.test(String(path));
    return existe ? N.construirRuta({ vista: 'guia', origen: 'r', path: path }) : null;
  };

  // Barra de la pestaña R: Aprender · Preguntar · Código. `actual` = 'aprender' | 'preguntar' | 'codigo'.
  u.subnavR = function (actual) {
    var enlaces = [
      ['aprender', 'Aprender', '#/r'],
      ['preguntar', 'Preguntar', N.construirRuta({ vista: 'preguntar', lenguaje: 'r' })],
      ['codigo', 'Código', N.construirRuta({ vista: 'codigo', modo: 'revisar', lenguaje: 'r' })],
      ['resultados', 'Resultados', N.construirRuta({ vista: 'resultados', lenguaje: 'r' })],
    ];
    return h('nav', { class: 'segmentado', 'aria-label': 'Secciones de la pestaña R' }, enlaces.map(function (e) {
      return h('a', { href: e[2], 'aria-current': e[0] === actual ? 'page' : null }, e[1]);
    }));
  };

  function total(lista) { return lista.temas.reduce(function (n, t) { return n + t.notas.length; }, 0); }

  function tarjetaGuia(n) {
    return h('a', { class: 'guia-card', href: N.construirRuta({ vista: 'guia', origen: 'r', path: n.path }) },
      h('span', { class: 'guia-titulo' }, n.titulo),
      n.resumen ? h('span', { class: 'guia-resumen' }, n.resumen) : null);
  }

  function pintar(indice, cuerpo, entrada, conteo) {
    function dibujar() {
      var texto = entrada.value.trim();
      var temas = N.filtrarIndice(indice, texto);
      var totalGuias = total(indice);
      conteo.textContent = texto
        ? total({ temas: temas }) + ' de ' + totalGuias + ' guías'
        : totalGuias + ' guías en ' + temas.length + ' ' + (temas.length === 1 ? 'tema' : 'temas');
      cuerpo.replaceChildren();
      if (!totalGuias) {
        cuerpo.appendChild(u.estadoVacio('Todavía no hay guías de R.', 'Mientras tanto puedes usar las guías de Stata.',
          h('a', { class: 'btn', href: '#/aprender' }, 'Ir a Aprender')));
        return;
      }
      if (!temas.length) {
        cuerpo.appendChild(u.estadoVacio('Ninguna guía coincide con «' + texto + '».', 'Prueba con otra palabra.'));
        return;
      }
      temas.forEach(function (t) {
        var det = h('details', { class: 'tema' },
          h('summary', null, h('span', null, t.nombre), h('span', { class: 'tema-conteo' }, String(t.notas.length))),
          h('div', { class: 'guias' }, t.notas.map(tarjetaGuia)));
        det.open = true;
        cuerpo.appendChild(det);
      });
    }
    entrada.addEventListener('input', dibujar);
    dibujar();
  }

  A.vistas.r = function (ctx) {
    var entrada = h('input', { type: 'search', class: 'busca-campo', placeholder: 'Filtrar guías por palabra…',
      'aria-label': 'Filtrar guías de R por palabra', autocomplete: 'off' });
    var conteo = h('span', { class: 'busca-conteo', 'aria-live': 'polite' });
    var cuerpo = h('div', { class: 'cuerpo' }, u.estadoCarga('Cargando las guías de R…'));
    ctx.montar(h('div', null,
      u.hero({
        kicker: 'R', titulo: 'Aprender R con la ENDES',
        texto: 'Guías cortas para analizar encuestas con R. Cada una explica la idea en simple y trae código para copiar. Los ejemplos se probaron con datos simulados: confirma los nombres de variables con el diccionario del año que uses.',
        extra: h('div', null, u.subnavR('aprender'), h('div', { class: 'busca' }, u.icono('buscar'), entrada, conteo)),
      }), cuerpo), { titulo: 'R', seccion: 'r' });
    ctx.cuando(A.cargarIndiceR(),
      function (indice) { pintar(indice, cuerpo, entrada, conteo); },
      function (e) { cuerpo.replaceChildren(u.estadoError(e.message, A.recargarVista)); });
  };
})();
