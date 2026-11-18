'use strict';
/* Macar Showdown · Mi PC: tus sets guardados (por cajas) y el Team Box (todos los equipos, tuyos y de rivales). */
/* global P, DB, api, $, $$, esc, spr, closeModal, VIEWS, show, Calc, SET, newId */

const PC = (() => {
  const V = { tab: 'sets', q: '', side: '', box: '', sort: 'new', page: 0 };
  const PAGE = 30;
  const parse = x => { const s = P.parseSet(x.text); return s && !s.bad ? s : null; };

  async function render() {
    const el = $('#v-pc');
    const [list, teams] = await Promise.all([P.pcList(), P.teams()]);
    const boxes = [...new Set(list.map(x => x.box).filter(Boolean))].sort();
    el.innerHTML = `<div class="head"><div><h1>Mi <span>PC</span></h1><p class="note" style="margin-top:4px">Tus sets y repartos guardados, y todos tus equipos. Se guardan en tu carpeta de datos.</p></div>
      <div class="seg">${[['sets', `Sets (${list.length})`], ['teams', `Team Box (${teams.length})`]].map(([k, l]) => `<button data-ptab="${k}" aria-pressed="${V.tab === k}">${l}</button>`).join('')}</div></div>
      ${V.tab === 'sets' ? setsView(list, boxes) : teamsView(teams)}`;
  }

  function setsView(list, boxes) {
    const q = V.q.toLowerCase();
    let L = list.map(x => ({ x, s: parse(x) })).filter(o => o.s);
    if (q) L = L.filter(o => `${o.x.name} ${o.s.species} ${o.x.notes} ${o.s.item} ${o.s.moves.join(' ')}`.toLowerCase().includes(q));
    if (V.side) L = L.filter(o => o.x.side === V.side);
    if (V.box) L = L.filter(o => o.x.box === V.box);
    const cmp = { new: (a, b) => b.x.up - a.x.up, old: (a, b) => a.x.up - b.x.up, az: (a, b) => (a.x.name || a.s.species).localeCompare(b.x.name || b.s.species), za: (a, b) => (b.x.name || b.s.species).localeCompare(a.x.name || a.s.species) }[V.sort];
    L.sort(cmp);
    const pages = Math.max(1, Math.ceil(L.length / PAGE));
    V.page = Math.min(V.page, pages - 1);
    const shown = L.slice(V.page * PAGE, (V.page + 1) * PAGE);
    return `<div class="pctools card">
        <input type="search" id="pcQ" placeholder="Buscar: nombre, Pokémon, objeto, movimiento, notas…" value="${esc(V.q)}">
        <select id="pcSide"><option value="">Tuyos y de rivales</option><option value="me"${V.side === 'me' ? ' selected' : ''}>Tuyos</option><option value="foe"${V.side === 'foe' ? ' selected' : ''}>De rivales</option></select>
        <select id="pcBox"><option value="">Todas las cajas</option>${boxes.map(b => `<option${b === V.box ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>
        <select id="pcSort">${[['new', 'Más nuevos'], ['old', 'Más antiguos'], ['az', 'A → Z'], ['za', 'Z → A']].map(([k, l]) => `<option value="${k}"${V.sort === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <button class="btn primary" id="pcAdd">Añadir sets</button></div>
      ${!list.length ? '<div class="card"><p class="note">Tu PC está vacío. Añade sets con «Añadir sets», o guárdalos desde el Teambuilder y la Calculadora (botón «Guardar en Mi PC» del editor).</p></div>' : !L.length ? '<div class="card"><p class="note">Ningún set coincide con estos filtros.</p></div>' : `
      <div class="pcbox">${shown.map(({ x, s }) => `<div class="pcset ${x.side}">
        <div class="pchead">${spr(s.species)}<div><b>${esc(x.name || s.species)}</b><span class="note">${esc(s.species)}${x.box ? ` · caja ${esc(x.box)}` : ''}</span></div><span class="pill ${x.side === 'me' ? 'win' : 'loss'}">${x.side === 'me' ? 'Tuyo' : 'Rival'}</span></div>
        <div class="mline"><span>${esc(s.item || 'Sin objeto')}</span><span>${esc(s.ability || '')}</span></div>
        <div class="mline small"><span>${esc(P.natLabel(s.nature))}</span><span>${esc(P.spLine(s))}</span></div>
        <div class="pcmoves">${s.moves.filter(Boolean).map(m => `<span>${P.typeDot((P.moveOf(m) || {}).type)}${esc(m)}</span>`).join('')}</div>
        ${x.notes ? `<p class="pcnotes">${esc(x.notes)}</p>` : ''}
        <div class="pcbtns"><button class="btn sm" data-pedit="${x.id}">Editar</button><button class="btn sm" data-pcalc="${x.id}" title="Abrirlo en la Calculadora">Calculadora</button><button class="btn sm" data-pteam="${x.id}" title="Ponerlo en un equipo">A un equipo</button><button class="btn sm" data-pdup="${x.id}" title="Hace una copia para probar variantes">Duplicar</button><button class="btn sm" data-pcopy="${x.id}">Copiar</button><button class="btn sm danger" data-pdel="${x.id}">Borrar</button></div>
      </div>`).join('')}</div>
      ${pages > 1 ? `<div class="row-btns pcpages"><button class="btn sm" id="pcPrev"${V.page ? '' : ' disabled'}>◀ Caja anterior</button><span class="note">Caja ${V.page + 1} de ${pages}</span><button class="btn sm" id="pcNext"${V.page < pages - 1 ? '' : ' disabled'}>Caja siguiente ▶</button></div>` : ''}`}`;
  }

  function teamsView(teams) {
    return `<div class="row-btns" style="margin-bottom:12px"><button class="btn primary" id="pcTeamAdd">Añadir un equipo al Team Box</button><button class="btn" id="pcTeamExport">Exportar el Team Box</button></div>
      ${teams.length ? `<div class="pcteams">${teams.map(t => { const S = P.parseTeam(t.text).sets; return `<div class="pcteam">
        <div class="pchead"><div><b>${esc(t.name)}</b>${SET.teamId === t.id ? ' <span class="pill win">mi equipo</span>' : ''}<span class="note">${t.side === 'me' ? 'Tuyo' : 'De un rival'} · ${new Date(t.up).toLocaleDateString('es-ES')}</span></div></div>
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
    const t = e.target.closest('button');
    if (!t) return;
    const list = await P.pcList();
    const find = id => list.find(x => x.id === id);
    const d = t.dataset;
    if (d.ptab) { V.tab = d.ptab; render(); }
    else if (t.id === 'pcAdd') addModal();
    else if (t.id === 'pcPrev') { V.page--; render(); }
    else if (t.id === 'pcNext') { V.page++; render(); }
    else if (d.pedit) editItem(find(d.pedit));
    else if (d.pcalc) { const x = find(d.pcalc); Calc.load(x.side, { ...parse(x), src: 'pc' }); show('calc'); }
    else if (d.pteam) toTeam(find(d.pteam));
    else if (d.pdup) { const x = find(d.pdup); const copy = { ...x, id: newId('s'), name: `${x.name || parse(x).species} (copia)`, up: Date.now() }; await DB.set('pc', [copy, ...list]); render(); }
    else if (d.pcopy) { navigator.clipboard.writeText(find(d.pcopy).text); t.textContent = 'Copiado'; }
    else if (d.pdel) { if (!confirm('¿Borrar este set de Mi PC?')) return; await DB.set('pc', list.filter(x => x.id !== d.pdel)); render(); }
    else if (t.id === 'pcTeamAdd') { show('equipo'); setTimeout(() => $('#tbImp') && $('#tbImp').click(), 50); }
    else if (t.id === 'pcTeamExport') {
      const teams = await P.teams();
      const txt = teams.map(x => `=== [gen9championsvgc2026regmc] ${x.side === 'me' ? '' : 'Rival/'}${x.name} ===\n\n${x.text}`).join('\n\n\n');
      navigator.clipboard.writeText(txt); t.textContent = 'Copiado al portapapeles';
    } else if (d.tbopen) { show('equipo'); Team && (await Team.current()); setTimeout(() => $(`[data-tsel="${d.tbopen}"]`) && $(`[data-tsel="${d.tbopen}"]`).click(), 50); }
    else if (d.tbmine) { Object.assign(SET, await api.setSettings({ teamId: d.tbmine })); Calc.setTeams(d.tbmine); render(); }
    else if (d.tbrival) { Calc.setTeams(undefined, d.tbrival); show('calc'); }
    else if (d.tbside) { const tm = await P.teamById(d.tbside); tm.side = tm.side === 'me' ? 'foe' : 'me'; await P.saveTeam(tm); Calc.reloadTeams(); render(); }
    else if (d.tbcopy) { navigator.clipboard.writeText((await P.teamById(d.tbcopy)).text); t.textContent = 'Copiado'; }
    else if (d.tbdel) { if (!confirm('¿Borrar este equipo?')) return; await P.removeTeam(d.tbdel); Calc.reloadTeams(); render(); }
  });
  el.addEventListener('input', e => { if (e.target.id === 'pcQ') { V.q = e.target.value; V.page = 0; clearTimeout(V.t); V.t = setTimeout(async () => { const pos = e.target.selectionStart; await render(); const q = $('#pcQ'); q.focus(); q.setSelectionRange(pos, pos); }, 200); } });
  el.addEventListener('change', e => {
    const k = { pcSide: 'side', pcBox: 'box', pcSort: 'sort' }[e.target.id];
    if (k) { V[k] = e.target.value; V.page = 0; render(); }
  });

  VIEWS.pc = render;
  return { render };
})();
