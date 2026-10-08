// api/_lib/asesor-stata-github.js — cliente mínimo de la API de GitHub para
// leer el repo privado leonidcapo/asesor-stata (solo lectura). Compartido por
// api/asesor-stata-base.js y api/asesor-stata-consulta.js.

var REPO = 'leonidcapo/asesor-stata';
var API_BASE = 'https://api.github.com';

export function GithubError(mensaje) {
  this.message = mensaje;
  this.name = 'GithubError';
}
GithubError.prototype = Object.create(Error.prototype);

async function githubRequest(pathAndQuery, token, accept) {
  var res = await fetch(API_BASE + pathAndQuery, {
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new GithubError('GitHub API respondió ' + res.status);
  return res;
}

export async function fetchFileRaw(token, path) {
  var res = await githubRequest('/repos/' + REPO + '/contents/' + path, token, 'application/vnd.github.raw+json');
  if (res === null) return null;
  return await res.text();
}

export function parseIndex(markdown) {
  var lineas = markdown.split('\n');
  var temas = [];
  var actual = null;
  for (var i = 0; i < lineas.length; i++) {
    var linea = lineas[i];
    var temaMatch = linea.match(/^##\s+(.+)$/);
    if (temaMatch) {
      actual = { nombre: temaMatch[1].trim(), notas: [] };
      temas.push(actual);
      continue;
    }
    if (!actual) continue;
    // La marca opcional "· auto" (tras la fecha) la pone el monitoreo semanal:
    // distingue el Radar de las guías escritas a mano.
    var notaMatch = linea.match(/^-\s*\[(.+?)\]\((.+?)\)(?:\s*—\s*(.*?))?(?:\s*·\s*(\d{4}-\d{2}-\d{2})(?:\s*·\s*(auto))?)?\s*$/);
    if (notaMatch) {
      actual.notas.push({
        titulo: notaMatch[1].trim(),
        path: notaMatch[2].trim(),
        resumen: (notaMatch[3] || '').trim(),
        fecha: notaMatch[4] || null,
        auto: notaMatch[5] === 'auto',
      });
    }
  }
  return { temas: temas };
}

export async function fetchKnowledgeTree(token) {
  var res = await githubRequest('/repos/' + REPO + '/git/trees/master?recursive=1', token, 'application/vnd.github+json');
  if (res === null) throw new GithubError('No se encontró la rama master del repo');
  var data = await res.json();
  return (data.tree || [])
    .filter(function (item) {
      return item.type === 'blob' && item.path.indexOf('knowledge/') === 0 && item.path.slice(-3) === '.md';
    })
    .map(function (item) { return item.path; });
}
