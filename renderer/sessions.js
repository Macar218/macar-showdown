'use strict';
/*
 * Macar Showdown · sesiones.
 * Una sesión es una preparación (un Regional, una subida en el ladder…): nombre, objetivo y equipo.
 * Las partidas que juegas se apuntan en la sesión abierta; el Dashboard enseña por defecto las de esa sesión.
 */
/* global api, DB, P, $, $$, esc, spr, closeModal, SET, Calc, F, load, render, newId */

const Sess = (() => {
  const V = { q: '' };
  async function list() { return (await DB.get('sesiones')) || []; }
  async function save(all) { await DB.set('sesiones', all); }
  async function current() { return SET.sessionId ? (await list()).find(s => s.id === SET.sessionId) || null : null; }

  async function paintButton() {
    const s = await current();
    $('#sessName').textContent = s ? s.name : 'Sin sesión';
    $('#sessBtn').classList.toggle('none', !s);
    $('#sessBtn').title = s ? `Tu sesión: ${s.name}${s.goal ? ` · ${s.goal}` : ''}. Pulsa para cambiar a otra o crear una nueva.` : 'Partida no guardada en ninguna sesión: abre o crea una.';
  }

  /** Abrir una sesión: su equipo pasa a ser el tuyo y el Dashboard enseña solo sus partidas. */
  async function open(id) {
    const s = id ? (await list()).find(x => x.id === id) : null;
    const patch = { sessionId: s ? s.id : '' };
    if (s && s.teamId && (await P.teamById(s.teamId))) patch.teamId = s.teamId;
    Object.assign(SET, await api.setSettings(patch));
    if (patch.teamId) Calc.setTeams(patch.teamId);
    F.session = s ? s.id : 'all';
    await paintButton();
    load();
  }

  async function modal(mode = 'list', msg = '') {
    const box = $('#modalBox');
    box.onclick = box.onchange = box.oninput = null;
    const all = await list();
    const myTeams = (await P.teams()).filter(t => t.side === 'me');
    const count = id => M.filter(s => s.session === id).length;
    if (mode === 'new') {
      box.innerHTML = `<button class="btn x" id="mClose">Cerrar</button><h2>Nueva sesión</h2>
        <p class="note">Una sesión nueva: le pones nombre, un objetivo y, si quieres, el equipo. Equipo nuevo, sesión nueva: así no se mezclan las derrotas del anterior con las de este.</p>
        <div class="ed" style="margin-top:10px"><label class="field">Nombre<input id="snName" placeholder="Ej.: Regional de Madrid"></label>
          <label class="field">¿Qué quieres conseguir?<input id="snGoal" placeholder="Ej.: Top 8 en el Regional de Madrid · Aprender a jugar contra Trick Room"></label></div>
        <div class="field" style="margin-top:10px">Equipo
          <select id="snTeam"><option value="">Vacío: empiezas sin equipo y lo cargas luego en el Teambuilder</option>${myTeams.map(t => `<option value="${t.id}"${t.id === SET.teamId ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}<option value="paste">Paste de base (pegar o Pokepaste)…</option></select></div>
        <div id="snPaste" class="hide"><label class="field" style="margin-top:8px">Enlace de pokepast.es<input id="snUrl" placeholder="https://pokepast.es/…"></label>
          <textarea id="snTxt" rows="7" placeholder="…o pega el equipo exportado de Showdown" style="margin-top:6px"></textarea></div>
        <div class="row-btns"><span class="note" id="snMsg">${esc(msg)}</span><span style="flex:1"></span><button class="btn primary" id="snOk">Crear la sesión</button></div>`;
      box.onchange = e => { if (e.target.id === 'snTeam') $('#snPaste').classList.toggle('hide', e.target.value !== 'paste'); };
      box.onclick = async e => {
        if (e.target.id === 'mClose') { closeModal(); return; }
        if (e.target.id !== 'snOk') return;
        const name = $('#snName').value.trim();
        if (!name) { $('#snMsg').textContent = 'Ponle un nombre.'; return; }
        let teamId = $('#snTeam').value;
        if (teamId === 'paste') {
          let text = $('#snTxt').value;
          if (!text.trim() && $('#snUrl').value.trim()) { $('#snMsg').textContent = 'Trayendo el equipo…'; const r = await api.fetchPaste($('#snUrl').value); if (!r.ok) { $('#snMsg').textContent = r.why; return; } text = r.text; }
          const r = P.parseTeam(text);
          if (!r.sets.length) { $('#snMsg').textContent = 'No se ha encontrado ningún Pokémon en el paste.'; return; }
          teamId = (await P.saveTeam({ name, side: 'me', text: P.exportTeam(r.sets.slice(0, 6)) })).id;
        }
        const s = { id: newId('s'), name: name.slice(0, 80), goal: $('#snGoal').value.trim().slice(0, 200), teamId: teamId || '', created: Date.now(), up: Date.now() };
        await save([s, ...all]);
        closeModal();
        await open(s.id);
      };
      $('#modal').classList.remove('hide');
      $('#snName').focus();
      return;
    }
    const q = V.q.toLowerCase();
    const teamName = id => (myTeams.find(t => t.id === id) || {}).name || '';
    const shown = all.filter(s => !q || `${s.name} ${s.goal} ${teamName(s.teamId)}`.toLowerCase().includes(q));
    box.innerHTML = `<button class="btn x" id="mClose">Cerrar</button><h2>Tus sesiones</h2>
      <p class="note">Elige con qué sesión sigues: su equipo pasa a ser el tuyo y el Dashboard enseña solo sus partidas.</p>
      <div class="row-btns"><input type="search" id="ssQ" placeholder="Buscar: sesión, equipo o Pokémon" value="${esc(V.q)}" style="flex:1"><button class="btn primary" id="ssNew">Nueva sesión</button></div>
      <div class="sslist">${shown.length ? shown.map(s => `<div class="ssrow${s.id === SET.sessionId ? ' on' : ''}">
          <div><b>${esc(s.name)}${s.id === SET.sessionId ? ' <span class="pill win">abierta</span>' : ''}</b><span class="note">${s.goal ? esc(s.goal) : 'Sin objetivo'} · ${count(s.id)} partida${count(s.id) === 1 ? '' : 's'}${teamName(s.teamId) ? ` · ${esc(teamName(s.teamId))}` : ''}</span></div>
          ${s.id === SET.sessionId ? '' : `<button class="btn sm primary" data-sopen="${s.id}">Cargar</button>`}<button class="btn sm" data-sedit="${s.id}">Cambiar</button><button class="btn sm danger" data-sdel="${s.id}">Borrar sesión</button>
        </div>`).join('') : `<p class="note">${all.length ? 'Ninguna sesión coincide con la búsqueda.' : 'Aún no tienes sesiones.'}</p>`}</div>
      <div class="row-btns">${SET.sessionId ? '<button class="btn" id="ssNone" title="Las partidas no se apuntan en ninguna sesión">Jugar sin sesión</button>' : '<span class="note">Ahora juegas sin sesión: las partidas se guardan, pero sin sesión.</span>'}<span class="note">${esc(msg)}</span></div>`;
    box.oninput = e => { if (e.target.id === 'ssQ') { V.q = e.target.value; const pos = e.target.selectionStart; clearTimeout(V.t); V.t = setTimeout(async () => { await modal('list'); const i = $('#ssQ'); i.focus(); i.setSelectionRange(pos, pos); }, 200); } };
    box.onclick = async e => {
      const t = e.target.closest('button');
      if (!t) return;
      const d = t.dataset;
      if (t.id === 'mClose') closeModal();
      else if (t.id === 'ssNew') modal('new');
      else if (t.id === 'ssNone') { closeModal(); await open(''); }
      else if (d.sopen) { closeModal(); await open(d.sopen); }
      else if (d.sdel) {
        const s = all.find(x => x.id === d.sdel);
        if (!confirm(`¿Borrar la sesión «${s.name}»? Sus partidas no se borran: quedan sin sesión.`)) return;
        await api.clearSession(s.id);
        await save(all.filter(x => x.id !== s.id));
        if (SET.sessionId === s.id) await open('');
        modal('list', 'Sesión borrada.');
      } else if (d.sedit) {
        const s = all.find(x => x.id === d.sedit);
        const row = t.closest('.ssrow');
        row.innerHTML = `<div class="ed" style="flex:1"><label class="field">Nombre<input id="seName" value="${esc(s.name)}"></label><label class="field">Objetivo<input id="seGoal" value="${esc(s.goal || '')}"></label>
          <label class="field">Equipo<select id="seTeam"><option value="">Sin equipo</option>${myTeams.map(x => `<option value="${x.id}"${x.id === s.teamId ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label></div><button class="btn sm primary" data-ssave="${s.id}">Guardar</button>`;
      } else if (d.ssave) {
        const s = all.find(x => x.id === d.ssave);
        Object.assign(s, { name: $('#seName').value.trim() || s.name, goal: $('#seGoal').value.trim(), teamId: $('#seTeam').value, up: Date.now() });
        await save(all);
        if (s.id === SET.sessionId) await open(s.id);
        modal('list', 'Guardado.');
      }
    };
    $('#modal').classList.remove('hide');
  }

  $('#sessBtn').addEventListener('click', () => modal('list'));
  DB.onChange(k => { if (k === 'sesiones') paintButton(); });
  paintButton();
  return { list, current, open, modal, paintButton };
})();
