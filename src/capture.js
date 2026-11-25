'use strict';
const { SDAPP } = require('./sdapp');
/*
 * Macar Showdown · captura automática.
 * Cada pocos segundos se pregunta al cliente de Showdown (la página cargada en el webview) qué combates
 * tiene abiertos y cuáles han terminado. De los terminados se pide el registro completo y se guarda.
 * Si el registro crece después (por ejemplo, llega el cambio de ELO), se vuelve a guardar.
 */

const PROBE = `(() => {
  try {
    const a = ${SDAPP};
    if (!a || !a.rooms) return { ok: false, why: 'Showdown aún no ha cargado' };
    const rooms = [];
    for (const id in a.rooms) {
      const r = a.rooms[id], b = r && r.battle;
      if (!b || !Array.isArray(b.stepQueue)) continue;
      const q = b.stepQueue;
      let fin = b.ended === true;
      for (let i = q.length - 1; !fin && i >= Math.max(0, q.length - 60); i--) if (/^\\|(win|tie)\\|/.test(q[i])) fin = true;
      rooms.push({ id, n: q.length, fin });
    }
    let me = null;
    try { me = a.user && a.user.get ? a.user.get('name') : null; } catch (e) {}
    return { ok: true, me, rooms };
  } catch (e) { return { ok: false, why: String((e && e.message) || e) }; }
})()`;

const GET = id => `(() => {
  const a = ${SDAPP}, r = a && a.rooms && a.rooms[${JSON.stringify(id)}];
  return r && r.battle && Array.isArray(r.battle.stepQueue) ? r.battle.stepQueue.join('\\n') : null;
})()`;

/** Lee de la página de Showdown con límite de tiempo: si no responde, no se queda colgada la captura. */
function run(contents, js, ms = 5000) {
  let t;
  return Promise.race([contents.executeJavaScript(js, false), new Promise((_, rej) => { t = setTimeout(() => rej(new Error('Showdown no responde')), ms); })]).finally(() => clearTimeout(t));
}

function attach(contents, onFinished, intervalMs = 3000) {
  const seen = new Map();
  const status = { ok: false, why: 'Iniciando…', me: null, open: 0, finished: 0, saved: 0, lastCheck: null, lastSaved: null };
  let busy = false;
  const tick = async () => {
    if (busy || contents.isDestroyed()) return;
    busy = true;
    try {
      const r = await run(contents, PROBE);
      status.lastCheck = Date.now();
      status.ok = !!(r && r.ok);
      status.why = r && r.why ? r.why : null;
      if (r && r.ok) {
        status.me = r.me;
        status.open = r.rooms.length;
        status.finished = r.rooms.filter(x => x.fin).length;
        for (const room of r.rooms) {
          if (!room.fin || room.n <= (seen.get(room.id) || 0)) continue;
          const log = await run(contents, GET(room.id), 15000);
          if (!log) continue;
          seen.set(room.id, room.n);
          const res = onFinished({ id: room.id, log, clientName: r.me });
          if (res && res.saved) { status.saved++; status.lastSaved = Date.now(); }
        }
      }
    } catch (e) {
      status.ok = false;
      status.why = String((e && e.message) || e);
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(tick, intervalMs);
  contents.once('destroyed', () => clearInterval(timer));
  return status;
}

module.exports = { attach, run, PROBE, GET };
