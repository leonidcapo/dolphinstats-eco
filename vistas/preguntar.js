/* vistas/preguntar.js — pregunta en texto libre; la respuesta se basa solo en las notas. */
(function () {
  'use strict';
  var A = window.AsesorStata;
  var N = A.N;
  var u = A.ui;
  var h = u.h;
  var MAX_PREGUNTA = 500;
  var EJEMPLOS = [
    ['¿Fisher o chi²?', '¿Cuándo uso Fisher en vez de chi cuadrado?'],
    ['Diseño muestral ENDES', '¿Cómo declaro el diseño muestral de la ENDES en Stata?'],
    ['¿Qué es un do-file?', '¿Qué es un do-file y por qué conviene usarlo?'],
  ];
  var EJEMPLOS_R = [
    ['Declarar el diseño', '¿Cómo declaro el diseño muestral de la ENDES en R?'],
    ['Prevalencia con IC', '¿Cómo calculo una prevalencia con su intervalo de confianza en R?'],
    ['Subgrupos', '¿Cómo analizo solo a las mujeres menores de 25 años sin romper el diseño?'],
  ];
  var FRASES = ['Buscando en las notas…', 'Leyendo las notas relevantes…', 'Redactando la respuesta…'];

  function resumenDeNota(path, partes, esR) {
    var resumen = '';
    if (partes) {
      (esR ? [partes] : [partes.guias, partes.radar]).forEach(function (lista) {
        lista.temas.forEach(function (t) { t.notas.forEach(function (n) { if (n.path === path) resumen = n.simple || n.resumen || ''; }); });
      });
    }
    return resumen;
  }

  // Una nota citada por el modelo solo es un enlace si existe de verdad (el modelo puede inventar rutas).
  function tarjetaNota(nota, partes, esR) {
    var ruta = esR ? A.rutaDeNotaR(nota.path) : A.rutaDeNota(nota.path);
    if (!ruta) return h('div', { class: 'guia-card nota-card sin-enlace' }, h('span', { class: 'guia-titulo' }, nota.titulo));
    var resumen = resumenDeNota(nota.path, partes, esR);
    return h('a', { class: 'guia-card nota-card', href: ruta },
      h('span', { class: 'guia-titulo' }, nota.titulo),
      resumen ? h('span', { class: 'guia-resumen' }, resumen) : null);
  }

  function pintarRespuesta(panel, data, partes, esR) {
    panel.replaceChildren(h('div', { class: 'respuesta' }, data.respuesta));
    if (data.notas_citadas.length) {
      panel.appendChild(h('div', { class: 'citas' }, h('h2', null, 'Notas en las que se basa esta respuesta'),
        h('div', { class: 'guias' }, data.notas_citadas.map(function (n) { return tarjetaNota(n, partes, esR); }))));
    } else {
      panel.appendChild(h('div', { class: 'sugerencias' }, h('p', null, 'Esta respuesta no se apoyó en ninguna nota. Puedes:'),
        h('ul', null,
          h('li', null, 'probar con otras palabras;'),
          h('li', null, 'mirar las ', h('a', { href: esR ? '#/r' : '#/aprender' }, 'guías'), ' por tema;'),
          esR ? h('li', null, 'pedir código nuevo en ', h('a', { href: N.construirRuta({ vista: 'codigo', modo: 'generar', lenguaje: 'r' }) }, 'Código · Generar'), '.')
            : h('li', null, 'revisar las novedades del ', h('a', { href: '#/radar' }, 'Radar'), '.'))));
    }
  }

  A.vistas.preguntar = function (ctx) {
    var esR = ctx.ruta.lenguaje === 'r';
    var area = h('textarea', { class: 'campo', maxlength: String(MAX_PREGUNTA), 'aria-label': 'Tu pregunta',
      placeholder: esR ? 'Ej.: ¿cómo declaro el diseño muestral de la ENDES en R?' : 'Ej.: ¿cuándo uso Fisher en vez de chi cuadrado?' });
    var contador = h('div', { class: 'contador' });
    var nivel = u.selectorNivel();
    var estado = h('div', { class: 'linea-estado', role: 'status', 'aria-live': 'polite' });
    var boton = h('button', { type: 'submit', class: 'btn' }, 'Preguntar');
    var panel = h('div', { class: 'panel-respuesta', 'aria-live': 'polite' });
    var ejemplos = h('div', { class: 'ejemplos' }, h('span', { class: 'ejemplos-titulo' }, 'Prueba con:'),
      (esR ? EJEMPLOS_R : EJEMPLOS).map(function (e) {
        return h('button', { type: 'button', class: 'ejemplo', onclick: function () { area.value = e[1]; area.dispatchEvent(new Event('input')); area.focus(); } }, e[0]);
      }));
    var formulario = h('form', { class: 'tarjeta-form', novalidate: true }, area, contador, ejemplos,
      h('div', { class: 'fila-acciones' }, nivel.el, boton), estado);
    u.enlazarContador(area, contador, MAX_PREGUNTA, 'se recortará.');
    var clave = esR ? 'ultimaConsultaR' : 'ultimaConsulta';
    if (A.estado.preguntaInicial && !esR) { // viene de «Preguntar esto» en Aprender
      area.value = A.estado.preguntaInicial;
      A.estado.preguntaInicial = '';
      area.dispatchEvent(new Event('input'));
    } else if (A.estado[clave]) { // vuelve de una nota citada: la respuesta sigue ahí
      area.value = A.estado[clave].pregunta;
      area.dispatchEvent(new Event('input'));
      pintarRespuesta(panel, A.estado[clave].data, esR ? A.estado.indiceR : A.estado.partes, esR);
    }

    formulario.addEventListener('submit', function (e) {
      e.preventDefault();
      var pregunta = area.value.trim();
      if (!pregunta) { u.estadoLinea(estado, 'error', 'Escribe primero tu pregunta.'); return; }
      boton.disabled = true;
      panel.replaceChildren();
      var detener = u.iniciarEspera(estado, FRASES, false);
      u.pedirJson('/api/asesor-stata-consulta', esR ? { pregunta: pregunta, nivel: nivel.valor(), lenguaje: 'r' } : { pregunta: pregunta, nivel: nivel.valor() }, 60000)
        .then(function (r) {
          detener();
          boton.disabled = false;
          if (!ctx.activo()) return; // el usuario ya cambió de pantalla
          if (!r.ok || r.data.error) { u.estadoLinea(estado, 'error', r.data.error || 'No se pudo responder la consulta.'); return; }
          u.estadoLinea(estado, '', '');
          A.estado[clave] = { pregunta: pregunta, data: r.data };
          pintarRespuesta(panel, r.data, esR ? A.estado.indiceR : A.estado.partes, esR);
        })
        .catch(function (err) {
          detener();
          boton.disabled = false;
          if (ctx.activo()) u.estadoLinea(estado, 'error', u.mensajeDeFallo(err));
        });
    });

    ctx.montar(h('div', null,
      u.hero({ kicker: esR ? 'R · Preguntar' : 'Preguntar', titulo: esR ? 'Pregunta a las notas de R' : 'Pregunta a tus notas',
        texto: 'Recibirás una respuesta basada solo en las notas de la base, indicando en cuáles se apoya.',
        extra: esR ? u.subnavR('preguntar') : null }),
      h('div', { class: 'cuerpo cuerpo-flota' }, formulario, panel)), { titulo: esR ? 'R · Preguntar' : 'Preguntar', seccion: esR ? 'r' : 'preguntar' });
    // El índice solo sirve para mostrar bien las notas citadas: si falla, se pregunta igual.
    (esR ? A.cargarIndiceR() : A.cargarIndice()).catch(function () { /* se usa el enlace por forma de ruta */ });
  };
})();
