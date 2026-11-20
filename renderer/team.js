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
  Object.assign(T, { slot: 0, draft: null, itOpen: false, itTab: 'top', itQ: '', U: null, TT: null, saveT: null });
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
      <div class="srows">${P.STATS.map((k, i) => {
        const base = sp ? sp.baseStats[k] : 0;
        const cls = P.natMult(m.nature, k) > 1 ? 'up' : P.natMult(m.nature, k) < 1 ? 'dn' : '';
        return `<div class="srow ${cls}" data-srow="${i}"><b>${P.SL[k]}</b>
          <span class="sbase" title="Estadística base"><em>${base}</em><i style="width:${Math.min(100, (base / 180) * 100)}%"></i></span>
          <input type="range" min="0" max="${P.SP_MAX}" value="${m.sp[i]}" data-sprange="${i}" aria-label="${P.SL[k]}">
          <input type="number" min="0" max="${P.SP_MAX}" value="${m.sp[i]}" data-spnum="${i}" aria-label="${P.SL[k]}">
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
      <div class="field">Movimientos<div class="tbmoves">${m.moves.map((x, i) => { const d = x && P.moveOf(x); return `<label>${P.typeDot(d ? d.type : '')}<input list="dlMoves" data-tmv="${i}" value="${esc(x)}" autocomplete="off" placeholder="Movimiento ${i + 1}"></label>`; }).join('')}</div></div></div>`;
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
      ${m.species ? `<div class="tbedgrid">${statsTable(m)}${infoBox(m)}</div>${T.itOpen ? P.itemPanel(m.species, T.U, T.TT, T.itTab, T.itQ) : ''}` : ''}
    </div>`;
  }
  async function render() {
    const el = $('#v-equipo');
    const { list, team } = await current();
    const S = sets(team);
    if (!T.U) { [T.U, T.TT] = await Promise.all([P.usage(), P.tour()]); }
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
          ${S.length ? `<div class="grid tbana">
            <div class="card"><h2>Defensa: qué te hace daño</h2><div class="tdef">${def.map(d => `<div class="tdrow${d.weak >= 3 && !d.res && !d.imm ? ' bad' : ''}" title="${esc(d.who.join(', '))}">${P.typeBadge(d.at)}<span class="w">${d.weak ? `${d.weak} débil${d.weak > 1 ? 'es' : ''}` : ''}</span><span class="r">${d.res ? `${d.res} resiste${d.res > 1 ? 'n' : ''}` : ''}</span><span class="i">${d.imm ? `${d.imm} inmune${d.imm > 1 ? 's' : ''}` : ''}</span></div>`).join('')}</div></div>
            <div class="card"><h2>Cobertura de tus ataques</h2><p class="note" style="margin-bottom:8px">Tipos a los que pegas supereficaz con algún movimiento.</p><div class="tcov">${off.map(o => `<span class="${o.hit ? 'on' : 'off'}">${P.typeBadge(o.def)}</span>`).join('')}</div>
              <p class="note" style="margin-top:8px">${off.filter(o => !o.hit).length ? `Sin supereficaz contra: ${off.filter(o => !o.hit).map(o => P.TYPES_ES[o.def]).join(', ')}` : 'Cubres todos los tipos.'}</p></div>
            <div class="card"><h2>Velocidades</h2><div class="tspd">${spd.map(x => `<div>${spr(x.m.species, 'xs')}<b>${x.v}</b><span class="note">${Math.floor(x.v * 1.5)} con Pañuelo · ${x.v * 2} con Viento Afín</span></div>`).join('')}</div></div>
            <div class="card"><h2>Revisión</h2><ul class="tchk">${checks(S).map(([k, t]) => `<li class="${k}">${esc(t)}</li>`).join('')}</ul></div>
            <div class="card wide"><h2>Notas del equipo</h2><textarea id="tbNotes" rows="4" placeholder="Idea del equipo, leads, planes…">${esc(team.notes || '')}</textarea></div>
          </div>` : ''}` : '<div class="card"><p class="note">Elige un equipo o crea uno nuevo.</p></div>'}
        </div></div>`;
    el.scrollTop = scroll;
    T.live = null; // tras repintar, el siguiente arrastre relee el equipo guardado
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
    if (d.tsel) { T.id = d.tsel; T.msg = ''; T.slot = 0; T.draft = null; T.itOpen = false; render(); }
    else if (t.id === 'tbNew') { const v = await P.saveTeam({ name: `Equipo ${(await myTeams()).length + 1}`, side: 'me', text: '' }); T.id = v.id; T.slot = 0; T.draft = P.blankMon(''); render(); }
    else if (t.id === 'tbImp') importModal();
    else if (!team) return;
    else if (d.tslot != null) { T.slot = +d.tslot; T.draft = null; T.itOpen = false; render(); }
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
    else if (t.id === 'tbSp0') { m.sp = [0, 0, 0, 0, 0, 0]; await saveSets(team, S); render(); }
    else if (d.natp || d.natm) { readEditor(m); setNature(m, d.natp, d.natm); await saveSets(team, S); render(); }
    else if (t.id === 'tbItPick') { readEditor(m); T.itOpen = !T.itOpen; T.itQ = ''; render(); }
    else if (d.ittab) { T.itTab = d.ittab; T.itQ = ''; render(); }
    else if (d.pickitem != null) { m.item = d.pickitem; T.itOpen = false; await saveSets(team, S); render(); }
  });
  // Deslizadores y números de puntos: se ven al momento y se guardan al soltar.
  view.addEventListener('input', async e => {
    const x = e.target;
    if (x.dataset.sprange == null && x.dataset.spnum == null && x.id !== 'itQ') return;
    if (T.live && x.id !== 'itQ') { const mm = T.draft || T.live.S[T.slot]; setSP(mm, +(x.dataset.sprange ?? x.dataset.spnum), x.value); saveSoon(T.live.team, T.live.S, 350); return; }
    const { team } = await current();
    const S = sets(team);
    const m = T.draft || S[T.slot];
    if (!team || !m) return;
    if (x.id === 'itQ') { T.itQ = x.value; const pos = x.selectionStart; render().then(() => { const q = $('#itQ'); if (q) { q.focus(); q.setSelectionRange(pos, pos); } }); return; }
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
    if (x.dataset.sprange != null || x.dataset.spnum != null) { clearTimeout(T.saveT); if (T.live) await saveSets(T.live.team, T.live.S); T.live = null; render(); return; }
    if (x.id === 'itQ') return;
    const S = sets(team);
    const m = T.draft || S[T.slot];
    if (!m) return;
    readEditor(m);
    if (T.draft) {
      if (!m.species) { render(); return; }
      S.push(P.cleanSet(m)); T.slot = S.length - 1; T.draft = null;
    }
    await saveSets(team, S);
    render();
  });
  view.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.tedit) e.target.click(); });

  VIEWS.equipo = render;
  /** Abrir un equipo concreto en el Teambuilder. */
  function select(id) { T.id = id; T.msg = ''; T.slot = 0; T.draft = null; }
  return { render, defense, offense, checks, current, sets, select };
})();
