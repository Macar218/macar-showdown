'use strict';
/*
 * Macar Showdown · visor de replays.
 * La partida guardada se ve dentro de la app con el reproductor oficial de Showdown (msreplay://, servido desde
 * el registro guardado: no hace falta haberla subido), o su vídeo si se grabó. Al lado: leads y reserva de los
 * dos y las notas de la partida, con marcas de turno [T5] (o de minuto [1:23] en el vídeo) que saltan a ese momento.
 */
/* global api, esc, spr, pill, fmtDate */

const Viewer = (() => {
  const SPEEDS = [['hyperfast', 'Muy rápida'], ['fast', 'Rápida'], ['normal', 'Normal'], ['slow', 'Lenta']];
  let V = null; // { id, s, mode, video, timer, ready, turn, paused, speed }

  const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const web = () => document.querySelector('#rvWeb');
  const vid = () => document.querySelector('#rvVid');
  /** Ejecuta algo en el reproductor de Showdown (solo cuando ya ha cargado). */
  async function run(js) {
    const w = web();
    if (!w || !V || !V.ready) return null;
    try { return await w.executeJavaScript(`(() => { try { return ${js}; } catch (e) { return null; } })()`); } catch (e) { return null; }
  }

  function monsHTML(x) {
    const leads = x.leads || [], brought = x.brought || [];
    const back = brought.filter(p => !leads.includes(p));
    const out = (x.preview || []).filter(p => !brought.some(b => b.split('-')[0] === p.split('-')[0]));
    const row = (label, list, cls = '') => `<div class="rvmons"><small>${label}</small><span>${list.length ? list.map(p => spr(p, `sm ${cls}`)).join('') : '<span class="note">—</span>'}</span></div>`;
    return row('Leads', leads) + row('Reserva', back) + (out.length ? row('No salieron', out, 'dim') : '');
  }

  function playerHTML() {
    if (V.mode === 'video') return `<video id="rvVid" controls autoplay src="${esc(V.video)}"></video>`;
    const turns = V.s.turns || 0;
    return `<webview id="rvWeb" partition="persist:replay" src="msreplay://r/${esc(V.id)}"></webview>
      <div class="rvbar">
        <button class="btn sm" data-rv="prev" title="Turno anterior">⏮</button><button class="btn sm primary" data-rv="play" id="rvPlay">▶ Play</button><button class="btn sm" data-rv="next" title="Turno siguiente">⏭</button>
        <div class="rvturns">${Array.from({ length: turns + 1 }, (_, t) => `<button class="rvt" data-rvturn="${t}" title="${t ? `Turno ${t}` : 'Inicio'}">${t || '0'}</button>`).join('')}</div>
        <select id="rvSpeed" title="Velocidad">${SPEEDS.map(([k, l]) => `<option value="${k}"${k === V.speed ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <button class="btn sm" data-rv="side" title="Ver la partida desde el otro lado">⇄ Lados</button>
      </div>`;
  }

  function draw() {
    const s = V.s, a = s.me || 'p1', b = s.opp || 'p2';
    const el = document.querySelector('#rvWrap');
    el.innerHTML = `<div class="rv" role="dialog" aria-label="Replay de la partida">
      <header class="rvhead">${pill(s.result)}<b>${s.me ? `vs <span class="nolang">${esc(s[b].name)}</span>` : `<span class="nolang">${esc(s.p1.name)} vs ${esc(s.p2.name)}</span>`}</b>
        <span class="note">${fmtDate(s.endedAt)} · ${esc(s.format)} · ${s.turns} turnos</span><span style="flex:1"></span>
        ${V.video ? `<div class="seg"><button data-rvmode="replay" aria-pressed="${V.mode === 'replay'}">Replay</button><button data-rvmode="video" aria-pressed="${V.mode === 'video'}">Vídeo</button></div>` : ''}
        ${s.replay ? '<button class="btn sm" data-rv="ext">Abrir en el navegador</button>' : ''}<button class="btn" data-rv="close" title="Cerrar (Esc)">Cerrar</button></header>
      <div class="rvbody">
        <div class="rvplayer">${playerHTML()}</div>
        <aside class="rvside">
          <div class="rvteam me"><h3>${s.me ? 'Tú' : 'Jugador 1'}</h3>${monsHTML(s[a])}</div>
          <div class="rvteam foe"><h3>${s.me ? 'Rival' : 'Jugador 2'}</h3>${monsHTML(s[b])}</div>
          <div class="rvnhead"><h3>Notas</h3><span class="note" id="rvSaved"></span></div>
          <button class="btn sm primary" id="rvMark">${V.mode === 'video' ? `+ Nota en el minuto ${mmss(0)}` : '+ Nota en el turno 0'}</button>
          <textarea id="rvNotes" placeholder="${V.mode === 'video' ? 'Pulsa «+ Nota» para apuntar con el minuto del vídeo…' : 'Pulsa «+ Nota» para apuntar con el turno de la replay…'}">${esc(V.notes)}</textarea>
          <p class="note">Pulsa una línea que empiece por [T5] o [1:23] para saltar a ese momento.</p>
        </aside>
      </div></div>`;
    hook();
  }

  /** Conecta el reproductor (replay o vídeo). */
  function hook() {
    clearInterval(V.timer);
    V.ready = false;
    if (V.mode === 'video') {
      const v = vid();
      V.timer = setInterval(() => { const b = document.querySelector('#rvMark'); if (b && vid()) b.textContent = `+ Nota en el minuto ${mmss(vid().currentTime)}`; }, 500);
      v.addEventListener('error', () => { v.outerHTML = '<p class="note rvmsg">No se ha podido abrir el vídeo.</p>'; });
      fixDuration(v);
      return;
    }
    const w = web();
    w.addEventListener('dom-ready', () => {
      w.insertCSS(`h1,.replay-controls,.replay-controls-2,.battle-log-inline{display:none!important}
        html,body{background:#0b1a42!important;padding:0!important;margin:0!important;overflow:hidden!important}
        .wrapper{max-width:none!important;margin:0!important}`);
    });
    const id = V.id;
    // Esperar a que el reproductor esté listo; entonces modo oscuro, velocidad y, si eras p2, verlo desde tu lado.
    const wait = setInterval(async () => {
      if (!V || V.id !== id || !web()) { clearInterval(wait); return; }
      let ok = false;
      try { ok = await w.executeJavaScript('typeof Replays !== "undefined" && !!Replays.battle && !!Replays.battle.scene'); } catch (e) { ok = false; }
      if (!ok) return;
      clearInterval(wait);
      V.ready = true;
      await run("Replays.changeSetting('color', 'dark')");
      await run(`Replays.changeSetting('speed', ${JSON.stringify(V.speed)})`);
      if (V.s.me === 'p2') await run('Replays.battle.switchViewpoint()');
      fit();
      // Volver a encajarlo cuando cambie el tamaño del reproductor (ventana, panel…).
      new ResizeObserver(() => { if (V && V.ready) { clearTimeout(V.fitT); V.fitT = setTimeout(fit, 120); } }).observe(w);
      V.timer = setInterval(poll, 400);
      poll();
    }, 300);
  }
  /** El combate y su registro, a todo el hueco del reproductor. */
  function fit() {
    // El combate mide 640×360 y su registro va al lado: se escala todo para llenar el hueco.
    // Si así el combate sale bastante más grande, el registro va debajo.
    run(`(() => {
      const W = innerWidth, H = innerHeight, b = document.querySelector('.battle'), l = document.querySelector('.battle-log');
      if (!b || !l) return 0;
      const side = Math.min(W / 1000, H / 364), stack = Math.min(W / 644, H / 520);
      const st = stack > side * 1.12, z = Math.max(0.4, st ? stack : side);
      document.body.style.zoom = z;
      const w = W / z, h = H / z;
      const bl = Math.max(0, (w - (st ? 640 : 1000)) / 2);
      Object.assign(b.style, { left: bl + 'px', top: '2px' });
      document.querySelector('.wrapper').style.height = (h - 2) + 'px';
      if (st) Object.assign(l.style, { left: '2px', top: '366px', right: 'auto', bottom: '2px', width: (w - 4) + 'px', height: 'auto', maxHeight: 'none' });
      else Object.assign(l.style, { left: (bl + 642) + 'px', top: '2px', right: 'auto', width: (w - bl * 2 - 642) + 'px', height: '360px' });
      l.scrollTop = l.scrollHeight;
      return z; })()`);
  }
  async function poll() {
    if (!V || V.mode !== 'replay') return;
    const st = await run('[Replays.battle.turn, Replays.battle.paused, Replays.battle.atQueueEnd]');
    if (!st) return;
    if (!V || V.mode !== 'replay') return;
    const [turn, paused, end] = st;
    const prev = V.turn;
    V.turn = Math.max(0, turn || 0);
    // Al cambiar de turno, el registro baja hasta lo último.
    if (V.turn !== prev) run("(l => { if (l) l.scrollTop = l.scrollHeight; return 1; })(document.querySelector('.battle-log'))");
    document.querySelectorAll('.rvt').forEach(b => b.classList.toggle('on', +b.dataset.rvturn === V.turn));
    const p = document.querySelector('#rvPlay');
    if (p) p.textContent = paused || end ? '▶ Play' : '⏸ Pausa';
    const m = document.querySelector('#rvMark');
    if (m) m.textContent = `+ Nota en el turno ${V.turn}`;
  }

  /** Salta al momento de la línea pulsada ([T5] en la replay, [1:23] en el vídeo). */
  function jumpFromLine(text, pos) {
    const line = text.slice(text.lastIndexOf('\n', pos - 1) + 1).split('\n')[0];
    const t = line.match(/^\s*\[T(\d+)\]/i), m = line.match(/^\s*\[(\d+):(\d{2})\]/);
    if (t) {
      if (V.mode !== 'replay') { V.mode = 'replay'; draw(); }
      const n = +t[1];
      const go = () => (V.ready ? run(`Replays.battle.seekTurn(${n})`) : setTimeout(go, 300));
      go();
    } else if (m && V.video) {
      const secs = +m[1] * 60 + +m[2];
      if (V.mode !== 'video') { V.mode = 'video'; draw(); }
      const v = vid();
      const set = () => { v.currentTime = secs; };
      if (v.readyState >= 1) set(); else v.addEventListener('loadedmetadata', set, { once: true });
    }
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    const id = V.id, text = V.notes;
    saveTimer = setTimeout(async () => {
      await api.setNotes(id, text);
      const x = typeof M !== 'undefined' && Array.isArray(M) ? M.find(y => y.id === id) : null;
      if (x) x.notes = text;
      const el = document.querySelector('#rvSaved');
      if (el) el.textContent = 'Guardado';
    }, 500);
    const el = document.querySelector('#rvSaved');
    if (el) el.textContent = 'Guardando…';
  }
  function mark() {
    const ta = document.querySelector('#rvNotes');
    const tag = V.mode === 'video' ? `[${mmss(vid() ? vid().currentTime : 0)}] ` : `[T${V.turn || 0}] `;
    // En una línea nueva, debajo de donde estaba el cursor (si no se ha tocado, al final).
    const cur = V.caret != null && V.caret <= ta.value.length ? V.caret : ta.value.length;
    const nl = ta.value.indexOf('\n', cur);
    const at = nl < 0 ? ta.value.length : nl;
    const pre = at > 0 && ta.value[at - 1] !== '\n' ? '\n' : '';
    ta.value = ta.value.slice(0, at) + pre + tag + ta.value.slice(at);
    V.notes = ta.value;
    const c = at + pre.length + tag.length;
    ta.focus(); ta.setSelectionRange(c, c); V.caret = c;
    if (V.mode === 'video' && vid()) vid().pause(); else run('Replays.battle.pause()');
    save();
  }

  async function open(id) {
    const m = await api.get(id);
    if (!m) return;
    let video = null;
    try { video = await api.videoFor(id); } catch (e) { video = null; }
    if (V) close();
    V = { id, s: m.summary, notes: m.notes || '', video, mode: 'replay', turn: 0, speed: 'fast', ready: false, timer: null };
    let el = document.querySelector('#rvWrap');
    if (!el) { el = document.createElement('div'); el.id = 'rvWrap'; document.body.appendChild(el); }
    el.classList.remove('hide');
    draw();
  }
  function close() {
    if (!V) return;
    clearInterval(V.timer);
    clearTimeout(saveTimer);
    const notes = V.notes, id = V.id;
    api.setNotes(id, notes);
    V = null;
    const el = document.querySelector('#rvWrap');
    if (el) { el.innerHTML = ''; el.classList.add('hide'); }
    // Si el detalle de la partida estaba abierto, que muestre las notas nuevas.
    const ta = document.querySelector('#modal:not(.hide) #mNotes');
    if (ta) ta.value = notes;
  }

  document.addEventListener('click', e => {
    if (!V) return;
    const wrap = document.querySelector('#rvWrap');
    if (e.target === wrap) { close(); return; }
    const b = e.target.closest('#rvWrap button');
    if (!b) return;
    const d = b.dataset;
    if (d.rv === 'close') close();
    else if (d.rv === 'ext') api.openExternal(V.s.replay);
    else if (d.rv === 'play') run('Replays.battle.paused || Replays.battle.atQueueEnd ? Replays.battle.play() : Replays.battle.pause()').then(poll);
    else if (d.rv === 'prev') run('Replays.battle.seekBy(-1)').then(poll);
    else if (d.rv === 'next') run('Replays.battle.seekBy(1)').then(poll);
    else if (d.rv === 'side') run('Replays.battle.switchViewpoint()');
    else if (d.rvturn != null) run(`Replays.battle.seekTurn(${+d.rvturn})`).then(poll);
    else if (d.rvmode && d.rvmode !== V.mode) { V.mode = d.rvmode; draw(); }
    else if (b.id === 'rvMark') mark();
  });
  document.addEventListener('change', e => {
    if (V && e.target.id === 'rvSpeed') { V.speed = e.target.value; run(`Replays.changeSetting('speed', ${JSON.stringify(V.speed)})`); }
  });
  document.addEventListener('input', e => { if (V && e.target.id === 'rvNotes') { V.notes = e.target.value; V.caret = e.target.selectionStart; save(); } });
  document.addEventListener('keyup', e => { if (V && e.target.id === 'rvNotes') V.caret = e.target.selectionStart; });
  document.addEventListener('mouseup', e => {
    if (!V || e.target.id !== 'rvNotes') return;
    const ta = e.target;
    V.caret = ta.selectionStart;
    if (ta.selectionStart === ta.selectionEnd) jumpFromLine(ta.value, ta.selectionStart);
  });
  document.addEventListener('keydown', e => { if (V && e.key === 'Escape') { e.stopPropagation(); close(); } }, true);

  return { open, close };
})();
