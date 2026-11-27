'use strict';
/* Macar Showdown · interfaz */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = window.macar;
const { toID, leadKey } = Stats;

let M = [];          // resúmenes de partidas
let SET = {};        // ajustes
let VIEW = 'jugar';
/** Otra ventana (en el otro monitor o al lado): la misma app sin Showdown, abierta en una sección. */
const QS = new URLSearchParams(location.search);
const W2 = QS.get('w') === '2';
if (W2) {
  document.body.classList.add('w2');
  const sd = document.querySelector('#sd');
  if (sd) { const d = document.createElement('div'); d.id = 'sd'; d.className = 'sdoff'; sd.replaceWith(d); }
}
/** Filtros del Dashboard. scope: qué partidas cuentan (la sesión abierta, todo su equipo o todas). */
const F = { result: 'all', days: 0, from: 0, to: 0, lead: '', back: '', rival: '', oppLead: '', minElo: 0, mark: '', why: '', scope: 'session' };
const F_CLEAR = { result: 'all', days: 0, from: 0, to: 0, lead: '', back: '', rival: '', oppLead: '', minElo: 0, mark: '', why: '' };

/* ---------- sprites ---------- */
const NOHYPHEN = new Set(['kommoo', 'hakamoo', 'jangmoo', 'hooh', 'porygonz', 'chiyu', 'chienpao', 'tinglu', 'wochien', 'mrmime', 'mimejr', 'typenull', 'mrrime', 'nidoranf', 'nidoranm']);
function spriteId(name) {
  const full = toID(name);
  if (NOHYPHEN.has(full)) return full;
  const i = name.indexOf('-');
  return i < 0 ? full : `${toID(name.slice(0, i))}-${toID(name.slice(i + 1))}`;
}
const SPR = 'https://play.pokemonshowdown.com/sprites/gen5/';
function spr(name, cls = '') {
  const base = name.includes('-') && !NOHYPHEN.has(toID(name)) ? toID(name.split('-')[0]) : '';
  return `<img class="spr ${cls}" src="${SPR}${spriteId(name)}.png" ${base ? `data-fb="${SPR}${base}.png"` : ''} alt="" title="${esc(name)}" loading="lazy">`;
}
/** Sprite de espaldas (tu lado en la arena); si no lo hay, el normal. */
function sprBack(name, cls = '') {
  const id = spriteId(name), base = name.includes('-') && !NOHYPHEN.has(toID(name)) ? toID(name.split('-')[0]) : '';
  const fb = [`${SPR}${id}.png`, base ? `${SPR}${base}.png` : ''].filter(Boolean).join('|');
  return `<img class="spr ${cls}" src="https://play.pokemonshowdown.com/sprites/gen5-back/${id}.png" data-fb="${fb}" alt="" title="${esc(name)}">`;
}
document.addEventListener('error', e => {
  const t = e.target;
  if (t.tagName !== 'IMG') return;
  if (t.dataset.fb) { const list = t.dataset.fb.split('|'); t.src = list.shift(); if (list.length) t.dataset.fb = list.join('|'); else delete t.dataset.fb; } else t.classList.add('broken');
}, true);

/* ---------- utilidades ---------- */
const pct = (w, n) => (n ? Math.round((w / n) * 100) : 0);
const fmtDate = t => { const d = new Date(t); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const shortFormat = f => String(f || '').replace(/^\[Gen \d+[^\]]*\]\s*/, '') || '—';
const RES = { win: 'Victoria', loss: 'Derrota', tie: 'Empate' };
const pill = r => `<span class="pill ${r || 'none'}">${RES[r] || 'Sin identificar'}</span>`;
const head = (title, sub, right = '') => `<div class="head"><div><h1>${title}</h1>${sub ? `<p class="note" style="margin-top:4px">${sub}</p>` : ''}</div>${right}</div>`;

function wrRow(x, label) {
  const p = pct(x.w, x.n), cls = x.n >= 3 ? (p >= 55 ? 'hi' : p <= 45 ? 'lo' : '') : '';
  return `<div class="row" title="Ganas el ${p}% de ${x.n} partida${x.n === 1 ? '' : 's'}"><div class="who">${label}</div><div class="bar"><i class="${cls}" style="width:${Math.max(2, p)}%"></i></div><div class="num"><b>${p}%</b> <small>de ${x.n}</small></div></div>`;
}
function wrCard(title, list, labelFn, empty, limit = 8) {
  if (!list.length) return `<div class="card"><h2>${title}</h2><p class="note">${empty}</p></div>`;
  return `<div class="card"><h2>${title}</h2><div class="rows">${list.slice(0, limit).map(x => wrRow(x, labelFn(x))).join('')}</div>${list.length > limit ? `<p class="note more">y ${list.length - limit} más</p>` : ''}</div>`;
}
const monLabel = x => `${spr(x.key, 'sm')}<span>${esc(x.key)}</span>`;
const pairLabel = x => `${x.key.split(' + ').map(n => spr(n, 'sm')).join('')}<span>${esc(x.key)}</span>`;

/* ---------- navegación ---------- */
/** Pantallas que pintan otros archivos (Teambuilder, Mi PC, Optimizador, Documento): VIEWS[nombre] = función. */
const VIEWS = {};
/*
 * Sección Equipo: tu proceso en pestañas (resumen, elegir y construir, estudiar, repartos, matchups y documento).
 * En el menú es una sola entrada; abre la última pestaña que usaste.
 */
const HUB = [['miequipo', 'Resumen'], ['equipo', 'Elegir y construir'], ['estudio', 'Estudiar'], ['opt', 'Repartos (SP)'], ['mu', 'Matchups'], ['doc', 'Documento']];
const HUB_TIP = { miequipo: 'Tu equipo de un vistazo: ficha, cálculos y notas de cada Pokémon', equipo: 'Elige con qué equipo juegas, crea uno (a partir de un Pokémon o estrategia) o importa uno, y edítalo', estudio: 'Fuerza propia (velocidad, cobertura, sinergia defensiva) y fuerza relativa (contra lo más usado del meta)', opt: 'Repartos de puntos (SP) con cálculos: qué aguantar y qué tumbar', mu: 'Tu plan contra cada equipo rival', doc: 'El documento de preparación, para imprimir o repasar' };
const isHub = v => HUB.some(([k]) => k === v);
function hubBar(v) {
  const el = $('#teamHub');
  if (!el) return;
  const on = isHub(v);
  el.classList.toggle('hide', !on);
  document.body.classList.toggle('hubon', on);
  if (!on) return;
  try { localStorage.setItem('msHubTab', v); } catch (e) { /* nada */ }
  el.innerHTML = `<span class="hubt">Equipo</span><div class="hubtabs">${HUB.map(([k, l], i) => `<button data-hub="${k}" aria-current="${k === v ? 'page' : 'false'}" title="${HUB_TIP[k]}"><small>${i + 1}</small>${l}</button>`).join('')}</div>`;
}
function show(v) {
  if (W2 && v === 'jugar') v = 'dash'; // Showdown solo en la ventana principal
  if (v === 'hub') { v = 'miequipo'; try { const t = localStorage.getItem('msHubTab'); if (isHub(t)) v = t; } catch (e) { /* nada */ } }
  VIEW = v;
  hubBar(v);
  $$('.nav [data-v]').forEach(b => b.setAttribute('aria-current', (b.dataset.hub ? isHub(v) : b.dataset.v === v) ? 'page' : 'false'));
  $$('.view').forEach(x => x.classList.toggle('on', x.id === `v-${v}`));
  window.dispatchEvent(new CustomEvent('ms:view', { detail: v }));
  render();
}
$('.nav').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) show(b.dataset.hub ? 'hub' : b.dataset.v); });
$('#teamHub').addEventListener('click', e => { const b = e.target.closest('[data-hub]'); if (b) show(b.dataset.hub); });
document.addEventListener('keydown', e => {
  const ORDER = ['jugar', 'dash', 'hub', 'pc', 'calc', 'dex', 'ajustes'];
  if (e.ctrlKey && !e.altKey && !e.shiftKey && /^[1-9]$/.test(e.key)) { e.preventDefault(); show(ORDER[+e.key - 1]); }
});

let MVER = -1; // versión de la lista de partidas que ya tiene esta ventana
async function load() {
  const [r, set] = await Promise.all([api.listIf(MVER), api.settings()]);
  if (!r.same) { M = r.list; MVER = r.ver; }
  SET = set;
  if (typeof Play !== 'undefined' && Play.regLabel) Play.regLabel();
  await loadTeams();
  loadLadder();
  try { DASH.teamSets = await P.myTeam(); } catch (e) { DASH.teamSets = { sets: [] }; }
  if (!SESS.some(x => x.id === SET.sessionId) && F.scope !== 'all') F.scope = 'all';
  render(false);
  if (typeof Start !== 'undefined') Start.refresh();
}
function render(force = true) {
  if (VIEW === 'dash') Dash.render();
  else if (VIEW === 'ajustes' && force) renderSettings(); // no se repinta mientras escribes
  else if (VIEWS[VIEW] && force) Promise.resolve(VIEWS[VIEW]()).catch(e => console.error('[vista]', VIEW, e && e.stack ? e.stack : e));
}

/* ---------- Jugar ---------- */
$('#reloadSd').addEventListener('click', () => { const w = $('#sd'); if (w && w.reload) w.reload(); });
async function pollStatus() {
  try {
    const s = await api.status();
    const el = $('#capState');
    el.classList.toggle('ok', !!s.ok);
    el.classList.toggle('err', !s.ok && !!s.lastCheck);
    const txt = s.ok
      ? `Captura activa${s.me ? ` · ${esc(s.me)}` : ''}<br>${s.open} combate${s.open === 1 ? '' : 's'} abierto${s.open === 1 ? '' : 's'} · ${s.saved} guardada${s.saved === 1 ? '' : 's'} hoy`
      : esc(s.why || 'Esperando a Showdown…');
    $('span', el).innerHTML = txt;
  } catch (e) { /* sin estado */ }
}
setInterval(pollStatus, 4000);

/* ---------- Dashboard ---------- */
function emptyState() {
  return `<div class="card empty"><span class="lens" style="width:64px;height:64px" aria-hidden="true"></span><div class="steps">
    <div class="step"><b class="n">1</b><span>Pon tu usuario de Showdown para saber qué jugador eres en cada partida.</span><button class="btn" data-go="ajustes">Ir a Ajustes</button></div>
    <div class="step"><b class="n">2</b><span>Juega en la pestaña Jugar: ladder, torneos o retos. Cada combate se guarda al terminar.</span><button class="btn primary" data-go="jugar">Ir a Jugar</button></div>
    <div class="step"><b class="n">3</b><span>¿Tienes replays de antes? Impórtalos y también cuentan.</span><button class="btn" data-go="ajustes">Importar replays</button></div>
  </div></div>`;
}
function eloChart(pts) {
  if (pts.length < 2) return '<p class="note">Hace falta más de un dato de ELO para dibujar la evolución.</p>';
  const W = 600, H = 150, pad = 30;
  const rs = pts.map(p => p.r), lo = Math.min(...rs), hi = Math.max(...rs), span = Math.max(1, hi - lo);
  const xy = pts.map((p, i) => [pad + (i * (W - pad - 8)) / (pts.length - 1), H - 14 - ((p.r - lo) / span) * (H - 34)]);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución del ELO de ${lo} a ${hi}">
    <text x="0" y="${H - 12}">${lo}</text><text x="0" y="20">${hi}</text>
    <polyline points="${xy.map(p => p.join(',')).join(' ')}" fill="none" stroke="#38d4ff" stroke-width="2.5" stroke-linejoin="round"/>
    ${xy.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === xy.length - 1 ? 4.5 : 2.5}" fill="#38d4ff"/>`).join('')}</svg>`;
}
/* Qué equipo usaste en cada partida: el que elegiste a mano o, si no, el de tu Team Box que más se parece. */
let TEAMS_ME = [], MATCH_TEAM = {}, SESS = [];
let LADDER = null, LADDER_T = 0;
/** Tu ELO y GXE del ladder (como mucho una vez cada 10 minutos). */
async function loadLadder() {
  const name = (SET.showdownName || '').split(',')[0].trim();
  if (!name || Date.now() - LADDER_T < 600000) return;
  LADDER_T = Date.now();
  const r = await api.ladder(name).catch(() => null);
  if (!r || !r.ok || !r.ratings.length) return;
  const best = r.ratings.filter(x => !/bo3/.test(x.format)).sort((a, b) => (b.w + b.l) - (a.w + a.l))[0] || r.ratings[0];
  LADDER = best;
  if (VIEW === 'dash') Dash.render();
}
async function loadTeams() {
  try {
    TEAMS_ME = ((await DB.get('equipos')) || []).filter(t => t.side === 'me').map(t => ({ id: t.id, name: t.name, mons: P.parseTeam(t.text).sets.map(m => Stats.toID(P.baseSpecies(m.species))) }));
    MATCH_TEAM = (await DB.get('partidaTeam')) || {};
    SESS = await DB.get('sesiones'); if (!Array.isArray(SESS)) SESS = [];
  } catch (e) { TEAMS_ME = []; MATCH_TEAM = {}; }
}
function teamOf(s) {
  if (MATCH_TEAM[s.id]) return MATCH_TEAM[s.id];
  const me = Stats.mine(s);
  if (!me) return '';
  const mine = (me.preview.length ? me.preview : me.brought).map(x => Stats.toID(String(x).split('-')[0]));
  let best = '', bn = 0;
  for (const t of TEAMS_ME) { const n = mine.filter(x => t.mons.includes(x)).length; if (n > bn) { bn = n; best = t.id; } }
  return bn >= Math.min(3, mine.length) ? best : '';
}
const teamName = id => (TEAMS_ME.find(t => t.id === id) || {}).name || '';
const DASH = { teamSets: { sets: [] } };
/** La sesión abierta y su equipo (para elegir qué partidas cuentan en el Dashboard). */
function scopeInfo() {
  const session = SESS.find(x => x.id === SET.sessionId) || null;
  const team = session && session.teamId ? teamName(session.teamId) || 'tu equipo' : '';
  return { session, team };
}
/** Partidas que cuentan según F.scope: null = todas. */
function scopeIds() {
  const { session } = scopeInfo();
  if (!session || F.scope === 'all') return null;
  if (F.scope === 'team' && session.teamId) {
    const sids = new Set(SESS.filter(x => x.teamId === session.teamId).map(x => x.id));
    return new Set(M.filter(s => (s.session ? sids.has(s.session) : teamOf(s) === session.teamId)).map(s => s.id));
  }
  return new Set(M.filter(s => s.session === session.id).map(s => s.id));
}
const wrp = x => (x && x.n ? Math.round((x.w / x.n) * 100) : 0);
const vsTxt = (a, b) => `${wrp(a)}% (${a.n}) frente a ${wrp(b)}% (${b.n})`;

function insights(r, a) {
  const out = [];
  const diff = (x, y) => (x.n >= 3 && y.n >= 3 ? wrp(x) - wrp(y) : null);
  const d1 = diff(a.afterLoss, a.afterWin);
  if (d1 != null) out.push(d1 <= -12 ? `Después de perder te cuesta: ganas ${wrp(a.afterLoss)}% (tras ganar, ${wrp(a.afterWin)}%). Una pausa corta puede ayudar.` : 'Perder no te afecta: mantienes el nivel en la siguiente.');
  const d2 = diff(a.long, a.short);
  if (d2 != null) out.push(d2 >= 10 ? 'Ganas más en las partidas largas: tu fuerte es el final.' : d2 <= -10 ? 'Ganas más cuando la partida va rápida: tu fuerte es el principio.' : 'Rindes igual en partidas cortas y largas.');
  const d3 = diff(a.late, a.early);
  if (d3 != null) out.push(d3 <= -10 ? `En sesiones largas bajas: ${wrp(a.late)}% desde la 6.ª partida frente a ${wrp(a.early)}% en las primeras.` : 'Aguantas bien las sesiones largas.');
  if (a.bestHour) out.push(`Tu mejor hora: ${a.bestHour.key} (${wrp(a.bestHour)}% en ${a.bestHour.n} partidas).`);
  if (a.mvp && a.mvp.n >= 3) {
    const m = a.mons.find(x => x.key === a.mvp.key);
    if (m && m.lead.n >= 3 && m.back.n >= 3) { const d = wrp(m.lead) - wrp(m.back); out.push(`${m.key} ${d >= 10 ? 'rinde más abriendo' : d <= -10 ? 'rinde más desde atrás' : 'rinde igual abriendo que desde atrás'} (${vsTxt(m.lead, m.back)}).`); }
  }
  if (r.myLeads[0] && r.myLeads[0].n >= 3) out.push(`Tu lead más usado, ${r.myLeads[0].key}, gana el ${wrp(r.myLeads[0])}% (${r.myLeads[0].n} partidas).`);
  const hard = r.oppPreview.filter(x => x.n >= 3).sort((x, y) => wrp(x) - wrp(y))[0];
  if (hard && wrp(hard) < 45) out.push(`Lo que más te cuesta: ${hard.key} (ganas ${wrp(hard)}% en ${hard.n}).`);
  return out;
}
function unusedMoves(a) {
  const { sets } = DASH.teamSets || { sets: [] };
  const out = [];
  for (const m of sets) {
    const st = a.mons.find(x => Stats.toID(x.key.split('-')[0]) === Stats.toID(P.baseSpecies(m.species)));
    if (!st || st.n < 5) continue;
    const used = new Set(st.moves.map(([k]) => Stats.toID(k)));
    const never = m.moves.filter(x => x && !used.has(Stats.toID(x)));
    if (never.length) out.push(`${m.species}: ${never.join(', ')}`);
  }
  return out;
}

document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset && t.dataset.fdate) { const v = t.value ? new Date(`${t.value}T00:00:00`).getTime() : 0; F[t.dataset.fdate] = t.dataset.fdate === 'to' && v ? v + 86399999 : v; render(); }
});
document.addEventListener('click', e => {
  const c = e.target.closest('[data-fclear]'); if (c) { Object.assign(F, F_CLEAR); render(); return; }
  const op = e.target.closest('[data-open]'); if (op && VIEW === 'dash' && !op.closest('#modalBox')) { openDetail(op.dataset.open); }
});
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) { closeModal(); show(g.dataset.go); return; }
  const f = e.target.closest('[data-f]');
  if (f) { F[f.dataset.f] = f.dataset.f === 'days' ? +f.dataset.val : f.dataset.val; if (f.dataset.f === 'days' && +f.dataset.val !== -1) { F.from = 0; F.to = 0; } render(); }
});
document.addEventListener('change', e => { const s = e.target.closest('[data-fs]'); if (s) { F[s.dataset.fs] = s.value; render(); } });

/* ---------- Partidas ---------- */
/* Bo3: los juegos seguidos contra el mismo rival en un formato Bo3 forman un match. */
function groupBo3(list) {
  const asc = list.slice().sort((a, b) => a.endedAt - b.endedAt);
  const groups = [];
  for (const s of asc) {
    const op = s.opp ? Stats.toID(s[s.opp].name) : `${Stats.toID(s.p1.name)}-${Stats.toID(s.p2.name)}`;
    const g = groups[groups.length - 1];
    const w = x => x.games.filter(y => y.result === 'win').length, l = x => x.games.filter(y => y.result === 'loss').length;
    if (/bo3/.test(s.formatId || '') && g && g.bo3 && g.op === op && s.endedAt - g.end < 90 * 60000 && g.games.length < 3 && w(g) < 2 && l(g) < 2) { g.games.push(s); g.end = s.endedAt; continue; }
    groups.push({ bo3: /bo3/.test(s.formatId || ''), op, games: [s], end: s.endedAt });
  }
  return groups.reverse();
}
/* ---------- marcas de cada partida: cómo fue (buena, indiferente, mala) y si hay que analizarla ---------- */
const MARKS = [['good', 'Buena'], ['meh', 'Indiferente'], ['bad', 'Mala']];
function markHTML(s) {
  const mk = s.mark || {};
  return `<div class="mkrow" data-mkid="${esc(s.id)}"><span class="mklbl">Cómo fue</span><div class="seg mkseg">${MARKS.map(([k, l]) => `<button data-mk="${k}" class="mk-${k}" aria-pressed="${mk.r === k}">${l}</button>`).join('')}</div>
    <button class="btn sm mka${mk.a === 'done' ? ' done' : mk.a ? ' on' : ''}" data-mka="1" aria-pressed="${!!mk.a}" title="Pulsa para pasar de «Por analizar» a «Analizada» (y otra vez para quitarlo)">${mk.a === 'done' ? '✓ Analizada' : mk.a ? '🔍 Por analizar' : '+ Para analizar'}</button></div>`;
}
/** Pulsar una marca: se guarda al momento en la partida. */
document.addEventListener('click', async e => {
  const b = e.target.closest('.mkrow button');
  if (!b) return;
  const row = b.closest('.mkrow'), id = row.dataset.mkid;
  const x = M.find(y => y.id === id) || {};
  const mk = { r: '', a: false, ...(x.mark || {}) };
  // Analizar: + Para analizar → Por analizar (amarillo) → Analizada (verde) → sin marca.
  if (b.dataset.mk) mk.r = mk.r === b.dataset.mk ? '' : b.dataset.mk; else mk.a = mk.a === true ? 'done' : mk.a === 'done' ? false : true;
  x.mark = mk.r || mk.a ? mk : null;
  row.outerHTML = markHTML({ id, mark: x.mark });
  await api.setMark(id, x.mark);
});
/** Al acabar un Bo3 tuyo (o una partida suelta fuera de Bo3), sale para marcar sus partidas. Una vez por serie. */
async function askMarks(saved) {
  if (!saved || !saved.id || !saved.me || !saved.result) return;
  let asked = [];
  try { asked = JSON.parse(localStorage.getItem('msMarkAsked') || '[]'); } catch (e) { asked = []; }
  const g = groupBo3(M.filter(s => s.me)).find(x => x.games.some(y => y.id === saved.id));
  if (!g || !g.bo3) return;
  const w = g.games.filter(y => y.result === 'win').length, l = g.games.filter(y => y.result === 'loss').length;
  if (w < 2 && l < 2 && g.games.length < 3) return;
  const key = g.games[0].id;
  if (asked.includes(key)) return;
  asked = [...asked, key].slice(-200);
  try { localStorage.setItem('msMarkAsked', JSON.stringify(asked)); } catch (e) { /* nada */ }
  if (!$('#modal').classList.contains('hide')) return;
  openSet(g.games.map(y => y.id), { ask: true });
}

/** Una partida o un match Bo3: rondas, leads, reservas, megas, las notas de cada partida y las notas finales. */
async function openSet(ids, opts) {
  const games = (await Promise.all(ids.map(id => api.get(id)))).filter(Boolean);
  if (!games.length) return;
  const notes = (await DB.get('bo3Notes')) || {};
  const key = ids[0];
  const s0 = games[0].summary;
  const meSd = s0.me || 'p1', opSd = s0.opp || 'p2';
  const w = games.filter(g => g.summary.result === 'win').length, l = games.filter(g => g.summary.result === 'loss').length;
  const back = (sd, s) => s[sd].brought.filter(x => !s[sd].leads.includes(x));
  const sheet = games.map(g => g.summary[opSd].sheet).find(Boolean);
  const bo3 = games.length > 1 || /bo3/.test(s0.formatId || '');
  $('#modalBox').innerHTML = `${opts && opts.ask ? `<div class="mkask"><b>${bo3 ? 'Bo3 terminado' : 'Partida terminada'}</b><span>Marca cómo fue cada partida y si quieres analizarla. Luego puedes filtrarlas en Dashboard → Partidas.</span></div>` : ''}<div class="head"><div><h1 style="font-size:22px">${bo3 ? 'Bo3 ' : ''}vs <span class="nolang">${esc(s0[opSd].name)}</span> ${bo3 ? `<span class="pill ${w > l ? 'win' : l > w ? 'loss' : 'tie'}">${w}–${l}</span>` : pill(s0.result)}</h1>
      <p class="note">${fmtDate(s0.endedAt)} · ${esc(s0.format)}</p></div><button class="btn" id="mClose">Cerrar</button></div>
    <div class="rounds">${games.map((g, i) => { const s = g.summary; return `<div class="round">
      <div class="rhead"><b>G${i + 1}</b>${pill(s.result)}<span class="note">${s.turns} turnos</span><span style="flex:1"></span><button class="btn sm" data-open="${esc(s.id)}">Detalles</button></div>
      <button class="btn rwatch ${s.result || ''}" data-view="${esc(s.id)}">▶ Ver replay · ${s.result === 'win' ? 'Victoria' : s.result === 'loss' ? 'Derrota' : 'Empate'}</button>
      ${markHTML(s)}
      <div class="rface"><div class="rfside"><small>Tú</small><span class="rfl" title="Leads">${s[meSd].leads.map(n => spr(n, 'big')).join('')}</span><span class="rfb" title="Reserva">${back(meSd, s).map(n => spr(n, 'sm')).join('') || '—'}</span></div>
        <b class="rfvs">vs</b>
        <div class="rfside op"><small>Rival</small><span class="rfl" title="Leads">${s[opSd].leads.map(n => spr(n, 'big')).join('')}</span><span class="rfb" title="Reserva">${back(opSd, s).map(n => spr(n, 'sm')).join('') || '—'}</span></div></div>
      <div class="rfleg"><span>Arriba, leads · abajo, reserva</span>${s[opSd].megas.length ? `<span>Mega rival: ${s[opSd].megas.map(n => `${spr(n, 'xs')}<span class="nolang">${esc(n)}</span>`).join(' ')}</span>` : ''}</div>
      <label class="field">Notas de la partida<textarea data-rnote="${esc(s.id)}" rows="${Math.min(8, Math.max(2, String(g.notes || '').split('\n').length))}" placeholder="Las notas que tomaste jugando o viendo la replay…">${esc(g.notes || '')}</textarea></label>
    </div>`; }).join('')}</div>
    ${sheet ? `<h3 style="margin:14px 0 6px">Hoja de equipo del rival</h3>${sheetHTML(sheet)}` : ''}
    <label class="field finalnote" style="margin-top:12px">Notas finales<textarea id="bo3Note" rows="3" placeholder="Para cerrar: qué funcionó, qué cambiar la próxima vez…">${esc(notes[key] || '')}</textarea></label>
    <p class="note" id="bo3Saved" style="margin-top:6px"></p>`;
  $('#modal').classList.remove('hide');
  $('#mClose').onclick = closeModal;
  const box = $('#modalBox');
  box.oninput = e => {
    const t = e.target;
    clearTimeout(notesTimer);
    notesTimer = setTimeout(async () => {
      if (t.dataset.rnote) { await api.setNotes(t.dataset.rnote, t.value); const x = M.find(y => y.id === t.dataset.rnote); if (x) x.notes = t.value; }
      if (t.id === 'bo3Note') { const all = { ...((await DB.get('bo3Notes')) || {}) }; all[key] = t.value; await DB.set('bo3Notes', all); }
      $('#bo3Saved').textContent = 'Notas guardadas';
    }, 600);
  };
  const sheetMeta = { opp: s0[opSd].name, at: s0.endedAt, id: s0.id };
  box.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.ext) api.openExternal(b.dataset.ext); if (b.dataset.view) Viewer.open(b.dataset.view); if (b.dataset.open) openDetail(b.dataset.open, ids); if (sheet) sheetClick(b, sheet, sheetMeta); };
}
/** Hoja de equipo abierta → sus sets, con botón para llevar cada uno a Mi PC y el equipo a la calculadora. */
function sheetHTML(sheet) {
  return `<div class="shgrid shwide">${sheet.map((x, i) => P.sheetCard(x, { btn: `<button class="btn sm shpc" data-sheetpc="${i}" title="Guardarlo en Mi PC, en «Sets de rivales» (sin reparto: no se ve)">→ Mi PC</button>` })).join('')}</div>
    <div class="row-btns"><button class="btn sm" data-sheetcalc="1">Rival en la calculadora</button><button class="btn sm" data-sheetpcall="1">Todos los sets a Mi PC</button><button class="btn sm primary" data-sheetteam="1" title="Guarda los 6 como un equipo de rival en Mi PC → Team Box (con el reparto más común)">Equipo a Mi PC (Team Box)</button><span class="note sheetmsg"></span></div>`;
}
/** La hoja entera como equipo de rival en el Team Box (reparto más común, que no se ve). */
async function sheetToTeam(sheet, meta) {
  const U = await P.usage('');
  await P.dex();
  const sets = sheet.map(x => P.sheetSet(x, U)).filter(Boolean).map(P.cleanSet);
  if (!sets.length) return null;
  const text = P.exportTeam(sets);
  const all = await P.teams();
  const same = all.find(t => t.side === 'foe' && t.text === text);
  if (same) return { dup: true, team: same };
  const day = meta.at ? new Date(meta.at).toLocaleDateString(I18N && I18N.lang === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short' }) : '';
  const team = await P.saveTeam({ name: `vs ${meta.opp || '?'}${day ? ` · ${day}` : ''}`, side: 'foe', text, notes: '' });
  if (typeof Calc !== 'undefined' && Calc.reloadTeams) Calc.reloadTeams();
  return { team };
}
/** Los sets de la hoja a la calculadora de estudio, con el reparto más común. */
async function sheetToCalc(sheet) {
  const U = await P.usage('');
  await P.dex();
  Calc.showRivals(sheet.map(x => P.sheetSet(x, U)).filter(Boolean));
  closeModal(); show('calc');
}
/** Un Pokémon de la hoja a Mi PC (sets de rivales): todo lo de la hoja, sin reparto. */
async function sheetToPC(list, meta) {
  let n = 0;
  for (const x of list) {
    const m = P.sheetSet(x, null);
    if (!m) continue;
    m.sp = [0, 0, 0, 0, 0, 0];
    const r = await P.pcAdd(P.cleanSet(m), { side: 'foe', box: 'Rivales', notes: '' });
    if (!r.ok) continue;
    const L = (await P.pcList()).slice(), i = L.findIndex(y => y.id === r.item.id);
    if (i >= 0) { L[i] = { ...L[i], from: meta }; await DB.set('pc', L); }
    n++;
  }
  return n;
}
/** Botones de la hoja de equipo (en el detalle de la partida y en el de un Bo3). */
async function sheetClick(b, sheet, meta) {
  const msg = $('#modalBox .sheetmsg');
  if (b.dataset.sheetcalc) { sheetToCalc(sheet); return true; }
  if (b.dataset.sheetteam) {
    const r = await sheetToTeam(sheet, meta);
    if (msg) msg.textContent = !r ? 'No se pudo leer la hoja.' : r.dup ? `Ya estaba en el Team Box: «${r.team.name}».` : `Equipo guardado en Mi PC → Team Box: «${r.team.name}».`;
    if (r && !r.dup) { b.textContent = '✓ En el Team Box'; b.disabled = true; }
    return true;
  }
  if (b.dataset.sheetpc != null || b.dataset.sheetpcall) {
    const n = await sheetToPC(b.dataset.sheetpcall ? sheet : [sheet[+b.dataset.sheetpc]], meta);
    if (msg) msg.textContent = n ? `${n} guardado${n > 1 ? 's' : ''} en Mi PC (Sets de rivales).` : 'Ya estaba en Mi PC.';
    if (b.dataset.sheetpc != null && n) { b.textContent = '✓ En Mi PC'; b.disabled = true; }
    return true;
  }
  return false;
}
/** Importar replays: archivos o varios enlaces (uno por línea). */
function importModal() {
  const box = $('#modalBox');
  box.onclick = box.onchange = box.oninput = null;
  box.innerHTML = `<button class="btn x" id="mClose">Cerrar</button><h2>Importar replays de Showdown</h2>
    ${SET.showdownName ? '' : '<div class="warnbox"><span>Primero pon tu usuario de Showdown para saber qué jugador eres en cada replay.</span><button class="btn" data-go="equipo">Ir a Equipo</button></div>'}
    <p class="note">Un enlace por línea. Para replays privados copia el enlace completo (incluye la contraseña al final).</p>
    <textarea id="riUrls" rows="6" placeholder="https://replay.pokemonshowdown.com/…"></textarea>
    <div class="row-btns"><button class="btn" id="riFiles">Elegir archivos .html…</button><span class="note" id="riMsg"></span><span style="flex:1"></span><button class="btn primary" id="riGo">Importar enlaces</button></div>`;
  $('#modal').classList.remove('hide');
  $('#mClose').onclick = closeModal;
  $('#riFiles').onclick = async () => { const r = await api.importFiles(); $('#riMsg').textContent = `${r.added} nueva${r.added === 1 ? '' : 's'}${r.updated ? `, ${r.updated} ya estaba${r.updated === 1 ? '' : 'n'}` : ''}${r.failed.length ? ` · No se pudieron leer: ${r.failed.join('; ')}` : ''}`; load(); };
  $('#riGo').onclick = async () => {
    const urls = $('#riUrls').value.split(/\s+/).map(x => x.trim()).filter(Boolean);
    let ok = 0, dup = 0; const bad = [];
    for (const [i, u] of urls.entries()) {
      $('#riMsg').textContent = `Importando ${i + 1} de ${urls.length}…`;
      const r = await api.importUrl(u);
      if (!r.ok) bad.push(`${u.split('/').pop()}: ${/no es|válido|Solo/.test(r.why) ? 'No es un enlace de replay de Showdown' : r.why}`); else if (r.saved) ok++; else dup++;
    }
    $('#riMsg').textContent = `${ok} importada${ok === 1 ? '' : 's'}${dup ? ` · ${dup} ya estaba${dup === 1 ? '' : 'n'} importada${dup === 1 ? '' : 's'}` : ''}${bad.length ? ` · ${bad.join('; ')}` : ''}`;
    load();
  };
}

function sideCard(s, sd, title) {
  const x = s[sd], brought = new Set(x.brought);
  const moves = Object.entries(x.moves);
  return `<div class="card"><h2><span>${title}</span>: <span class="nolang">${esc(x.name)}</span></h2>
    <p class="note" style="margin-bottom:8px">${x.rating ? `ELO ${x.rating}${x.ratingAfter ? ` → ${x.ratingAfter}` : ''}` : 'Sin ELO'}${x.minTime != null ? ` · mínimo ${x.minTime} s en el reloj` : ''}</p>
    <div class="mons" style="margin-bottom:10px">${(x.preview.length ? x.preview : x.brought).map(n => spr(n, brought.has(n) ? '' : 'dim')).join('')}</div>
    <div class="tags" style="margin-bottom:10px"><span class="tag">Lead: ${esc(x.leads.join(' + ') || '—')}</span>${x.megas.map(m => `<span class="tag">✦ ${esc(m)}</span>`).join('')}${x.fainted.length ? `<span class="tag">Debilitados: ${x.fainted.length}</span>` : ''}</div>
    ${moves.length ? moves.map(([sp, mv]) => `<div class="mv">${spr(sp, 'sm')}<b>${esc(sp)}</b><span>${mv.map(esc).join(' · ')}</span></div>`).join('') : '<p class="note">Sin movimientos registrados.</p>'}
  </div>`;
}
let notesTimer = null;
async function openDetail(id, back) {
  const m = await api.get(id);
  if (!m) return;
  const s = m.summary;
  const a = s.me || 'p1', b = s.opp || 'p2';
  $('#modalBox').innerHTML = `<div class="head"><div><h1 style="font-size:22px">${s.me ? `vs ${esc(s[b].name)}` : `${esc(s.p1.name)} vs ${esc(s.p2.name)}`}</h1>
      <p class="note">${fmtDate(s.endedAt)} · ${esc(s.format)} · ${s.turns} turnos${s.forfeit ? ` · ${esc(s.forfeit)} abandonó` : ''}${s.timeout ? ` · ${esc(s.timeout)} perdió por tiempo` : ''} · ${s.source === 'importada' ? 'importada' : 'guardada al jugar'}</p></div>
      <div style="display:flex;gap:8px;align-items:center">${pill(s.result)}${back ? '<button class="btn" id="mBack" title="Volver al Bo3">← Atrás</button>' : ''}<button class="btn" id="mClose">Cerrar</button></div></div>
    <div class="mlinks"><button class="btn sm primary" id="mView" title="La replay dentro de la app, con tus notas por turno">▶ Ver replay</button>${s.replay ? `<button class="btn sm" id="mReplay">Abrir en Showdown</button><button class="btn sm" id="mReplayCopy">Copiar enlace</button>` : (s.me ? '<button class="btn sm" id="mReplayUp" title="Solo funciona si la sala del combate sigue abierta en Jugar">Subir replay</button>' : '')}<button class="btn sm" id="mReplayDl" title="Guarda la replay en un archivo .html que se abre en el navegador">Descargar replay</button><span class="note" id="mLinkMsg"></span></div>
    <div class="sides">${sideCard(s, a, s.me ? 'Tú' : 'Jugador 1')}${sideCard(s, b, s.me ? 'Rival' : 'Jugador 2')}</div>
    ${s[b].sheet ? `<h3 style="margin:4px 0 6px">Hoja de equipo del rival</h3>${sheetHTML(s[b].sheet)}` : ''}
    ${SESS.length ? `<label class="field" style="margin-bottom:10px">Sesión de esta partida<select id="mSess"><option value="">Sin sesión</option>${SESS.map(x => `<option value="${esc(x.id)}"${s.session === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : ''}
    ${s.me && TEAMS_ME.length ? `<label class="field" style="margin-bottom:10px">Tu equipo en esta partida<select id="mTeam"><option value="">Sin asignar</option>${TEAMS_ME.map(t => `<option value="${esc(t.id)}"${teamOf(s) === t.id ? ' selected' : ''}>${esc(t.name)}${!MATCH_TEAM[s.id] && teamOf(s) === t.id ? ' (detectado)' : ''}</option>`).join('')}</select></label>` : ''}
    ${markHTML(s)}
    <label class="field">Notas de la partida<textarea id="mNotes" placeholder="Qué viste del rival, errores, ideas para la próxima…">${esc(m.notes || '')}</textarea></label>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px"><span class="note" id="mSaved"></span><button class="btn danger" id="mDel">Borrar partida</button></div>`;
  $('#modal').classList.remove('hide');
  $('#mClose').onclick = closeModal;
  $('#mView').onclick = () => Viewer.open(id);
  if ($('#mReplay')) $('#mReplay').onclick = () => api.openExternal(s.replay);
  if ($('#mReplayCopy')) $('#mReplayCopy').onclick = () => { navigator.clipboard.writeText(s.replay); $('#mLinkMsg').textContent = 'Enlace copiado'; };
  $('#mReplayDl').onclick = async () => { const r = await api.downloadReplay(id); if (r.ok) $('#mLinkMsg').textContent = 'Replay guardada.'; };
  $('#modalBox').onclick = e => { const bt = e.target.closest('button'); if (bt && s[b].sheet) sheetClick(bt, s[b].sheet, { opp: s[b].name, at: s.endedAt, id: s.id }); };
  if ($('#mBack')) $('#mBack').onclick = () => openSet(back);
  if ($('#mReplayUp')) $('#mReplayUp').onclick = async () => { $('#mLinkMsg').textContent = 'Subiendo…'; const r = await api.replayNow(id); $('#mLinkMsg').textContent = r.ok ? 'Replay subida.' : r.why; if (r.ok) { s.replay = r.url; openDetail(id, back); } };
  if ($('#mSess')) $('#mSess').onchange = async e => { await api.setMatchSession(id, e.target.value); $('#mSaved').textContent = 'Sesión cambiada'; };
  if ($('#mTeam')) $('#mTeam').onchange = async e => {
    const map = { ...((await DB.get('partidaTeam')) || {}) };
    if (e.target.value) map[s.id] = e.target.value; else delete map[s.id];
    await DB.set('partidaTeam', map); MATCH_TEAM = map;
    $('#mSaved').textContent = 'Equipo guardado';
  };
  $('#mNotes').oninput = e => {
    clearTimeout(notesTimer);
    notesTimer = setTimeout(async () => { await api.setNotes(id, e.target.value); $('#mSaved').textContent = 'Notas guardadas'; const x = M.find(y => y.id === id); if (x) x.notes = e.target.value; }, 600);
  };
  $('#mDel').onclick = async e => {
    const btn = e.currentTarget;
    if (!btn.classList.contains('sure')) { btn.classList.add('sure'); btn.textContent = '¿Seguro? Pulsa otra vez para borrar'; return; }
    await api.remove(id); closeModal(); load();
  };
}
function closeModal() { delete $('#modal').dataset.sticky; $('#modal').classList.add('hide'); $('#modalBox').onclick = $('#modalBox').onchange = null; if (VIEW === 'dash') Dash.render(); }
// Las ventanas no se cierran con un clic fuera ni con Esc: solo con sus botones (Cerrar, ← Atrás, Guardar…).

/* ---------- Macar Dex dentro de la app (se carga la primera vez que se abre) ---------- */
VIEWS.dex = () => {
  const el = $('#v-dex');
  if (el.querySelector('webview')) return;
  el.innerHTML = `<div class="dexbar"><span class="note">Tu Macar Dex. Sus datos (sets, uso y movimientos) también los usan la Calculadora y el Teambuilder, y se renuevan cada día.</span><span style="flex:1"></span><button class="btn sm" id="dexReload">⟳ <span>Recargar</span></button><button class="btn sm" id="dexData" title="Volver a bajar ahora los datos de la Macar Dex">Actualizar datos</button></div>
    <webview id="dexWeb" src="https://macar218.github.io/macar-dex/?embed=1" partition="persist:dex"></webview>`;
  $('#dexReload').onclick = () => { const w = $('#dexWeb'); if (w && w.reload) w.reload(); };
  $('#dexData').onclick = async e => { e.target.textContent = 'Actualizando…'; await P.dex(true); e.target.textContent = 'Datos al día'; };
};

/* ---------- Ajustes ---------- */
/** Regulación: las conocidas y «Otra» con sus tres datos. */
function regForm() {
  const r = SET.reg || {}, regs = SET.regs || [], known = regs.some(x => x.id === r.id);
  return `<div class="regform"><label class="field">Regulación<select id="regSel">${regs.map(x => `<option value="${esc(x.id)}"${x.id === r.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}<option value=""${known ? '' : ' selected'}>Otra…</option></select></label>
    <div class="regother${known ? ' hide' : ''}"><label class="field">Formato de Showdown<input type="text" id="regId" value="${esc(known ? '' : r.id || '')}" placeholder="gen9championsvgc2026regmc"></label>
    <label class="field">Nombre<input type="text" id="regName" value="${esc(known ? '' : r.name || '')}" placeholder="Reg M-C"></label>
    <label class="field">Código de Limitless<input type="text" id="regLim" value="${esc(known ? '' : r.limitless || '')}" placeholder="M-C"></label>
    <button class="btn primary" id="regSave">Guardar</button></div></div>`;
}
async function renderSettings() {
  const el = $('#v-ajustes');
  const [st, dd, ex] = await Promise.all([api.status(), api.dataDir(), api.extList()]);
  el.innerHTML = head('Aj<span>ustes</span>', `Macar Showdown ${esc(SET.version || '')}`) + `<div class="grid">
    <div class="card"><h2>Tu usuario de Showdown</h2>
      <p class="note" style="margin-bottom:10px">Sirve para saber qué jugador eres en cada partida. Si tienes varias cuentas, sepáralas con comas. El usuario con el que estés conectado en Showdown se detecta solo.</p>
      <div style="display:flex;gap:8px"><input type="text" id="sName" style="flex:1" value="${esc(SET.showdownName || '')}" placeholder="Por ejemplo: toto110"><button class="btn primary" id="sSave">Guardar</button></div>
      <p id="sMsg" class="okmsg" style="margin-top:8px"></p></div>
    <div class="card"><h2>Importar replays</h2>
      <p class="note" style="margin-bottom:10px">Archivos de replay descargados de Showdown (.html) o enlaces de replay.pokemonshowdown.com. Si una partida ya estaba, no se duplica.</p>
      <button class="btn primary" id="iFiles">Elegir archivos…</button>
      <div style="display:flex;gap:8px;margin-top:12px"><input type="text" id="iUrl" style="flex:1" placeholder="https://replay.pokemonshowdown.com/…"><button class="btn" id="iGo">Importar enlace</button></div>
      <p id="iMsg" style="margin-top:8px"></p></div>
    <div class="card"><h2>Captura automática</h2>
      <dl class="kv"><dt>Estado</dt><dd>${st.ok ? 'Activa' : esc(st.why || '—')}</dd><dt>Conectado como</dt><dd>${esc(st.me || '—')}</dd>
      <dt>Combates abiertos</dt><dd>${st.open ?? 0}</dd><dt>Guardadas en esta sesión</dt><dd>${st.saved ?? 0}</dd>
      <dt>Última comprobación</dt><dd>${st.lastCheck ? new Date(st.lastCheck).toLocaleTimeString((typeof I18N !== 'undefined' && I18N.lang === 'en' ? 'en-GB' : 'es-ES')) : '—'}</dd></dl></div>
    <div class="card"><h2>Tutorial</h2>
      <p class="note" style="margin-bottom:10px">Un recorrido por la app, parte por parte: para qué sirve cada pantalla y los atajos.</p>
      <button class="btn primary" data-tourstart="1">Ver el tutorial</button></div>
    <div class="card"><h2>Language · Idioma</h2>
      <p class="note" style="margin-bottom:10px">El idioma de toda la app. Al cambiarlo, la app se recarga.</p>
      <div class="seg nolang"><button data-lang="en" aria-pressed="${I18N.lang === 'en'}">English</button><button data-lang="es" aria-pressed="${I18N.lang === 'es'}">Español</button></div></div>
    <div class="card"><h2>Replays</h2>
      <p class="note" style="margin-bottom:10px">Cada partida se guarda con su registro completo: la ves en el visor de replays de la app sin subir nada.</p>
      <label class="tog${SET.autoReplay !== false ? ' on' : ''}" style="margin-bottom:8px"><input type="checkbox" id="sReplay"${SET.autoReplay !== false ? ' checked' : ''}>Subir también la replay de cada combate a Showdown</label>
      <p class="note">Al acabar tus combates se sube sola (quien tenga el enlace puede verla) y queda enlazada en la partida.</p></div>
    <div class="card"><h2>Extensiones de Chrome</h2>
      <p class="note" style="margin-bottom:8px">Se usan dentro de Showdown en la pestaña Jugar (por ejemplo, Showdex). Añádelas desde la Chrome Web Store, un .crx/.zip o una carpeta.</p>
      <div class="extlist">${ex.length ? ex.map(x => `<div class="extrow"><b>${esc(x.name)}</b><span class="note">${esc(x.version)} · ${esc(x.source)}</span><button class="btn sm danger" data-extdel="${esc(x.id)}">Quitar</button></div>`).join('') : '<p class="note">Todavía no has añadido ninguna extensión.</p>'}</div>
      <div class="row-btns"><input type="text" id="extUrl" placeholder="Enlace de la Chrome Web Store o su identificador" style="flex:1"><button class="btn sm primary" id="extStore">Añadir desde la Chrome Web Store</button></div>
      <div class="row-btns"><span class="note">O desde tu ordenador:</span><button class="btn sm" id="extFile">.crx o .zip…</button><button class="btn sm" id="extFolder">Carpeta descomprimida…</button></div>
      <p id="extMsg" style="margin-top:6px"></p></div>
    <div class="card"><h2>Regulación</h2>
      <p class="note" style="margin-bottom:10px">Con la que juegas: la usan «Buscar partida», los sets de Smogon, los torneos de Limitless y el documento. Cuando cambie, elige la nueva o escríbela.</p>
      ${regForm()}
      <p id="regMsg" class="okmsg" style="margin-top:8px"></p></div>
    <div class="card"><h2>Copia de seguridad</h2>
      <p class="note" style="margin-bottom:10px">Todo lo tuyo (partidas, equipos, Mi PC, documentos, matchups, sesiones y ajustes) en un solo archivo. Además, la app guarda sola una copia cada semana en este ordenador (las 4 últimas).</p>
      <div class="row-btns"><button class="btn primary" id="bkSave">Guardar una copia…</button><button class="btn" id="bkPick">Restaurar una copia…</button><button class="btn sm" id="bkFolder">Copias automáticas</button></div>
      <div id="bkAsk"></div>
      <p id="bkMsg" style="margin-top:8px"></p></div>
    <div class="card wide"><h2>Tus datos en todos tus ordenadores</h2>
      <p class="note" style="margin-bottom:10px">Partidas, equipos, Mi PC, documentos y ajustes viven en una carpeta. Ponla en OneDrive y elige la misma carpeta en cada ordenador donde juegues: verás lo mismo en todos. Al volver a la ventana de la app se leen los cambios del otro ordenador.</p>
      <dl class="kv"><dt>Carpeta</dt><dd>${esc(dd.dir || '')}</dd><dt>Estado</dt><dd>${dd.onedrive && dd.dir.toLowerCase().startsWith(dd.onedrive.toLowerCase()) ? 'En OneDrive: se sincroniza' : 'Solo en este ordenador'}</dd></dl>
      <div class="row-btns">${dd.fixed ? '<span class="note">Modo de pruebas: carpeta fija.</span>' : `${dd.onedrive ? '<button class="btn primary" id="dOne">Usar OneDrive</button>' : ''}<button class="btn" id="dPick">Elegir carpeta…</button>${dd.dir !== dd.def ? '<button class="btn" id="dDef">Volver a la de este ordenador</button>' : ''}`}<button class="btn" id="oData">Abrir carpeta</button></div>
      <p class="note" style="margin-top:8px">Al cambiar, se copia lo que tengas aquí a la carpeta nueva (sin pisar lo que ya haya) y la app se reinicia.</p>
      <p id="dMsg" style="margin-top:6px"></p></div>
  </div>`;
  const extDone = async (r, msg) => {
    const m = $('#extMsg');
    if (!r.ok) { if (r.why) { m.className = 'errmsg'; m.textContent = r.why; } return; }
    await renderSettings();
    const w = $('#sd'); if (w && w.reload) w.reload();
    $('#extMsg').className = 'okmsg'; $('#extMsg').textContent = msg || `Añadida: ${r.name}. Showdown se ha recargado para usarla.`;
  };
  $('#extStore').onclick = async () => { $('#extMsg').className = 'note'; $('#extMsg').textContent = 'Descargando…'; extDone(await api.extAdd('store', $('#extUrl').value)); };
  $('#extFile').onclick = async () => extDone(await api.extAdd('file'));
  $('#extFolder').onclick = async () => extDone(await api.extAdd('folder'));
  $$('[data-extdel]').forEach(b => { b.onclick = async () => { if (!confirm('¿Quitar esta extensión?')) return; await api.extRemove(b.dataset.extdel); extDone({ ok: true }, 'Quitada. Showdown se ha recargado.'); }; });
  $$('[data-lang]').forEach(b => { b.onclick = () => { if (b.dataset.lang !== I18N.lang) I18N.setLang(b.dataset.lang); }; });
  const regSet = async reg => { Object.assign(SET, await api.setSettings({ reg })); $('#regMsg').textContent = `Regulación: ${SET.reg.name}.`; if (typeof Play !== 'undefined' && Play.regLabel) Play.regLabel(); };
  $('#regSel').onchange = e => { const x = (SET.regs || []).find(r => r.id === e.target.value); $('.regother').classList.toggle('hide', !!x); if (x) regSet(x); };
  $('#regSave').onclick = () => { const id = $('#regId').value.trim(); if (!id) { $('#regMsg').textContent = 'Falta el formato de Showdown.'; return; } regSet({ id, name: $('#regName').value.trim(), limitless: $('#regLim').value.trim() }); };
  const bkMsg = (t, ok) => { const m = $('#bkMsg'); m.className = ok ? 'okmsg' : 'errmsg'; m.textContent = t; };
  $('#bkSave').onclick = async () => { const r = await api.backupSave(); if (r.ok) bkMsg(`Copia guardada: ${r.matches} partidas y ${r.files - r.matches} archivos más.`, true); else if (r.why) bkMsg(r.why); };
  $('#bkFolder').onclick = () => api.backupFolder();
  $('#bkPick').onclick = async () => {
    const r = await api.backupPick();
    if (!r.ok) { if (r.why) bkMsg(r.why); return; }
    const when = new Date(r.created).toLocaleString(I18N.lang === 'en' ? 'en-GB' : 'es-ES');
    $('#bkAsk').innerHTML = `<div class="bkask"><p><b class="nolang">${esc(r.name)}</b> · del ${esc(when)} · ${r.matches} partidas</p>
      <p class="note">Se añaden las partidas de la copia (las que ya tengas se sustituyen por las de la copia) y se ponen sus equipos, Mi PC, documentos, matchups, sesiones y ajustes. Antes se guarda una copia de cómo está todo ahora.</p>
      <div class="row-btns"><button class="btn primary" id="bkGo">Restaurar</button><button class="btn" id="bkNo">Cancelar</button></div></div>`;
    $('#bkNo').onclick = () => { $('#bkAsk').innerHTML = ''; };
    $('#bkGo').onclick = async () => { const x = await api.backupRestore(); $('#bkAsk').innerHTML = ''; if (!x.ok) { bkMsg(x.why || 'No se pudo restaurar.'); return; } bkMsg(`Restaurados ${x.restored} archivos. La app se recarga…`, true); setTimeout(() => location.reload(), 1200); };
  };
  $('#sReplay').onchange = async e => { Object.assign(SET, await api.setSettings({ autoReplay: e.target.checked })); renderSettings(); };
  const setDir = async mode => {
    const r = await api.setDataDir(mode);
    const m = $('#dMsg');
    if (r.ok && r.same) { m.className = 'okmsg'; m.textContent = 'Ya estás usando esa carpeta.'; return; }
    if (!r.ok) { if (r.why) { m.className = 'errmsg'; m.textContent = r.why; } return; }
    m.className = 'okmsg'; m.textContent = `Listo (${r.copied} archivo${r.copied === 1 ? '' : 's'} copiados). Reiniciando…`;
  };
  if ($('#dOne')) $('#dOne').onclick = () => setDir('onedrive');
  if ($('#dPick')) $('#dPick').onclick = () => setDir('pick');
  if ($('#dDef')) $('#dDef').onclick = () => setDir('default');
  $('#sSave').onclick = async () => { SET = { ...SET, ...(await api.setSettings({ showdownName: $('#sName').value.trim() })) }; $('#sMsg').textContent = 'Guardado. Partidas actualizadas.'; M = await api.list(); };
  $('#iFiles').onclick = async () => {
    const r = await api.importFiles();
    const m = $('#iMsg');
    m.className = r.failed.length && !r.added ? 'errmsg' : 'okmsg';
    m.innerHTML = `${r.added} nueva${r.added === 1 ? '' : 's'}${r.updated ? `, ${r.updated} ya estaba${r.updated === 1 ? '' : 'n'}` : ''}.${r.failed.length ? `<br>No se pudieron leer: ${r.failed.map(esc).join('; ')}` : ''}`;
    M = await api.list();
  };
  $('#iGo').onclick = async () => {
    const r = await api.importUrl($('#iUrl').value);
    const m = $('#iMsg');
    m.className = r.ok ? 'okmsg' : 'errmsg';
    m.textContent = r.ok ? (r.saved ? 'Partida importada.' : 'Esa partida ya estaba guardada.') : r.why;
    M = await api.list();
  };
  $('#oData').onclick = () => api.openData();
}

/* ---------- arranque ---------- */
api.onChanged(d => {
  // Al volver a la ventana (o si otro ordenador cambió algo) se relee todo.
  if (d && d.focus) { DB.clear(); Calc.reloadTeams(); if (VIEWS[VIEW]) VIEWS[VIEW](); }
  // Lo ha cambiado la otra ventana: se relee eso y se repinta (salvo si estás escribiendo aquí).
  if (d && d.other && d.data) {
    DB.drop(d.data);
    if (d.data === 'equipos') Calc.reloadTeams();
    const a = document.activeElement;
    if (!(a && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) && VIEWS[VIEW]) VIEWS[VIEW]();
  }
  if (d && d.other && d.notes) { const x = M.find(y => y.id === d.notes); if (x) api.get(d.notes).then(m => { if (m) x.notes = m.notes; }); }
  load().then(() => { if (d && d.id && d.result) askMarks(d); });
});
if (W2) VIEW = /^[a-z]+$/.test(QS.get('view') || '') && QS.get('view') !== 'jugar' ? QS.get('view') : 'calc';
// En la otra ventana, su sección cuando ya están los datos y todas las pantallas (los otros archivos se cargan después).
Promise.all([load(), new Promise(r => (document.readyState === 'complete' ? r() : window.addEventListener('load', r)))]).then(() => { if (W2) show(VIEW); });
pollStatus();
/** El menú de la izquierda se puede esconder (solo iconos) y volver a sacar; se recuerda. */
(() => {
  const set = on => { document.body.classList.toggle('navmini', on); const b = $('#navMin'); if (b) { b.textContent = on ? '›' : '‹'; b.title = on ? 'Sacar el menú' : 'Esconder el menú: solo iconos y más sitio'; } try { localStorage.setItem('msNavMini', on ? '1' : '0'); } catch (e) { /* nada */ } };
  let on = false; try { on = localStorage.getItem('msNavMini') === '1'; } catch (e) { /* nada */ }
  set(on);
  document.addEventListener('click', e => { if (e.target.closest('#navMin')) set(!document.body.classList.contains('navmini')); });
})();
/** Otra ventana: con dos monitores, en el otro; con uno, las dos una al lado de la otra. */
document.addEventListener('click', e => { if (e.target.closest('#winNew')) api.newWindow(VIEW === 'jugar' ? 'calc' : VIEW); });
