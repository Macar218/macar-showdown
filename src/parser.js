'use strict';
/*
 * Macar Showdown · lector de partidas.
 * Convierte el registro de protocolo de Pokémon Showdown (las líneas "|switch|...", "|move|..." etc.)
 * en un resumen de la partida. Funciona igual con el registro capturado en directo, con un replay
 * descargado (.html) y con el JSON de replay.pokemonshowdown.com.
 */

const toID = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
const stripMega = n => n.replace(/-Mega(-[XYZ])?$/i, '');
const nameOf = details => String(details || '').split(',')[0].trim();

/** Saca el texto del registro de cualquiera de los formatos admitidos. */
function extractLog(text) {
  const s = String(text || '');
  const t = s.trimStart();
  if (t.startsWith('{')) {
    try {
      const j = JSON.parse(t);
      if (j && typeof j.log === 'string') return { log: j.log, id: j.id || null, uploadtime: j.uploadtime || null };
    } catch (e) { /* no es JSON */ }
  }
  const m = s.match(/<script[^>]*class="battle-log-data"[^>]*>([\s\S]*?)<\/script>/i);
  if (m) {
    const dec = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
    return { log: dec, id: null, uploadtime: null };
  }
  if (s.includes('\n|')) return { log: s, id: null, uploadtime: null };
  return null;
}

function parseLog(log, opts = {}) {
  const lines = String(log).split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.startsWith('|'));
  const side = () => ({ name: '', rating: null, ratingAfter: null, preview: [], leads: [], brought: [], megas: [], moves: {}, fainted: [], minTime: null });
  const S = { p1: side(), p2: side() };
  let format = '', gametype = '', rated = false, turns = 0, winner = null, tie = false, forfeit = null, timeout = null, started = false, lastT = null;

  // Nombre canónico: el de la vista previa del equipo ("Charizard" aunque luego sea "Charizard-Mega-Y").
  const canon = (sd, name) => {
    const P = S[sd].preview;
    if (P.includes(name)) return name;
    let best = '';
    for (const p of P) if (name.startsWith(p + '-') && p.length > best.length) best = p;
    return best || stripMega(name);
  };
  const add = (arr, v) => { if (v && !arr.includes(v)) arr.push(v); };
  const sideOf = slot => (slot || '').slice(0, 2);
  const nick = {}; // "p1a: Mote" -> especie canónica

  for (const line of lines) {
    const p = line.split('|');
    const cmd = p[1];
    switch (cmd) {
      case 'player': {
        const sd = p[2]; if (!S[sd]) break;
        if (p[3]) S[sd].name = p[3];
        if (p[5] && /^\d+$/.test(p[5])) S[sd].rating = +p[5];
        break;
      }
      case 'tier': format = p[2] || ''; break;
      case 'gametype': gametype = p[2] || ''; break;
      case 'rated': rated = true; break;
      case 'poke': { const sd = p[2]; if (S[sd]) add(S[sd].preview, nameOf(p[3])); break; }
      case 'switch': case 'drag': case 'replace': {
        const sd = sideOf(p[2]); if (!S[sd]) break;
        const sp = canon(sd, nameOf(p[3]));
        nick[p[2].replace(/^(p\d)[a-z]:/, '$1:')] = sp;
        add(S[sd].brought, sp);
        if (!started) add(S[sd].leads, sp);
        if (/-Mega/i.test(nameOf(p[3]))) add(S[sd].megas, nameOf(p[3]));
        break;
      }
      case 'detailschange': case '-formechange': {
        const sd = sideOf(p[2]); if (!S[sd]) break;
        const n = nameOf(p[3]);
        if (/-Mega/i.test(n)) add(S[sd].megas, n);
        break;
      }
      case 't:': if (/^\d{9,}$/.test(p[2])) lastT = +p[2] * 1000; break;
      case 'turn': started = true; turns = Math.max(turns, +p[2] || 0); break;
      case 'move': {
        const sd = sideOf(p[2]); if (!S[sd]) break;
        if (p.slice(4).some(x => /^\[from\]/.test(x) && !/lockedmove/.test(x))) break; // movimientos llamados por otro efecto
        const sp = nick[p[2].replace(/^(p\d)[a-z]:/, '$1:')] || canon(sd, p[2].split(': ')[1] || '');
        (S[sd].moves[sp] = S[sd].moves[sp] || []);
        add(S[sd].moves[sp], p[3]);
        break;
      }
      case 'faint': {
        const sd = sideOf(p[2]); if (!S[sd]) break;
        add(S[sd].fainted, nick[p[2].replace(/^(p\d)[a-z]:/, '$1:')] || p[2].split(': ')[1]);
        break;
      }
      case 'win': winner = p[2] || null; break;
      case 'tie': tie = true; break;
      case 'inactive': case 'inactiveoff': {
        const m = (p[2] || '').match(/^(.+) has (\d+) seconds? left/);
        if (m) for (const sd of ['p1', 'p2']) if (toID(S[sd].name) === toID(m[1])) S[sd].minTime = Math.min(S[sd].minTime ?? Infinity, +m[2]);
        break;
      }
      case '-message': case 'raw': case 'html': {
        const txt = p.slice(2).join('|');
        let m = txt.match(/^(.+?) forfeited\.?$/); if (m) forfeit = m[1];
        m = txt.match(/^(.+?) lost due to inactivity/); if (m) timeout = m[1];
        m = txt.match(/^(.+?)'s rating: (\d+) &rarr; <strong>(\d+)<\/strong>/);
        if (m) for (const sd of ['p1', 'p2']) if (toID(S[sd].name) === toID(m[1])) { S[sd].rating = S[sd].rating ?? +m[2]; S[sd].ratingAfter = +m[3]; }
        break;
      }
    }
  }

  // Quién soy: por el nombre que me pasen (usuario de Showdown de los ajustes o el del cliente).
  let me = null;
  const names = [].concat(opts.me || []).map(toID).filter(Boolean);
  for (const sd of ['p1', 'p2']) if (names.includes(toID(S[sd].name))) me = sd;
  const opp = me ? (me === 'p1' ? 'p2' : 'p1') : null;
  let result = null;
  if (me) result = tie ? 'tie' : winner ? (toID(winner) === toID(S[me].name) ? 'win' : 'loss') : null;
  for (const sd of ['p1', 'p2']) if (S[sd].minTime === Infinity) S[sd].minTime = null;

  return {
    id: opts.id || null,
    endedAt: lastT || opts.endedAt || Date.now(), // la hora que trae el propio registro manda
    format, formatId: toID(format), gametype, rated,
    turns, winner, tie, forfeit, timeout,
    finished: !!(winner || tie),
    me, opp, result,
    p1: S.p1, p2: S.p2
  };
}

/** Lee un archivo (html, json o registro) y devuelve el resumen, o null si no es una partida. */
function parseFile(text, opts = {}) {
  const x = extractLog(text);
  if (!x) return null;
  const r = parseLog(x.log, { ...opts, id: opts.id || x.id, endedAt: opts.endedAt || (x.uploadtime ? x.uploadtime * 1000 : undefined) });
  if (!r.p1.name && !r.p2.name) return null;
  return { summary: r, log: x.log };
}

module.exports = { toID, stripMega, extractLog, parseLog, parseFile };
