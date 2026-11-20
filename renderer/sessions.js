'use strict';
/*
 * Macar Showdown · sesiones.
 * Una sesión es un rato de juego con un equipo (un Regional, una subida en el ladder…): nombre, objetivo y equipo.
 * Las partidas que juegas se apuntan en la sesión abierta. Un equipo tiene sus sesiones: el Dashboard enseña la
 * sesión abierta o todo el equipo. La pantalla de inicio (start.js) es donde se cargan y se crean.
 */
/* global api, DB, P, $, SET, Calc, F, load */

const Sess = (() => {
  async function list() { const v = await DB.get('sesiones'); return Array.isArray(v) ? v : []; }
  async function save(all) { await DB.set('sesiones', all); }
  async function current() { return SET.sessionId ? (await list()).find(s => s.id === SET.sessionId) || null : null; }

  async function paintButton() {
    const s = await current();
    $('#sessName').textContent = s ? s.name : 'Sin sesión';
    $('#sessBtn').classList.toggle('none', !s);
    $('#sessBtn').title = s ? `Tu sesión: ${s.name}${s.goal ? ` · ${s.goal}` : ''}. Pulsa para cambiar a otra o crear una nueva.` : 'Partida no guardada en ninguna sesión: abre o crea una.';
  }

  /** Abrir una sesión: su equipo pasa a ser el tuyo y el Dashboard enseña solo sus partidas. */
  async function open(id) {
    const s = id ? (await list()).find(x => x.id === id) : null;
    const patch = { sessionId: s ? s.id : '' };
    if (s && s.teamId && (await P.teamById(s.teamId))) patch.teamId = s.teamId;
    Object.assign(SET, await api.setSettings(patch));
    if (patch.teamId) Calc.setTeams(patch.teamId);
    F.scope = s ? 'session' : 'all';
    if (s) { const all = await list(); const x = all.find(y => y.id === s.id); if (x) { x.used = Date.now(); await save(all); } }
    await paintButton();
    load();
  }

  $('#sessBtn').addEventListener('click', () => Start.show());
  DB.onChange(k => { if (k === 'sesiones') paintButton(); });
  paintButton();
  return { list, save, current, open, paintButton };
})();
