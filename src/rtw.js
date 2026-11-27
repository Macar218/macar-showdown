'use strict';
/*
 * Macar Showdown · importar tus Excel de «Road to Worlds» (plan de sesiones y torneos) una sola vez.
 * Se buscan las columnas por su título (no por su letra), así que vale aunque muevas alguna. Del plan: semanas (foco,
 * objetivo de horas y nota), sesiones (tipo, previsto, real, minutos por pilar, objetivo, cumplido y notas),
 * regulaciones y ajustes; de torneos: cada torneo con sus gastos de viaje y el tipo de cambio. Las filas de ejemplo
 * («Ej: …») no se traen. Los ids salen de la fila, así que importar otra vez sustituye en lugar de duplicar.
 */
const X = require('./xlsx');
const Season = require('../renderer/season');

const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%/+]+/g, ' ').trim();
/** Fila de títulos (la primera que tenga todos esos títulos) y la columna de cada uno (la primera que empiece así). */
function header(rows, want) {
  for (const r of rows) {
    const cols = {};
    for (const [k, w] of Object.entries(want)) {
      const c = Object.keys(r).filter(x => x !== 'n').sort((a, b) => a.length - b.length || a.localeCompare(b)).find(x => norm(r[x]).startsWith(norm(w)));
      if (c) cols[k] = c;
    }
    if (Object.keys(want).every(k => cols[k] || want[k].req === false)) return { row: r.n, cols };
  }
  return null;
}
// Títulos de cada columna (req = tiene que estar).
const H = (t, req = true) => Object.assign(new String(t), { req });

const DAY = v => (typeof v === 'number' ? X.excelDay(v) : /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(v || '').trim()) ? String(v).trim().split('/').reverse().map(x => x.padStart(2, '0')).join('-') : '');
const TXT = v => (v == null ? '' : String(v).replace(/\r\n/g, '\n').trim());
const NUM = v => (typeof v === 'number' ? v : +String(v || '').replace(',', '.') || 0);
const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const sessName = d => { const x = Season.parseDay(d); return `Sesión ${x.getDate()} ${MES[x.getMonth()]} ${x.getFullYear()}`; };

const typeOf = v => { const n = norm(v); const t = Season.TYPES.find(x => norm(x.n) === n) || Season.TYPES.find(x => n && norm(x.n).startsWith(n.split(' ')[0]) && n.includes('serio') === x.k.includes('serious')); return t ? t.k : 'play'; };
const focusOf = v => { const n = norm(v); if (!n) return ''; if (n.startsWith('mix')) return 'mix'; if (n.startsWith('tb')) return 'tb'; if (n.includes('serio')) return 'serious'; if (n.startsWith('jug')) return 'play'; if (n.startsWith('anal')) return 'an'; return ''; };
const tierOf = v => { const n = norm(v); if (n.startsWith('league challenge')) return 'lc'; if (n.startsWith('league cup')) return 'cup'; if (n.startsWith('online')) return 'online'; if (n.startsWith('regional') || n.startsWith('special')) return 'regional'; if (n.startsWith('international')) return 'intl'; if (n.startsWith('world')) return 'worlds'; if (n.startsWith('limitless')) return 'limitless'; return 'other'; };
const isExample = v => /^ej[:.]/i.test(String(v || '').trim());

/** Excel del plan (hojas Semanas, Sesiones, Regulaciones y Ajustes). */
function plan(book) {
  const out = { sessions: [], weeks: {}, regs: [], cfg: {} };
  const ss = X.rows(book.Sesiones);
  const h = header(ss, { week: H('Semana'), type: H('Tipo de sesion'), pday: H('Fecha prevista'), pdur: H('Duracion prevista'), rday: H('Fecha real'), rdur: H('Duracion real'), tb: H('TB / Teoria', false), play: H('Jugar', false), serious: H('Juego serio', false), an: H('Analisis', false), goal: H('Objetivo', false), ok: H('Cumplido', false), notes: H('Notas de lo', false), other: H('Otras notas', false) });
  if (h) {
    const c = h.cols;
    for (const r of ss.filter(x => x.n > h.row)) {
      const type = TXT(r[c.type]), rdRaw = r[c.rday];
      if (!type && rdRaw == null) continue;
      const day = DAY(r[c.pday]), skip = /saltad|skip/i.test(String(rdRaw || ''));
      const realDay = skip ? '' : DAY(rdRaw);
      if (!day && !realDay) continue;
      const s = {
        id: `x${typeof r[c.week] === 'number' ? r[c.week] : 'w'}r${r.n}`, from: 'excel',
        name: sessName(realDay || day), goal: TXT(r[c.goal]).slice(0, 300), teamId: '', type: typeOf(type),
        day: day || '', planMin: day ? Season.parseDur(r[c.pdur]) : 0,
        state: skip ? 'skip' : realDay ? 'done' : 'plan',
        realDay, realMin: realDay ? Season.parseDur(r[c.rdur]) : 0, min: null,
        ok: r[c.ok] === '✔' ? true : r[c.ok] === '✘' ? false : null,
        notes: TXT(r[c.notes]).slice(0, 4000), other: TXT(r[c.other]).slice(0, 4000), lesson: '',
        created: Date.now(), up: Date.now()
      };
      if (realDay) {
        const m = { tb: NUM(r[c.tb]), play: NUM(r[c.play]), serious: NUM(r[c.serious]), an: NUM(r[c.an]) };
        if (Season.sum(m) > 0) s.min = m;
        if (!s.realMin) s.realMin = Season.sum(m);
      }
      out.sessions.push(s);
    }
  }
  const ws = X.rows(book.Semanas);
  const hw = header(ws, { week: H('Semana'), focus: H('Foco'), target: H('Minimo', false), note: H('Nota de la semana', false) });
  if (hw) {
    const c = hw.cols;
    for (const r of ws.filter(x => x.n > hw.row)) {
      const k = DAY(r[c.week]);
      if (!k) continue;
      const w = {};
      const f = focusOf(r[c.focus]); if (f) w.focus = f;
      if (c.target && typeof r[c.target] === 'number' && r[c.target] > 0) w.target = r[c.target];
      if (c.note && TXT(r[c.note])) w.note = TXT(r[c.note]).slice(0, 2000);
      // El objetivo de horas solo si esa semana tiene algo (las de después venían con el mínimo por defecto).
      const used = w.focus || w.note || out.sessions.some(x => Season.weekOf(x.realDay || x.day) === Season.weekOf(k));
      if (used) out.weeks[Season.weekOf(k)] = w;
    }
  }
  const rs = X.rows(book.Regulaciones);
  const hr = header(rs, { name: H('Regulacion'), start: H('Inicio'), end: H('Fin'), goal: H('Objetivo', false), ok: H('Objetivo cumplido', false), result: H('Resultado final', false), tb: H('TB / Teoria', false), play: H('Jugar', false), serious: H('Juego serio', false), an: H('Analisis', false), error: H('Error mas repetido', false), impr: H('Impresiones', false), change: H('Que cambiaria', false) });
  if (hr) {
    const c = hr.cols;
    for (const r of rs.filter(x => x.n > hr.row)) {
      const name = TXT(r[c.name]), start = DAY(r[c.start]);
      if (!name || !start) continue;
      const okv = norm(r[c.ok]);
      out.regs.push({
        id: `xr${norm(name).replace(/ /g, '')}`, name: name.slice(0, 60), start, end: DAY(r[c.end]), goal: TXT(r[c.goal]).slice(0, 500),
        ok: okv.startsWith('s') || r[c.ok] === '✔' ? true : okv.startsWith('n') || r[c.ok] === '✘' ? false : null, result: TXT(r[c.result]).slice(0, 300),
        eval: { tb: TXT(r[c.tb]), play: TXT(r[c.play]), serious: TXT(r[c.serious]), an: TXT(r[c.an]) }, error: TXT(r[c.error]).slice(0, 300), impr: TXT(r[c.impr]).slice(0, 2000), change: TXT(r[c.change]).slice(0, 2000)
      });
      for (const k of ['tb', 'play', 'serious', 'an']) if (typeof out.regs[out.regs.length - 1].eval[k] === 'string' && /^\d/.test(out.regs[out.regs.length - 1].eval[k])) out.regs[out.regs.length - 1].eval[k] = '';
    }
  }
  // Ajustes: el título es el primer texto de la fila y el valor, el primer número que va detrás.
  const after = (r, col) => { const ks = Object.keys(r).filter(x => x !== 'n' && (x.length > col.length || (x.length === col.length && x > col))).sort((a, b) => a.length - b.length || a.localeCompare(b)); const c = ks.find(x => typeof r[x] === 'number'); return c ? r[c] : null; };
  const label = r => Object.keys(r).filter(x => x !== 'n' && typeof r[x] === 'string').sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
  for (const r of X.rows(book.Ajustes)) {
    const lc = label(r);
    if (!lc) continue;
    const k = norm(r[lc]), v = after(r, lc);
    if (typeof v !== 'number') continue;
    if (k.startsWith('media objetivo')) out.cfg.avg = v;
    else if (k.startsWith('verde desde')) (out.cfg.green = out.cfg.green || [30, 50])[0] = Math.round(v <= 1 ? v * 100 : v);
    else if (k.startsWith('verde hasta')) (out.cfg.green = out.cfg.green || [30, 50])[1] = Math.round(v <= 1 ? v * 100 : v);
    else if (k.startsWith('amarillo desde')) (out.cfg.yellow = out.cfg.yellow || [20, 60])[0] = Math.round(v <= 1 ? v * 100 : v);
    else if (k.startsWith('amarillo hasta')) (out.cfg.yellow = out.cfg.yellow || [20, 60])[1] = Math.round(v <= 1 ? v * 100 : v);
    else if (k.startsWith('max dias')) out.cfg.gap = v;
  }
  return out;
}

/** Excel de torneos (hojas Simulador, Costes y CP y Premios). */
function tours(book) {
  const out = { tours: [], cfg: {} };
  for (const r of X.rows(book['CP y Premios'])) for (const [k, v] of Object.entries(r)) {
    if (k === 'n' || !norm(v).startsWith('tipo de cambio')) continue;
    const c = Object.keys(r).filter(x => x !== 'n' && (x.length > k.length || (x.length === k.length && x > k)) && typeof r[x] === 'number').sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
    if (c && r[c] > 0 && r[c] < 10) out.cfg.rate = r[c];
  }
  const cs = X.rows(book['Costes Reg-Internacional']);
  const hc = header(cs, { name: H('Evento'), date: H('Fecha', false), travel: H('Transporte', false), lodging: H('Alojamiento', false), entry: H('Entrada', false), food: H('Comida', false), other: H('Otros', false), notes: H('Notas', false) });
  const costs = {};
  if (hc) for (const r of cs.filter(x => x.n > hc.row)) {
    const c = hc.cols, name = TXT(r[c.name]);
    if (!name || isExample(name)) continue;
    costs[norm(name)] = { date: DAY(r[c.date]), travel: NUM(r[c.travel]), lodging: NUM(r[c.lodging]), food: NUM(r[c.food]), other: NUM(r[c.other]), entry: NUM(r[c.entry]), notes: TXT(r[c.notes]) };
  }
  const ts = X.rows(book.Simulador);
  const ht = header(ts, { num: H('N'), name: H('Evento'), tier: H('Tier'), mode: H('Modalidad', false), players: H('Asistentes', false), place: H('Puesto', false), entry: H('Entrada', false), extra: H('Premio extra', false), notes: H('Notas del evento', false) });
  if (ht) for (const r of ts.filter(x => x.n > ht.row)) {
    const c = ht.cols, name = TXT(r[c.name]);
    if (typeof r[c.num] !== 'number' || !name || isExample(name) || !r[c.tier]) continue; // solo las filas numeradas (no el resumen)
    const k = costs[norm(name)] || {};
    out.tours.push({
      id: `xt${norm(name).replace(/ /g, '').slice(0, 40)}`, from: 'excel', name: name.slice(0, 100), date: k.date || '', tier: tierOf(r[c.tier]),
      mode: /online/i.test(String(r[c.mode] || '')) ? 'online' : 'inperson', players: NUM(r[c.players]) || '', place: NUM(r[c.place]) || '', cp: null,
      entry: NUM(r[c.entry]) || k.entry || 0, extra: NUM(r[c.extra]), costs: { travel: k.travel || 0, lodging: k.lodging || 0, food: k.food || 0, other: k.other || 0 },
      notes: [TXT(r[c.notes]), k.notes].filter(Boolean).join(' · ').slice(0, 2000), teamId: ''
    });
  }
  return out;
}

/** Un archivo: qué es (plan o torneos) y lo que trae. */
function parse(buf) {
  const book = X.read(buf);
  if (book.Sesiones || book.Semanas) return { kind: 'plan', ...plan(book) };
  if (book.Simulador) return { kind: 'tours', ...tours(book) };
  throw new Error('No parece un Excel del plan ni de torneos (faltan las hojas «Sesiones» o «Simulador»).');
}

module.exports = { parse, plan, tours };
