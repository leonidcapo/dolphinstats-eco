/* asesor-stata-nucleo.js — funciones puras de Asesor Stata (sin DOM): conversor de Markdown,
 * índice, filtros, informe y descripción guiada. Se carga antes que la interfaz y se prueba con node. */
(function (raiz) {
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
    var bloque = null; // líneas de un bloque ``` abierto

    function renderBloque(lineasBloque) {
      return '<pre class="bloque-codigo"><code>' + escapeHtml(lineasBloque.join('\n')) + '</code></pre>';
    }

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
      var cruda = lineas[i].replace(/\r$/, '');
      if (bloque) {
        if (cruda.trim() === '```') { html.push(renderBloque(bloque)); bloque = null; }
        else bloque.push(cruda);
        continue;
      }
      if (/^```[A-Za-z0-9_-]*$/.test(cruda.trim())) {
        flushLista(); flushParrafo();
        bloque = [];
        continue;
      }
      var linea = cruda.replace(/\s+$/, '');
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
    if (bloque) html.push(renderBloque(bloque)); // bloque sin cerrar: el resto es código
    return html.join('\n');
  }

  // Separa la sección «Relevancia para DolphinStats» (notas internas del equipo)
  // del resto de la nota, para mostrarla plegada al final.
  function separarNotaInterna(cuerpo) {
    var m = cuerpo.match(/^##\s+Relevancia para DolphinStats\s*$/m);
    if (!m) return { principal: cuerpo, interna: '' };
    return {
      principal: cuerpo.slice(0, m.index).replace(/\s+$/, ''),
      interna: cuerpo.slice(m.index + m[0].length).replace(/^\s+/, ''),
    };
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
        var pajar = normalizarTexto(n.titulo + ' ' + n.resumen + ' ' + (n.simple || '') + ' ' + nombreTema(tema.nombre));
        return palabras.every(function (p) {
          return pajar.indexOf(p) !== -1 || (ALIAS_BUSQUEDA[p] && pajar.indexOf(ALIAS_BUSQUEDA[p]) !== -1);
        });
      });
      if (notas.length) resultado.push({ slug: tema.nombre, nombre: nombreTema(tema.nombre), notas: notas });
    });
    return resultado;
  }

  // Guías = notas escritas a mano; Radar = notas que agrega el monitoreo
  // semanal (marcadas con `auto` en INDEX.md). Los temas que quedan vacíos se omiten.
  function separarPorOrigen(indice) {
    function parte(esAuto) {
      return {
        temas: indice.temas
          .map(function (t) {
            return { nombre: t.nombre, notas: t.notas.filter(function (n) { return !!n.auto === esAuto; }) };
          })
          .filter(function (t) { return t.notas.length > 0; }),
      };
    }
    return { guias: parte(false), radar: parte(true) };
  }

  // Lista plana del Radar (filtrada por palabras): lo más reciente primero y,
  // a igual fecha, en el orden del índice; sin fecha va al final.
  function listarRadar(radar, texto) {
    var plano = [];
    filtrarIndice(radar, texto).forEach(function (tema) {
      tema.notas.forEach(function (n) {
        plano.push({ titulo: n.titulo, path: n.path, resumen: n.resumen, simple: n.simple || '', fecha: n.fecha, tema: tema.nombre, orden: plano.length });
      });
    });
    plano.sort(function (a, b) {
      var fa = a.fecha || '';
      var fb = b.fecha || '';
      if (fa !== fb) return fa < fb ? 1 : -1;
      return a.orden - b.orden;
    });
    return plano;
  }

  function etiquetaLineas(lineas) {
    if (!lineas) return '';
    return (String(lineas).indexOf('-') !== -1 ? 'Líneas ' : 'Línea ') + lineas;
  }

  function plural(n, singular, pluralTexto) {
    return n + ' ' + (n === 1 ? singular : pluralTexto);
  }

  // Informe en Markdown de una revisión (para descargar o copiar). Los
  // hallazgos importantes van primero, igual que en pantalla.
  function armarInformeRevision(hallazgos, fechaIso) {
    var ordenados = hallazgos.slice().sort(function (a, b) {
      return (a.severidad === 'importante' ? 0 : 1) - (b.severidad === 'importante' ? 0 : 1);
    });
    var importantes = ordenados.filter(function (h) { return h.severidad === 'importante'; }).length;
    var partes = ['# Informe de revisión de código — Asesor Stata', 'Fecha: ' + fechaIso, ''];

    if (!ordenados.length) {
      partes.push('Sin hallazgos: no se encontró nada para observar en este código.');
    } else {
      partes.push(plural(ordenados.length, 'hallazgo', 'hallazgos') + ': ' +
        plural(importantes, 'importante', 'importantes') + ', ' +
        plural(ordenados.length - importantes, 'sugerencia', 'sugerencias') + '.');
      ordenados.forEach(function (h, i) {
        partes.push('', '## ' + (i + 1) + '. ' + (h.severidad === 'importante' ? 'Importante' : 'Sugerencia') + ' — ' + h.que);
        if (h.lineas) partes.push(etiquetaLineas(h.lineas));
        partes.push('- **Por qué:** ' + h.por_que, '- **Cómo arreglarlo:** ' + h.como_arreglar);
        if (h.codigo_corregido) partes.push('', 'Código sugerido:', '', '```stata', h.codigo_corregido, '```');
        if (h.nota_citada) partes.push('', 'Nota relacionada: ' + h.nota_citada.titulo + ' (' + h.nota_citada.path + ')');
      });
    }
    partes.push('', '---', 'Informe generado con inteligencia artificial; verifica cada punto antes de aplicarlo.', '');
    return partes.join('\n');
  }

  // Convierte las respuestas del formulario guiado de «Generar» en la
  // descripción que entiende el endpoint (máx. 1000 caracteres).
  function armarDescripcionGuiada(campos) {
    function limpio(v) { return typeof v === 'string' ? v.trim() : ''; }
    var partes = [];
    var estudio = limpio(campos.estudio);
    var resultado = limpio(campos.resultado);
    var tipo = limpio(campos.tipoResultado);
    var explicativas = limpio(campos.explicativas);
    var grupos = limpio(campos.grupos);
    var salidas = (Array.isArray(campos.salidas) ? campos.salidas : []).map(limpio).filter(Boolean);
    if (estudio) partes.push(estudio + '.');
    if (resultado) partes.push('Variable de resultado: ' + resultado + (tipo ? ' (' + tipo + ')' : '') + '.');
    if (explicativas) partes.push('Variables explicativas: ' + explicativas + '.');
    if (grupos) partes.push('Grupos a comparar: ' + grupos + '.');
    if (salidas.length) partes.push('Quiero: ' + salidas.join(', ') + '.');
    return partes.join(' ').slice(0, 1000);
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

  // ------------------------------------------------------------------ rutas

  var SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  var MODOS_CODIGO = ['revisar', 'explicar', 'generar'];
  var DESCONOCIDA = function () { return { vista: 'inicio', desconocida: true }; };

  function pathDeSegmentos(tema, slug) {
    return SLUG.test(tema) && SLUG.test(slug) ? 'knowledge/' + tema + '/' + slug + '.md' : null;
  }

  function segmentosDePath(path) {
    var m = /^knowledge\/([a-z0-9-]+)\/([a-z0-9-]+)\.md$/.exec(String(path || ''));
    return m && SLUG.test(m[1]) && SLUG.test(m[2]) ? { tema: m[1], slug: m[2] } : null;
  }

  // Convierte la parte posterior al # de la dirección en una ruta. Nunca lanza:
  // lo que no se reconoce devuelve { vista: 'inicio', desconocida: true }.
  function parsearRuta(hash) {
    var h = String(hash === undefined || hash === null ? '' : hash);
    var viejo = /^#nota=(.*)$/.exec(h);
    if (viejo) {
      var path = null;
      try { path = decodeURIComponent(viejo[1]); } catch (e) { path = null; }
      return segmentosDePath(path) ? { vista: 'enlace-antiguo', path: path } : DESCONOCIDA();
    }
    var partes = h.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (!partes.length) return { vista: 'inicio' };
    var guia = function (origen) {
      if (partes.length !== 3) return DESCONOCIDA();
      var p = pathDeSegmentos(partes[1], partes[2]);
      return p ? { vista: 'guia', origen: origen, path: p } : DESCONOCIDA();
    };
    switch (partes[0]) {
      case 'aprender': return partes.length === 1 ? { vista: 'aprender' } : guia('aprender');
      case 'radar': return partes.length === 1 ? { vista: 'radar' } : guia('radar');
      case 'preguntar': return partes.length === 1 ? { vista: 'preguntar' } : DESCONOCIDA();
      case 'resultados': return partes.length === 1 ? { vista: 'resultados' } : DESCONOCIDA();
      case 'codigo':
        if (partes.length === 1) return { vista: 'codigo', modo: 'revisar' };
        if (partes.length === 2 && MODOS_CODIGO.indexOf(partes[1]) !== -1) return { vista: 'codigo', modo: partes[1] };
        return DESCONOCIDA();
      default: return DESCONOCIDA();
    }
  }

  function construirRuta(ruta) {
    switch (ruta && ruta.vista) {
      case 'aprender': return '#/aprender';
      case 'radar': return '#/radar';
      case 'preguntar': return '#/preguntar';
      case 'resultados': return '#/resultados';
      case 'codigo': return '#/codigo/' + (MODOS_CODIGO.indexOf(ruta.modo) !== -1 ? ruta.modo : 'revisar');
      case 'guia': {
        var s = segmentosDePath(ruta.path);
        return s ? '#/' + (ruta.origen === 'radar' ? 'radar' : 'aprender') + '/' + s.tema + '/' + s.slug : '#/';
      }
      default: return '#/';
    }
  }

  function contieneNota(lista, path) {
    return lista.temas.some(function (t) { return t.notas.some(function (n) { return n.path === path; }); });
  }

  function existeNota(path, partes) {
    return contieneNota(partes.guias, path) || contieneNota(partes.radar, path);
  }

  function rutaDeNota(path, partes) {
    return construirRuta({ vista: 'guia', origen: contieneNota(partes.radar, path) ? 'radar' : 'aprender', path: path });
  }

  // Enlaces compartidos antes del rediseño (#nota=<ruta codificada>) -> ruta nueva.
  function traducirEnlaceViejo(hash, partes) {
    var r = parsearRuta(hash);
    if (r.vista !== 'enlace-antiguo' || !existeNota(r.path, partes)) return null;
    return rutaDeNota(r.path, partes);
  }

  // ------------------------------------------------- secciones y guías vecinas

  // Parte el cuerpo de una nota en secciones por encabezado "## ". Un "## " dentro
  // de un bloque ``` no cuenta. El texto previo al primer encabezado se descarta.
  function separarSecciones(cuerpo) {
    var secciones = [];
    var actual = null;
    var enBloque = false;
    String(cuerpo === undefined || cuerpo === null ? '' : cuerpo).split(/\r?\n/).forEach(function (linea) {
      if (/^```/.test(linea.trim())) enBloque = !enBloque;
      var m = enBloque ? null : /^##\s+(.+?)\s*$/.exec(linea);
      if (m) {
        actual = { clave: normalizarTexto(m[1]), titulo: m[1], lineas: [] };
        secciones.push(actual);
      } else if (actual) {
        actual.lineas.push(linea);
      }
    });
    return secciones.map(function (s) {
      return { clave: s.clave, titulo: s.titulo, cuerpo: s.lineas.join('\n').replace(/^\n+|\n+$/g, '') };
    });
  }

  // Posición de una guía dentro de su tema y guías anterior y siguiente en el orden
  // del índice (los temas siguen el orden de INDEX.md). null si la ruta no es una guía.
  function vecinosDeGuia(guias, path) {
    var plano = [];
    guias.temas.forEach(function (t) {
      t.notas.forEach(function (n) {
        plano.push({ path: n.path, titulo: n.titulo, temaSlug: t.nombre, tema: nombreTema(t.nombre) });
      });
    });
    var i = -1;
    plano.forEach(function (n, k) { if (n.path === path) i = k; });
    if (i === -1) return null;
    var actual = plano[i];
    var delTema = plano.filter(function (n) { return n.temaSlug === actual.temaSlug; });
    function vecina(n) {
      return n ? { path: n.path, titulo: n.titulo, temaSlug: n.temaSlug, tema: n.tema, otroTema: n.temaSlug !== actual.temaSlug } : null;
    }
    return {
      tema: actual.tema,
      temaSlug: actual.temaSlug,
      posicion: delTema.indexOf(actual) + 1,
      totalTema: delTema.length,
      anterior: vecina(i > 0 ? plano[i - 1] : null),
      siguiente: vecina(i < plano.length - 1 ? plano[i + 1] : null),
    };
  }

  var API = {
    separarSecciones: separarSecciones,
    vecinosDeGuia: vecinosDeGuia,
    parsearRuta: parsearRuta,
    construirRuta: construirRuta,
    existeNota: existeNota,
    rutaDeNota: rutaDeNota,
    traducirEnlaceViejo: traducirEnlaceViejo,
    escapeHtml: escapeHtml,
    inlineMarkdown: inlineMarkdown,
    parsearFrontmatter: parsearFrontmatter,
    cuerpoMarkdownAHtml: cuerpoMarkdownAHtml,
    nombreTema: nombreTema,
    normalizarTexto: normalizarTexto,
    filtrarIndice: filtrarIndice,
    etiquetaFuente: etiquetaFuente,
    separarNotaInterna: separarNotaInterna,
    separarPorOrigen: separarPorOrigen,
    listarRadar: listarRadar,
    etiquetaLineas: etiquetaLineas,
    armarInformeRevision: armarInformeRevision,
    armarDescripcionGuiada: armarDescripcionGuiada,
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
  else { raiz.AsesorStataNucleo = API; }
})(typeof window !== 'undefined' ? window : globalThis);
