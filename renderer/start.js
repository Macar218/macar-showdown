'use strict';
/*
 * Macar Showdown · pantalla de inicio.
 * Al abrir la app: cargar una sesión de uno de tus equipos o empezar una nueva (con un equipo que ya tienes o con uno
 * nuevo pegando su Pokepaste). La sesión nueva lleva un nombre por defecto («Sesión 20 Noviembre 2026 (equipo)»),
 * que se puede cambiar, y un objetivo.
 */
/* global $, esc, spr, api, P, M, SET, Sess, Calc, show, newId, I18N */

const Start = (() => {
  const V = { mode: 'home', team: '', newTeam: false, name: '', nameEdited: false, goal: '', tName: '', url: '', paste: '', msg: '', edit: '', first: true };
  const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const en = () => typeof I18N !== 'undefined' && I18N.lang === 'en';
  function defName(team) {
    const d = new Date();
    return `${en() ? 'Session' : 'Sesión'} ${d.getDate()} ${(en() ? MON : MES)[d.getMonth()]} ${d.getFullYear()}${team ? ` (${team})` : ''}`;
  }
  const wrap = () => $('#start');
  const record = id => { const g = M.filter(s => s.session === id && s.me && s.result); const w = g.filter(s => s.result === 'win').length; return { n: g.length, w, l: g.length - w }; };
  const day = t => new Date(t).toLocaleDateString(en() ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  const mons = t => P.parseTeam(t.text).sets.map(m => spr(m.species, 'sm')).join('');

  async function data() {
    const [teams, sess] = await Promise.all([P.teams(), Sess.list()]);
    return { teams: (Array.isArray(teams) ? teams : []).filter(t => t && t.side === 'me'), sess: Array.isArray(sess) ? sess : [] };
  }

  function homeHTML(d) {
    const last = d.sess.slice().sort((a, b) => (b.used || b.up || 0) - (a.used || a.up || 0))[0];
    const lt = last && d.teams.find(t => t.id === last.teamId);
    const rc = last ? record(last.id) : null;
    return `<div class="stbrand"><span class="lens" aria-hidden="true"></span><h1>MACAR <span>SHOWDOWN</span></h1><p>¿Con qué juegas hoy?</p></div>
      ${last ? `<button class="stlast" data-st="open" data-id="${esc(last.id)}"><small>Seguir donde lo dejaste</small><b class="nolang">${esc(last.name)}</b><span>${lt ? `${mons(lt)}` : ''}<em>${rc.w}-${rc.l}</em></span></button>` : ''}
      <div class="stchoices">
        <button class="stbig" data-st="load"${d.sess.length ? '' : ' disabled'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><b>Cargar sesión</b><span>${d.sess.length ? 'Sigue con una sesión de uno de tus equipos.' : 'Aún no tienes sesiones.'}</span></button>
        <button class="stbig primary" data-st="new"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><b>Nueva sesión</b><span>Con un equipo que ya tienes o con uno nuevo (pega su Pokepaste).</span></button>
      </div>
      <button class="stlink" data-st="skip">${V.first ? 'Entrar sin sesión' : 'Cerrar'}</button>
      <button class="stlink sttour" data-tourstart="1">¿Primera vez? Ver el tutorial</button>`;
  }

  function loadHTML(d) {
    const byTeam = d.teams.map(t => ({ t, list: d.sess.filter(s => s.teamId === t.id) }));
    const orphan = d.sess.filter(s => !d.teams.some(t => t.id === s.teamId));
    const row = s => {
      const rc = record(s.id);
      if (V.edit === s.id) return `<div class="strow edit"><label class="field">Nombre<input id="seName" value="${esc(s.name)}" maxlength="80"></label><label class="field">Objetivo<input id="seGoal" value="${esc(s.goal || '')}" maxlength="200"></label><button class="btn sm primary" data-st="esave" data-id="${esc(s.id)}">Guardar</button><button class="btn sm" data-st="ecancel">Cancelar</button></div>`;
      return `<div class="strow${s.id === SET.sessionId ? ' on' : ''}"><div><b class="nolang">${esc(s.name)}</b><span class="note">${s.goal ? `<span class="nolang">${esc(s.goal)}</span> · ` : ''}${day(s.created || s.up)} · ${rc.n} partida${rc.n === 1 ? '' : 's'}${rc.n ? ` · ${rc.w}-${rc.l}` : ''}</span></div>
        <button class="btn sm primary" data-st="open" data-id="${esc(s.id)}">${s.id === SET.sessionId ? 'Seguir' : 'Cargar'}</button><button class="btn sm ibtn" data-st="edit" data-id="${esc(s.id)}" title="Cambiar nombre u objetivo">✎</button><button class="btn sm ibtn danger" data-st="del" data-id="${esc(s.id)}" title="Borrar la sesión (las partidas se quedan)">✕</button></div>`;
    };
    return `<div class="sttop"><button class="btn sm" data-st="home">◀ <span>Atrás</span></button><h2>Cargar sesión</h2></div>
      <div class="stteams">${byTeam.map(({ t, list }) => `<div class="stteam"><div class="stthead"><b class="nolang">${esc(t.name)}</b><span>${mons(t)}</span><button class="btn sm" data-st="newwith" data-team="${esc(t.id)}">+ <span>Nueva sesión</span></button></div>
        ${list.length ? list.map(row).join('') : '<p class="note">Sin sesiones con este equipo.</p>'}</div>`).join('')}
        ${orphan.length ? `<div class="stteam"><div class="stthead"><b>Sin equipo</b></div>${orphan.map(row).join('')}</div>` : ''}</div>
      <p class="note stmsg">${esc(V.msg)}</p>`;
  }

  function newHTML(d) {
    const pick = (id, inner, on) => `<button class="stpick${on ? ' on' : ''}" data-st="pick" data-team="${esc(id)}">${inner}</button>`;
    const tn = V.newTeam ? V.tName.trim() : (d.teams.find(t => t.id === V.team) || {}).name || '';
    if (!V.nameEdited) V.name = defName(tn);
    return `<div class="sttop"><button class="btn sm" data-st="home">◀ <span>Atrás</span></button><h2>Nueva sesión</h2></div>
      <h3 class="ststep"><i>1</i>Tu equipo</h3>
      <div class="stpicks">${d.teams.map(t => pick(t.id, `<b class="nolang">${esc(t.name)}</b><span>${mons(t)}</span>`, !V.newTeam && V.team === t.id)).join('')}
        ${pick('new', '<b>+ <span>Equipo nuevo</span></b><span class="note">Pega su Pokepaste</span>', V.newTeam)}</div>
      ${V.newTeam ? `<div class="stpaste">
        <div class="stline"><label class="field">Nombre del equipo<input id="stTName" value="${esc(V.tName)}" placeholder="Ej.: Chari-Chomp" maxlength="100"></label>
          <label class="field" style="flex:2">Enlace de pokepast.es<input id="stUrl" value="${esc(V.url)}" placeholder="https://pokepast.es/…"></label><button class="btn" data-st="fetch">Traer</button></div>
        <textarea id="stPaste" rows="8" placeholder="…o pega aquí el equipo exportado de Showdown (hasta 6 Pokémon). Los puntos (EVs) los puedes cambiar luego.">${esc(V.paste)}</textarea>
        <div class="stprev" id="stPrev">${previewHTML()}</div></div>` : ''}
      <h3 class="ststep"><i>2</i>La sesión</h3>
      <div class="stline"><label class="field" style="flex:2">Nombre<input id="stName" value="${esc(V.name)}" maxlength="80"></label>
        <label class="field" style="flex:3">Objetivo<input id="stGoal" value="${esc(V.goal)}" placeholder="Ej.: Llegar a 1500 · Aprender a jugar contra Trick Room" maxlength="200"></label></div>
      <div class="row-btns"><span class="note stmsg">${esc(V.msg)}</span><span style="flex:1"></span><button class="btn primary stgo" data-st="create">Empezar la sesión</button></div>`;
  }
  function previewHTML() {
    if (!V.paste.trim()) return '';
    const r = P.parseTeam(V.paste);
    return r.sets.length ? `${r.sets.slice(0, 6).map(m => spr(m.species, 'sm')).join('')}<span class="note">${Math.min(6, r.sets.length)} Pokémon${r.bad.length ? ` · No reconocidos: ${esc(r.bad.join(', '))}` : ''}</span>` : '<span class="note">No se ha encontrado ningún Pokémon en el texto.</span>';
  }

  async function paint() {
    try { await paint0(); } catch (e) {
      // Si algo falla aquí, que se pueda entrar igualmente.
      console.error('[inicio]', e);
      wrap().innerHTML = `<div class="stbox home"><div class="stbrand"><span class="lens" aria-hidden="true"></span><h1>MACAR <span>SHOWDOWN</span></h1></div><p class="note">No se ha podido cargar la pantalla de inicio.</p><button class="btn primary" data-st="skip">Entrar</button></div>`;
    }
  }
  async function paint0() {
    const d = await data();
    if (V.mode === 'load' && !d.sess.length) V.mode = 'home';
    if (V.mode === 'new' && !V.newTeam && !d.teams.some(t => t.id === V.team)) { V.team = d.teams[0] ? d.teams[0].id : ''; V.newTeam = !d.teams.length; }
    const body = V.mode === 'load' ? loadHTML(d) : V.mode === 'new' ? newHTML(d) : homeHTML(d);
    wrap().innerHTML = `<div class="stbox ${V.mode}">${body}</div>`;
  }

  async function create() {
    const name = V.name.trim();
    if (!name) { V.msg = 'Ponle un nombre a la sesión.'; return paint(); }
    let teamId = V.team;
    if (V.newTeam) {
      let text = V.paste;
      if (!text.trim() && V.url.trim()) { const r = await api.fetchPaste(V.url); if (!r.ok) { V.msg = r.why; return paint(); } text = r.text; if (!V.tName) V.tName = r.title || ''; }
      const r = P.parseTeam(text);
      if (!r.sets.length) { V.msg = 'Pega el equipo (o el enlace de pokepast.es) para crear el equipo.'; return paint(); }
      const sets = r.sets.slice(0, 6);
      teamId = (await P.saveTeam({ name: V.tName.trim() || sets.slice(0, 2).map(m => m.species).join(' / '), side: 'me', text: P.exportTeam(sets) })).id;
      if (typeof Calc !== 'undefined') Calc.reloadTeams();
    }
    const s = { id: newId('s'), name: name.slice(0, 80), goal: V.goal.trim().slice(0, 200), teamId: teamId || '', created: Date.now(), up: Date.now(), used: Date.now() };
    await Sess.save([s, ...(await Sess.list())]);
    await Sess.open(s.id);
    hide();
    show('jugar');
  }

  async function onClick(e) {
    const b = e.target.closest('[data-st]');
    if (!b) return;
    const k = b.dataset.st, id = b.dataset.id;
    V.msg = '';
    if (k === 'home' || k === 'load') { V.mode = k; V.edit = ''; paint(); }
    else if (k === 'new') { Object.assign(V, { mode: 'new', team: SET.teamId || '', newTeam: false, nameEdited: false, goal: '', tName: '', url: '', paste: '' }); paint(); }
    else if (k === 'newwith') { Object.assign(V, { mode: 'new', team: b.dataset.team, newTeam: false, nameEdited: false, goal: '' }); paint(); }
    else if (k === 'pick') { V.newTeam = b.dataset.team === 'new'; if (!V.newTeam) V.team = b.dataset.team; paint(); }
    else if (k === 'skip') { if (V.first && SET.sessionId) await Sess.open(''); hide(); }
    else if (k === 'open') { await Sess.open(id); hide(); show('jugar'); }
    else if (k === 'edit') { V.edit = id; paint(); }
    else if (k === 'ecancel') { V.edit = ''; paint(); }
    else if (k === 'esave') {
      const all = await Sess.list(), s = all.find(x => x.id === id);
      if (s) { s.name = ($('#seName').value.trim() || s.name).slice(0, 80); s.goal = $('#seGoal').value.trim().slice(0, 200); s.up = Date.now(); await Sess.save(all); }
      V.edit = ''; V.msg = 'Guardado.'; paint(); Sess.paintButton();
    } else if (k === 'del') {
      const all = await Sess.list(), s = all.find(x => x.id === id);
      if (!s || !confirm(`¿Borrar la sesión «${s.name}»? Sus partidas no se borran: quedan sin sesión.`)) return;
      await api.clearSession(s.id);
      await Sess.save(all.filter(x => x.id !== s.id));
      if (SET.sessionId === s.id) await Sess.open('');
      V.msg = 'Sesión borrada.'; paint();
    } else if (k === 'fetch') {
      V.msg = 'Trayendo el equipo…'; paint();
      const r = await api.fetchPaste(V.url);
      if (!r.ok) V.msg = r.why; else { V.paste = r.text; if (!V.tName) V.tName = r.title || ''; V.msg = ''; }
      paint();
    } else if (k === 'create') { b.disabled = true; await create(); }
  }
  function onInput(e) {
    const t = e.target;
    if (t.id === 'stName') { V.name = t.value; V.nameEdited = true; }
    else if (t.id === 'stGoal') V.goal = t.value;
    else if (t.id === 'stUrl') V.url = t.value;
    else if (t.id === 'stPaste') { V.paste = t.value; const p = $('#stPrev'); if (p) p.innerHTML = previewHTML(); }
    else if (t.id === 'stTName') { V.tName = t.value; if (!V.nameEdited) { V.name = defName(V.tName.trim()); const n = $('#stName'); if (n) n.value = V.name; } }
  }

  function display(mode = 'home') {
    let el = wrap();
    if (!el) {
      el = document.createElement('div'); el.id = 'start'; document.body.appendChild(el);
      el.addEventListener('click', onClick);
      el.addEventListener('input', onInput);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.target.id === 'stName' || e.target.id === 'stGoal')) create(); });
    }
    V.mode = mode; V.edit = ''; V.msg = '';
    el.classList.remove('hide');
    paint();
  }
  function hide() { const el = wrap(); if (el) el.classList.add('hide'); V.first = false; }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && wrap() && !wrap().classList.contains('hide')) { e.stopPropagation(); hide(); } }, true);

  // Al abrir la app.
  display('home');
  const refresh = () => { const el = wrap(); if (el && !el.classList.contains('hide') && !V.edit && V.mode !== 'new') paint(); };
  return { show: display, hide, refresh, defName, state: V };
})();
