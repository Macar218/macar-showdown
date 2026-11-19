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
const F = { result: 'all', days: 0, format: '', lead: '', rival: '', team: '', from: 0, to: 0, session: null };

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
document.addEventListener('error', e => {
  const t = e.target;
  if (t.tagName !== 'IMG') return;
  if (t.dataset.fb) { const fb = t.dataset.fb; delete t.dataset.fb; t.src = fb; } else t.classList.add('broken');
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
  return `<div class="row"><div class="who">${label}</div><div class="bar" title="${p}% de victorias"><i class="${cls}" style="width:${Math.max(2, p)}%"></i></div><div class="num"><b>${p}%</b> · ${x.n}</div></div>`;
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
function show(v) {
  VIEW = v;
  $$('.nav [data-v]').forEach(b => b.setAttribute('aria-current', b.dataset.v === v ? 'page' : 'false'));
  $$('.view').forEach(x => x.classList.toggle('on', x.id === `v-${v}`));
  window.dispatchEvent(new CustomEvent('ms:view', { detail: v }));
  render();
}
$('.nav').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) show(b.dataset.v); });
document.addEventListener('keydown', e => {
  const ORDER = ['jugar', 'dash', 'partidas', 'equipo', 'pc', 'calc', 'opt', 'doc', 'ajustes'];
  if (e.ctrlKey && !e.altKey && !e.shiftKey && /^[1-9]$/.test(e.key)) { e.preventDefault(); show(ORDER[+e.key - 1]); }
  if (e.key === 'Escape') closeModal();
});

async function load() {
  [M, SET] = await Promise.all([api.list(), api.settings()]);
  await loadTeams();
  loadLadder();
  if (F.session == null || (F.session !== 'all' && F.session !== '-' && !SESS.some(x => x.id === F.session))) F.session = SET.sessionId && SESS.some(x => x.id === SET.sessionId) ? SET.sessionId : 'all';
  try { DASH.teamSets = await P.myTeam(); } catch (e) { DASH.teamSets = { sets: [] }; }
  render(false);
}
function render(force = true) {
  $('#navCount').textContent = M.length;
  if (VIEW === 'dash') renderDash();
  else if (VIEW === 'partidas') renderList();
  else if (VIEW === 'ajustes' && force) renderSettings(); // no se repinta mientras escribes
  else if (VIEWS[VIEW] && force) VIEWS[VIEW]();
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
function seg(key, opts) {
  return `<div class="seg" role="group">${opts.map(([v, l]) => `<button data-f="${key}" data-val="${v}" aria-pressed="${String(F[key]) === String(v)}">${l}</button>`).join('')}</div>`;
}
function sel(key, label, opts, all) {
  return `<label class="field">${label}<select data-fs="${key}"><option value="">${all}</option>${opts.map(([v, l]) => `<option value="${esc(v)}"${F[key] === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
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
  if (VIEW === 'dash') renderDash();
}
async function loadTeams() {
  try {
    TEAMS_ME = ((await DB.get('equipos')) || []).filter(t => t.side === 'me').map(t => ({ id: t.id, name: t.name, mons: P.parseTeam(t.text).sets.map(m => Stats.toID(P.baseSpecies(m.species))) }));
    MATCH_TEAM = (await DB.get('partidaTeam')) || {};
    SESS = (await DB.get('sesiones')) || [];
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
const DASH = { mon: '', rival: '', oppLead: '' };
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

function renderDash() {
  const el = $('#v-dash');
  const known = Stats.usable(M);
  if (!M.length) { el.innerHTML = head('Dash<span>board</span>', 'Tu Dashboard se llena solo con cada partida que juegues.') + emptyState(); return; }
  const unknown = M.length - known.length;
  const o = Stats.options(M);
  const ms = Stats.filter(M, { ...F, teamOf }), r = Stats.compute(ms), a = Stats.advanced(ms);
  const teamsUsed = [...new Set(known.map(teamOf).filter(Boolean))];
  const warn = unknown ? `<div class="warnbox"><span>${unknown} partida${unknown === 1 ? '' : 's'} sin identificar: no sé qué jugador eras. Pon tu usuario de Showdown en el Teambuilder o en Ajustes.</span><button class="btn" data-go="equipo">Ir a Equipo</button></div>` : '';
  const ins = ms.length ? insights(r, a) : [];
  const un = ms.length ? unusedMoves(a) : [];
  if (un.length) ins.push(`Hay movimientos que nunca usas: quizá te sirva más otro. ${un.join(' · ')}.`);
  const monSel = DASH.mon && a.mons.some(x => x.key === DASH.mon) ? DASH.mon : (a.mons[0] || {}).key;
  const mon = a.mons.find(x => x.key === monSel);
  const rivalSel = DASH.rival && a.oppMoves.some(x => x.key === DASH.rival) ? DASH.rival : (a.oppMoves[0] || {}).key;
  const rival = a.oppMoves.find(x => x.key === rivalSel);
  const oppLead = DASH.oppLead && r.oppLeads.some(x => x.key === DASH.oppLead) ? DASH.oppLead : (r.oppLeads[0] || {}).key;
  const lv = oppLead ? Stats.leadsVs(ms, oppLead) : [];
  const pick = (id, list, cur) => `<select data-dsel="${id}">${list.map(k => `<option${k === cur ? ' selected' : ''}>${esc(k)}</option>`).join('')}</select>`;
  const twoBars = (x, y) => `<div class="rows">${wrRow(x, esc(x.key))}${wrRow(y, esc(y.key))}</div>`;
  const best = r.oppPreview.filter(x => x.n >= 2).sort((x, y) => wrp(y) - wrp(x) || y.n - x.n);
  const worst = r.oppPreview.filter(x => x.n >= 2).sort((x, y) => wrp(x) - wrp(y) || y.n - x.n);
  const customDates = F.days === -1;
  const dstr = t => (t ? new Date(t).toISOString().slice(0, 10) : '');
  el.innerHTML = head('Dash<span>board</span>', `${known.length} partida${known.length === 1 ? '' : 's'} identificada${known.length === 1 ? '' : 's'}`, '<button class="btn primary" data-go="doc">PDF de preparación</button>') + warn + `
    <div class="filters">
      <div class="field">Resultado${seg('result', [['all', 'Todas'], ['win', 'Victorias'], ['loss', 'Derrotas']])}</div>
      <div class="field">Fechas${seg('days', [[0, 'Todo'], [1, 'Hoy'], [7, '7 días'], [30, '30 días'], [-1, 'Elegir fechas']])}</div>
      ${customDates ? `<div class="field">Desde<input type="date" data-fdate="from" value="${dstr(F.from)}"></div><div class="field">Hasta<input type="date" data-fdate="to" value="${dstr(F.to ? F.to - 86399999 : 0)}"></div>` : ''}
      ${SESS.length ? `<div class="field">Sesión<select data-fs="session"><option value="all"${F.session === 'all' ? ' selected' : ''}>Todas las partidas</option>${SESS.map(x => `<option value="${esc(x.id)}"${F.session === x.id ? ' selected' : ''}>${esc(x.name)}${x.id === SET.sessionId ? ' (abierta)' : ''}</option>`).join('')}<option value="-"${F.session === '-' ? ' selected' : ''}>Sin sesión</option></select></div>` : ''}
      ${teamsUsed.length ? sel('team', 'Tu equipo', teamsUsed.map(id => [id, teamName(id)]), 'Todos') : ''}
      ${sel('format', 'Formato', o.formats.map(([id, n]) => [id, shortFormat(n)]), 'Todos')}
      ${sel('lead', 'Tu lead', o.leads.map(x => [x, x]), 'Cualquiera')}
      ${sel('rival', 'Rival con', o.rivals.map(x => [x, x]), 'Cualquiera')}
      ${F.result !== 'all' || F.days || F.format || F.lead || F.rival || F.team ? '<button class="btn sm" data-fclear="1" style="align-self:flex-end">Quitar el filtro</button>' : ''}
    </div>
    ${!ms.length ? '<div class="card"><p class="note">Aún no hay partidas con estos filtros.</p></div>' : `
    <div class="kpis">
      <div class="kpi"><small>Partidas</small><b>${r.n}</b></div>
      <div class="kpi"><small>Récord</small><b>${r.w}–${r.l}${r.t ? `–${r.t}` : ''}</b></div>
      <div class="kpi"><small>Victorias</small><b>${pct(r.w, r.n)}%</b></div>
      <div class="kpi" id="kElo"><small>ELO</small><b>${r.eloNow ?? '—'}</b><i>último conocido</i></div>
      <div class="kpi" id="kGxe" title="GXE del ladder de Showdown (probabilidad de ganar a un rival cualquiera)"><small>GXE</small><b>${LADDER && LADDER.gxe != null ? `${LADDER.gxe}%` : '—'}</b><i>${LADDER && LADDER.gxe != null ? `ladder · ${LADDER.w}–${LADDER.l}` : 'ladder Reg M-C'}</i></div>
      <div class="kpi"><small>Racha</small><b class="${a.streak > 0 ? 'okc' : a.streak < 0 ? 'badc' : ''}">${a.streak > 0 ? `+${a.streak}` : a.streak}</b><i>mejor +${a.bestStreak} · peor ${a.worstStreak}</i></div>
      <div class="kpi"><small>Turnos</small><b>${r.avgTurns.toFixed(1)}</b><i>de media</i></div>
      <div class="kpi"><small>Apuros de tiempo</small><b>${r.timeScares}</b><i>≤10 s en algún turno</i></div>
    </div>
    ${(() => { const ss = SESS.find(x => x.id === F.session); if (!ss) return ''; return `<div class="card sesscard"><div><small>Tu sesión</small><b>${esc(ss.name)}</b></div><div class="sgoal"><small>Objetivo de la sesión</small><span>${ss.goal ? esc(ss.goal) : '<span class="note">Sin objetivo: ponle uno en el botón de sesión (arriba a la izquierda).</span>'}</span></div><div><small>En la sesión</small><b>${r.w}–${r.l}</b><span class="note">${pct(r.w, r.n)}% · ${r.n} partida${r.n === 1 ? '' : 's'}</span></div>${r.n === 1 ? '<p class="note" style="grid-column:1/-1">Con una sola partida, tu estadística es o perfecta o un desastre. Juega más antes de sacar conclusiones.</p>' : ''}</div>`; })()}
    <div class="dtop">
      ${a.mvp ? `<div class="card mvp"><h2>Tu MVP</h2><div class="mvpbody">${spr(a.mvp.key, 'big')}<div><b>${esc(a.mvp.key)}</b><span class="big">${wrp(a.mvp)}%</span><span class="note">${a.mvp.n} partidas con él</span>
        ${(() => { const m = a.mons.find(x => x.key === a.mvp.key); return m && m.without.n ? `<div class="rows" style="margin-top:8px">${wrRow({ ...m, key: 'Con él' }, 'Con él')}${wrRow({ ...m.without, key: 'Sin él' }, 'Sin él')}</div>` : ''; })()}</div></div></div>` : '<div class="card mvp"><h2>Tu MVP</h2><p class="note">Juega unas partidas y aquí sale tu MVP.</p></div>'}
      <div class="card resumen"><h2>Tu resumen</h2>${ins.length ? `<ul class="ins">${ins.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="note">Aún hay pocas partidas para saberlo.</p>'}</div>
    </div>
    <h3 class="dsec">Tu equipo</h3>
    <div class="grid">
      ${wrCard('Lo que más usas', r.myMons, monLabel, 'Sin datos.')}
      <div class="card"><h2>¿Abriendo o desde atrás?</h2>${a.mons.length ? `<table class="lb"><thead><tr><th></th><th>De lead</th><th>De reserva</th></tr></thead><tbody>${a.mons.slice(0, 8).map(m => `<tr><td>${spr(m.key, 'sm')}${esc(m.key)}</td><td>${m.lead.n ? `<b>${wrp(m.lead)}%</b> <small>${m.lead.n}</small>` : '—'}</td><td>${m.back.n ? `<b>${wrp(m.back)}%</b> <small>${m.back.n}</small>` : '—'}</td></tr>`).join('')}</tbody></table>` : '<p class="note">Sin datos.</p>'}</div>
      ${wrCard('Tus parejas de leads', r.myLeads, pairLabel, 'Sin datos.')}
      ${wrCard('Con quién funciona', a.pairs, pairLabel, 'Hacen falta al menos 2 partidas con la misma pareja.')}
      <div class="card"><h2>Contra quién brilla · sufre ${pick('mon', a.mons.map(x => x.key), monSel)}</h2>${mon ? `<div class="bs"><div><h4 class="okc">Contra quién brilla</h4>${mon.best.length ? `<div class="rows">${mon.best.map(x => wrRow(x, monLabel(x))).join('')}</div>` : '<p class="note">Pocas partidas aún.</p>'}</div>
        <div><h4 class="badc">Contra quién sufre</h4>${mon.worst.length ? `<div class="rows">${mon.worst.map(x => wrRow(x, monLabel(x))).join('')}</div>` : '<p class="note">Pocas partidas aún.</p>'}</div></div>
        ${mon.moves.length ? `<p class="note" style="margin-top:8px">Sus movimientos: ${mon.moves.map(([k, n]) => `${esc(k)} (${n})`).join(' · ')}</p>` : ''}` : '<p class="note">Sin datos.</p>'}</div>
    </div>
    <h3 class="dsec">Los rivales</h3>
    <div class="grid">
      ${wrCard('Los que más ves', r.oppPreview, monLabel, 'Sin datos.', 10)}
      ${wrCard('Contra lo que más ganas', best, monLabel, 'Hacen falta al menos 2 partidas.', 6)}
      ${wrCard('Lo que más te cuesta', worst, monLabel, 'Hacen falta al menos 2 partidas.', 6)}
      <div class="card"><h2>Cómo te abren</h2>${r.oppLeads.length ? `<div class="rows">${r.oppLeads.slice(0, 6).map(x => `<div class="rowpick${x.key === oppLead ? ' on' : ''}" data-dlead="${esc(x.key)}">${wrRow(x, pairLabel(x))}</div>`).join('')}</div>
        <h4 style="margin-top:10px">Tus leads contra ${esc(oppLead || '')}</h4>${lv.length ? `<div class="rows">${lv.slice(0, 5).map(x => wrRow(x, pairLabel(x))).join('')}</div>` : '<p class="note">Sin datos.</p>'}` : '<p class="note">Sin datos.</p>'}</div>
      <div class="card"><h2>Sus movimientos ${a.oppMoves.length ? pick('rival', a.oppMoves.map(x => x.key), rivalSel) : ''}</h2>${rival ? `<div class="movs">${spr(rival.key)}<ul>${rival.moves.slice(0, 10).map(([k, n]) => `<li><b>${esc(k)}</b><span class="note">${Math.round((n / rival.n) * 100)}% · ${n}</span></li>`).join('')}</ul></div><p class="note">Visto en ${rival.n} partida${rival.n === 1 ? '' : 's'}.</p>` : '<p class="note">Sin datos.</p>'}</div>
      ${wrCard('Megas rivales', r.oppMegas, monLabel, 'Ningún rival ha megaevolucionado.')}
    </div>
    <h3 class="dsec">Cómo juegas</h3>
    <div class="grid">
      <div class="card"><h2>Tu mejor hora</h2><div class="rows">${a.hours.filter(h => h.n).map(h => wrRow(h, esc(h.key))).join('') || '<p class="note">Sin datos.</p>'}</div></div>
      <div class="card"><h2>Por día de la semana</h2><div class="rows">${a.days.filter(h => h.n).map(h => wrRow(h, esc(h.key))).join('') || '<p class="note">Sin datos.</p>'}</div></div>
      <div class="card"><h2>Cortas o largas</h2>${twoBars(a.short, a.long)}</div>
      <div class="card"><h2>Partidas seguidas</h2>${twoBars(a.afterWin, a.afterLoss)}<div class="rows" style="margin-top:6px">${wrRow(a.early, esc(a.early.key))}${wrRow(a.late, esc(a.late.key))}</div><p class="note" style="margin-top:6px">${a.sessions} sesiones (una sesión acaba tras 45 min sin jugar).</p></div>
      <div class="card"><h2>En el Bo3</h2>${a.bo3.n ? `<div class="kpis mini"><div class="kpi"><small>Sets</small><b>${a.bo3.w}–${a.bo3.n - a.bo3.w}</b></div><div class="kpi"><small>Win % de sets</small><b>${wrp(a.bo3)}%</b></div></div>
        <div class="rows">${a.bo3.g.filter(g => g.n).map(g => wrRow(g, g.key)).join('')}${wrRow({ ...a.bo3.closeAfterG1 }, 'Cierras tras ganar G1')}${wrRow({ ...a.bo3.comeback }, 'Remontas tras perder G1')}</div>` : '<p class="note">Sin series Bo3 todavía.</p>'}</div>
      <div class="card elo"><h2>ELO</h2>${eloChart(r.elo)}</div>
      <div class="card wide"><h2>Últimas partidas</h2><div class="recent">${a.recent.map(s => { const me = Stats.mine(s), op = Stats.theirs(s); return `<button class="rec" data-open="${esc(s.id)}">${pill(s.result)}<span class="vsn">vs ${esc(op.name)}</span><span class="mons">${me.leads.map(x => spr(x, 'xs')).join('')}<i>·</i>${op.leads.map(x => spr(x, 'xs')).join('')}</span><span class="note">${fmtDate(s.endedAt)}${teamOf(s) ? ` · ${esc(teamName(teamOf(s)))}` : ''}</span></button>`; }).join('')}</div></div>
    </div>
    <p class="note" style="margin-top:12px">% = tus victorias en las partidas donde aparece. Verde ≥55 % y rojo ≤45 % solo con 3 partidas o más. "Tus Pokémon" cuenta los que salieron al combate.</p>`}`;
}
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset && t.dataset.dsel) { DASH[t.dataset.dsel] = t.value; renderDash(); }
  if (t.dataset && t.dataset.fdate) { const v = t.value ? new Date(`${t.value}T00:00:00`).getTime() : 0; F[t.dataset.fdate] = t.dataset.fdate === 'to' && v ? v + 86399999 : v; render(); }
});
document.addEventListener('click', e => {
  const l = e.target.closest('[data-dlead]'); if (l) { DASH.oppLead = l.dataset.dlead; renderDash(); return; }
  const c = e.target.closest('[data-fclear]'); if (c) { Object.assign(F, { result: 'all', days: 0, format: '', lead: '', rival: '', team: '', from: 0, to: 0 }); render(); return; }
  const op = e.target.closest('[data-open]'); if (op && VIEW === 'dash') { openDetail(op.dataset.open); }
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
const LF = { session: 'all', q: '' };
function matchRow(s) {
  const me = s.me ? s[s.me] : s.p1, op = s.opp ? s[s.opp] : s.p2;
  const brought = new Set(op.brought);
  return `<button class="match" data-id="${esc(s.id)}">
      <span class="d">${fmtDate(s.endedAt)}</span>
      ${pill(s.result)}
      <span class="vs"><b>${s.me ? `vs ${esc(op.name)}` : `${esc(s.p1.name)} vs ${esc(s.p2.name)}`}</b><small>${op.rating ? `${op.rating} ELO · ` : ''}${esc(shortFormat(s.format))}${s.session && SESS.find(x => x.id === s.session) ? ` · ${esc(SESS.find(x => x.id === s.session).name)}` : ''}</small></span>
      <span class="mons" title="Tu lead">${me.leads.map(n => spr(n, 'sm')).join('')}</span>
      <span class="mons" title="Equipo rival (en gris, los que no salieron)">${op.preview.map(n => spr(n, `sm${brought.has(n) ? '' : ' dim'}`)).join('')}</span>
      <span class="t">${s.turns} t${s.notes ? ' ✎' : ''}${s.replay ? ' ▶' : ''}</span>
    </button>`;
}
function renderList() {
  const el = $('#v-partidas');
  const right = '<button class="btn primary" id="lImport">Importar replays</button>';
  if (!M.length) { el.innerHTML = head('Parti<span>das</span>', 'Todavía no hay partidas. Juega desde la pestaña Jugar o importa tus replays.', right) + emptyState(); return; }
  let L = M;
  if (LF.session !== 'all') L = L.filter(s => (s.session || '-') === LF.session);
  const q = LF.q.toLowerCase();
  if (q) L = L.filter(s => `${s.p1.name} ${s.p2.name} ${s.p1.preview.join(' ')} ${s.p2.preview.join(' ')} ${s.notes || ''}`.toLowerCase().includes(q));
  const groups = groupBo3(L);
  const sets = groups.filter(g => g.bo3 && g.games.length > 1 && g.games[0].me);
  const setW = sets.filter(g => g.games.filter(x => x.result === 'win').length >= 2).length;
  el.innerHTML = head('Parti<span>das</span>', `${L.length} partida${L.length === 1 ? '' : 's'}${sets.length ? ` · ${sets.length} match${sets.length === 1 ? '' : 'es'} Bo3 (${setW}–${sets.length - setW}, win % de sets ${Math.round((setW / sets.length) * 100)}%)` : ''} · pulsa una para ver el detalle`, right) + `
    <div class="filters"><div class="field" style="flex:1">Buscar<input type="search" id="lQ" placeholder="Rival, Pokémon o notas…" value="${esc(LF.q)}"></div>
      ${SESS.length ? `<div class="field">Sesión<select id="lSess"><option value="all">Todas</option>${SESS.map(x => `<option value="${esc(x.id)}"${LF.session === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}<option value="-"${LF.session === '-' ? ' selected' : ''}>Sin sesión</option></select></div>` : ''}</div>
    <div class="mlist">${groups.map(g => {
      if (!(g.bo3 && g.games.length > 1)) return g.games.map(matchRow).join('');
      const w = g.games.filter(x => x.result === 'win').length, l = g.games.filter(x => x.result === 'loss').length;
      const first = g.games[0], op = first.opp ? first[first.opp].name : first.p2.name;
      const done = w === 2 || l === 2;
      return `<div class="bo3">
        <div class="bo3head"><span class="pill ${w > l ? 'win' : l > w ? 'loss' : 'tie'}">Bo3 ${w}–${l}</span><b>vs ${esc(op)}</b><span class="note">${fmtDate(first.endedAt)}${done ? '' : ' · Faltan rondas por registrar'}</span>
          <span class="bo3g">${g.games.map((x, i) => `<button class="gbtn ${x.result || ''}" data-id="${esc(x.id)}" title="Ver G${i + 1}">G${i + 1}</button>`).join('')}</span>
          <button class="btn sm" data-set="${esc(g.games.map(x => x.id).join(','))}">Rondas y notas del match</button></div>
      </div>`;
    }).join('')}</div>
    <p class="note" style="margin-top:8px">Pulsa G1, G2 o G3 para ver su partida, o el match para ver sus rondas y notas. ▶ = tiene replay en Showdown.</p>`;
  $('#lImport').onclick = importModal;
}
document.addEventListener('input', e => { if (e.target.id === 'lQ') { LF.q = e.target.value; clearTimeout(LF.t); LF.t = setTimeout(() => { const pos = e.target.selectionStart; renderList(); const i = $('#lQ'); i.focus(); i.setSelectionRange(pos, pos); }, 250); } });
document.addEventListener('change', e => { if (e.target.id === 'lSess') { LF.session = e.target.value; renderList(); } });
document.addEventListener('click', e => { const b = e.target.closest('[data-set]'); if (b && VIEW === 'partidas') openSet(b.dataset.set.split(',')); });

/** Un match Bo3: rondas, leads, reservas, megas, notas de cada ronda y conclusiones del set. */
async function openSet(ids) {
  const games = (await Promise.all(ids.map(id => api.get(id)))).filter(Boolean);
  if (!games.length) return;
  const notes = (await DB.get('bo3Notes')) || {};
  const key = ids[0];
  const s0 = games[0].summary;
  const meSd = s0.me || 'p1', opSd = s0.opp || 'p2';
  const w = games.filter(g => g.summary.result === 'win').length, l = games.filter(g => g.summary.result === 'loss').length;
  const back = (sd, s) => s[sd].brought.filter(x => !s[sd].leads.includes(x));
  const sheet = games.map(g => g.summary[opSd].sheet).find(Boolean);
  $('#modalBox').innerHTML = `<div class="head"><div><h1 style="font-size:22px">Bo3 vs ${esc(s0[opSd].name)} <span class="pill ${w > l ? 'win' : l > w ? 'loss' : 'tie'}">${w}–${l}</span></h1>
      <p class="note">${fmtDate(s0.endedAt)} · ${esc(s0.format)}${w === 1 && games[0].summary.result === 'loss' && w + l < 3 ? '' : ''}</p></div><button class="btn" id="mClose">Cerrar</button></div>
    <div class="rounds">${games.map((g, i) => { const s = g.summary; return `<div class="round">
      <div class="rhead"><b>G${i + 1}</b>${pill(s.result)}<span class="note">${s.turns} turnos</span>${s.replay ? `<button class="btn sm" data-ext="${esc(s.replay)}">Ver replay</button>` : ''}<button class="btn sm" data-open="${esc(s.id)}">Ver partida</button></div>
      <div class="rgrid"><span>Tus leads</span><span>${s[meSd].leads.map(n => spr(n, 'sm')).join('')}</span><span>Tu reserva</span><span>${back(meSd, s).map(n => spr(n, 'sm')).join('') || '—'}</span>
        <span>Sus leads</span><span>${s[opSd].leads.map(n => spr(n, 'sm')).join('')}</span><span>Su reserva</span><span>${back(opSd, s).map(n => spr(n, 'sm')).join('') || '—'}</span>
        <span>Mega rival</span><span>${s[opSd].megas.map(n => `${spr(n, 'sm')}${esc(n)}`).join(' ') || '—'}</span></div>
      <label class="field">Notas de esta ronda<textarea data-rnote="${esc(s.id)}" rows="2" placeholder="Qué pasó en esta ronda…">${esc(g.notes || '')}</textarea></label>
    </div>`; }).join('')}</div>
    ${sheet ? `<h3 style="margin:14px 0 6px">Hoja de equipo del rival</h3>${sheetHTML(sheet)}` : '<p class="note" style="margin-top:10px">Sets incompletos: este match no trae hoja de equipo; en cada partida ves lo que usó.</p>'}
    <label class="field" style="margin-top:12px">Conclusiones del set<textarea id="bo3Note" rows="3" placeholder="Conclusiones del set: qué funcionó, qué cambiar…">${esc(notes[key] || '')}</textarea></label>
    <p class="note" id="bo3Saved" style="margin-top:6px"></p>`;
  $('#modal').classList.remove('hide');
  $('#mClose').onclick = closeModal;
  const box = $('#modalBox');
  box.oninput = e => {
    const t = e.target;
    clearTimeout(notesTimer);
    notesTimer = setTimeout(async () => {
      if (t.dataset.rnote) await api.setNotes(t.dataset.rnote, t.value);
      if (t.id === 'bo3Note') { const all = { ...((await DB.get('bo3Notes')) || {}) }; all[key] = t.value; await DB.set('bo3Notes', all); }
      $('#bo3Saved').textContent = 'Notas guardadas';
    }, 600);
  };
  box.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.ext) api.openExternal(b.dataset.ext); if (b.dataset.open) openDetail(b.dataset.open); if (b.dataset.sheetcalc) sheetToCalc(sheet, s0[opSd].name); };
}
/** Hoja de equipo abierta → tabla con sus sets y botón para cargarla como rival. */
function sheetHTML(sheet) {
  return `<div class="sheet">${sheet.map(x => `<div class="sheetmon">${spr(x.species, 'sm')}<div><b>${esc(x.species)}</b><span>${[P.nameOf('items', x.item) || 'Sin objeto', /^[01H]$/.test(x.ability) ? '' : P.nameOf('abilities', x.ability), x.nature].filter(Boolean).map(esc).join(' · ')}</span><small>${x.moves.map(m => esc(P.nameOf('moves', m))).join(' / ')}</small></div></div>`).join('')}</div>
    <div class="row-btns"><button class="btn sm" data-sheetcalc="1">Rival en la calculadora</button></div>`;
}
async function sheetToCalc(sheet, name) {
  const [U, T] = await Promise.all([P.usage(''), P.tour()]);
  const team = sheet.map(x => ({ id: Stats.toID(x.species), name: x.species, item: x.item, ability: /^[01H]$/.test(x.ability) ? '' : x.ability, nature: x.nature, moves: x.moves }));
  const sets = P.tourTeamSets(team, U).map(m => ({ ...m, src: 'equipo' }));
  const v = await P.saveTeam({ name: `Hoja de ${name}`.slice(0, 100), side: 'foe', text: P.exportTeam(sets), notes: 'Hoja de equipo abierta de un combate. Puntos (SP) estimados con Smogon.' });
  closeModal(); Calc.reloadTeams(); Calc.setTeams(undefined, v.id); show('calc');
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
$('#v-partidas').addEventListener('click', e => { const b = e.target.closest('.match, .gbtn'); if (b) openDetail(b.dataset.id); });

function sideCard(s, sd, title) {
  const x = s[sd], brought = new Set(x.brought);
  const moves = Object.entries(x.moves);
  return `<div class="card"><h2>${title}: ${esc(x.name)}</h2>
    <p class="note" style="margin-bottom:8px">${x.rating ? `ELO ${x.rating}${x.ratingAfter ? ` → ${x.ratingAfter}` : ''}` : 'Sin ELO'}${x.minTime != null ? ` · mínimo ${x.minTime} s en el reloj` : ''}</p>
    <div class="mons" style="margin-bottom:10px">${(x.preview.length ? x.preview : x.brought).map(n => spr(n, brought.has(n) ? '' : 'dim')).join('')}</div>
    <div class="tags" style="margin-bottom:10px"><span class="tag">Lead: ${esc(x.leads.join(' + ') || '—')}</span>${x.megas.map(m => `<span class="tag">✦ ${esc(m)}</span>`).join('')}${x.fainted.length ? `<span class="tag">Debilitados: ${x.fainted.length}</span>` : ''}</div>
    ${moves.length ? moves.map(([sp, mv]) => `<div class="mv">${spr(sp, 'sm')}<b>${esc(sp)}</b><span>${mv.map(esc).join(' · ')}</span></div>`).join('') : '<p class="note">Sin movimientos registrados.</p>'}
  </div>`;
}
let notesTimer = null;
async function openDetail(id) {
  const m = await api.get(id);
  if (!m) return;
  const s = m.summary;
  const a = s.me || 'p1', b = s.opp || 'p2';
  $('#modalBox').innerHTML = `<div class="head"><div><h1 style="font-size:22px">${s.me ? `vs ${esc(s[b].name)}` : `${esc(s.p1.name)} vs ${esc(s.p2.name)}`}</h1>
      <p class="note">${fmtDate(s.endedAt)} · ${esc(s.format)} · ${s.turns} turnos${s.forfeit ? ` · ${esc(s.forfeit)} abandonó` : ''}${s.timeout ? ` · ${esc(s.timeout)} perdió por tiempo` : ''} · ${s.source === 'importada' ? 'importada' : 'guardada al jugar'}</p></div>
      <div style="display:flex;gap:8px;align-items:center">${pill(s.result)}<button class="btn" id="mClose">Cerrar</button></div></div>
    <div class="mlinks">${s.replay ? `<button class="btn sm" id="mReplay">Ver replay en Showdown</button><button class="btn sm" id="mReplayCopy">Copiar enlace</button>` : (s.me ? '<button class="btn sm" id="mReplayUp" title="Solo funciona si la sala del combate sigue abierta en Jugar">Subir replay</button>' : '')}<button class="btn sm" id="mReplayDl" title="Guarda la replay en un archivo .html que se abre en el navegador">Descargar replay</button><span class="note" id="mLinkMsg"></span></div>
    <div id="mVideo"></div>
    <div class="sides">${sideCard(s, a, s.me ? 'Tú' : 'Jugador 1')}${sideCard(s, b, s.me ? 'Rival' : 'Jugador 2')}</div>
    ${s[b].sheet ? `<h3 style="margin:4px 0 6px">Hoja de equipo del rival</h3>${sheetHTML(s[b].sheet).replace('data-sheetcalc="1"', 'id="mSheetCalc"')}` : ''}
    ${SESS.length ? `<label class="field" style="margin-bottom:10px">Sesión de esta partida<select id="mSess"><option value="">Sin sesión</option>${SESS.map(x => `<option value="${esc(x.id)}"${s.session === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : ''}
    ${s.me && TEAMS_ME.length ? `<label class="field" style="margin-bottom:10px">Tu equipo en esta partida<select id="mTeam"><option value="">Sin asignar</option>${TEAMS_ME.map(t => `<option value="${esc(t.id)}"${teamOf(s) === t.id ? ' selected' : ''}>${esc(t.name)}${!MATCH_TEAM[s.id] && teamOf(s) === t.id ? ' (detectado)' : ''}</option>`).join('')}</select></label>` : ''}
    <label class="field">Notas de la partida<textarea id="mNotes" placeholder="Qué viste del rival, errores, ideas para la próxima…">${esc(m.notes || '')}</textarea></label>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px"><span class="note" id="mSaved"></span><button class="btn danger" id="mDel">Borrar partida</button></div>`;
  $('#modal').classList.remove('hide');
  $('#mClose').onclick = closeModal;
  if ($('#mReplay')) $('#mReplay').onclick = () => api.openExternal(s.replay);
  if ($('#mReplayCopy')) $('#mReplayCopy').onclick = () => { navigator.clipboard.writeText(s.replay); $('#mLinkMsg').textContent = 'Enlace copiado'; };
  $('#mReplayDl').onclick = async () => { const r = await api.downloadReplay(id); if (r.ok) $('#mLinkMsg').textContent = 'Replay guardada.'; };
  if ($('#mSheetCalc')) $('#mSheetCalc').onclick = () => sheetToCalc(s[s.opp || 'p2'].sheet, s[s.opp || 'p2'].name);
  if ($('#mReplayUp')) $('#mReplayUp').onclick = async () => { $('#mLinkMsg').textContent = 'Subiendo…'; const r = await api.replayNow(id); $('#mLinkMsg').textContent = r.ok ? 'Replay subida.' : r.why; if (r.ok) { s.replay = r.url; openDetail(id); } };
  api.videoFor(id).then(v => {
    if (!v || !$('#mVideo')) return;
    $('#mVideo').innerHTML = `<video class="mvideo" controls preload="metadata" src="${esc(v)}"></video><div class="row-btns" style="margin-top:0;margin-bottom:10px"><button class="btn sm" id="mVidOpen">Abrir carpeta de vídeos</button><button class="btn sm danger" id="mVidDel">Borrar vídeo</button></div>`;
    $('#mVidOpen').onclick = () => api.openVideos();
    $('#mVidDel').onclick = async () => { if (!confirm('¿Borrar el vídeo de esta partida?')) return; await api.deleteVideo(id); $('#mVideo').innerHTML = ''; };
  });
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
function closeModal() { $('#modal').classList.add('hide'); $('#modalBox').onclick = $('#modalBox').onchange = null; if (VIEW === 'partidas') renderList(); }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

/* ---------- Ajustes ---------- */
async function renderSettings() {
  const el = $('#v-ajustes');
  const [st, dd, vd, ex] = await Promise.all([api.status(), api.dataDir(), api.videosDir(), api.extList()]);
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
    <div class="card"><h2>Language · Idioma</h2>
      <p class="note" style="margin-bottom:10px">El idioma de toda la app. Al cambiarlo, la app se recarga.</p>
      <div class="seg nolang"><button data-lang="en" aria-pressed="${I18N.lang === 'en'}">English</button><button data-lang="es" aria-pressed="${I18N.lang === 'es'}">Español</button></div></div>
    <div class="card"><h2>Replays y vídeo</h2>
      <label class="tog${SET.autoReplay !== false ? ' on' : ''}" style="margin-bottom:8px"><input type="checkbox" id="sReplay"${SET.autoReplay !== false ? ' checked' : ''}>Subir la replay de cada combate a Showdown</label>
      <p class="note" style="margin-bottom:10px">Al acabar tus combates se sube sola (quien tenga el enlace puede verla) y queda enlazada en la partida.</p>
      <label class="tog${SET.recordVideo !== false ? ' on' : ''}" style="margin-bottom:8px"><input type="checkbox" id="sVideo"${SET.recordVideo !== false ? ' checked' : ''}>Grabar en vídeo cada combate</label>
      <p class="note">Graba solo Showdown (sin la calculadora). Los vídeos se quedan en este ordenador:</p>
      <dl class="kv" style="margin-top:6px"><dt>Carpeta</dt><dd>${esc(vd.dir)}</dd></dl>
      <div class="row-btns"><button class="btn sm" id="sVidDir">Cambiar carpeta…</button><button class="btn sm" id="sVidOpen">Abrir carpeta</button></div></div>
    <div class="card"><h2>Extensiones de Chrome</h2>
      <p class="note" style="margin-bottom:8px">Se usan dentro de Showdown en la pestaña Jugar (por ejemplo, Showdex). Añádelas desde la Chrome Web Store, un .crx/.zip o una carpeta.</p>
      <div class="extlist">${ex.length ? ex.map(x => `<div class="extrow"><b>${esc(x.name)}</b><span class="note">${esc(x.version)} · ${esc(x.source)}</span><button class="btn sm danger" data-extdel="${esc(x.id)}">Quitar</button></div>`).join('') : '<p class="note">Todavía no has añadido ninguna extensión.</p>'}</div>
      <div class="row-btns"><input type="text" id="extUrl" placeholder="Enlace de la Chrome Web Store o su identificador" style="flex:1"><button class="btn sm primary" id="extStore">Añadir desde la Chrome Web Store</button></div>
      <div class="row-btns"><span class="note">O desde tu ordenador:</span><button class="btn sm" id="extFile">.crx o .zip…</button><button class="btn sm" id="extFolder">Carpeta descomprimida…</button></div>
      <p id="extMsg" style="margin-top:6px"></p></div>
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
  $('#sReplay').onchange = async e => { Object.assign(SET, await api.setSettings({ autoReplay: e.target.checked })); renderSettings(); };
  $('#sVideo').onchange = async e => { Object.assign(SET, await api.setSettings({ recordVideo: e.target.checked })); renderSettings(); };
  $('#sVidDir').onclick = async () => { const r = await api.setVideosDir(); if (r.ok) renderSettings(); };
  $('#sVidOpen').onclick = () => api.openVideos();
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
  $('#sSave').onclick = async () => { SET = { ...SET, ...(await api.setSettings({ showdownName: $('#sName').value.trim() })) }; $('#sMsg').textContent = 'Guardado. Partidas actualizadas.'; M = await api.list(); $('#navCount').textContent = M.length; };
  $('#iFiles').onclick = async () => {
    const r = await api.importFiles();
    const m = $('#iMsg');
    m.className = r.failed.length && !r.added ? 'errmsg' : 'okmsg';
    m.innerHTML = `${r.added} nueva${r.added === 1 ? '' : 's'}${r.updated ? `, ${r.updated} ya estaba${r.updated === 1 ? '' : 'n'}` : ''}.${r.failed.length ? `<br>No se pudieron leer: ${r.failed.map(esc).join('; ')}` : ''}`;
    M = await api.list(); $('#navCount').textContent = M.length;
  };
  $('#iGo').onclick = async () => {
    const r = await api.importUrl($('#iUrl').value);
    const m = $('#iMsg');
    m.className = r.ok ? 'okmsg' : 'errmsg';
    m.textContent = r.ok ? (r.saved ? 'Partida importada.' : 'Esa partida ya estaba guardada.') : r.why;
    M = await api.list(); $('#navCount').textContent = M.length;
  };
  $('#oData').onclick = () => api.openData();
}

/* ---------- arranque ---------- */
api.onChanged(d => {
  // Al volver a la ventana (o si otro ordenador cambió algo) se relee todo.
  if (d && d.focus) { DB.clear(); Calc.reloadTeams(); if (VIEWS[VIEW]) VIEWS[VIEW](); }
  load();
});
load();
pollStatus();
