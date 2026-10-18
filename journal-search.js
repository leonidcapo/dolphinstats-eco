(function () {
  'use strict';

  var IDX = null;      // field name -> column index, set once journals.json loads
  var J = [];           // loaded journals (array of arrays)
  var AREAS = [];
  var PUBLISHERS = [];
  var JT = [];           // normalized title text per journal, for scoring (peso 1.0)
  var JC = [];           // normalized categories text per journal (peso 0.75)
  var JA = [];           // normalized areas text per journal (peso 0.4)
  var IDF = new Map();
  var NDOCS = 0;

  // Grupos editoriales curados (mismo patrón que investigaciontau/index.html
  // -- PUBGROUPS ahí): el dataset de Scimago trae el campo Publisher con
  // miles de variantes de nombre por editorial ("Elsevier BV", "Elsevier
  // Inc", "Elsevier Ltd", etc.), así que listar cada valor único produce un
  // <select> con ~3.000 opciones ilegibles. En vez de eso, se agrupan por
  // expresión regular sobre el mismo campo crudo -- el filtro sigue
  // operando sobre los datos reales de Scimago, solo cambia cómo se
  // presentan las opciones.
  var PUBGROUPS = [
    ['Elsevier', /elsevier|academic press|cell press|mosby|w\.?b\.? saunders|churchill livingstone|pergamon|\bsaunders\b/i],
    ['Springer Nature (incl. BMC, Nature)', /springer|nature (research|portfolio|publishing)|\bnature\b|biomed ?central|\bbmc\b|palgrave|adis|humana/i],
    ['Wiley', /wiley|blackwell/i],
    ['Taylor & Francis', /taylor|francis|routledge|informa|dove medical/i],
    ['SAGE', /\bsage\b/i],
    ['MDPI', /mdpi/i],
    ['Frontiers', /frontiers/i],
    ['Wolters Kluwer / Lippincott', /wolters|lippincott|kluwer|\bovid\b/i],
    ['Oxford University Press', /oxford university/i],
    ['Cambridge University Press', /cambridge university/i],
    ['IEEE', /ieee|institute of electrical/i],
    ['PLOS', /\bplos\b|public library of science/i],
    ['American Chemical Society (ACS)', /american chemical society|\bacs\b/i],
    ['BMJ', /\bbmj\b|british medical journal/i],
    ['Karger', /karger/i],
    ['Thieme', /thieme/i],
    ['De Gruyter', /de ?gruyter/i],
    ['Emerald', /emerald/i],
    ['IOP Publishing', /\biop\b|institute of physics/i],
    ['Hindawi', /hindawi/i]
  ];
  function pubMatch(pub, group) {
    var g = PUBGROUPS.filter(function (x) { return x[0] === group; })[0];
    return g ? g[1].test(String(pub)) : true;
  }

  // Procedencia del dato de APC -- mismos códigos que
  // scripts/build_journals.py (SRC_*) en endes-generator, que es lo que
  // genera este journals.json.
  var APC_SRC_SIN_DATO = 0;
  var APC_SRC_DOAJ_OFICIAL = 1;
  var APC_SRC_OPENAPC_EVIDENCIA = 2;
  var APC_SRC_SIN_APC_CONFIRMADO = 3;

  // Modelo de publicación derivado (igual criterio que investigaciontau):
  // diamond = OA sin APC (Scimago/DOAJ) · gold = 100% OA con APC ·
  // hybrid = suscripción con pagos OA reales observados en OpenAPC ·
  // subs = suscripción sin evidencia de opción OA.
  function jType(j) {
    if (j[IDX.oa_diamond]) return 'diamond';
    if (j[IDX.oa]) return 'gold';
    if (j[IDX.apc_paid_n]) return 'hybrid';
    return 'subs';
  }
  var TYPE_INFO = {
    diamond: { label: '💎 Diamond', title: 'Revista 100% Open Access sin costo para el autor' },
    gold: { label: '🟡 Gold OA', title: 'Revista 100% Open Access financiada con APC' },
    hybrid: { label: '🔀 Híbrida', title: 'Revista de suscripción con opción Open Access pagando APC (pagos documentados en OpenAPC)' },
    subs: { label: '🔒 Suscripción', title: 'Revista solo por suscripción, sin evidencia de opción OA con APC' }
  };

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
    JT = new Array(NDOCS); JC = new Array(NDOCS); JA = new Array(NDOCS);
    for (var i = 0; i < NDOCS; i++) {
      var j = J[i];
      var seen = new Set(stoks(j[IDX.title] + ' ' + j[IDX.categories]));
      seen.forEach(function (w) { df.set(w, (df.get(w) || 0) + 1); });
      JT[i] = ' ' + normTxt(j[IDX.title]) + ' ';
      JC[i] = ' ' + normTxt(j[IDX.categories]) + ' ';
      JA[i] = ' ' + normTxt(j[IDX.areas]) + ' ';
    }
    df.forEach(function (c, w) {
      IDF.set(w, Math.log((NDOCS + 1) / (c + 1)) + 1);
    });
  }

  function passesFilters(j, filters) {
    if (filters.area && String(j[IDX.areas]).indexOf(filters.area) === -1) return false;
    if (filters.publisher && !pubMatch(j[IDX.publisher], filters.publisher)) return false;
    // Scimago marca el cuartil de las revistas sin ranquear (conference
    // proceedings, algunas book series) con el string literal "-", no con
    // un campo vacío -- si se tratara como cuartil real, quedarían
    // excluidas aunque el usuario tenga los 4 cuartiles tildados. Solo se
    // filtra por cuartil cuando el valor es realmente uno de Q1-Q4.
    var q = j[IDX.quartile];
    var esCuartilValido = q === 'Q1' || q === 'Q2' || q === 'Q3' || q === 'Q4';
    if (esCuartilValido && filters.quartiles.size > 0 && !filters.quartiles.has(q)) return false;
    if (filters.sjrMin != null) {
      var sjr = j[IDX.sjr];
      if (sjr == null || sjr < filters.sjrMin) return false;
    }
    if (filters.onlyJournal && j[IDX.type] !== 'journal') return false;
    if (filters.waiver && j[IDX.waiver] !== 'Yes') return false;
    if (filters.oaMode === 'oa' && !j[IDX.oa] && !j[IDX.oa_diamond]) return false;
    if (filters.oaMode && filters.oaMode !== 'any' && filters.oaMode !== 'oa' && jType(j) !== filters.oaMode) return false;
    // Si no se conoce el APC de la revista, no se excluye por presupuesto
    // (mismo criterio que investigaciontau) -- excluir de plano dejaría
    // fuera a la mayoría del dataset, que no tiene ese dato.
    if (filters.budget != null) {
      var usd = j[IDX.apc_usd];
      if (usd != null && usd > filters.budget) return false;
    }
    return true;
  }

  // Puerto del score de investigaciontau (runMatch en su código fuente): no
  // es solo "contiene el término" -- pondera por campo (título > categorías
  // > área), por especificidad del término (IDF) y exige una relevancia
  // mínima (7%) para no incluir coincidencias de una sola palabra genérica.
  // Diagnóstico de sesión: la versión anterior (un simple "suma IDF de lo
  // que matcheó, sin piso") encontraba 1.568 revistas para una búsqueda
  // donde investigaciontau encuentra 165 -- de ahí la diferencia real que
  // reportó el usuario, no solo el límite de 50 que ya truncaba el conteo
  // sin avisar (eso también se corrige acá: search() ahora devuelve el
  // total real además de la porción a mostrar).
  function buildQuery(query) {
    var vistos = new Map(); // stem -> palabra original (para mostrar "coincidencias")
    tokens(query).forEach(function (w) {
      var s = stem(w);
      if (!vistos.has(s)) vistos.set(s, w);
    });
    var terms = [];
    vistos.forEach(function (w, s) { terms.push({ w: w, s: s, idf: IDF.get(s) || 1 }); });
    return terms;
  }

  function relevancia(i, terms) {
    var acc = 0, hits = [];
    for (var k = 0; k < terms.length; k++) {
      var t = terms[k];
      var fld = 0;
      if (JT[i].indexOf(t.s) !== -1) fld = 1.0;
      else if (JC[i].indexOf(t.s) !== -1) fld = 0.75;
      else if (JA[i].indexOf(t.s) !== -1) fld = 0.4;
      if (fld > 0) { acc += t.idf * fld; hits.push(t.w); }
    }
    return { acc: acc, hits: hits };
  }

  function search(query, filters, topN) {
    topN = topN || 30; // igual que investigaciontau: la lista completa se puede exportar, no hace falta pintar más
    var terms = buildQuery(query);
    var useKw = terms.length > 0;
    var ranked = terms.slice().sort(function (a, b) { return b.idf - a.idf; });
    var denom = ranked.slice(0, 5).reduce(function (acc, t) { return acc + t.idf; }, 0) || 1;

    var quartiles = Array.from(filters.quartiles).map(function (q) { return Number(q.replace('Q', '')); });

    var out = [];
    for (var i = 0; i < J.length; i++) {
      var j = J[i];
      if (!passesFilters(j, filters)) continue;

      var relScore = 0, hits = [];
      if (useKw) {
        var r = relevancia(i, terms);
        var coverage = 0.62 + 0.38 * Math.min(1, r.hits.length / 3);
        relScore = Math.min(1, (r.acc / denom) * coverage);
        if (relScore < 0.07) continue; // con palabras clave, exige relevancia mínima
        hits = r.hits;
      }

      var qNum = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 }[j[IDX.quartile]] || 0;
      var qScore = quartiles.length === 0 ? 0.6
        : qNum === 0 ? 0.3
        : quartiles.indexOf(qNum) !== -1 ? 1
        : Math.max(0, 1 - 0.3 * Math.abs(qNum - Math.min.apply(null, quartiles)));

      var sjr = j[IDX.sjr] || 0;
      var pScore = Math.min(1, Math.log10(1 + sjr) / 1.04);

      var aScore = 0.5;
      if (j[IDX.apc_source] === APC_SRC_SIN_APC_CONFIRMADO) aScore = 1;
      else if (j[IDX.apc_usd] != null) aScore = filters.budget != null ? (j[IDX.apc_usd] <= filters.budget ? 1 : 0) : 0.8;
      if (j[IDX.waiver] === 'Yes') aScore = Math.min(1, aScore + 0.15);

      var pct = useKw
        ? 100 * (0.66 * relScore + 0.14 * qScore + 0.09 * pScore + 0.11 * aScore)
        : 100 * (0.40 * qScore + 0.33 * pScore + 0.27 * aScore);

      out.push({ journal: j, score: Math.round(pct), hits: hits });
    }
    out.sort(function (a, b) { return b.score - a.score || ((b.journal[IDX.sjr] || 0) - (a.journal[IDX.sjr] || 0)); });
    return { all: out, shown: out.slice(0, topN), useKw: useKw };
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

        var areaSet = new Set();
        J.forEach(function (j) {
          String(j[IDX.areas]).split(';').forEach(function (a) {
            a = a.trim(); if (a) areaSet.add(a);
          });
        });
        AREAS = Array.from(areaSet).sort();
        // Solo se listan los grupos que de verdad tienen al menos una
        // revista en la base (evita, ej., mostrar "IEEE" si no hay ninguna
        // revista IEEE en este dataset).
        PUBLISHERS = PUBGROUPS.filter(function (g) {
          return J.some(function (j) { return g[1].test(String(j[IDX.publisher])); });
        }).map(function (g) { return g[0]; });

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
  function fmtUsd(n) { return n == null ? '—' : '$' + fmtN(Math.round(n)); }
  function scimagoUrl(j, idx) {
    // El Sourceid de Scimago (cuando está) da una URL exacta a la ficha de
    // la revista; sin eso, se cae a una búsqueda por título (menos precisa
    // si hay varias revistas con nombres parecidos).
    var sid = j[idx.sourceid];
    if (sid) return 'https://www.scimagojr.com/journalsearch.php?q=' + encodeURIComponent(sid) + '&tip=sid';
    return 'https://www.scimagojr.com/journalsearch.php?q=' + encodeURIComponent(j[idx.title]) + '&tip=jou';
  }
  function homepageUrl(j, idx) {
    var home = j[idx.homepage];
    return home ? home : scimagoUrl(j, idx);
  }
  function typeBadgeHtml(j, idx) {
    var t = TYPE_INFO[jType(j)];
    return '<span class="badge b-' + jType(j) + '" title="' + esc(t.title) + '">' + t.label + '</span>';
  }
  function typeLabel(j, idx) { return TYPE_INFO[jType(j)].label.replace(/^\S+\s/, ''); }
  function apcOficialHtml(j, idx) {
    if (j[idx.doaj_has_apc] === 'No') return '<span style="color:var(--ok);font-weight:700">Sin APC (Diamond)</span>';
    return j[idx.doaj_apc] ? esc(j[idx.doaj_apc]) : '—';
  }
  function apcRealHtml(j, idx) {
    var mediana = j[idx.apc_paid_median_eur];
    if (mediana == null) return '—';
    return '€' + fmtN(mediana) + ' <span style="color:var(--muted)">(n=' + fmtN(j[idx.apc_paid_n]) + ')</span>';
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
    var budgetRaw = document.getElementById('jm-budget').value;
    return {
      area: document.getElementById('jm-area').value,
      publisher: document.getElementById('jm-publisher').value,
      quartiles: quartiles,
      sjrMin: sjrRaw === '' ? null : Number(sjrRaw),
      oaMode: document.getElementById('jm-oa').value,
      budget: budgetRaw === '' ? null : Number(budgetRaw),
      waiver: document.getElementById('jm-waiver').checked,
      onlyJournal: document.getElementById('jm-onlyjournal').checked,
    };
  }

  function matchColor(p) {
    return p >= 75 ? 'var(--ok)' : p >= 50 ? 'var(--aqua)' : p >= 30 ? '#d97706' : 'var(--accent)';
  }

  function renderResults(shown, total, useKw, idx) {
    var container = document.getElementById('jm-results');
    if (shown.length === 0) {
      container.innerHTML = '<p style="color:var(--muted);margin-top:1.5rem">Sin resultados para los criterios elegidos.</p>';
      return;
    }
    var resumen = '<p class="jsummary"><b>' + fmtN(total) + '</b> revista(s) cumplen tus criterios. Mostrando las <b>' +
      fmtN(shown.length) + '</b> más pertinentes.' +
      (useKw ? '' : ' <span style="color:var(--muted)">Escribe tu título o palabras clave para un match temático más fino.</span>') +
      '</p>';
    var cards = shown.map(function (r) {
      var j = r.journal;
      var waiverBadge = j[idx.waiver] === 'Yes' ? '<span class="badge b-wv">Waiver disponible</span>' : '';
      var citesBadge = j[idx.cites_2y] != null
        ? '<span class="badge b-if" title="Citas por documento a 2 años (Scimago) — proxy del factor de impacto">📈 Citas/Doc 2a: ' + j[idx.cites_2y] + '</span>' : '';
      var col = matchColor(r.score);
      var hitsLine = r.hits.length
        ? '<div class="jhits">Coincidencias temáticas: ' + esc(r.hits.slice(0, 10).join(', ')) + '</div>' : '';
      return '<div class="jcard"><div class="jtop"><div class="jbody">' +
        '<h3><a href="' + homepageUrl(j, idx) + '" target="_blank" rel="noopener">' + esc(j[idx.title]) + '</a></h3>' +
        '<div class="jmeta">' + esc(j[idx.publisher]) + ' · ' + esc(j[idx.country]) + ' · ISSN ' + esc(j[idx.issn]) +
        ' · <a href="' + scimagoUrl(j, idx) + '" target="_blank" rel="noopener">Scimago ▸</a></div>' +
        '<div class="badges">' +
        (j[idx.quartile] ? '<span class="badge b-q">' + esc(j[idx.quartile]) + '</span>' : '') +
        (j[idx.sjr] != null ? '<span class="badge b-apc">SJR ' + j[idx.sjr] + '</span>' : '') +
        citesBadge +
        '<span class="badge b-apc">H-index ' + fmtN(j[idx.h_index]) + '</span>' +
        typeBadgeHtml(j, idx) + waiverBadge +
        '</div>' +
        '<div class="apcline">💰 <b>APC oficial:</b> ' + apcOficialHtml(j, idx) + ' &nbsp;·&nbsp; <b>Pagado real:</b> ' + apcRealHtml(j, idx) +
        (j[idx.apc_url] ? ' &nbsp;<a href="' + esc(j[idx.apc_url]) + '" target="_blank" rel="noopener">ver política APC ▸</a>' : '') +
        '</div>' + hitsLine + '</div>' +
        '<div class="jmatch"><div class="jmatchpct" style="color:' + col + '">' + r.score + '%</div>' +
        '<div class="jmatchbar"><i style="width:' + r.score + '%;background:' + col + '"></i></div>' +
        '<div class="jmatchlbl">pertinencia</div></div>' +
        '</div></div>';
    }).join('');
    container.innerHTML = resumen + cards;
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
    var r = window.JournalMatch.search(query, currentFilters());
    // El CSV exporta TODO lo que cumple los criterios (r.all), no solo las
    // que se pintan en pantalla (r.shown) -- mismo criterio que
    // investigaciontau ("Descargar las 165 revistas", aunque solo pinte 30).
    lastResults = r.all;
    renderResults(r.shown, r.all.length, r.useKw, idx);
    document.getElementById('jm-export').disabled = r.all.length === 0;
    // El conteo y el resumen ya se muestran arriba de las tarjetas
    // (renderResults) -- acá solo se limpia el status de carga inicial.
    document.getElementById('jm-status').textContent = '';
  }

  function exportCsv() {
    var idx = window.JournalMatch.getIDX();
    var rows = [['Pertinencia (%)', 'Título', 'ISSN', 'Editorial', 'País', 'Modelo de publicación',
      'Cuartil SJR', 'SJR', 'H-index', 'Citas/Doc 2 años', 'Áreas', 'APC estimado (USD)',
      'APC oficial (DOAJ)', 'APC pagado real mediano (EUR, OpenAPC)', 'n pagos OpenAPC',
      'Waiver', 'URL Scimago']];
    lastResults.forEach(function (r) {
      var j = r.journal;
      rows.push([r.score, j[idx.title], j[idx.issn], j[idx.publisher],
        j[idx.country], typeLabel(j, idx), j[idx.quartile], j[idx.sjr], j[idx.h_index],
        j[idx.cites_2y], j[idx.areas], j[idx.apc_usd], j[idx.doaj_apc],
        j[idx.apc_paid_median_eur], j[idx.apc_paid_n], j[idx.waiver], scimagoUrl(j, idx)]);
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
