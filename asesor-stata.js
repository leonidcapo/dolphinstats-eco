/* asesor-stata.js — cliente de la página asesor-stata.html: consume
 * api/asesor-stata-base.js (Explorar), api/asesor-stata-consulta.js (Buscar)
 * y api/asesor-stata-codigo.js (Código). Sin dependencias -- conversor
 * Markdown propio, chico, escrito para el formato fijo que siguen las notas de
 * knowledge/ (frontmatter YAML + ## headings + listas + negritas + `código`). */
(function () {
  'use strict';
  var N = window.AsesorStataNucleo;
  var escapeHtml = N.escapeHtml,
      inlineMarkdown = N.inlineMarkdown,
      parsearFrontmatter = N.parsearFrontmatter,
      cuerpoMarkdownAHtml = N.cuerpoMarkdownAHtml,
      nombreTema = N.nombreTema,
      filtrarIndice = N.filtrarIndice,
      etiquetaFuente = N.etiquetaFuente,
      separarNotaInterna = N.separarNotaInterna,
      separarPorOrigen = N.separarPorOrigen,
      listarRadar = N.listarRadar,
      etiquetaLineas = N.etiquetaLineas,
      armarInformeRevision = N.armarInformeRevision,
      armarDescripcionGuiada = N.armarDescripcionGuiada;

  // ---------------------------------------------------------------- interfaz

  function $(id) { return document.getElementById(id); }

  // Deben coincidir con los límites de los endpoints en api/.
  var MAX_CODIGO = 20000;
  var MAX_DESCRIPCION = 1000;
  var MAX_PREGUNTA = 500;
  var MAX_SALIDA = 8000;
  var RADAR_TANDA = 15;
  // La guía por la que se recomienda empezar (se marca en la lista de Explorar).
  var EMPIEZA_AQUI = 'knowledge/stata-basics/tour-rapido-interfaz-flujo-trabajo.md';
  var CLAVE_NIVEL = 'asesor-stata-nivel';

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

  var tabActual = 'explorar';
  var tabAnterior = 'explorar';
  var notaAbierta = false;
  var scrollIndice = 0;
  var indiceGlobal = null; // solo guías (Explorar)
  var indiceRadar = null;  // solo notas del monitoreo (Radar)
  var radarVisibles = RADAR_TANDA;
  var subModoCodigo = 'revisar';

  function leerGuardado(clave) {
    try { return window.localStorage.getItem(clave); } catch (e) { return null; }
  }
  function escribirGuardado(clave, valor) {
    try { window.localStorage.setItem(clave, valor); } catch (e) { /* sin almacenamiento: no pasa nada */ }
  }

  function mostrarEstado(el, tipo, texto) {
    el.className = 'estado' + (tipo ? ' ' + tipo : '');
    el.textContent = texto;
  }

  // Texto de espera que avanza solo (con segundos transcurridos) para que una
  // respuesta lenta no parezca un cuelgue. Devuelve la función que lo detiene.
  function iniciarEspera(el, frases, avisoLargo) {
    var inicio = Date.now();
    function pintar() {
      var seg = Math.floor((Date.now() - inicio) / 1000);
      var frase = frases[Math.min(Math.floor(seg / 7), frases.length - 1)];
      var extra = avisoLargo && seg >= 10 ? ' · los textos largos pueden tardar hasta 30 s' : '';
      mostrarEstado(el, 'esperando', frase + ' (' + seg + ' s)' + extra);
    }
    pintar();
    var id = setInterval(pintar, 1000);
    return function () { clearInterval(id); };
  }

  function pedirJson(url, cuerpo, ms) {
    var controlador = new AbortController();
    var corte = setTimeout(function () { controlador.abort(); }, ms);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: controlador.signal,
    })
      .then(function (res) {
        return res.json()
          .catch(function () { return { error: 'El servidor no respondió correctamente. Intenta de nuevo en un momento.' }; })
          .then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(
        function (r) { clearTimeout(corte); return r; },
        function (e) { clearTimeout(corte); throw e; }
      );
  }

  function mensajeDeFallo(e) {
    if (e && e.name === 'AbortError') {
      return 'Tardó demasiado en responder. Prueba con un texto más corto o intenta de nuevo.';
    }
    return 'No se pudo completar el pedido. Revisa tu conexión e intenta de nuevo.';
  }

  // Si el navegador no deja copiar, deja `elemento` seleccionado para usar Ctrl+C.
  function copiarTexto(texto, boton, etiqueta, elemento) {
    function listo() {
      boton.textContent = '¡Copiado!';
      setTimeout(function () { boton.textContent = etiqueta; }, 1600);
    }
    function alternativa() {
      var area = document.createElement('textarea');
      area.value = texto;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(area);
      if (ok) { listo(); return; }
      if (elemento) {
        var rango = document.createRange();
        rango.selectNodeContents(elemento);
        var seleccion = window.getSelection();
        seleccion.removeAllRanges();
        seleccion.addRange(rango);
      }
      boton.textContent = 'Usa Ctrl+C';
      setTimeout(function () { boton.textContent = etiqueta; }, 3000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(listo, alternativa);
    } else {
      alternativa();
    }
  }

  function enlazarContador(areaId, contadorId, max, textoSobre) {
    var area = $(areaId);
    var contador = $(contadorId);
    function actualizar() {
      var n = area.value.length;
      var sobre = n > max;
      contador.textContent = n.toLocaleString('es-PE') + ' / ' + max.toLocaleString('es-PE') + ' caracteres' +
        (sobre ? ' — ' + textoSobre : '');
      contador.classList.toggle('sobre', sobre);
    }
    area.addEventListener('input', actualizar);
    actualizar();
  }

  // ------------------------------------------------------------------- tabs

  var TABS = ['explorar', 'buscar', 'radar', 'codigo'];

  // Solo el resaltado de la pestaña (sin cambiar de panel).
  function resaltarTab(nombre) {
    TABS.forEach(function (t) {
      var activa = t === nombre;
      $('as-tab-' + t).classList.toggle('activo', activa);
      $('as-tab-' + t).setAttribute('aria-selected', activa ? 'true' : 'false');
    });
  }

  function mostrarTab(nombre) {
    tabActual = nombre;
    resaltarTab(nombre);
    TABS.forEach(function (t) {
      $('as-' + t + '-panel').classList.toggle('campo-oculto', t !== nombre);
    });
  }

  // --------------------------------------------------------------- Explorar

  function pintarIndice() {
    var cont = $('as-indice');
    var texto = $('as-filtro').value.trim();
    var temas = filtrarIndice(indiceGlobal, texto);
    var total = 0;
    var totalGeneral = 0;
    indiceGlobal.temas.forEach(function (t) { totalGeneral += t.notas.length; });
    temas.forEach(function (t) { total += t.notas.length; });
    cont.innerHTML = '';

    var conteo = $('as-conteo');
    if (!totalGeneral) {
      cont.innerHTML = '<p class="vacio">Todavía no hay guías publicadas.</p>';
      conteo.textContent = '';
      return;
    }
    conteo.textContent = texto
      ? total + ' de ' + totalGeneral + ' guías'
      : totalGeneral + ' guías en ' + temas.length + ' temas';

    if (!temas.length) {
      var vacio = document.createElement('div');
      vacio.className = 'vacio';
      vacio.innerHTML = '<p></p><button type="button" class="subtab">Preguntar esto en Buscar</button>';
      vacio.querySelector('p').textContent = 'Ninguna guía coincide con «' + texto + '». Prueba con otra palabra, o pregúntalo directamente.';
      vacio.querySelector('button').addEventListener('click', function () {
        $('as-buscar-input').value = texto.slice(0, MAX_PREGUNTA);
        $('as-buscar-input').dispatchEvent(new Event('input'));
        mostrarTab('buscar');
        $('as-buscar-input').focus();
      });
      cont.appendChild(vacio);
      return;
    }

    temas.forEach(function (tema, i) {
      var det = document.createElement('details');
      det.className = 'tema';
      // Con filtro se abren todos los temas; sin filtro, solo el primero.
      det.open = texto ? true : i === 0;
      var resumen = document.createElement('summary');
      var nombre = document.createElement('span');
      nombre.textContent = tema.nombre;
      var cuenta = document.createElement('span');
      cuenta.className = 'tema-conteo';
      cuenta.textContent = tema.notas.length;
      resumen.appendChild(nombre);
      resumen.appendChild(cuenta);
      det.appendChild(resumen);

      tema.notas.forEach(function (nota) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ncard';
        btn.innerHTML = '<div class="ntitulo"></div><div class="nresumen"></div>';
        btn.querySelector('.ntitulo').textContent = nota.titulo;
        btn.querySelector('.nresumen').textContent = nota.resumen;
        if (nota.path === EMPIEZA_AQUI) {
          var insignia = document.createElement('span');
          insignia.className = 'insignia';
          insignia.textContent = 'Empieza aquí';
          btn.querySelector('.ntitulo').appendChild(insignia);
        }
        btn.addEventListener('click', function () { verNota(nota.path); });
        det.appendChild(btn);
      });
      cont.appendChild(det);
    });
  }

  function verNota(path) {
    var hash = '#nota=' + encodeURIComponent(path);
    if (window.location.hash === hash) abrirNota(path);
    else window.location.hash = hash;
  }

  function abrirNota(path) {
    if (!notaAbierta) {
      tabAnterior = tabActual;
      scrollIndice = window.scrollY;
    }
    notaAbierta = true;
    // La vista de nota vive en el panel de Explorar, pero la pestaña resaltada
    // sigue siendo la de origen (Radar, Preguntar, Código): ahí lleva «Volver».
    mostrarTab('explorar');
    resaltarTab(tabAnterior);
    $('as-explorar-lista').classList.add('campo-oculto');
    $('as-nota-vista').classList.remove('campo-oculto');
    var cont = $('as-nota-contenido');
    cont.innerHTML = '<p class="vacio">Cargando…</p>';
    window.scrollTo(0, 0);
    fetch('/api/asesor-stata-base?nota=' + encodeURIComponent(path))
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (!r.ok) { cont.innerHTML = '<p class="vacio"></p>'; cont.firstChild.textContent = r.data.error || 'No se pudo cargar la nota.'; return; }
        renderNota(path, r.data.markdown);
      })
      .catch(function () { cont.innerHTML = '<p class="vacio">No se pudo cargar la nota. Intenta de nuevo.</p>'; });
  }

  function renderNota(path, markdown) {
    var parsed = parsearFrontmatter(markdown);
    var cont = $('as-nota-contenido');
    cont.innerHTML = '<h2 class="nota-titulo"></h2><div class="nota-meta"></div><div class="nota-cuerpo"></div>';
    cont.querySelector('.nota-titulo').textContent = parsed.meta.title || path;
    var secciones = separarNotaInterna(parsed.cuerpo);
    var cuerpoEl = cont.querySelector('.nota-cuerpo');
    cuerpoEl.innerHTML = cuerpoMarkdownAHtml(secciones.principal);

    // Cada bloque de código lleva su botón «Copiar».
    cuerpoEl.querySelectorAll('pre.bloque-codigo').forEach(function (pre) {
      agregarBarraCopiar(pre, 'Código Stata');
    });

    // La relevancia para DolphinStats es una nota del equipo: va plegada al final.
    if (secciones.interna) {
      var det = document.createElement('details');
      det.className = 'nota-interna';
      det.innerHTML = '<summary>Nota interna: relevancia para DolphinStats</summary><div class="nota-interna-cuerpo"></div>';
      det.querySelector('.nota-interna-cuerpo').innerHTML = cuerpoMarkdownAHtml(secciones.interna);
      cont.appendChild(det);
    }

    var meta = cont.querySelector('.nota-meta');
    function chip(texto) {
      var s = document.createElement('span');
      s.className = 'chip';
      s.textContent = texto;
      meta.appendChild(s);
      return s;
    }
    var partes = path.split('/');
    if (partes[1]) chip(nombreTema(partes[1]));
    if (parsed.meta.date) chip(parsed.meta.date);
    if (parsed.meta.source) {
      var etiqueta = etiquetaFuente(parsed.meta.source);
      if (/^https?:\/\//.test(parsed.meta.source_url || '')) {
        var a = document.createElement('a');
        a.className = 'chip enlace';
        a.href = parsed.meta.source_url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = etiqueta + ' · ver fuente ↗';
        meta.appendChild(a);
      } else {
        chip(etiqueta);
      }
    }
  }

  function cerrarNota() {
    notaAbierta = false;
    $('as-nota-vista').classList.add('campo-oculto');
    $('as-explorar-lista').classList.remove('campo-oculto');
    mostrarTab(tabAnterior || 'explorar');
    window.scrollTo(0, tabAnterior === 'explorar' ? scrollIndice : 0);
  }

  function limpiarHash() {
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  function aplicarHash() {
    var m = window.location.hash.match(/^#nota=(.+)$/);
    if (m) {
      var path = null;
      try { path = decodeURIComponent(m[1]); } catch (e) { path = null; }
      if (path && /^knowledge\/.+\.md$/.test(path) && path.indexOf('..') === -1) {
        abrirNota(path);
        return;
      }
    }
    if (notaAbierta) cerrarNota();
  }

  // ------------------------------------------------------------------ Radar

  // Notas que agrega solo el monitoreo semanal. Se listan todas (la más
  // reciente primero) y se muestran por tandas para que la lista no crezca sin fin.
  function pintarRadar(reiniciar) {
    var cont = $('as-radar');
    var texto = $('as-filtro-radar').value.trim();
    var lista = listarRadar(indiceRadar, texto);
    var totalRadar = listarRadar(indiceRadar, '').length;
    if (reiniciar) radarVisibles = RADAR_TANDA;
    cont.innerHTML = '';

    $('as-conteo-radar').textContent = !totalRadar ? '' :
      (texto ? lista.length + ' de ' + totalRadar + ' notas' : totalRadar + ' notas del monitoreo');
    if (!totalRadar) {
      cont.innerHTML = '<p class="vacio">Todavía no hay notas del monitoreo semanal.</p>';
      return;
    }
    if (!lista.length) {
      cont.innerHTML = '<p class="vacio"></p>';
      cont.firstChild.textContent = 'Ninguna nota del Radar coincide con «' + texto + '».';
      return;
    }

    lista.slice(0, radarVisibles).forEach(function (nota) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ncard';
      btn.innerHTML = '<div class="ntitulo"></div><div class="nresumen"></div><div class="nfecha"></div>';
      btn.querySelector('.ntitulo').textContent = nota.titulo;
      // Si la nota trae explicación en simple, la tarjeta muestra esa (el
      // resumen técnico queda dentro de la nota).
      btn.querySelector('.nresumen').textContent = nota.simple || nota.resumen;
      btn.querySelector('.nfecha').textContent = nota.tema + (nota.fecha ? ' · ' + nota.fecha : '');
      btn.addEventListener('click', function () { verNota(nota.path); });
      cont.appendChild(btn);
    });
    if (lista.length > radarVisibles) {
      var mas = document.createElement('button');
      mas.type = 'button';
      mas.className = 'subtab';
      mas.textContent = 'Mostrar ' + Math.min(RADAR_TANDA, lista.length - radarVisibles) + ' más (quedan ' + (lista.length - radarVisibles) + ')';
      mas.addEventListener('click', function () { radarVisibles += RADAR_TANDA; pintarRadar(false); });
      cont.appendChild(mas);
    }
  }

  function cargarIndice() {
    function fallo(mensaje) {
      var html = '<p class="vacio"></p>';
      ['as-indice', 'as-radar'].forEach(function (id) {
        $(id).innerHTML = html;
        $(id).firstChild.textContent = mensaje;
      });
    }
    fetch('/api/asesor-stata-base')
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (!r.ok) { fallo(r.data.error || 'No se pudo cargar el índice.'); return; }
        var partes = separarPorOrigen(r.data);
        indiceGlobal = partes.guias;
        indiceRadar = partes.radar;
        pintarIndice();
        pintarRadar(true);
        aplicarHash();
      })
      .catch(function () { fallo('No se pudo cargar el índice. Intenta de nuevo.'); });
  }

  // ----------------------------------------------------------------- Buscar

  function renderResultadoBusqueda(data) {
    var cont = $('as-buscar-resultado');
    cont.classList.remove('campo-oculto');
    var html = '<div class="respuesta">' + escapeHtml(data.respuesta) + '</div>';
    if (data.notas_citadas.length) {
      html += '<div class="citas"><div class="citas-titulo">Notas en las que se basa esta respuesta</div>';
      data.notas_citadas.forEach(function (nota) {
        html += '<a href="#" data-path="' + escapeHtml(nota.path) + '">' + escapeHtml(nota.titulo) + '</a>';
      });
      html += '</div>';
    }
    cont.innerHTML = html;
    cont.querySelectorAll('.citas a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        verNota(a.getAttribute('data-path'));
      });
    });
  }

  function nivelSeleccionadoDe(nombreGrupo) {
    var opciones = document.getElementsByName(nombreGrupo);
    for (var i = 0; i < opciones.length; i++) {
      if (opciones[i].checked) return opciones[i].value;
    }
    return 'intermedio';
  }

  function enviarConsulta(pregunta) {
    var status = $('as-buscar-status');
    var boton = $('as-buscar-enviar');
    var resultado = $('as-buscar-resultado');
    resultado.classList.add('campo-oculto');
    boton.disabled = true;
    var detener = iniciarEspera(status, ['Buscando en las notas…', 'Leyendo las notas relevantes…', 'Redactando la respuesta…'], false);
    pedirJson('/api/asesor-stata-consulta', { pregunta: pregunta, nivel: nivelSeleccionadoDe('as-nivel') }, 60000)
      .then(function (r) {
        detener();
        boton.disabled = false;
        if (!r.ok || r.data.error) { mostrarEstado(status, 'error', r.data.error || 'No se pudo responder la consulta.'); return; }
        mostrarEstado(status, '', '');
        renderResultadoBusqueda(r.data);
      })
      .catch(function (e) {
        detener();
        boton.disabled = false;
        mostrarEstado(status, 'error', mensajeDeFallo(e));
      });
  }

  // ----------------------------------------------------------------- Código

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

  // Qué cambia en la pantalla según el modo.
  var MODOS_CODIGO = {
    revisar: {
      etiqueta: 'Revisar', bloque: 'as-bloque-revisar', resultado: 'as-codigo-hallazgos',
      ayuda: 'Pega tu do-file y te indico errores y mejoras, con la línea donde están y cómo corregirlos.',
      placeholder: 'Pega aquí tu do-file, o súbelo con el botón de abajo…',
      frases: ['Leyendo tu código…', 'Buscando notas relacionadas en la base…', 'Redactando los hallazgos…', 'Ordenando los hallazgos…'],
      largo: true,
    },
    explicar: {
      etiqueta: 'Explicar', bloque: 'as-bloque-revisar', resultado: 'as-codigo-explicacion',
      ayuda: 'Pega un do-file (tuyo o heredado) y te explico qué hace, paso a paso.',
      placeholder: 'Pega aquí el do-file que quieres entender, o súbelo con el botón de abajo…',
      frases: ['Leyendo el do-file…', 'Agrupando las líneas en pasos…', 'Redactando la explicación…'],
      largo: true,
    },
    generar: {
      etiqueta: 'Generar', bloque: 'as-bloque-generar', resultado: 'as-codigo-generado',
      ayuda: 'Describe el análisis y escribo el do-file. Después puedes pedir ajustes sobre el resultado.',
      frases: ['Entendiendo tu pedido…', 'Buscando notas relacionadas…', 'Escribiendo el do-file…'],
      largo: false,
    },
    interpretar: {
      etiqueta: 'Interpretar', bloque: 'as-bloque-interpretar', resultado: 'as-codigo-interpretacion',
      ayuda: 'Pega la salida de Stata (una tabla, un modelo, una prueba) y te explico qué dice, citando solo los números que aparecen.',
      frases: ['Leyendo la salida…', 'Interpretando los resultados…', 'Redactando la explicación…'],
      largo: false,
    },
  };

  var ultimaDescripcion = ''; // descripción con la que se generó el código que se ve (para los ajustes)

  function mostrarSubModoCodigo(modo) {
    subModoCodigo = modo;
    var def = MODOS_CODIGO[modo];
    Object.keys(MODOS_CODIGO).forEach(function (m) {
      $('as-subtab-' + m).classList.toggle('activo', m === modo);
      $(MODOS_CODIGO[m].resultado).classList.add('campo-oculto');
    });
    ['as-bloque-revisar', 'as-bloque-generar', 'as-bloque-interpretar'].forEach(function (id) {
      $(id).classList.toggle('campo-oculto', id !== def.bloque);
    });
    if (def.placeholder) $('as-codigo-revisar-input').placeholder = def.placeholder;
    $('as-codigo-ayuda').textContent = def.ayuda;
    $('as-codigo-enviar').textContent = def.etiqueta;
    mostrarEstado($('as-codigo-status'), '', '');
  }

  // Inserta sobre un <pre> una barra con el rótulo y un botón «Copiar».
  function agregarBarraCopiar(pre, rotulo) {
    var barra = document.createElement('div');
    barra.className = 'bloque-barra';
    var etiqueta = document.createElement('span');
    etiqueta.textContent = rotulo;
    var boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'copiar';
    boton.textContent = 'Copiar';
    boton.addEventListener('click', function () { copiarTexto(pre.textContent, boton, 'Copiar', pre); });
    barra.appendChild(etiqueta);
    barra.appendChild(boton);
    pre.parentNode.insertBefore(barra, pre);
  }

  function crearBloqueCodigo(codigo, rotulo) {
    var envoltura = document.createElement('div');
    var pre = document.createElement('pre');
    pre.className = 'bloque-codigo';
    var code = document.createElement('code');
    code.textContent = codigo;
    pre.appendChild(code);
    envoltura.appendChild(pre);
    agregarBarraCopiar(pre, rotulo);
    return envoltura;
  }

  function hoyIso() {
    var d = new Date();
    function dos(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
  }

  function descargarArchivo(contenido, nombre, tipo) {
    var blob = new Blob([contenido], { type: tipo });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function renderHallazgos(hallazgos) {
    var cont = $('as-codigo-hallazgos');
    cont.classList.remove('campo-oculto');
    if (!hallazgos.length) {
      cont.innerHTML = '<p class="vacio">No encontré nada para observar en este código.</p>';
      return;
    }
    var ordenados = hallazgos.slice().sort(function (a, b) {
      return (a.severidad === 'importante' ? 0 : 1) - (b.severidad === 'importante' ? 0 : 1);
    });
    var importantes = ordenados.filter(function (h) { return h.severidad === 'importante'; }).length;
    cont.innerHTML = '<div class="hallazgos-barra"><div class="hallazgos-resumen"></div>' +
      '<div class="informe-acciones"><button type="button" class="copiar informe-copiar">Copiar informe</button>' +
      '<button type="button" class="copiar informe-descargar">Descargar informe (.md)</button></div></div>';
    cont.querySelector('.hallazgos-resumen').textContent = ordenados.length + (ordenados.length === 1 ? ' hallazgo' : ' hallazgos') +
      ' · ' + importantes + (importantes === 1 ? ' importante' : ' importantes') +
      ' · ' + (ordenados.length - importantes) + (ordenados.length - importantes === 1 ? ' sugerencia' : ' sugerencias');
    var botonInforme = cont.querySelector('.informe-copiar');
    botonInforme.addEventListener('click', function () {
      copiarTexto(armarInformeRevision(hallazgos, hoyIso()), botonInforme, 'Copiar informe');
    });
    cont.querySelector('.informe-descargar').addEventListener('click', function () {
      descargarArchivo(armarInformeRevision(hallazgos, hoyIso()), 'informe-revision-' + hoyIso() + '.md', 'text/markdown');
    });

    ordenados.forEach(function (h) {
      var div = document.createElement('div');
      div.className = 'hallazgo ' + (h.severidad === 'importante' ? 'importante' : 'sugerencia');
      div.innerHTML = '<div class="h-cabecera"><span class="h-severidad"></span><span class="h-lineas campo-oculto"></span></div>' +
        '<div class="h-que"></div>' +
        '<div class="h-detalle"><b>Por qué:</b> <span class="h-porque"></span></div>' +
        '<div class="h-detalle"><b>Cómo arreglarlo:</b> <span class="h-arreglo"></span></div>' +
        '<div class="h-codigo"></div>' +
        '<div class="h-nota campo-oculto"><a href="#"></a></div>';
      div.querySelector('.h-severidad').textContent = h.severidad === 'importante' ? 'Importante' : 'Sugerencia';
      if (h.lineas) {
        var chip = div.querySelector('.h-lineas');
        chip.textContent = etiquetaLineas(h.lineas);
        chip.classList.remove('campo-oculto');
      }
      // inlineMarkdown escapa el HTML: solo agrega <code>, <strong> y <em>.
      div.querySelector('.h-que').innerHTML = inlineMarkdown(h.que);
      div.querySelector('.h-porque').innerHTML = inlineMarkdown(h.por_que);
      div.querySelector('.h-arreglo').innerHTML = inlineMarkdown(h.como_arreglar);
      if (h.codigo_corregido) {
        div.querySelector('.h-codigo').appendChild(crearBloqueCodigo(h.codigo_corregido, 'Así quedaría'));
      }
      if (h.nota_citada) {
        var notaDiv = div.querySelector('.h-nota');
        notaDiv.classList.remove('campo-oculto');
        var link = notaDiv.querySelector('a');
        link.textContent = 'Ver la nota: ' + h.nota_citada.titulo;
        link.addEventListener('click', function (e) {
          e.preventDefault();
          verNota(h.nota_citada.path);
        });
      }
      cont.appendChild(div);
    });
  }

  function renderExplicacion(data) {
    var cont = $('as-codigo-explicacion');
    cont.classList.remove('campo-oculto');
    cont.innerHTML = '<div class="explica-resumen"></div><div class="pasos"></div>';
    cont.querySelector('.explica-resumen').innerHTML = inlineMarkdown(data.resumen);
    var pasos = cont.querySelector('.pasos');
    data.pasos.forEach(function (p, i) {
      var div = document.createElement('div');
      div.className = 'paso';
      div.innerHTML = '<div class="paso-cabecera"><span class="paso-numero"></span><span class="h-lineas campo-oculto"></span></div>' +
        '<div class="paso-texto"></div><div class="paso-ojo campo-oculto"></div>';
      div.querySelector('.paso-numero').textContent = 'Paso ' + (i + 1);
      if (p.lineas) {
        var chip = div.querySelector('.h-lineas');
        chip.textContent = etiquetaLineas(p.lineas);
        chip.classList.remove('campo-oculto');
      }
      div.querySelector('.paso-texto').innerHTML = inlineMarkdown(p.que_hace);
      if (p.ojo) {
        var ojo = div.querySelector('.paso-ojo');
        ojo.classList.remove('campo-oculto');
        ojo.innerHTML = '<b>Ojo:</b> ' + inlineMarkdown(p.ojo);
      }
      pasos.appendChild(div);
    });
  }

  function renderInterpretacion(data) {
    var cont = $('as-codigo-interpretacion');
    cont.classList.remove('campo-oculto');
    cont.innerHTML = '<div class="interp-titulo">Qué análisis es</div><p class="interp-texto interp-que"></p>' +
      '<div class="interp-seccion interp-resultados campo-oculto"><div class="interp-titulo">Qué dicen los números</div><div class="resultados"></div></div>' +
      '<div class="interp-seccion interp-precauciones campo-oculto"><div class="interp-titulo">Precauciones</div><ul></ul></div>' +
      '<div class="interp-seccion interp-reporte campo-oculto"><div class="interp-titulo">Cómo reportarlo</div>' +
      '<blockquote class="reporte-texto"></blockquote><button type="button" class="copiar">Copiar frase</button></div>';
    cont.querySelector('.interp-que').innerHTML = inlineMarkdown(data.que_se_hizo);

    if (data.resultados.length) {
      cont.querySelector('.interp-resultados').classList.remove('campo-oculto');
      var lista = cont.querySelector('.resultados');
      data.resultados.forEach(function (r) {
        var div = document.createElement('div');
        div.className = 'resultado';
        div.innerHTML = '<div class="resultado-dato"></div><div class="resultado-significado"></div>';
        div.querySelector('.resultado-dato').textContent = r.dato;
        div.querySelector('.resultado-significado').innerHTML = inlineMarkdown(r.significado);
        lista.appendChild(div);
      });
    }
    if (data.precauciones.length) {
      cont.querySelector('.interp-precauciones').classList.remove('campo-oculto');
      var ul = cont.querySelector('.interp-precauciones ul');
      data.precauciones.forEach(function (p) {
        var li = document.createElement('li');
        li.innerHTML = inlineMarkdown(p);
        ul.appendChild(li);
      });
    }
    if (data.como_reportarlo) {
      cont.querySelector('.interp-reporte').classList.remove('campo-oculto');
      cont.querySelector('.reporte-texto').textContent = data.como_reportarlo;
      var boton = cont.querySelector('.interp-reporte button');
      boton.addEventListener('click', function () { copiarTexto(data.como_reportarlo, boton, 'Copiar frase'); });
    }
  }

  function renderCodigoGenerado(data) {
    var cont = $('as-codigo-generado');
    cont.classList.remove('campo-oculto');
    cont.innerHTML = '<pre></pre><button type="button" class="copiar">Copiar</button>' +
      '<button type="button" class="copiar descargar">Descargar .do</button><div class="explicacion"></div>' +
      '<div class="ajuste"><label class="ajuste-titulo">¿Quieres cambiar algo?</label>' +
      '<textarea class="ajuste-texto" maxlength="500" placeholder="Ej.: agrega una tabla por sexo; usa errores estándar robustos; guarda los gráficos como PNG"></textarea>' +
      '<button type="button" class="enviar ajuste-aplicar">Aplicar ajuste</button></div>';
    cont.querySelector('pre').textContent = data.codigo;
    cont.querySelector('.explicacion').textContent = data.explicacion;
    var botonCopiar = cont.querySelector('button.copiar:not(.descargar)');
    botonCopiar.addEventListener('click', function () { copiarTexto(data.codigo, botonCopiar, 'Copiar'); });
    cont.querySelector('button.descargar').addEventListener('click', function () {
      descargarArchivo(data.codigo, 'analisis.do', 'text/plain');
    });
    var areaAjuste = cont.querySelector('.ajuste-texto');
    cont.querySelector('.ajuste-aplicar').addEventListener('click', function () {
      var ajuste = areaAjuste.value.trim();
      if (!ajuste) { mostrarEstado($('as-codigo-status'), 'error', 'Escribe qué quieres cambiar del código.'); return; }
      enviarCodigo({ ajuste: ajuste, codigoPrevio: data.codigo });
    });
  }

  // Los .do viejos pueden venir en Latin-1: si no es UTF-8 válido, se lee así.
  function leerArchivoComoTexto(archivo) {
    return archivo.arrayBuffer().then(function (buffer) {
      try {
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch (e) {
        return new TextDecoder('windows-1252').decode(buffer);
      }
    });
  }

  function enviarCodigo(extra) {
    extra = extra || {};
    var status = $('as-codigo-status');
    var boton = $('as-codigo-enviar');
    var modo = subModoCodigo;
    var def = MODOS_CODIGO[modo];
    var cuerpo = { modo: modo, nivel: nivelSeleccionadoDe('as-nivel-codigo') };

    if (modo === 'revisar' || modo === 'explicar') {
      var codigo = $('as-codigo-revisar-input').value.trim();
      if (!codigo) {
        mostrarEstado(status, 'error', modo === 'revisar' ? 'Pega o sube primero el do-file que quieres revisar.' : 'Pega o sube primero el do-file que quieres entender.');
        return;
      }
      cuerpo.codigo = codigo;
    } else if (modo === 'interpretar') {
      var salida = $('as-codigo-interpretar-input').value.trim();
      if (!salida) { mostrarEstado(status, 'error', 'Pega primero la salida de Stata que quieres interpretar.'); return; }
      cuerpo.salida = salida;
      var contexto = $('as-interpretar-contexto').value.trim();
      if (contexto) cuerpo.contexto = contexto;
    } else {
      var descripcion = extra.ajuste ? ultimaDescripcion : $('as-codigo-generar-input').value.trim();
      if (!descripcion) { mostrarEstado(status, 'error', 'Describe primero el análisis que quieres generar.'); return; }
      cuerpo.descripcion = descripcion;
      if (extra.ajuste) {
        cuerpo.codigo_previo = extra.codigoPrevio;
        cuerpo.ajuste = extra.ajuste;
      }
    }

    Object.keys(MODOS_CODIGO).forEach(function (m) { $(MODOS_CODIGO[m].resultado).classList.add('campo-oculto'); });
    boton.disabled = true;
    var frases = extra.ajuste ? ['Leyendo tu código…', 'Aplicando el ajuste…', 'Reescribiendo el do-file…'] : def.frases;
    var detener = iniciarEspera(status, frases, def.largo);
    pedirJson('/api/asesor-stata-codigo', cuerpo, 90000)
      .then(function (r) {
        detener();
        boton.disabled = false;
        if (!r.ok || r.data.error) { mostrarEstado(status, 'error', r.data.error || 'No se pudo procesar el pedido.'); return; }
        mostrarEstado(status, '', '');
        if (modo === 'revisar') renderHallazgos(r.data.hallazgos);
        else if (modo === 'explicar') renderExplicacion(r.data);
        else if (modo === 'interpretar') renderInterpretacion(r.data);
        else { ultimaDescripcion = cuerpo.descripcion; renderCodigoGenerado(r.data); }
        $(def.resultado).scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(function (e) {
        detener();
        boton.disabled = false;
        mostrarEstado(status, 'error', mensajeDeFallo(e));
      });
  }

  function aplicarNivelGuardado() {
    var nivel = leerGuardado(CLAVE_NIVEL);
    if (nivel !== 'basico' && nivel !== 'intermedio' && nivel !== 'avanzado') return;
    ['as-nivel', 'as-nivel-codigo'].forEach(function (grupo) {
      var opciones = document.getElementsByName(grupo);
      for (var i = 0; i < opciones.length; i++) opciones[i].checked = opciones[i].value === nivel;
    });
  }

  function recordarNivel() {
    ['as-nivel', 'as-nivel-codigo'].forEach(function (grupo) {
      var opciones = document.getElementsByName(grupo);
      for (var i = 0; i < opciones.length; i++) {
        opciones[i].addEventListener('change', function (e) {
          escribirGuardado(CLAVE_NIVEL, e.target.value);
          var otro = grupo === 'as-nivel' ? 'as-nivel-codigo' : 'as-nivel';
          var otras = document.getElementsByName(otro);
          for (var j = 0; j < otras.length; j++) otras[j].checked = otras[j].value === e.target.value;
        });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    TABS.forEach(function (t) {
      $('as-tab-' + t).addEventListener('click', function () {
        // Con una nota abierta, cualquier pestaña la cierra: la de origen equivale
        // a «Volver» (recupera el scroll); otra lleva a esa pestaña.
        if (notaAbierta) {
          limpiarHash();
          if (t !== tabAnterior) { tabAnterior = t; scrollIndice = 0; }
          cerrarNota();
          return;
        }
        mostrarTab(t);
      });
    });
    $('as-nota-volver').addEventListener('click', function () { limpiarHash(); cerrarNota(); });
    var botonEnlace = $('as-nota-enlace');
    botonEnlace.addEventListener('click', function () { copiarTexto(window.location.href, botonEnlace, 'Copiar enlace'); });
    window.addEventListener('hashchange', aplicarHash);

    $('as-filtro').addEventListener('input', function () { if (indiceGlobal) pintarIndice(); });
    $('as-filtro-radar').addEventListener('input', function () { if (indiceRadar) pintarRadar(true); });

    Object.keys(MODOS_CODIGO).forEach(function (m) {
      $('as-subtab-' + m).addEventListener('click', function () { mostrarSubModoCodigo(m); });
    });
    $('as-codigo-form').addEventListener('submit', function (e) { e.preventDefault(); enviarCodigo(); });

    enlazarContador('as-codigo-revisar-input', 'as-codigo-revisar-contador', MAX_CODIGO,
      'solo se usarán los primeros ' + MAX_CODIGO.toLocaleString('es-PE') + '.');
    enlazarContador('as-codigo-generar-input', 'as-codigo-generar-contador', MAX_DESCRIPCION, 'se recortará.');
    enlazarContador('as-codigo-interpretar-input', 'as-codigo-interpretar-contador', MAX_SALIDA,
      'solo se usarán los primeros ' + MAX_SALIDA.toLocaleString('es-PE') + '.');

    $('as-interpretar-ejemplo').addEventListener('click', function () {
      var area = $('as-codigo-interpretar-input');
      area.value = EJEMPLO_SALIDA;
      area.dispatchEvent(new Event('input'));
      $('as-interpretar-contexto').value = 'Bajo peso al nacer (low) según si la madre fumó (smoke)';
      area.focus();
    });

    // Formulario guiado de «Generar»: arma la descripción a partir de las respuestas.
    $('as-guia-armar').addEventListener('click', function () {
      var salidas = [];
      document.querySelectorAll('input[name="as-guia-salida"]:checked').forEach(function (c) { salidas.push(c.value); });
      var descripcion = armarDescripcionGuiada({
        estudio: $('as-guia-estudio').value,
        resultado: $('as-guia-resultado').value,
        tipoResultado: $('as-guia-resultado').value.trim() ? $('as-guia-tipo').value : '',
        explicativas: $('as-guia-explicativas').value,
        grupos: $('as-guia-grupos').value,
        salidas: salidas,
      });
      if (!descripcion) { mostrarEstado($('as-codigo-status'), 'error', 'Completa al menos un campo del formulario para armar la descripción.'); return; }
      mostrarEstado($('as-codigo-status'), '', '');
      var area = $('as-codigo-generar-input');
      area.value = descripcion;
      area.dispatchEvent(new Event('input'));
      area.focus();
    });
    enlazarContador('as-buscar-input', 'as-buscar-contador', MAX_PREGUNTA, 'se recortará.');

    $('as-codigo-subir').addEventListener('click', function () { $('as-codigo-archivo').click(); });
    $('as-codigo-archivo').addEventListener('change', function (e) {
      var archivo = e.target.files && e.target.files[0];
      if (!archivo) return;
      var status = $('as-codigo-status');
      if (archivo.size > 500000) { mostrarEstado(status, 'error', 'Ese archivo es demasiado grande para un do-file (más de 500 KB).'); e.target.value = ''; return; }
      leerArchivoComoTexto(archivo).then(function (texto) {
        var area = $('as-codigo-revisar-input');
        area.value = texto;
        area.dispatchEvent(new Event('input'));
        mostrarEstado(status, '', '');
        e.target.value = '';
      }).catch(function () { mostrarEstado(status, 'error', 'No se pudo leer el archivo.'); });
    });
    $('as-codigo-ejemplo').addEventListener('click', function () {
      var area = $('as-codigo-revisar-input');
      area.value = EJEMPLO_DO;
      area.dispatchEvent(new Event('input'));
      area.focus();
    });

    document.querySelectorAll('[data-ejemplo]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var destino = $(btn.getAttribute('data-destino'));
        destino.value = btn.getAttribute('data-ejemplo');
        destino.dispatchEvent(new Event('input'));
        destino.focus();
      });
    });

    aplicarNivelGuardado();
    recordarNivel();
    cargarIndice();

    $('as-buscar-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var pregunta = $('as-buscar-input').value.trim();
      if (!pregunta) { mostrarEstado($('as-buscar-status'), 'error', 'Escribe primero tu pregunta.'); return; }
      enviarConsulta(pregunta);
    });
  });
})();
