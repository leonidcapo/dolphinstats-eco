(function () {
  'use strict';

  var IDX = null;      // field name -> column index, set once journals.json loads
  var J = [];           // loaded journals (array of arrays)
  var AREAS = [];
  var PUBLISHERS = [];
  var JT = [];           // normalized "title categories" text per journal, for scoring
  var IDF = new Map();
  var NDOCS = 0;

  var STOP = new Set((
    'a an and are as at be by for from in into is it of on or that the to with ' +
    'study studies effect effects analysis analyses review reviews systematic ' +
    'meta trial trials randomized randomised controlled clinical efficacy safety ' +
    'effectiveness outcome outcomes patient patients adult adults treatment ' +
    'treatments management el la los las de del y en un una para con sobre ' +
    'entre efecto efectos revision sistematica ensayo estudio pacientes ' +
    'tratamiento'
  ).split(' '));

  function normTxt(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function tokens(s) {
    return normTxt(s).split(/[^a-z0-9]+/).filter(function (w) {
      return w.length > 2 && !STOP.has(w);
    });
  }
  function stem(w) { return w.length > 5 ? w.slice(0, 5) : w; }
  function stoks(s) { return tokens(s).map(stem); }

  function buildIndex() {
    NDOCS = J.length;
    var df = new Map();
    JT = new Array(NDOCS);
    for (var i = 0; i < NDOCS; i++) {
      var j = J[i];
      var text = j[IDX.title] + ' ' + j[IDX.categories];
      var seen = new Set(stoks(text));
      seen.forEach(function (w) { df.set(w, (df.get(w) || 0) + 1); });
      JT[i] = ' ' + normTxt(text) + ' ';
    }
    df.forEach(function (c, w) {
      IDF.set(w, Math.log((NDOCS + 1) / (c + 1)) + 1);
    });
  }

  function score(journalIdx, queryToks) {
    var text = JT[journalIdx];
    var total = 0;
    var seen = new Set();
    for (var i = 0; i < queryToks.length; i++) {
      var w = queryToks[i];
      if (seen.has(w)) continue;
      seen.add(w);
      if (text.indexOf(w) !== -1) total += (IDF.get(w) || 1);
    }
    return total;
  }

  function passesFilters(j, filters) {
    if (filters.area && String(j[IDX.areas]).indexOf(filters.area) === -1) return false;
    if (filters.publisher && j[IDX.publisher] !== filters.publisher) return false;
    var q = j[IDX.quartile];
    if (q && filters.quartiles.size > 0 && !filters.quartiles.has(q)) return false;
    if (filters.sjrMin != null) {
      var sjr = j[IDX.sjr];
      if (sjr == null || sjr < filters.sjrMin) return false;
    }
    return true;
  }

  function search(query, filters, topN) {
    topN = topN || 50;
    var queryToks = stoks(query);
    var out = [];
    for (var i = 0; i < J.length; i++) {
      var j = J[i];
      if (!passesFilters(j, filters)) continue;
      var s = queryToks.length > 0 ? score(i, queryToks) : 0;
      if (queryToks.length > 0 && s === 0) continue;
      out.push({ journal: j, score: s });
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, topN);
  }

  // Cargado del dataset. Igual patrón que investigaciontau: busca primero en
  // data/journals.json y, si no la encuentra, en journals.json (raíz).
  function loadData() {
    var statusEl = document.getElementById('jm-status');
    fetch('data/journals.json')
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .catch(function () {
        return fetch('journals.json').then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status + ' — falta journals.json');
          return r.json();
        });
      })
      .then(function (d) {
        IDX = {};
        d.fields.forEach(function (f, i) { IDX[f] = i; });
        J = d.journals;

        var areaSet = new Set(), pubSet = new Set();
        J.forEach(function (j) {
          String(j[IDX.areas]).split(';').forEach(function (a) {
            a = a.trim(); if (a) areaSet.add(a);
          });
          var pub = j[IDX.publisher];
          if (pub) pubSet.add(pub);
        });
        AREAS = Array.from(areaSet).sort();
        PUBLISHERS = Array.from(pubSet).sort();

        buildIndex();
        statusEl.textContent = J.length.toLocaleString('es-PE') + ' revistas cargadas.';
        statusEl.classList.remove('error');
        if (typeof window.onJournalMatchDataReady === 'function') {
          window.onJournalMatchDataReady();
        }
      })
      .catch(function (e) {
        statusEl.textContent = 'Error cargando datos: ' + e.message +
          '. Si abriste el archivo localmente, usa un servidor local (ej.: ' +
          'python3 -m http.server) o ábrelo desde el sitio publicado.';
        statusEl.classList.add('error');
      });
  }

  window.JournalMatch = {
    getIDX: function () { return IDX; },
    getJournals: function () { return J; },
    getAreas: function () { return AREAS; },
    getPublishers: function () { return PUBLISHERS; },
    search: search,
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtN(n) { return n == null || n === '' ? '—' : Number(n).toLocaleString('en-US'); }
  function scimagoUrl(j, idx) {
    return 'https://www.scimagojr.com/journalsearch.php?q=' + encodeURIComponent(j[idx.title]) + '&tip=jou';
  }
  function accessBadgeHtml(j, idx) {
    if (j[idx.oa_diamond]) return '<span class="badge b-dia">💎 Diamond</span>';
    if (j[idx.oa]) return '<span class="badge b-gold">🟡 Gold OA</span>';
    return '<span class="badge b-sub">🔒 Suscripción</span>';
  }
  function accessLabel(j, idx) {
    if (j[idx.oa_diamond]) return 'Diamond';
    if (j[idx.oa]) return 'Gold OA';
    return 'Suscripción';
  }

  var lastResults = [];

  function populateSelect(id, values) {
    var el = document.getElementById(id);
    values.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v; o.textContent = v;
      el.appendChild(o);
    });
  }

  function currentFilters() {
    var quartiles = new Set();
    ['jm-q1', 'jm-q2', 'jm-q3', 'jm-q4'].forEach(function (id, i) {
      if (document.getElementById(id).checked) quartiles.add('Q' + (i + 1));
    });
    var sjrRaw = document.getElementById('jm-sjrmin').value;
    return {
      area: document.getElementById('jm-area').value,
      publisher: document.getElementById('jm-publisher').value,
      quartiles: quartiles,
      sjrMin: sjrRaw === '' ? null : Number(sjrRaw),
    };
  }

  function renderResults(results, idx) {
    var container = document.getElementById('jm-results');
    if (results.length === 0) {
      container.innerHTML = '<p style="color:var(--muted);margin-top:1.5rem">Sin resultados para los criterios elegidos.</p>';
      return;
    }
    var rows = results.map(function (r) {
      var j = r.journal;
      return '<tr><td><a href="' + scimagoUrl(j, idx) + '" target="_blank" rel="noopener">' +
        esc(j[idx.title]) + '</a></td><td>' + esc(j[idx.publisher]) + '</td><td>' +
        esc(j[idx.country]) + '</td><td>' + esc(j[idx.quartile] || '—') + '</td><td>' +
        fmtN(j[idx.sjr]) + '</td><td>' + accessBadgeHtml(j, idx) + '</td></tr>';
    }).join('');
    container.innerHTML = '<table><thead><tr><th>Revista</th><th>Editorial</th>' +
      '<th>País</th><th>Cuartil</th><th>SJR</th><th>Acceso</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function dlCsv(rows, filename) {
    var csv = '﻿' + rows.map(function (r) {
      return r.map(function (v) {
        v = v == null ? '' : String(v);
        return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(';');
    }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function runSearch() {
    var idx = window.JournalMatch.getIDX();
    var query = document.getElementById('jm-query').value.trim();
    var results = window.JournalMatch.search(query, currentFilters());
    lastResults = results;
    renderResults(results, idx);
    document.getElementById('jm-export').disabled = results.length === 0;
    var statusEl = document.getElementById('jm-status');
    statusEl.textContent = results.length + ' revista(s) encontradas.';
    statusEl.classList.remove('error');
  }

  function exportCsv() {
    var idx = window.JournalMatch.getIDX();
    var rows = [['Score', 'Título', 'ISSN', 'Editorial', 'País', 'Cuartil', 'SJR', 'Acceso']];
    lastResults.forEach(function (r) {
      var j = r.journal;
      rows.push([r.score.toFixed(2), j[idx.title], j[idx.issn], j[idx.publisher],
        j[idx.country], j[idx.quartile], j[idx.sjr], accessLabel(j, idx)]);
    });
    dlCsv(rows, 'journal_match_' + lastResults.length + '_revistas.csv');
  }

  window.onJournalMatchDataReady = function () {
    populateSelect('jm-area', window.JournalMatch.getAreas());
    populateSelect('jm-publisher', window.JournalMatch.getPublishers());
    document.getElementById('jm-search').addEventListener('click', runSearch);
    document.getElementById('jm-export').addEventListener('click', exportCsv);
  };

  document.addEventListener('DOMContentLoaded', loadData);
})();
