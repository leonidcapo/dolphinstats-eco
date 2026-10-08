/* asesor-stata-app.js — núcleo de la interfaz de Asesor Stata: ayudantes de DOM,
 * índice de notas, router por # y componentes compartidos. Cada pantalla vive en
 * vistas/*.js y se registra en AsesorStata.vistas. Usa AsesorStataNucleo (funciones
 * puras, probadas con node). */
(function () {
  'use strict';

  var N = window.AsesorStataNucleo;
  var A = window.AsesorStata = {
    N: N, vistas: {}, ui: {}, avisoPendiente: null,
    estado: { partes: null, cargaIndice: null, preguntaInicial: '', borrador: { codigo: '', descripcion: '', salida: '' } },
  };
  var u = A.ui;
  var CLAVE_NIVEL = 'asesor-stata-nivel';
  var SVG_NS = 'http://www.w3.org/2000/svg';

  // ------------------------------------------------------------------- DOM

  // h('div', { class: 'x', onclick: fn }, 'texto', otroNodo, [lista]). Los textos
  // se insertan como texto (nunca como HTML); `html` solo para HTML ya escapado
  // (la salida del conversor de Markdown del núcleo).
  function h(tag, props) {
    var el = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (function agregar(lista) {
      lista.forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        if (Array.isArray(c)) { agregar(c); return; }
        el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    })(Array.prototype.slice.call(arguments, 2));
    return el;
  }
  u.h = h;

  u.icono = function (nombre, clase) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'ico' + (clase ? ' ' + clase : ''));
    svg.setAttribute('aria-hidden', 'true');
    var uso = document.createElementNS(SVG_NS, 'use');
    uso.setAttribute('href', '#i-' + nombre);
    svg.appendChild(uso);
    return svg;
  };

  u.hero = function (o) {
    return h('section', { class: 'hero' }, h('div', { class: 'hero-in' },
      o.miga || null,
      o.kicker ? h('div', { class: 'kicker' }, o.kicker) : null,
      h('h1', null, o.titulo),
      o.texto ? h('p', { class: 'hero-texto' }, o.texto) : null,
      o.extra || null));
  };

  u.tarjetaTarea = function (o) {
    return h('a', { class: 'tarea tarea--' + o.tono, href: o.href },
      h('span', { class: 'tarea-ico' }, u.icono(o.icono)),
      h('span', { class: 'tarea-titulo' }, o.titulo),
      h('span', { class: 'tarea-texto' }, o.texto));
  };

  u.estadoCarga = function (texto) {
    return h('div', { class: 'estado-vista', role: 'status' }, h('span', { class: 'giro', 'aria-hidden': 'true' }), texto || 'Cargando…');
  };

  u.estadoError = function (mensaje, reintentar) {
    return h('div', { class: 'estado-vista error', role: 'alert' }, u.icono('alerta'), h('p', null, mensaje),
      reintentar ? h('button', { type: 'button', class: 'btn btn-sec', onclick: reintentar }, 'Reintentar') : null);
  };

  u.estadoVacio = function (titulo, texto, accion) {
    return h('div', { class: 'estado-vista vacio' }, h('div', null, h('p', { class: 'vacio-titulo' }, titulo), texto ? h('p', null, texto) : null, accion || null));
  };

  // Aviso de privacidad de las pantallas que mandan texto del usuario a un servicio de IA externo.
  u.avisoPrivacidad = function () {
    return h('p', { class: 'aviso' }, 'Tu texto se envía a un servicio de inteligencia artificial externo para analizarlo. ',
      h('strong', null, 'No pegues datos de pacientes ni información que permita identificar a alguien'),
      ' (si pegas salidas de Stata, quita los listados de personas). No se ejecuta nada en Stata: verifica el resultado antes de usarlo.');
  };

  // ------------------------------------------------------- almacenamiento

  u.leerGuardado = function (clave) {
    try { return window.localStorage.getItem(clave); } catch (e) { return null; }
  };
  u.escribirGuardado = function (clave, valor) {
    try { window.localStorage.setItem(clave, valor); } catch (e) { /* sin almacenamiento: no pasa nada */ }
  };

  // Nivel de la respuesta (básico / intermedio / avanzado), recordado entre pantallas y visitas.
  var contadorNivel = 0;
  u.selectorNivel = function () {
    var nombre = 'nivel-' + (++contadorNivel);
    var guardado = u.leerGuardado(CLAVE_NIVEL);
    var actual = ['basico', 'intermedio', 'avanzado'].indexOf(guardado) !== -1 ? guardado : 'intermedio';
    var el = h('div', { class: 'nivel', role: 'radiogroup', 'aria-label': 'Nivel de la respuesta' },
      h('span', { class: 'nivel-rotulo' }, 'Nivel'),
      [['basico', 'Básico'], ['intermedio', 'Intermedio'], ['avanzado', 'Avanzado']].map(function (o) {
        var entrada = h('input', { type: 'radio', name: nombre, value: o[0] });
        if (o[0] === actual) entrada.checked = true;
        entrada.addEventListener('change', function () { u.escribirGuardado(CLAVE_NIVEL, o[0]); });
        return h('label', { class: 'nivel-op' }, entrada, h('span', null, o[1]));
      }));
    return { el: el, valor: function () { var c = el.querySelector('input:checked'); return c ? c.value : 'intermedio'; } };
  };

  // ------------------------------------------------ copiar, descargar, archivos

  // Si el navegador no deja copiar, deja `elemento` seleccionado para usar Ctrl+C.
  u.copiarTexto = function (texto, boton, etiqueta, elemento) {
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
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(listo, alternativa);
    else alternativa();
  };

  u.descargarArchivo = function (contenido, nombre, tipo) {
    var url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    var a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  u.hoyIso = function () {
    var d = new Date();
    function dos(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
  };

  // Los .do viejos pueden venir en Latin-1: si no es UTF-8 válido, se lee así.
  u.leerArchivoComoTexto = function (archivo) {
    return archivo.arrayBuffer().then(function (buffer) {
      try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
      catch (e) { return new TextDecoder('windows-1252').decode(buffer); }
    });
  };

  // Inserta sobre un <pre> una barra con el rótulo y un botón «Copiar».
  u.agregarBarraCopiar = function (pre, rotulo) {
    var boton = h('button', { type: 'button', class: 'btn btn-sec' }, 'Copiar');
    boton.addEventListener('click', function () { u.copiarTexto(pre.textContent, boton, 'Copiar', pre); });
    pre.parentNode.insertBefore(h('div', { class: 'bloque-barra' }, h('span', null, rotulo), boton), pre);
  };

  u.bloqueCodigo = function (codigo, rotulo) {
    var pre = h('pre', { class: 'bloque-codigo' }, h('code', null, codigo));
    var envoltura = h('div', { class: 'bloque' }, pre);
    u.agregarBarraCopiar(pre, rotulo);
    return envoltura;
  };

  // --------------------------------------------- pedidos al servidor y esperas

  u.pedirJson = function (url, cuerpo, ms) {
    var controlador = new AbortController();
    var corte = setTimeout(function () { controlador.abort(); }, ms);
    return fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: controlador.signal,
    })
      .then(function (res) {
        return res.json()
          .catch(function () { return { error: 'El servidor no respondió correctamente. Intenta de nuevo en un momento.' }; })
          .then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (r) { clearTimeout(corte); return r; }, function (e) { clearTimeout(corte); throw e; });
  };

  u.mensajeDeFallo = function (e) {
    if (e && e.name === 'AbortError') return 'Tardó demasiado en responder. Prueba con un texto más corto o intenta de nuevo.';
    return 'No se pudo completar el pedido. Revisa tu conexión e intenta de nuevo.';
  };

  u.estadoLinea = function (el, tipo, texto) {
    el.className = 'linea-estado' + (tipo ? ' ' + tipo : '');
    el.textContent = texto;
  };

  // Texto de espera que avanza solo (con los segundos transcurridos) para que una
  // respuesta lenta no parezca un cuelgue. Devuelve la función que lo detiene.
  u.iniciarEspera = function (el, frases, avisoLargo) {
    var inicio = Date.now();
    function pintar() {
      var seg = Math.floor((Date.now() - inicio) / 1000);
      var frase = frases[Math.min(Math.floor(seg / 7), frases.length - 1)];
      var extra = avisoLargo && seg >= 10 ? ' · los textos largos pueden tardar hasta 30 s' : '';
      u.estadoLinea(el, 'esperando', frase + ' (' + seg + ' s)' + extra);
    }
    pintar();
    var id = setInterval(pintar, 1000);
    return function () { clearInterval(id); };
  };

  u.enlazarContador = function (area, contador, max, textoSobre) {
    function actualizar() {
      var n = area.value.length;
      var sobre = n > max;
      contador.textContent = n.toLocaleString('es-PE') + ' / ' + max.toLocaleString('es-PE') + ' caracteres' + (sobre ? ' — ' + textoSobre : '');
      contador.classList.toggle('sobre', sobre);
    }
    area.addEventListener('input', actualizar);
    actualizar();
    return actualizar;
  };

  // ------------------------------------------------------------------ índice

  function errorDeIndice(mensaje, amigable) {
    var e = new Error(mensaje);
    e.amigable = !!amigable;
    return e;
  }

  // Se pide una sola vez; si falla, la próxima llamada vuelve a intentar.
  A.cargarIndice = function () {
    if (A.estado.cargaIndice) return A.estado.cargaIndice;
    A.estado.cargaIndice = fetch('/api/asesor-stata-base')
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (!r.ok) throw errorDeIndice(r.data.error || 'No se pudo cargar el índice.', true);
        A.estado.partes = N.separarPorOrigen(r.data);
        return A.estado.partes;
      })
      .catch(function (e) {
        A.estado.cargaIndice = null;
        throw e.amigable ? e : errorDeIndice('No se pudo cargar el índice. Revisa tu conexión e intenta de nuevo.', false);
      });
    return A.estado.cargaIndice;
  };

  A.mensajeDeIndice = function (e) {
    return e && e.message ? e.message : 'No se pudo cargar el índice. Revisa tu conexión e intenta de nuevo.';
  };

  // Ruta de una nota que cita el modelo, o null si no existe: el modelo puede inventar rutas,
  // y una nota inexistente no debe convertirse en un enlace roto. Sin índice (falló la carga),
  // se acepta cualquier ruta con la forma de una nota.
  A.rutaDeNota = function (path) {
    var partes = A.estado.partes;
    if (partes) return N.existeNota(path, partes) ? N.rutaDeNota(path, partes) : null;
    return /^knowledge\/[a-z0-9-]+\/[a-z0-9-]+\.md$/.test(String(path)) ? N.construirRuta({ vista: 'guia', origen: 'aprender', path: path }) : null;
  };

  // ------------------------------------------------------------------ router

  var raiz = null;
  var tokenActual = 0;
  var hashActual = '#/';
  var posiciones = {};

  function actualizarNav(seccion) {
    Array.prototype.forEach.call(document.querySelectorAll('.nav a[data-seccion]'), function (a) {
      if (a.getAttribute('data-seccion') === seccion) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function montar(token, nodo, meta) {
    if (token !== tokenActual) return; // el usuario ya cambió de pantalla
    meta = meta || {};
    raiz.replaceChildren(nodo);
    document.body.classList.toggle('con-hero', !!raiz.querySelector('.hero'));
    raiz.classList.remove('entra');
    void raiz.offsetWidth;
    raiz.classList.add('entra');
    document.title = meta.inicio ? 'Asesor Stata — DolphinStats' : (meta.titulo || 'Asesor Stata') + ' · Asesor Stata · DolphinStats';
    actualizarNav(meta.seccion || null);
    window.scrollTo(0, 0);
    var titulo = raiz.querySelector('h1');
    if (titulo) { titulo.setAttribute('tabindex', '-1'); titulo.focus({ preventScroll: true }); }
  }

  function reemplazarHash(nuevo) {
    history.replaceState(null, '', location.pathname + location.search + nuevo);
  }

  function traducirEnlaceAntiguo(ctx, hash) {
    ctx.montar(u.estadoCarga('Abriendo la nota…'), { titulo: 'Abriendo la nota' });
    ctx.cuando(A.cargarIndice(), function (partes) {
      var nueva = N.traducirEnlaceViejo(hash, partes);
      if (!nueva) A.avisoPendiente = 'No encontramos esa nota. Puede que se haya movido o renombrado.';
      reemplazarHash(nueva || '#/');
      navegar();
    }, function (e) {
      ctx.montar(h('div', { class: 'cuerpo' }, u.estadoError(A.mensajeDeIndice(e), navegar)), { titulo: 'No se pudo abrir' });
    });
  }

  function navegar() {
    posiciones[hashActual] = window.scrollY;
    var token = ++tokenActual;
    var hash = location.hash;
    var ruta = N.parsearRuta(hash);
    if (ruta.desconocida && hash && hash !== '#' && hash !== '#/') {
      A.avisoPendiente = 'No encontramos esa dirección; te llevamos al inicio.';
      reemplazarHash('#/');
      hash = '#/';
      ruta = { vista: 'inicio' };
    }
    hashActual = hash || '#/';
    var ctx = {
      ruta: ruta,
      montar: function (nodo, meta) { montar(token, nodo, meta); },
      activo: function () { return token === tokenActual; },
      // Para las listas largas: cuando ya tienen sus datos, vuelven a donde estaba el usuario
      // la última vez que salió de esta misma dirección (por ejemplo, al usar el botón atrás).
      restaurarScroll: function () {
        if (token === tokenActual && posiciones[hash || '#/']) window.scrollTo(0, posiciones[hash || '#/']);
      },
      cuando: function (promesa, ok, mal) {
        promesa.then(
          function (v) { if (token === tokenActual && ok) ok(v); },
          function (e) { if (token === tokenActual && mal) mal(e); });
      },
    };
    if (ruta.vista === 'enlace-antiguo') { traducirEnlaceAntiguo(ctx, hash); return; }
    var vista = A.vistas[ruta.vista];
    if (!vista) {
      ctx.montar(h('div', { class: 'cuerpo' }, u.estadoVacio('Esta pantalla no está disponible.', null, h('a', { class: 'btn', href: '#/' }, 'Ir al inicio'))), { titulo: 'No disponible' });
      return;
    }
    vista(ctx);
  }
  A.recargarVista = navegar;

  function arrancar() {
    raiz = document.getElementById('vista');
    // El enlace «Saltar al contenido» no puede cambiar el hash (es la ruta): solo mueve el foco.
    document.querySelector('.saltar').addEventListener('click', function (e) { e.preventDefault(); raiz.focus(); });
    window.addEventListener('hashchange', navegar);
    navegar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
