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
      if (f.lead && leadKey(mine(s).leads) !== f.lead) return false;
      if (f.rival && !theirs(s).preview.includes(f.rival)) return false;
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
    const formats = new Map(), leads = new Map(), rivals = new Map();
    for (const s of usable(ms)) {
      formats.set(s.formatId, s.format);
      const k = leadKey(mine(s).leads); if (k) leads.set(k, (leads.get(k) || 0) + 1);
      theirs(s).preview.forEach(x => rivals.set(x, (rivals.get(x) || 0) + 1));
    }
    const byCount = m => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(x => x[0]);
    return { formats: [...formats.entries()], leads: byCount(leads), rivals: byCount(rivals) };
  }

  return { toID, leadKey, usable, filter, compute, options, mine, theirs };
});
