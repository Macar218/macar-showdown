'use strict';
/* Macar Showdown · Teambuilder: tus equipos, el equipo con el que juegas y su análisis. */
/* global P, DB, api, $, $$, esc, spr, closeModal, VIEWS, show, Calc, SET */

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
  function slot(m, i) {
    if (!m) return `<button class="tslot empty" data-tadd="1"><span>+</span>Añadir Pokémon</button>`;
    const st = P.stats(m) || {};
    return `<div class="tslot" data-tedit="${i}" tabindex="0">
      <div class="tshead">${spr(m.species)}<div><b>${esc(m.nick && m.nick !== m.species ? `${m.nick} (${m.species})` : m.species)}</b><div class="tytags">${P.typesOf(m.species).map(P.typeBadge).join('')}</div></div>
        <span class="tsbtns"><button class="btn sm" data-tleft="${i}" title="Mover a la izquierda">◀</button><button class="btn sm" data-tright="${i}" title="Mover a la derecha">▶</button></span></div>
      <div class="mline"><span>${esc(m.item || 'Sin objeto')}</span><span>${esc(m.ability || '')}</span></div>
      <div class="tsstats">${P.STATS.map((s, j) => `<span class="${P.natMult(m.nature, s) > 1 ? 'up' : P.natMult(m.nature, s) < 1 ? 'dn' : ''}"><small>${P.SL[s]}</small><b>${st[s] ?? ''}</b><em>${m.sp[j] || ''}</em></span>`).join('')}</div>
      <ul class="tsmoves">${m.moves.map(x => { const d = P.moveOf(x); return `<li>${x ? `${P.typeDot(d ? d.type : '')}${esc(x)}` : '<span class="note">—</span>'}</li>`; }).join('')}</ul>
    </div>`;
  }
  async function render() {
    const el = $('#v-equipo');
    const { list, team } = await current();
    const S = sets(team);
    const isMine = team && SET.teamId === team.id;
    const def = defense(S), off = offense(S);
    const spd = S.map(m => ({ m, v: (P.stats(m) || {}).spe || 0 })).sort((a, b) => b.v - a.v);
    el.innerHTML = `<div class="head"><div><h1>Team<span>builder</span></h1><p class="note" style="margin-top:4px">Tus equipos. El marcado como <b>mi equipo</b> es el que usan el Dashboard, la Calculadora y el Documento.</p></div>
      <div class="row-btns"><button class="btn" id="tbTour" title="Equipos del top cut de los torneos, listos para cargar">Equipos de torneo</button><button class="btn" id="tbNew">Nuevo equipo</button><button class="btn primary" id="tbImp">Importar equipo</button></div></div>
      <div class="card" style="margin-bottom:14px"><div class="tbuser"><label class="field" style="flex:1">Tu usuario de Showdown<input type="text" id="tbUser" value="${esc(SET.showdownName || '')}" placeholder="Para saber qué jugador eres en cada partida"></label><button class="btn" id="tbUserOk">Guardar</button><span class="note" id="tbUserMsg"></span></div></div>
      <div class="tblayout">
        <aside class="tblist">${list.length ? list.map(t => `<button class="tbitem${t.id === T.id ? ' on' : ''}" data-tsel="${esc(t.id)}"><b>${esc(t.name)}${SET.teamId === t.id ? ' <span class="pill win">mi equipo</span>' : ''}</b><span>${sets(t).map(m => spr(m.species, 'xs')).join('')}</span></button>`).join('') : '<p class="note">Aún no tienes equipos. Crea uno o impórtalo.</p>'}</aside>
        <div class="tbmain">${team ? `
          <div class="tbtitle"><input type="text" id="tbName" value="${esc(team.name)}" aria-label="Nombre del equipo">
            ${isMine ? '<span class="pill win">Mi equipo</span>' : '<button class="btn primary sm" id="tbMine">Usar como mi equipo</button>'}
            <span style="flex:1"></span><button class="btn sm" id="tbCopy">Copiar</button><button class="btn sm" id="tbSd" title="Lo añade a tu teambuilder de Showdown (pestaña Jugar)">Enviar a Showdown</button><button class="btn sm" id="tbPC" title="Guarda cada Pokémon como un set en Mi PC">Sets a Mi PC</button><button class="btn sm" id="tbCalc" title="Abrirlo en la Calculadora como tu equipo">A la calculadora</button><button class="btn sm danger" id="tbDel">Borrar</button></div>
          <p class="note" id="tbMsg">${esc(T.msg)}</p>
          <div class="tslots">${[0, 1, 2, 3, 4, 5].map(i => slot(S[i], i)).join('')}</div>
          ${S.length ? `<div class="grid tbana">
            <div class="card"><h2>Defensa: qué te hace daño</h2><div class="tdef">${def.map(d => `<div class="tdrow${d.weak >= 3 && !d.res && !d.imm ? ' bad' : ''}" title="${esc(d.who.join(', '))}">${P.typeBadge(d.at)}<span class="w">${d.weak ? `${d.weak} débil${d.weak > 1 ? 'es' : ''}` : ''}</span><span class="r">${d.res ? `${d.res} resiste${d.res > 1 ? 'n' : ''}` : ''}</span><span class="i">${d.imm ? `${d.imm} inmune${d.imm > 1 ? 's' : ''}` : ''}</span></div>`).join('')}</div></div>
            <div class="card"><h2>Cobertura de tus ataques</h2><p class="note" style="margin-bottom:8px">Tipos a los que pegas supereficaz con algún movimiento.</p><div class="tcov">${off.map(o => `<span class="${o.hit ? 'on' : 'off'}">${P.typeBadge(o.def)}</span>`).join('')}</div>
              <p class="note" style="margin-top:8px">${off.filter(o => !o.hit).length ? `Sin supereficaz contra: ${off.filter(o => !o.hit).map(o => P.TYPES_ES[o.def]).join(', ')}` : 'Cubres todos los tipos.'}</p></div>
            <div class="card"><h2>Velocidades</h2><div class="tspd">${spd.map(x => `<div>${spr(x.m.species, 'xs')}<b>${x.v}</b><span class="note">${Math.floor(x.v * 1.5)} con Pañuelo · ${x.v * 2} con Viento Afín</span></div>`).join('')}</div></div>
            <div class="card"><h2>Revisión</h2><ul class="tchk">${checks(S).map(([k, t]) => `<li class="${k}">${esc(t)}</li>`).join('')}</ul></div>
            <div class="card wide"><h2>Notas del equipo</h2><textarea id="tbNotes" rows="4" placeholder="Idea del equipo, leads, planes…">${esc(team.notes || '')}</textarea></div>
          </div>` : ''}` : '<div class="card"><p class="note">Elige un equipo o crea uno nuevo.</p></div>'}
        </div></div>`;
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
  $('#v-equipo').addEventListener('click', async e => {
    const t = e.target.closest('button,[data-tedit]');
    if (!t) return;
    const { team } = await current();
    const S = sets(team);
    if (t.dataset.tsel) { T.id = t.dataset.tsel; T.msg = ''; render(); }
    else if (t.id === 'tbTour') { show('pc'); setTimeout(() => { const b = $('[data-ptab="tour"]'); if (b) b.click(); }, 80); }
    else if (t.id === 'tbNew') { const v = await P.saveTeam({ name: `Equipo ${(await myTeams()).length + 1}`, side: 'me', text: '' }); T.id = v.id; render(); }
    else if (t.id === 'tbImp') importModal();
    else if (t.id === 'tbUserOk') { const s = await api.setSettings({ showdownName: $('#tbUser').value.trim() }); Object.assign(SET, s); $('#tbUserMsg').textContent = 'Guardado.'; }
    else if (!team) return;
    else if (t.id === 'tbMine') { await setMine(team.id); render(); }
    else if (t.id === 'tbCopy') { navigator.clipboard.writeText(team.text); T.msg = 'Equipo copiado (formato Showdown).'; render(); }
    else if (t.id === 'tbSd') toShowdown(team);
    else if (t.id === 'tbPC') { let n = 0; for (const m of S) { const r = await P.pcAdd(P.cleanSet(m), { name: `${m.species} · ${team.name}`, side: 'me', box: team.name }); if (r.ok) n++; } T.msg = n ? `${n} set${n > 1 ? 's' : ''} guardados en Mi PC.` : 'Esos sets ya están en tu PC.'; render(); }
    else if (t.id === 'tbCalc') { Calc.setTeams(team.id); show('calc'); }
    else if (t.id === 'tbDel') { if (!confirm(`¿Borrar el equipo «${team.name}»?`)) return; await P.removeTeam(team.id); if (SET.teamId === team.id) await setMine(''); T.id = null; Calc.reloadTeams(); render(); }
    else if (t.dataset.tadd) P.openEditor({ set: P.blankMon(''), side: 'me', title: 'Añadir Pokémon al equipo', onSave: async m => { await saveSets(team, [...S, P.cleanSet(m)].slice(0, 6)); render(); } });
    else if (t.dataset.tleft || t.dataset.tright) {
      const i = +(t.dataset.tleft || t.dataset.tright), j = t.dataset.tleft ? i - 1 : i + 1;
      if (j < 0 || j >= S.length) return;
      [S[i], S[j]] = [S[j], S[i]]; await saveSets(team, S); render();
    } else if (t.dataset.tedit) {
      const i = +t.dataset.tedit;
      P.openEditor({ set: S[i], side: 'me', onSave: async m => { S[i] = P.cleanSet(m); await saveSets(team, S); render(); }, onDelete: async () => { S.splice(i, 1); await saveSets(team, S); render(); }, deleteLabel: 'Quitar del equipo' });
    }
  });
  $('#v-equipo').addEventListener('change', async e => {
    const { team } = await current();
    if (!team) return;
    if (e.target.id === 'tbName') { team.name = e.target.value.trim() || team.name; await P.saveTeam(team); Calc.reloadTeams(); render(); }
    if (e.target.id === 'tbNotes') { team.notes = e.target.value; await P.saveTeam(team); }
  });
  $('#v-equipo').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.tedit) e.target.click(); });

  VIEWS.equipo = render;
  return { render, defense, offense, checks, current, sets };
})();
