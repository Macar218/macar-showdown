'use strict';
/*
 * Macar Showdown · plan de temporada (cálculos, sin pantalla). También se usa en Node para las pruebas.
 *
 * Cuatro pilares: TB / Teoría (tb), Jugar (play), Juego serio (serious) y Análisis (an). Estudio = TB + Análisis.
 * Cada semana (lunes) lleva tu objetivo de horas, el foco y lo que quieres hacer; cada sesión, su tipo (que reparte
 * los minutos entre los pilares), lo previsto (día y duración) y lo real (día, duración y minutos por pilar).
 * Torneos: CP y premio oficial por puesto (tabla de la temporada, con el cupo mínimo de jugadores) y el Best Finish
 * Limit de cada grupo.
 *
 * Datos:
 *   plan = { cfg: {avg, green:[a,b], yellow:[a,b], gap, rate, split}, weeks: {lunes: {target, focus, want, note}},
 *            regs: [{id, name, start, end, goal, ok, result, eval: {tb, play, serious, an}, error, impr, change}] }
 *   sesión = { id, name, goal, teamId, type, day, planMin, state: plan|open|done|skip, realDay, realMin,
 *              min: {tb, play, serious, an} | null, track: {…} (minutos medidos por la app), ok, notes, other, lesson }
 *   torneo = { id, name, date, tier, mode, players, place, cp (null = el de la tabla), entry, extra,
 *              costs: {travel, lodging, food, other}, notes, teamId }
 */

const Season = (() => {
  const PILLARS = [['tb', 'TB / Teoría'], ['play', 'Jugar'], ['serious', 'Juego serio'], ['an', 'Análisis']];
  const PK = PILLARS.map(p => p[0]);
  /** Tipos de sesión y cómo reparten los minutos (partes). */
  const TYPES = [
    { k: 'play', n: 'Jugar + Análisis', d: 'Volumen: probar equipos y revisar. Parte del análisis puede ser ver Bo3 de pros prediciendo cada turno.', parts: { play: 3, an: 1 } },
    { k: 'serious', n: 'Juego serio + Análisis', d: 'Bo3 como en torneo. Antes: 4 elegidos, lead y forma de ganar en el objetivo.', parts: { serious: 2, an: 1 } },
    { k: 'tbplay', n: 'TB/Teoría + Jugar + Análisis', d: 'Montar o ajustar un equipo, probarlo y revisar qué ha fallado.', parts: { tb: 4, play: 3, an: 1 } },
    { k: 'tb', n: 'Solo TB/Teoría', d: 'Toda la sesión para team building o teoría (también herramientas de estudio).', parts: { tb: 1 } },
    { k: 'coach', n: 'Coaching', d: 'Mejor tras un juego serio. Lleva replays y lo que marcaste para analizar.', parts: { an: 1 } },
    { k: 'tour', n: 'Torneo', d: 'Un torneo (online o presencial). Cuenta como juego serio.', parts: { serious: 1 } }
  ];
  const TYPE = Object.fromEntries(TYPES.map(t => [t.k, t]));
  const FOCUS = [['', '—'], ['mix', 'Mixta'], ['tb', 'TB / Teoría'], ['play', 'Jugar'], ['serious', 'Juego serio'], ['an', 'Análisis']];
  const DURS = [30, 45, 60, 90, 120, 150, 180, 210, 240];
  const CFG = { avg: 8, green: [30, 50], yellow: [20, 60], gap: 3, rate: 1.08 };

  /* ---------- fechas (día local 'AAAA-MM-DD') ---------- */
  const pad = n => String(n).padStart(2, '0');
  const dayOf = t => { const d = t instanceof Date ? t : new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const parseDay = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return dayOf(d); };
  /** Lunes de la semana de ese día. */
  const weekOf = s => { const d = parseDay(isDay(s) ? s : dayOf(s)); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return dayOf(d); };
  const diffDays = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);
  const today = () => dayOf(Date.now());

  const cfgOf = plan => ({ ...CFG, ...((plan && plan.cfg) || {}) });
  const zero = () => ({ tb: 0, play: 0, serious: 0, an: 0 });
  const sum = m => PK.reduce((a, k) => a + (+m[k] || 0), 0);

  /** Reparte los minutos según el tipo, de 5 en 5 (el juego a la baja, el análisis al alza) y que sumen el total. */
  function split(min, type, partsOver) {
    const out = zero();
    min = Math.max(0, Math.round(+min || 0));
    const parts = partsOver || (TYPE[type] || TYPE.play).parts;
    const keys = PK.filter(k => parts[k] > 0);
    if (!min || !keys.length) return out;
    const tot = keys.reduce((a, k) => a + parts[k], 0);
    for (const k of keys) { const raw = (min * parts[k]) / tot; out[k] = k === 'an' ? Math.ceil(raw / 5) * 5 : Math.floor(raw / 5) * 5; }
    const diff = min - sum(out);
    if (diff) { const big = keys.slice().sort((a, b) => parts[b] - parts[a])[0]; out[big] = Math.max(0, out[big] + diff); }
    return out;
  }
  const round5 = n => Math.round((+n || 0) / 5) * 5;

  /** Estado de una sesión (las de antes de la 0.22, sin estado: hecha, o abierta si es la de ahora). */
  const stateOf = (s, openId) => s.state || (s.id === openId ? 'open' : 'done');
  /** Día en que cuenta una sesión: el real si está hecha (o abierta), si no el previsto; las antiguas, el de creación. */
  function dayCount(s, openId) {
    const st = stateOf(s, openId);
    if (st === 'done' || st === 'open') return s.realDay || s.day || (s.created ? dayOf(s.created) : '');
    return s.day || (s.created ? dayOf(s.created) : '');
  }
  /** Minutos medidos por la app (redondeados). */
  const tracked = s => { const t = s.track || {}; const o = zero(); for (const k of PK) o[k] = Math.round(+t[k] || 0); return o; };
  /** Minutos jugados estimados por las partidas de la sesión (para las sesiones antiguas sin minutos). */
  function estimate(s, matches) {
    const ms = (matches || []).filter(m => m.session === s.id && m.me);
    return Math.round(ms.reduce((a, m) => a + ((m.turns || 8) * 50 + 120) / 60, 0));
  }
  /**
   * Minutos reales de una sesión hecha o abierta, por pilar: los que pusiste, los medidos o la duración real
   * repartida según el tipo; las antiguas, lo jugado según sus partidas. est = true si son estimados.
   */
  function realMin(s, matches, openId) {
    const st = stateOf(s, openId);
    if (st !== 'done' && st !== 'open') return { ...zero(), total: 0, est: false };
    if (s.min && sum(s.min) > 0) return { ...pick(s.min), total: sum(s.min), est: false };
    if (s.realMin > 0) { const m = split(s.realMin, s.type); return { ...m, total: sum(m), est: false }; }
    const t = tracked(s);
    if (sum(t) > 0) return { ...t, total: sum(t), est: false };
    const e = estimate(s, matches);
    return { ...zero(), play: e, total: e, est: true };
  }
  const pick = m => { const o = zero(); for (const k of PK) o[k] = Math.max(0, Math.round(+m[k] || 0)); return o; };
  /** Minutos previstos de una sesión planeada (también de las hechas que estaban previstas). */
  const planMin = s => (s.planMin > 0 ? split(s.planMin, s.type) : zero());

  /** Todo lo de una semana: objetivo, previsto, hecho, minutos por pilar y sesiones. */
  function week(k, sessions, plan, matches, openId) {
    const cfg = cfgOf(plan), w = ((plan && plan.weeks) || {})[k] || {};
    const end = addDays(k, 6);
    const inW = d => d && d >= k && d <= end;
    // Las que cuentan aquí: hechas esta semana o previstas para esta semana (una prevista y hecha otra semana sale en las dos).
    const uniq = sessions.filter(s => inW(dayCount(s, openId)) || inW(s.day));
    const done = zero(), prev = zero();
    let doneN = 0, planN = 0;
    for (const s of uniq) {
      const st = stateOf(s, openId);
      if (s.planMin > 0 && inW(s.day) && st !== 'skip') { const p = planMin(s); for (const x of PK) prev[x] += p[x]; planN++; }
      if ((st === 'done' || st === 'open') && inW(dayCount(s, openId))) { const r = realMin(s, matches, openId); for (const x of PK) done[x] += r[x]; doneN++; }
    }
    const target = w.target != null && w.target !== '' ? +w.target : cfg.avg;
    const doneH = sum(done) / 60, prevH = sum(prev) / 60;
    return {
      k, end, target, focus: w.focus || '', want: w.want || '', note: w.note || '',
      done, prev, doneH, prevH, doneN, planN,
      progress: target > 0 ? Math.min(1, doneH / target) : 0,
      planOk: prevH > 0 ? doneH / prevH : null,
      sessions: uniq.sort((a, b) => (dayCount(a, openId) || '').localeCompare(dayCount(b, openId) || '') || (a.created || 0) - (b.created || 0))
    };
  }
  /** Estudio (TB + Análisis) de las últimas 3 semanas hasta k: real y previsto (lo hecho en las pasadas, lo planeado en la de k si aún no ha acabado). */
  function study(k, sessions, plan, matches, openId) {
    const ks = [addDays(k, -14), addDays(k, -7), k];
    const real = zero(), prev = zero();
    for (const x of ks) {
      const w = week(x, sessions, plan, matches, openId);
      for (const p of PK) real[p] += w.done[p];
      const src = x === k && w.end >= today() ? w.prev : w.done;
      for (const p of PK) prev[p] += src[p];
    }
    const r = (m) => { const t = sum(m); return t ? (m.tb + m.an) / t : null; };
    return { real: r(real), prev: r(prev) };
  }
  /** Semáforo del estudio: good (verde), warn (amarillo) o bad (rojo); '' sin datos. */
  function light(v, plan) {
    if (v == null) return '';
    const c = cfgOf(plan), p = v * 100;
    if (p >= c.green[0] && p <= c.green[1]) return 'good';
    if (p >= c.yellow[0] && p <= c.yellow[1]) return 'warn';
    return 'bad';
  }
  /** El foco que toca según el estudio (como las reglas del plan). */
  function advice(v, plan) {
    const l = light(v, plan);
    if (!l) return '';
    if (l === 'good') return 'Equilibrio bien: foco libre.';
    const hi = v * 100 > cfgOf(plan).green[1];
    if (l === 'warn') return hi ? 'Mucho estudio: se recomienda foco Jugar.' : 'Poco estudio: se recomienda más Análisis antes de jugar más.';
    return hi ? 'Demasiado estudio: esta semana, foco Jugar.' : 'Muy poco estudio: esta semana, foco Análisis o TB.';
  }
  /** Último día en que jugaste (partidas tuyas o sesiones con minutos de juego) y días desde entonces. */
  function lastPlay(sessions, matches, openId, now) {
    let last = '';
    for (const m of matches || []) if (m.me && m.endedAt) { const d = dayOf(m.endedAt); if (d > last) last = d; }
    for (const s of sessions) {
      const st = stateOf(s, openId);
      if (st !== 'done' && st !== 'open') continue;
      const r = realMin(s, matches, openId);
      if (r.play + r.serious > 0 && !r.est) { const d = dayCount(s, openId); if (d > last) last = d; }
    }
    return { last, days: last ? Math.max(0, diffDays(last, now || today())) : null };
  }
  /** La próxima sesión prevista (hoy o después). */
  function next(sessions, now) {
    const d = now || today();
    return sessions.filter(s => s.state === 'plan' && s.day && s.day >= d).sort((a, b) => a.day.localeCompare(b.day) || (a.created || 0) - (b.created || 0))[0] || null;
  }
  /** Sesiones previstas de días que ya pasaron sin hacerlas (para cerrarlas o saltarlas). */
  const pendingPast = (sessions, now) => sessions.filter(s => s.state === 'plan' && s.day && s.day < (now || today()));

  /** Regulación: sus semanas y números (horas, media por semana cerrada, semanas con el objetivo, plan, estudio, reparto). */
  function reg(r, sessions, plan, matches, openId, now) {
    const t = now || today();
    if (!isDay(r.start)) return null;
    const endDay = isDay(r.end) ? r.end : t;
    const ks = [];
    for (let k = weekOf(r.start); k <= endDay && ks.length < 120; k = addDays(k, 7)) ks.push(k);
    const tot = zero(); let prevH = 0, closed = 0, met = 0, doneH = 0;
    for (const k of ks) {
      const w = week(k, sessions, plan, matches, openId);
      for (const p of PK) tot[p] += w.done[p];
      doneH += w.doneH; prevH += w.prevH;
      if (w.end < t) { closed++; if (w.doneH >= w.target && w.target > 0) met++; }
    }
    const all = sum(tot);
    return { weeks: ks, doneH, avg: closed ? weeksAvg(ks, sessions, plan, matches, openId, t) : null, closed, met, planOk: prevH ? doneH / prevH : null, study: all ? (tot.tb + tot.an) / all : null, split: tot };
  }
  function weeksAvg(ks, sessions, plan, matches, openId, t) {
    const c = ks.filter(k => addDays(k, 6) < t);
    if (!c.length) return null;
    return c.reduce((a, k) => a + week(k, sessions, plan, matches, openId).doneH, 0) / c.length;
  }
  /** Regulación de un día (por fechas). */
  const regOf = (plan, d) => ((plan && plan.regs) || []).find(r => isDay(r.start) && d >= r.start && (!isDay(r.end) || d <= r.end)) || null;

  /* ---------- torneos ---------- */
  /** Tabla de la temporada 2026 (categoría Masters): [tier, desde, hasta, CP, cupo mínimo, premio oficial en $]. */
  const CP_TABLE = [
    ['lc', 1, 1, 15, 0, 0], ['lc', 2, 2, 12, 4, 0], ['lc', 3, 4, 10, 8, 0], ['lc', 5, 8, 8, 14, 0], ['lc', 9, 16, 6, 25, 0], ['lc', 17, 32, 4, 48, 0],
    ['cup', 1, 1, 50, 0, 0], ['cup', 2, 2, 40, 4, 0], ['cup', 3, 4, 32, 8, 0], ['cup', 5, 8, 25, 17, 0], ['cup', 9, 16, 20, 48, 0], ['cup', 17, 32, 16, 80, 0], ['cup', 33, 64, 13, 128, 0],
    ['online', 1, 1, 75, 0, 0], ['online', 2, 2, 65, 8, 0], ['online', 3, 4, 54, 17, 0], ['online', 5, 8, 52, 33, 0], ['online', 9, 16, 25, 48, 0], ['online', 17, 32, 13, 65, 0], ['online', 33, 64, 11, 128, 0], ['online', 65, 128, 7, 257, 0], ['online', 129, 256, 5, 513, 0], ['online', 257, 512, 4, 1025, 0], ['online', 513, 1024, 3, 2049, 0],
    ['regional', 1, 1, 350, 0, 6000], ['regional', 2, 2, 325, 4, 4000], ['regional', 3, 4, 300, 8, 2000], ['regional', 5, 8, 280, 17, 1000], ['regional', 9, 16, 200, 33, 750], ['regional', 17, 32, 160, 65, 0], ['regional', 33, 64, 120, 129, 0], ['regional', 65, 128, 80, 257, 0], ['regional', 129, 256, 60, 513, 0], ['regional', 257, 512, 40, 1025, 0], ['regional', 513, 1024, 20, 2049, 0],
    ['intl', 1, 1, 500, 0, 15000], ['intl', 2, 2, 480, 4, 10000], ['intl', 3, 4, 420, 8, 7000], ['intl', 5, 8, 380, 17, 5000], ['intl', 9, 16, 300, 33, 3000], ['intl', 17, 32, 240, 65, 2000], ['intl', 33, 64, 180, 129, 0], ['intl', 65, 128, 140, 257, 0], ['intl', 129, 256, 100, 513, 0], ['intl', 257, 512, 80, 1025, 0], ['intl', 513, 1024, 40, 2049, 0],
    ['worlds', 1, 1, 0, 0, 30000], ['worlds', 2, 2, 0, 0, 20000], ['worlds', 3, 4, 0, 0, 15000], ['worlds', 5, 8, 0, 0, 10000], ['worlds', 9, 16, 0, 0, 5000], ['worlds', 17, 64, 0, 0, 0]
  ];
  /** Tiers: nombre, grupo del Best Finish Limit y si da CP. Regional e International comparten grupo (5 mejores). */
  const TIERS = [
    { k: 'lc', n: 'League Challenge', g: 'lc', off: true },
    { k: 'cup', n: 'League Cup', g: 'cup', off: true },
    { k: 'online', n: 'Online (Global/Grand Challenge)', g: 'online', off: true },
    { k: 'regional', n: 'Regional/Special Championship', g: 'ri', off: true },
    { k: 'intl', n: 'International Championship', g: 'ri', off: true },
    { k: 'worlds', n: 'World Championship', g: 'worlds', off: true },
    { k: 'limitless', n: 'Limitless (no oficial)', g: 'none', off: false },
    { k: 'other', n: 'Otro (sin CP)', g: 'none', off: false }
  ];
  const TIER = Object.fromEntries(TIERS.map(t => [t.k, t]));
  const GROUPS = [['lc', 'League Challenge', 4], ['cup', 'League Cup', 4], ['online', 'Online', 4], ['ri', 'Regional + International', 5], ['worlds', 'World Championship', 1]];
  /** CP y premio oficial ($) de la tabla por tier y puesto, con el cupo mínimo de jugadores (sin asistentes, no se comprueba). */
  function cpFor(tier, place, players) {
    const p = +place;
    if (!p || !TIER[tier] || !TIER[tier].off) return { cp: 0, usd: 0, kick: false };
    const row = CP_TABLE.find(r => r[0] === tier && p >= r[1] && p <= r[2]);
    if (!row) return { cp: 0, usd: 0, kick: false };
    if (players && +players < row[4]) return { cp: 0, usd: 0, kick: true };
    return { cp: row[3], usd: row[5], kick: false };
  }
  /** Temporada VGC de un día: de septiembre a agosto (sep 2026 – ago 2027 = temporada 2027). */
  const seasonOf = d => { const x = parseDay(d); return x.getMonth() >= 8 ? x.getFullYear() + 1 : x.getFullYear(); };
  const costOf = t => { const c = t.costs || {}; return ['travel', 'lodging', 'food', 'other'].reduce((a, k) => a + (+c[k] || 0), 0); };
  /** Un torneo con sus números: CP (el tuyo o el de la tabla), premio oficial en €, coste total y beneficio. */
  function tour(t, plan) {
    const c = cfgOf(plan), tb = cpFor(t.tier, t.place, t.players);
    const cp = t.cp != null && t.cp !== '' ? +t.cp : tb.cp;
    const prize = tb.usd / (c.rate || 1);
    const cost = (+t.entry || 0) + costOf(t);
    const won = prize + (+t.extra || 0);
    return { ...t, cpCalc: tb.cp, cp, kick: tb.kick, prize, won, cost, net: won - cost, off: !!(TIER[t.tier] && TIER[t.tier].off), group: (TIER[t.tier] || TIER.other).g };
  }
  /** Resumen de temporada con el Best Finish Limit de cada grupo. */
  function seasonSum(list, plan) {
    const ts = list.map(t => tour(t, plan));
    const groups = GROUPS.map(([g, n, bfl]) => {
      const inG = ts.filter(t => t.group === g).sort((a, b) => b.cp - a.cp || String(a.date).localeCompare(String(b.date)));
      const count = inG.slice(0, bfl);
      return { g, n, bfl, played: inG.length, counted: count.length, cp: count.reduce((a, t) => a + t.cp, 0), ids: count.map(t => t.id) };
    });
    const invite = ts.some(t => (t.tier === 'regional' && +t.place === 1) || (t.tier === 'intl' && +t.place >= 1 && +t.place <= 4));
    return {
      list: ts, groups, cp: groups.reduce((a, g) => a + g.cp, 0), n: ts.length, off: ts.filter(t => t.off).length,
      won: ts.reduce((a, t) => a + t.won, 0), cost: ts.reduce((a, t) => a + t.cost, 0), net: ts.reduce((a, t) => a + t.net, 0), invite
    };
  }

  /** Duración en texto: 90 → «1h30». */
  const dur = m => { m = Math.round(+m || 0); const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h${r ? pad(r) : ''}` : `${r}'`; };
  /** «2h30», «1h», «45'», «1:30», «90» → minutos. */
  function parseDur(v) {
    if (typeof v === 'number') return v < 1 ? Math.round(v * 1440) : Math.round(v); // fracción de día (Excel) o minutos
    const s = String(v || '').trim().toLowerCase();
    let m = s.match(/^(\d+)\s*h\s*(\d+)?/); if (m) return +m[1] * 60 + (+m[2] || 0);
    m = s.match(/^(\d+):(\d{2})/); if (m) return +m[1] * 60 + +m[2];
    m = s.match(/^(\d+)\s*['m]?$/); if (m) return +m[1];
    return 0;
  }

  return { PILLARS, PK, TYPES, TYPE, FOCUS, DURS, CFG, CP_TABLE, TIERS, TIER, GROUPS, dayOf, isDay, parseDay, addDays, weekOf, diffDays, today, cfgOf, zero, sum, split, round5, stateOf, dayCount, tracked, realMin, planMin, estimate, week, study, light, advice, lastPlay, next, pendingPast, reg, regOf, cpFor, seasonOf, tour, seasonSum, dur, parseDur };
})();
if (typeof module !== 'undefined') module.exports = Season;
