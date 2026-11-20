'use strict';
/*
 * Macar Showdown · Tu equipo.
 * El equipo de la sesión abierta, montado: cada Pokémon con su objeto, habilidad y movimientos. Tu usuario de
 * Showdown, copiarlo o subirlo a Pokepaste, cambiarlo pegando otro Pokepaste y abrirlo en el Teambuilder.
 */
/* global $, esc, ani, api, P, SET, VIEWS, show, Calc, Team, Start, Sess, load, scopeInfo */

const MyTeam = (() => {
  const V = { msg: '', ok: true, paste: '', url: '', link: '' };

  async function teamOfSession() {
    const s = await Sess.current();
    const id = (s && s.teamId) || SET.teamId;
    return { s, team: id ? await P.teamById(id) : null };
  }

  async function render() {
    const el = $('#v-miequipo');
    const { s, team } = await teamOfSession();
    const sets = team ? P.parseTeam(team.text).sets : [];
    const name = m => (m.nick && m.nick !== m.species ? `${m.nick} (${m.species})` : m.species);
    el.innerHTML = `<div class="head"><div><h1>Tu <span>equipo</span></h1><p class="note" style="margin-top:4px">El equipo de tu sesión. Con él se reconocen tus Pokémon en cada partida (también por mote) y salen sus estadísticas.</p></div>
      <div class="row-btns">${s ? `<span class="mtsess nolang">${esc(s.name)}</span>` : '<button class="btn" id="mtStart">Elegir sesión</button>'}
        ${team ? `<button class="btn primary" id="mtEdit">Editar en el Teambuilder</button><button class="btn" id="mtCopy" title="Copiar el equipo en formato Showdown">Copiar</button><button class="btn" id="mtPaste" title="Lo sube a pokepast.es (quien tenga el enlace puede verlo)">Crear Pokepaste</button><button class="btn" id="mtSd" title="Lo añade a tu teambuilder de Showdown (carpeta «Macar Showdown»)">Llevar a Showdown</button>` : ''}</div></div>
      ${V.msg ? `<p class="${V.ok ? 'okmsg' : 'errmsg'} mtmsg">${esc(V.msg)}${V.link ? ` <button class="btn sm" id="mtOpen">Abrir</button>` : ''}</p>` : ''}
      <div class="mtstage">${sets.length ? `<div class="mtmons">${sets.map(m => `<div class="mtmon">
          <div class="mtcard"><b class="nolang">${esc(name(m))}</b>${m.item ? `<span class="mtit nolang">@ ${esc(m.item)}</span>` : ''}${m.ability ? `<span class="mtab nolang">${esc(m.ability)}</span>` : ''}
            <ul>${m.moves.filter(Boolean).map(mv => `<li class="nolang">${esc(mv)}</li>`).join('')}</ul></div>
          <div class="mtfig">${ani(m.species, 'mtani')}</div></div>`).join('')}</div>`
        : `<div class="mtempty"><b>${s ? 'Esta sesión aún no tiene equipo.' : 'No tienes ninguna sesión abierta.'}</b><span>${s ? 'Pega su Pokepaste abajo y queda montado.' : 'Empieza o carga una sesión con tu equipo.'}</span></div>`}</div>
      <div class="mtbottom">
        <div class="card"><h2>Jugador</h2><label class="field">Tu usuario de Showdown<input type="text" id="mtUser" value="${esc(SET.showdownName || '')}" placeholder="Por ejemplo: toto110"></label>
          <p class="note" style="margin-top:8px">Sirve para saber qué jugador eres en cada partida y para leer tu ELO y tu GXE. Si tienes varias cuentas, sepáralas con comas.</p>
          <div class="row-btns"><button class="btn" id="mtUserOk">Guardar</button><span class="note" id="mtUserMsg"></span></div></div>
        <div class="card"><h2>${team ? 'Cambiar el equipo' : 'Importar equipo'}</h2>
          <div class="stline"><label class="field" style="flex:1">Enlace de pokepast.es<input id="mtUrl" value="${esc(V.url)}" placeholder="https://pokepast.es/…"></label><button class="btn" id="mtFetch">Traer</button></div>
          <textarea id="mtTxt" rows="5" placeholder="…o pega el equipo en formato Showdown">${esc(V.paste)}</textarea>
          <div class="row-btns"><span class="note">${team ? 'Sustituye los Pokémon de este equipo; sus partidas y sesiones se quedan.' : ''}</span><span style="flex:1"></span><button class="btn primary" id="mtUse">Usar este equipo</button></div></div>
      </div>`;
  }

  function say(msg, ok = true, link = '') { V.msg = msg; V.ok = ok; V.link = link; render(); }

  $('#v-miequipo').addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    const { s, team } = await teamOfSession();
    if (b.id === 'mtStart') Start.show('home');
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
    } else if (b.id === 'mtUse') {
      const r = P.parseTeam(V.paste);
      if (!r.sets.length) { say(`No se ha encontrado ningún Pokémon de Champions.${r.bad.length ? ` Desconocidos: ${r.bad.join(', ')}` : ''}`, false); return; }
      const text = P.exportTeam(r.sets.slice(0, 6));
      if (team) { team.text = text; await P.saveTeam(team); }
      else {
        const v = await P.saveTeam({ name: r.sets.slice(0, 2).map(m => m.species).join(' / '), side: 'me', text });
        if (s) { const all = await Sess.list(); const x = all.find(y => y.id === s.id); if (x) { x.teamId = v.id; await Sess.save(all); } }
        Object.assign(SET, await api.setSettings({ teamId: v.id }));
      }
      Calc.reloadTeams();
      V.paste = ''; V.url = '';
      say(r.bad.length ? `Equipo cambiado. No reconocidos (fuera): ${r.bad.join(', ')}` : 'Equipo cambiado.');
      load();
    }
  });
  $('#v-miequipo').addEventListener('input', e => { if (e.target.id === 'mtTxt') V.paste = e.target.value; if (e.target.id === 'mtUrl') V.url = e.target.value; });

  VIEWS.miequipo = () => { V.msg = ''; render(); };
  return { render };
})();
