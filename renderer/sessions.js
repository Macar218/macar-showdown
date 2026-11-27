'use strict';
/*
 * Macar Showdown · sesiones y equipo con el que juegas.
 * Una sesión es un rato de práctica con un objetivo (y, si la planeas, un día). Se empieza con «Empezar» y se cierra
 * con «Cerrar sesión» (si cumpliste el objetivo, lo que hiciste y lo que te llevas). Mientras está abierta, el
 * cronómetro de la barra de abajo cuenta el tiempo de lo que le digas que estás haciendo (Jugar, Juego serio, Análisis
 * o TB); la duración y el reparto salen de ahí. Sin horas fijas: no hay que planear cuánto.
 * No va atada a un equipo: dentro puedes cambiar de equipo y cada partida guarda con cuál la jugaste.
 */
/* global api, DB, P, $, SET, Calc, F, load, show, W2, Season, Home, newId, I18N */

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
    await flush();
    setAct(s ? 'play' : 'pause');
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

  /*
   * ---------- cronómetro de la sesión abierta ----------
   * Tú dices qué estás haciendo (Jugar, Juego serio, Análisis o TB) en la barra de abajo y cuenta para eso hasta que
   * cambies o pauses. Al abrir la app empieza en pausa. Si pasas 20 minutos sin tocar el ordenador, se pausa solo.
   */
  let act = 'pause';
  const getAct = () => act;
  function setAct(k) {
    act = Season.PK.includes(k) ? k : 'pause';
    if (typeof Home !== 'undefined' && Home.bar) Home.bar();
  }
  // Lo contado se guarda cada 5 minutos (y al cambiar de actividad, al cerrar la sesión o la app).
  let last = Date.now(), pend = { id: '', m: Season.zero() }, ticks = 0, idlePaused = false;
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
    if (W2 || !SET.sessionId || act === 'pause') return;
    const idle = await api.idle().catch(() => 0);
    if (idle > 1200) { idlePaused = true; setAct('pause'); return; }
    const s = await current();
    if (!s || (s.state && s.state !== 'open')) return;
    if (pend.id !== s.id) { await flush(); pend = { id: s.id, m: Season.zero() }; }
    pend.m[act] += dt;
    if (++ticks % 20 === 0) await flush();
    if (typeof Home !== 'undefined' && Home.tick) Home.tick(s);
  }
  const wasIdle = () => { const v = idlePaused; idlePaused = false; return v; };
  window.addEventListener('beforeunload', () => { flush(); });
  if (!W2) setInterval(tick, 15000);

  $('#sessBtn').addEventListener('click', () => show('inicio'));
  DB.onChange(k => { if (k === 'sesiones' || k === 'equipos') paintButton(); });
  paintButton();
  return { list, save, current, open, create, update, finish, remove, useTeam, paintButton, defName, flush, trackOf, act: getAct, setAct, wasIdle };
})();
