'use strict';
/*
 * Macar Showdown · Matchups.
 * Tu plan contra cada equipo rival, como una hoja de matchups de VGC: arriba tu equipo (Pokepaste y código) y,
 * por cada rival, sus 6, arquetipo, Pokepaste y código, Plan A y Plan B (2 leads + 2 atrás de tus 6) y lo que hay
 * que tener en cuenta. Con tu récord contra ese equipo (partidas con al menos 4 de sus Pokémon) y un plan sugerido
 * con lo que llevaste cuando ganaste. Se guarda por equipo (matchups.json) y se lleva al documento.
 */
/* global $, esc, spr, api, P, DB, SET, SESS, TEAMS_ME, loadTeams, VIEWS, show, M, Stats, teamOf, Viewer, Undo, Doc, Sess, closeModal, newId */

const Matchups = (() => {
  const V = { teamId: null, q: '', pick: null, edit: null, msg: '', open: null };
  const ROLES = ['Lead', 'Lead', 'Atrás', 'Atrás'];
  const blankRow = () => ({ id: newId('mu'), name: '', arch: '', mons: ['', '', '', '', '', ''], sets: '', paste: '', code: '', a: ['', '', '', ''], b: ['', '', '', ''], notes: '', up: Date.now() });

  /* ---------- datos ---------- */
  async function all() { return (await DB.get('matchups')) || {}; }
  async function ofTeam(teamId) {
    const x = (await all())[teamId] || {};
    return { paste: x.paste || '', code: x.code || '', rows: Array.isArray(x.rows) ? x.rows : [] };
  }
  async function saveTeam(teamId, data) {
    const A = { ...(await all()) };
    A[teamId] = { ...data, up: Date.now() };
    await DB.set('matchups', A);
  }
  async function myTeams() { return (await P.teams()).filter(t => t.side === 'me'); }
  async function pickTeam() {
    const T = await myTeams();
    if (V.teamId && T.some(t => t.id === V.teamId)) return T.find(t => t.id === V.teamId);
    let id = SET.teamId;
    try { const s = await Sess.current(); if (s && s.teamId) id = s.teamId; } catch (e) { /* sin sesión */ }
    const t = T.find(x => x.id === id) || T[0] || null;
    V.teamId = t ? t.id : null;
    return t;
  }

  /** Al abrir la app, tus equipos y sesiones pueden no haber cargado aún: sin ellos no se sabe con qué jugaste. */
  async function ready() { if (typeof TEAMS_ME !== 'undefined' && !TEAMS_ME.length && typeof loadTeams === 'function') await loadTeams(); }
  /** ¿Jugaste esta partida con este equipo? Por su sesión (como el Dashboard) o, sin sesión, por tus Pokémon. */
  function withTeam(teamId) {
    const st = new Map((typeof SESS !== 'undefined' ? SESS : []).map(x => [x.id, x.teamId]));
    return s => (s.session && st.get(s.session) ? st.get(s.session) === teamId : teamOf(s) === teamId);
  }
  /** Partidas con este equipo contra un rival que traía al menos 4 de esos 6 (o todos si son menos). */
  function games(teamId, mons) {
    const ids = mons.filter(Boolean).map(n => P.toID(P.baseSpecies(n)));
    if (ids.length < 2) return [];
    const need = Math.min(4, ids.length);
    const mineT = withTeam(teamId);
    return Stats.usable(M).filter(s => s.me && mineT(s) && ids.filter(i => Stats.theirs(s).preview.map(x => P.toID(P.baseSpecies(x))).includes(i)).length >= need)
      .sort((a, b) => b.endedAt - a.endedAt);
  }
  /** Plan con el que ganas: los leads y los de atrás más repetidos en tus victorias. */
  function suggest(list) {
    const wins = list.filter(s => s.result === 'win');
    if (!wins.length) return null;
    const count = (pick) => { const m = new Map(); for (const s of wins) for (const n of pick(Stats.mine(s))) m.set(n, (m.get(n) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]); };
    const leads = count(x => x.leads).slice(0, 2);
    const back = count(x => x.brought.filter(n => !x.leads.includes(n))).filter(n => !leads.includes(n)).slice(0, 2);
    return [...leads, ...back];
  }
  /** Los 6 de tu equipo, con el nombre que sale en las partidas (el de la forma base) para comparar. */
  const mine = team => P.parseTeam(team.text).sets.map(m => m.species);
  const sameMon = (a, b) => P.toID(P.baseSpecies(a)) === P.toID(P.baseSpecies(b));

  /* ---------- pintar ---------- */
  function slot(name, attrs, cls = '', label = '') {
    return `<button class="muslot${name ? '' : ' empty'}${cls ? ` ${cls}` : ''}" ${attrs} title="${esc(name || label)}">${name ? spr(name, 'muspr') : '<span>+</span>'}${label ? `<small>${esc(label)}</small>` : ''}</button>`;
  }
  function planHTML(r, key, my) {
    const on = V.pick && V.pick.row === r.id && V.pick.plan === key;
    return `<div class="muplan ${key}"><h4>${key === 'a' ? 'Plan A' : 'Plan B'}</h4><div class="muslots">${r[key].map((n, i) => slot(n, `data-muplan="${r.id}:${key}:${i}"`, `${on && V.pick.i === i ? 'on' : ''}${i === 2 ? ' gap' : ''}`, ROLES[i])).join('')}</div>
      ${on ? `<div class="mupicker">${my.map(n => `<button class="mupick${r[key].some(x => sameMon(x, n)) ? ' used' : ''}" data-mupick="${esc(n)}" title="${esc(n)}">${spr(n, 'sm')}</button>`).join('')}<button class="btn sm" data-mupick="">Vaciar</button></div>` : ''}</div>`;
  }
  function rowHTML(r, team, my, i, n) {
    const list = games(team.id, r.mons);
    const w = list.filter(s => s.result === 'win').length, l = list.filter(s => s.result === 'loss').length;
    const guess = r.arch ? '' : P.archetypeOf(r.mons.filter(Boolean));
    const big = V.big === r.id;
    const open = big || V.open === r.id;
    let sheet = '';
    if (big && r.sets) { try { const S = P.parseTeam(r.sets).sets; if (S.length) sheet = `<div class="mubigsets"><h4>Sus sets</h4><div class="shgrid shwide">${S.slice(0, 6).map(m => P.sheetCard(m)).join('')}</div></div>`; } catch (e) { sheet = ''; } }
    return `<div class="murow${big ? ' big' : ''}" data-row="${r.id}">
      <div class="muhead"><span class="mun">${String(i + 1).padStart(2, '0')}</span>
        <button class="btn sm${big ? '' : ' primary'}" data-mubig="${r.id}" title="${big ? 'Volver a la lista' : 'Abrirlo en grande para escribir y verlo con detalle'}">${big ? '← Todos' : '⤢ Abrir'}</button>
        <input class="muname" data-mf="name" value="${esc(r.name)}" placeholder="Nombre del matchup (p. ej. Sun · Chari-Floette)" maxlength="80">
        <input class="muarch" data-mf="arch" list="dlArch" value="${esc(r.arch)}" placeholder="${esc(guess || 'Arquetipo')}" maxlength="40" title="Arquetipo: Sun, Rain, Trick Room, Tailwind…${guess ? ` Detectado: ${guess}` : ''}">
        ${list.length ? `<button class="murec ${w > l ? 'win' : l > w ? 'loss' : ''}" data-murec="${r.id}" title="Tus partidas con este equipo contra él (al menos 4 de sus Pokémon)">${w}–${l}</button>` : '<span class="murec none" title="Aún no has jugado contra este equipo con el tuyo">sin partidas</span>'}
        <span style="flex:1"></span>
        ${suggest(list) ? `<button class="btn sm" data-musug="${r.id}" title="Plan A con los leads y los de atrás que más llevaste cuando ganaste">Plan de tus victorias</button>` : ''}
        <button class="btn sm ibtn" data-mumove="${r.id}:-1" title="Subir"${i ? '' : ' disabled'}>↑</button><button class="btn sm ibtn" data-mumove="${r.id}:1" title="Bajar"${i < n - 1 ? '' : ' disabled'}>↓</button>
        <button class="btn sm ibtn" data-mudup="${r.id}" title="Duplicar">⧉</button><button class="btn sm ibtn danger" data-mudel="${r.id}" title="Borrar (Ctrl+Z para deshacer)">×</button></div>
      <div class="mubody">
        <div class="murival"><div class="muslots six">${r.mons.map((m, k) => (V.edit && V.edit.row === r.id && V.edit.i === k
          ? `<input class="muedit" data-muedit="${r.id}:${k}" list="dlSpecies" value="${esc(m)}" placeholder="Pokémon">`
          : slot(m, `data-mumon="${r.id}:${k}"`))).join('')}</div>
          <div class="mulinks"><input data-mf="paste" value="${esc(r.paste)}" placeholder="Pokepaste del rival">${r.paste ? `<button class="btn sm ibtn" data-muopen="${esc(r.paste)}" title="Abrir el Pokepaste">↗</button>` : ''}<input data-mf="code" value="${esc(r.code)}" placeholder="Código" class="mucode" maxlength="20"></div></div>
        ${planHTML(r, 'a', my)}
        <div class="munotes"><h4>A tener en cuenta</h4><textarea data-mf="notes" placeholder="Qué vigilar, cálculos, cómo te abre, qué no puede pasar…">${esc(r.notes)}</textarea></div>
        ${planHTML(r, 'b', my)}
      </div>
      ${sheet}
      ${big ? `<h4 class="mubigh">Tus partidas contra este equipo ${list.length ? `<span class="note">${w}–${l}</span>` : '<span class="note">ninguna aún</span>'}</h4>` : ''}
      ${open ? `<div class="mugames">${list.slice(0, big ? 40 : 12).map(s => `<button class="gbtn ${s.result || ''}" data-view="${esc(s.id)}" title="${esc(new Date(s.endedAt).toLocaleDateString())} · vs ${esc(Stats.theirs(s).name)}">▶ ${s.result === 'win' ? 'V' : s.result === 'loss' ? 'D' : 'E'} · ${esc(Stats.leadKey(Stats.mine(s).leads))}</button>`).join('')}</div>` : ''}
    </div>`;
  }

  async function render() {
    const el = $('#v-mu');
    if (!el) return;
    await Promise.all([P.dex(), ready()]);
    P.datalists();
    if (!$('#dlArch')) document.body.insertAdjacentHTML('beforeend', `<datalist id="dlArch">${P.ARCHETYPES.map(a => `<option value="${esc(a)}">`).join('')}</datalist>`);
    const team = await pickTeam();
    const T = await myTeams();
    const head = `<div class="head"><div><h1>Match<span>ups</span></h1><p class="note" style="margin-top:4px">Tu plan contra cada equipo: Plan A, Plan B (2 leads + 2 atrás) y qué tener en cuenta. Va al documento.</p></div>
      <div class="row-btns">${T.length ? `<select id="muTeam" title="Tu equipo">${T.map(t => `<option value="${esc(t.id)}"${team && t.id === team.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>` : ''}${team ? '<button class="btn primary" id="muDoc" title="Pone la guía de matchups en el documento de este equipo (la sustituye si ya estaba)">Llevar al documento</button>' : ''}</div></div>`;
    if (!team) { el.innerHTML = `${head}<div class="card"><p class="note">Crea tu equipo en el Teambuilder o empieza una sesión con él.</p></div>`; return; }
    const D = await ofTeam(team.id), my = mine(team);
    const q = V.q.trim().toLowerCase();
    if (V.big && !D.rows.some(r => r.id === V.big)) V.big = null;
    const rows = V.big ? D.rows.filter(r => r.id === V.big) : D.rows.filter(r => !q || [r.name, r.arch, ...r.mons].join(' ').toLowerCase().includes(q));
    el.innerHTML = `${head}
      <div class="mumine"><span class="mulbl">Tu equipo</span><b class="nolang">${esc(team.name)}</b><div class="muslots six">${my.map(n => slot(n, 'disabled')).join('')}</div>
        <div class="mulinks"><input id="muMyPaste" value="${esc(D.paste)}" placeholder="Tu Pokepaste">${D.paste ? `<button class="btn sm ibtn" data-muopen="${esc(D.paste)}" title="Abrir el Pokepaste">↗</button>` : ''}<input id="muMyCode" value="${esc(D.code)}" placeholder="Código" class="mucode" maxlength="20"></div></div>
      <div class="mubar${V.big ? ' hide' : ''}"><b class="mutitle">Matchups <span class="note">${D.rows.length}</span></b>
        <input id="muQ" value="${esc(V.q)}" placeholder="Buscar: nombre, arquetipo o Pokémon…">
        <button class="btn sm primary" data-muadd="blank">+ Matchup</button><button class="btn sm" data-muadd="paste" title="Desde un Pokepaste o pegando el equipo">+ Desde Pokepaste</button><button class="btn sm" data-muadd="games" title="Los equipos rivales de tus partidas con este equipo">+ De tus partidas</button><button class="btn sm" data-muadd="box" title="Los equipos rivales de tu Team Box (Mi PC)">+ De Team Box</button></div>
      ${V.msg ? `<p class="note mumsg">${esc(V.msg)}</p>` : ''}
      <div class="mulist">${rows.length ? rows.map(r => rowHTML(r, team, my, D.rows.indexOf(r), D.rows.length)).join('') : `<div class="card mtempty"><b>${D.rows.length ? 'Ningún matchup con esa búsqueda.' : 'Aún no tienes matchups.'}</b><span class="note">Añade un rival: vacío, desde su Pokepaste, de tus partidas o de tu Team Box.</span></div>`}</div>`;
  }

  /* ---------- añadir rivales ---------- */
  async function addRow(team, patch) {
    const D = await ofTeam(team.id);
    const r = { ...blankRow(), ...patch };
    if (!r.arch) r.arch = P.archetypeOf(r.setsList || r.mons.filter(Boolean));
    delete r.setsList;
    D.rows.push(r);
    await saveTeam(team.id, D);
    V.msg = `Matchup añadido: ${r.name || r.mons.filter(Boolean).slice(0, 2).join(' + ')}.`;
    closeModal();
    await render();
    const el = document.querySelector(`.murow[data-row="${r.id}"]`);
    if (el) el.scrollIntoView({ block: 'center' });
  }
  function fromSets(sets) { const S = sets.slice(0, 6).map(m => m.species); while (S.length < 6) S.push(''); return S; }
  async function addModal(kind, team) {
    const box = $('#modalBox');
    if (kind === 'paste') {
      box.innerHTML = `<button class="btn x" id="mClose">Cerrar</button><h2>Matchup desde un Pokepaste</h2>
        <div class="ed"><label class="field">Enlace de pokepast.es<input id="muUrl" placeholder="https://pokepast.es/…" class="nolang"></label><button class="btn" id="muFetch" style="align-self:end">Traer</button></div>
        <label class="field" style="margin-top:8px">…o pega el equipo<textarea id="muTxt" rows="10" placeholder="El equipo exportado de Showdown"></textarea></label>
        <label class="field" style="margin-top:8px">Nombre<input id="muNm" maxlength="80" placeholder="Ej.: Sun · Chari-Floette"></label>
        <div class="row-btns" style="margin-top:10px"><button class="btn primary" id="muSave">Añadir</button><span class="note" id="muMsg"></span></div>`;
      $('#modal').classList.remove('hide');
      $('#mClose').onclick = closeModal;
      $('#muFetch').onclick = async () => { $('#muMsg').textContent = 'Trayendo…'; const r = await api.fetchPaste($('#muUrl').value); if (!r.ok) { $('#muMsg').textContent = r.why; return; } $('#muTxt').value = r.text; if (!$('#muNm').value && r.title) $('#muNm').value = r.title; $('#muMsg').textContent = 'Listo.'; };
      $('#muSave').onclick = async () => {
        const sets = P.parseTeam($('#muTxt').value).sets;
        if (!sets.length) { $('#muMsg').textContent = 'No hay ningún Pokémon en el texto.'; return; }
        await addRow(team, { name: $('#muNm').value.trim(), mons: fromSets(sets), sets: $('#muTxt').value.slice(0, 20000), paste: $('#muUrl').value.trim(), setsList: sets });
      };
      return;
    }
    let items = [];
    await ready();
    if (kind === 'games') {
      const seen = new Map();
      const mineT = withTeam(team.id);
      for (const s of Stats.usable(M).filter(x => x.me && mineT(x)).sort((a, b) => b.endedAt - a.endedAt)) {
        const op = Stats.theirs(s), pv = (op.sheet && op.sheet.length ? op.sheet.map(x => x.species) : op.preview).slice(0, 6);
        if (pv.length < 4) continue;
        const key = pv.map(n => P.toID(P.baseSpecies(n))).sort().join('|');
        if (seen.has(key)) { seen.get(key).n++; continue; }
        seen.set(key, { n: 1, name: `vs ${op.name}`, mons: pv, sheet: op.sheet || null, at: s.endedAt });
      }
      items = [...seen.values()].slice(0, 40);
    } else {
      items = (await P.teams()).filter(t => t.side === 'foe').map(t => { const S = P.parseTeam(t.text).sets; return { name: t.name, mons: S.map(m => m.species), sets: t.text, setsList: S }; });
    }
    box.innerHTML = `<button class="btn x" id="mClose">Cerrar</button><h2>${kind === 'games' ? 'Rivales de tus partidas' : 'Equipos rivales de tu Team Box'}</h2>
      <p class="note">${kind === 'games' ? 'Los equipos contra los que has jugado con este equipo (con hoja de equipo si la había). Pulsa uno para añadirlo.' : 'Pulsa uno para añadirlo.'}</p>
      <div class="mupicklist">${items.length ? items.map((x, i) => `<button class="mupickrow" data-mui="${i}"><span class="nolang">${esc(x.name)}</span><span>${x.mons.map(n => spr(n, 'sm')).join('')}</span>${x.n > 1 ? `<span class="note">${x.n} partidas</span>` : ''}</button>`).join('') : `<p class="note">${kind === 'games' ? 'Aún no hay partidas con este equipo.' : 'No tienes equipos rivales en el Team Box.'}</p>`}</div>`;
    $('#modal').classList.remove('hide');
    $('#mClose').onclick = closeModal;
    box.onclick = e => {
      const b = e.target.closest('[data-mui]');
      if (!b) return;
      const x = items[+b.dataset.mui];
      const sheetSets = x.sheet ? x.sheet.map(y => P.sheetSet(y, null)).filter(Boolean) : null;
      addRow(team, { name: x.name, mons: fromSets(sheetSets || x.mons.map(n => ({ species: n }))), sets: x.sets || (sheetSets ? P.exportTeam(sheetSets) : ''), setsList: x.setsList || sheetSets || x.mons });
    };
  }

  /* ---------- eventos ---------- */
  async function patchRow(id, fn, label) {
    const team = await pickTeam();
    if (!team) return;
    if (label) await Undo.snap('matchups', label);
    const D = await ofTeam(team.id);
    const i = D.rows.findIndex(r => r.id === id);
    if (i < 0) return;
    const r = { ...D.rows[i] };
    const res = fn(r, D, i);
    if (res !== 'skip') { r.up = Date.now(); D.rows[i] = r; }
    await saveTeam(team.id, D);
  }
  function bind() {
    const el = $('#v-mu');
    el.addEventListener('click', async e => {
      const t = e.target.closest('button');
      if (!t) return;
      const d = t.dataset;
      const team = await pickTeam();
      if (t.id === 'muDoc') { if (typeof Doc !== 'undefined' && Doc.putMatchups) { await Doc.putMatchups(team.id); show('doc'); } return; }
      if (d.muadd) { if (d.muadd === 'blank') addRow(team, {}); else addModal(d.muadd, team); return; }
      if (d.muopen) { api.openExternal(d.muopen); return; }
      if (d.view) { Viewer.open(d.view); return; }
      if (d.murec) { V.open = V.open === d.murec ? null : d.murec; render(); return; }
      if (d.mubig) { V.big = V.big === d.mubig ? null : d.mubig; V.pick = null; V.edit = null; await render(); const r = document.querySelector(`.murow[data-row="${CSS.escape(d.mubig)}"]`); if (r) r.scrollIntoView({ block: 'start' }); return; }
      if (d.mumon) { const [row, i] = d.mumon.split(':'); V.edit = { row, i: +i }; await render(); const inp = $('.muedit'); if (inp) { inp.focus(); inp.select(); } return; }
      if (d.muplan) { const [row, plan, i] = d.muplan.split(':'); V.pick = V.pick && V.pick.row === row && V.pick.plan === plan && V.pick.i === +i ? null : { row, plan, i: +i }; render(); return; }
      if (d.mupick != null && V.pick) {
        const { row, plan, i } = V.pick;
        await patchRow(row, r => {
          const L = r[plan].slice();
          const dup = d.mupick ? L.findIndex((x, k) => k !== i && sameMon(x, d.mupick)) : -1;
          if (dup >= 0) L[dup] = L[i];
          L[i] = d.mupick;
          r[plan] = L;
        });
        // Siguiente hueco vacío del mismo plan, para elegir los 4 seguidos.
        const D = await ofTeam(team.id), r = D.rows.find(x => x.id === row);
        const next = r ? r[plan].findIndex(x => !x) : -1;
        V.pick = d.mupick && next >= 0 ? { row, plan, i: next } : null;
        render(); return;
      }
      if (d.musug) { const D = await ofTeam(team.id), r = D.rows.find(x => x.id === d.musug); const s = r && suggest(games(team.id, r.mons)); if (s) { await patchRow(d.musug, x => { const L = ['', '', '', '']; s.forEach((n, k) => { L[k] = n; }); x.a = L; }, 'Plan A cambiado'); V.msg = 'Plan A: lo que llevaste en tus victorias contra este equipo.'; render(); } return; }
      if (d.mumove) {
        const [id, dir] = d.mumove.split(':');
        await patchRow(id, (r, D, i) => { const j = i + +dir; if (j < 0 || j >= D.rows.length) return 'skip'; [D.rows[i], D.rows[j]] = [D.rows[j], D.rows[i]]; return 'skip'; });
        render(); return;
      }
      if (d.mudup) { await patchRow(d.mudup, (r, D, i) => { D.rows.splice(i + 1, 0, { ...r, id: newId('mu'), name: `${r.name || 'Matchup'} (copia)` }); return 'skip'; }, 'Matchup duplicado'); render(); return; }
      if (d.mudel) {
        const D = await ofTeam(team.id), r = D.rows.find(x => x.id === d.mudel);
        await Undo.snap('matchups', `Matchup ${r && r.name ? `«${r.name}» ` : ''}borrado`);
        D.rows = D.rows.filter(x => x.id !== d.mudel);
        await saveTeam(team.id, D); render();
      }
    });
    // Escribir: se guarda solo (nombre, arquetipo, Pokepaste, código, notas y tus datos).
    let tm = null;
    el.addEventListener('input', e => {
      const t = e.target;
      if (t.id === 'muQ') { V.q = t.value; clearTimeout(tm); tm = setTimeout(async () => { const pos = t.selectionStart; await render(); const q = $('#muQ'); if (q) { q.focus(); q.setSelectionRange(pos, pos); } }, 250); return; }
      const row = t.closest('.murow');
      clearTimeout(tm);
      tm = setTimeout(async () => {
        const team = await pickTeam();
        if (!team) return;
        if (t.id === 'muMyPaste' || t.id === 'muMyCode') { const D = await ofTeam(team.id); D[t.id === 'muMyPaste' ? 'paste' : 'code'] = t.value.trim(); await saveTeam(team.id, D); return; }
        if (row && t.dataset.mf) await patchRow(row.dataset.row, r => { r[t.dataset.mf] = t.dataset.mf === 'notes' ? t.value.slice(0, 4000) : t.value.slice(0, 200); });
      }, 450);
    });
    el.addEventListener('change', async e => {
      if (e.target.id === 'muTeam') { V.teamId = e.target.value; V.pick = null; V.edit = null; V.open = null; V.big = null; render(); }
    });
    // Cambiar un Pokémon del rival: Intro o salir del cuadro guarda, Esc lo deja.
    const commit = async inp => {
      const [row, i] = inp.dataset.muedit.split(':');
      const v = inp.value.trim(), sp = v ? P.calcSpecies(v) || v : '';
      V.edit = null;
      await patchRow(row, r => { const L = r.mons.slice(); L[+i] = sp; r.mons = L; });
      render();
    };
    el.addEventListener('keydown', e => {
      const inp = e.target.closest('.muedit');
      if (!inp) return;
      if (e.key === 'Enter') { e.preventDefault(); commit(inp); } else if (e.key === 'Escape') { e.stopPropagation(); V.edit = null; render(); }
    });
    el.addEventListener('focusout', e => { const inp = e.target.closest('.muedit'); if (inp && V.edit) commit(inp); });
  }

  /** Lo que el documento necesita: tus datos y los matchups de un equipo. */
  async function forDoc(teamId) {
    const D = await ofTeam(teamId);
    return { ...D, rows: D.rows.map(r => ({ ...r, games: games(teamId, r.mons) })) };
  }

  bind();
  VIEWS.mu = () => { V.msg = ''; render(); };
  return { render, forDoc, archetypeOf: P.archetypeOf };
})();
