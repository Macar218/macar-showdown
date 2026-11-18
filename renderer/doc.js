'use strict';
/*
 * Macar Showdown · Documento de preparación.
 * Una hoja por equipo, montada con tus datos (sets, cálculos clave, matchups, récord) y editable a mano.
 * Cada bloque se puede quitar del PDF; se guarda en la carpeta de datos (docs.json) y se exporta a PDF.
 */
/* global P, DB, api, $, $$, esc, spr, VIEWS, Stats, M, teamOf, Team, SET */

const Doc = (() => {
  const V = { teamId: null, preview: false, saving: null, msg: '' };
  const SPR = 'https://play.pokemonshowdown.com/sprites/gen5/';
  const BLOCKS = [
    ['p', 'Texto normal', 'Un hueco para escribir'],
    ['box', 'Caja con título', 'Un recuadro con su título'],
    ['key', 'Idea clave', 'Una idea clave, en amarillo claro'],
    ['list', 'Lista', 'Una lista para ir apuntando'],
    ['table', 'Tabla', 'Insertar una tabla de 3×3'],
    ['calc', 'Otro cálculo', 'Una línea de cálculo de daño'],
    ['page', 'Salto de página', 'Lo que sigue, en otra hoja']
  ];
  const nid = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const sprImg = (name, cls = '') => spr(name, cls);

  /* ---------- montar el documento con tus datos ---------- */
  async function generate(team) {
    const sets = P.parseTeam(team.text).sets;
    const U = await P.usage('');
    const ms = Stats.usable(M).filter(s => teamOf(s) === team.id);
    const r = Stats.compute(ms);
    const blocks = [];
    const add = (type, html, extra = {}) => blocks.push({ id: nid(), type, html, on: true, ...extra });
    add('title', `<h1>${esc(team.name)}</h1><p class="dsub">Documento de preparación · Pokémon Champions VGC · ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>`);
    add('kv', `<p><b>Pokepaste del equipo:</b> <span class="fill">pega aquí el enlace</span></p><p><b>Código de alquiler:</b> <span class="fill">—</span></p>${ms.length ? `<p><b>Récord con este equipo:</b> ${r.w}–${r.l} (${Math.round(r.wr * 100)}%) en ${r.n} partidas</p>` : ''}`);
    add('team', teamHTML(sets));
    add('box', '<h3>Historia y concepto del equipo</h3><p class="fill">Por qué este equipo: qué viste en el metajuego y qué querías aprovechar.</p><p class="fill">Cómo gana: el plan principal y los alternativos. Sus puntos fuertes y débiles.</p>');
    add('h', '<h2>Sets y cálculos clave de cada Pokémon</h2>');
    const threats = P.usageRank(U).slice(0, 12).map(n => P.usageSet(U, P.calcSpecies(n) || n)).filter(Boolean);
    const seen = r.oppPreview.slice(0, 8).map(x => P.calcSpecies(x.key)).filter(Boolean);
    const foes = [...seen.map(n => P.usageSet(U, n) || P.blankMon(n)), ...threats].filter((m, i, a) => a.findIndex(z => P.baseSpecies(z.species) === P.baseSpecies(m.species)) === i).slice(0, 10);
    for (const m of sets) add('mon', monHTML(m, foes));
    add('page', '');
    add('h', '<h2>Guía de matchups</h2>');
    if (r.oppPreview.length) {
      add('p', `<p><b>Lo más jugado.</b> Tus leads más usados: ${r.myLeads.slice(0, 3).map(x => `${esc(x.key)} (${Math.round((x.w / x.n) * 100)}%, ${x.n})`).join(' · ') || '—'}.</p>`);
      for (const x of r.oppPreview.slice(0, 6)) {
        const sub = ms.filter(s => Stats.theirs(s).preview.includes(x.key));
        const sr = Stats.compute(sub);
        add('match', `<h3>${sprImg(x.key, 'sm')} ${esc(x.key)} <span class="drec">${sr.w}–${sr.l}</span></h3>
          <p><b>Tus leads contra él:</b> ${sr.myLeads.slice(0, 3).map(l => `${esc(l.key)} (${l.w}–${l.n - l.w})`).join(' · ') || '—'}</p>
          <p><b>Cómo te abren:</b> ${sr.oppLeads.slice(0, 3).map(l => `${esc(l.key)} (${l.n})`).join(' · ') || '—'}</p>
          <p><b>Claves para ganar el matchup:</b> <span class="fill">La idea clave.</span></p>`);
      }
    } else add('box', '<h3>Equipo rival</h3><p class="fill">Juega partidas con este equipo (o importa replays) y aquí salen tus matchups con récord y leads. Mientras, escribe aquí tu plan contra lo que más esperas ver.</p>');
    add('box', '<h3>Notas</h3><p class="fill">Escribe aquí…</p>');
    return { teamId: team.id, style: 'dark', blocks, up: Date.now() };
  }
  function teamHTML(sets) {
    return `<div class="dteam">${sets.map(m => `<div class="dmon">${sprImg(m.species)}<b>${esc(m.species)}</b><span>${esc(m.item || 'Sin objeto')}</span><span>${esc(m.ability || '')}</span><small>${esc(m.nature)} · ${m.sp.join('/')}</small><ul>${m.moves.filter(Boolean).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div>`;
  }
  function monHTML(m, foes) {
    const off = [], def = [];
    for (const f of foes) {
      let best = null;
      for (const mv of m.moves) {
        const d = P.moveOf(mv);
        if (!d || d.category === 'Status') continue;
        const x = P.damage(m, f, mv, P.blankField(), 'me');
        if (x && !x.err && x.hi > 0 && (!best || x.pHi > best.pHi)) best = x;
      }
      if (best && best.pHi >= 45) off.push(best);
      let worst = null;
      for (const mv of f.moves) {
        const d = P.moveOf(mv);
        if (!d || d.category === 'Status') continue;
        const x = P.damage(f, m, mv, P.blankField(), 'foe');
        if (x && !x.err && x.hi > 0 && (!worst || x.pHi > worst.pHi)) worst = x;
      }
      if (worst && worst.pHi >= 40) def.push(worst);
    }
    off.sort((a, b) => b.pHi - a.pHi); def.sort((a, b) => b.pHi - a.pHi);
    const line = x => `<li class="dcalc">${esc(x.desc)}</li>`;
    return `<div class="dmonhead">${sprImg(m.species)}<div><h3>${esc(m.species)} @ ${esc(m.item || 'Sin objeto')}</h3><p class="dsub">${esc(m.ability)} · ${esc(P.natLabel(m.nature))} · ${esc(P.spLine(m))}</p></div></div>
      <p><b>Para qué está pensado este reparto.</b> <span class="fill">Qué aguanta, a quién supera en velocidad y qué KOs busca.</span></p>
      ${off.length ? `<p><b>Cálculos ofensivos clave:</b></p><ul>${off.slice(0, 4).map(line).join('')}</ul>` : ''}
      ${def.length ? `<p><b>Cálculos defensivos clave:</b></p><ul>${def.slice(0, 3).map(line).join('')}</ul>` : ''}`;
  }

  /* ---------- pintar ---------- */
  async function getDoc(teamId) { const all = (await DB.get('docs')) || {}; return all[teamId] || null; }
  async function saveDoc(doc) {
    const all = { ...((await DB.get('docs')) || {}) };
    doc.up = Date.now();
    all[doc.teamId] = doc;
    await DB.set('docs', all);
  }
  const blockHTML = (b, edit) => {
    if (b.type === 'page') return `<div class="dblock dpage${b.on ? '' : ' off'}" data-bid="${b.id}">${edit ? ctl(b) : ''}<span>Salto de página</span></div>`;
    return `<div class="dblock d-${b.type}${b.on ? '' : ' off'}" data-bid="${b.id}">${edit ? ctl(b) : ''}<div class="dcontent"${edit && b.type !== 'team' ? ' contenteditable="true" spellcheck="true"' : ''}>${b.html}</div></div>`;
  };
  const ctl = b => `<div class="dctl"><button class="dbtn" data-bon="${b.id}" title="${b.on ? 'Va en el PDF: pulsa para dejarla fuera' : 'No va en el PDF: pulsa para incluirla'}">${b.on ? '👁' : '🚫'}</button><button class="dbtn" data-bup="${b.id}" title="Subir">▲</button><button class="dbtn" data-bdown="${b.id}" title="Bajar">▼</button><button class="dbtn" data-bdel="${b.id}" title="Quitar">×</button></div>`;

  async function render() {
    const el = $('#v-doc');
    const teams = (await P.teams()).filter(t => t.side === 'me');
    if (!V.teamId || !teams.some(t => t.id === V.teamId)) V.teamId = SET.teamId && teams.some(t => t.id === SET.teamId) ? SET.teamId : (teams[0] || {}).id;
    const team = teams.find(t => t.id === V.teamId);
    const head = `<div class="head"><div><h1>Documento <span>de preparación</span></h1><p class="note" style="margin-top:4px">Tu PDF de preparación, listo para retocar. Escribe directamente en la hoja.</p></div>
      <div class="row-btns">${teams.length ? `<select id="dTeam">${teams.map(t => `<option value="${t.id}"${t.id === V.teamId ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>` : ''}</div></div>`;
    if (!team) { el.innerHTML = `${head}<div class="card"><p class="note">Carga tu equipo en el Teambuilder para montar el documento.</p><button class="btn" data-go="equipo" style="margin-top:8px">Ir al Teambuilder</button></div>`; return; }
    let doc = await getDoc(team.id);
    if (!doc) {
      el.innerHTML = `${head}<div class="card"><p>Un documento de preparación guarda y comparte lo importante de un equipo de VGC. Sirve sobre todo en dos casos:</p>
        <ul><li>Te estás preparando en serio para algo importante: un Regional, una subida en el ladder, una partida decisiva.</li><li>Trabajas el equipo con más gente.</li></ul>
        <button class="btn primary" id="dGen">Montar el documento con mis datos</button></div>`;
      return;
    }
    const edit = !V.preview;
    el.innerHTML = `${head}
      <div class="dtools card">
        <div class="seg"><button data-dmode="edit" aria-pressed="${edit}">Editar</button><button data-dmode="view" aria-pressed="${!edit}" title="Ver la hoja como saldrá en el PDF: sin los huecos que no has rellenado">Ver como PDF</button></div>
        <div class="seg"><button data-dstyle="dark" aria-pressed="${doc.style !== 'light'}" title="Oscuro, como el Dashboard">Estilo Macar</button><button data-dstyle="light" aria-pressed="${doc.style === 'light'}" title="Fondo blanco, para imprimir">Estilo clásico</button></div>
        ${edit ? `<select id="dAdd"><option value="">Añadir a la página…</option>${BLOCKS.map(([k, l, t]) => `<option value="${k}" title="${esc(t)}">${l}</option>`).join('')}</select>` : ''}
        <span style="flex:1"></span><span class="note" id="dMsg">${esc(V.msg)}</span>
        <button class="btn" id="dRegen" title="Documento montado otra vez con tus datos de ahora">Volver a generar</button><button class="btn primary" id="dPdf">Guardar PDF</button></div>
      <div class="dsheetwrap"><div class="dsheet ${doc.style === 'light' ? 'light' : 'dark'}${edit ? ' editing' : ' preview'}" id="dSheet">${doc.blocks.filter(b => edit || b.on).map(b => blockHTML(b, edit)).join('')}<p class="dfoot">Hecho con Macar Showdown</p></div></div>`;
  }

  /* ---------- PDF ---------- */
  async function exportPdf() {
    const doc = await getDoc(V.teamId);
    const team = await P.teamById(V.teamId);
    const css = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch (e) { return ''; } }).join('\n');
    const body = doc.blocks.filter(b => b.on).map(b => (b.type === 'page' ? '<div class="pbreak"></div>' : `<div class="dblock d-${b.type}"><div class="dcontent">${b.html}</div></div>`)).join('');
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css}
      @page{size:A4;margin:14mm}html,body{display:block!important;height:auto!important;overflow:visible!important;background:${doc.style === 'light' ? '#fff' : '#050d24'}!important}
      .pbreak{break-after:page}.dsheet{box-shadow:none!important;margin:0!important;width:auto!important;border:0!important}.fill:empty{display:none}
      .dblock{break-inside:avoid}.d-h,.d-title{break-after:avoid}h2,h3{break-after:avoid}</style></head><body><div class="dsheet ${doc.style === 'light' ? 'light' : 'dark'} preview">${body}<p class="dfoot">Hecho con Macar Showdown</p></div></body></html>`;
    V.msg = 'Creando el PDF…'; $('#dMsg').textContent = V.msg;
    const r = await api.savePdf(html, `${team.name} - preparación.pdf`);
    V.msg = r.ok ? 'PDF de preparación guardado.' : (r.why ? `No se ha podido crear el PDF: ${r.why}` : '');
    $('#dMsg').textContent = V.msg;
  }

  /* ---------- eventos ---------- */
  const el = $('#v-doc');
  const persistEdits = async () => {
    const doc = await getDoc(V.teamId);
    if (!doc) return;
    for (const node of $$('.dblock', el)) {
      const b = doc.blocks.find(x => x.id === node.dataset.bid);
      const c = node.querySelector('.dcontent');
      if (b && c && b.type !== 'team') b.html = c.innerHTML;
    }
    await saveDoc(doc);
    V.msg = 'Guardado'; const m = $('#dMsg'); if (m) m.textContent = V.msg;
  };
  el.addEventListener('input', () => { clearTimeout(V.saving); V.saving = setTimeout(persistEdits, 600); });
  el.addEventListener('click', async e => {
    const t = e.target.closest('button');
    if (!t) return;
    const d = t.dataset;
    if (t.id === 'dGen' || t.id === 'dRegen') {
      if (t.id === 'dRegen' && !confirm('Se monta otra vez con tus datos de ahora y se pierden tus cambios. ¿Seguir?')) return;
      const team = await P.teamById(V.teamId);
      V.msg = 'Montando…'; if ($('#dMsg')) $('#dMsg').textContent = V.msg;
      const doc = await generate(team);
      const old = await getDoc(team.id);
      if (old) doc.style = old.style;
      await saveDoc(doc); V.msg = 'Recién montado con tus datos'; render(); return;
    }
    if (t.id === 'dPdf') { clearTimeout(V.saving); await persistEdits(); exportPdf(); return; }
    if (d.dmode) { clearTimeout(V.saving); await persistEdits(); V.preview = d.dmode === 'view'; render(); return; }
    const doc = await getDoc(V.teamId);
    if (!doc) return;
    if (d.dstyle) { await persistEdits(); doc.style = d.dstyle; }
    const i = doc.blocks.findIndex(b => b.id === (d.bon || d.bup || d.bdown || d.bdel));
    if (d.bon) doc.blocks[i].on = !doc.blocks[i].on;
    else if (d.bup && i > 0) [doc.blocks[i - 1], doc.blocks[i]] = [doc.blocks[i], doc.blocks[i - 1]];
    else if (d.bdown && i < doc.blocks.length - 1) [doc.blocks[i + 1], doc.blocks[i]] = [doc.blocks[i], doc.blocks[i + 1]];
    else if (d.bdel) { if (!confirm('¿Quitar este bloque?')) return; doc.blocks.splice(i, 1); }
    else if (!d.dstyle) return;
    // Guardar lo escrito antes de cambiar el orden.
    for (const node of $$('.dblock', el)) { const b = doc.blocks.find(x => x.id === node.dataset.bid); const c = node.querySelector('.dcontent'); if (b && c && b.type !== 'team') b.html = c.innerHTML; }
    await saveDoc(doc); render();
  });
  el.addEventListener('change', async e => {
    if (e.target.id === 'dTeam') { V.teamId = e.target.value; V.msg = ''; render(); return; }
    if (e.target.id === 'dAdd' && e.target.value) {
      await persistEdits();
      const doc = await getDoc(V.teamId);
      const k = e.target.value;
      const html = {
        p: '<p>Escribe aquí…</p>', box: '<h3>Título</h3><p>Escribe aquí…</p>', key: '<p><b>La idea clave.</b></p>',
        list: '<ul><li>Primer punto</li><li>Segundo punto</li></ul>', table: `<table class="dtable2">${[0, 1, 2].map(() => `<tr>${[0, 1, 2].map(() => '<td>&nbsp;</td>').join('')}</tr>`).join('')}</table>`,
        calc: '', page: ''
      }[k];
      e.target.value = '';
      if (k === 'calc') { calcLine(doc); return; }
      doc.blocks.push({ id: nid(), type: k, html, on: true });
      await saveDoc(doc); render();
      setTimeout(() => { const s = $('#dSheet'); if (s) s.lastElementChild.previousElementSibling.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50);
    }
  });
  /** Una línea de cálculo: uno de tus Pokémon contra un rival (con su set más usado), en cualquier sentido. */
  async function calcLine(doc) {
    const team = await P.teamById(V.teamId);
    const sets = P.parseTeam(team.text).sets;
    const U = await P.usage('');
    const rivals = P.usageRank(U).slice(0, 80).map(n => P.calcSpecies(n)).filter(Boolean);
    const box = $('#modalBox');
    box.onclick = box.onchange = null;
    const draw = () => {
      const dir = $('#clDir') ? $('#clDir').value : 'off';
      const mi = $('#clMe') ? +$('#clMe').value : 0;
      const rv = $('#clRival') ? $('#clRival').value : rivals[0];
      const me = sets[mi], foe = rv ? (P.usageSet(U, rv) || P.blankMon(rv)) : null;
      const att = dir === 'off' ? me : foe, def = dir === 'off' ? foe : me;
      const mvs = att ? att.moves.filter(x => x && (P.moveOf(x) || {}).category !== 'Status') : [];
      const mv = $('#clMv') && mvs.includes($('#clMv').value) ? $('#clMv').value : mvs[0];
      const r = att && def && mv ? P.damage(att, def, mv, P.blankField(), dir === 'off' ? 'me' : 'foe') : null;
      box.innerHTML = `<button class="btn x" id="mClose">Cerrar</button><h2>Línea de cálculo</h2>
        <div class="ed"><label class="field">Sentido<select id="clDir"><option value="off"${dir === 'off' ? ' selected' : ''}>Tu ataque</option><option value="def"${dir === 'def' ? ' selected' : ''}>Te atacan (aguante)</option></select></label>
          <label class="field">Tu Pokémon<select id="clMe">${sets.map((s, i) => `<option value="${i}"${i === mi ? ' selected' : ''}>${esc(s.species)}</option>`).join('')}</select></label>
          <label class="field">Rival (set más usado)<input id="clRival" list="dlSpecies" value="${esc(rv || '')}"></label>
          <label class="field">Movimiento<select id="clMv">${mvs.map(x => `<option${x === mv ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></label></div>
        <p class="dcalcprev">${r && !r.err ? esc(r.desc) : '—'}</p>
        <div class="row-btns"><span style="flex:1"></span><button class="btn primary" id="clOk"${r && !r.err ? '' : ' disabled'}>Añadir a la página</button></div>`;
      $('#mClose').onclick = () => { $('#modal').classList.add('hide'); };
      box.dataset.line = r && !r.err ? r.desc : '';
    };
    P.datalists();
    draw();
    box.onchange = draw;
    box.onclick = async e => {
      if (e.target.id !== 'clOk') return;
      doc.blocks.push({ id: nid(), type: 'calc', html: `<ul><li class="dcalc">${esc(box.dataset.line)}</li></ul>`, on: true });
      await saveDoc(doc);
      $('#modal').classList.add('hide'); box.onclick = box.onchange = null;
      render();
    };
    $('#modal').classList.remove('hide');
  }

  VIEWS.doc = render;
  return { render, generate };
})();
