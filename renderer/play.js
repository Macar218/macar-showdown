'use strict';
/*
 * Macar Showdown · Jugar.
 * - Notas de la partida: la barra de abajo se engancha al combate que tienes delante; lo que escribes pasa a
 *   la partida al guardarse (y se sigue guardando si escribes después).
 * - Grabación: graba solo el Showdown (no la calculadora) desde que empieza tu combate hasta que acaba.
 * - Aviso de versión nueva (se descarga sola y se instala al reiniciar).
 */
/* global api, DB, P, $, esc, SET */

const Play = (() => {
  const st = { cur: null, mid: null, saveT: null, open: true, rec: null, recMid: null, stopT: null, gone: 0 };
  try { st.open = localStorage.getItem('msNotes') !== '0'; } catch (e) { /* nada */ }
  const bar = $('#notesBar'), txt = $('#nbText');

  /* ---------- notas ---------- */
  function setOpen(v) {
    st.open = v;
    bar.classList.toggle('closed', !v);
    try { localStorage.setItem('msNotes', v ? '1' : '0'); } catch (e) { /* nada */ }
  }
  $('#nbToggle').addEventListener('click', () => setOpen(!st.open));
  setOpen(st.open);

  async function loadNotes(mid) {
    const live = ((await DB.get('liveNotes')) || {})[mid];
    let v = live || '';
    if (!v) { const m = await api.get(mid); if (m && m.notes) v = m.notes; }
    if (st.mid === mid && document.activeElement !== txt) txt.value = v;
  }
  async function saveNotes() {
    const mid = st.mid;
    if (!mid) return;
    const all = { ...((await DB.get('liveNotes')) || {}) };
    if (txt.value) all[mid] = txt.value; else delete all[mid];
    // Solo se guardan las 60 más recientes (las demás ya están en sus partidas).
    const keys = Object.keys(all);
    if (keys.length > 60) for (const k of keys.slice(0, keys.length - 60)) delete all[k];
    await DB.set('liveNotes', all);
    if (await api.matchExists(mid)) await api.setNotes(mid, txt.value);
    $('#nbSaved').textContent = 'Guardado';
  }
  txt.addEventListener('input', () => { $('#nbSaved').textContent = ''; clearTimeout(st.saveT); st.saveT = setTimeout(saveNotes, 600); });

  function showCur(c) {
    const who = $('#nbWho'), stat = $('#playStat');
    if (!c) {
      who.textContent = st.mid ? 'Última partida' : 'Abre un combate para tomar notas';
      stat.textContent = 'Juega como siempre: al terminar cada combate, la partida se guarda sola.';
      txt.disabled = !st.mid;
      return;
    }
    txt.disabled = false;
    const vs = c.opp ? `vs ${c.opp}` : 'Combate';
    who.textContent = `${vs} · ${c.ended ? 'terminado' : `turno ${c.turn}`}${c.player ? '' : ' · espectador'}`;
    stat.innerHTML = `${c.ended ? '<span class="pill">Terminado</span>' : '<span class="pill live">En combate</span>'} <b>${esc(vs)}</b> <span class="note">· ${esc(String(c.format || '').replace(/^\[Gen \d+[^\]]*\]\s*/, ''))} · turno ${c.turn}</span>`;
  }

  /* ---------- grabación ---------- */
  async function startRec(mid) {
    if (st.rec) return;
    let stream;
    try { stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 30 } }, audio: false }); } catch (e) { console.warn('[grabación] no se pudo empezar', e && e.message); st.recFail = Date.now(); return; }
    const r = await api.recStart(mid);
    if (!r || !r.ok) { stream.getTracks().forEach(t => t.stop()); return; }
    const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t));
    const mr = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2500000 });
    mr.ondataavailable = async e => { if (e.data && e.data.size) api.recChunk(new Uint8Array(await e.data.arrayBuffer())); };
    mr.start(2000);
    st.rec = { mr, stream }; st.recMid = mid;
    $('#recDot').classList.remove('hide');
  }
  function stopRec() {
    if (!st.rec) return;
    const { mr, stream } = st.rec;
    st.rec = null; st.recMid = null;
    $('#recDot').classList.add('hide');
    mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); setTimeout(() => api.recStop(), 400); };
    try { mr.stop(); } catch (e) { api.recStop(); }
  }

  /* ---------- bucle ---------- */
  async function tick() {
    let c = null;
    try { c = await api.current(); } catch (e) { c = null; }
    if (c && c.mid !== st.mid) { st.mid = c.mid; txt.value = ''; $('#nbSaved').textContent = ''; loadNotes(c.mid); }
    st.cur = c;
    showCur(c);
    // Grabar: tu combate, sin acabar, si está activado.
    const want = c && c.player && !c.ended && SET.recordVideo !== false;
    if (want && st.recMid !== c.mid) { stopRec(); if (!st.recFail || Date.now() - st.recFail > 60000) startRec(c.mid); }
    if (st.rec) {
      if (!c) st.gone++; else st.gone = 0;
      const done = (c && c.ended && c.mid === st.recMid) || (c && c.mid !== st.recMid) || st.gone > 4 || SET.recordVideo === false;
      if (done && !st.stopT) st.stopT = setTimeout(() => { st.stopT = null; stopRec(); }, c && c.ended ? 3000 : 0);
    }
  }
  setInterval(tick, 1500);
  tick();

  /* ---------- tu equipo a Showdown y buscar partida ---------- */
  let searching = false;
  async function myTeamText() {
    const t = SET.teamId ? await P.teamById(SET.teamId) : null;
    return t && t.text.trim() ? t : null;
  }
  const flash = msg => { const s = $('#playStat'); s.textContent = msg; };
  $('#sdTeam').addEventListener('click', async () => {
    const t = await myTeamText();
    if (!t) { flash('Primero elige tu equipo en el Teambuilder (Usar como mi equipo).'); return; }
    const r = await api.sdAddTeam(t.name, t.text);
    flash(r.ok ? `Ese es tu equipo, en la carpeta «Macar Showdown» de Showdown: ${t.name}.` : `No se ha podido llevar el equipo a Showdown: ${r.why}`);
  });
  $('#sdSearch').addEventListener('click', async () => {
    const b = $('#sdSearch');
    if (searching) { await api.sdCancelSearch(); searching = false; b.textContent = 'Buscar partida (Reg M-C)'; b.classList.add('primary'); flash('Búsqueda cancelada.'); return; }
    const t = await myTeamText();
    if (!t) { flash('Primero elige tu equipo en el Teambuilder (Usar como mi equipo).'); return; }
    const r = await api.sdSearch(t.name, t.text);
    if (!r.ok) { flash(`No se ha podido buscar la partida: ${r.why}`); return; }
    searching = true; b.textContent = 'Cancelar búsqueda'; b.classList.remove('primary');
    flash(`Buscando una partida de la Reg M-C con ${t.name}…`);
  });
  const resetSearch = () => { if (searching && st.cur && !st.cur.ended) { searching = false; const b = $('#sdSearch'); b.textContent = 'Buscar partida (Reg M-C)'; b.classList.add('primary'); } };
  setInterval(resetSearch, 1500);

  /* ---------- versión nueva ---------- */
  function showUpdate(u) {
    const el = $('#updBox');
    if (!u || u.state === 'idle' || u.state === 'checking' || u.state === 'error') { el.classList.add('hide'); return; }
    el.classList.remove('hide');
    el.innerHTML = u.state === 'ready'
      ? `<b>Versión ${esc(u.version)} lista</b><span class="note">Se instala al cerrar la app.</span><button class="btn primary sm" id="updGo">Reiniciar ahora</button>`
      : `<b>Descargando la versión ${esc(u.version || '')}</b><span class="note">${u.percent || 0}%</span>`;
    const b = $('#updGo');
    if (b) b.onclick = () => { stopRec(); api.updateInstall(); };
  }
  api.onUpdate(showUpdate);
  api.updateState().then(showUpdate).catch(() => {});

  window.addEventListener('beforeunload', stopRec);
  return { stopRec, state: st, _start: startRec };
})();
