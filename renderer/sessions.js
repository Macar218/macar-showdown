'use strict';
/*
 * Macar Showdown · sesiones y equipo con el que juegas.
 * Una sesión es un rato de práctica con un tipo (Jugar + Análisis, Juego serio, TB…), un objetivo y, si la planeas,
 * un día y una duración (Inicio → Semana). Se empieza con «Empezar» y se cierra con «Cerrar sesión» (lo que hiciste,
 * si cumpliste el objetivo y lo que te llevas). Mientras está abierta, la app cuenta los minutos de cada pilar según
 * la pantalla en la que estás (Jugar = jugar, replays y Dashboard = análisis, Equipo, Calculadora, Mi PC y Dex = TB)
 * y deja de contar si no tocas el ordenador en 5 minutos o la ventana está minimizada. Al cerrarla los puedes cambiar.
 * No va atada a un equipo: dentro puedes cambiar de equipo y cada partida guarda con cuál la jugaste.
 */
/* global api, DB, P, $, SET, Calc, F, load, show, VIEW, W2, Viewer, Season, Home, newId, I18N */

const Sess = (() => {
  async function list() { const v = await DB.get('sesiones'); return Array.isArray(v) ? v : []; }
  async function save(all) { await DB.set('sesiones', all); }
  async function current() { return SET.sessionId ? (await list()).find(s => s.id === SET.sessionId) || null : null; }
  const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const en = () => typeof I18N !== 'undefined' && I18N.lang === 'en';
  /** «Sesión 20 Noviembre 2026» (del día que digas). */
  function defName(day) {
    const d = day ? Season.parseDay(day) : new Date();
    return `${en() ? 'Session' : 'Sesión'} ${d.getDate()} ${(en() ? MON : MES)[d.getMonth()]} ${d.getFullYear()}`;
  }

  async function paintButton() {
    const s = await current();
    const t = SET.teamId ? await P.teamById(SET.teamId) : null;
    $('#sessName').textContent = s ? s.name : 'Sin sesión';
    $('#sessTeam').textContent = t ? t.name : 'Sin equipo';
    $('#sessBtn').classList.toggle('none', !s);
    $('#sessBtn').title = `${s ? `Tu sesión: ${s.name}${s.goal ? ` · ${s.goal}` : ''}.` : 'Sin sesión: las partidas cuentan en «Todas».'} Juegas con: ${t ? t.name : 'ningún equipo'}. Pulsa para ver tu plan y tus sesiones.`;
  }

  /** Abrir (o seguir con) una sesión: se cuenta su tiempo, sigue con su equipo y el Dashboard enseña sus partidas. */
  async function open(id) {
    const all = await list();
    const s = id ? all.find(x => x.id === id) : null;
    // Solo una abierta: la que estaba abierta (si es otra) se queda como estaba, sin contar más tiempo.
    if (s) {
      if (s.state !== 'open') { s.state = 'open'; s.realDay = s.realDay || Season.today(); s.startedAt = s.startedAt || Date.now(); }
      if (!s.teamId && SET.teamId) s.teamId = SET.teamId;
      s.used = Date.now(); s.up = Date.now();
      await save(all);
    }
    const patch = { sessionId: s ? s.id : '' };
    if (s && s.teamId && (await P.teamById(s.teamId))) patch.teamId = s.teamId;
    Object.assign(SET, await api.setSettings(patch));
    if (patch.teamId) Calc.setTeams(patch.teamId);
    F.scope = s ? 'session' : 'all';
    F.team = ''; F.sid = '';
    await paintButton();
    load();
    return s;
  }
  /** Sesión nueva: si es para hoy y empiezas ya, se abre; si es para otro día, queda prevista. */
  async function create(o, start) {
    const day = o.day && Season.isDay(o.day) ? o.day : Season.today();
    const s = {
      id: newId('s'), name: String(o.name || defName(day)).slice(0, 80), goal: String(o.goal || '').trim().slice(0, 300),
      teamId: o.teamId != null ? o.teamId : SET.teamId || '', type: Season.TYPE[o.type] ? o.type : 'play',
      day: o.planned === false ? '' : day, planMin: o.planned === false ? 0 : Math.max(0, +o.planMin || 0), state: 'plan',
      realDay: '', realMin: 0, min: null, track: null, ok: null, notes: '', other: '', lesson: '', created: Date.now(), up: Date.now()
    };
    await save([s, ...(await list())]);
    if (start) await open(s.id);
    return s;
  }
  /** Cambiar campos de una sesión. */
  async function update(id, patch) {
    const all = await list(), s = all.find(x => x.id === id);
    if (!s) return null;
    Object.assign(s, patch, { up: Date.now() });
    await save(all);
    if (id === SET.sessionId) paintButton();
    return s;
  }
  /** Cerrar la sesión: queda hecha con lo que pongas (y deja de contar el tiempo). */
  async function finish(id, patch) {
    await flush();
    const s = await update(id, { ...patch, state: 'done' });
    if (SET.sessionId === id) await open('');
    return s;
  }
  async function remove(id) {
    const all = await list(), s = all.find(x => x.id === id);
    if (!s) return;
    await api.clearSession(s.id);
    await save(all.filter(x => x.id !== s.id));
    if (SET.sessionId === s.id) await open('');
  }

  /** Cambiar el equipo con el que juegas. La sesión abierta lo recuerda (al volver a ella, sigue con este). */
  async function useTeam(id) {
    Object.assign(SET, await api.setSettings({ teamId: id || '' }));
    const all = await list(), x = SET.sessionId && all.find(s => s.id === SET.sessionId);
    if (x && x.teamId !== id) { x.teamId = id || ''; x.up = Date.now(); await save(all); }
    if (id && typeof Calc !== 'undefined') Calc.setTeams(id);
    await paintButton();
    load();
  }

  /* ---------- cronómetro de la sesión abierta ---------- */
  const HUBV = new Set(['miequipo', 'equipo', 'mu', 'estudio', 'opt', 'doc', 'calc', 'pc', 'dex']);
  /** En qué pilar estás ahora (null = no cuenta: Inicio, Ajustes). */
  function pillarNow(s) {
    if (s.type === 'coach') return 'an';
    if (typeof Viewer !== 'undefined' && Viewer.isOpen && Viewer.isOpen()) return 'an';
    if (VIEW === 'jugar') return s.type === 'serious' || s.type === 'tour' ? 'serious' : 'play';
    if (VIEW === 'dash') return 'an';
    if (HUBV.has(VIEW)) return 'tb';
    return null;
  }
  // Lo contado se guarda cada 5 minutos (y al cerrar la sesión o la app), no en cada minuto.
  let last = Date.now(), pend = { id: '', m: Season.zero() }, ticks = 0;
  async function flush() {
    if (!pend.id || !Season.sum(pend.m)) return;
    const { id, m } = pend;
    pend = { id, m: Season.zero() };
    const all = await list(), s = all.find(x => x.id === id);
    if (!s) return;
    s.track = { ...Season.zero(), ...(s.track || {}) };
    for (const k of Season.PK) s.track[k] = Math.round((s.track[k] + m[k]) * 100) / 100;
    await save(all);
  }
  /** Minutos medidos de la sesión, con lo que aún no se ha guardado. */
  function trackOf(s) {
    const t = { ...Season.zero(), ...((s && s.track) || {}) };
    if (s && pend.id === s.id) for (const k of Season.PK) t[k] += pend.m[k];
    return t;
  }
  async function tick() {
    const now = Date.now(), dt = Math.min(2, (now - last) / 60000); // minutos desde la última vez (como mucho 2: si el ordenador durmió, no cuenta)
    last = now;
    if (W2 || !SET.sessionId || document.visibilityState !== 'visible') return;
    const idle = await api.idle().catch(() => 0);
    if (idle > 300) return;
    const s = await current();
    if (!s || (s.state && s.state !== 'open')) return;
    const k = pillarNow(s);
    if (!k) return;
    if (pend.id !== s.id) { await flush(); pend = { id: s.id, m: Season.zero() }; }
    pend.m[k] += dt;
    if (++ticks % 5 === 0) await flush();
    if (typeof Home !== 'undefined' && Home.tick) Home.tick(s);
  }
  window.addEventListener('beforeunload', () => { flush(); });
  if (!W2) setInterval(tick, 60000);

  $('#sessBtn').addEventListener('click', () => show('inicio'));
  DB.onChange(k => { if (k === 'sesiones' || k === 'equipos') paintButton(); });
  paintButton();
  return { list, save, current, open, create, update, finish, remove, useTeam, paintButton, defName, pillarNow, flush, trackOf };
})();
