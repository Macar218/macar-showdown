/* Macar Showdown · estadísticas a partir de los resúmenes de partida. Sirve en la interfaz y en Node (tests). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Stats = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const toID = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const DAY = 864e5;
  const mine = s => (s.me ? s[s.me] : null);
  const theirs = s => (s.opp ? s[s.opp] : null);
  const leadKey = arr => (arr || []).slice(0, 2).slice().sort().join(' + ');

  /** Solo cuentan las partidas en las que sé quién soy y que han terminado. */
  const usable = ms => ms.filter(s => s.me && s.result);

  function filter(ms, f = {}) {
    const now = Date.now();
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    return usable(ms).filter(s => {
      if (f.result && f.result !== 'all' && s.result !== f.result) return false;
      if (f.days === 1 && s.endedAt < midnight.getTime()) return false;
      if (f.days > 1 && s.endedAt < now - f.days * DAY) return false;
      if (f.format && s.formatId !== f.format) return false;
      if (f.ids && !f.ids.has(s.id)) return false;
      const me = mine(s), op = theirs(s);
      // Lead: un Pokémon («Garchomp») o una pareja («Garchomp + Kingambit»).
      const inLead = (leads, v) => (v.includes(' + ') ? leadKey(leads) === v : leads.includes(v));
      if (f.lead && !inLead(me.leads, f.lead)) return false;
      if (f.back && !(me.brought.includes(f.back) && !me.leads.includes(f.back))) return false;
      if (f.rival && !op.preview.includes(f.rival) && !op.brought.includes(f.rival)) return false;
      if (f.oppLead && !inLead(op.leads, f.oppLead)) return false;
      if (f.minElo && !(op.rating >= f.minElo)) return false;
      if (f.team && f.teamOf && f.teamOf(s) !== f.team) return false;
      if (f.session && f.session !== 'all' && (s.session || '-') !== f.session) return false;
      if (f.from && s.endedAt < f.from) return false;
      if (f.to && s.endedAt > f.to) return false;
      return true;
    });
  }

  function tally(map, key, won) {
    if (!key) return;
    const x = map.get(key) || { key, n: 0, w: 0 };
    x.n++; if (won) x.w++;
    map.set(key, x);
  }
  const sorted = map => [...map.values()].sort((a, b) => b.n - a.n || b.w - a.w || a.key.localeCompare(b.key));

  function compute(ms) {
    const r = { n: ms.length, w: 0, l: 0, t: 0, turns: 0, forfeitWins: 0, timeScares: 0 };
    const myMons = new Map(), myLeads = new Map(), myMegas = new Map(), oppPreview = new Map(), oppBrought = new Map(), oppLeads = new Map(), oppMegas = new Map();
    for (const s of ms) {
      const me = mine(s), op = theirs(s), won = s.result === 'win';
      if (won) r.w++; else if (s.result === 'loss') r.l++; else r.t++;
      r.turns += s.turns || 0;
      if (won && s.forfeit && toID(s.forfeit) === toID(op.name)) r.forfeitWins++;
      if (me.minTime != null && me.minTime <= 10) r.timeScares++;
      me.brought.forEach(x => tally(myMons, x, won));
      tally(myLeads, leadKey(me.leads), won);
      me.megas.forEach(x => tally(myMegas, x, won));
      op.preview.forEach(x => tally(oppPreview, x, won));
      op.brought.forEach(x => tally(oppBrought, x, won));
      tally(oppLeads, leadKey(op.leads), won);
      op.megas.forEach(x => tally(oppMegas, x, won));
    }
    r.wr = r.n ? r.w / r.n : 0;
    r.avgTurns = r.n ? r.turns / r.n : 0;
    r.myMons = sorted(myMons); r.myLeads = sorted(myLeads); r.myMegas = sorted(myMegas);
    r.oppPreview = sorted(oppPreview); r.oppBrought = sorted(oppBrought); r.oppLeads = sorted(oppLeads); r.oppMegas = sorted(oppMegas);
    // ELO: el de antes de cada partida y, si se conoce, el de después.
    const asc = ms.slice().sort((a, b) => a.endedAt - b.endedAt);
    r.elo = [];
    for (const s of asc) {
      const me = mine(s);
      if (me.rating != null) r.elo.push({ t: s.endedAt, r: me.rating, format: s.formatId });
      if (me.ratingAfter != null) r.elo.push({ t: s.endedAt + 1, r: me.ratingAfter, format: s.formatId });
    }
    r.eloNow = r.elo.length ? r.elo[r.elo.length - 1].r : null;
    return r;
  }

  /** Opciones de los filtros, sacadas de todas las partidas identificadas. */
  function options(ms) {
    const formats = new Map(), leads = new Map(), rivals = new Map(), leadMons = new Map(), backs = new Map(), oppLeads = new Map();
    const inc = (m, k) => { if (k) m.set(k, (m.get(k) || 0) + 1); };
    for (const s of usable(ms)) {
      formats.set(s.formatId, s.format);
      const me = mine(s), op = theirs(s);
      inc(leads, leadKey(me.leads));
      me.leads.forEach(x => inc(leadMons, x));
      me.brought.filter(x => !me.leads.includes(x)).forEach(x => inc(backs, x));
      op.preview.forEach(x => inc(rivals, x));
      op.leads.forEach(x => inc(oppLeads, x));
    }
    const byCount = m => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(x => x[0]);
    return { formats: [...formats.entries()], leads: byCount(leads), rivals: byCount(rivals), leadMons: byCount(leadMons), backs: byCount(backs), oppLeads: byCount(oppLeads) };
  }

  /* ---------- análisis más finos (Dashboard) ---------- */
  const wr = x => (x && x.n ? x.w / x.n : 0);
  const pairsOf = arr => { const a = [...new Set(arr)].sort(), out = []; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) out.push(`${a[i]} + ${a[j]}`); return out; };
  const SESSION_GAP = 45 * 60 * 1000;

  function advanced(ms) {
    const asc = ms.slice().sort((a, b) => a.endedAt - b.endedAt);
    const all = { n: ms.length, w: ms.filter(s => s.result === 'win').length };
    // MVP, con él / sin él, abriendo o desde atrás.
    const per = new Map();
    const get = k => { if (!per.has(k)) per.set(k, { key: k, n: 0, w: 0, lead: { n: 0, w: 0 }, back: { n: 0, w: 0 }, without: { n: 0, w: 0 }, inPreview: 0, vs: new Map(), moves: new Map() }); return per.get(k); };
    const pairs = new Map(), oppMoves = new Map();
    for (const s of ms) {
      const me = mine(s), op = theirs(s), won = s.result === 'win';
      for (const k of me.preview) { const x = get(k); x.inPreview++; if (!me.brought.includes(k)) { x.without.n++; if (won) x.without.w++; } }
      for (const k of me.brought) {
        const x = get(k); x.n++; if (won) x.w++;
        const slot = me.leads.includes(k) ? x.lead : x.back; slot.n++; if (won) slot.w++;
        for (const o of op.brought) tally(x.vs, o, won);
        for (const mv of (me.moves && me.moves[k]) || []) x.moves.set(mv, (x.moves.get(mv) || 0) + 1);
      }
      for (const pk of pairsOf(me.brought)) tally(pairs, pk, won);
      for (const [sp, mvs] of Object.entries(op.moves || {})) {
        if (!oppMoves.has(sp)) oppMoves.set(sp, { key: sp, n: 0, moves: new Map(), items: new Map() });
        const o = oppMoves.get(sp); o.n++;
        for (const mv of mvs) o.moves.set(mv, (o.moves.get(mv) || 0) + 1);
      }
    }
    const mons = [...per.values()].filter(x => x.n);
    const mvp = mons.filter(x => x.n >= 3).sort((a, b) => wr(b) - wr(a) || b.n - a.n)[0] || mons.sort((a, b) => b.n - a.n)[0] || null;
    const monList = mons.map(x => {
      const vs = sorted(x.vs).filter(v => v.n >= 2);
      return {
        key: x.key, n: x.n, w: x.w, lead: x.lead, back: x.back, without: x.without,
        best: vs.slice().sort((a, b) => wr(b) - wr(a) || b.n - a.n).slice(0, 4),
        worst: vs.slice().sort((a, b) => wr(a) - wr(b) || b.n - a.n).slice(0, 4),
        moves: [...x.moves.entries()].sort((a, b) => b[1] - a[1])
      };
    }).sort((a, b) => b.n - a.n);
    // Hora y día.
    const hours = Array.from({ length: 8 }, (_, i) => ({ key: `${String(i * 3).padStart(2, '0')}–${String(i * 3 + 3).padStart(2, '0')} h`, n: 0, w: 0 }));
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(k => ({ key: k, n: 0, w: 0 }));
    for (const s of ms) {
      const d = new Date(s.endedAt), won = s.result === 'win';
      const h = hours[Math.floor(d.getHours() / 3)]; h.n++; if (won) h.w++;
      const dd = days[(d.getDay() + 6) % 7]; dd.n++; if (won) dd.w++;
    }
    const bestHour = hours.filter(h => h.n >= 3).sort((a, b) => wr(b) - wr(a))[0] || null;
    // Cortas o largas (por turnos, frente a la mediana).
    const tl = ms.map(s => s.turns || 0).sort((a, b) => a - b);
    const med = tl.length ? tl[Math.floor(tl.length / 2)] : 0;
    const short = { key: `Cortas (≤${med} turnos)`, n: 0, w: 0 }, long = { key: `Largas (>${med} turnos)`, n: 0, w: 0 };
    for (const s of ms) { const x = (s.turns || 0) <= med ? short : long; x.n++; if (s.result === 'win') x.w++; }
    // Tras ganar / tras perder, rachas y sesiones.
    const afterWin = { key: 'Tras ganar', n: 0, w: 0 }, afterLoss = { key: 'Tras perder', n: 0, w: 0 };
    const early = { key: 'Primeras 5 de la sesión', n: 0, w: 0 }, late = { key: 'De la 6.ª en adelante', n: 0, w: 0 };
    let streak = 0, bestStreak = 0, worstStreak = 0, cur = 0, sessions = 0, idx = 0;
    for (let i = 0; i < asc.length; i++) {
      const s = asc[i], prev = asc[i - 1], won = s.result === 'win';
      const newSession = !prev || s.endedAt - prev.endedAt > SESSION_GAP;
      if (newSession) { sessions++; idx = 0; }
      idx++;
      const bucket = idx <= 5 ? early : late; bucket.n++; if (won) bucket.w++;
      if (prev && !newSession) { const x = prev.result === 'win' ? afterWin : afterLoss; x.n++; if (won) x.w++; }
      if (won) cur = cur > 0 ? cur + 1 : 1; else cur = cur < 0 ? cur - 1 : -1;
      bestStreak = Math.max(bestStreak, cur); worstStreak = Math.min(worstStreak, cur);
    }
    streak = cur;
    // Bo3: partidas seguidas contra el mismo rival en un formato Bo3.
    const series = [];
    for (const s of asc) {
      if (!/bo3/.test(s.formatId || '')) continue;
      const op = toID(theirs(s).name);
      const last = series[series.length - 1];
      if (last && last.op === op && s.endedAt - last.end < 90 * 60 * 1000 && last.games.length < 3 && last.w < 2 && last.l < 2) { last.games.push(s); last.end = s.endedAt; }
      else series.push({ op, name: theirs(s).name, games: [s], end: s.endedAt, w: 0, l: 0 });
      const cs = series[series.length - 1];
      if (s.result === 'win') cs.w++; else if (s.result === 'loss') cs.l++;
    }
    const done = series.filter(x => x.w === 2 || x.l === 2);
    const incomplete = series.filter(x => x.w < 2 && x.l < 2 && x.games.length).length;
    const g1w = done.filter(x => x.games[0].result === 'win'), g1l = done.filter(x => x.games[0].result === 'loss');
    const bo3 = {
      n: done.length, w: done.filter(x => x.w === 2).length, incomplete,
      g1: { n: done.length, w: done.filter(x => x.games[0].result === 'win').length },
      closeAfterG1: { n: g1w.length, w: g1w.filter(x => x.w === 2).length },
      comeback: { n: g1l.length, w: g1l.filter(x => x.w === 2).length },
      g: [0, 1, 2].map(i => { const g = done.filter(x => x.games[i]).map(x => x.games[i]); return { key: `G${i + 1}`, n: g.length, w: g.filter(z => z.result === 'win').length }; }),
      series: series.slice(-10).reverse().map(x => ({ name: x.name, w: x.w, l: x.l, t: x.end, ids: x.games.map(g => g.id) }))
    };
    return {
      all, mvp, mons: monList, pairs: sorted(pairs).filter(p => p.n >= 2), oppMoves: [...oppMoves.values()].sort((a, b) => b.n - a.n).map(o => ({ key: o.key, n: o.n, moves: [...o.moves.entries()].sort((a, b) => b[1] - a[1]) })),
      hours, days, bestHour, short, long, afterWin, afterLoss, early, late, streak, bestStreak, worstStreak, sessions, bo3,
      recent: asc.slice(-8).reverse()
    };
  }

  /** Mis leads contra un lead rival concreto. */
  function leadsVs(ms, oppLead) {
    const m = new Map();
    for (const s of ms) if (leadKey(theirs(s).leads) === oppLead) tally(m, leadKey(mine(s).leads), s.result === 'win');
    return sorted(m);
  }

  /* ---------- Dashboard nuevo ---------- */
  const isOTS = s => !!((s.p1 && s.p1.sheet) || (s.p2 && s.p2.sheet));

  /** Resumen de arriba: OTS/CTS, racha y últimas partidas. */
  function overview(ms) {
    const asc = ms.slice().sort((a, b) => a.endedAt - b.endedAt);
    const ots = { n: 0, w: 0 }, cts = { n: 0, w: 0 };
    for (const s of ms) { const x = isOTS(s) ? ots : cts; x.n++; if (s.result === 'win') x.w++; }
    let streak = 0;
    for (let i = asc.length - 1; i >= 0; i--) {
      const r = asc[i].result;
      if (r !== 'win' && r !== 'loss') break;
      if (!streak) streak = r === 'win' ? 1 : -1;
      else if ((streak > 0) === (r === 'win')) streak += streak > 0 ? 1 : -1;
      else break;
    }
    return { ots, cts, streak, last: asc.slice(-10).map(s => s.result) };
  }

  /** Todo de un Pokémon rival: cuánto lo ves, cómo te va, con quién va y cómo te abren con él. */
  function rival(ms, mon) {
    const has = s => theirs(s).preview.includes(mon) || theirs(s).brought.includes(mon);
    const games = ms.filter(has);
    const out = { key: mon, n: games.length, w: games.filter(s => s.result === 'win').length, seen: ms.length ? games.length / ms.length : 0, leadN: 0, broughtN: 0 };
    const mates = new Map(), myLeads = new Map(), oppLeads = new Map(), moves = new Map();
    for (const s of games) {
      const op = theirs(s), won = s.result === 'win';
      if (op.leads.includes(mon)) { out.leadN++; tally(oppLeads, leadKey(op.leads), won); }
      if (op.brought.includes(mon)) out.broughtN++;
      op.preview.filter(x => x !== mon).forEach(x => tally(mates, x, won));
      tally(myLeads, leadKey(mine(s).leads), won);
      for (const mv of (op.moves && op.moves[mon]) || []) moves.set(mv, (moves.get(mv) || 0) + 1);
    }
    out.mates = sorted(mates).slice(0, 3);
    out.myLeads = sorted(myLeads);
    out.oppLeads = sorted(oppLeads);
    out.moves = [...moves.entries()].sort((a, b) => b[1] - a[1]);
    out.recent = games.slice().sort((a, b) => b.endedAt - a.endedAt).slice(0, 5);
    return out;
  }

  /** Tu equipo: cada Pokémon, cuánto lo llevas, cuánto abre, cómo te va con él y qué movimientos usa. */
  function teamCards(ms, species) {
    const base = x => toID(String(x).split('-')[0]);
    return species.map(sp => {
      const id = toID(sp), b = base(sp);
      const same = x => toID(x) === id || base(x) === b;
      const c = { key: sp, n: 0, w: 0, lead: 0, mega: { n: 0, w: 0 }, moves: new Map() };
      for (const s of ms) {
        const me = mine(s), won = s.result === 'win';
        const k = me.brought.find(same);
        if (!k) continue;
        c.n++; if (won) c.w++;
        if (me.leads.some(same)) c.lead++;
        if (me.megas.some(same)) { c.mega.n++; if (won) c.mega.w++; }
        for (const mv of (me.moves && me.moves[k]) || []) c.moves.set(mv, (c.moves.get(mv) || 0) + 1);
      }
      c.broughtPct = ms.length ? c.n / ms.length : 0;
      c.leadPct = ms.length ? c.lead / ms.length : 0;
      c.moves = [...c.moves.entries()].sort((a, b) => b[1] - a[1]);
      return c;
    });
  }

  /**
   * Hábitos: qué cosas van con ganar o perder más que tu media (hora, día, tras perder, sesiones largas,
   * partidas largas, hojas abiertas, megaevolucionar, apuros de tiempo, ELO del rival…).
   */
  function habits(ms) {
    const all = { n: ms.length, w: ms.filter(s => s.result === 'win').length };
    const base = wr(all);
    const a = advanced(ms);
    const f = [];
    const two = (yes, no) => { f.push(yes); f.push(no); };
    const cnt = (key, test) => { const x = { key, n: 0, w: 0 }; for (const s of ms) if (test(s)) { x.n++; if (s.result === 'win') x.w++; } return x; };
    two(a.afterWin, a.afterLoss);
    two(a.early, a.late);
    two(a.short, a.long);
    a.hours.filter(h => h.n).forEach(h => f.push({ ...h, key: `Jugando de ${h.key}` }));
    a.days.filter(h => h.n).forEach(h => { const d = h.key.toLowerCase(); f.push({ ...h, key: `Los ${d.endsWith('s') ? d : `${d}s`}` }); });
    two(cnt('Con hojas abiertas (OTS)', isOTS), cnt('Con hojas cerradas (CTS)', s => !isOTS(s)));
    two(cnt('Cuando megaevolucionas', s => mine(s).megas.length > 0), cnt('Sin megaevolucionar', s => !mine(s).megas.length));
    f.push(cnt('Cuando el rival megaevoluciona', s => theirs(s).megas.length > 0));
    f.push(cnt('Con apuros de tiempo (≤10 s)', s => mine(s).minTime != null && mine(s).minTime <= 10));
    two(cnt('Contra rivales con más ELO', s => mine(s).rating != null && theirs(s).rating != null && theirs(s).rating > mine(s).rating),
      cnt('Contra rivales con menos ELO', s => mine(s).rating != null && theirs(s).rating != null && theirs(s).rating <= mine(s).rating));
    const min = ms.length >= 30 ? 5 : 3;
    const list = f.filter(x => x && x.n >= min && x.n < ms.length).map(x => ({ key: x.key, n: x.n, w: x.w, delta: Math.round((wr(x) - base) * 100) }));
    return {
      n: ms.length, base,
      win: list.filter(x => x.delta >= 5).sort((x, y) => y.delta - x.delta || y.n - x.n).slice(0, 6),
      lose: list.filter(x => x.delta <= -5).sort((x, y) => x.delta - y.delta || y.n - x.n).slice(0, 6),
      hours: a.hours, days: a.days
    };
  }

  return { toID, leadKey, usable, filter, compute, options, mine, theirs, advanced, leadsVs, wr, isOTS, overview, rival, teamCards, habits };
});
