'use strict';
/*
 * Macar Showdown · Jugar.
 * - Notas de la partida: la barra de abajo se engancha al combate que tienes delante; lo que escribes pasa a
 *   la partida al guardarse (y se sigue guardando si escribes después).
 * - Sonido: Showdown arranca silenciado; el botón del altavoz lo activa o lo vuelve a silenciar.
 * - Aviso de versión nueva (se descarga sola y se instala al reiniciar).
 */
/* global api, DB, P, $, esc, SET, NoteHL */

const Play = (() => {
  const st = { cur: null, mid: null, saveT: null, open: true, muted: true };
  try { st.open = localStorage.getItem('msNotes') !== '0'; } catch (e) { /* nada */ }
  const bar = $('#notesBar'), txt = $('#nbText');
  NoteHL.wrap(txt);

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
    if (st.mid === mid && document.activeElement !== txt) { txt.value = v; NoteHL.sync(txt); }
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
  /** Nota del turno de ahora: una línea nueva que empieza por [T5], lista para escribir. */
  $('#nbMark').addEventListener('click', () => {
    if (!st.cur || txt.disabled) return;
    if (!st.open) setOpen(true);
    const tag = `[T${st.cur.turn || 0}] `;
    const v = txt.value.replace(/\s+$/, '');
    txt.value = (v ? `${v}\n` : '') + tag;
    NoteHL.sync(txt);
    txt.focus(); txt.setSelectionRange(txt.value.length, txt.value.length); txt.scrollTop = txt.scrollHeight;
    txt.dispatchEvent(new Event('input'));
  });

  /* ---------- tamaño de Showdown a mano, como en el navegador (− / + y Ctrl + / Ctrl − / Ctrl 0) ---------- */
  const sdv = $('#sd');
  let zoom = 1;
  try { zoom = Math.max(0.5, Math.min(2.5, +localStorage.getItem('msSdZoom') || 1)); } catch (e) { /* nada */ }
  const showZoom = () => { $('#sdZoomVal').textContent = `${Math.round(zoom * 100)}%`; };
  function setZoom(z, apply = true) {
    zoom = Math.round(Math.max(0.5, Math.min(2.5, z)) * 10) / 10;
    if (apply) { try { sdv.setZoomFactor(zoom); } catch (e) { /* aún no ha cargado */ } }
    try { localStorage.setItem('msSdZoom', String(zoom)); } catch (e) { /* nada */ }
    showZoom();
  }
  $('#sdZoomOut').addEventListener('click', () => setZoom(zoom - 0.1));
  $('#sdZoomIn').addEventListener('click', () => setZoom(zoom + 0.1));
  $('#sdZoomVal').addEventListener('click', () => setZoom(1));
  api.onSdZoom(z => setZoom(z, false));
  sdv.addEventListener('dom-ready', () => setZoom(zoom));
  showZoom();

  function showCur(c) {
    const who = $('#nbWho'), stat = $('#playStat');
    const mk = $('#nbMark');
    mk.disabled = !c || c.ended;
    mk.textContent = c && !c.ended ? `+ Nota del turno ${c.turn || 0}` : '+ Nota del turno';
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

  /* ---------- sonido (silenciado al abrir la app) ---------- */
  const sd = $('#sd');
  function applyMute() {
    try { sd.setAudioMuted(st.muted); } catch (e) { /* aún no ha cargado */ }
    const b = $('#sdMute');
    b.innerHTML = st.muted ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
    b.title = st.muted ? 'Showdown está en silencio: pulsa para activar el sonido' : 'Silenciar Showdown';
    b.classList.toggle('on', !st.muted);
  }
  sd.addEventListener('dom-ready', applyMute);
  $('#sdMute').addEventListener('click', () => { st.muted = !st.muted; applyMute(); });
  applyMute();

  /* ---------- bucle ---------- */
  async function tick() {
    let c = null;
    try { c = await api.current(); } catch (e) { c = null; }
    if (c && c.mid !== st.mid) { st.mid = c.mid; txt.value = ''; $('#nbSaved').textContent = ''; loadNotes(c.mid); }
    st.cur = c;
    showCur(c);
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
    if (b) b.onclick = () => api.updateInstall();
  }
  api.onUpdate(showUpdate);
  api.updateState().then(showUpdate).catch(() => {});

  return { state: st, applyMute };
})();
