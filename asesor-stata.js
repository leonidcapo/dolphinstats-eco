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
      .replace(/>/g, '&gt;');
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

  function mostrarTab(nombre) {
    var esExplorar = nombre === 'explorar';
    $('as-tab-explorar').classList.toggle('activo', esExplorar);
    $('as-tab-buscar').classList.toggle('activo', !esExplorar);
    $('as-explorar-panel').classList.toggle('campo-oculto', !esExplorar);
    $('as-buscar-panel').classList.toggle('campo-oculto', esExplorar);
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

  function cargarIndice() {
    fetch('/api/asesor-stata-base')
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (!r.ok) { $('as-indice').innerHTML = '<p class="vacio">' + escapeHtml(r.data.error || 'No se pudo cargar el índice.') + '</p>'; return; }
        renderIndice(r.data);
      })
      .catch(function () { $('as-indice').innerHTML = '<p class="vacio">No se pudo cargar el índice. Intenta de nuevo.</p>'; });
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

  function enviarConsulta(pregunta) {
    var status = $('as-buscar-status');
    var resultado = $('as-buscar-resultado');
    status.textContent = 'Consultando…';
    resultado.classList.add('campo-oculto');
    fetch('/api/asesor-stata-consulta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pregunta: pregunta }),
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
    cargarIndice();

    $('as-buscar-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var pregunta = $('as-buscar-input').value.trim();
      if (!pregunta) return;
      enviarConsulta(pregunta);
    });
  });
})();
