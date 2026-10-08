/* vistas/visor-codigo.js — cuadro de código con números de línea. Dos modos que ocupan el
   mismo lugar: edición (un textarea con un canal de números) y lectura (líneas numeradas que
   los resultados pueden cubrir y seleccionar). Los números coinciden con los del servidor
   porque se numera el texto que devuelve prepararCodigo del núcleo. */
(function () {
  'use strict';
  var A = window.AsesorStata;
  var N = A.N;
  var h = A.ui.h;

  A.ui.crearVisor = function (o) {
    o = o || {};
    var area = h('textarea', { class: 'visor-texto', spellcheck: 'false', wrap: 'off',
      'aria-label': o.etiqueta || 'Código', placeholder: o.placeholder || '' });
    var canal = h('div', { class: 'visor-canal', 'aria-hidden': 'true' }, '1');
    var edicion = h('div', { class: 'visor-edicion' }, canal, area);
    var lectura = h('div', { class: 'visor-lectura campo-oculto', role: 'group', 'aria-label': 'Código con líneas numeradas' });
    var el = h('div', { class: 'visor' }, edicion, lectura);
    var texto = '';
    var alClick = null;
    var alModo = null;

    function modo() { return lectura.classList.contains('campo-oculto') ? 'edicion' : 'lectura'; }
    function avisarModo() { if (alModo) alModo(modo()); }

    function pintarCanal() {
      var n = N.dividirLineas(area.value).length;
      var numeros = [];
      for (var i = 1; i <= n; i++) numeros.push(i);
      canal.textContent = numeros.join('\n');
      canal.scrollTop = area.scrollTop;
    }
    area.addEventListener('input', function () { pintarCanal(); if (o.alCambiar) o.alCambiar(area.value); });
    area.addEventListener('scroll', function () { canal.scrollTop = area.scrollTop; });

    function filas() { return lectura.querySelectorAll('.vl'); }
    function fila(n) { return lectura.querySelector('.vl[data-n="' + n + '"]'); }
    function marcar(clase, numeros) {
      Array.prototype.forEach.call(filas(), function (f) { f.classList.remove(clase); });
      numeros.forEach(function (n) { var f = fila(n); if (f) f.classList.add(clase); });
    }
    function cubrir(numeros) { marcar('cubierta', numeros); }
    function seleccionar(numeros) { marcar('sel', numeros); }
    function irA(n) {
      var f = fila(n);
      if (f) lectura.scrollTop = Math.max(0, f.offsetTop - lectura.clientHeight / 3);
    }

    function leer(codigo) {
      texto = codigo;
      lectura.replaceChildren();
      N.dividirLineas(texto).forEach(function (linea, i) {
        lectura.appendChild(h('div', { class: 'vl', 'data-n': String(i + 1) },
          h('span', { class: 'vn' }, String(i + 1)), h('span', { class: 'vt' }, linea === '' ? ' ' : linea)));
      });
      edicion.classList.add('campo-oculto');
      lectura.classList.remove('campo-oculto');
      avisarModo();
    }

    function salirDeLectura() {
      lectura.classList.add('campo-oculto');
      edicion.classList.remove('campo-oculto');
      cubrir([]);
      seleccionar([]);
    }

    // Vuelve a editar el mismo texto que se numeró.
    function editar() {
      salirDeLectura();
      area.value = texto;
      pintarCanal();
      avisarModo();
      area.focus();
    }

    // Reemplaza el texto (subir un archivo, ejemplo, borrador) y deja el visor en edición.
    function poner(codigo) {
      var venia = modo();
      salirDeLectura();
      area.value = codigo;
      area.dispatchEvent(new Event('input'));
      if (venia === 'lectura') avisarModo();
    }

    lectura.addEventListener('click', function (e) {
      var f = e.target.closest('.vl.cubierta');
      if (f && alClick) alClick(Number(f.getAttribute('data-n')));
    });
    pintarCanal();

    return {
      el: el, areaTexto: area, modo: modo, leer: leer, editar: editar, poner: poner,
      valor: function () { return modo() === 'edicion' ? area.value : texto; },
      cubrir: cubrir, seleccionar: seleccionar, irA: irA,
      enLinea: function (fn) { alClick = fn; },
      enModo: function (fn) { alModo = fn; },
      enfocar: function () { area.focus(); },
    };
  };
})();
