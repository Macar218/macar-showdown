'use strict';
/*
 * Macar Showdown · calculadoras de daño. Hay dos, independientes:
 * - La de Jugar (panel de la derecha) sigue el combate que tienes abierto: tus Pokémon con sus estadísticas reales,
 *   los del rival con su hoja de equipo (OTS) si la hay y el reparto más común, y se vacía al acabar el combate.
 * - La de la página Calculadora es para estudiar: tus equipos, Mi PC, el Teambuilder y los rivales de tus partidas.
 * Las dos tienen Daño (estilo calculadora de Showdown), Multicalc y Árbol.
 */
/* global P, DB, api, $, esc, spr, sprBack, closeModal, Multi, show, SET, M, fmtDate */

const CalcParts = (() => {
  const { toID, WEATHERS, TERRAINS } = P;
  const hpCls = hp => (hp <= 25 ? 'r' : hp <= 50 ? 'y' : '');
  /**
   * Arena: los que están en el campo, el rival arriba y tú abajo (de espaldas), cada lado en su franja,
   * con nombre, PS y lo que hay en el campo. opts: { me:[{m, i, hp}], foe:[…], sel:{me, foe}, field, pick }.
   */
  function arenaHTML(opts) {
    const f = opts.field || {};
    const W = { Sun: '☀️', 'Harsh Sunshine': '☀️', Rain: '🌧️', 'Heavy Rain': '🌧️', Sand: '🌪️', Snow: '❄️' };
    const tags = [f.weather && `${W[f.weather] || ''} ${esc((WEATHERS.find(w => w[0] === f.weather) || [])[1] || f.weather)}`, f.terrain && esc(`Campo ${(TERRAINS.find(t => t[0] === f.terrain) || [])[1] || f.terrain}`), f.tr && 'Espacio Raro', f.me && f.me.tw && 'Viento Afín tuyo', f.foe && f.foe.tw && 'Viento Afín rival'].filter(Boolean);
    const mon = (x, side) => {
      if (!x || !x.m) return '<div class="armon empty"><span class="arfig"></span></div>';
      const hp = Math.max(0, Math.min(100, x.hp != null ? x.hp : x.m.hp));
      const on = opts.sel && opts.sel[side] === x.i;
      return `<button class="armon ${side}${on ? ' on' : ''}${hp <= 0 ? ' ko' : ''}" ${opts.pick ? `data-pick="${side}:${x.i}"` : ''} title="${esc(x.m.species)}">
        <span class="arfig">${side === 'me' ? sprBack(x.m.species, 'arspr') : spr(x.m.species, 'arspr')}</span>
        <span class="arinfo"><b class="nolang">${esc(x.m.species)}</b><span class="arhp"><i class="${hpCls(hp)}" style="width:${hp}%"></i></span><small>${Math.round(hp)}%</small></span></button>`;
    };
    return `<div class="arena${f.weather ? ` w-${toID(f.weather)}` : ''}${f.terrain ? ` t-${toID(f.terrain)}` : ''}${f.tr ? ' trroom' : ''}">
      <div class="arrow foe"><span class="arlbl">Rival</span><div class="arpair">${[0, 1].map(k => mon(opts.foe[k], 'foe')).join('')}</div></div>
      <div class="armid">${tags.length ? tags.map(t => `<span>${t}</span>`).join('') : '<span class="arvs">VS</span>'}</div>
      <div class="arrow me"><span class="arlbl">Tú</span><div class="arpair">${[0, 1].map(k => mon(opts.me[k], 'me')).join('')}</div></div></div>`;
  }
  return { arenaHTML, hpCls };
})();

/** Una calculadora. cfg: { root, key (localStorage), live (sigue el combate de Jugar) }. */
function makeCalc(cfg) {
  const { toID, STATS, SL, WEATHERS, TERRAINS, SIDE_FX } = P;
  const { hpCls, arenaHTML } = CalcParts;
  const LIVE = !!cfg.live;
  const root = () => cfg.root;
  const q1 = sel => cfg.root.querySelector(sel);

  /* ---------- estado ---------- */
  const S = {
    open: true, tab: 'dmg',
    me: [], foe: [], meActive: [], foeActive: [],
    selMe: 0, selFoe: 0,
    field: P.blankField(),
    teamMe: '', teamFoe: '',          // equipos del Team Box elegidos
    meMode: 'team',                   // estudio: 'team' = tu equipo (el de la sesión por defecto) · 'free' = los Pokémon que tú pongas
    battleId: null, format: '', turn: 0, spectator: false,
    edits: { me: {}, foe: {} },       // cambios a mano sobre lo que viene del combate o del equipo
    manual: { me: [], foe: [] },      // Pokémon añadidos a mano
    hide: { me: [], foe: [] }         // estudio: Pokémon de un equipo quitados con ×
  };
  let TEAMS = [];
  let U = null, usageFor = null, usageMsg = '', TT = null;
  let lastHash = '';

  try { Object.assign(S, JSON.parse(localStorage.getItem(cfg.key) || '{}'), { battleId: null, edits: { me: {}, foe: {} } }); } catch (e) { /* nada */ }
  if (LIVE) { S.manual = { me: [], foe: [] }; S.teamFoe = ''; S.meMode = 'team'; }
  const freeMe = () => !LIVE && S.meMode === 'free';
  if (!S.field || !S.field.me) S.field = P.blankField();
  if (!S.hide || !Array.isArray(S.hide.me) || !Array.isArray(S.hide.foe)) S.hide = { me: [], foe: [] };
  const persist = () => {
    try { localStorage.setItem(cfg.key, JSON.stringify({ tab: S.tab, setSrc: S.setSrc, teamMe: S.teamMe, meMode: S.meMode, teamFoe: LIVE ? '' : S.teamFoe, manual: LIVE ? { me: [], foe: [] } : S.manual, hide: LIVE ? { me: [], foe: [] } : S.hide, field: S.field })); } catch (e) { /* nada */ }
  };

  /* ---------- sets ---------- */
  const teamById = id => TEAMS.find(t => t.id === id);
  function setFromTeam(teamId, species) {
    const t = teamById(teamId);
    if (!t) return null;
    const sets = P.parseTeam(t.text).sets;
    const base = toID(P.baseSpecies(species));
    const s = sets.find(x => toID(x.species) === toID(species)) || sets.find(x => toID(P.baseSpecies(x.species)) === base);
    return s ? { ...P.clone(s), species: P.calcSpecies(species) || s.species } : null;
  }
  function defaultFoeSet(species) {
    const s = !LIVE && setFromTeam(S.teamFoe, species);
    if (s) return { ...s, src: 'equipo' };
    const src = S.setSrc || 'dex';
    const dx = src === 'dex' ? P.dexSet(species) : null;
    if (dx) return dx;
    const t = src !== 'smogon' ? P.tourSet(TT, U, species) : null;
    if (t) return t;
    const u = P.usageSet(U, species);
    if (u) return u;
    return { ...P.blankMon(species), src: 'sin datos' };
  }
  const sameStats = (m, real) => { const st = P.stats(m); return !!st && !!real && ['atk', 'def', 'spa', 'spd', 'spe'].every(k => st[k] === real[k]); };

  /* ---------- del combate a la calculadora ---------- */
  function fromLiveMine(p) {
    const species = P.calcSpecies(p.species);
    if (!species) return null;
    let m = P.blankMon(species);
    const saved = setFromTeam(S.teamMe, species);
    if (p.exact) {
      // Naturaleza y puntos: los de tu equipo si cuadran con las estadísticas reales; si no, se deducen de ellas.
      if (saved && sameStats({ ...saved, species }, p.stats)) m = { ...saved, species, src: 'exacto' };
      else {
        const sol = P.solveSP(species, p.stats, p.hpAbs ? p.hpAbs[1] : 0);
        if (sol) { m.nature = sol.nature; m.sp = sol.sp; m.src = 'exacto'; }
        else if (saved) m = { ...saved, species, src: 'equipo' };
        else m.src = 'combate';
      }
    } else if (saved) m = { ...saved, src: 'equipo' };
    else { const u = P.usageSet(U, species); if (u) m = u; }
    if (p.item) m.item = P.nameOf('items', p.item);
    if (p.ability) m.ability = P.nameOf('abilities', p.ability);
    if (p.moves && p.moves.length) m.moves = [...p.moves.map(x => P.nameOf('moves', x)), '', '', '', ''].slice(0, 4);
    if (!m.ability) m.ability = P.abilitiesOf(species)[0] || '';
    return Object.assign(m, { hp: p.hp, status: p.status || '', boosts: p.boosts || {}, fainted: p.fainted, nick: p.name, live: true });
  }
  function fromLiveFoe(p, sheet) {
    const species = P.calcSpecies(p.species);
    if (!species) return null;
    const base = toID(P.baseSpecies(species));
    const hs = sheet.find(x => toID(P.baseSpecies(P.calcSpecies(x.species) || x.species)) === base);
    const m = hs ? { ...P.sheetSet(hs, U), species } : defaultFoeSet(species);
    if (p.item) m.item = P.nameOf('items', p.item);
    if (p.ability) m.ability = P.nameOf('abilities', p.ability);
    const seen = (p.moves || []).map(x => P.nameOf('moves', x)).filter(Boolean);
    if (seen.length && !hs) {
      const rest = m.moves.filter(x => x && !seen.includes(x));
      m.moves = [...seen, ...rest, '', '', '', ''].slice(0, 4);
      m.seenMoves = seen;
    }
    const known = !!hs;
    return Object.assign(m, { hp: p.hp, status: p.status || '', boosts: p.boosts || {}, fainted: p.fainted, nick: p.name, live: true, revealed: { item: known || !!p.item, ability: known || !!p.ability } });
  }
  const WEATHER_MAP = { sunnyday: 'Sun', desolateland: 'Harsh Sunshine', raindance: 'Rain', primordialsea: 'Heavy Rain', sandstorm: 'Sand', snowscape: 'Snow', snow: 'Snow', hail: 'Snow' };
  const TERRAIN_MAP = { 'Electric Terrain': 'Electric', 'Grassy Terrain': 'Grassy', 'Psychic Terrain': 'Psychic', 'Misty Terrain': 'Misty' };
  const sideFromLive = c => ({ ref: !!c.reflect, ls: !!c.lightscreen, veil: !!c.auroraveil, tw: !!c.tailwind });
  const withEdits = (side, list) => list.map(m => (m && S.edits[side][m.species] ? { ...m, ...S.edits[side][m.species] } : m));

  function applyLive(b) {
    const newBattle = b.id !== S.battleId;
    if (newBattle) { S.battleId = b.id; S.edits = { me: {}, foe: {} }; S.selMove = null; }
    S.format = b.format; S.turn = b.turn; S.spectator = b.spectator;
    const sheet = b.foe && b.foe.sheet ? P.unpackSheet(b.foe.sheet) : [];
    S.sheet = sheet.length > 0;
    S.me = withEdits('me', (b.me ? b.me.team : []).map(fromLiveMine).filter(Boolean));
    const foes = (b.foe ? b.foe.team : []).map(p => fromLiveFoe(p, sheet)).filter(Boolean);
    // Con hoja de equipo, los 6 del rival aunque aún no se hayan visto.
    for (const x of sheet) {
      const sp = P.calcSpecies(x.species);
      if (sp && !foes.some(f => toID(P.baseSpecies(f.species)) === toID(P.baseSpecies(sp)))) { const m = P.sheetSet(x, U); if (m) foes.push(Object.assign(m, { hp: 100, boosts: {}, live: true, revealed: { item: true, ability: true } })); }
    }
    S.foe = withEdits('foe', foes);
    const act = (side, list) => (side ? side.active : []).filter(i => i >= 0 && list[i]);
    S.meActive = act(b.me, S.me);
    S.foeActive = act(b.foe, S.foe);
    if (newBattle || !S.me[S.selMe]) S.selMe = S.meActive[0] != null ? S.meActive[0] : 0;
    if (newBattle || !S.foe[S.selFoe]) S.selFoe = S.foeActive[0] != null ? S.foeActive[0] : 0;
    const f = S.field;
    f.weather = WEATHER_MAP[b.weather] || '';
    f.terrain = b.pseudo.map(x => TERRAIN_MAP[x]).find(Boolean) || '';
    f.tr = b.pseudo.includes('Trick Room');
    f.grav = b.pseudo.includes('Gravity');
    f.me = { ...f.me, ...sideFromLive(b.me ? b.me.cond : {}) };
    f.foe = { ...f.foe, ...sideFromLive(b.foe ? b.foe.cond : {}) };
    if (usageFor !== b.format) loadUsage(b.format);
  }
  function applyManual() {
    // Un equipo que ya no existe (borrado, otra carpeta de datos): el de tu sesión.
    if (TEAMS.length && S.teamMe && !teamById(S.teamMe)) S.teamMe = (typeof SET !== 'undefined' && SET.teamId && teamById(SET.teamId)) ? SET.teamId : '';
    if (!freeMe() && TEAMS.length && !S.teamMe && typeof SET !== 'undefined' && SET.teamId && teamById(SET.teamId)) S.teamMe = SET.teamId;
    if (!LIVE && TEAMS.length && S.teamFoe && !teamById(S.teamFoe)) S.teamFoe = '';
    if (LIVE && S.battleId) { S.edits = { me: {}, foe: {} }; S.selMove = null; S.field = P.blankField(); }
    S.battleId = null; S.format = ''; S.turn = 0; S.spectator = false; S.sheet = false;
    const fromTeam = (id, extra, side) => { const t = teamById(id); const hid = LIVE ? [] : S.hide[side] || []; return [...(t ? P.parseTeam(t.text).sets.filter(m => !hid.includes(m.species)) : []), ...extra.map(x => ({ ...x }))]; };
    S.me = withEdits('me', fromTeam(freeMe() ? '' : S.teamMe, LIVE ? [] : S.manual.me, 'me').map(m => ({ ...m, src: m.src === 'pegado' ? 'equipo' : m.src })));
    // En Jugar, sin combate no hay rival: los del combate se van al terminar.
    S.foe = LIVE ? [] : withEdits('foe', fromTeam(S.teamFoe, S.manual.foe, 'foe').map(m => ({ ...m, src: m.src === 'pegado' ? 'equipo' : m.src })));
    S.meActive = S.meActive && S.meActive.length && S.meActive.every(i => S.me[i]) ? S.meActive : S.me.slice(0, 2).map((_, i) => i);
    S.foeActive = S.foeActive && S.foeActive.length && S.foeActive.every(i => S.foe[i]) ? S.foeActive : S.foe.slice(0, 2).map((_, i) => i);
    autoWeather();
    if (!S.me[S.selMe]) S.selMe = 0;
    if (!S.foe[S.selFoe]) S.selFoe = 0;
    if (usageFor == null) loadUsage('');
  }
  /** Sin combate: clima y campo de las habilidades de los que están en el campo, salvo que los hayas elegido tú. */
  function autoWeather() {
    if (S.field.userWT) return;
    const a = P.autoField([...S.meActive.map(i => S.me[i]), ...S.foeActive.map(i => S.foe[i])]);
    S.field.weather = a.weather; S.field.terrain = a.terrain;
  }
  async function loadUsage(format) {
    usageFor = format;
    usageMsg = 'Cargando sets más usados…';
    const el = q1('.cusage'); if (el) el.textContent = usageMsg;
    const r = await P.usage(format);
    if (usageFor !== format) return;
    U = r;
    TT = await P.tour();
    await P.dex();
    usageMsg = [TT ? `Torneos: ${TT.nTeams} equipos de ${TT.tours} torneos (Limitless, ${TT.days} días)` : '', r ? `Smogon: ${r.month}, ${r.cutoff}+` : ''].filter(Boolean).join(' · ') || 'Sin datos de uso (¿sin conexión?). El rival sale sin puntos hasta que lo edites.';
    lastHash = '';
    tick(true);
  }

  /* ---------- pintar ---------- */
  function monChip(m, i, side) {
    const act = (side === 'me' ? S.meActive : S.foeActive).includes(i);
    const sel = (side === 'me' ? S.selMe : S.selFoe) === i;
    const hp = Math.max(0, Math.min(100, m.hp));
    return `<button class="mchip${sel ? ' sel' : ''}${act ? ' act' : ''}${m.fainted ? ' fnt' : ''}" data-pick="${side}:${i}" title="${esc(m.species)}${act ? ' · en el campo' : ''}${S.battleId ? '' : ' · clic derecho: sacarlo al campo o retirarlo'}">${spr(m.species, 'sm')}<span class="mcn nolang">${esc(P.baseSpecies(m.species))}</span><i class="hpbar"><i style="width:${hp}%" class="${hpCls(m.hp)}"></i></i><small class="mchp">${m.fainted ? 'KO' : `${Math.round(hp)}%`}</small>${act ? '<em class="mcact" title="En el campo">●</em>' : ''}${LIVE ? '' : `<span class="mcx" data-cx="${side}:${i}" role="button" title="Quitarlo (luego añade otro con +)">×</span>`}</button>`;
  }
  function strip(side) {
    const canAdd = !LIVE;
    const empty = !S[side].length ? `<span class="note">${LIVE ? (side === 'me' ? 'Elige tu equipo en la sesión.' : 'Aparecen al empezar un combate.') : 'Ninguno: añade con +'}</span>` : '';
    return `<div class="strip ${side}"><span class="lbl">${side === 'me' ? 'Tus Pokémon' : 'Sus Pokémon'}</span><div class="chips">${S[side].map((m, i) => monChip(m, i, side)).join('')}${empty}${canAdd ? `<button class="mchip add" data-add="${side}" title="Añadir un Pokémon a mano">+</button>` : ''}</div></div>`;
  }
  const SRC = { dex: 'Macar Dex', exacto: 'exacto', uso: 'Smogon', torneo: 'de torneo', pegado: 'pegado', equipo: 'de tu equipo', manual: 'a mano', combate: 'combate', 'sin datos': 'sin datos', pc: 'Mi PC', hoja: 'hoja de equipo' };
  /** Cómo sale el daño del movimiento marcado: las 16 tiradas, PS que le quedan y qué lo cambia. */
  function detail() {
    if (!S.det) return '';
    const [attSide, ai, di, mv] = S.det;
    const defSide = attSide === 'me' ? 'foe' : 'me';
    const att = S[attSide][+ai], def = S[defSide][+di];
    if (!att || !def) return '';
    const r = P.damage(att, def, mv, S.field, attSide);
    if (!r || r.err || !r.rolls) return '';
    const rolls = r.rolls.slice().sort((a, b) => a - b);
    const hits = d => (d > 0 ? Math.ceil(r.cur / d) : '∞');
    return `<div class="ddet"><h3>Cómo sale el daño <button class="dbtn" data-detx="1" title="Cerrar">×</button></h3>
      <p class="note">${esc(att.species)} · ${esc(mv)} → ${esc(def.species)} (le quedan ${r.cur}/${r.max} PS)</p>
      <div class="rolls">${rolls.map((d, i) => `<span class="${d >= r.cur ? 'ko' : ''}" title="Tirada ${i + 1} de 16"><b>${d}</b><small>${P.pct((d / r.max) * 100)}%</small><em>${d >= r.cur ? 'KO' : `${hits(d)} golpes`}</em></span>`).join('')}</div>
      <p class="dcalc" style="margin-top:6px">${esc(r.desc)}</p>
      <p class="note">${rolls.filter(d => d >= r.cur).length} de 16 tiradas lo dejan KO de un golpe${S.field.crit ? ' (con golpe crítico)' : ''}.</p></div>`;
  }
  function speedLine() {
    const a = S.me[S.selMe], b = S.foe[S.selFoe];
    if (!a || !b) return '';
    const sa = P.speed(a, S.field, 'me'), sb = P.speed(b, S.field, 'foe');
    let who;
    if (sa === sb) who = '<b>Empate de velocidad</b> (50%)';
    else {
      const meFirst = S.field.tr ? sa < sb : sa > sb;
      who = meFirst ? `<b class="ok">${esc(a.species)} se mueve antes</b>` : `<b class="bad">${esc(b.species)} se mueve antes</b>`;
    }
    return `<div class="spd"><span>Velocidad: ${esc(a.species)} <b>${sa}</b> · ${esc(b.species)} <b>${sb}</b>${S.field.tr ? ' · Espacio Raro' : ''}</span>${who}</div>`;
  }
  function fieldBox() {
    const f = S.field;
    const opt = (list, v) => list.map(([k, l]) => `<option value="${esc(k)}"${k === v ? ' selected' : ''}>${l}</option>`).join('');
    const tog = (key, label, on) => `<label class="tog${on ? ' on' : ''}"><input type="checkbox" data-cf="${key}"${on ? ' checked' : ''}>${label}</label>`;
    const sideRow = side => `<div class="frow"><span class="lbl">${side === 'me' ? 'Tu lado' : 'Su lado'}</span>${SIDE_FX.map(([k, l]) => tog(`${side}.${k}`, l, f[side][k])).join('')}</div>`;
    const on = [f.weather && WEATHERS.find(w => w[0] === f.weather)[1], f.terrain && `Campo ${TERRAINS.find(t => t[0] === f.terrain)[1]}`, f.tr && 'Espacio Raro', f.grav && 'Gravedad', f.crit && 'Crítico',
      ...['me', 'foe'].flatMap(s => SIDE_FX.filter(([k]) => f[s][k]).map(([, l]) => `${l} (${s === 'me' ? 'tú' : 'rival'})`))].filter(Boolean);
    return `<details class="fieldbox"${S.fieldOpen ? ' open' : ''}><summary>Campo y pantallas${on.length ? `<span>${esc(on.join(' · '))}</span>` : ''}</summary>
      <div class="frow"><select data-cf="weather">${opt(WEATHERS, f.weather)}</select><select data-cf="terrain">${opt(TERRAINS, f.terrain)}</select>${tog('tr', 'Espacio Raro', f.tr)}${tog('grav', 'Gravedad', f.grav)}${tog('crit', 'Golpe crítico', f.crit)}</div>
      ${sideRow('me')}${sideRow('foe')}
      ${S.battleId ? '<p class="note">Clima, campo, pantallas y Viento Afín se copian del combate en cada turno.</p>' : ''}</details>`;
  }

  /* ---------- pestaña Daño, estilo calculadora de Showdown ---------- */
  const cur = side => S[side][side === 'me' ? S.selMe : S.selFoe];
  /** Los 4 movimientos de un lado contra el Pokémon elegido del otro, con su %; pulsar uno lo enseña abajo. */
  function moveCol(attSide) {
    const att = cur(attSide), def = cur(attSide === 'me' ? 'foe' : 'me');
    if (!att) return `<div class="sdmvs ${attSide}"><p class="note">${attSide === 'me' ? 'Elige tu Pokémon' : 'Elige el rival'}${LIVE ? '' : ' o añade uno con +'}.</p></div>`;
    const seen = att.seenMoves || [];
    return `<div class="sdmvs ${attSide}"><h4>${spr(att.species, 'xs')}<span class="nolang">${esc(att.species)}</span></h4>${att.moves.map(mv => {
      if (!mv) return '<span class="sdmv empty">—</span>';
      const d = P.moveOf(mv), r = def ? P.damage(att, def, mv, S.field, attSide) : null;
      const on = S.selMove && S.selMove[0] === attSide && S.selMove[1] === mv;
      const val = d && d.category === 'Status' ? '<small>estado</small>' : r && !r.err ? `${P.pct(r.pLo)} - ${P.pct(r.pHi)}%` : '';
      const tag = attSide === 'foe' && seen.length && !seen.includes(mv) ? '<em title="No lo ha usado todavía">?</em>' : '';
      return `<button class="sdmv${on ? ' on' : ''} ${r && !r.err ? P.koClass(r.ko) : ''}" data-smv="${attSide}|${esc(mv)}">${P.typeDot(d ? d.type : '')}<span class="nolang">${esc(mv)}</span>${tag}<b>${val}</b></button>`;
    }).join('')}</div>`;
  }
  /** El cálculo del movimiento elegido: el texto de Showdown, el KO y las tiradas. */
  function mainResult() {
    let [side, mv] = S.selMove || [];
    const valid = side && cur(side) && cur(side).moves.includes(mv);
    if (!valid) {
      const a = cur('me');
      const first = a && a.moves.find(x => x && P.moveOf(x) && P.moveOf(x).category !== 'Status');
      if (!first) return '<div class="sdmain"><p class="note">Elige un movimiento.</p></div>';
      S.selMove = ['me', first]; [side, mv] = S.selMove;
    }
    const att = cur(side), def = cur(side === 'me' ? 'foe' : 'me');
    if (!def) return '<div class="sdmain"><p class="note">Falta el otro Pokémon.</p></div>';
    const r = P.damage(att, def, mv, S.field, side);
    if (!r) return `<div class="sdmain"><p class="sddesc nolang">${esc(mv)}</p><p class="note">Movimiento de estado: no hace daño.</p></div>`;
    if (r.err) return `<div class="sdmain"><p class="note">No se puede calcular: ${esc(r.err)}</p></div>`;
    const rolls = r.rolls.slice().sort((x, y) => x - y);
    S.det = [side, side === 'me' ? S.selMe : S.selFoe, side === 'me' ? S.selFoe : S.selMe, mv];
    S.lastDesc = r.desc || `${att.species} ${mv} vs ${def.species}`;
    S.lastPair = [att.species, def.species];
    return `<div class="sdmain"><p class="sddesc nolang">${esc(S.lastDesc)}</p>
      <div class="sdko"><b class="${P.koClass(r.ko)}">${esc(P.koEs(r.ko)) || 'Sin KO'}</b>${P.bar(r)}<span>${P.pct(r.pLo)} - ${P.pct(r.pHi)}% · ${r.lo}-${r.hi} de ${r.cur}/${r.max} PS</span></div>
      <p class="sdrolls"><span class="note">Posibles daños:</span> <span class="nolang">(${rolls.join(', ')})</span></p>
      <div class="row-btns"><button class="btn sm" data-sdroll="1">${S.showRolls ? 'Ocultar tiradas' : 'Cómo sale el daño'}</button><span class="note">Cálculo a Mi PC:</span><button class="btn sm" data-sdkeep="${side}" title="Lo guarda en Mi PC, en este Pokémon (si no está, lo guarda primero)"><span class="nolang">${esc(P.baseSpecies(att.species))}</span></button><button class="btn sm" data-sdkeep="${side === 'me' ? 'foe' : 'me'}" title="Lo guarda en Mi PC, en este Pokémon (si no está, lo guarda primero)"><span class="nolang">${esc(P.baseSpecies(def.species))}</span></button><span class="note sdkeepmsg">${esc(S.keepMsg || '')}</span></div>${S.showRolls ? detail() : ''}</div>`;
  }
  /** Un Pokémon, editable aquí mismo como en la calculadora de Showdown: datos, puntos con flechas, PS y ataques. */
  function pokePanel(side) {
    const m = cur(side);
    if (!m) return `<div class="sdpoke ${side} empty"><p class="note">${side === 'me' ? 'Elige tu Pokémon' : 'Elige el rival'}${LIVE ? '' : ' o añade uno con +'}.</p></div>`;
    const st = P.stats(m) || {}, sp = P.spOf(m.species);
    const rv = m.revealed || {};
    const q = on => (side === 'foe' && on ? ' <em title="Aún no se ha visto: es lo más probable">?</em>' : '');
    const opt = (list, v) => list.map(([k, l]) => `<option value="${esc(k)}"${k === v ? ' selected' : ''}>${l}</option>`).join('');
    const spGuess = side === 'foe' && (m.src === 'hoja' || m.live);
    const mega = P.megaOf(m), tot = m.sp.reduce((a, b) => a + (+b || 0), 0), left = P.SP_TOTAL - tot;
    const sum = left < 0 ? `<b class="bad">${tot}/${P.SP_TOTAL}</b> · te pasas ${-left}` : left > 0 ? `<b class="warn">${tot}/${P.SP_TOTAL}</b> · te quedan ${left}` : `<b class="ok">${tot}/${P.SP_TOTAL}</b> · completo`;
    const pcOpen = S.pcName === side;
    const mvOpen = S.mvPick && S.mvPick[0] === side;
    return `<div class="sdpoke ${side} c2poke">
      <div class="sdph">${spr(mega)}<div class="sdpn"><b class="nolang">${esc(m.nick && m.nick !== m.species ? `${m.nick} (${m.species})` : m.species)}</b><div class="tytags">${P.typesOf(mega).map(P.typeBadge).join('')}</div><span class="src ${toID(m.src)}">${esc(SRC[m.src] || m.src || '')}</span></div>
        <span style="flex:1"></span><button class="btn sm" data-edit="${side}" title="Editor completo: sets más usados, Mi PC, pegar el set">Editar</button><button class="btn sm${pcOpen ? ' on' : ''}" data-cpc="${side}" title="Guardar este Pokémon, tal cual está, en Mi PC con el nombre que quieras">→ Mi PC</button></div>
      ${pcOpen ? `<div class="cpcrow"><input id="cPcName-${side}" maxlength="80" placeholder="Nombre en Mi PC" value="${esc(m.nick && m.nick !== m.species ? m.nick : `${P.baseSpecies(m.species)} · ${m.item || 'sin objeto'}`)}"><button class="btn sm primary" data-cpcok="${side}">Guardar</button><button class="btn sm" data-cpc="${side}">Cancelar</button></div>` : ''}
      ${S.pcMsg && S.pcMsg[0] === side ? `<p class="okmsg cpcmsg">${esc(S.pcMsg[1])}</p>` : ''}
      ${mega !== m.species ? `<p class="note cforme">Forma Mega: <b class="nolang">${esc(mega)}</b> · habilidad ${esc(P.abilitiesOf(mega)[0] || '')}</p>` : ''}
      <div class="sdgrid">
        <label class="field">Objeto${q(m.item && !rv.item && m.live)}<input list="dlItems" data-ce="${side}:item" value="${esc(m.item)}" autocomplete="off" placeholder="Sin objeto"></label>
        <label class="field">Habilidad${q(m.ability && !rv.ability && m.live)}<select data-ce="${side}:ability">${[...new Set([m.ability, ...P.abilitiesOf(m.species)].filter(Boolean))].map(a => `<option${a === m.ability ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select></label>
        <label class="field">Naturaleza<select data-ce="${side}:nature">${P.NATURES.map(n => `<option value="${n.name}"${n.name === m.nature ? ' selected' : ''}>${esc(P.natLabel(n.name))}</option>`).join('')}</select></label>
        <label class="field">Estado<select data-ce="${side}:status">${opt(P.STATUS, m.status || '')}</select></label>
      </div>
      <table class="sdstats c2stats"><thead><tr><th></th><th>Base</th><th>Puntos (SP)${spGuess ? ' <em title="El reparto del rival no se ve: es el más común. Cámbialo si sabes otro.">?</em>' : ''}</th><th>Stat</th><th>Nivel</th></tr></thead><tbody>
        ${STATS.map((k, i) => { const nm = P.natMult(m.nature, k), b = (m.boosts && m.boosts[k]) || 0, v = m.sp[i] || 0; return `<tr class="${nm > 1 ? 'up' : nm < 1 ? 'dn' : ''}"><th>${SL[k]}${nm > 1 ? ' ▲' : nm < 1 ? ' ▼' : ''}</th><td>${sp ? sp.baseStats[k] : ''}</td>
          <td><div class="cstep"><button data-csp="${side}:${i}:-1" title="−1 (Mayús: −4)"${v <= 0 ? ' disabled' : ''}>−</button><input type="number" min="0" max="${P.SP_MAX}" value="${v}" data-ce="${side}:sp:${i}" class="${v >= P.SP_MAX ? 'max' : v ? 'set' : ''}"><button data-csp="${side}:${i}:1" title="+1 (Mayús: +4)"${v >= P.SP_MAX || left <= 0 ? ' disabled' : ''}>+</button></div></td><td><b>${st[k] ?? ''}</b></td>
          <td>${i ? `<div class="cstep cboost"><button data-cbo="${side}:${k}:-1" title="Bajar un nivel"${b <= -6 ? ' disabled' : ''}>▼</button><span class="${b > 0 ? 'up' : b < 0 ? 'dn' : ''}">${b > 0 ? `+${b}` : b}</span><button data-cbo="${side}:${k}:1" title="Subir un nivel"${b >= 6 ? ' disabled' : ''}>▲</button></div>` : ''}</td></tr>`; }).join('')}
      </tbody><tfoot><tr><td colspan="5"><div class="cspsum">Puntos: ${sum}<span class="note"> · máximo ${P.SP_MAX} por stat</span>${tot ? `<button class="btn sm" data-csp0="${side}" title="Todos los puntos a 0">A 0</button>` : ''}</div></td></tr></tfoot></table>
      <div class="sdhp"><span>PS</span><div class="hpline"><i style="width:${Math.max(0, Math.min(100, m.hp))}%" class="${hpCls(m.hp)}"></i></div><label><input type="number" min="0" max="100" step="1" value="${Math.round(m.hp)}" data-hp="${side}">%</label><span class="note">${st.hp ? `${Math.round((st.hp * m.hp) / 100)}/${st.hp}` : ''}</span></div>
      <div class="c2moves">${[0, 1, 2, 3].map(i => { const x = m.moves[i] || '', d = x && P.moveOf(x), on = mvOpen && S.mvPick[1] === i; return `<button class="c2mv${d ? ` t-${esc(d.type)}` : ' empty'}${on ? ' on' : ''}" data-cmv="${side}:${i}" title="Cambiar el movimiento">${x ? `<b class="nolang">${esc(x)}</b>${d ? P.typeBadge(d.type) : ''}<span class="c2cat">${d ? (d.category === 'Status' ? 'Estado' : d.category === 'Physical' ? 'Físico' : 'Especial') : ''}</span><span class="c2bp">${d && d.basePower ? d.basePower : '—'}</span>` : `<span class="note">Movimiento ${i + 1}</span>`}</button>`; }).join('')}</div>
      ${mvOpen ? P.movePanel(m.species, U, TT, S.mvQ || '', m.moves, m.moves[S.mvPick[1]] || '') : ''}
    </div>`;
  }
  function arena() {
    const pickAct = (side, act, sel) => { const ids = act.length ? act.slice(0, 2) : [sel]; if (!ids.includes(sel)) ids[0] = sel; return ids.filter(i => S[side][i]).map(i => ({ m: S[side][i], i })); };
    return arenaHTML({ me: pickAct('me', S.meActive, S.selMe), foe: pickAct('foe', S.foeActive, S.selFoe), sel: { me: S.selMe, foe: S.selFoe }, field: S.field, pick: true });
  }

  /** Cambiar algo del Pokémon desde la calculadora (se recuerda como cambio a mano). */
  function applyEdit(side, key, value, extra) {
    const m = cur(side);
    if (!m) return;
    const patch = {};
    if (key === 'item') patch.item = value.trim() ? P.nameOf('items', value.trim()) : '';
    else if (key === 'ability' || key === 'nature' || key === 'status') patch[key] = value;
    else if (key === 'sp') { const sp = m.sp.slice(); sp[+extra] = Math.max(0, Math.min(P.SP_MAX, Math.round(+value || 0))); patch.sp = sp; }
    else if (key === 'boost') patch.boosts = { ...(m.boosts || {}), [extra]: +value || 0 };
    else if (key === 'move') { const mv = m.moves.slice(); mv[+extra] = value.trim() ? P.nameOf('moves', value.trim()) : ''; patch.moves = mv; }
    Object.assign(m, patch);
    if (key !== 'boost' && key !== 'status' && m.src !== 'exacto') m.src = 'manual';
    S.edits[side][m.species] = { ...(S.edits[side][m.species] || {}), ...patch, ...(m.src === 'manual' ? { src: 'manual' } : {}) };
    // En la de estudio, lo que añadiste a mano se recuerda con el cambio.
    if (!LIVE) { const k = S.manual[side].findIndex(x => x.species === m.species); if (k >= 0) { Object.assign(S.manual[side][k], patch); persist(); } }
  }
  /** Campo como en Showdown: botones. */
  function fieldPanel() {
    const f = S.field;
    const b = (attr, val, label, on) => `<button class="${on ? 'on' : ''}" data-${attr}="${esc(val)}">${label}</button>`;
    const sideRow = side => `<div class="sdfrow"><span class="lbl">${side === 'me' ? 'Tu lado' : 'Su lado'}</span><div class="sdbtns">${SIDE_FX.map(([k, l]) => b('cfs', `${side}.${k}`, l, f[side][k])).join('')}</div></div>`;
    return `<div class="sdfield"><h4>Campo</h4>
      <div class="sdfrow"><span class="lbl">Clima</span><div class="sdbtns">${WEATHERS.map(([k, l]) => b('cfw', k, l, f.weather === k)).join('')}</div></div>
      <div class="sdfrow"><span class="lbl">Campo</span><div class="sdbtns">${TERRAINS.map(([k, l]) => b('cft', k, l, f.terrain === k)).join('')}</div></div>
      <div class="sdfrow"><span class="lbl">Otros</span><div class="sdbtns">${b('cfo', 'tr', 'Espacio Raro', f.tr)}${b('cfo', 'grav', 'Gravedad', f.grav)}${b('cfo', 'crit', 'Golpe crítico', f.crit)}</div></div>
      ${sideRow('me')}${sideRow('foe')}
      ${S.battleId ? '<p class="note">Clima, campo, pantallas y Viento Afín se copian del combate en cada turno.</p>' : ''}</div>`;
  }

  function topHTML() {
    const srcSeg = `<div class="csrc"><span class="note">Sets del rival que no conoces:</span><div class="seg">${[['dex', 'Macar Dex'], ['tour', 'Torneos'], ['smogon', 'Smogon']].map(([k, l]) => `<button data-csrc="${k}" aria-pressed="${(S.setSrc || 'dex') === k}" title="${k === 'dex' ? 'Los sets de tu Macar Dex: habilidad y movimientos de Smogon del mes, objeto y reparto más usados. Se actualiza cada lunes.' : k === 'tour' ? 'Lo más llevado en los torneos online de Limitless de los últimos 30 días (jugadores de torneo).' : 'Lo más usado en el ladder de Showdown este mes (1760+).'}">${l}</button>`).join('')}</div></div>`;
    if (LIVE) {
      const status = S.battleId
        ? `<span class="pill live">EN DIRECTO</span><span>Turno ${S.turn}${S.spectator ? ' · espectador' : ''}${S.sheet ? ' · con hoja de equipo' : ''}</span>`
        : '<span class="pill">SIN COMBATE</span><span>Se llena sola al empezar un combate</span>';
      return `<div class="ctop">${status}<span style="flex:1"></span><button class="btn sm" data-cwide="1" title="Abrir la calculadora más ancha o volver a tu ancho">${window.CalcDrawer && CalcDrawer.wide() ? '⇥ Más estrecha' : '⇤ Más ancha'}</button><button class="btn sm" data-dex="1" title="Info Pokémon: busca por nombre o número">Pokédex</button></div>
        ${S.battleId ? '' : '<p class="note cnobattle">Aquí salen los Pokémon del combate que juegues y se van al terminar. Para estudiar sets y equipos, usa la página Calculadora.</p>'}
        ${srcSeg}
        <p class="note csrcnote">${S.sheet ? 'Rival con hoja de equipo: objeto, habilidad, naturaleza y movimientos son los suyos; el reparto (SP) es el más común con esa naturaleza.' : 'Sin hoja de equipo: lo que no se ha visto sale de la fuente elegida y se corrige según se ve en el combate.'}</p>`;
    }
    const teamOpt = (side, v) => `<option value="">${side === 'me' ? 'Tu equipo…' : 'Equipo rival…'}</option>${TEAMS.filter(t => t.side === side).map(t => `<option value="${esc(t.id)}"${t.id === v ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}`;
    return `<div class="ctop"><span class="pill">ESTUDIO</span><span>Tus equipos, Mi PC y los rivales de tus partidas</span><span style="flex:1"></span><button class="btn sm" data-dex="1" title="Info Pokémon: busca por nombre o número">Pokédex</button></div>
      <div class="cmode"><span class="note">Tus Pokémon:</span><div class="seg">${[['team', 'Tu equipo'], ['free', 'Los que tú elijas']].map(([k, l]) => `<button data-cmode="${k}" aria-pressed="${(S.meMode || 'team') === k}" title="${k === 'team' ? 'Un equipo tuyo: por defecto, el de tu sesión' : 'Empieza vacío y añade con + los Pokémon que quieras: de Mi PC, de tus equipos o nuevos'}">${l}</button>`).join('')}</div>
        ${S.meMode === 'free' ? `<span class="note">Añade los tuyos con + en «Tus Pokémon».</span>${S.manual.me.length ? '<button class="btn sm" data-cclear="me" title="Quitar todos tus Pokémon">Vaciar los tuyos</button>' : ''}` : ''}</div>
      <div class="cteams">${S.meMode === 'free' ? '' : `<select data-cteam="me" title="Tu equipo">${teamOpt('me', S.teamMe)}</select>`}
        <select data-cteam="foe" title="Equipo del rival: sus sets mandan sobre los más usados">${teamOpt('foe', S.teamFoe)}</select>
        <button class="btn sm" data-cmatch="1" title="Los rivales de una partida tuya: su hoja de equipo (OTS) con el reparto más común">De una partida</button>
        <button class="btn sm" data-cpaste="1" title="Pegar o traer de Pokepaste un equipo rival">Pegar rival</button>
        ${S.manual.foe.length || S.teamFoe ? '<button class="btn sm" data-cclear="foe" title="Quitar a todos los rivales">Vaciar rivales</button>' : ''}</div>
      ${srcSeg}`;
  }

  function render() {
    const el = root();
    if (!el) return;
    const keepScroll = el.scrollTop;
    P.datalists();
    const back = S.tab === 'dmg' ? '' : '<button class="btn sm" data-ctab="dmg" title="Volver a la pestaña Daño">← Daño</button>';
    el.innerHTML = `${topHTML()}
      ${strip('me')}${strip('foe')}
      <div class="ctabbar">${back}<div class="seg ctabs" role="tablist"><button data-ctab="dmg" aria-pressed="${S.tab === 'dmg'}">Daño</button><button data-ctab="multi" aria-pressed="${S.tab === 'multi'}">Multicalc</button><button data-ctab="tree" aria-pressed="${S.tab === 'tree'}" title="Tus mejores jugadas, lo que puede responder el rival y qué pasa después, turno a turno">Árbol</button></div></div>
      <div class="ctabbody">${S.tab === 'multi' ? Multi.render(api_state()) : S.tab === 'tree' ? Multi.renderTree(api_state()) : `
        <div class="c2">
          <div class="c2top"><div class="c2arena">${arena()}${speedLine()}</div><div class="c2moves-col"><div class="sdres">${moveCol('me')}${moveCol('foe')}</div></div></div>
          <div class="c2res">${mainResult()}</div>
          <div class="c2panels"><div class="c2me">${pokePanel('me')}</div><div class="c2field">${fieldPanel()}</div><div class="c2foe">${pokePanel('foe')}</div></div>
        </div>`}</div>
      ${S.tab === 'dmg' ? '' : fieldBox()}
      <p class="note usage cusage">${esc(usageMsg)}</p>`;
    el.scrollTop = keepScroll;
  }
  /** Lo que la Multicalc necesita saber. */
  const api_state = () => ({ S, me: S.me, foe: S.foe, meActive: S.meActive, foeActive: S.foeActive, field: S.field, live: !!S.battleId, turn: S.turn, battleId: S.battleId });

  /* ---------- editar / añadir ---------- */
  function addManual(side, m) {
    if (side === 'foe' || side === 'me') {
      const base = toID(P.baseSpecies(m.species));
      const k = S.manual[side].findIndex(x => toID(P.baseSpecies(x.species)) === base);
      if (k >= 0) S.manual[side].splice(k, 1);
    }
    S.manual[side].push(P.clone(m));
    applyManual();
    const i = S[side].findIndex(x => x.species === m.species);
    if (side === 'me') S.selMe = Math.max(0, i); else S.selFoe = Math.max(0, i);
    persist(); lastHash = ''; render();
  }
  function edit(side, idx, isNew) {
    if (LIVE && isNew) return;
    if (isNew) {
      P.pickMon({ side, title: side === 'me' ? 'Elegir tu Pokémon' : 'Elegir rival', onPick: m => {
        m.src = ['pc', 'torneo', 'uso', 'dex'].includes(m.src) ? m.src : 'manual';
        addManual(side, m);
      } });
      return;
    }
    const was = S[side][idx];
    if (!was) return;
    P.openEditor({
      set: was, side, usage: U, live: true,
      onDelete: () => removeMon(side, idx),
      deleteLabel: 'Quitar de la calculadora',
      onSave: m => {
        const { live, fainted, nick, revealed, seenMoves, ...keep } = m; // eslint-disable-line no-unused-vars
        if (keep.src !== 'exacto' && keep.src !== 'pc') keep.src = 'manual';
        S.edits[side][was.species] = keep;
        S[side][idx] = { ...S[side][idx], ...keep };
        if (!LIVE) { const k = S.manual[side].findIndex(x => x.species === was.species); if (k >= 0) S.manual[side][k] = { ...S.manual[side][k], ...keep }; }
        persist(); lastHash = ''; render();
      }
    });
  }
  function removeMon(side, idx) {
    const m = S[side][idx];
    if (!m) return;
    const k = S.manual[side].findIndex(x => x.species === m.species);
    if (k >= 0) S.manual[side].splice(k, 1);
    else if (!LIVE && !S.hide[side].includes(m.species)) S.hide[side].push(m.species);
    S[side].splice(idx, 1);
    const sel = side === 'me' ? 'selMe' : 'selFoe', act = side === 'me' ? 'meActive' : 'foeActive';
    S[act] = S[act].filter(i => i !== idx).map(i => (i > idx ? i - 1 : i));
    if (S[sel] >= S[side].length) S[sel] = Math.max(0, S[side].length - 1);
    persist(); lastHash = ''; tick(true);
  }

  /** Añadir un equipo rival rápido: pegar texto o enlace de Pokepaste. */
  function quickRival() {
    const box = $('#modalBox');
    box.onclick = box.onchange = box.oninput = null;
    box.innerHTML = `<button class="btn x" id="mClose">Cerrar</button>
      <h2>Equipo rival</h2>
      <p class="note">Pega su hoja de equipo o un enlace de Pokepaste. Se guarda en tu Team Box y la calculadora usa esos sets antes que los más usados.</p>
      <div class="ed" style="margin-top:10px"><label class="field">Nombre<input id="qName" placeholder="Ej.: Rival de la final"></label>
        <label class="field">Enlace de Pokepaste<input id="qUrl" placeholder="https://pokepast.es/…"></label></div>
      <textarea id="qTxt" rows="9" placeholder="…o pega aquí el equipo exportado de Showdown"></textarea>
      <div class="row-btns"><button class="btn" id="qFetch">Traer Pokepaste</button><span class="note" id="qMsg"></span><span style="flex:1"></span><button class="btn primary" id="qSave">Guardar y usar</button></div>`;
    $('#mClose').onclick = closeModal;
    box.onclick = async e => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.id === 'qFetch') {
        $('#qMsg').textContent = 'Trayendo…';
        const r = await api.fetchPaste($('#qUrl').value);
        if (!r.ok) { $('#qMsg').textContent = r.why; return; }
        $('#qTxt').value = r.text;
        if (!$('#qName').value && r.title) $('#qName').value = r.title;
        $('#qMsg').textContent = 'Listo. Revisa y guarda.';
      } else if (t.id === 'qSave') {
        const r = P.parseTeam($('#qTxt').value);
        if (!r.sets.length) { $('#qMsg').textContent = `No he reconocido ningún Pokémon de Champions.${r.bad.length ? ` Desconocidos: ${r.bad.join(', ')}` : ''}`; return; }
        const v = await P.saveTeam({ name: $('#qName').value.trim() || r.sets.map(s => s.species).slice(0, 3).join(' / '), side: 'foe', text: $('#qTxt').value });
        TEAMS = await P.teams();
        S.teamFoe = v.id; S.edits.foe = {};
        persist(); closeModal(); lastHash = ''; tick(true);
      }
    };
    $('#modal').classList.remove('hide');
    $('#qTxt').focus();
  }
  /** Rivales de tus partidas: su hoja de equipo (o lo que se vio) con el reparto más común. */
  function fromMatch() {
    const list = (typeof M !== 'undefined' && Array.isArray(M) ? M : []).filter(s => s.me && s[s.opp || 'p2']).slice().sort((a, b) => b.endedAt - a.endedAt).slice(0, 60);
    const box = $('#modalBox');
    box.onclick = box.onchange = box.oninput = null;
    const row = s => {
      const o = s[s.opp || 'p2'], mons = (o.sheet && o.sheet.length ? o.sheet.map(x => x.species) : o.preview.length ? o.preview : o.brought);
      return `<button class="cmrow" data-cmpick="${esc(s.id)}"><span class="pill ${s.result === 'win' ? 'win' : s.result === 'loss' ? 'loss' : 'tie'}">${s.result === 'win' ? 'W' : s.result === 'loss' ? 'L' : '–'}</span><b class="nolang">${esc(o.name)}</b><span class="cmmons">${mons.map(n => spr(n, 'sm')).join('')}</span><small>${o.sheet ? 'OTS' : 'sin hoja'} · ${fmtDate(s.endedAt)}</small></button>`;
    };
    box.innerHTML = `<button class="btn x" id="mClose">Cerrar</button><h2>Rivales de tus partidas</h2>
      <p class="note">Elige una partida: sus Pokémon pasan a «Sus Pokémon». Con hoja de equipo (OTS) llevan su objeto, habilidad, naturaleza y movimientos; el reparto (SP) es el más común con esa naturaleza y lo puedes cambiar.</p>
      <div class="cmlist">${list.length ? list.map(row).join('') : '<p class="note">Aún no hay partidas guardadas.</p>'}</div>`;
    $('#mClose').onclick = closeModal;
    box.onclick = e => {
      const b = e.target.closest('[data-cmpick]');
      if (!b) return;
      const s = list.find(x => x.id === b.dataset.cmpick);
      const o = s[s.opp || 'p2'];
      const sets = o.sheet && o.sheet.length ? o.sheet.map(x => P.sheetSet(x, U)).filter(Boolean)
        : (o.preview.length ? o.preview : o.brought).map(n => { const sp = P.calcSpecies(n); return sp ? defaultFoeSet(sp) : null; }).filter(Boolean).map(m => {
          const seen = ((o.moves || {})[Object.keys(o.moves || {}).find(k => toID(P.baseSpecies(k)) === toID(P.baseSpecies(m.species)))] || []).map(x => P.nameOf('moves', x));
          if (seen.length) m.moves = [...seen, ...m.moves.filter(x => x && !seen.includes(x)), '', '', '', ''].slice(0, 4);
          return m;
        });
      S.teamFoe = ''; S.manual.foe = sets.map(m => ({ ...m, hp: 100, boosts: {} })); S.edits.foe = {}; S.foeActive = [];
      S.selFoe = 0; persist(); closeModal(); applyManual(); lastHash = ''; render();
    };
    $('#modal').classList.remove('hide');
  }
  /** Guarda el cálculo de ahora en Mi PC, en el Pokémon elegido (sus sets de esa especie; si no tiene, lo guarda primero). */
  async function keepCalc(side) {
    if (!S.lastDesc) return;
    const m = cur(side);
    if (!m) return;
    const id = toID(P.baseSpecies(m.species));
    let list = (await P.pcList()).slice();
    let hits = list.filter(x => { const s = P.parseSet(x.text); return s && !s.bad && toID(P.baseSpecies(s.species)) === id && (x.side || 'me') === side; });
    if (!hits.length) {
      const r = await P.pcAdd(P.cleanSet(m), { name: m.nick && m.nick !== m.species ? m.nick : P.baseSpecies(m.species), side, box: side === 'foe' ? 'Rivales' : '' });
      if (!r.ok) { S.keepMsg = r.why; render(); return; }
      list = (await P.pcList()).slice();
      hits = list.filter(x => x.id === r.item.id);
    }
    for (const x of hits) x.calcs = [...(x.calcs || []).filter(c => c.t !== S.lastDesc), { t: S.lastDesc, at: Date.now() }].slice(-40);
    await DB.set('pc', list);
    S.keepMsg = `Guardado en Mi PC: ${P.baseSpecies(m.species)}${hits.length > 1 ? ` (${hits.length} sets)` : ''}.`;
    render();
    setTimeout(() => { S.keepMsg = ''; }, 4000);
  }
  /** Este Pokémon, tal cual está en la calculadora, a Mi PC con su nombre. */
  async function toPC(side) {
    const m = cur(side), inp = q1(`#cPcName-${side}`);
    if (!m) return;
    const name = inp ? inp.value.trim().slice(0, 80) : '';
    const r = await P.pcAdd(P.cleanSet(m), { name, side, box: side === 'foe' ? 'Rivales' : '' });
    let msg = r.ok ? `Guardado en Mi PC${name ? `: ${name}` : ''}.` : r.why;
    // Ese mismo set ya estaba: se le pone el nombre nuevo.
    if (!r.ok && name) {
      const text = P.exportSet(P.cleanSet(m)), L = (await P.pcList()).slice(), k = L.findIndex(x => x.text === text && x.side === side);
      if (k >= 0) { L[k] = { ...L[k], name, up: Date.now() }; await DB.set('pc', L); msg = `Ya estaba en Mi PC: ahora se llama ${name}.`; }
    }
    S.pcName = null;
    S.pcMsg = [side, msg];
    render();
    setTimeout(() => { S.pcMsg = null; }, 4000);
  }

  /* ---------- eventos ---------- */
  function bind() {
    const el = root();
    el.addEventListener('click', e => {
      // × en un Pokémon de las filas: se quita (luego puedes añadir otro con +).
      const x = e.target.closest('[data-cx]');
      if (x) { e.stopPropagation(); const [side, i] = x.dataset.cx.split(':'); removeMon(side, +i); return; }
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.info) { P.openInfo(t.dataset.info); return; }
      if (t.dataset.dex) { P.openInfo((S.foe[S.selFoe] || S.me[S.selMe] || {}).species || 'Garchomp'); return; }
      if (t.dataset.cwide) { if (window.CalcDrawer) CalcDrawer.toggleWide(); render(); return; }
      if (t.dataset.detx) { S.showRolls = false; render(); return; }
      if (t.dataset.sdkeep) { keepCalc(t.dataset.sdkeep); return; }
      if (t.dataset.cpc) { S.pcName = S.pcName === t.dataset.cpc ? null : t.dataset.cpc; render(); const i = q1(`#cPcName-${t.dataset.cpc}`); if (i) { i.focus(); i.select(); } return; }
      if (t.dataset.cpcok) { toPC(t.dataset.cpcok); return; }
      if (t.dataset.csp) { const [side, i, d] = t.dataset.csp.split(':'); const m = cur(side); if (m) { applyEdit(side, 'sp', (m.sp[+i] || 0) + (+d) * (e.shiftKey ? 4 : 1), i); lastHash = ''; render(); } return; }
      if (t.dataset.csp0) { const side = t.dataset.csp0, m = cur(side); if (m) { for (let i = 0; i < 6; i++) applyEdit(side, 'sp', 0, i); render(); } return; }
      if (t.dataset.cbo) { const [side, k, d] = t.dataset.cbo.split(':'); const m = cur(side); if (m) { applyEdit(side, 'boost', Math.max(-6, Math.min(6, ((m.boosts || {})[k] || 0) + (+d))), k); render(); } return; }
      if (t.dataset.cmatch) { fromMatch(); return; }
      if (t.dataset.cpaste) { quickRival(); return; }
      if (t.dataset.cclear === 'me') { S.hide.me = []; S.manual.me = []; S.edits.me = {}; S.meActive = []; S.selMe = 0; persist(); lastHash = ''; tick(true); return; }
      if (t.dataset.cclear) { S.hide.foe = []; S.teamFoe = ''; S.manual.foe = []; S.edits.foe = {}; S.foeActive = []; persist(); lastHash = ''; tick(true); return; }
      if (t.dataset.cmode) {
        S.meMode = t.dataset.cmode === 'free' ? 'free' : 'team';
        // Con tu equipo, el de la sesión si no habías elegido otro; a mano, empiezas con lo que ya hubieras puesto.
        if (S.meMode === 'team' && !S.teamMe && typeof SET !== 'undefined' && SET.teamId) S.teamMe = SET.teamId;
        S.edits.me = {}; S.meActive = []; S.selMe = 0; persist(); lastHash = ''; tick(true); return;
      }
      if (t.dataset.medit) { const [side, i] = t.dataset.medit.split(':'); if (+i >= 0) edit(side, +i, false); return; }
      if (t.dataset.cmv) { const [side, i] = t.dataset.cmv.split(':'); S.mvPick = S.mvPick && S.mvPick[0] === side && S.mvPick[1] === +i ? null : [side, +i]; S.mvQ = ''; render(); setTimeout(() => { const q = q1('#mvQ'); if (q) q.focus(); }, 30); return; }
      if (t.dataset.mvclose) { S.mvPick = null; render(); return; }
      if (t.dataset.pickmove != null && S.mvPick) {
        const [side, i] = S.mvPick;
        const before = cur(side), dup = before && t.dataset.pickmove ? before.moves.findIndex((x, k) => x === t.dataset.pickmove && k !== i) : -1;
        if (dup >= 0) applyEdit(side, 'move', before.moves[i] || '', dup);
        applyEdit(side, 'move', t.dataset.pickmove, i);
        S.mvPick = null; S.mvQ = '';
        S.selMove = t.dataset.pickmove ? [side, t.dataset.pickmove] : S.selMove;
        lastHash = ''; render(); return;
      }
      if (t.dataset.smv) { S.selMove = t.dataset.smv.split('|'); render(); return; }
      if (t.dataset.sdroll) { S.showRolls = !S.showRolls; render(); return; }
      if (t.dataset.cfw != null) { S.field.weather = t.dataset.cfw; S.field.userWT = true; persist(); render(); return; }
      if (t.dataset.cft != null) { S.field.terrain = t.dataset.cft; S.field.userWT = true; persist(); render(); return; }
      if (t.dataset.cfo) { S.field[t.dataset.cfo] = !S.field[t.dataset.cfo]; persist(); render(); return; }
      if (t.dataset.cfs) { const [side, key] = t.dataset.cfs.split('.'); S.field[side][key] = !S.field[side][key]; persist(); render(); return; }
      if (t.dataset.tuse) { Multi.click(t, api_state()); S.tab = 'multi'; persist(); render(); return; }
      if (t.dataset.pick) { const [side, i] = t.dataset.pick.split(':'); if (side === 'me') S.selMe = +i; else S.selFoe = +i; render(); }
      else if (t.dataset.add) edit(t.dataset.add, -1, true);
      else if (t.dataset.edit) edit(t.dataset.edit, t.dataset.edit === 'me' ? S.selMe : S.selFoe, false);
      else if (t.dataset.ctab) { S.tab = t.dataset.ctab; persist(); render(); const b = q1('.ctabbar'); if (b && b.getBoundingClientRect().top < 0) b.scrollIntoView({ block: 'start' }); }
      else if (t.dataset.csrc) { S.setSrc = t.dataset.csrc; persist(); lastHash = ''; tick(true); }
      else if (Multi.click(t, api_state())) render();
    });
    el.addEventListener('click', e => { const c = e.target.closest('[data-det]'); if (c) { S.det = c.dataset.det.split('|'); render(); setTimeout(() => { const d = q1('.ddet'); if (d) d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 30); } });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' && /^cPcName-/.test(e.target.id || '')) { e.preventDefault(); toPC(e.target.id.split('-')[1]); } });
    el.addEventListener('input', e => {
      if (e.target.id !== 'mvQ') return;
      S.mvQ = e.target.value;
      clearTimeout(S.mvT);
      S.mvT = setTimeout(() => {
        // Solo la lista: el cuadro de búsqueda no pierde el foco.
        const pnl = q1('.mvpanel'), m = S.mvPick && cur(S.mvPick[0]);
        if (!pnl || !m) return;
        const tmp = document.createElement('div');
        tmp.innerHTML = P.movePanel(m.species, U, TT, S.mvQ, m.moves, m.moves[S.mvPick[1]] || '');
        pnl.querySelector('.mvplist').replaceWith(tmp.querySelector('.mvplist'));
      }, 100);
    });
    el.addEventListener('contextmenu', e => {
      const t = e.target.closest('[data-pick]');
      if (!t || S.battleId) return;
      e.preventDefault();
      const [side, i] = t.dataset.pick.split(':');
      const key = side === 'me' ? 'meActive' : 'foeActive';
      const a = S[key];
      if (a.includes(+i)) S[key] = a.filter(x => x !== +i); else S[key] = [...a, +i].slice(-2);
      autoWeather();
      render();
    });
    el.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.cteam) { const side = t.dataset.cteam; S.hide[side] = []; S[side === 'me' ? 'teamMe' : 'teamFoe'] = t.value; S.edits[side] = {}; S[side === 'me' ? 'meActive' : 'foeActive'] = []; if (side === 'foe') S.manual.foe = []; S.field.userWT = false; persist(); lastHash = ''; tick(true); return; }
      if (t.dataset.hp) {
        const side = t.dataset.hp, m = S[side][side === 'me' ? S.selMe : S.selFoe];
        m.hp = Math.max(0, Math.min(100, +t.value || 0));
        S.edits[side][m.species] = { ...(S.edits[side][m.species] || {}), hp: m.hp };
        render(); return;
      }
      if (t.dataset.ce) { const [side, key, extra] = t.dataset.ce.split(':'); applyEdit(side, key, t.value, extra); render(); return; }
      if (t.dataset.cf) {
        const k = t.dataset.cf, f = S.field;
        if (k.includes('.')) { const [side, key] = k.split('.'); f[side][key] = t.checked; }
        else if (t.type === 'checkbox') f[k] = t.checked; else { f[k] = t.value; f.userWT = true; }
        persist(); render(); return;
      }
      if (Multi.change(t, api_state())) render();
    });
    el.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('fieldbox')) S.fieldOpen = e.target.open; }, true);
  }

  /* ---------- bucle ---------- */
  let busy = false;
  async function tick(force) {
    if (busy || !S.open || !root()) return;
    busy = true;
    try {
      let b = null;
      if (LIVE) { const r = await api.live(); b = r && r.ok ? r.battle : null; if (b && b.ended) b = null; }
      const hash = JSON.stringify(b) + S.teamMe + S.meMode + S.teamFoe + (U ? U.month : '') + TEAMS.length + JSON.stringify(S.manual);
      if (!force && hash === lastHash) return;
      lastHash = hash;
      if (b && (b.me || b.foe)) applyLive(b); else applyManual();
      // No repintar mientras escribes en el panel.
      const a = document.activeElement;
      if (!force && a && root().contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
      render();
    } catch (e) {
      console.error('[calculadora]', e);
    } finally { busy = false; }
  }

  async function init() {
    TEAMS = await P.teams();
    if (LIVE || (!S.teamMe && !freeMe())) { const s = await api.settings(); if (s.teamId) S.teamMe = s.teamId; }
    bind();
    tick(true);
    if (LIVE) setInterval(() => tick(false), 1500);
  }

  /** Cargar desde fuera (Mi PC, Teambuilder…): un set como tuyo o como rival. */
  function load(side, set) {
    addManual(side, { ...P.blankMon(set.species), ...P.clone(set), src: set.src || 'pc', hp: 100, boosts: {} });
  }
  async function reloadTeams() { TEAMS = await P.teams(); lastHash = ''; tick(true); }

  return {
    init, tick: () => tick(true), render, load, reloadTeams, state: api_state,
    setOpen(v) { const was = S.open; S.open = v; if (v && !was) { lastHash = ''; tick(true); } },
    setTeams(me, foe) { if (me !== undefined) { S.teamMe = me; S.hide.me = []; } if (foe !== undefined && !LIVE) { S.teamFoe = foe; S.manual.foe = []; S.hide.foe = []; } S.edits = { me: {}, foe: {} }; persist(); lastHash = ''; tick(true); },
    showRivals(sets) { if (LIVE) return; S.teamFoe = ''; S.manual.foe = sets.map(m => ({ ...m, hp: 100, boosts: {} })); S.edits.foe = {}; S.foeActive = []; S.selFoe = 0; persist(); lastHash = ''; tick(true); }
  };
}

/* Las dos calculadoras: la de Jugar (panel, sigue el combate) y la de la página Calculadora (estudio). */
const CalcLive = makeCalc({ root: $('#calcBody'), key: 'msCalc', live: true });
const CalcStudy = makeCalc({ root: $('#calcPage'), key: 'msCalcStudy', live: false });
const Calc = {
  arena: CalcParts.arenaHTML,
  /** Los equipos han cambiado: las dos se ponen al día. */
  reloadTeams() { CalcLive.reloadTeams(); CalcStudy.reloadTeams(); },
  /** Llevar sets a la calculadora de estudio. */
  load: (side, set) => CalcStudy.load(side, set),
  setTeams(me, foe) { if (me !== undefined) CalcLive.setTeams(me); CalcStudy.setTeams(me, foe); },
  showRivals: sets => CalcStudy.showRivals(sets),
  state: () => CalcStudy.state()
};

/* Panel en Jugar y tamaño del panel. */
(() => {
  const panel = $('#calcPanel'), btn = $('#calcToggle');
  const onPage = () => $('#v-calc').classList.contains('on');
  const setOpen = v => {
    panel.classList.toggle('closed', !v); btn.classList.toggle('on', v); btn.setAttribute('aria-pressed', String(v));
    try { localStorage.setItem('msCalcPanel', v ? '1' : '0'); } catch (e) { /* nada */ }
    CalcLive.setOpen(v);
  };
  btn.addEventListener('click', () => setOpen(panel.classList.contains('closed')));
  document.addEventListener('keydown', e => { if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(panel.classList.contains('closed')); } });
  window.addEventListener('ms:view', () => { CalcStudy.setOpen(onPage()); });
  // Ancho: el que dejes al arrastrar el borde (de 380 px hasta casi toda la ventana, lo decides tú) o «Más ancha» (un poco más: el 42 % de la ventana).
  let w = 560, wide = false;
  try { w = +localStorage.getItem('msCalcW') || 560; wide = localStorage.getItem('msCalcWide') === '1'; } catch (e) { /* nada */ }
  const maxW = () => Math.max(380, window.innerWidth - 480);
  const apply = () => { panel.style.width = `${wide ? Math.max(w, Math.min(maxW(), Math.round(window.innerWidth * 0.42))) : Math.min(w, maxW())}px`; };
  const setW = x => { w = Math.max(380, Math.min(maxW(), x)); wide = false; apply(); };
  window.CalcDrawer = {
    wide: () => wide,
    toggleWide() { wide = !wide; try { localStorage.setItem('msCalcWide', wide ? '1' : '0'); } catch (e) { /* nada */ } apply(); }
  };
  apply();
  window.addEventListener('resize', apply);
  const grip = $('#calcGrip');
  grip.addEventListener('pointerdown', e => {
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    document.body.classList.add('resizing');
    const x0 = e.clientX, w0 = panel.getBoundingClientRect().width;
    const move = ev => setW(w0 + (x0 - ev.clientX));
    const up = () => { grip.removeEventListener('pointermove', move); document.body.classList.remove('resizing'); try { localStorage.setItem('msCalcW', String(w)); localStorage.setItem('msCalcWide', '0'); } catch (err) { /* nada */ } };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up, { once: true });
  });
  let open = true;
  try { open = localStorage.getItem('msCalcPanel') !== '0'; } catch (e) { /* nada */ }
  setOpen(open);
  CalcStudy.setOpen(onPage());
  CalcLive.init();
  CalcStudy.init();
  DB.onChange(key => { if (key === 'equipos') Calc.reloadTeams(); });
})();
