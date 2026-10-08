/* asesor-stata.js — cliente de la página asesor-stata.html: consume
 * api/asesor-stata-base.js (Explorar), api/asesor-stata-consulta.js (Buscar)
 * y api/asesor-stata-codigo.js (Código). Sin dependencias -- conversor
 * Markdown propio, chico, escrito para el formato fijo que siguen las notas de
 * knowledge/ (frontmatter YAML + ## headings + listas + negritas + `código`). */
(function () {
  'use strict';

  function escapeHtml(texto) {
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatearInline(seguro) {
    return seguro
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*([^*\s](?:[^*]*[^*\s])?)\*(?![*\w])/g, '$1<em>$2</em>');
  }

  // `código` se muestra como <code> sin tocar su contenido; el resto admite
  // **negrita** y *cursiva*. Un acento grave sin cerrar queda como texto.
  function inlineMarkdown(texto) {
    var partes = texto.split('`');
    var html = '';
    for (var i = 0; i < partes.length; i++) {
      var seguro = escapeHtml(partes[i]);
      if (i % 2 === 1 && i < partes.length - 1) {
        html += '<code>' + seguro + '</code>';
      } else if (i % 2 === 1) {
        html += '`' + formatearInline(seguro);
      } else {
        html += formatearInline(seguro);
      }
    }
    return html;
  }

  function parsearFrontmatter(markdown) {
    var lineas = markdown.split('\n');
    if (lineas[0] !== '---') {
      return { meta: {}, cuerpo: markdown };
    }
    var fin = -1;
    for (var i = 1; i < lineas.length; i++) {
      if (lineas[i] === '---') { fin = i; break; }
    }
    if (fin === -1) {
      return { meta: {}, cuerpo: markdown };
    }
    var meta = {};
    for (var j = 1; j < fin; j++) {
      var linea = lineas[j];
      var sep = linea.indexOf(':');
      if (sep === -1) continue;
      var clave = linea.slice(0, sep).trim();
      var valor = linea.slice(sep + 1).trim();
      if (valor.charAt(0) === '[' && valor.charAt(valor.length - 1) === ']') {
        valor = valor.slice(1, -1).split(',').map(function (v) { return v.trim(); }).filter(Boolean);
      } else if (valor.length >= 2 && (valor.charAt(0) === '"' || valor.charAt(0) === "'") &&
                 valor.charAt(valor.length - 1) === valor.charAt(0)) {
        valor = valor.slice(1, -1);
      }
      meta[clave] = valor;
    }
    var cuerpo = lineas.slice(fin + 1).join('\n').replace(/^\n+/, '');
    return { meta: meta, cuerpo: cuerpo };
  }

  function cuerpoMarkdownAHtml(cuerpo) {
    var lineas = cuerpo.split('\n');
    var html = [];
    var items = null;
    var parrafoActual = null;

    function flushLista() {
      if (!items) return;
      html.push('<ul>' + items.map(function (it) {
        var subs = it.subs.length
          ? '<ul>' + it.subs.map(function (s) { return '<li>' + inlineMarkdown(s) + '</li>'; }).join('') + '</ul>'
          : '';
        return '<li>' + inlineMarkdown(it.texto) + subs + '</li>';
      }).join('') + '</ul>');
      items = null;
    }
    function flushParrafo() {
      if (parrafoActual) { html.push('<p>' + parrafoActual.join(' ') + '</p>'); parrafoActual = null; }
    }

    for (var i = 0; i < lineas.length; i++) {
      var linea = lineas[i].replace(/\s+$/, '');
      if (linea.trim() === '') { flushLista(); flushParrafo(); continue; }

      var encabezado = linea.match(/^##\s+(.+)$/);
      if (encabezado) {
        flushLista(); flushParrafo();
        html.push('<h2>' + inlineMarkdown(encabezado[1]) + '</h2>');
        continue;
      }

      var sub = linea.match(/^\s{2,}-\s+(.+)$/);
      if (sub && items) {
        items[items.length - 1].subs.push(sub[1]);
        continue;
      }

      var item = linea.match(/^-\s+(.+)$/);
      if (item) {
        flushParrafo();
        if (!items) items = [];
        items.push({ texto: item[1], subs: [] });
        continue;
      }

      // Línea con sangría dentro de una lista: sigue el ítem anterior.
      if (items && /^\s{2,}\S/.test(linea)) {
        var ultimo = items[items.length - 1];
        if (ultimo.subs.length) ultimo.subs[ultimo.subs.length - 1] += ' ' + linea.trim();
        else ultimo.texto += ' ' + linea.trim();
        continue;
      }

      flushLista();
      if (!parrafoActual) parrafoActual = [];
      parrafoActual.push(inlineMarkdown(linea.trim()));
    }
    flushLista();
    flushParrafo();
    return html.join('\n');
  }

  var TEMAS_ES = {
    'stata-basics': 'Primeros pasos en Stata',
    'data-management': 'Manejo de datos',
    'descriptive-stats': 'Estadística descriptiva',
    'hypothesis-testing': 'Pruebas de hipótesis',
    'regression': 'Regresión',
    'tables-output': 'Tablas y reportes',
    'graphics': 'Gráficos',
    'programming': 'Programación en Stata',
    'panel-data': 'Datos de panel',
    'survival-analysis': 'Análisis de supervivencia',
    'sampling': 'Muestreo',
    'simulation': 'Simulación',
    'causal-inference': 'Inferencia causal',
    'reproducibility': 'Reproducibilidad',
    'power-analysis': 'Poder y tamaño de muestra',
    'dashboards-interactivos': 'Dashboards interactivos',
    'seguimiento-de-cohortes': 'Seguimiento de cohortes',
  };

  function nombreTema(slug) {
    if (TEMAS_ES[slug]) return TEMAS_ES[slug];
    var t = String(slug).replace(/-/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function normalizarTexto(texto) {
    return String(texto || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/-/g, ' ');
  }

  // Formas en que se teclea una b\u00fasqueda y que el texto de las notas escribe distinto.
  var ALIAS_BUSQUEDA = { chi2: 'chi cuadrado' };

  // Filtra el índice por palabras (todas deben aparecer en título, resumen o
  // nombre del tema) y descarta los temas que quedan sin notas.
  function filtrarIndice(indice, texto) {
    var palabras = normalizarTexto(texto).split(/\s+/).filter(Boolean);
    var resultado = [];
    indice.temas.forEach(function (tema) {
      var notas = tema.notas.filter(function (n) {
        if (!palabras.length) return true;
        var pajar = normalizarTexto(n.titulo + ' ' + n.resumen + ' ' + nombreTema(tema.nombre));
        return palabras.every(function (p) {
          return pajar.indexOf(p) !== -1 || (ALIAS_BUSQUEDA[p] && pajar.indexOf(ALIAS_BUSQUEDA[p]) !== -1);
        });
      });
      if (notas.length) resultado.push({ slug: tema.nombre, nombre: nombreTema(tema.nombre), notas: notas });
    });
    return resultado;
  }

  var FUENTES = {
    libro: 'Libro',
    SSC: 'Módulo SSC',
    arXiv: 'Artículo (arXiv)',
    'stata-journal': 'Stata Journal',
    literatura: 'Literatura',
  };

  function etiquetaFuente(source) {
    return FUENTES[source] || source;
  }

  var API = {
    parsearFrontmatter: parsearFrontmatter,
    cuerpoMarkdownAHtml: cuerpoMarkdownAHtml,
    nombreTema: nombreTema,
    normalizarTexto: normalizarTexto,
    filtrarIndice: filtrarIndice,
    etiquetaFuente: etiquetaFuente,
  };

  if (typeof window === 'undefined') {
    if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
    return; // el resto de este archivo maneja el DOM -- no aplica fuera del navegador
  }

  window.AsesorStata = API;

  // ---------------------------------------------------------------- interfaz

  function $(id) { return document.getElementById(id); }

  // Deben coincidir con los límites de los endpoints en api/.
  var MAX_CODIGO = 20000;
  var MAX_DESCRIPCION = 1000;
  var MAX_PREGUNTA = 500;
  var DIAS_NOVEDADES = 30;
  var NOVEDADES_VISIBLES = 10;
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
  var indiceGlobal = null;
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

  function copiarTexto(texto, boton, etiqueta) {
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
      if (ok) listo();
      else boton.textContent = 'No se pudo copiar: selecciona y usa Ctrl+C';
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

  function mostrarTab(nombre) {
    tabActual = nombre;
    ['explorar', 'buscar', 'novedades', 'codigo'].forEach(function (t) {
      var activa = t === nombre;
      $('as-tab-' + t).classList.toggle('activo', activa);
      $('as-tab-' + t).setAttribute('aria-selected', activa ? 'true' : 'false');
      $('as-' + t + '-panel').classList.toggle('campo-oculto', !activa);
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
      cont.innerHTML = '<p class="vacio">La base de conocimiento todavía no tiene notas guardadas.</p>';
      conteo.textContent = '';
      return;
    }
    conteo.textContent = texto
      ? total + ' de ' + totalGeneral + ' notas'
      : totalGeneral + ' notas en ' + temas.length + ' temas';

    if (!temas.length) {
      var vacio = document.createElement('div');
      vacio.className = 'vacio';
      vacio.innerHTML = '<p></p><button type="button" class="subtab">Preguntar esto en Buscar</button>';
      vacio.querySelector('p').textContent = 'Ninguna nota coincide con «' + texto + '». Prueba con otra palabra, o pregúntalo directamente.';
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
    mostrarTab('explorar');
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
    cont.querySelector('.nota-cuerpo').innerHTML = cuerpoMarkdownAHtml(parsed.cuerpo);

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

  // -------------------------------------------------------------- Novedades

  function notasRecientes(indice) {
    var limite = Date.now() - DIAS_NOVEDADES * 24 * 60 * 60 * 1000;
    var recientes = [];
    indice.temas.forEach(function (tema) {
      tema.notas.forEach(function (nota) {
        if (!nota.fecha) return;
        var t = Date.parse(nota.fecha);
        if (!isNaN(t) && t >= limite) {
          recientes.push({ titulo: nota.titulo, path: nota.path, resumen: nota.resumen, fecha: nota.fecha, tema: nombreTema(tema.nombre) });
        }
      });
    });
    recientes.sort(function (a, b) { return b.fecha < a.fecha ? -1 : b.fecha > a.fecha ? 1 : 0; });
    return recientes;
  }

  function renderNovedades(indice) {
    var cont = $('as-novedades');
    var recientes = notasRecientes(indice);
    cont.innerHTML = '';
    if (!recientes.length) {
      cont.innerHTML = '<p class="vacio">No hay notas nuevas en los últimos ' + DIAS_NOVEDADES + ' días.</p>';
      return;
    }
    function tarjeta(nota) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ncard';
      btn.innerHTML = '<div class="ntitulo"></div><div class="nresumen"></div><div class="nfecha"></div>';
      btn.querySelector('.ntitulo').textContent = nota.titulo;
      btn.querySelector('.nresumen').textContent = nota.resumen;
      btn.querySelector('.nfecha').textContent = nota.tema + ' · ' + nota.fecha;
      btn.addEventListener('click', function () { verNota(nota.path); });
      return btn;
    }
    recientes.slice(0, NOVEDADES_VISIBLES).forEach(function (n) { cont.appendChild(tarjeta(n)); });
    if (recientes.length > NOVEDADES_VISIBLES) {
      var mas = document.createElement('button');
      mas.type = 'button';
      mas.className = 'subtab';
      mas.textContent = 'Mostrar las ' + (recientes.length - NOVEDADES_VISIBLES) + ' restantes';
      mas.addEventListener('click', function () {
        recientes.slice(NOVEDADES_VISIBLES).forEach(function (n) { cont.insertBefore(tarjeta(n), mas); });
        cont.removeChild(mas);
      });
      cont.appendChild(mas);
    }
  }

  function cargarIndice() {
    function fallo(mensaje) {
      var html = '<p class="vacio"></p>';
      ['as-indice', 'as-novedades'].forEach(function (id) {
        $(id).innerHTML = html;
        $(id).firstChild.textContent = mensaje;
      });
    }
    fetch('/api/asesor-stata-base')
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (!r.ok) { fallo(r.data.error || 'No se pudo cargar el índice.'); return; }
        indiceGlobal = r.data;
        pintarIndice();
        renderNovedades(r.data);
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

  function mostrarSubModoCodigo(modo) {
    subModoCodigo = modo;
    $('as-subtab-revisar').classList.toggle('activo', modo === 'revisar');
    $('as-subtab-generar').classList.toggle('activo', modo === 'generar');
    $('as-bloque-revisar').classList.toggle('campo-oculto', modo !== 'revisar');
    $('as-bloque-generar').classList.toggle('campo-oculto', modo !== 'generar');
    $('as-codigo-enviar').textContent = modo === 'revisar' ? 'Revisar' : 'Generar';
    $('as-codigo-hallazgos').classList.add('campo-oculto');
    $('as-codigo-generado').classList.add('campo-oculto');
    mostrarEstado($('as-codigo-status'), '', '');
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
    cont.innerHTML = '<div class="hallazgos-resumen"></div>';
    cont.firstChild.textContent = ordenados.length + (ordenados.length === 1 ? ' hallazgo' : ' hallazgos') +
      ' · ' + importantes + (importantes === 1 ? ' importante' : ' importantes') +
      ' · ' + (ordenados.length - importantes) + (ordenados.length - importantes === 1 ? ' sugerencia' : ' sugerencias');
    ordenados.forEach(function (h) {
      var div = document.createElement('div');
      div.className = 'hallazgo ' + (h.severidad === 'importante' ? 'importante' : 'sugerencia');
      div.innerHTML = '<div class="h-severidad"></div><div class="h-que"></div>' +
        '<div class="h-detalle"><b>Por qué:</b> <span class="h-porque"></span></div>' +
        '<div class="h-detalle"><b>Cómo arreglarlo:</b> <span class="h-arreglo"></span></div>' +
        '<div class="h-nota campo-oculto"><a href="#"></a></div>';
      div.querySelector('.h-severidad').textContent = h.severidad === 'importante' ? 'Importante' : 'Sugerencia';
      // inlineMarkdown escapa el HTML: solo agrega <code>, <strong> y <em>.
      div.querySelector('.h-que').innerHTML = inlineMarkdown(h.que);
      div.querySelector('.h-porque').innerHTML = inlineMarkdown(h.por_que);
      div.querySelector('.h-arreglo').innerHTML = inlineMarkdown(h.como_arreglar);
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

  function descargarComoDo(codigo) {
    var blob = new Blob([codigo], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'analisis.do';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function renderCodigoGenerado(data) {
    var cont = $('as-codigo-generado');
    cont.classList.remove('campo-oculto');
    cont.innerHTML = '<pre></pre><button type="button" class="copiar">Copiar</button>' +
      '<button type="button" class="copiar descargar">Descargar .do</button><div class="explicacion"></div>';
    cont.querySelector('pre').textContent = data.codigo;
    cont.querySelector('.explicacion').textContent = data.explicacion;
    var botonCopiar = cont.querySelector('button.copiar:not(.descargar)');
    botonCopiar.addEventListener('click', function () { copiarTexto(data.codigo, botonCopiar, 'Copiar'); });
    cont.querySelector('button.descargar').addEventListener('click', function () {
      descargarComoDo(data.codigo);
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

  function enviarCodigo() {
    var status = $('as-codigo-status');
    var boton = $('as-codigo-enviar');
    $('as-codigo-hallazgos').classList.add('campo-oculto');
    $('as-codigo-generado').classList.add('campo-oculto');
    var cuerpo = { modo: subModoCodigo, nivel: nivelSeleccionadoDe('as-nivel-codigo') };
    var frases;
    if (subModoCodigo === 'revisar') {
      var codigo = $('as-codigo-revisar-input').value.trim();
      if (!codigo) { mostrarEstado(status, 'error', 'Pega o sube primero el do-file que quieres revisar.'); return; }
      cuerpo.codigo = codigo;
      frases = ['Leyendo tu código…', 'Buscando notas relacionadas en la base…', 'Redactando los hallazgos…', 'Ordenando los hallazgos…'];
    } else {
      var descripcion = $('as-codigo-generar-input').value.trim();
      if (!descripcion) { mostrarEstado(status, 'error', 'Describe primero el análisis que quieres generar.'); return; }
      cuerpo.descripcion = descripcion;
      frases = ['Entendiendo tu pedido…', 'Buscando notas relacionadas…', 'Escribiendo el do-file…'];
    }
    boton.disabled = true;
    var detener = iniciarEspera(status, frases, subModoCodigo === 'revisar');
    var modoEnviado = subModoCodigo;
    pedirJson('/api/asesor-stata-codigo', cuerpo, 90000)
      .then(function (r) {
        detener();
        boton.disabled = false;
        if (!r.ok || r.data.error) { mostrarEstado(status, 'error', r.data.error || 'No se pudo procesar el pedido.'); return; }
        mostrarEstado(status, '', '');
        if (modoEnviado === 'revisar') { renderHallazgos(r.data.hallazgos); }
        else { renderCodigoGenerado(r.data); }
        var destino = modoEnviado === 'revisar' ? $('as-codigo-hallazgos') : $('as-codigo-generado');
        destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    ['explorar', 'buscar', 'novedades', 'codigo'].forEach(function (t) {
      $('as-tab-' + t).addEventListener('click', function () {
        if (t === 'explorar' && notaAbierta) { limpiarHash(); tabAnterior = 'explorar'; scrollIndice = 0; cerrarNota(); return; }
        mostrarTab(t);
      });
    });
    $('as-nota-volver').addEventListener('click', function () { limpiarHash(); cerrarNota(); });
    var botonEnlace = $('as-nota-enlace');
    botonEnlace.addEventListener('click', function () { copiarTexto(window.location.href, botonEnlace, 'Copiar enlace'); });
    window.addEventListener('hashchange', aplicarHash);

    $('as-filtro').addEventListener('input', function () { if (indiceGlobal) pintarIndice(); });

    $('as-subtab-revisar').addEventListener('click', function () { mostrarSubModoCodigo('revisar'); });
    $('as-subtab-generar').addEventListener('click', function () { mostrarSubModoCodigo('generar'); });
    $('as-codigo-form').addEventListener('submit', function (e) { e.preventDefault(); enviarCodigo(); });

    enlazarContador('as-codigo-revisar-input', 'as-codigo-revisar-contador', MAX_CODIGO,
      'solo se revisarán los primeros ' + MAX_CODIGO.toLocaleString('es-PE') + '.');
    enlazarContador('as-codigo-generar-input', 'as-codigo-generar-contador', MAX_DESCRIPCION, 'se recortará.');
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
