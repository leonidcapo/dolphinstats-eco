/* asesor-stata.js — cliente de la página asesor-stata.html: consume
 * api/asesor-stata-base.js (Explorar) y api/asesor-stata-consulta.js
 * (Buscar). Sin dependencias -- conversor Markdown propio, chico, escrito
 * para el formato fijo que siguen las notas de knowledge/ (frontmatter YAML
 * + ## headings + listas + negritas). */
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

  function inlineMarkdown(texto) {
    return escapeHtml(texto).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
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
      }
      meta[clave] = valor;
    }
    var cuerpo = lineas.slice(fin + 1).join('\n').replace(/^\n+/, '');
    return { meta: meta, cuerpo: cuerpo };
  }

  function cuerpoMarkdownAHtml(cuerpo) {
    var lineas = cuerpo.split('\n');
    var html = [];
    var listaActual = null;
    var parrafoActual = null;

    function flushLista() {
      if (listaActual) { html.push('<ul>' + listaActual.join('') + '</ul>'); listaActual = null; }
    }
    function flushParrafo() {
      if (parrafoActual) { html.push('<p>' + parrafoActual.join(' ') + '</p>'); parrafoActual = null; }
    }

    for (var i = 0; i < lineas.length; i++) {
      var linea = lineas[i];
      if (linea.trim() === '') { flushLista(); flushParrafo(); continue; }

      var encabezado = linea.match(/^##\s+(.+)$/);
      if (encabezado) {
        flushLista(); flushParrafo();
        html.push('<h2>' + inlineMarkdown(encabezado[1]) + '</h2>');
        continue;
      }

      var item = linea.match(/^-\s+(.+)$/);
      if (item) {
        flushParrafo();
        if (!listaActual) listaActual = [];
        listaActual.push('<li>' + inlineMarkdown(item[1]) + '</li>');
        continue;
      }

      flushLista();
      if (!parrafoActual) parrafoActual = [];
      parrafoActual.push(inlineMarkdown(linea));
    }
    flushLista();
    flushParrafo();
    return html.join('\n');
  }

  var API = {
    parsearFrontmatter: parsearFrontmatter,
    cuerpoMarkdownAHtml: cuerpoMarkdownAHtml,
  };

  if (typeof window === 'undefined') {
    if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
    return; // el resto de este archivo maneja el DOM -- no aplica fuera del navegador
  }

  window.AsesorStata = API;

  function $(id) { return document.getElementById(id); }

  var DIAS_NOVEDADES = 30;

  function mostrarTab(nombre) {
    $('as-tab-explorar').classList.toggle('activo', nombre === 'explorar');
    $('as-tab-buscar').classList.toggle('activo', nombre === 'buscar');
    $('as-tab-novedades').classList.toggle('activo', nombre === 'novedades');
    $('as-explorar-panel').classList.toggle('campo-oculto', nombre !== 'explorar');
    $('as-buscar-panel').classList.toggle('campo-oculto', nombre !== 'buscar');
    $('as-novedades-panel').classList.toggle('campo-oculto', nombre !== 'novedades');
  }

  function renderIndice(indice) {
    var cont = $('as-indice');
    cont.innerHTML = '';
    if (!indice.temas.length) {
      cont.innerHTML = '<p class="vacio">La base de conocimiento todavía no tiene notas guardadas.</p>';
      return;
    }
    indice.temas.forEach(function (tema) {
      var titulo = document.createElement('div');
      titulo.className = 'tema-titulo';
      titulo.textContent = tema.nombre;
      cont.appendChild(titulo);

      if (!tema.notas.length) {
        var vacio = document.createElement('p');
        vacio.className = 'vacio';
        vacio.textContent = 'Sin notas todavía.';
        cont.appendChild(vacio);
        return;
      }

      tema.notas.forEach(function (nota) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ncard';
        btn.innerHTML = '<div class="ntitulo"></div><div class="nresumen"></div>';
        btn.querySelector('.ntitulo').textContent = nota.titulo;
        btn.querySelector('.nresumen').textContent = nota.resumen;
        btn.addEventListener('click', function () { verNota(nota.path); });
        cont.appendChild(btn);
      });
    });
  }

  function verNota(path) {
    var vista = $('as-nota-vista');
    vista.classList.remove('campo-oculto');
    vista.innerHTML = '<p class="vacio">Cargando…</p>';
    vista.scrollIntoView({ behavior: 'smooth', block: 'start' });
    fetch('/api/asesor-stata-base?nota=' + encodeURIComponent(path))
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (!r.ok) { vista.innerHTML = '<p class="vacio">' + escapeHtml(r.data.error || 'No se pudo cargar la nota.') + '</p>'; return; }
        var parsed = parsearFrontmatter(r.data.markdown);
        var titulo = parsed.meta.title || path;
        vista.innerHTML = '<h2 style="margin-top:0">' + escapeHtml(titulo) + '</h2>' + cuerpoMarkdownAHtml(parsed.cuerpo);
      })
      .catch(function () { vista.innerHTML = '<p class="vacio">No se pudo cargar la nota. Intenta de nuevo.</p>'; });
  }

  function notasRecientes(indice) {
    var limite = Date.now() - DIAS_NOVEDADES * 24 * 60 * 60 * 1000;
    var recientes = [];
    indice.temas.forEach(function (tema) {
      tema.notas.forEach(function (nota) {
        if (!nota.fecha) return;
        var t = Date.parse(nota.fecha);
        if (!isNaN(t) && t >= limite) {
          recientes.push({ titulo: nota.titulo, path: nota.path, resumen: nota.resumen, fecha: nota.fecha, tema: tema.nombre });
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
    recientes.forEach(function (nota) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ncard';
      btn.innerHTML = '<div class="ntitulo"></div><div class="nresumen"></div><div class="nfecha"></div>';
      btn.querySelector('.ntitulo').textContent = nota.titulo;
      btn.querySelector('.nresumen').textContent = nota.resumen;
      btn.querySelector('.nfecha').textContent = nota.tema + ' · ' + nota.fecha;
      btn.addEventListener('click', function () { mostrarTab('explorar'); verNota(nota.path); });
      cont.appendChild(btn);
    });
  }

  function cargarIndice() {
    fetch('/api/asesor-stata-base')
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (!r.ok) {
          var msg = '<p class="vacio">' + escapeHtml(r.data.error || 'No se pudo cargar el índice.') + '</p>';
          $('as-indice').innerHTML = msg;
          $('as-novedades').innerHTML = msg;
          return;
        }
        renderIndice(r.data);
        renderNovedades(r.data);
      })
      .catch(function () {
        var msg = '<p class="vacio">No se pudo cargar el índice. Intenta de nuevo.</p>';
        $('as-indice').innerHTML = msg;
        $('as-novedades').innerHTML = msg;
      });
  }

  function renderResultadoBusqueda(data) {
    var cont = $('as-buscar-resultado');
    cont.classList.remove('campo-oculto');
    var html = '<div class="respuesta">' + escapeHtml(data.respuesta) + '</div>';
    if (data.notas_citadas.length) {
      html += '<div class="citas">';
      data.notas_citadas.forEach(function (nota) {
        html += '<a href="#" data-path="' + escapeHtml(nota.path) + '">' + escapeHtml(nota.titulo) + '</a>';
      });
      html += '</div>';
    }
    cont.innerHTML = html;
    cont.querySelectorAll('.citas a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        mostrarTab('explorar');
        verNota(a.getAttribute('data-path'));
      });
    });
  }

  function nivelSeleccionado() {
    var opciones = document.getElementsByName('as-nivel');
    for (var i = 0; i < opciones.length; i++) {
      if (opciones[i].checked) return opciones[i].value;
    }
    return 'intermedio';
  }

  function enviarConsulta(pregunta) {
    var status = $('as-buscar-status');
    var resultado = $('as-buscar-resultado');
    status.textContent = 'Consultando…';
    resultado.classList.add('campo-oculto');
    fetch('/api/asesor-stata-consulta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pregunta: pregunta, nivel: nivelSeleccionado() }),
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (!r.ok) { status.textContent = r.data.error || 'No se pudo responder la consulta.'; return; }
        status.textContent = '';
        renderResultadoBusqueda(r.data);
      })
      .catch(function () { status.textContent = 'No se pudo responder la consulta. Intenta de nuevo.'; });
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('as-tab-explorar').addEventListener('click', function () { mostrarTab('explorar'); });
    $('as-tab-buscar').addEventListener('click', function () { mostrarTab('buscar'); });
    $('as-tab-novedades').addEventListener('click', function () { mostrarTab('novedades'); });
    cargarIndice();

    $('as-buscar-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var pregunta = $('as-buscar-input').value.trim();
      if (!pregunta) return;
      enviarConsulta(pregunta);
    });
  });
})();
