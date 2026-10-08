/* vistas/codigo.js — Trabajar con mi código: Revisar y Explicar (Generar vive en
   vistas/codigo-generar.js). Código a la izquierda con números de línea y resultados a la
   derecha; al tocar un hallazgo o un paso se marcan sus líneas en el código. */
(function () {
  'use strict';
  var A = window.AsesorStata;
  var N = A.N;
  var u = A.ui;
  var h = u.h;
  var MAX_CODIGO = 20000;

  var EJEMPLO_DO = [
    'use "C:\\Users\\Lindsay\\Desktop\\tesis\\base_epe.dta", clear',
    '',
    'gen edad_cat = 1 if edad < 40',
    'replace edad_cat = 2 if edad >= 40',
    '',
    'tab edad_cat epe, chi2',
    'regress presion edad sexo',
    'logistic epe edad_cat sexo',
  ].join('\n');

  var MODOS = {
    revisar: {
      etiqueta: 'Revisar',
      ayuda: 'Pega tu do-file y te indico errores y mejoras, con la línea donde están y cómo corregirlos.',
      placeholder: 'Pega aquí tu do-file, o súbelo con el botón de abajo…',
      vacio: 'Aquí aparecerán los hallazgos, con la línea de cada uno y cómo corregirlo.',
      frases: ['Leyendo tu código…', 'Buscando notas relacionadas en la base…', 'Redactando los hallazgos…', 'Ordenando los hallazgos…'],
    },
    explicar: {
      etiqueta: 'Explicar',
      ayuda: 'Pega un do-file (tuyo o heredado) y te explico qué hace, paso a paso.',
      placeholder: 'Pega aquí el do-file que quieres entender, o súbelo con el botón de abajo…',
      vacio: 'Aquí aparecerá la explicación, paso a paso.',
      frases: ['Leyendo el do-file…', 'Agrupando las líneas en pasos…', 'Redactando la explicación…'],
    },
    generar: {
      etiqueta: 'Generar',
      ayuda: 'Describe el análisis y escribo el do-file. Después puedes pedir ajustes sobre el resultado.',
      vacio: 'Aquí aparecerá el do-file generado.',
    },
  };

  function contar(n, singular, plural) { return n + ' ' + (n === 1 ? singular : plural); }

  function selectorModo(modo) {
    return h('nav', { class: 'segmentado', 'aria-label': 'Qué quieres hacer con tu código' },
      ['revisar', 'explicar', 'generar'].map(function (m) {
        return h('a', { href: N.construirRuta({ vista: 'codigo', modo: m }), 'aria-current': m === modo ? 'page' : null }, MODOS[m].etiqueta);
      }));
  }

  // Une las tarjetas con el visor: tocar una tarjeta marca sus líneas y mueve el visor hasta
  // ellas; tocar una línea cubierta elige la tarjeta que la cubre (si son varias, las recorre).
  // items: [{ nodo, cab, rango (texto o null), lineas (números) }]
  function enlazarSeleccion(visor, items, total) {
    var actual = -1;
    var todas = [];
    items.forEach(function (it) { todas = todas.concat(it.lineas); });
    visor.cubrir(todas);
    function fijar(i) {
      actual = i;
      items.forEach(function (it, k) {
        it.nodo.classList.toggle('sel', k === i);
        it.cab.setAttribute('aria-pressed', k === i ? 'true' : 'false');
      });
      visor.seleccionar(i === -1 ? [] : items[i].lineas);
      if (i !== -1 && items[i].lineas.length) visor.irA(items[i].lineas[0]);
    }
    items.forEach(function (it, k) {
      it.cab.addEventListener('click', function () { fijar(actual === k ? -1 : k); });
      it.nodo.addEventListener('click', function (e) {
        if (e.target.closest('a, button, pre, .bloque-barra')) return;
        fijar(actual === k ? -1 : k);
      });
    });
    visor.enLinea(function (n) {
      var candidatos = N.hallazgosEnLinea(items.map(function (it) { return it.rango; }), n, total);
      var siguiente = N.siguienteEnCiclo(candidatos, actual);
      if (siguiente === -1) return;
      fijar(siguiente);
      items[siguiente].nodo.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function pintarHallazgos(panel, hallazgos, total, visor) {
    visor.cubrir([]);
    visor.seleccionar([]);
    if (!hallazgos.length) {
      panel.replaceChildren(u.estadoVacio('No encontré nada para observar en este código.', 'Eso no garantiza que esté perfecto: revísalo con calma antes de usarlo.'));
      return;
    }
    var ordenados = hallazgos.slice().sort(function (a, b) {
      return (a.severidad === 'importante' ? 0 : 1) - (b.severidad === 'importante' ? 0 : 1);
    });
    var importantes = ordenados.filter(function (x) { return x.severidad === 'importante'; }).length;
    function informe() { return N.armarInformeRevision(hallazgos, u.hoyIso()); }
    var copiar = h('button', { type: 'button', class: 'btn btn-sec' }, 'Copiar informe');
    copiar.addEventListener('click', function () { u.copiarTexto(informe(), copiar, 'Copiar informe'); });
    var descargar = h('button', { type: 'button', class: 'btn btn-sec', onclick: function () {
      u.descargarArchivo(informe(), 'informe-revision-' + u.hoyIso() + '.md', 'text/markdown');
    } }, u.icono('descargar'), 'Descargar informe (.md)');

    var items = ordenados.map(function (x) {
      var nums = N.lineasDeRango(x.lineas, total);
      var enAlerta = x.severidad === 'importante';
      var cab = h('button', { type: 'button', class: 'hz-cab', 'aria-pressed': 'false' },
        u.icono(enAlerta ? 'alerta' : 'check'),
        h('span', { class: 'hz-sev' }, enAlerta ? 'Importante' : 'Sugerencia'),
        nums.length ? h('span', { class: 'chip' }, N.etiquetaLineas(x.lineas)) : null);
      var cuerpo = h('div', { class: 'hz-cuerpo' },
        h('div', { class: 'hz-que', html: N.inlineMarkdown(x.que) }),
        h('p', { class: 'hz-det' }, h('b', null, 'Por qué: '), h('span', { html: N.inlineMarkdown(x.por_que) })),
        h('p', { class: 'hz-det' }, h('b', null, 'Cómo arreglarlo: '), h('span', { html: N.inlineMarkdown(x.como_arreglar) })));
      if (x.codigo_corregido) cuerpo.appendChild(u.bloqueCodigo(x.codigo_corregido, 'Así quedaría'));
      if (x.nota_citada) {
        var ruta = A.rutaDeNota(x.nota_citada.path);
        cuerpo.appendChild(ruta ? h('a', { class: 'hz-nota', href: ruta }, 'Ver la nota: ' + x.nota_citada.titulo)
          : h('span', { class: 'hz-nota' }, 'Nota relacionada: ' + x.nota_citada.titulo));
      }
      return { nodo: h('article', { class: 'hallazgo hz-' + x.severidad }, cab, cuerpo), cab: cab, rango: x.lineas, lineas: nums };
    });
    panel.replaceChildren(
      h('div', { class: 'res-barra' },
        h('div', { class: 'res-resumen' }, contar(ordenados.length, 'hallazgo', 'hallazgos') + ' · ' + contar(importantes, 'importante', 'importantes') + ' · ' +
          contar(ordenados.length - importantes, 'sugerencia', 'sugerencias')),
        h('div', { class: 'res-acciones' }, copiar, descargar)),
      h('div', { class: 'lista-res' }, items.map(function (it) { return it.nodo; })));
    enlazarSeleccion(visor, items, total);
  }

  function pintarPasos(panel, data, total, visor) {
    visor.cubrir([]);
    visor.seleccionar([]);
    var items = data.pasos.map(function (p, i) {
      var nums = N.lineasDeRango(p.lineas, total);
      var cab = h('button', { type: 'button', class: 'hz-cab', 'aria-pressed': 'false' },
        h('span', { class: 'hz-sev' }, 'Paso ' + (i + 1)),
        nums.length ? h('span', { class: 'chip' }, N.etiquetaLineas(p.lineas)) : null);
      var cuerpo = h('div', { class: 'hz-cuerpo' },
        h('div', { class: 'hz-que', html: N.inlineMarkdown(p.que_hace) }),
        p.ojo ? h('div', { class: 'ojo' }, h('b', null, 'Ojo: '), h('span', { html: N.inlineMarkdown(p.ojo) })) : null);
      return { nodo: h('article', { class: 'hallazgo paso' }, cab, cuerpo), cab: cab, rango: p.lineas, lineas: nums };
    });
    panel.replaceChildren(
      h('div', { class: 'res-resumen-bloque', html: '<p>' + N.inlineMarkdown(data.resumen) + '</p>' }),
      h('div', { class: 'lista-res' }, items.map(function (it) { return it.nodo; })));
    enlazarSeleccion(visor, items, total);
  }

  // Columna izquierda de Revisar y Explicar: el visor, las herramientas y el botón.
  function columnaCodigo(ctx, modo, nivel, estado, panel) {
    var def = MODOS[modo];
    var contador = h('div', { class: 'contador' });
    var editar = h('button', { type: 'button', class: 'ejemplo editar campo-oculto' }, u.icono('lapiz'), 'Editar');
    var visor = u.crearVisor({ placeholder: def.placeholder, etiqueta: 'Tu do-file', alCambiar: function (v) { A.estado.borrador.codigo = v; } });
    visor.enModo(function (m) { editar.classList.toggle('campo-oculto', m === 'edicion'); });
    editar.addEventListener('click', function () { visor.editar(); });
    u.enlazarContador(visor.areaTexto, contador, MAX_CODIGO, 'solo se usarán los primeros ' + MAX_CODIGO.toLocaleString('es-PE') + '.');
    visor.poner(A.estado.borrador.codigo); // recupera lo escrito (por ejemplo, al pasar de Revisar a Explicar)

    var archivo = h('input', { type: 'file', class: 'campo-oculto', accept: '.do,.ado,.txt,text/plain' });
    archivo.addEventListener('change', function () {
      var f = archivo.files && archivo.files[0];
      if (!f) return;
      if (f.size > 500000) { u.estadoLinea(estado, 'error', 'Ese archivo es demasiado grande para un do-file (más de 500 KB).'); archivo.value = ''; return; }
      u.leerArchivoComoTexto(f).then(
        function (t) { visor.poner(t); u.estadoLinea(estado, '', ''); archivo.value = ''; },
        function () { u.estadoLinea(estado, 'error', 'No se pudo leer el archivo.'); });
    });
    var herramientas = h('div', { class: 'herramientas' },
      h('button', { type: 'button', class: 'ejemplo', onclick: function () { archivo.click(); } }, u.icono('subir'), 'Subir archivo .do'),
      h('button', { type: 'button', class: 'ejemplo', onclick: function () { visor.poner(EJEMPLO_DO); visor.enfocar(); } }, 'Probar con un ejemplo'),
      editar, archivo);

    var boton = h('button', { type: 'button', class: 'btn' }, def.etiqueta);
    boton.addEventListener('click', function () {
      var codigo = N.prepararCodigo(visor.valor(), MAX_CODIGO);
      if (!codigo) {
        u.estadoLinea(estado, 'error', modo === 'revisar' ? 'Pega o sube primero el do-file que quieres revisar.' : 'Pega o sube primero el do-file que quieres entender.');
        return;
      }
      A.estado.borrador.codigo = visor.valor();
      boton.disabled = true;
      panel.replaceChildren();
      var detener = u.iniciarEspera(estado, def.frases, true);
      u.pedirJson('/api/asesor-stata-codigo', { modo: modo, nivel: nivel.valor(), codigo: codigo }, 90000)
        .then(function (r) {
          detener();
          boton.disabled = false;
          if (!ctx.activo()) return; // el usuario ya cambió de pantalla
          if (!r.ok || r.data.error) { u.estadoLinea(estado, 'error', r.data.error || 'No se pudo procesar el pedido.'); return; }
          u.estadoLinea(estado, '', '');
          visor.leer(codigo); // el visor muestra el mismo texto que numeró el servidor
          var total = N.dividirLineas(codigo).length;
          if (modo === 'revisar') pintarHallazgos(panel, r.data.hallazgos, total, visor);
          else pintarPasos(panel, r.data, total, visor);
          if (window.matchMedia('(max-width: 900px)').matches) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
        .catch(function (e) {
          detener();
          boton.disabled = false;
          if (ctx.activo()) u.estadoLinea(estado, 'error', u.mensajeDeFallo(e));
        });
    });

    return h('div', { class: 'col-codigo' }, visor.el, contador, herramientas, h('div', { class: 'fila-acciones' }, boton));
  }

  A.vistas.codigo = function (ctx) {
    var modo = ctx.ruta.modo;
    var def = MODOS[modo];
    var generar = A.codigoGenerar;
    if (modo === 'generar' && !generar) {
      ctx.montar(h('div', { class: 'cuerpo' }, u.estadoVacio('Esta pantalla no está disponible.', null, h('a', { class: 'btn', href: '#/codigo/revisar' }, 'Ir a Revisar'))),
        { titulo: 'Código', seccion: 'codigo' });
      return;
    }
    var nivel = u.selectorNivel();
    var estado = h('div', { class: 'linea-estado', role: 'status', 'aria-live': 'polite' });
    var panel = h('div', { class: 'panel-res', 'aria-live': 'polite' }, h('p', { class: 'panel-vacio' }, def.vacio));
    var izquierda = modo === 'generar' ? generar(ctx, { nivel: nivel, estado: estado, panel: panel }) : columnaCodigo(ctx, modo, nivel, estado, panel);
    ctx.montar(h('div', null,
      u.hero({ kicker: 'Código', titulo: 'Trabajar con mi código', texto: def.ayuda }),
      h('div', { class: 'cuerpo cuerpo-flota' }, h('div', { class: 'lienzo' },
        u.avisoPrivacidad(),
        h('div', { class: 'controles' }, selectorModo(modo), nivel.el),
        h('div', { class: 'dividido' }, h('div', { class: 'col-izq' }, izquierda, estado), h('div', { class: 'col-der' }, panel))))),
    { titulo: 'Código · ' + def.etiqueta, seccion: 'codigo' });
  };
})();
