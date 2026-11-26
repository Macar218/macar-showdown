'use strict';
/* Macar Showdown · Mi PC: tus sets guardados (por cajas) y el Team Box (todos los equipos, tuyos y de rivales). */
/* global P, DB, api, $, $$, esc, spr, closeModal, VIEWS, show, Calc, SET, newId, I18N, Team */

const PC = (() => {
  const V = { tab: 'sets', q: '', side: '', box: '', sort: 'new', page: 0, tq: '', tmine: false, tpage: 0, T: null, U: null, sel: null, msg: '' };
  const PAGE = 30;
  /** Los sets de todos tus equipos se guardan solos en Mi PC (una caja por equipo, con su nombre) y se ponen al día. */
  async function syncSessions() {
    const teams = (await P.teams()).filter(t => t.side === 'me' && t.text);
    if (!teams.length) return false;
    const list = (await P.pcList()).slice();
    let changed = false;
    for (const t of teams) {
      for (const m of P.parseTeam(t.text).sets) {
        const key = `${t.id}|${P.toID(m.species)}`, text = P.exportSet(P.cleanSet(m));
        const old = list.find(x => x.auto === key);
        const bx = String(t.name || '').slice(0, 40);
        if (old) {
          if (old.text !== text) { old.text = text; changed = true; }
          // Si cambias el nombre del equipo, su caja también (salvo que la hayas movido tú a otra).
          if ((old.abox === undefined || old.box === old.abox) && old.box !== bx) { old.box = bx; old.abox = bx; changed = true; }
        } else { list.unshift({ id: newId('s'), name: '', notes: '', side: 'me', box: bx, abox: bx, text, up: Date.now(), auto: key }); changed = true; }
      }
    }
    if (changed) await DB.set('pc', list);
    return changed;
  }
  const parse = x => { const s = P.parseSet(x.text); return s && !s.bad ? s : null; };

  async function render() {
    const el = $('#v-pc');
    if (!V.synced) { V.synced = true; try { await syncSessions(); } catch (e) { /* nada */ } }
    const [list, teams] = await Promise.all([P.pcList(), P.teams()]);
    V.tnames = new Set(teams.filter(t => t.side === 'me').map(t => String(t.name || '').slice(0, 40)));
    const boxes = [...new Set(list.map(x => x.box).filter(Boolean))].sort();
    el.innerHTML = `<div class="head"><div><h1>Mi <span>PC</span></h1><p class="note" style="margin-top:4px">Tus sets y repartos guardados, y todos tus equipos. Se guardan en tu carpeta de datos.</p></div>
      <div class="seg">${[['sets', `Sets (${list.length})`], ['teams', `Team Box (${teams.length})`]].map(([k, l]) => `<button data-ptab="${k}" aria-pressed="${V.tab === k}">${l}</button>`).join('')}</div></div>
      ${V.tab === 'teams' ? teamsView(teams) : setsView(list, boxes)}
      <datalist id="dlBoxes">${boxes.map(b => `<option value="${esc(b)}">`).join('')}</datalist>`;
    paintTeamSel();
  }

  /** Las cajas: primero las de tus equipos y luego las demás (Rivales, las que crees tú). */
  function boxOpts(list, boxes) {
    const T = boxes.filter(b => V.tnames && V.tnames.has(b)), O = boxes.filter(b => !T.includes(b));
    const o = b => `<option value="${esc(b)}"${b === V.box ? ' selected' : ''}>${esc(b)} (${list.filter(x => x.box === b).length})</option>`;
    return (T.length ? `<optgroup label="Tus equipos">${T.map(o).join('')}</optgroup>` : '') + (O.length ? `<optgroup label="Otras cajas">${O.map(o).join('')}</optgroup>` : '');
  }
  /** Caja como en los juegos: 30 huecos con el sprite; al pulsar uno, su ficha a la derecha. */
  function setsView(list, boxes) {
    const q = V.q.toLowerCase();
    let L = list.map(x => ({ x, s: parse(x) })).filter(o => o.s);
    if (q) L = L.filter(o => `${o.x.name} ${o.s.species} ${o.x.notes} ${o.s.item} ${o.s.moves.join(' ')}`.toLowerCase().includes(q));
    const nMe = L.filter(o => o.x.side !== 'foe').length, nFoe = L.length - nMe;
    if (V.side) L = L.filter(o => (V.side === 'foe') === (o.x.side === 'foe'));
    const names = ['', ...boxes];
    if (!names.includes(V.box)) V.box = '';
    if (V.box) L = L.filter(o => o.x.box === V.box);
    L.sort((a, b) => b.x.up - a.x.up);
    const pages = Math.max(1, Math.ceil(L.length / PAGE));
    V.page = Math.min(V.page, pages - 1);
    const shown = L.slice(V.page * PAGE, (V.page + 1) * PAGE);
    const sel = L.find(o => o.x.id === V.sel) || null;
    const bi = names.indexOf(V.box);
    const slots = Array.from({ length: PAGE }, (_, i) => shown[i]);
    return `<div class="pctools card">
        <input type="search" id="pcQ" placeholder="Buscar: nombre, Pokémon, objeto, movimiento, notas…" value="${esc(V.q)}">
        <div class="seg">${[['', `Todos (${nMe + nFoe})`], ['me', `Tus sets (${nMe})`], ['foe', `Sets de rivales (${nFoe})`]].map(([k, l]) => `<button data-pcside="${k}" aria-pressed="${V.side === k}">${l}</button>`).join('')}</div>
        <button class="btn primary" id="pcAdd">Añadir sets</button></div>
      <p class="note" style="margin:-6px 0 10px">${V.side === 'foe' ? 'Los sets de rivales guardan lo que se ve en su hoja de equipo (objeto, habilidad, naturaleza y movimientos). Su reparto (SP) nunca se ve: se estima con el más común. Se traen desde Partidas.' : 'Cada equipo tuyo tiene su caja, con el nombre del equipo y sus sets al día. «Todas las cajas» los enseña todos juntos.'}</p>
      <div class="pcwrap">
        <div class="pcbox2">
          <div class="pcboxhead"><button class="btn sm" data-pcbox="${bi - 1}"${bi > 0 ? '' : ' disabled'} title="Caja anterior">◀</button>
            <select id="pcBox" title="Cada equipo tuyo tiene su caja con sus sets"><option value="">Todas las cajas (${list.length})</option>${boxOpts(list, boxes)}</select>
            <button class="btn sm" data-pcbox="${bi + 1}"${bi < names.length - 1 ? '' : ' disabled'} title="Caja siguiente">▶</button>
            ${pages > 1 ? `<span class="note">${V.page + 1}/${pages}</span><button class="btn sm" id="pcPrev"${V.page ? '' : ' disabled'}>‹</button><button class="btn sm" id="pcNext"${V.page < pages - 1 ? '' : ' disabled'}>›</button>` : ''}</div>
          <div class="pcgrid">${slots.map(o => (o ? `<button class="pcslot ${o.x.side}${o.x.id === V.sel ? ' on' : ''}" data-psel="${o.x.id}" title="${esc(o.x.name || o.s.species)}">${spr(o.s.species, 'pcspr')}<small class="nolang">${esc(o.x.name || o.s.species)}</small>${o.x.side === 'foe' ? '<i class="pcfoe">Rival</i>' : ''}<span class="pcx" data-pcx="${o.x.id}" role="button" title="Borrar de Mi PC (Ctrl+Z para deshacer)">×</span></button>` : '<span class="pcslot empty"></span>')).join('')}</div>
          ${!list.length ? '<p class="note" style="margin-top:8px">Tu PC está vacío. Añade sets con «Añadir sets» o empieza una sesión con tu equipo.</p>' : !L.length ? '<p class="note" style="margin-top:8px">Ningún set coincide.</p>' : ''}
        </div>
        <aside class="pcdetail">${sel ? detailHTML(sel.x, sel.s) : '<div class="pcempty"><b>Pulsa un Pokémon</b><span class="note">Verás su set entero y podrás ponerle nombre o añadirlo a un equipo.</span></div>'}</aside>
      </div>`;
  }
  function detailHTML(x, s) {
    const it = s.item && P.itemInfo(s.item), en = typeof I18N !== 'undefined' && I18N.lang === 'en';
    const foe = x.side === 'foe';
    // Del rival no se sabe el reparto: si no lo tiene, se enseña el más común con su naturaleza.
    const known = s.sp.some(Boolean);
    const shown = foe && !known ? { ...s, sp: P.spreadGuess(s.species, s.nature, null) || s.sp } : s;
    const nm = x.name || s.species;
    return `<div class="pcdh">${spr(s.species, 'huge')}<div class="pcdhn">
        ${V.rename ? `<input id="pdName" class="pcren" value="${esc(x.name || '')}" placeholder="${esc(s.species)}" maxlength="80">` : `<b class="nolang pcnm" data-pren="1" title="Doble clic para cambiar el nombre">${esc(nm)}</b>`}
        ${x.name ? `<span class="note nolang">${esc(s.species)}</span>` : ''}
        <div class="tytags">${P.typesOf(s.species).map(P.typeBadge).join('')}</div>
        <span class="pill ${foe ? 'loss' : 'win'}">${foe ? 'Set de rival' : 'Tuyo'}</span>${x.from ? `<span class="note">vs <span class="nolang">${esc(x.from.opp || '')}</span>${x.from.at ? ` · ${new Date(x.from.at).toLocaleDateString(en ? 'en-GB' : 'es-ES')}` : ''}</span>` : ''}</div></div>
      <p class="note pcrenhint">${V.rename ? 'Enter para guardar · Esc para dejarlo como estaba' : 'Doble clic en el nombre para cambiarlo.'}</p>
      <div class="mtinfo">
        <div class="mtik"><small>Objeto</small><span class="nolang">${it && it.img ? `<img src="${it.img}" alt="">` : ''}<b>${esc(s.item || '—')}</b></span>${it ? `<em class="nolang">${esc(en ? it.d : it.dEs || it.d)}</em>` : ''}</div>
        <div class="mtik"><small>Habilidad</small><span class="nolang"><b>${esc(s.ability || '—')}</b></span></div>
        <div class="mtik"><small>Naturaleza</small><span><b>${esc(P.natLabel(s.nature))}</b></span></div>
        <div class="mtik"><small>Caja</small><span><input id="pdBox" class="pcboxin" value="${esc(x.box || '')}" list="dlBoxes" placeholder="Sin caja"></span></div>
      </div>
      ${P.statBlock(shown, foe && !known)}
      <div class="mtmoves">${s.moves.map(m => P.moveTile(m)).join('')}</div>
      <h4 class="pch4">Notas</h4>
      <textarea id="pdNotes" class="pcnotesin" rows="6" placeholder="${foe ? 'Qué hizo en la partida, qué aguanta, cómo ganarle…' : 'Contra qué va bien, de dónde lo sacaste…'}">${esc(x.notes || '')}</textarea>
      <h4 class="pch4">Cálculos <span class="note">${(x.calcs || []).length || ''}</span></h4>
      <div class="pccalcs">${(x.calcs || []).length ? x.calcs.slice().reverse().map((c, i) => `<div class="pccalc"><span class="nolang">${esc(c.t)}</span><button class="dbtn" data-pcdel="${x.calcs.length - 1 - i}" title="Quitar">×</button></div>`).join('') : '<p class="note">Sin cálculos. En la Calculadora, «Guardar en Mi PC» guarda el cálculo aquí; o escríbelo abajo.</p>'}</div>
      <div class="row-btns"><input id="pdCalc" placeholder="Ej.: 32+ Atk Kingambit Kowtow Cleave vs. 0 HP / 0 Def: 45-54%" style="flex:1"><button class="btn sm" data-pcadd="1">Añadir</button></div>
      <p class="note" id="pdMsg">${esc(V.msg)}</p>
      ${foe ? '' : `<h4 class="pch4">Añadir a un equipo</h4>
      <div class="pcteamsel" id="pcTeamSel"></div>
      <div class="row-btns"><input id="pdNewTeam" placeholder="Nombre (opcional)" style="flex:1"><button class="btn sm primary" data-pdnew="${x.id}">+ Equipo nuevo con él</button></div>`}
      <div class="row-btns"><button class="btn sm" data-pedit="${x.id}">Cambiar el set…</button><button class="btn sm" data-pcalc="${x.id}">Calculadora</button><button class="btn sm" data-pcopy="${x.id}">Copiar</button><button class="btn sm" data-pdup="${x.id}">Duplicar</button><button class="btn sm danger" data-pdel="${x.id}">Borrar</button></div>`;
  }
  /** Tus equipos para meter el set: hasta 6 y nunca dos veces el mismo Pokémon. */
  async function paintTeamSel() {
    const el = $('#pcTeamSel');
    if (!el) return;
    const list = await P.pcList(), x = list.find(y => y.id === V.sel), s = x && parse(x);
    const base = s ? P.toID(P.baseSpecies(s.species)) : '';
    const teams = (await P.teams()).filter(t => t.side === 'me');
    el.innerHTML = teams.length ? teams.map(t => {
      const S = P.parseTeam(t.text).sets, has = S.some(m => P.toID(P.baseSpecies(m.species)) === base);
      const why = has ? 'Ya está' : S.length >= 6 ? 'Lleno' : '';
      return `<button class="tbitem" data-pdto="${t.id}"${why ? ` disabled title="${has ? 'Ese Pokémon ya está en este equipo' : 'Ya tiene 6'}"` : ''}><b>${esc(t.name)} <span class="note">${S.length}/6${why ? ` · ${why}` : ''}</span></b><span>${S.map(m => spr(m.species, 'xs')).join('')}</span></button>`;
    }).join('') : '<p class="note">Aún no tienes equipos: crea uno abajo.</p>';
  }

  function teamsView(teams) {
    return `<div class="row-btns" style="margin-bottom:12px"><button class="btn primary" id="pcTeamAdd">Añadir un equipo al Team Box</button><button class="btn" id="pcTeamExport">Exportar el Team Box</button></div>
      ${teams.length ? `<div class="pcteams">${teams.map(t => { const S = P.parseTeam(t.text).sets; return `<div class="pcteam">
        <div class="pchead"><div><b>${esc(t.name)}</b>${SET.teamId === t.id ? ' <span class="pill win">mi equipo</span>' : ''}<span class="note">${t.side === 'me' ? 'Tuyo' : 'De un rival'} · ${new Date(t.up).toLocaleDateString((typeof I18N !== 'undefined' && I18N.lang === 'en' ? 'en-GB' : 'es-ES'))}</span></div></div>
        <div class="pcmons">${S.map(m => spr(m.species, 'sm')).join('')}</div>
        ${t.notes ? `<p class="pcnotes">${esc(t.notes)}</p>` : ''}
        <div class="pcbtns">${t.side === 'me' ? `<button class="btn sm" data-tbopen="${t.id}">Abrir en el Teambuilder</button>${SET.teamId === t.id ? '' : `<button class="btn sm" data-tbmine="${t.id}">Usar como mi equipo</button>`}` : `<button class="btn sm" data-tbrival="${t.id}" title="La Calculadora usará sus sets">Rival en la calculadora</button>`}
          <button class="btn sm" data-tbside="${t.id}">${t.side === 'me' ? 'Pasar a rival' : 'Pasar a mío'}</button><button class="btn sm" data-tbcopy="${t.id}">Copiar</button><button class="btn sm danger" data-tbdel="${t.id}">Borrar</button></div>
      </div>`; }).join('')}</div>` : '<div class="card"><p class="note">Todavía no hay equipos.</p></div>'}`;
  }

  /* ---------- añadir sets ---------- */
  function addModal() {
    const box = $('#modalBox');
    box.onclick = box.onchange = null;
    box.innerHTML = `<button class="btn x" id="mClose">Cerrar</button><h2>Añadir sets a Mi PC</h2>
      <div class="ed"><label class="field">Nombre (si lo dejas vacío, se ve el del Pokémon)<input id="paName" placeholder="Ej.: Incineroar de lluvia"></label>
        <label class="field">De quién<select id="paSide"><option value="me">Tuyo</option><option value="foe">De un rival</option></select></label>
        <label class="field">Caja<input id="paBox" placeholder="Ej.: Lluvia para el Regional"></label>
        <label class="field">Enlace de pokepast.es<input id="paUrl" placeholder="https://pokepast.es/…"></label></div>
      <label class="field" style="margin-top:10px">Notas<input id="paNotes" placeholder="Para qué formato es, contra qué va bien, de dónde lo sacaste…"></label>
      <textarea id="paTxt" rows="9" style="margin-top:10px" placeholder="O pega el texto de Showdown (un Pokémon o un equipo entero: cada uno se guarda aparte)"></textarea>
      <div class="row-btns"><button class="btn" id="paFetch">Traer Pokepaste</button><span class="note" id="paMsg"></span><span style="flex:1"></span><button class="btn primary" id="paOk">Guardar</button></div>`;
    $('#mClose').onclick = closeModal;
    $('#paFetch').onclick = async () => {
      $('#paMsg').textContent = 'Trayendo…';
      const r = await api.fetchPaste($('#paUrl').value);
      if (!r.ok) { $('#paMsg').textContent = r.why; return; }
      $('#paTxt').value = r.text; if (!$('#paBox').value) $('#paBox').value = r.title || '';
      $('#paMsg').textContent = 'Listo. Revisa y guarda.';
    };
    $('#paOk').onclick = async () => {
      const r = P.parseTeam($('#paTxt').value);
      if (!r.sets.length) { $('#paMsg').textContent = `Ese texto no es un set de un Pokémon de Champions.${r.bad.length ? ` Desconocidos: ${r.bad.join(', ')}` : ''}`; return; }
      let n = 0;
      for (const s of r.sets) {
        const res = await P.pcAdd(P.cleanSet(s), { name: r.sets.length === 1 ? $('#paName').value.trim() : ($('#paName').value.trim() ? `${s.species} · ${$('#paName').value.trim()}` : ''), notes: $('#paNotes').value.trim(), side: $('#paSide').value, box: $('#paBox').value.trim() });
        if (res.ok) n++;
      }
      $('#paMsg').textContent = n ? `${n} set${n > 1 ? 's' : ''} guardado${n > 1 ? 's' : ''}.` : 'Esos sets ya están en tu PC.';
      if (n) { closeModal(); render(); }
    };
    $('#modal').classList.remove('hide');
    $('#paTxt').focus();
  }
  /** Editar nombre, notas, caja y el set. */
  async function editItem(x) {
    const s = parse(x);
    const box = $('#modalBox');
    box.onclick = box.onchange = null;
    box.innerHTML = `<button class="btn x" id="mClose">Cerrar</button><h2>Nombre y notas</h2>
      <div class="ed"><label class="field">Nombre<input id="peName" value="${esc(x.name)}"></label><label class="field">Caja<input id="peBox" value="${esc(x.box || '')}"></label>
        <label class="field">De quién<select id="peSide"><option value="me"${x.side === 'me' ? ' selected' : ''}>Tuyo</option><option value="foe"${x.side === 'foe' ? ' selected' : ''}>De un rival</option></select></label></div>
      <label class="field" style="margin-top:10px">Notas<textarea id="peNotes" rows="4" placeholder="Contra qué va bien, qué cálculos aguanta, de dónde lo sacaste…">${esc(x.notes || '')}</textarea></label>
      <div class="row-btns"><button class="btn" id="peSet">Cambiar el set…</button><span style="flex:1"></span><button class="btn primary" id="peOk">Guardar</button></div>`;
    $('#mClose').onclick = closeModal;
    const saveMeta = async () => {
      const list = (await P.pcList()).slice();
      const i = list.findIndex(y => y.id === x.id);
      Object.assign(list[i], { name: $('#peName').value.trim(), box: $('#peBox').value.trim(), side: $('#peSide').value, notes: $('#peNotes').value.trim(), up: Date.now() });
      await DB.set('pc', list);
      return list[i];
    };
    $('#peOk').onclick = async () => { await saveMeta(); closeModal(); render(); };
    $('#peSet').onclick = async () => {
      const item = await saveMeta();
      P.openEditor({ set: s, side: item.side, title: `Set de ${item.name || s.species}`, onSave: async m => {
        const list = (await P.pcList()).slice();
        const i = list.findIndex(y => y.id === x.id);
        list[i] = { ...list[i], text: P.exportSet(P.cleanSet(m)), up: Date.now() };
        await DB.set('pc', list); render();
      } });
    };
    $('#modal').classList.remove('hide');
  }
  async function toTeam(x) {
    const teams = (await P.teams()).filter(t => t.side === 'me');
    const box = $('#modalBox');
    box.onclick = box.onchange = null;
    box.innerHTML = `<button class="btn x" id="mClose">Cerrar</button><h2>Añadir al equipo</h2>
      ${teams.length ? `<div class="tlist">${teams.map(t => { const S = P.parseTeam(t.text).sets; return `<button class="tbitem" data-to="${t.id}"${S.length >= 6 ? ' disabled title="Ya tiene 6"' : ''}><b>${esc(t.name)}</b><span>${S.map(m => spr(m.species, 'xs')).join('')}</span></button>`; }).join('')}</div>` : '<p class="note">No tienes equipos: crea uno en el Teambuilder.</p>'}`;
    $('#mClose').onclick = closeModal;
    box.onclick = async e => {
      const b = e.target.closest('[data-to]');
      if (!b) return;
      const t = teams.find(y => y.id === b.dataset.to);
      const S = P.parseTeam(t.text).sets;
      S.push(parse(x));
      t.text = P.exportTeam(S.slice(0, 6));
      await P.saveTeam(t);
      closeModal(); Calc.reloadTeams();
      Team && show('equipo');
    };
    $('#modal').classList.remove('hide');
  }

  /* ---------- eventos ---------- */
  const el = $('#v-pc');
  el.addEventListener('click', async e => {
    // × encima del Pokémon: se borra al momento (Ctrl+Z o «Deshacer» lo devuelve).
    const xb = e.target.closest('[data-pcx]');
    if (xb) { e.stopPropagation(); const L = await P.pcList(), x = L.find(y => y.id === xb.dataset.pcx); if (!x) return; await Undo.snap('pc', `${x.name || parse(x).species} borrado de Mi PC`); await DB.set('pc', L.filter(y => y.id !== x.id)); if (V.sel === x.id) V.sel = null; render(); return; }
    const t = e.target.closest('button');
    if (!t) return;
    const list = await P.pcList();
    const find = id => list.find(x => x.id === id);
    const d = t.dataset;
    if (d.ptab) { V.tab = d.ptab; render(); }
    else if (d.psel) { V.sel = V.sel === d.psel ? null : d.psel; V.msg = ''; V.rename = false; render(); }
    else if (d.pcside != null) { V.side = d.pcside; V.page = 0; render(); }
    else if (d.pcadd || d.pcdel != null) {
      const L = list.slice(), i = L.findIndex(x => x.id === V.sel);
      if (i < 0) return;
      const calcs = (L[i].calcs || []).slice();
      if (d.pcadd) { const v = $('#pdCalc').value.trim(); if (!v) return; calcs.push({ t: v.slice(0, 400), at: Date.now() }); } else calcs.splice(+d.pcdel, 1);
      L[i] = { ...L[i], calcs }; await DB.set('pc', L); render();
    }
    else if (d.pcbox != null) { const boxes = ['', ...[...new Set(list.map(x => x.box).filter(Boolean))].sort()]; V.box = boxes[+d.pcbox] ?? ''; V.page = 0; render(); }
    else if (d.pdto || d.pdnew) {
      const x = find(d.pdnew || V.sel), set = x && parse(x);
      if (!set) return;
      let team;
      await Undo.snap('equipos', d.pdnew ? 'Equipo nuevo creado' : 'Pokémon añadido al equipo');
      if (d.pdnew) { const name = $('#pdNewTeam').value.trim() || `${set.species} · equipo ${(await P.teams()).filter(t => t.side === 'me').length + 1}`; team = await P.saveTeam({ name, side: 'me', text: P.exportTeam([set]) }); }
      else {
        team = await P.teamById(d.pdto); const S = P.parseTeam(team.text).sets;
        if (S.length >= 6 || S.some(m => P.toID(P.baseSpecies(m.species)) === P.toID(P.baseSpecies(set.species)))) return;
        S.push(set); team.text = P.exportTeam(S); await P.saveTeam(team);
      }
      Calc.reloadTeams();
      V.msg = `Añadido a ${team.name} (${P.parseTeam(team.text).sets.length}/6).`;
      V.lastTeam = team.id;
      await render();
      const m = $('#pdMsg'); if (m) m.insertAdjacentHTML('beforeend', ` <button class="btn sm" data-tbopen="${team.id}">Abrir en el Teambuilder</button>`);
    }
    else if (t.id === 'pcAdd') addModal();
    else if (t.id === 'pcPrev') { V.page--; render(); }
    else if (t.id === 'pcNext') { V.page++; render(); }
    else if (d.pedit) editItem(find(d.pedit));
    else if (d.pcalc) {
      const x = find(d.pcalc), set = parse(x);
      // Del rival no se sabe el reparto: el más común con su naturaleza.
      if (x.side === 'foe' && !set.sp.some(Boolean)) { await P.dex(); set.sp = P.spreadGuess(set.species, set.nature, await P.usage('')) || set.sp; }
      Calc.load(x.side === 'foe' ? 'foe' : 'me', { ...set, src: 'pc' }); show('calc');
    }
    else if (d.pteam) toTeam(find(d.pteam));
    else if (d.pdup) { const x = find(d.pdup); await Undo.snap('pc', 'Set duplicado'); const copy = { ...x, id: newId('s'), name: `${x.name || parse(x).species} (copia)`, up: Date.now() }; await DB.set('pc', [copy, ...list]); render(); }
    else if (d.pcopy) { navigator.clipboard.writeText(find(d.pcopy).text); t.textContent = 'Copiado'; }
    else if (d.pdel) { const x = find(d.pdel); await Undo.snap('pc', `${x.name || parse(x).species} borrado de Mi PC`); await DB.set('pc', list.filter(y => y.id !== d.pdel)); V.sel = null; render(); }
    else if (t.id === 'pcTeamAdd') { show('equipo'); setTimeout(() => $('#tbImp') && $('#tbImp').click(), 50); }
    else if (t.id === 'pcTeamExport') {
      const teams = await P.teams();
      const txt = teams.map(x => `=== [gen9championsvgc2026regmc] ${x.side === 'me' ? '' : 'Rival/'}${x.name} ===\n\n${x.text}`).join('\n\n\n');
      navigator.clipboard.writeText(txt); t.textContent = 'Copiado al portapapeles';
    } else if (d.tbopen) { show('equipo'); Team && (await Team.current()); setTimeout(() => $(`[data-tsel="${d.tbopen}"]`) && $(`[data-tsel="${d.tbopen}"]`).click(), 50); }
    else if (d.tbmine) { Object.assign(SET, await api.setSettings({ teamId: d.tbmine })); Calc.setTeams(d.tbmine); render(); }
    else if (d.tbrival) { Calc.setTeams(undefined, d.tbrival); show('calc'); }
    else if (d.tbside) { await Undo.snap('equipos', 'Equipo cambiado de lado'); const tm = await P.teamById(d.tbside); tm.side = tm.side === 'me' ? 'foe' : 'me'; await P.saveTeam(tm); Calc.reloadTeams(); render(); }
    else if (d.tbcopy) { navigator.clipboard.writeText((await P.teamById(d.tbcopy)).text); t.textContent = 'Copiado'; }
    else if (d.tbdel) { const tm = await P.teamById(d.tbdel); await Undo.snap('equipos', `Equipo «${tm ? tm.name : ''}» borrado`); await P.removeTeam(d.tbdel); Calc.reloadTeams(); render(); }
  });
  el.addEventListener('input', e => { if (e.target.id === 'tQ') { V.tq = e.target.value; V.tpage = 0; clearTimeout(V.t); V.t = setTimeout(async () => { const pos = e.target.selectionStart; await render(); const q = $('#tQ'); q.focus(); q.setSelectionRange(pos, pos); }, 250); return; } if (e.target.id === 'pcQ') { V.q = e.target.value; V.page = 0; clearTimeout(V.t); V.t = setTimeout(async () => { const pos = e.target.selectionStart; await render(); const q = $('#pcQ'); q.focus(); q.setSelectionRange(pos, pos); }, 200); } });
  /* Nombre: doble clic para cambiarlo (Enter guarda, Esc lo deja). Notas y caja se guardan solas. */
  async function patchSel(patch) {
    const L = (await P.pcList()).slice(), i = L.findIndex(x => x.id === V.sel);
    if (i < 0) return;
    L[i] = { ...L[i], ...patch, up: Date.now() };
    await DB.set('pc', L);
  }
  el.addEventListener('dblclick', e => { if (e.target.closest('[data-pren]')) { V.rename = true; render().then(() => { const i = $('#pdName'); if (i) { i.focus(); i.select(); } }); } });
  el.addEventListener('keydown', async e => {
    if (e.target.id !== 'pdName') return;
    if (e.key === 'Enter') { e.preventDefault(); V.rename = false; await Undo.snap('pc', 'Nombre cambiado'); await patchSel({ name: e.target.value.trim().slice(0, 80) }); render(); }
    else if (e.key === 'Escape') { e.stopPropagation(); V.rename = false; render(); }
  });
  el.addEventListener('focusout', async e => { if (e.target.id === 'pdName' && V.rename) { V.rename = false; await Undo.snap('pc', 'Nombre cambiado'); await patchSel({ name: e.target.value.trim().slice(0, 80) }); render(); } });
  el.addEventListener('input', e => {
    if (e.target.id !== 'pdNotes') return;
    clearTimeout(V.nt);
    const v = e.target.value;
    V.nt = setTimeout(async () => { await patchSel({ notes: v.slice(0, 3000) }); const m = $('#pdMsg'); if (m) m.textContent = 'Notas guardadas.'; }, 600);
  });
  el.addEventListener('change', e => {
    if (e.target.id === 'pdBox') { const v = e.target.value.trim().slice(0, 40); Undo.snap('pc', 'Caja cambiada').then(() => patchSel({ box: v })).then(render); return; }
    if (e.target.id === 'tMine') { V.tmine = e.target.checked; V.tpage = 0; render(); return; }
    const k = { pcSide: 'side', pcBox: 'box', pcSort: 'sort' }[e.target.id];
    if (k) { V[k] = e.target.value; V.page = 0; render(); }
  });

  VIEWS.pc = render;
  return { render };
})();
