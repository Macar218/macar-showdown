'use strict';
/*
 * Macar Showdown · Documento de preparación (prep doc).
 * Misma estructura que un prep doc de VGC: portada con tu equipo, historia y concepto, sets y cálculos clave de
 * cada Pokémon y guía de matchups (con récord, con qué ganas, claves y replays). Hojas A4 editables: texto, cajas,
 * ideas clave, listas, tablas (filas, columnas y anchos), imágenes (alineadas y con tamaño), cálculos y páginas.
 * Se guarda en la carpeta de datos (docs.json) y se exporta a PDF.
 */
/* global P, DB, api, $, $$, esc, spr, VIEWS, Stats, M, teamOf, SET */

const Doc = (() => {
  const V = { teamId: null, preview: false, saving: null, msg: '', page: null, sel: null, cell: null, regen: 0 };
  const ADD = [
    ['p', 'Texto normal', 'Un hueco para escribir'],
    ['box', 'Caja con título', 'Un recuadro con su título'],
    ['key', 'Idea clave', 'Una idea clave, en amarillo claro'],
    ['list', 'Lista', 'Una lista para ir apuntando'],
    ['table', 'Tabla…', 'Insertar una tabla del tamaño que quieras'],
    ['img', 'Imagen…', 'Una imagen de tu ordenador (también puedes pegarla con Ctrl+V)'],
    ['sprite', 'Sprites…', 'Sprites de Pokémon: en la línea del texto o en una fila'],
    ['calc', 'Otro cálculo', 'Una línea de cálculo de daño'],
    ['page', 'Página nueva', 'Lo que sigue, en otra hoja']
  ];
  const nid = p => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const block = (type, html, extra = {}) => ({ id: nid('b'), type, html, on: true, ...extra });
  const page = blocks => ({ id: nid('p'), blocks });
  const fill = t => `<span class="fill">${esc(t)}</span>`;
  const pctTxt = (w, n) => (n ? `${w}–${n - w} (${Math.round((w / n) * 100)}%)` : '—');

  /* ================= montar el documento con tus datos ================= */
  async function generate(team) {
    const sets = P.parseTeam(team.text).sets;
    const [U, T] = await Promise.all([P.usage(''), P.tour()]);
    const ms = Stats.usable(M).filter(s => teamOf(s) === team.id);
    const r = Stats.compute(ms);
    const pages = [];

    // 1. Portada: tu equipo
    pages.push(page([
      block('title', `<h1>${esc(team.name)}</h1><p class="dsub">Documento de preparación · Pokémon Champions VGC · Reg M-C · ${new Date().toLocaleDateString((typeof I18N !== 'undefined' && I18N.lang === 'en' ? 'en-GB' : 'es-ES'), { day: 'numeric', month: 'long', year: 'numeric' })}${SET.showdownName ? ` · ${esc(SET.showdownName.split(',')[0])}` : ''}</p>`),
      block('kv', `<p><b>Pokepaste del equipo:</b> ${fill('pega aquí el enlace')}</p><p><b>Código de alquiler:</b> ${fill('—')}</p>${ms.length ? `<p><b>Récord con Macar Showdown:</b> ${pctTxt(r.w, r.n)} en ${r.n} partidas${r.eloNow ? ` · ELO ${r.eloNow}` : ''}</p>` : ''}`),
      block('h', '<h2>Mi equipo</h2>'),
      block('team', teamHTML(sets)),
      block('box', `<h3>Historia y concepto del equipo</h3>
        <p><b>Por qué este equipo.</b> ${fill('Qué viste en el metajuego y qué querías aprovechar.')}</p>
        <p><b>Cómo gana.</b> ${fill('El plan principal y los alternativos. Sus puntos fuertes y débiles.')}</p>
        <p><b>Gracias a…</b> ${fill('Quién te ha ayudado o de dónde salió la idea.')}</p>`),
      block('hint', '<p><b>Huecos para rellenar:</b> lo que está en gris cursiva no sale en el PDF hasta que lo escribas. Cada parte sale en el PDF: quítala con el ojo (👁) o con × si no la quieres.</p>', { on: false })
    ]));

    // 2. Sets y cálculos clave
    const foes = threats(U, T, r);
    const speedNote = [];
    if (sets.some(m => m.moves.some(x => P.toID(x) === 'tailwind'))) speedNote.push('Tu equipo lleva Tailwind: la Velocidad cuenta la mitad con él puesto.');
    if (sets.some(m => m.moves.some(x => P.toID(x) === 'trickroom'))) speedNote.push('Tu equipo lleva Trick Room: los lentos no gastan en Velocidad.');
    let cur = [block('h', '<h2>Sets y cálculos clave de cada Pokémon</h2>')];
    if (speedNote.length) cur.push(block('key', `<p>${speedNote.map(esc).join('<br>')}</p>`));
    sets.forEach((m, i) => {
      cur.push(block('mon', monHTML(m, foes)));
      if ((i % 2 === 1 || i === sets.length - 1) && cur.length) { pages.push(page(cur)); cur = []; }
    });

    // 3. Guía de matchups
    const mu = [block('h', '<h2>Guía de matchups</h2>')];
    if (r.oppPreview.length) {
      mu.push(block('p', `<p><b>Lo más jugado.</b> Lo que más te encuentras: ${r.oppPreview.slice(0, 8).map(x => `${esc(x.key)} (${x.n})`).join(', ')}. Cómo te suelen abrir: ${r.oppLeads.slice(0, 3).map(x => `${esc(x.key)} (${x.n})`).join(' · ') || '—'}.</p>`));
    }
    const rivals = (await P.teams()).filter(t => t.side === 'foe');
    let n = 0;
    for (const t of rivals.slice(0, 8)) { mu.push(block('match', rivalTeamHTML(t, ms))); n++; }
    for (const x of r.oppPreview.slice(0, Math.max(0, 6 - n))) mu.push(block('match', rivalMonHTML(x.key, ms)));
    if (mu.length === 1) mu.push(block('box', `<h3>Equipo rival</h3><p>${fill('Añade equipos rivales en Mi PC → Team Box (o juega partidas con este equipo) y aquí salen sus matchups con tu récord, con qué ganas y sus replays.')}</p>`));
    mu.push(block('box', `<h3>Notas</h3><p>${fill('Escribe aquí…')}</p>`));
    pages.push(page(mu));
    if ((typeof I18N !== 'undefined' && I18N.lang) === 'en') for (const pg of pages) for (const b of pg.blocks) b.html = I18N.trHTML(b.html);
    return { v: 2, teamId: team.id, style: 'dark', zoom: 1, pages, up: Date.now() };
  }
  function threats(U, T, r) {
    const seen = r.oppPreview.slice(0, 8).map(x => P.calcSpecies(x.key)).filter(Boolean);
    const fromTour = T ? P.tourRank(T).slice(0, 12).map(id => P.calcSpecies(id)).filter(Boolean) : P.usageRank(U).slice(0, 12).map(n => P.calcSpecies(n)).filter(Boolean);
    const list = [...seen, ...fromTour].map(sp => P.tourSet(T, U, sp) || P.usageSet(U, sp) || P.blankMon(sp));
    return list.filter((m, i, a) => a.findIndex(z => P.baseSpecies(z.species) === P.baseSpecies(m.species)) === i).slice(0, 12);
  }
  function teamHTML(sets) {
    return `<div class="dteam">${sets.map(m => { const st = P.stats(m) || {}; return `<div class="dmon">${spr(m.species)}<b>${esc(m.species)}</b><span>${esc(m.item || 'Sin objeto')}</span><span>${esc(m.ability || '')}</span><small>${esc(m.nature)} · ${m.sp.join('/')}</small><small>${P.STATS.map(s => st[s]).join(' / ')}</small><ul>${m.moves.filter(Boolean).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`; }).join('')}</div>`;
  }
  function monHTML(m, foes) {
    const off = [], def = [];
    for (const f of foes) {
      let best = null, worst = null;
      for (const mv of m.moves) { const x = P.damage(m, f, mv, P.blankField(), 'me'); if (x && !x.err && x.hi > 0 && (!best || x.pHi > best.pHi)) best = x; }
      for (const mv of f.moves) { const x = P.damage(f, m, mv, P.blankField(), 'foe'); if (x && !x.err && x.hi > 0 && (!worst || x.pHi > worst.pHi)) worst = x; }
      if (best && best.pHi >= 45) off.push(best);
      if (worst && worst.pHi >= 40) def.push(worst);
    }
    off.sort((a, b) => b.pHi - a.pHi); def.sort((a, b) => b.pHi - a.pHi);
    const line = x => `<li class="dcalc">${esc(x.desc)}</li>`;
    return `<div class="dmonhead">${spr(m.species)}<div><h3>${esc(m.species)} @ ${esc(m.item || 'Sin objeto')}</h3><p class="dsub">${esc(m.ability)} · ${esc(P.natLabel(m.nature))} · ${esc(P.spLine(m))} · ${m.moves.filter(Boolean).map(esc).join(' / ')}</p></div></div>
      <p><b>Para qué está pensado este reparto.</b> ${fill('Qué aguanta, a quién supera en velocidad y qué KOs busca.')}</p>
      ${off.length ? `<p><b>Cálculos ofensivos clave:</b></p><ul>${off.slice(0, 4).map(line).join('')}</ul>` : ''}
      ${def.length ? `<p><b>Cálculos defensivos clave:</b></p><ul>${def.slice(0, 3).map(line).join('')}</ul>` : ''}`;
  }
  /** Partidas contra un equipo rival: las que comparten al menos 4 de sus Pokémon. */
  function vsTeam(ms, ids) {
    return ms.filter(s => { const pv = Stats.theirs(s).preview.map(x => P.toID(P.baseSpecies(x))); return ids.filter(i => pv.includes(i)).length >= Math.min(4, ids.length); });
  }
  function matchupBody(sub) {
    const rr = Stats.compute(sub);
    const winLeads = (() => { const m = new Map(); for (const s of sub) if (s.result === 'win') { const k = Stats.leadKey(Stats.mine(s).leads); m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2); })();
    const rep = res => sub.filter(s => s.result === res && s.replay).slice(0, 4).map(s => `<a href="${esc(s.replay)}">${esc(s.replay.replace('https://replay.pokemonshowdown.com/', ''))}</a>`).join(' · ');
    return `<p><b>Récord:</b> ${sub.length ? pctTxt(rr.w, rr.n) : 'aún sin partidas'}${rr.oppLeads[0] ? ` · <b>Te abre con:</b> ${esc(rr.oppLeads[0].key)}` : ''}</p>
      <p><b>Ganas con:</b> ${winLeads.length ? winLeads.map(([k, c]) => `${esc(k)} (${c})`).join(' · ') : fill('tu lead y lo que traes atrás')}</p>
      <p><b>Claves para ganar el matchup.</b> ${fill('La idea clave.')}</p>
      <p class="drep"><b>Replays ganadas:</b> ${rep('win') || '—'}</p><p class="drep"><b>Replays perdidas:</b> ${rep('loss') || '—'}</p>`;
  }
  function rivalTeamHTML(t, ms) {
    const S = P.parseTeam(t.text).sets;
    const ids = S.map(m => P.toID(P.baseSpecies(m.species)));
    return `<h3>Equipo rival: ${esc(t.name)}</h3><div class="drow">${S.map(m => spr(m.species, 'sm')).join('')}</div>${matchupBody(vsTeam(ms, ids))}`;
  }
  function rivalMonHTML(name, ms) {
    return `<h3>${spr(name, 'sm')} ${esc(name)}</h3>${matchupBody(ms.filter(s => Stats.theirs(s).preview.includes(name)))}`;
  }

  /* ================= guardar ================= */
  async function getDoc(teamId) {
    const all = (await DB.get('docs')) || {};
    const d = all[teamId];
    if (!d) return null;
    if (!d.pages) { // documentos antiguos: una lista de bloques con saltos de página
      const pages = [[]];
      for (const b of d.blocks || []) { if (b.type === 'page') pages.push([]); else pages[pages.length - 1].push(b); }
      d.pages = pages.filter(p => p.length).map(page);
      delete d.blocks; d.v = 2;
    }
    return d;
  }
  async function saveDoc(doc) {
    const all = { ...((await DB.get('docs')) || {}) };
    doc.up = Date.now();
    all[doc.teamId] = doc;
    await DB.set('docs', all);
  }
  /** Lo escrito en la hoja vuelve al documento. */
  function harvest(doc) {
    for (const node of $$('.dblock', $('#v-doc'))) {
      const b = findBlock(doc, node.dataset.bid);
      if (!b) continue;
      if (b.type === 'img') { b.caption = (node.querySelector('figcaption') || {}).innerText || ''; continue; }
      const c = node.querySelector('.dcontent');
      if (c && b.type !== 'team') b.html = c.innerHTML;
    }
  }
  const findBlock = (doc, id) => { for (const p of doc.pages) { const b = p.blocks.find(x => x.id === id); if (b) return b; } return null; };
  const whereBlock = (doc, id) => { for (const p of doc.pages) { const i = p.blocks.findIndex(x => x.id === id); if (i >= 0) return { p, i }; } return null; };
  async function persist() {
    const doc = await getDoc(V.teamId);
    if (!doc) return;
    harvest(doc);
    await saveDoc(doc);
    V.msg = 'Guardado'; const m = $('#dMsg'); if (m) m.textContent = V.msg;
  }

  /* ================= pintar ================= */
  const ctl = b => `<div class="dctl"><button class="dbtn" data-bon="${b.id}" title="${b.on ? 'Va en el PDF: pulsa para dejarla fuera' : 'No va en el PDF: pulsa para incluirla'}">${b.on ? '👁' : '🚫'}</button><button class="dbtn" data-bup="${b.id}" title="Subir">▲</button><button class="dbtn" data-bdown="${b.id}" title="Bajar">▼</button><button class="dbtn" data-bdel="${b.id}" title="Quitar">×</button></div>`;
  function blockHTML(b, edit) {
    if (b.type === 'hint' && !edit) return '';
    const cls = `dblock d-${b.type}${b.on ? '' : ' off'}${V.sel === b.id ? ' sel' : ''}`;
    if (b.type === 'img') {
      return `<figure class="${cls} dimg al-${b.align || 'center'}" data-bid="${b.id}" style="width:${b.align === 'inline' ? 'auto' : `${b.w || 50}%`}">${edit ? ctl(b) : ''}<img src="${b.src}" alt=""${b.align === 'inline' ? ` style="width:${b.px || 160}px"` : ''}>${edit ? '<i class="dres" title="Arrastra para cambiar el tamaño"></i>' : ''}<figcaption${edit ? ' contenteditable="true"' : ''}>${esc(b.caption || '')}</figcaption></figure>`;
    }
    return `<div class="${cls}" data-bid="${b.id}">${edit ? ctl(b) : ''}<div class="dcontent"${edit && b.type !== 'team' ? ' contenteditable="true" spellcheck="true"' : ''}>${b.html}</div>${edit && b.type === 'table' ? '<span class="tbhint">Arrastra el borde de una columna para cambiar su ancho</span>' : ''}</div>`;
  }
  function selTools(doc) {
    const b = V.sel ? findBlock(doc, V.sel) : null;
    if (b && b.type === 'img') {
      const al = [['left', 'A la izquierda', 'A la izquierda, con el texto al lado'], ['right', 'A la derecha', 'A la derecha, con el texto al lado'], ['center', 'Centrada', 'Centrada, sola en su línea'], ['inline', 'En línea', 'En la línea del texto']];
      return `<div class="dsel"><span class="note">Imagen:</span><div class="seg">${al.map(([k, l, t]) => `<button data-ialign="${k}" title="${t}" aria-pressed="${(b.align || 'center') === k}">${l}</button>`).join('')}</div>
        <label class="note">Tamaño <input type="range" min="10" max="100" step="5" value="${b.w || 50}" data-isize="1"></label><button class="btn sm danger" data-bdel="${b.id}" title="Quitar la imagen (Supr)">Quitar la imagen</button></div>`;
    }
    if (V.cell) {
      return `<div class="dsel"><span class="note">Tabla:</span><button class="btn sm" data-tb="rowUp">Fila encima</button><button class="btn sm" data-tb="rowDown">Fila debajo</button><button class="btn sm" data-tb="colLeft">Columna a la izquierda</button><button class="btn sm" data-tb="colRight">Columna a la derecha</button><button class="btn sm" data-tb="rowDel">Quitar esta fila</button><button class="btn sm" data-tb="colDel">Quitar esta columna</button><button class="btn sm danger" data-tb="tableDel">Quitar la tabla entera</button></div>`;
    }
    return '';
  }

  async function render() {
    const el = $('#v-doc');
    const teams = (await P.teams()).filter(t => t.side === 'me');
    if (!V.teamId || !teams.some(t => t.id === V.teamId)) V.teamId = SET.teamId && teams.some(t => t.id === SET.teamId) ? SET.teamId : (teams[0] || {}).id;
    const team = teams.find(t => t.id === V.teamId);
    const head = `<div class="head"><div><h1>Documento <span>de preparación</span></h1><p class="note" style="margin-top:4px">Tu PDF de preparación, listo para retocar. Escribe directamente en la hoja.</p></div>
      <div class="row-btns">${teams.length ? `<select id="dTeam" title="Todos los equipos">${teams.map(t => `<option value="${t.id}"${t.id === V.teamId ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>` : ''}</div></div>`;
    if (!team) { el.innerHTML = `${head}<div class="card"><p class="note">Carga tu equipo en el Teambuilder para ver aquí los sets.</p><button class="btn" data-go="equipo" style="margin-top:8px">Ir al Teambuilder</button></div>`; return; }
    const doc = await getDoc(team.id);
    if (!doc) {
      el.innerHTML = `${head}<div class="card dintro"><h2>Documento de preparación</h2><p>Un prep doc guarda y comparte lo importante de un equipo de VGC. Sirve sobre todo en dos casos:</p>
        <ul><li>Te estás preparando en serio para algo importante: un Regional, una subida en el ladder, una partida decisiva.</li><li>Trabajas el equipo con más gente.</li></ul>
        <p class="note">Se monta con tus datos: tu equipo, cálculos clave contra lo que más se ve en torneos, tus matchups con récord y replays. Luego lo retocas escribiendo en la hoja.</p>
        <button class="btn primary" id="dGen">Montar el documento con mis datos</button></div>`;
      return;
    }
    const edit = !V.preview;
    const zoom = doc.zoom || 1;
    el.innerHTML = `${head}
      <div class="dtools card">
        <div class="seg"><button data-dmode="edit" aria-pressed="${edit}" title="Volver a editar">Editar</button><button data-dmode="view" aria-pressed="${!edit}" title="Ver la hoja como saldrá en el PDF: sin los huecos que no has rellenado">Ver como PDF</button></div>
        <div class="seg"><button data-dstyle="dark" aria-pressed="${doc.style !== 'light'}" title="Oscuro, como el Dashboard">Estilo Macar</button><button data-dstyle="light" aria-pressed="${doc.style === 'light'}" title="Fondo blanco, para imprimir">Estilo clásico</button></div>
        ${edit ? `<select id="dAdd" title="Añadir a la página"><option value="">Añadir a la página…</option>${ADD.map(([k, l, t]) => `<option value="${k}" title="${esc(t)}">${l}</option>`).join('')}</select>` : ''}
        <div class="dzoom" title="Zoom de la hoja"><button class="dbtn" data-dzoom="-">−</button><span>${Math.round(zoom * 100)}%</span><button class="dbtn" data-dzoom="+">+</button><button class="dbtn" data-dzoom="fit" title="La hoja a todo el ancho">Ancho</button><button class="dbtn" data-dzoom="page" title="La hoja entera en pantalla">Hoja</button></div>
        <span style="flex:1"></span><span class="note" id="dMsg">${esc(V.msg)}</span>
        <button class="btn${V.regen ? ' danger sure' : ''}" id="dRegen" title="Documento montado otra vez con tus datos de ahora">${V.regen ? 'Pulsa otra vez: se pierden tus cambios' : 'Volver a generar'}</button><button class="btn primary" id="dPdf">Guardar PDF</button>
        ${edit ? selTools(doc) : ''}</div>
      <div class="dsheetwrap" id="dWrap"><div class="dpages" style="zoom:${zoom}">${doc.pages.map((p, i) => `<div class="dsheet ${doc.style === 'light' ? 'light' : 'dark'}${edit ? ' editing' : ' preview'}${V.page === p.id ? ' cur' : ''}" data-pid="${p.id}">
        ${edit ? `<div class="dpagebar"><span>Página ${i + 1} de ${doc.pages.length}</span>${doc.pages.length > 1 ? `<button class="dbtn" data-pdel="${p.id}" title="Quitar esta página">Quitar esta página</button>` : ''}</div>` : ''}
        ${p.blocks.filter(b => edit || b.on).map(b => blockHTML(b, edit)).join('')}
        ${i === doc.pages.length - 1 ? '<p class="dfoot">Hecho con Macar Showdown</p>' : ''}</div>`).join('')}</div></div>
      <input type="file" id="dImgFile" accept="image/*" class="hide">`;
    if (edit) bindSheet();
  }

  /* ================= imágenes ================= */
  /** Imagen a data URL, reducida a 1400 px de ancho como mucho. */
  function readImage(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onerror = rej;
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, 1400 / img.width);
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88));
        };
        img.onerror = rej;
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  async function addImage(file, afterId) {
    if (!file || !/^image\//.test(file.type)) return;
    const src = await readImage(file);
    const doc = await getDoc(V.teamId);
    harvest(doc);
    const b = block('img', '', { src, align: 'center', w: 50, caption: '' });
    insertBlock(doc, b, afterId);
    V.sel = b.id;
    await saveDoc(doc); render();
  }
  function insertBlock(doc, b, afterId) {
    const w = afterId ? whereBlock(doc, afterId) : null;
    if (w) { w.p.blocks.splice(w.i + 1, 0, b); return; }
    const p = doc.pages.find(x => x.id === V.page) || doc.pages[doc.pages.length - 1];
    p.blocks.push(b);
  }

  /* ================= tablas ================= */
  function tableHTML(rows, cols) {
    return `<table class="dtable2"><colgroup>${Array.from({ length: cols }, () => `<col style="width:${(100 / cols).toFixed(2)}%">`).join('')}</colgroup><tbody>${Array.from({ length: rows }, (_, r) => `<tr>${Array.from({ length: cols }, () => (r === 0 ? '<th>&nbsp;</th>' : '<td>&nbsp;</td>')).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function tableOp(op) {
    const cell = V.cell;
    if (!cell || !document.contains(cell)) return false;
    const table = cell.closest('table'), tr = cell.closest('tr');
    const ci = [...tr.children].indexOf(cell);
    const rows = [...table.rows];
    const blank = r => (r === 0 ? 'th' : 'td');
    if (op === 'rowUp' || op === 'rowDown') {
      const n = tr.cloneNode(true);
      [...n.children].forEach(c => { c.innerHTML = '&nbsp;'; });
      tr.parentNode.insertBefore(n, op === 'rowUp' ? tr : tr.nextSibling);
    } else if (op === 'colLeft' || op === 'colRight') {
      rows.forEach((r, ri) => { const c = document.createElement(blank(ri)); c.innerHTML = '&nbsp;'; r.insertBefore(c, op === 'colLeft' ? r.children[ci] : r.children[ci].nextSibling); });
      const cg = table.querySelector('colgroup');
      if (cg) { const n = cg.children.length + 1; cg.innerHTML = Array.from({ length: n }, () => `<col style="width:${(100 / n).toFixed(2)}%">`).join(''); }
    } else if (op === 'rowDel') { if (rows.length > 1) tr.remove(); }
    else if (op === 'colDel') {
      if (tr.children.length > 1) { rows.forEach(r => r.children[ci] && r.children[ci].remove()); const cg = table.querySelector('colgroup'); if (cg && cg.children[ci]) cg.children[ci].remove(); }
    } else if (op === 'tableDel') { const b = table.closest('.dblock'); V.cell = null; return { del: b ? b.dataset.bid : null }; }
    return true;
  }

  /* ================= PDF ================= */
  async function exportPdf() {
    const doc = await getDoc(V.teamId);
    const team = await P.teamById(V.teamId);
    const css = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch (e) { return ''; } }).join('\n');
    const pages = doc.pages.map(p => p.blocks.filter(b => b.on && b.type !== 'hint')).filter(bs => bs.length);
    const body = pages.map((bs, i) => `<div class="dsheet ${doc.style === 'light' ? 'light' : 'dark'} preview pdfpage">${bs.map(b => blockHTML(b, false)).join('')}${i === pages.length - 1 ? '<p class="dfoot">Hecho con Macar Showdown</p>' : ''}</div>`).join('');
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css}
      @page{size:A4;margin:0}html,body{display:block!important;height:auto!important;overflow:visible!important;margin:0;background:${doc.style === 'light' ? '#fff' : '#050d24'}!important}
      .pdfpage{box-shadow:none!important;margin:0!important;width:210mm!important;min-height:297mm;border:0!important;border-radius:0!important;break-after:page;box-sizing:border-box;padding:16mm 16mm!important}
      .pdfpage:last-child{break-after:auto}.dblock{break-inside:avoid}h2,h3{break-after:avoid}.fill{display:none}</style></head><body>${body}</body></html>`;
    V.msg = 'Creando el PDF…'; $('#dMsg').textContent = V.msg;
    const r = await api.savePdf(html, `${team.name} - preparación.pdf`);
    V.msg = r.ok ? 'PDF de preparación guardado.' : (r.why ? `No se ha podido crear el PDF: ${r.why}` : '');
    $('#dMsg').textContent = V.msg;
  }

  /* ================= eventos ================= */
  const el = $('#v-doc');
  function bindSheet() {
    // Redimensionar imágenes con la esquina y columnas de tablas con el borde.
    for (const h of $$('.dres', el)) {
      h.onpointerdown = async e => {
        e.preventDefault(); e.stopPropagation();
        const fig = h.closest('.dimg'), sheet = fig.closest('.dsheet');
        const doc = await getDoc(V.teamId); harvest(doc);
        const b = findBlock(doc, fig.dataset.bid);
        const zoom = doc.zoom || 1, x0 = e.clientX, w0 = fig.getBoundingClientRect().width / zoom, sw = sheet.clientWidth;
        const right = b.align === 'right';
        const move = ev => { const w = Math.max(40, w0 + ((right ? x0 - ev.clientX : ev.clientX - x0) / zoom)); if (b.align === 'inline') { b.px = Math.round(w); fig.querySelector('img').style.width = `${b.px}px`; } else { b.w = Math.max(10, Math.min(100, Math.round((w / sw) * 100))); fig.style.width = `${b.w}%`; } };
        const up = async () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); await saveDoc(doc); };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
      };
    }
  }
  el.addEventListener('pointerdown', async e => {
    const cell = e.target.closest && e.target.closest('.d-table th, .d-table td');
    if (!cell) return;
    const r = cell.getBoundingClientRect();
    if (r.right - e.clientX > 6) return; // solo el borde derecho de la celda
    e.preventDefault();
    const table = cell.closest('table'), ci = [...cell.parentNode.children].indexOf(cell);
    const cols = table.querySelectorAll('col');
    if (!cols[ci] || !cols[ci + 1]) return;
    const tw = table.getBoundingClientRect().width, x0 = e.clientX;
    const a0 = parseFloat(cols[ci].style.width), b0 = parseFloat(cols[ci + 1].style.width);
    const move = ev => { const d = ((ev.clientX - x0) / tw) * 100; const a = Math.max(5, Math.min(a0 + b0 - 5, a0 + d)); cols[ci].style.width = `${a.toFixed(2)}%`; cols[ci + 1].style.width = `${(a0 + b0 - a).toFixed(2)}%`; };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); persist(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });
  el.addEventListener('mousemove', e => { const c = e.target.closest && e.target.closest('.d-table th, .d-table td'); if (c) c.style.cursor = c.getBoundingClientRect().right - e.clientX <= 6 ? 'col-resize' : ''; });
  el.addEventListener('input', () => { clearTimeout(V.saving); V.saving = setTimeout(persist, 600); });
  el.addEventListener('focusin', e => {
    if (e.target.closest && e.target.closest('.dtools')) return; // la barra de opciones no cambia lo elegido
    const sheet = e.target.closest && e.target.closest('.dsheet');
    if (sheet) V.page = sheet.dataset.pid;
    const cell = e.target.closest && e.target.closest('.d-table th, .d-table td');
    const hadCell = !!V.cell;
    V.cell = cell || (e.target.closest && e.target.closest('.d-table') ? V.cell : null);
    if (!!V.cell !== hadCell) { const doc = getDoc(V.teamId); doc.then(d => { const s = $('.dsel', el); const html = d ? selTools(d) : ''; if (s) s.outerHTML = html || '<span class="dsel-empty"></span>'; else if (html) $('.dtools', el).insertAdjacentHTML('beforeend', html); }); }
  });
  el.addEventListener('click', e => {
    const sheet = e.target.closest('.dsheet');
    if (sheet) V.page = sheet.dataset.pid;
    const fig = e.target.closest('.dimg');
    if (fig && !e.target.closest('.dctl') && V.sel !== fig.dataset.bid) { persist().then(() => { V.sel = fig.dataset.bid; render(); }); }
    else if (!fig && V.sel && sheet && !e.target.closest('.dtools')) { V.sel = null; persist().then(render); }
  });
  el.addEventListener('click', async e => {
    const t = e.target.closest('button');
    if (!t) return;
    const d = t.dataset;
    if (t.id === 'dGen') { const team = await P.teamById(V.teamId); V.msg = 'Montando…'; const doc = await generate(team); await saveDoc(doc); V.msg = 'Recién montado con tus datos'; render(); return; }
    if (t.id === 'dRegen') {
      if (!V.regen) { V.regen = 1; render(); setTimeout(() => { if (V.regen) { V.regen = 0; render(); } }, 4000); return; }
      V.regen = 0;
      const team = await P.teamById(V.teamId);
      const old = await getDoc(team.id);
      const doc = await generate(team);
      if (old) { doc.style = old.style; doc.zoom = old.zoom; }
      await saveDoc(doc); V.msg = 'Documento montado otra vez con tus datos de ahora'; render(); return;
    }
    if (t.id === 'dPdf') { clearTimeout(V.saving); await persist(); exportPdf(); return; }
    if (d.dmode) { clearTimeout(V.saving); await persist(); V.preview = d.dmode === 'view'; V.sel = null; V.cell = null; render(); return; }
    const doc = await getDoc(V.teamId);
    if (!doc) return;
    harvest(doc);
    if (d.dstyle) doc.style = d.dstyle;
    else if (d.dzoom) {
      const z = doc.zoom || 1;
      const wrap = $('#dWrap');
      if (d.dzoom === '+') doc.zoom = Math.min(2, +(z + 0.1).toFixed(2));
      else if (d.dzoom === '-') doc.zoom = Math.max(0.4, +(z - 0.1).toFixed(2));
      else if (d.dzoom === 'fit') doc.zoom = +((wrap.clientWidth - 40) / 820).toFixed(2);
      else if (d.dzoom === 'page') doc.zoom = +Math.min((wrap.clientWidth - 40) / 820, (window.innerHeight - 220) / 1160).toFixed(2);
    } else if (d.pdel) { if (!confirm('¿Quitar esta página con todo lo que tiene?')) return; doc.pages = doc.pages.filter(p => p.id !== d.pdel); }
    else if (d.ialign || d.tb) {
      if (d.tb) { const r = tableOp(d.tb); if (!r) return; harvest(doc); if (r.del) { const w = whereBlock(doc, r.del); if (w) w.p.blocks.splice(w.i, 1); } }
      else { const b = findBlock(doc, V.sel); if (b) b.align = d.ialign; }
    } else {
      const id = d.bon || d.bup || d.bdown || d.bdel;
      const w = id && whereBlock(doc, id);
      if (!w) return;
      const { p, i } = w;
      if (d.bon) p.blocks[i].on = !p.blocks[i].on;
      else if (d.bup) { if (i > 0) [p.blocks[i - 1], p.blocks[i]] = [p.blocks[i], p.blocks[i - 1]]; else { const pi = doc.pages.indexOf(p); if (pi > 0) doc.pages[pi - 1].blocks.push(p.blocks.splice(i, 1)[0]); } }
      else if (d.bdown) { if (i < p.blocks.length - 1) [p.blocks[i + 1], p.blocks[i]] = [p.blocks[i], p.blocks[i + 1]]; else { const pi = doc.pages.indexOf(p); if (pi < doc.pages.length - 1) doc.pages[pi + 1].blocks.unshift(p.blocks.splice(i, 1)[0]); } }
      else if (d.bdel) { p.blocks.splice(i, 1); if (V.sel === id) V.sel = null; }
    }
    await saveDoc(doc); render();
  });
  el.addEventListener('input', e => {
    if (!e.target.dataset || !e.target.dataset.isize) return;
    const fig = V.sel && $(`.dimg[data-bid="${V.sel}"]`, el);
    if (fig) fig.style.width = `${e.target.value}%`;
  });
  el.addEventListener('change', async e => {
    const t = e.target;
    if (t.id === 'dTeam') { V.teamId = t.value; V.msg = ''; V.sel = null; render(); return; }
    if (t.dataset && t.dataset.isize) { const doc = await getDoc(V.teamId); harvest(doc); const b = findBlock(doc, V.sel); if (b) { b.w = +t.value; await saveDoc(doc); } return; }
    if (t.id === 'dImgFile') { const f = t.files[0]; t.value = ''; addImage(f, V.sel); return; }
    if (t.id !== 'dAdd' || !t.value) return;
    const k = t.value; t.value = '';
    await persist();
    const doc = await getDoc(V.teamId);
    if (k === 'img') { $('#dImgFile').click(); return; }
    if (k === 'calc') { calcLine(doc); return; }
    if (k === 'table') { tablePicker(doc); return; }
    if (k === 'sprite') { spritePicker(doc); return; }
    if (k === 'page') { const p = page([block('p', '<p>Escribe aquí…</p>')]); const at = doc.pages.findIndex(x => x.id === V.page); doc.pages.splice(at >= 0 ? at + 1 : doc.pages.length, 0, p); V.page = p.id; }
    else {
      const html = { p: '<p>Escribe aquí…</p>', box: '<h3>Título</h3><p>Escribe aquí…</p>', key: '<p><b>La idea clave.</b></p>', list: '<ul><li>Primer punto</li><li>Segundo punto</li></ul>' }[k];
      insertBlock(doc, block(k, html));
    }
    await saveDoc(doc); render();
  });
  // Pegar una imagen dentro de la hoja.
  el.addEventListener('paste', e => {
    const item = [...((e.clipboardData && e.clipboardData.items) || [])].find(x => /^image\//.test(x.type));
    if (!item) return;
    e.preventDefault();
    const b = e.target.closest && e.target.closest('.dblock');
    addImage(item.getAsFile(), b ? b.dataset.bid : null);
  });
  document.addEventListener('keydown', async e => {
    if (e.key !== 'Delete' || !V.sel || !$('#v-doc').classList.contains('on') || /INPUT|TEXTAREA/.test(document.activeElement.tagName) || document.activeElement.isContentEditable) return;
    const doc = await getDoc(V.teamId); harvest(doc);
    const w = whereBlock(doc, V.sel); if (!w) return;
    w.p.blocks.splice(w.i, 1); V.sel = null; await saveDoc(doc); render();
  });

  /* Dónde estaba el cursor dentro de la hoja (para poner sprites en la línea del texto). */
  let lastRange = null;
  document.addEventListener('selectionchange', () => {
    const s = window.getSelection();
    if (!s || !s.rangeCount) return;
    const r = s.getRangeAt(0);
    const host = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
    if (host && host.closest && host.closest('#v-doc .dcontent[contenteditable]')) lastRange = r.cloneRange();
  });
  /** Elegir sprites de Pokémon: en la línea del texto (donde estaba el cursor) o en una fila propia. */
  function spritePicker(doc) {
    const box = $('#modalBox');
    box.onclick = box.onchange = box.oninput = null;
    const picked = [];
    let mode = lastRange ? 'inline' : 'row', names = true;
    const draw = () => {
      box.innerHTML = `<button class="btn x" id="mClose">Cerrar</button><h2>Sprites</h2>
        <div class="row-btns"><input id="spQ" list="dlSpecies" placeholder="Nombre en inglés: Garchomp…" style="flex:1"><button class="btn" id="spAdd">Añadir</button></div>
        <div class="sppicked">${picked.map((n, i) => `<button class="chipbtn" data-sprm="${i}" title="Quitar">${spr(n, 'sm')}${esc(n)} ×</button>`).join('') || '<span class="note">Añade uno o varios Pokémon.</span>'}</div>
        <div class="row-btns"><div class="seg"><button data-spmode="inline" aria-pressed="${mode === 'inline'}"${lastRange ? '' : ' disabled title="Pon antes el cursor dentro de un texto de la hoja"'}>En la línea del texto</button><button data-spmode="row" aria-pressed="${mode === 'row'}">Fila de sprites</button></div>
          ${mode === 'row' ? `<label class="tog${names ? ' on' : ''}"><input type="checkbox" id="spNames"${names ? ' checked' : ''}>Con nombres</label>` : ''}<span style="flex:1"></span><button class="btn primary" id="spOk"${picked.length ? '' : ' disabled'}>Añadir a la página</button></div>`;
      $('#spQ').focus();
    };
    const add = () => { const sp = P.calcSpecies($('#spQ').value.trim()); if (sp && !picked.includes(sp)) picked.push(sp); draw(); };
    P.datalists();
    draw();
    box.onchange = e => { if (e.target.id === 'spNames') { names = e.target.checked; draw(); } else if (e.target.id === 'spQ' && P.calcSpecies(e.target.value.trim())) add(); };
    box.onkeydown = e => { if (e.target.id === 'spQ' && e.key === 'Enter') { e.preventDefault(); add(); } };
    box.onclick = async e => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.id === 'mClose') { $('#modal').classList.add('hide'); box.onclick = box.onchange = box.onkeydown = null; return; }
      if (t.id === 'spAdd') add();
      else if (t.dataset.sprm != null) { picked.splice(+t.dataset.sprm, 1); draw(); }
      else if (t.dataset.spmode) { mode = t.dataset.spmode; draw(); }
      else if (t.id === 'spOk') {
        $('#modal').classList.add('hide'); box.onclick = box.onchange = box.onkeydown = null;
        if (mode === 'inline' && lastRange) {
          const s = window.getSelection(); s.removeAllRanges(); s.addRange(lastRange);
          document.execCommand('insertHTML', false, picked.map(n => spr(n, 'dspr')).join(''));
          await persist(); render(); return;
        }
        insertBlock(doc, block('sprites', `<div class="dsprrow">${picked.map(n => `<span>${spr(n)}${names ? `<small>${esc(n)}</small>` : ''}</span>`).join('')}</div>`));
        await saveDoc(doc); render();
      }
    };
    $('#modal').classList.remove('hide');
  }

  /** Elegir el tamaño de la tabla. */
  function tablePicker(doc) {
    const box = $('#modalBox');
    box.onclick = box.onchange = null;
    let R = 3, C = 3;
    box.innerHTML = `<button class="btn x" id="mClose">Cerrar</button><h2>Elige el tamaño</h2><p class="note">Tamaño de la tabla: <b id="tpSize">3 × 3</b></p>
      <div class="tpick">${Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (__, c) => `<i data-r="${r + 1}" data-c="${c + 1}"></i>`).join('')).join('')}</div>`;
    const paint = () => { $$('.tpick i', box).forEach(i => i.classList.toggle('on', +i.dataset.r <= R && +i.dataset.c <= C)); $('#tpSize').textContent = `${R} × ${C}`; };
    paint();
    box.onmouseover = e => { const i = e.target.closest('.tpick i'); if (i) { R = +i.dataset.r; C = +i.dataset.c; paint(); } };
    box.onclick = async e => {
      if (e.target.id === 'mClose') { $('#modal').classList.add('hide'); box.onmouseover = null; return; }
      const i = e.target.closest('.tpick i'); if (!i) return;
      insertBlock(doc, block('table', tableHTML(+i.dataset.r, +i.dataset.c)));
      await saveDoc(doc);
      $('#modal').classList.add('hide'); box.onclick = box.onmouseover = null;
      render();
    };
    $('#modal').classList.remove('hide');
  }
  /** Una línea de cálculo: uno de tus Pokémon contra un rival (con su set de torneo o de Smogon), en cualquier sentido. */
  async function calcLine(doc) {
    const team = await P.teamById(V.teamId);
    const sets = P.parseTeam(team.text).sets;
    const [U, T] = await Promise.all([P.usage(''), P.tour()]);
    const box = $('#modalBox');
    box.onclick = box.onchange = null;
    const draw = () => {
      const dir = $('#clDir') ? $('#clDir').value : 'off';
      const mi = $('#clMe') ? +$('#clMe').value : 0;
      const rvIn = $('#clRival') ? $('#clRival').value : (T ? P.calcSpecies(P.tourRank(T)[0]) : P.usageRank(U)[0]);
      const rv = P.calcSpecies(rvIn);
      const me = sets[mi], foe = rv ? (P.tourSet(T, U, rv) || P.usageSet(U, rv) || P.blankMon(rv)) : null;
      const att = dir === 'off' ? me : foe, def = dir === 'off' ? foe : me;
      const mvs = att ? att.moves.filter(x => x && (P.moveOf(x) || {}).category !== 'Status') : [];
      const mv = $('#clMv') && mvs.includes($('#clMv').value) ? $('#clMv').value : mvs[0];
      const r = att && def && mv ? P.damage(att, def, mv, P.blankField(), dir === 'off' ? 'me' : 'foe') : null;
      box.innerHTML = `<button class="btn x" id="mClose">Cerrar</button><h2>Otro cálculo</h2>
        <div class="ed"><label class="field">Sentido<select id="clDir"><option value="off"${dir === 'off' ? ' selected' : ''}>Tu ataque</option><option value="def"${dir === 'def' ? ' selected' : ''}>Te atacan (aguante)</option></select></label>
          <label class="field">Tu Pokémon<select id="clMe">${sets.map((s, i) => `<option value="${i}"${i === mi ? ' selected' : ''}>${esc(s.species)}</option>`).join('')}</select></label>
          <label class="field">Rival<input id="clRival" list="dlSpecies" value="${esc(rv || rvIn || '')}" placeholder="Nombre en inglés: Garchomp…"></label>
          <label class="field">Movimiento<select id="clMv">${mvs.map(x => `<option${x === mv ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></label></div>
        <p class="dcalcprev">${r && !r.err ? esc(r.desc) : '—'}</p>
        <div class="row-btns"><span style="flex:1"></span><button class="btn primary" id="clOk"${r && !r.err ? '' : ' disabled'}>Añadir a la página</button></div>`;
      box.dataset.line = r && !r.err ? r.desc : '';
    };
    P.datalists();
    draw();
    box.onchange = draw;
    box.onclick = async e => {
      if (e.target.id === 'mClose') { $('#modal').classList.add('hide'); box.onclick = box.onchange = null; return; }
      if (e.target.id !== 'clOk') return;
      insertBlock(doc, block('calc', `<ul><li class="dcalc">${esc(box.dataset.line)}</li></ul>`));
      await saveDoc(doc);
      $('#modal').classList.add('hide'); box.onclick = box.onchange = null;
      render();
    };
    $('#modal').classList.remove('hide');
  }

  VIEWS.doc = render;
  return { render, generate };
})();
