'use strict';
/* Macar Showdown · calculadora de daño pegada al combate en directo (y Multicalc en su pestaña). */
/* global P, DB, api, $, $$, esc, spr, closeModal, Multi */

const Calc = (() => {
  const { toID, STATS, SL, WEATHERS, TERRAINS, SIDE_FX } = P;

  /* ---------- estado ---------- */
  const S = {
    open: true, follow: true, tab: 'dmg',
    me: [], foe: [], meActive: [], foeActive: [],
    selMe: 0, selFoe: 0,
    field: P.blankField(),
    teamMe: '', teamFoe: '',          // equipos del Team Box elegidos
    battleId: null, format: '', turn: 0, spectator: false,
    edits: { me: {}, foe: {} },       // cambios a mano sobre lo que viene del combate o del equipo
    manual: { me: [], foe: [] }       // Pokémon añadidos a mano
  };
  let TEAMS = [];
  let U = null, usageFor = null, usageMsg = '';
  let lastHash = '';

  try { Object.assign(S, JSON.parse(localStorage.getItem('msCalc') || '{}'), { battleId: null, edits: { me: {}, foe: {} } }); } catch (e) { /* nada */ }
  if (!S.field || !S.field.me) S.field = P.blankField();
  const persist = () => {
    try { localStorage.setItem('msCalc', JSON.stringify({ follow: S.follow, tab: S.tab, teamMe: S.teamMe, teamFoe: S.teamFoe, manual: S.manual, field: S.field })); } catch (e) { /* nada */ }
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
    const s = setFromTeam(S.teamFoe, species);
    if (s) return { ...s, src: 'equipo' };
    const u = P.usageSet(U, species);
    if (u) return u;
    return { ...P.blankMon(species), src: 'sin datos' };
  }

  /* ---------- del combate a la calculadora ---------- */
  function fromLiveMine(p) {
    const species = P.calcSpecies(p.species);
    if (!species) return null;
    let m = P.blankMon(species);
    const saved = setFromTeam(S.teamMe, species);
    if (p.exact) {
      const sol = P.solveSP(species, p.stats, p.hpAbs ? p.hpAbs[1] : 0);
      if (sol) { m.nature = sol.nature; m.sp = sol.sp; }
      m.src = sol ? 'exacto' : 'combate';
    } else if (saved) m = { ...saved, src: 'equipo' };
    else { const u = P.usageSet(U, species); if (u) m = u; }
    if (p.item) m.item = P.nameOf('items', p.item);
    if (p.ability) m.ability = P.nameOf('abilities', p.ability);
    if (p.moves && p.moves.length) m.moves = [...p.moves.map(x => P.nameOf('moves', x)), '', '', '', ''].slice(0, 4);
    if (!m.ability) m.ability = P.abilitiesOf(species)[0] || '';
    return Object.assign(m, { hp: p.hp, status: p.status || '', boosts: p.boosts || {}, fainted: p.fainted, nick: p.name, live: true });
  }
  function fromLiveFoe(p) {
    const species = P.calcSpecies(p.species);
    if (!species) return null;
    const m = defaultFoeSet(species);
    if (p.item) m.item = P.nameOf('items', p.item);
    if (p.ability) m.ability = P.nameOf('abilities', p.ability);
    const seen = (p.moves || []).map(x => P.nameOf('moves', x)).filter(Boolean);
    if (seen.length) {
      const rest = m.moves.filter(x => x && !seen.includes(x));
      m.moves = [...seen, ...rest, '', '', '', ''].slice(0, 4);
      m.seenMoves = seen;
    }
    return Object.assign(m, { hp: p.hp, status: p.status || '', boosts: p.boosts || {}, fainted: p.fainted, nick: p.name, live: true, revealed: { item: !!p.item, ability: !!p.ability } });
  }
  const WEATHER_MAP = { sunnyday: 'Sun', desolateland: 'Harsh Sunshine', raindance: 'Rain', primordialsea: 'Heavy Rain', sandstorm: 'Sand', snowscape: 'Snow', snow: 'Snow', hail: 'Snow' };
  const TERRAIN_MAP = { 'Electric Terrain': 'Electric', 'Grassy Terrain': 'Grassy', 'Psychic Terrain': 'Psychic', 'Misty Terrain': 'Misty' };
  const sideFromLive = c => ({ ref: !!c.reflect, ls: !!c.lightscreen, veil: !!c.auroraveil, tw: !!c.tailwind });
  const withEdits = (side, list) => list.map(m => (m && S.edits[side][m.species] ? { ...m, ...S.edits[side][m.species] } : m));

  function applyLive(b) {
    const newBattle = b.id !== S.battleId;
    if (newBattle) { S.battleId = b.id; S.edits = { me: {}, foe: {} }; }
    S.format = b.format; S.turn = b.turn; S.spectator = b.spectator;
    S.me = withEdits('me', (b.me ? b.me.team : []).map(fromLiveMine).filter(Boolean));
    S.foe = withEdits('foe', (b.foe ? b.foe.team : []).map(fromLiveFoe).filter(Boolean));
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
    S.battleId = null; S.format = ''; S.turn = 0; S.spectator = false;
    const fromTeam = (id, extra) => { const t = teamById(id); return [...(t ? P.parseTeam(t.text).sets : []), ...extra.map(x => ({ ...x }))]; };
    S.me = withEdits('me', fromTeam(S.teamMe, S.manual.me).map(m => ({ ...m, src: m.src === 'pegado' ? 'equipo' : m.src })));
    S.foe = withEdits('foe', fromTeam(S.teamFoe, S.manual.foe).map(m => ({ ...m, src: m.src === 'pegado' ? 'equipo' : m.src })));
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
    const el = $('#cUsage'); if (el) el.textContent = usageMsg;
    const r = await P.usage(format);
    if (usageFor !== format) return;
    U = r;
    usageMsg = r ? `Sets del rival sin datos: los más usados en Smogon (${r.month}, ${r.cutoff}+).` : 'Sin sets de uso (¿sin conexión?). El rival sale sin puntos hasta que lo edites.';
    lastHash = '';
    tick(true);
  }

  /* ---------- pintar: pestaña Daño ---------- */
  const hpCls = hp => (hp <= 25 ? 'r' : hp <= 50 ? 'y' : '');
  function monChip(m, i, side) {
    const act = (side === 'me' ? S.meActive : S.foeActive).includes(i);
    const sel = (side === 'me' ? S.selMe : S.selFoe) === i;
    return `<button class="mchip${sel ? ' sel' : ''}${act ? ' act' : ''}${m.fainted ? ' fnt' : ''}" data-pick="${side}:${i}" title="${esc(m.species)}${act ? ' · en el campo' : ''}${S.battleId ? '' : ' · clic derecho: sacarlo al campo o retirarlo'}">${spr(m.species, 'sm')}<i class="hpbar"><i style="width:${Math.max(0, Math.min(100, m.hp))}%" class="${hpCls(m.hp)}"></i></i></button>`;
  }
  function strip(side) {
    return `<div class="strip"><span class="lbl">${side === 'me' ? 'Tus Pokémon' : 'Sus Pokémon'}</span><div class="chips">${S[side].map((m, i) => monChip(m, i, side)).join('')}<button class="mchip add" data-add="${side}" title="Añadir un Pokémon a mano">+</button></div></div>`;
  }
  const SRC = { exacto: 'exacto', uso: 'más usado', pegado: 'pegado', equipo: 'de tu equipo', manual: 'a mano', combate: 'combate', 'sin datos': 'sin datos', pc: 'Mi PC' };
  function monCard(m, side) {
    if (!m) return `<div class="mcard empty"><p class="note">${side === 'me' ? 'Elige tu Pokémon' : 'Elige el rival'} o añade uno con +.</p></div>`;
    const st = m.status ? `<span class="st ${m.status}">${esc(m.status.toUpperCase())}</span>` : '';
    const rv = m.revealed || {};
    const q = (on) => (side === 'foe' && on ? ' <em title="Aún no se ha visto: es lo más probable">?</em>' : '');
    return `<div class="mcard ${side}">
      <div class="mtop">${spr(m.species)}<div class="mname"><b>${esc(m.species)}</b><span class="src ${toID(m.src)}">${esc(SRC[m.src] || m.src || '')}</span></div>
        <button class="btn sm" data-edit="${side}">Editar</button></div>
      <div class="mhp"><div class="hpline"><i style="width:${Math.max(0, Math.min(100, m.hp))}%" class="${hpCls(m.hp)}"></i></div>
        <label>PS <input type="number" min="0" max="100" step="1" value="${Math.round(m.hp)}" data-hp="${side}">%</label>${st}</div>
      <div class="mline"><span title="Objeto">${esc(m.item || 'Sin objeto')}${q(m.item && !rv.item && m.live)}</span><span title="Habilidad">${esc(m.ability || '—')}${q(m.ability && !rv.ability && m.live)}</span></div>
      <div class="mline small"><span>${esc(P.natLabel(m.nature))}</span><span>${esc(P.spLine(m))}</span></div>
      <div class="boosts">${STATS.slice(1).map(s => { const v = (m.boosts && m.boosts[s]) || 0; return `<span class="bstep"><button data-boost="${side}:${s}:-1" aria-label="Bajar ${SL[s]}">−</button><b class="${v > 0 ? 'up' : v < 0 ? 'dn' : ''}">${SL[s]} ${v > 0 ? '+' : ''}${v}</b><button data-boost="${side}:${s}:1" aria-label="Subir ${SL[s]}">+</button></span>`; }).join('')}</div>
    </div>`;
  }
  function table(attSide) {
    const defSide = attSide === 'me' ? 'foe' : 'me';
    const att = S[attSide][attSide === 'me' ? S.selMe : S.selFoe];
    if (!att) return '';
    let targets = (defSide === 'me' ? S.meActive : S.foeActive).slice();
    const selDef = defSide === 'me' ? S.selMe : S.selFoe;
    if (!targets.includes(selDef)) targets = [selDef, ...targets].slice(0, 2);
    targets = targets.filter(i => S[defSide][i]);
    if (!targets.length) return '';
    const moves = att.moves.filter(Boolean);
    const seen = att.seenMoves || [];
    const head = targets.map(i => `<th>${spr(S[defSide][i].species, 'xs')}<span>${esc(S[defSide][i].species)}</span></th>`).join('');
    const rows = moves.length ? moves.map(mv => {
      const mvd = P.moveOf(mv);
      const cat = mvd ? mvd.category : '';
      const tag = attSide === 'foe' && seen.length && !seen.includes(mv) ? '<em title="No lo ha usado todavía">?</em>' : '';
      return `<tr><th class="mvn">${P.typeDot(mvd ? mvd.type : '')}${esc(mv)}${tag}${cat === 'Status' ? '<small>estado</small>' : ''}</th>${targets.map(i => (cat === 'Status' ? '<td class="dm none">—</td>' : P.cell(P.damage(att, S[defSide][i], mv, S.field, attSide)))).join('')}</tr>`;
    }).join('') : `<tr><td class="note" colspan="${targets.length + 1}">Sin movimientos. Pulsa Editar para ponerlos.</td></tr>`;
    return `<div class="dtable ${attSide}"><h3>${attSide === 'me' ? 'Tus ataques' : 'Sus ataques'} <span>${spr(att.species, 'xs')}${esc(att.species)}</span></h3>
      <table><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
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
      ${S.battleId && S.follow ? '<p class="note">Clima, campo, pantallas y Viento Afín se copian del combate en cada turno.</p>' : ''}</details>`;
  }

  function render() {
    const el = $('#calcBody');
    if (!el) return;
    const status = S.battleId
      ? `<span class="pill live">EN DIRECTO</span><span>Turno ${S.turn}${S.spectator ? ' · espectador' : ''}</span>`
      : '<span class="pill">MANUAL</span><span>Sin combate abierto</span>';
    const teamOpt = (side, v) => `<option value="">${side === 'me' ? 'Tu equipo…' : 'Equipo rival…'}</option>${TEAMS.filter(t => t.side === side).map(t => `<option value="${esc(t.id)}"${t.id === v ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}`;
    const keepScroll = el.scrollTop;
    el.innerHTML = `
      <div class="ctop">${status}<label class="tog${S.follow ? ' on' : ''}" title="Cargar lo que pasa en el combate abierto en Jugar"><input type="checkbox" id="cFollow"${S.follow ? ' checked' : ''}>Seguir el combate</label></div>
      <div class="cteams"><select id="cTeamMe" title="Tu equipo (si no hay combate, o si eres espectador)">${teamOpt('me', S.teamMe)}</select>
        <select id="cTeamFoe" title="Equipo del rival: sus sets mandan sobre los más usados">${teamOpt('foe', S.teamFoe)}</select>
        <button class="btn sm" id="cTeams" title="Pegar o traer de Pokepaste un equipo rival">+ Rival</button></div>
      ${strip('me')}${strip('foe')}
      <div class="seg ctabs" role="tablist"><button data-ctab="dmg" aria-pressed="${S.tab === 'dmg'}">Daño</button><button data-ctab="multi" aria-pressed="${S.tab === 'multi'}">Multicalc</button></div>
      <div id="cTab">${S.tab === 'multi' ? Multi.render(api_state()) : `
        <div class="mcards">${monCard(S.me[S.selMe], 'me')}<span class="vs">VS</span>${monCard(S.foe[S.selFoe], 'foe')}</div>
        ${speedLine()}${table('me')}${table('foe')}`}</div>
      ${fieldBox()}
      <p class="note usage" id="cUsage">${esc(usageMsg)}</p>`;
    el.scrollTop = keepScroll;
  }
  /** Lo que la Multicalc necesita saber. */
  const api_state = () => ({ S, me: S.me, foe: S.foe, meActive: S.meActive, foeActive: S.foeActive, field: S.field, live: !!S.battleId, turn: S.turn, battleId: S.battleId });

  /* ---------- editar / añadir ---------- */
  function edit(side, idx, isNew) {
    const cur = isNew ? null : S[side][idx];
    P.openEditor({
      set: cur || P.blankMon(''), side, usage: U, live: true,
      title: isNew ? `Añadir ${side === 'me' ? 'tu Pokémon' : 'Pokémon rival'}` : null,
      onDelete: isNew ? null : () => removeMon(side, idx),
      deleteLabel: 'Quitar de la calculadora',
      onSave: m => {
        if (isNew) {
          m.src = m.src === 'uso' ? 'uso' : (m.src === 'pc' ? 'pc' : 'manual');
          S.manual[side].push(P.clone(m));
          if (S.battleId) S[side].push(m); else applyManual();
          if (side === 'me') S.selMe = S[side].length - 1; else S.selFoe = S[side].length - 1;
        } else {
          const { live, fainted, nick, revealed, seenMoves, ...keep } = m; // eslint-disable-line no-unused-vars
          if (keep.src !== 'exacto' && keep.src !== 'pc') keep.src = 'manual';
          S.edits[side][cur.species] = keep;
          S[side][idx] = { ...S[side][idx], ...keep };
        }
        persist(); lastHash = ''; render();
      }
    });
  }
  function removeMon(side, idx) {
    const m = S[side][idx];
    const k = S.manual[side].findIndex(x => x.species === m.species);
    if (k >= 0) S.manual[side].splice(k, 1);
    S[side].splice(idx, 1);
    persist(); render();
  }

  /** Añadir un equipo rival rápido: pegar texto o enlace de Pokepaste. */
  function quickRival() {
    const box = $('#modalBox');
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

  /* ---------- eventos ---------- */
  function bind() {
    const el = $('#calcBody');
    el.addEventListener('click', e => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.pick) { const [side, i] = t.dataset.pick.split(':'); if (side === 'me') S.selMe = +i; else S.selFoe = +i; render(); }
      else if (t.dataset.add) edit(t.dataset.add, -1, true);
      else if (t.dataset.edit) edit(t.dataset.edit, t.dataset.edit === 'me' ? S.selMe : S.selFoe, false);
      else if (t.dataset.boost) {
        const [side, st, d] = t.dataset.boost.split(':');
        const m = S[side][side === 'me' ? S.selMe : S.selFoe];
        if (!m) return;
        m.boosts = { ...m.boosts, [st]: Math.max(-6, Math.min(6, ((m.boosts && m.boosts[st]) || 0) + +d)) };
        S.edits[side][m.species] = { ...(S.edits[side][m.species] || {}), boosts: m.boosts };
        render();
      } else if (t.dataset.ctab) { S.tab = t.dataset.ctab; persist(); render(); }
      else if (t.id === 'cTeams') quickRival();
      else if (Multi.click(t, api_state())) render();
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
      if (t.id === 'cFollow') { S.follow = t.checked; persist(); lastHash = ''; tick(true); return; }
      if (t.id === 'cTeamMe' || t.id === 'cTeamFoe') { S[t.id === 'cTeamMe' ? 'teamMe' : 'teamFoe'] = t.value; S.edits[t.id === 'cTeamMe' ? 'me' : 'foe'] = {}; S[t.id === 'cTeamMe' ? 'meActive' : 'foeActive'] = []; S.field.userWT = false; persist(); lastHash = ''; tick(true); return; }
      if (t.dataset.hp) {
        const side = t.dataset.hp, m = S[side][side === 'me' ? S.selMe : S.selFoe];
        m.hp = Math.max(0, Math.min(100, +t.value || 0));
        S.edits[side][m.species] = { ...(S.edits[side][m.species] || {}), hp: m.hp };
        render(); return;
      }
      if (t.dataset.cf) {
        const k = t.dataset.cf, f = S.field;
        if (k.includes('.')) { const [side, key] = k.split('.'); f[side][key] = t.checked; }
        else if (t.type === 'checkbox') f[k] = t.checked; else { f[k] = t.value; f.userWT = true; }
        persist(); render(); return;
      }
      if (Multi.change(t, api_state())) render();
    });
    el.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('fieldbox')) S.fieldOpen = e.target.open; }, true);
    DB.onChange(async key => { if (key === 'equipos') { TEAMS = await P.teams(); lastHash = ''; tick(true); } });
  }

  /* ---------- bucle en directo ---------- */
  let busy = false;
  async function tick(force) {
    if (busy || !S.open || !$('#calcBody')) return;
    busy = true;
    try {
      let b = null;
      if (S.follow) { const r = await api.live(); b = r && r.ok ? r.battle : null; }
      const hash = JSON.stringify(b) + S.teamMe + S.teamFoe + (U ? U.month : '') + TEAMS.length;
      if (!force && hash === lastHash) return;
      lastHash = hash;
      if (b && (b.me || b.foe)) applyLive(b); else applyManual();
      // No repintar mientras escribes en el panel.
      const a = document.activeElement;
      if (!force && a && $('#calcBody').contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
      render();
    } catch (e) {
      console.error('[calculadora]', e);
    } finally { busy = false; }
  }

  async function init() {
    TEAMS = await P.teams();
    if (!S.teamMe) { const s = await api.settings(); if (s.teamId) S.teamMe = s.teamId; }
    bind();
    tick(true);
    setInterval(() => tick(false), 1500);
  }

  /** Cargar desde fuera (Mi PC, Teambuilder…): un set como tuyo o como rival. */
  function load(side, set) {
    const m = { ...P.blankMon(set.species), ...P.clone(set), src: set.src || 'pc' };
    S.manual[side].push(m);
    if (S.battleId) S[side].push(m); else applyManual();
    if (side === 'me') S.selMe = S[side].length - 1; else S.selFoe = S[side].length - 1;
    persist(); render();
  }
  async function reloadTeams() { TEAMS = await P.teams(); lastHash = ''; tick(true); }

  return {
    init, tick: () => tick(true), render, load, reloadTeams, state: api_state,
    setOpen(v) { const was = S.open; S.open = v; if (v && !was) { lastHash = ''; tick(true); } },
    setTeams(me, foe) { if (me !== undefined) S.teamMe = me; if (foe !== undefined) S.teamFoe = foe; S.edits = { me: {}, foe: {} }; persist(); lastHash = ''; tick(true); }
  };
})();

/* Panel en Jugar, página Calculadora y tamaño del panel. El mismo cuerpo se mueve de un sitio a otro. */
(() => {
  const panel = $('#calcPanel'), btn = $('#calcToggle'), body = $('#calcBody');
  const placeBody = () => {
    const host = $('#v-calc').classList.contains('on') ? $('#calcPage') : panel;
    if (body.parentElement !== host) host.appendChild(body);
  };
  const onPage = () => $('#v-calc').classList.contains('on');
  const setOpen = v => {
    panel.classList.toggle('hide', !v); btn.classList.toggle('primary', v); btn.setAttribute('aria-pressed', String(v));
    try { localStorage.setItem('msCalcPanel', v ? '1' : '0'); } catch (e) { /* nada */ }
    Calc.setOpen(v || onPage());
  };
  btn.addEventListener('click', () => setOpen(panel.classList.contains('hide')));
  document.addEventListener('keydown', e => { if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(panel.classList.contains('hide')); } });
  window.addEventListener('ms:view', () => { placeBody(); Calc.setOpen(!panel.classList.contains('hide') || onPage()); });
  let w = 480;
  try { w = +localStorage.getItem('msCalcW') || 480; } catch (e) { /* nada */ }
  const setW = x => { w = Math.max(380, Math.min(820, x)); panel.style.width = `${w}px`; };
  setW(w);
  const grip = $('#calcGrip');
  grip.addEventListener('pointerdown', e => {
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    document.body.classList.add('resizing');
    const x0 = e.clientX, w0 = w;
    const move = ev => setW(w0 + (x0 - ev.clientX));
    const up = () => { grip.removeEventListener('pointermove', move); document.body.classList.remove('resizing'); try { localStorage.setItem('msCalcW', String(w)); } catch (err) { /* nada */ } };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up, { once: true });
  });
  let open = true;
  try { open = localStorage.getItem('msCalcPanel') !== '0'; } catch (e) { /* nada */ }
  setOpen(open);
  placeBody();
  Calc.init();
})();
