/* vistas/guia.js — lectura de una guía (o de una nota del Radar) como artículo:
   «En simple», ejemplo, resumen técnico y, al final, la guía anterior y la siguiente. */
(function () {
  'use strict';
  var A = window.AsesorStata;
  var N = A.N;
  var u = A.ui;
  var h = u.h;
  var CLAVES_CONOCIDAS = ['resumen', 'en simple', 'ejemplo', 'relevancia para dolphinstats'];

  function pedirNota(path) {
    return fetch('/api/asesor-stata-base?nota=' + encodeURIComponent(path))
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, estado: res.status, data: data }; }); })
      .then(function (r) {
        if (!r.ok) { var e = new Error(r.data.error || 'No se pudo cargar la nota.'); e.estado = r.estado; throw e; }
        return r.data.markdown;
      });
  }

  function chipFuente(meta) {
    var etiqueta = N.etiquetaFuente(meta.source);
    if (/^https?:\/\//.test(meta.source_url || '')) {
      return h('a', { class: 'chip chip-enlace', href: meta.source_url, target: '_blank', rel: 'noopener noreferrer' },
        etiqueta + ' · ver fuente', u.icono('externo', 'ico-mini'));
    }
    return h('span', { class: 'chip' }, etiqueta);
  }

  function seccion(titulo, html) {
    return h('section', { class: 'seccion' }, h('h2', null, titulo), h('div', { class: 'texto-md', html: html }));
  }

  // Orden de lectura: En simple, Ejemplo, Resumen técnico, otras secciones y, al final
  // y plegada, la relevancia para DolphinStats (nota interna del equipo).
  function articulo(secciones) {
    var por = function (clave) { return secciones.filter(function (s) { return s.clave === clave; })[0] || null; };
    var art = h('article', { class: 'articulo' });
    var simple = por('en simple');
    if (simple && simple.cuerpo) {
      art.appendChild(h('aside', { class: 'callout' }, h('div', { class: 'callout-rotulo' }, 'En simple'),
        h('div', { class: 'texto-md', html: N.cuerpoMarkdownAHtml(simple.cuerpo) })));
    }
    var ejemplo = por('ejemplo');
    if (ejemplo && ejemplo.cuerpo) {
      var bloqueEjemplo = seccion('Ejemplo', N.cuerpoMarkdownAHtml(ejemplo.cuerpo));
      Array.prototype.forEach.call(bloqueEjemplo.querySelectorAll('pre.bloque-codigo'), function (pre) { u.agregarBarraCopiar(pre, 'Código Stata'); });
      art.appendChild(bloqueEjemplo);
    }
    var resumen = por('resumen');
    if (resumen && resumen.cuerpo) art.appendChild(seccion('Resumen técnico', N.cuerpoMarkdownAHtml(resumen.cuerpo)));
    secciones.forEach(function (s) {
      if (CLAVES_CONOCIDAS.indexOf(s.clave) === -1 && s.cuerpo) art.appendChild(seccion(s.titulo, N.cuerpoMarkdownAHtml(s.cuerpo)));
    });
    var interna = por('relevancia para dolphinstats');
    if (interna && interna.cuerpo) {
      art.appendChild(h('details', { class: 'nota-interna' }, h('summary', null, 'Nota interna: relevancia para DolphinStats'),
        h('div', { class: 'texto-md', html: N.cuerpoMarkdownAHtml(interna.cuerpo) })));
    }
    if (!art.children.length) art.appendChild(h('p', { class: 'vacio' }, 'Esta nota no tiene contenido para mostrar.'));
    return art;
  }

  // «Anterior / Siguiente» según el orden del índice. En los extremos no hay enlaces rotos:
  // la primera guía lo dice y la última lleva de vuelta a la lista.
  function navegacion(v) {
    function enlace(vecina, rol) {
      var rotulo = rol === 'anterior'
        ? (vecina.otroTema ? 'Tema anterior: ' + vecina.tema : 'Guía anterior')
        : (vecina.otroTema ? 'Siguiente tema: ' + vecina.tema : 'Siguiente guía');
      return h('a', { class: 'vecina ' + rol, href: N.construirRuta({ vista: 'guia', origen: 'aprender', path: vecina.path }) },
        h('span', { class: 'vecina-rotulo' }, rol === 'anterior' ? [u.icono('flecha-izq', 'ico-mini'), rotulo] : [rotulo, u.icono('flecha-der', 'ico-mini')]),
        h('strong', null, vecina.titulo));
    }
    return h('nav', { class: 'vecinas', 'aria-label': 'Guías vecinas' },
      v.anterior ? enlace(v.anterior, 'anterior') : h('div', { class: 'vecina vacia' }, 'Esta es la primera guía'),
      v.siguiente ? enlace(v.siguiente, 'siguiente')
        : h('a', { class: 'vecina siguiente', href: '#/aprender' }, h('span', { class: 'vecina-rotulo' }, 'Terminaste las guías'), h('strong', null, 'Volver a la lista')));
  }

  function pintar(ctx, path, esRadar, partes, markdown) {
    var parsed = N.parsearFrontmatter(markdown);
    var titulo = parsed.meta.title || path;
    var vecinos = !esRadar && partes ? N.vecinosDeGuia(partes.guias, path) : null;
    var volver = esRadar ? '#/radar' : '#/aprender';

    var botonEnlace = h('button', { type: 'button', class: 'btn btn-sec' }, 'Copiar enlace');
    botonEnlace.addEventListener('click', function () { u.copiarTexto(location.href, botonEnlace, 'Copiar enlace'); });
    var chips = h('div', { class: 'chips' },
      vecinos ? h('span', { class: 'chip' }, 'Guía ' + vecinos.posicion + ' de ' + vecinos.totalTema) : null,
      esRadar ? h('span', { class: 'chip' }, 'Radar') : null,
      parsed.meta.source ? chipFuente(parsed.meta) : null,
      parsed.meta.date ? h('span', { class: 'chip' }, parsed.meta.date) : null,
      botonEnlace);
    var miga = h('nav', { class: 'miga', 'aria-label': 'Ruta de navegación' },
      h('a', { href: volver }, esRadar ? 'Radar' : 'Aprender'), u.icono('flecha-der', 'ico-mini'),
      h('span', null, N.nombreTema(path.split('/')[1])));
    var cabecera = u.hero({ miga: miga, titulo: titulo, extra: chips });
    if (titulo.length > 70) cabecera.querySelector('h1').classList.add('largo');

    var pie = vecinos ? navegacion(vecinos)
      : h('p', null, h('a', { class: 'btn btn-sec', href: volver }, u.icono('flecha-izq'), esRadar ? 'Volver al Radar' : 'Volver a las guías'));
    ctx.montar(h('div', null, cabecera, h('div', { class: 'cuerpo' }, articulo(N.separarSecciones(parsed.cuerpo)), pie)),
      { titulo: titulo, seccion: esRadar ? 'radar' : 'aprender' });
  }

  A.vistas.guia = function (ctx) {
    var path = ctx.ruta.path;
    var esRadar = ctx.ruta.origen === 'radar';
    var seccionNav = esRadar ? 'radar' : 'aprender';
    ctx.montar(h('div', { class: 'cuerpo' }, u.estadoCarga('Cargando la nota…')), { titulo: 'Nota', seccion: seccionNav });
    // La nota se lee aunque falle el índice (solo se pierden la posición y los vecinos).
    var indice = A.cargarIndice().then(function (p) { return p; }, function () { return null; });
    ctx.cuando(Promise.all([indice, pedirNota(path)]),
      function (r) { pintar(ctx, path, esRadar, r[0], r[1]); },
      function (e) {
        var noExiste = e && e.estado === 404;
        ctx.montar(h('div', { class: 'cuerpo' },
          u.estadoError(noExiste ? 'No encontramos esa nota. Puede que se haya movido o renombrado.' : 'No se pudo cargar la nota. Revisa tu conexión e intenta de nuevo.',
            noExiste ? null : A.recargarVista),
          h('p', null, h('a', { href: esRadar ? '#/radar' : '#/aprender' }, esRadar ? 'Volver al Radar' : 'Volver a las guías'))),
        { titulo: 'Nota no disponible', seccion: seccionNav });
      });
  };
})();
