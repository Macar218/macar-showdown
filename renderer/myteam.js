'use strict';
/*
 * Macar Showdown · Tu equipo.
 * El equipo con el que juegas, montado: cada Pokémon con su objeto, habilidad y movimientos. Arriba se cambia por
 * otro de tus equipos; abajo se actualiza con un Pokepaste (sus partidas se quedan) o se guarda como equipo nuevo.
 * Tu usuario de Showdown, copiarlo o subirlo a Pokepaste y abrirlo en el Teambuilder.
 */
/* global $, esc, spr, api, P, SET, VIEWS, show, Calc, Team, Start, Sess, load, I18N, Undo */

const MyTeam = (() => {
  const V = { msg: '', ok: true, paste: '', url: '', link: '', sel: 0, name: '' };

  /** La sesión abierta y el equipo con el que juegas (el mismo en todas partes: Jugar, Calculadora, Dashboard). */
  async function teamOfSession() {
    const s = await Sess.current();
    return { s, team: SET.teamId ? await P.teamById(SET.teamId) : null };
  }

  async function render() {
    const el = $('#v-miequipo');
    const { s, team } = await teamOfSession();
    const mine = (await P.teams()).filter(t => t && t.side === 'me');
    await P.dex(); // descripciones de los movimientos (Macar Dex)
    const sets = team ? P.parseTeam(team.text).sets : [];
    const PC = await P.pcList();
    if (V.sel >= sets.length) V.sel = 0;
    const name = m => (m.nick && m.nick !== m.species ? `${m.nick} (${m.species})` : m.species);
    el.innerHTML = `<div class="head"><div><h1>Tu <span>equipo</span></h1><p class="note" style="margin-top:4px">El equipo con el que juegas ahora. Puedes cambiarlo cuando quieras, también en mitad de una sesión: cada partida guarda con qué equipo la jugaste.</p></div>
      <div class="row-btns"><button class="btn sm mtsessb" id="mtStart" title="Cambiar de sesión o crear una nueva">${s ? `<small>${typeof I18N !== 'undefined' && I18N.lang === 'en' ? 'Session' : 'Sesión'}</small> <span class="nolang">${esc(s.name)}</span>` : 'Sin sesión'}</button></div></div>
      <div class="mtuse"><label class="field">Juegas con<select id="mtTeamSel">${team ? '' : '<option value="">Elige un equipo…</option>'}${mine.map(t => `<option value="${esc(t.id)}"${team && t.id === team.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
        <span class="mtmons">${sets.map(m => spr(m.species, 'sm')).join('')}</span><span style="flex:1"></span>
        <button class="btn sm" id="mtNew" title="Pega un Pokepaste abajo y guárdalo como equipo nuevo">+ Equipo nuevo</button>
        ${team ? `<button class="btn sm primary" id="mtEdit">Editar en el Teambuilder</button><button class="btn sm" id="mtCopy" title="Copiar el equipo en formato Showdown">Copiar</button><button class="btn sm" id="mtPaste" title="Lo sube a pokepast.es (quien tenga el enlace puede verlo)">Crear Pokepaste</button><button class="btn sm" id="mtSd" title="Lo añade a tu teambuilder de Showdown (carpeta «Macar Showdown»)">Llevar a Showdown</button>` : ''}</div></div>
      ${V.msg ? `<p class="${V.ok ? 'okmsg' : 'errmsg'} mtmsg">${esc(V.msg)}${V.link ? ` <button class="btn sm" id="mtOpen">Abrir</button>` : ''}</p>` : ''}
      ${sets.length ? `<div class="mtpicks">${sets.map((m, i) => { const c = P.myCalcs(PC, m.species), n = c.off.length + c.def.length, it = m.item && P.itemInfo(m.item); return `<button class="mtpk${i === V.sel ? ' on' : ''}" data-mtsel="${i}" title="Ver su ficha, sus cálculos y notas">${spr(m.species)}<b class="nolang">${esc(name(m))}</b><span class="nolang">${it && it.img ? `<img src="${it.img}" alt="">` : ''}${esc(m.item || '—')}</span><small>${n ? `${n} cálculo${n === 1 ? '' : 's'}` : 'sin cálculos'}</small></button>`; }).join('')}</div>
        ${detail(sets[V.sel], PC, name)}
        <div class="card mtnotes"><h2>Notas del equipo <span class="note">· las mismas que en el Teambuilder</span></h2><textarea id="mtNotes" rows="4" placeholder="Idea del equipo, leads, planes…">${esc(team.notes || '')}</textarea><p class="note" id="mtNotesMsg"></p></div>`
        : `<div class="card mtempty"><b>Aún no juegas con ningún equipo.</b><span class="note">${mine.length ? 'Elige uno arriba o pega un Pokepaste abajo.' : 'Pega su Pokepaste abajo y guárdalo como equipo nuevo, o créalo en «Construir equipo».'}</span></div>`}
      <div class="mtbottom">
        <div class="card"><h2>Jugador</h2><label class="field">Tu usuario de Showdown<input type="text" id="mtUser" value="${esc(SET.showdownName || '')}" placeholder="Por ejemplo: toto110"></label>
          <p class="note" style="margin-top:8px">Sirve para saber qué jugador eres en cada partida y para leer tu ELO y tu GXE. Si tienes varias cuentas, sepáralas con comas.</p>
          <div class="row-btns"><button class="btn" id="mtUserOk">Guardar</button><span class="note" id="mtUserMsg"></span></div></div>
        <div class="card" id="mtImport"><h2>Pokepaste</h2>
          <p class="note" style="margin:0 0 6px">Actualiza el equipo de arriba (mismos Pokémon con otros sets, o algún cambio: sus partidas, notas y documento se quedan) o guárdalo como un equipo nuevo.</p>
          <div class="stline"><label class="field" style="flex:1">Enlace de pokepast.es<input id="mtUrl" value="${esc(V.url)}" placeholder="https://pokepast.es/…"></label><button class="btn" id="mtFetch">Traer</button></div>
          <textarea id="mtTxt" rows="5" placeholder="…o pega el equipo en formato Showdown">${esc(V.paste)}</textarea>
          <div class="row-btns">${team ? `<button class="btn primary" id="mtUse" title="Sustituye los sets de «${esc(team.name)}» por los del Pokepaste">Actualizar «<span class="nolang">${esc(team.name)}</span>»</button>` : ''}<span style="flex:1"></span>
            <input id="mtName" value="${esc(V.name)}" placeholder="Nombre del equipo nuevo" maxlength="100" style="max-width:200px"><button class="btn${team ? '' : ' primary'}" id="mtAdd">Guardar como equipo nuevo</button></div></div>
      </div>`;
  }

  /** La ficha del Pokémon elegido: su set entero y, al lado, sus cálculos de Mi PC (ofensivos y defensivos) y sus notas. */
  function detail(m, PC, name) {
    if (!m) return '';
    const it = m.item && P.itemInfo(m.item), en = typeof I18N !== 'undefined' && I18N.lang === 'en';
    const c = P.myCalcs(PC, m.species);
    const list = (k, L) => `<h3 class="mtck ${k}">${k === 'off' ? 'Cálculos ofensivos clave' : 'Cálculos defensivos clave'} <span class="note">${L.length || ''}</span></h3>${L.length ? `<ul class="mtcl">${L.map(t => `<li class="nolang">${esc(t)}</li>`).join('')}</ul>` : `<p class="note">${k === 'off' ? 'Ninguno. En la Calculadora, «Cálculo a Mi PC» cuando ataca.' : 'Ninguno. En la Calculadora, «Cálculo a Mi PC» cuando recibe el golpe.'}</p>`}`;
    return `<div class="mtdet"><div class="mtc"><div class="mthead">${spr(m.species, 'huge')}<div class="mthn"><b class="nolang">${esc(name(m))}</b><div class="tytags">${P.typesOf(m.species).map(P.typeBadge).join('')}</div></div></div>
        <div class="mtinfo">
          <div class="mtik"><small>Objeto</small><span class="nolang">${it && it.img ? `<img src="${it.img}" alt="">` : ''}<b>${esc(m.item || '—')}</b></span>${it ? `<em class="nolang">${esc(en ? it.d : it.dEs || it.d)}</em>` : ''}</div>
          <div class="mtik"><small>Habilidad</small><span class="nolang"><b>${esc(m.ability || '—')}</b></span></div>
          <div class="mtik"><small>Naturaleza</small><span><b>${esc(P.natLabel(m.nature))}</b></span></div>
        </div>
        ${P.statBlock(m)}
        <div class="mtmoves">${m.moves.map(x => { const info = x && P.moveInfo(x); return `<div class="mtmv">${P.moveTile(x)}${info && info.desc ? `<small class="mtmvd nolang">${esc(info.desc)}</small>` : ''}</div>`; }).join('')}</div></div>
      <div class="card mtcalcs">${list('off', c.off)}${list('def', c.def)}
        ${c.notes.length ? `<h3>Notas en Mi PC</h3>${c.notes.map(t => `<p class="mtpcn">${esc(t).split('\n').join('<br>')}</p>`).join('')}` : ''}
        <div class="row-btns"><button class="btn sm" data-mtcalc="1">Abrir la Calculadora</button><button class="btn sm" data-mtpc="1">Ver en Mi PC</button></div></div></div>`;
  }

  function say(msg, ok = true, link = '') { V.msg = msg; V.ok = ok; V.link = link; render(); }

  $('#v-miequipo').addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mtsel != null) { V.sel = +b.dataset.mtsel; render(); return; }
    if (b.dataset.mtcalc) { show('calc'); return; }
    if (b.dataset.mtpc) { show('pc'); return; }
    const { s, team } = await teamOfSession();
    if (b.id === 'mtStart') show('inicio');
    else if (b.id === 'mtNew') { const box = $('#mtImport'); if (box) { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); const t = $('#mtTxt'); if (t) t.focus(); } }
    else if (b.id === 'mtEdit' && team) { Team.select(team.id); show('equipo'); }
    else if (b.id === 'mtCopy' && team) { navigator.clipboard.writeText(team.text); say('Equipo copiado (formato Showdown).'); }
    else if (b.id === 'mtSd' && team) { const r = await api.sdAddTeam(team.name, team.text); say(r.ok ? 'Añadido a tu teambuilder de Showdown (carpeta «Macar Showdown»).' : `No se pudo: ${r.why}`, r.ok); }
    else if (b.id === 'mtPaste' && team) {
      b.disabled = true; b.textContent = 'Subiendo…';
      const r = await api.createPaste(team.name, team.text);
      if (r.ok) { navigator.clipboard.writeText(r.url); say(`Pokepaste creado y enlace copiado: ${r.url}`, true, r.url); } else say(`No se ha podido crear el Pokepaste: ${r.why}`, false);
    } else if (b.id === 'mtOpen' && V.link) api.openExternal(V.link);
    else if (b.id === 'mtUserOk') {
      Object.assign(SET, await api.setSettings({ showdownName: $('#mtUser').value.trim() }));
      $('#mtUserMsg').textContent = 'Guardado. Partidas actualizadas.';
      load();
    } else if (b.id === 'mtFetch') {
      const r = await api.fetchPaste(V.url);
      if (!r.ok) { say(r.why, false); return; }
      V.paste = r.text; V.msg = ''; render();
    } else if (b.id === 'mtUse' || b.id === 'mtAdd') {
      // Si solo hay enlace, se trae primero.
      if (!V.paste.trim() && V.url.trim()) { const f = await api.fetchPaste(V.url); if (!f.ok) { say(f.why, false); return; } V.paste = f.text; if (!V.name) V.name = f.title || ''; }
      const r = P.parseTeam(V.paste);
      if (!r.sets.length) { say(`No se ha encontrado ningún Pokémon de Champions.${r.bad.length ? ` Desconocidos: ${r.bad.join(', ')}` : ''}`, false); return; }
      const text = P.exportTeam(r.sets.slice(0, 6));
      let msg;
      if (b.id === 'mtUse' && team) {
        await Undo.snap('equipos', `Equipo «${team.name}» actualizado`);
        team.text = text; await P.saveTeam(team);
        msg = `«${team.name}» actualizado.`;
      } else {
        const v = await P.saveTeam({ name: V.name.trim() || r.sets.slice(0, 2).map(m => m.species).join(' / '), side: 'me', text });
        Calc.reloadTeams();
        await Sess.useTeam(v.id);
        msg = `Equipo nuevo «${v.name}»: ahora juegas con él.`;
      }
      Calc.reloadTeams();
      V.paste = ''; V.url = ''; V.name = '';
      say(r.bad.length ? `${msg} No reconocidos (fuera): ${r.bad.join(', ')}` : msg);
      load();
    }
  });
  let notesT = null;
  $('#v-miequipo').addEventListener('input', e => {
    if (e.target.id === 'mtTxt') V.paste = e.target.value;
    if (e.target.id === 'mtUrl') V.url = e.target.value;
    if (e.target.id === 'mtName') V.name = e.target.value;
    // Notas del equipo: las mismas del Teambuilder; se guardan en el equipo.
    if (e.target.id === 'mtNotes') {
      const v = e.target.value;
      clearTimeout(notesT);
      notesT = setTimeout(async () => { const { team } = await teamOfSession(); if (!team) return; team.notes = v; await P.saveTeam(team); const m = $('#mtNotesMsg'); if (m) m.textContent = 'Guardado'; }, 600);
    }
  });

  $('#v-miequipo').addEventListener('change', async e => {
    if (e.target.id === 'mtTeamSel' && e.target.value) { V.sel = 0; await Sess.useTeam(e.target.value); const t = await P.teamById(e.target.value); say(`Ahora juegas con «${t ? t.name : ''}».`); }
  });
  VIEWS.miequipo = () => { V.msg = ''; render(); };
  return { render };
})();
