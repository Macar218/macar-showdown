'use strict';
/* Macar Showdown · Teambuilder: tus equipos, el equipo con el que juegas y su análisis. */
/* global P, DB, api, $, $$, esc, spr, closeModal, VIEWS, show, Calc, SET, newId */

const Team = (() => {
  const T = { id: null, msg: '' };
  const SPEED_CONTROL = ['tailwind', 'trickroom', 'icywind', 'electroweb', 'thunderwave', 'scaryface', 'bulldoze', 'rocktomb', 'glare', 'nuzzle', 'stringshot', 'cottonspore'];
  const REDIRECT = ['followme', 'ragepowder', 'spotlight'];
  const toID = P.toID;
  // Habilidades que cambian lo que le afecta (para el análisis de tipos).
  const AB_IMMUNE = { Levitate: 'Ground', 'Flash Fire': 'Fire', 'Water Absorb': 'Water', 'Storm Drain': 'Water', 'Dry Skin': 'Water', 'Volt Absorb': 'Electric', 'Lightning Rod': 'Electric', 'Motor Drive': 'Electric', 'Sap Sipper': 'Grass', 'Earth Eater': 'Ground', 'Well-Baked Body': 'Fire' };

  const sets = t => (t ? P.parseTeam(t.text).sets : []);
  async function myTeams() { return (await P.teams()).filter(t => t.side === 'me'); }
  async function current() {
    const list = await myTeams();
    if (!T.id || !list.some(t => t.id === T.id)) T.id = SET.teamId && list.some(t => t.id === SET.teamId) ? SET.teamId : (list[0] ? list[0].id : null);
    return { list, team: list.find(t => t.id === T.id) || null };
  }
  async function saveSets(team, list) {
    team.text = P.exportTeam(list);
    await P.saveTeam(team);
    Calc.reloadTeams();
  }

  /* ---------- análisis ---------- */
  function defense(list) {
    return P.TYPES.map(at => {
      let weak = 0, res = 0, imm = 0;
      const who = [];
      for (const m of list) {
        let e = P.effectiveness(at, P.typesOf(m.species));
        if (AB_IMMUNE[m.ability] === at) e = 0;
        if (m.ability === 'Thick Fat' && (at === 'Fire' || at === 'Ice')) e *= 0.5;
        if (m.ability === 'Purifying Salt' && at === 'Ghost') e *= 0.5;
        if (e === 0) imm++; else if (e > 1) { weak++; who.push(`${m.species} ×${e}`); } else if (e < 1) res++;
      }
      return { at, weak, res, imm, who };
    });
  }
  function offense(list) {
    const types = new Set();
    for (const m of list) for (const mv of m.moves) { const d = P.moveOf(mv); if (d && d.category !== 'Status') types.add(d.type); }
    return P.TYPES.map(def => ({ def, hit: [...types].some(t => P.effectiveness(t, [def]) > 1), best: Math.max(0, ...[...types].map(t => P.effectiveness(t, [def]))) }));
  }
  function checks(list) {
    const has = ids => list.filter(m => m.moves.some(x => ids.includes(toID(x))));
    const out = [];
    const sc = has(SPEED_CONTROL);
    out.push(sc.length ? ['ok', `Control de velocidad: ${sc.map(m => `${m.species} (${m.moves.filter(x => SPEED_CONTROL.includes(toID(x))).join(', ')})`).join(' · ')}`] : ['bad', 'Sin control de velocidad (Tailwind, Trick Room, Icy Wind…)']);
    const rd = has(REDIRECT);
    out.push(rd.length ? ['ok', `Redirección: ${rd.map(m => m.species).join(', ')}`] : ['mid', 'Sin redirección (Follow Me / Rage Powder)']);
    const fo = has(['fakeout']);
    out.push(fo.length ? ['ok', `Fake Out: ${fo.map(m => m.species).join(', ')}`] : ['mid', 'Sin Fake Out']);
    const intim = list.filter(m => m.ability === 'Intimidate');
    if (intim.length) out.push(['ok', `Intimidación: ${intim.map(m => m.species).join(', ')}`]);
    const noProt = list.filter(m => !m.moves.some(x => ['protect', 'detect', 'spikyshield', 'banefulbunker', 'silktrap', 'burningbulwark', 'kingsshield'].includes(toID(x))));
    if (noProt.length) out.push(['mid', `Sin Protección: ${noProt.map(m => m.species).join(', ')}`]);
    const items = list.map(m => m.item).filter(Boolean);
    const dup = items.filter((x, i) => items.indexOf(x) !== i);
    if (dup.length) out.push(['bad', `Objeto repetido (no se puede en VGC): ${[...new Set(dup)].join(', ')}`]);
    const megas = list.filter(m => /ite( [XY])?$/.test(m.item) && m.item !== 'Eviolite');
    if (megas.length > 1) out.push(['mid', `Varias Megapiedras: solo megaevoluciona uno por combate (${megas.map(m => m.species).join(', ')})`]);
    const shared = defense(list).filter(d => d.weak >= 3 && d.res + d.imm === 0);
    out.push(shared.length ? ['bad', `Debilidad compartida: ${shared.map(d => `${P.TYPES_ES[d.at]} (${d.weak})`).join(', ')}`] : ['ok', 'Sin debilidades compartidas graves']);
    return out;
  }

  /* ---------- pintar ---------- */
  // El Pokémon que estás editando (pestaña) y lo que tarda en guardarse.
  Object.assign(T, { slot: 0, draft: null, itOpen: false, itTab: 'top', itQ: '', mvOpen: null, mvQ: '', U: null, TT: null, saveT: null });
  const natOf = n => P.NAT[n] || P.NAT.Hardy;
  const spTotal = m => m.sp.reduce((a, b) => a + (+b || 0), 0);
  /** Pestañas de los 6 Pokémon. */
  function tabs(S) {
    return `<div class="tbtabs">${S.map((m, i) => `<button class="tbtab${i === T.slot && !T.draft ? ' on' : ''}" data-tslot="${i}">${spr(m.species, 'sm')}<span><b class="nolang">${esc(m.nick && m.nick !== m.species ? m.nick : m.species)}</b><small class="nolang">${esc(m.item || '—')}</small></span></button>`).join('')}
      ${S.length < 6 ? `<button class="tbtab add${T.draft ? ' on' : ''}" data-tadd="1"><span>+</span>Añadir Pokémon</button>` : ''}</div>`;
  }
  /** Tabla de puntos como en Showdown: base, deslizador, puntos, stat final y + / − de naturaleza. */
  function statsTable(m) {
    const sp = P.spOf(m.species), st = P.stats(m) || {};
    const nat = natOf(m.nature), left = P.SP_TOTAL - spTotal(m);
    return `<div class="tbsp"><div class="tbsph"><h3>Puntos (SP)</h3><span class="tbleft ${left < 0 ? 'over' : left === 0 ? 'full' : ''}" id="tbLeft">Quedan ${left} de ${P.SP_TOTAL}</span></div>
      <div class="srow shead"><span></span><span>Base</span><span>Puntos</span><span></span><span>Total</span><span>Naturaleza</span></div>
      <div class="srows">${P.STATS.map((k, i) => {
        const base = sp ? sp.baseStats[k] : 0;
        const cls = P.natMult(m.nature, k) > 1 ? 'up' : P.natMult(m.nature, k) < 1 ? 'dn' : '';
        return `<div class="srow ${cls}" data-srow="${i}"><b>${P.SL[k]}</b>
          <span class="sbase" title="Estadística base"><em>${base}</em><i style="width:${Math.min(100, (base / 180) * 100)}%"></i></span>
          <input type="range" min="0" max="${P.SP_MAX}" value="${m.sp[i]}" data-sprange="${i}" aria-label="${P.SL[k]}">
          <span class="spstep"><button data-spdec="${i}" title="−1 (con Mayús, −4)">−</button><input type="number" min="0" max="${P.SP_MAX}" value="${m.sp[i]}" data-spnum="${i}" aria-label="${P.SL[k]}"><button data-spinc="${i}" title="+1 (con Mayús, +4)">+</button></span>
          <strong class="sfinal" data-sfinal="${i}">${st[k] ?? ''}</strong>
          ${i ? `<span class="snat"><button class="${nat.plus === k && nat.plus !== nat.minus ? 'on' : ''}" data-natp="${k}" title="Naturaleza que sube ${P.SL[k]}">+</button><button class="${nat.minus === k && nat.plus !== nat.minus ? 'on' : ''}" data-natm="${k}" title="Naturaleza que baja ${P.SL[k]}">−</button></span>` : '<span class="snat"></span>'}
        </div>`;
      }).join('')}</div>
      <div class="tbspf"><label class="field">Naturaleza<select id="tbNat">${P.NATURES.map(n => `<option value="${n.name}"${n.name === m.nature ? ' selected' : ''}>${esc(P.natLabel(n.name))}</option>`).join('')}</select></label>
        <button class="btn sm" id="tbSp0">Todo a 0</button><span class="note">Máximo ${P.SP_MAX} por estadística. Usa + y − para la naturaleza.</span></div></div>`;
  }
  function infoBox(m) {
    const it = m.item && P.itemInfo(m.item);
    return `<div class="tbinfo"><h3>Objeto, habilidad y movimientos</h3>
      <label class="field">Objeto<span class="itfield">${it && it.img ? `<img src="${it.img}" alt="">` : ''}<input list="dlItems" id="tbIt" value="${esc(m.item)}" autocomplete="off" placeholder="Sin objeto"><button class="btn sm" id="tbItPick">${T.itOpen ? 'Cerrar' : 'Elegir'}</button></span></label>
      <label class="field">Habilidad<select id="tbAb">${[...new Set([m.ability, ...P.abilitiesOf(m.species)].filter(Boolean))].map(a => `<option${a === m.ability ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select></label>
      <div class="field">Movimientos <span class="note">· pulsa uno para cambiarlo</span><div class="tbmoves">${m.moves.map((x, i) => { const d = x && P.moveOf(x); const info = x && P.moveInfo(x); return `<button class="tbmv tbmvd${T.mvOpen === i ? ' on' : ''}${d ? ` t-${esc(d.type)}` : ''}" data-tmvpick="${i}">${x ? `<span class="tbmvt"><b class="nolang">${esc(x)}</b><small>${d && d.basePower ? d.basePower : ''}${info && info.a ? ` · ${info.a}%` : ''}</small></span>${info ? `<span class="tbmvx nolang">${esc(info.desc)}</span>` : ''}` : `<span>Movimiento ${i + 1}</span>`}</button>`; }).join('')}</div></div></div>`;
  }
  function editor(S) {
    const m = T.draft || S[T.slot];
    if (!m) return `<div class="card"><p class="note">Este equipo está vacío: pulsa «Añadir Pokémon».</p></div>`;
    const draft = !!T.draft;
    return `<div class="tbed">
      <div class="tbedhead">${m.species ? spr(m.species, 'big') : '<span class="tbnospr"></span>'}
        <div class="tbedname"><label class="field">Pokémon<input list="dlSpecies" id="tbSpc" value="${esc(m.species)}" autocomplete="off" placeholder="Nombre en inglés: Garchomp…"></label>
          <label class="field">Mote<input id="tbNick" value="${esc(m.nick || '')}" autocomplete="off" placeholder="Opcional"></label>
          <div class="tytags">${m.species ? P.typesOf(m.species).map(P.typeBadge).join('') : ''}</div></div>
        <span style="flex:1"></span>
        ${draft ? '<span class="note">Escribe el Pokémon para añadirlo.</span>' : `<div class="row-btns" style="margin:0"><button class="btn sm" data-tleft="${T.slot}" title="Mover a la izquierda">◀</button><button class="btn sm" data-tright="${T.slot}" title="Mover a la derecha">▶</button><button class="btn sm" id="tbMore" title="Sets más usados, Mi PC y pegar el set">Más opciones</button><button class="btn sm danger" id="tbRm">Quitar</button></div>`}</div>
      ${m.species ? `<div class="tbedgrid">${statsTable(m)}${infoBox(m)}</div>${T.mvOpen != null ? `<div class="tbmvhead">Movimiento ${T.mvOpen + 1}</div>${P.movePanel(m.species, T.U, T.TT, T.mvQ, m.moves)}` : ''}${T.itOpen ? P.itemPanel(m.species, T.U, T.TT, T.itTab, T.itQ) : ''}` : ''}
    </div>`;
  }
  async function render() {
    const el = $('#v-equipo');
    const { list, team } = await current();
    const S = sets(team);
    if (!T.dexLoad) T.dexLoad = P.dex().then(() => { if ($('#v-equipo').classList.contains('on')) refresh(); });
    // Los datos de uso y de torneos se cargan por detrás (pueden tardar o no llegar sin conexión).
    if (!T.uLoad) { T.uLoad = Promise.all([P.usage(), P.tour()]).then(([u, t]) => { T.U = u; T.TT = t; if ($('#v-equipo').classList.contains('on') && (T.mvOpen != null || T.itOpen)) render(); }).catch(() => {}); }
    P.datalists();
    if (T.slot >= S.length) T.slot = Math.max(0, S.length - 1);
    const isMine = team && SET.teamId === team.id;
    const def = defense(S), off = offense(S);
    const spd = S.map(m => ({ m, v: (P.stats(m) || {}).spe || 0 })).sort((a, b) => b.v - a.v);
    const scroll = el.scrollTop;
    el.innerHTML = `<div class="head"><div><h1>Team<span>builder</span></h1><p class="note" style="margin-top:4px">Elige un Pokémon arriba y cambia sus puntos, objeto, habilidad y movimientos. Se guarda solo.</p></div>
      <div class="row-btns"><button class="btn" id="tbNew">Nuevo equipo</button><button class="btn primary" id="tbImp">Importar equipo</button></div></div>
      <div class="tblayout">
        <aside class="tblist">${list.length ? list.map(t => `<button class="tbitem${t.id === T.id ? ' on' : ''}" data-tsel="${esc(t.id)}"><b>${esc(t.name)}${SET.teamId === t.id ? ' <span class="pill win">mi equipo</span>' : ''}</b><span>${sets(t).map(m => spr(m.species, 'xs')).join('')}</span></button>`).join('') : '<p class="note">Aún no tienes equipos. Crea uno o impórtalo.</p>'}</aside>
        <div class="tbmain">${team ? `
          <div class="tbtitle"><input type="text" id="tbName" value="${esc(team.name)}" aria-label="Nombre del equipo">
            ${isMine ? '<span class="pill win">Mi equipo</span>' : '<button class="btn primary sm" id="tbMine">Usar como mi equipo</button>'}
            <span style="flex:1"></span><button class="btn sm" id="tbCopy">Copiar</button><button class="btn sm" id="tbSd" title="Lo añade a tu teambuilder de Showdown (pestaña Jugar)">Enviar a Showdown</button><button class="btn sm" id="tbPC" title="Guarda cada Pokémon como un set en Mi PC">Sets a Mi PC</button><button class="btn sm" id="tbCalc" title="Abrirlo en la Calculadora como tu equipo">A la calculadora</button><button class="btn sm danger" id="tbDel">Borrar</button></div>
          <p class="note" id="tbMsg">${esc(T.msg)}</p>
          ${tabs(S)}
          ${editor(S)}
          ${S.length ? `<div class="card tbnotes"><h2>Notas del equipo</h2><textarea id="tbNotes" rows="3" placeholder="Idea del equipo, leads, planes…">${esc(team.notes || '')}</textarea></div>
          <details class="tbanal"${T.anOpen ? ' open' : ''}><summary>Análisis del equipo <span class="note">· revisión, debilidades, cobertura y velocidades</span></summary>
            <ul class="tchk sm">${checks(S).map(([k, t]) => `<li class="${k}">${esc(t)}</li>`).join('')}</ul>
            <div class="tbanagrid">
              <div><h4>Debilidades</h4><div class="tdef sm">${def.filter(d => d.weak).map(d => `<div class="tdrow${d.weak >= 3 && !d.res && !d.imm ? ' bad' : ''}" title="${esc(d.who.join(', '))}">${P.typeBadge(d.at)}<span class="w">${d.weak}</span><span class="r">${d.res ? `${d.res} res.` : ''}</span><span class="i">${d.imm ? `${d.imm} inm.` : ''}</span></div>`).join('')}</div></div>
              <div><h4>Sin supereficaz contra</h4><p class="note">${off.filter(o => !o.hit).length ? off.filter(o => !o.hit).map(o => P.typeBadge(o.def)).join(' ') : 'Cubres todos los tipos.'}</p>
                <h4 style="margin-top:8px">Velocidades</h4><div class="tspd sm">${spd.map(x => `<div>${spr(x.m.species, 'xs')}<b>${x.v}</b><span class="note">${Math.floor(x.v * 1.5)} Pañuelo · ${x.v * 2} Viento Afín</span></div>`).join('')}</div></div>
            </div></details>
          ` : ''}` : '<div class="card"><p class="note">Elige un equipo o crea uno nuevo.</p></div>'}
        </div></div>`;
    el.scrollTop = scroll;
    T.live = null; // tras repintar, el siguiente arrastre relee el equipo guardado
  }

  /** Repinta solo las pestañas y el editor del Pokémon (sin parpadeo de toda la página). */
  async function refresh() {
    const ed = $('#v-equipo .tbed'), tb = $('#v-equipo .tbtabs');
    if (!ed || !tb) return render();
    const { team } = await current();
    const S = sets(team);
    const tmp = document.createElement('div');
    tmp.innerHTML = tabs(S) + editor(S);
    tb.replaceWith(tmp.children[0]);
    $('#v-equipo .tbed').replaceWith(tmp.children[0]);
    T.live = null;
  }
  /** Solo la lista del buscador de movimientos (el cuadro de texto no pierde el foco). */
  async function refreshMoves() {
    const pnl = $('#v-equipo .mvpanel');
    if (!pnl) return;
    const { team } = await current();
    const S = sets(team), m = T.draft || S[T.slot];
    if (!m) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = P.movePanel(m.species, T.U, T.TT, T.mvQ, m.moves);
    pnl.querySelector('.mvplist').replaceWith(tmp.querySelector('.mvplist'));
  }

  /** Lo que hay en el editor, al Pokémon. */
  function readEditor(m) {
    const sp = P.calcSpecies(($('#tbSpc') || {}).value ? $('#tbSpc').value.trim() : '');
    if (sp && sp !== m.species) {
      const fresh = !m.species;
      m.species = sp;
      const ab = P.abilitiesOf(sp);
      if (fresh || !ab.includes(m.ability)) m.ability = ab[0] || '';
    }
    if ($('#tbNick')) m.nick = $('#tbNick').value.trim();
    if ($('#tbIt')) m.item = $('#tbIt').value.trim() ? P.nameOf('items', $('#tbIt').value.trim()) : '';
    if ($('#tbAb') && $('#tbAb').value) m.ability = $('#tbAb').value;
    if ($('#tbNat')) m.nature = $('#tbNat').value;
    $$('[data-tmv]').forEach(x => { m.moves[+x.dataset.tmv] = x.value.trim() ? P.nameOf('moves', x.value.trim()) : ''; });
  }
  /** Guarda el equipo (con un poco de espera mientras arrastras el deslizador). */
  function saveSoon(team, S, ms = 0) {
    clearTimeout(T.saveT);
    T.saveT = setTimeout(() => saveSets(team, S), ms);
  }
  /** Cambia los puntos de una estadística sin pasar de 32 ni del total de 66, y lo enseña sin repintar todo. */
  function setSP(m, i, v) {
    const others = spTotal(m) - (+m.sp[i] || 0);
    m.sp[i] = Math.max(0, Math.min(P.SP_MAX, P.SP_TOTAL - others, Math.round(+v || 0)));
    const st = P.stats(m) || {};
    const r = $(`[data-sprange="${i}"]`), n = $(`[data-spnum="${i}"]`), f = $(`[data-sfinal="${i}"]`);
    if (r) r.value = m.sp[i];
    if (n && document.activeElement !== n) n.value = m.sp[i];
    if (f) f.textContent = st[P.STATS[i]] ?? '';
    const left = P.SP_TOTAL - spTotal(m), l = $('#tbLeft');
    if (l) { l.textContent = `Quedan ${left} de ${P.SP_TOTAL}`; l.className = `tbleft ${left < 0 ? 'over' : left === 0 ? 'full' : ''}`; }
  }
  /** + / − de naturaleza, como en Showdown: pulsar el que ya está no cambia nada; si chocan, se intercambian. */
  function setNature(m, plus, minus) {
    const cur = natOf(m.nature), neutral = cur.plus === cur.minus;
    let p = neutral ? null : cur.plus, n = neutral ? null : cur.minus;
    if (plus) { if (p === plus) return; if (n === plus) n = p; p = plus; }
    if (minus) { if (n === minus) return; if (p === minus) p = n; n = minus; }
    if (!p) p = n === 'atk' ? 'spa' : 'atk';
    if (!n) n = p === 'spa' ? 'atk' : 'spa';
    const nat = p !== n ? P.NATURES.find(x => x.plus === p && x.minus === n) : null;
    m.nature = nat ? nat.name : 'Hardy';
  }
  async function importModal() {
    const box = $('#modalBox');
    box.onclick = box.onchange = null;
    box.innerHTML = `<button class="btn x" id="mClose">Cerrar</button><h2>Importar equipo</h2>
      <div class="ed"><label class="field">Nombre (si lo dejas vacío, el del Pokepaste)<input id="imName"></label><label class="field">De quién<select id="imSide"><option value="me">Mío</option><option value="foe">De un rival</option></select></label>
        <label class="field">Enlace de pokepast.es<input id="imUrl" placeholder="https://pokepast.es/…"></label></div>
      <textarea id="imTxt" rows="10" placeholder="O pega el equipo en formato Showdown (hasta 6 Pokémon)"></textarea>
      <div class="row-btns"><button class="btn" id="imFetch">Traer Pokepaste</button><span class="note" id="imMsg"></span><span style="flex:1"></span><button class="btn primary" id="imOk">Guardar equipo</button></div>`;
    $('#mClose').onclick = closeModal;
    $('#imFetch').onclick = async () => {
      $('#imMsg').textContent = 'Trayendo…';
      const r = await api.fetchPaste($('#imUrl').value);
      if (!r.ok) { $('#imMsg').textContent = r.why; return; }
      $('#imTxt').value = r.text; if (!$('#imName').value) $('#imName').value = r.title || '';
      $('#imMsg').textContent = 'Listo. Revisa y guarda.';
    };
    $('#imOk').onclick = async () => {
      const r = P.parseTeam($('#imTxt').value);
      if (!r.sets.length) { $('#imMsg').textContent = `No se ha encontrado ningún Pokémon de Champions.${r.bad.length ? ` Desconocidos: ${r.bad.join(', ')}` : ''}`; return; }
      const side = $('#imSide').value;
      const v = await P.saveTeam({ name: $('#imName').value.trim() || r.sets.slice(0, 3).map(s => s.species).join(' / '), side, text: P.exportTeam(r.sets.slice(0, 6)) });
      if (side === 'me') { T.id = v.id; if (!SET.teamId) await setMine(v.id); }
      T.msg = r.bad.length ? `No reconocidos (fuera): ${r.bad.join(', ')}` : '';
      closeModal(); Calc.reloadTeams(); render();
    };
    $('#modal').classList.remove('hide');
    $('#imTxt').focus();
  }
  async function setMine(id) {
    const s = await api.setSettings({ teamId: id });
    Object.assign(SET, s);
    Calc.setTeams(id);
  }

  /** Enviar al teambuilder de Showdown (en la pestaña Jugar). */
  async function toShowdown(team) {
    const r = await api.sdAddTeam(team.name, team.text);
    T.msg = r.ok ? 'Añadido a tu teambuilder de Showdown (pestaña Jugar).' : `No se pudo: ${r.why}`;
    render();
  }

  /* ---------- eventos ---------- */
  const view = $('#v-equipo');
  view.addEventListener('click', async e => {
    const t = e.target.closest('button,[data-tedit]');
    if (!t) return;
    const { team } = await current();
    const S = sets(team);
    const d = t.dataset;
    const m = T.draft || S[T.slot];
    T.live = null;
    if (d.tsel) { T.id = d.tsel; T.msg = ''; T.slot = 0; T.draft = null; T.itOpen = false; T.mvOpen = null; render(); }
    else if (t.id === 'tbNew') { const v = await P.saveTeam({ name: `Equipo ${(await myTeams()).length + 1}`, side: 'me', text: '' }); T.id = v.id; T.slot = 0; T.draft = P.blankMon(''); render(); }
    else if (t.id === 'tbImp') importModal();
    else if (!team) return;
    else if (d.tslot != null) { T.slot = +d.tslot; T.draft = null; T.itOpen = false; T.mvOpen = null; render(); }
    else if (d.tadd) { T.draft = P.blankMon(''); T.itOpen = false; render(); setTimeout(() => $('#tbSpc') && $('#tbSpc').focus(), 30); }
    else if (t.id === 'tbMine') { await setMine(team.id); render(); }
    else if (t.id === 'tbCopy') { navigator.clipboard.writeText(team.text); T.msg = 'Equipo copiado (formato Showdown).'; render(); }
    else if (t.id === 'tbSd') toShowdown(team);
    else if (t.id === 'tbPC') { let n = 0; for (const x of S) { const r = await P.pcAdd(P.cleanSet(x), { name: `${x.species} · ${team.name}`, side: 'me', box: team.name }); if (r.ok) n++; } T.msg = n ? `${n} set${n > 1 ? 's' : ''} guardados en Mi PC.` : 'Esos sets ya están en tu PC.'; render(); }
    else if (t.id === 'tbCalc') { Calc.setTeams(team.id); show('calc'); }
    else if (t.id === 'tbDel') { if (!confirm(`¿Borrar el equipo «${team.name}»?`)) return; await P.removeTeam(team.id); if (SET.teamId === team.id) await setMine(''); T.id = null; Calc.reloadTeams(); render(); }
    else if (d.tleft || d.tright) {
      const i = +(d.tleft || d.tright), j = d.tleft ? i - 1 : i + 1;
      if (j < 0 || j >= S.length) return;
      [S[i], S[j]] = [S[j], S[i]]; T.slot = j; await saveSets(team, S); render();
    } else if (t.id === 'tbRm') { if (!confirm(`¿Quitar ${S[T.slot].species} del equipo?`)) return; S.splice(T.slot, 1); await saveSets(team, S); render(); }
    else if (t.id === 'tbMore') P.openEditor({ set: S[T.slot], side: 'me', onSave: async x => { S[T.slot] = P.cleanSet(x); await saveSets(team, S); render(); }, onDelete: async () => { S.splice(T.slot, 1); await saveSets(team, S); render(); }, deleteLabel: 'Quitar del equipo' });
    else if (!m || !m.species) return;
    else if (t.id === 'tbSp0') { m.sp = [0, 0, 0, 0, 0, 0]; await saveSets(team, S); refresh(); }
    else if (d.natp || d.natm) { readEditor(m); setNature(m, d.natp, d.natm); await saveSets(team, S); refresh(); }
    else if (t.id === 'tbItPick') { readEditor(m); T.itOpen = !T.itOpen; T.itQ = ''; T.mvOpen = null; refresh(); }
    else if (d.spdec != null || d.spinc != null) {
      const i = +(d.spdec ?? d.spinc), step = (e.shiftKey ? 4 : 1) * (d.spdec != null ? -1 : 1);
      setSP(m, i, (+m.sp[i] || 0) + step); await saveSets(team, S); refresh();
    }
    else if (d.tmvpick != null) { readEditor(m); T.mvOpen = T.mvOpen === +d.tmvpick ? null : +d.tmvpick; T.mvQ = ''; T.itOpen = false; await refresh(); setTimeout(() => { const q = $('#v-equipo #mvQ'); if (q) q.focus(); }, 30); }
    else if (d.mvclose) { T.mvOpen = null; refresh(); }
    else if (d.pickmove != null && T.mvOpen != null) {
      // Como en Showdown: si ya lo tenía en otro hueco, se intercambian (nunca dos iguales).
      const dup = d.pickmove ? m.moves.findIndex((x, k) => x === d.pickmove && k !== T.mvOpen) : -1;
      if (dup >= 0) m.moves[dup] = m.moves[T.mvOpen] || '';
      m.moves[T.mvOpen] = d.pickmove;
      const next = m.moves.findIndex((x, k) => !x && k !== T.mvOpen);
      T.mvOpen = d.pickmove && next >= 0 ? next : null; T.mvQ = '';
      await saveSets(team, S); refresh();
    }
    else if (d.ittab) { T.itTab = d.ittab; T.itQ = ''; refresh(); }
    else if (d.pickitem != null) { m.item = d.pickitem; T.itOpen = false; await saveSets(team, S); refresh(); }
  });
  // Deslizadores y números de puntos: se ven al momento y se guardan al soltar.
  view.addEventListener('input', async e => {
    const x = e.target;
    if (x.dataset.sprange == null && x.dataset.spnum == null && x.id !== 'itQ' && x.id !== 'mvQ') return;
    if (T.live && x.id !== 'itQ' && x.id !== 'mvQ') { const mm = T.draft || T.live.S[T.slot]; setSP(mm, +(x.dataset.sprange ?? x.dataset.spnum), x.value); saveSoon(T.live.team, T.live.S, 350); return; }
    const { team } = await current();
    const S = sets(team);
    const m = T.draft || S[T.slot];
    if (!team || !m) return;
    if (x.id === 'itQ') { T.itQ = x.value; const pos = x.selectionStart; render().then(() => { const q = $('#itQ'); if (q) { q.focus(); q.setSelectionRange(pos, pos); } }); return; }
    if (x.id === 'mvQ') { T.mvQ = x.value; clearTimeout(T.mvT); T.mvT = setTimeout(refreshMoves, 100); return; }
    // Mientras se arrastra, el equipo en memoria se guarda en T.live para no releerlo a cada paso.
    if (!T.live || T.live.team.id !== team.id) T.live = { team, S };
    const L = T.live, mm = T.draft || L.S[T.slot];
    setSP(mm, +(x.dataset.sprange ?? x.dataset.spnum), x.value);
    saveSoon(L.team, L.S, 350);
  });
  view.addEventListener('change', async e => {
    const x = e.target;
    const { team } = await current();
    if (!team) return;
    if (x.id === 'tbName') { team.name = x.value.trim() || team.name; await P.saveTeam(team); Calc.reloadTeams(); render(); return; }
    if (x.id === 'tbNotes') { team.notes = x.value; await P.saveTeam(team); return; }
    if (x.dataset.sprange != null || x.dataset.spnum != null) { clearTimeout(T.saveT); if (T.live) await saveSets(T.live.team, T.live.S); T.live = null; refresh(); return; }
    if (x.id === 'itQ' || x.id === 'mvQ') return;
    const S = sets(team);
    const m = T.draft || S[T.slot];
    if (!m) return;
    readEditor(m);
    if (T.draft) {
      if (!m.species) { render(); return; }
      S.push(P.cleanSet(m)); T.slot = S.length - 1; T.draft = null;
    }
    await saveSets(team, S);
    if (x.id === 'tbSpc' || x.id === 'tbNick') render(); else refresh();
  });
  view.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('tbanal')) T.anOpen = e.target.open; }, true);
  view.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.tedit) e.target.click(); });

  VIEWS.equipo = render;
  /** Abrir un equipo concreto en el Teambuilder. */
  function select(id) { T.id = id; T.msg = ''; T.slot = 0; T.draft = null; }
  return { render, defense, offense, checks, current, sets, select };
})();
