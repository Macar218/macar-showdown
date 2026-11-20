'use strict';
/*
 * Macar Showdown · Multicalc.
 * Los cuatro Pokémon del campo (dos tuyos, dos suyos) eligen su jugada y se juega el turno en orden:
 * prioridad, velocidad (Espacio Raro), Protección, Fake Out, ataques en área, KOs y lo que queda de PS.
 * "Siguiente turno" sigue con esos PS. "Todas las opciones" cruza todas tus jugadas con todas las suyas.
 */
/* global P, esc, spr */

const Multi = (() => {
  const SLOTS = [['a', 'me', 0], ['b', 'me', 1], ['c', 'foe', 0], ['d', 'foe', 1]];
  const PROTECT = new Set(['protect', 'detect', 'spikyshield', 'banefulbunker', 'silktrap', 'burningbulwark', 'kingsshield', 'obstruct']);
  const ROLLS = [['peor', 'Peor caso'], ['media', 'Normal'], ['mejor', 'Mejor caso']];
  const M = { slots: {}, roll: 'media', turn: 1, hp: null, key: '', all: null, allKey: '', mods: {}, tree: null, open: {} };
  let CTX = null; // estado de una rama del árbol (PS y efectos), mientras se calcula
  const toID = P.toID;

  /** Quién está en cada hueco (por defecto, los del campo). */
  function sync(st) {
    const key = `${st.battleId || 'manual'}|${st.me.map(m => m.species).join(',')}|${st.foe.map(m => m.species).join(',')}|${st.meActive}|${st.foeActive}|${st.turn}`;
    if (key === M.key) return;
    const firstTime = !M.key || M.key.split('|')[0] !== key.split('|')[0];
    M.key = key;
    for (const [s, side, i] of SLOTS) {
      const act = side === 'me' ? st.meActive : st.foeActive;
      const list = st[side];
      const prev = M.slots[s];
      let idx = act[i] != null ? act[i] : (i < list.length ? i : -1);
      if (!firstTime && prev && prev.idx >= 0 && list[prev.idx] && !st.live) idx = prev.idx;
      const keepMove = prev && prev.idx === idx;
      M.slots[s] = keepMove ? prev : { idx, mv: -1, tgt: side === 'me' ? 'c' : 'a' };
    }
    for (const [s] of SLOTS) if (M.slots[s].mv === -1 && M.slots[s].idx >= 0 && !M.slots[s].userSet) Object.assign(M.slots[s], bestPlay(st, s));
    M.hp = null; M.turn = 1; M.all = null; M.mods = {}; M.tree = null; M.open = {};
  }
  /** La jugada que más daño hace (en % de PS) contra los del otro lado. */
  function bestPlay(st, s) {
    const m = monOf(st, s);
    if (!m) return { mv: -1 };
    let best = { mv: -1, tgt: foesOf(s)[0], v: -1 };
    const f = fieldFor(st);
    m.moves.forEach((name, i) => {
      const d = P.moveOf(name);
      if (!d || d.category === 'Status') return;
      const area = ['allAdjacentFoes', 'allAdjacent'].includes(d.target);
      let total = 0, top = { t: foesOf(s)[0], v: -1 };
      for (const t of foesOf(s)) {
        const tm = monOf(st, t);
        if (!tm) continue;
        const r = P.damage(m, tm, name, f, sideOf(s));
        const v = r && !r.err ? r.pHi : 0;
        total += v;
        if (v > top.v) top = { t, v };
      }
      const v = area ? total : top.v;
      if (v > best.v) best = { mv: i, tgt: top.t, v };
    });
    return { mv: best.mv, tgt: best.tgt };
  }
  /** El campo de la calculadora, con el clima y el campo de las habilidades de los cuatro de la Multicalc. */
  function fieldFor(st) {
    let f = st.field;
    if (!st.live && !st.field.userWT) { const a = P.autoField(SLOTS.map(([s]) => monOf(st, s))); f = { ...f, weather: a.weather, terrain: a.terrain }; }
    const md = (CTX ? CTX.mods : M.mods) || {};
    if (md.tr != null || md.twMe || md.twFoe) f = { ...f, tr: md.tr != null ? md.tr : f.tr, me: { ...f.me, tw: f.me.tw || !!md.twMe }, foe: { ...f.foe, tw: f.foe.tw || !!md.twFoe } };
    return f;
  }
  const monOf = (st, s) => { const sl = M.slots[s]; const side = s === 'a' || s === 'b' ? 'me' : 'foe'; return sl && sl.idx >= 0 ? st[side][sl.idx] : null; };
  const sideOf = s => (s === 'a' || s === 'b' ? 'me' : 'foe');
  const foesOf = s => (sideOf(s) === 'me' ? ['c', 'd'] : ['a', 'b']);
  const allyOf = s => ({ a: 'b', b: 'a', c: 'd', d: 'c' }[s]);
  const startHP = (st, s) => { if (CTX && CTX.hp && CTX.hp[s] != null) return CTX.hp[s]; if (M.hp && M.hp[s] != null) return M.hp[s]; const m = monOf(st, s); return m ? (m.fainted ? 0 : m.hp) : 0; };

  /* ---------- simular un turno ---------- */
  function makeDamage(st) {
    const cache = new Map();
    const f = fieldFor(st);
    return (sA, sD, mvName) => {
      const att = monOf(st, sA), def = monOf(st, sD);
      const k = `${sA}${M.slots[sA].idx}|${sD}${M.slots[sD].idx}|${mvName}`;
      if (!cache.has(k)) cache.set(k, P.damage({ ...att, hp: 100 }, { ...def, hp: 100 }, mvName, f, sideOf(sA)));
      return cache.get(k);
    };
  }
  const pick = (r, mode, mine) => {
    if (!r || r.err || !r.rolls) return 0;
    const rs = r.rolls;
    if (mode === 'media') return rs[Math.floor(rs.length / 2)];
    const hi = Math.max(...rs), lo = Math.min(...rs);
    return mode === 'peor' ? (mine ? lo : hi) : (mine ? hi : lo);
  };

  /** plays: { a: {mv, tgt}, … }. Devuelve PS finales (%) y lo que pasa, en orden. */
  function simulate(st, plays, mode, dmgOf, turnN) {
    const hp = {}, maxhp = {}, ev = [], protectedS = new Set(), flinched = new Set(), moved = new Set(), fx = {};
    for (const [s] of SLOTS) {
      const m = monOf(st, s);
      if (!m) continue;
      try { maxhp[s] = P.mkPoke({ ...m, hp: 100 }).maxHP(); } catch (e) { maxhp[s] = 100; }
      hp[s] = Math.round((startHP(st, s) / 100) * maxhp[s]);
    }
    const acts = [];
    for (const [s] of SLOTS) {
      const m = monOf(st, s), p = plays[s];
      if (!m || !p || p.mv < 0 || hp[s] <= 0) continue;
      const name = m.moves[p.mv];
      const d = P.moveOf(name);
      if (!d) continue;
      const spd = P.speed(m, fieldFor(st), sideOf(s));
      acts.push({ s, name, d, pri: d.priority || 0, spd, tgt: p.tgt });
    }
    // Orden: prioridad; luego velocidad (al revés con Espacio Raro). Empates: en el peor caso, el rival primero.
    acts.sort((x, y) => (y.pri - x.pri) || (fieldFor(st).tr ? x.spd - y.spd : y.spd - x.spd) ||
      ((mode === 'peor' ? 1 : -1) * ((sideOf(x.s) === 'me' ? 1 : 0) - (sideOf(y.s) === 'me' ? 1 : 0))));
    for (const a of acts) {
      if (hp[a.s] <= 0) continue;
      const mon = monOf(st, a.s);
      if (flinched.has(a.s)) { ev.push({ s: a.s, t: `${mon.species} retrocede: no ataca` }); moved.add(a.s); continue; }
      const id = toID(a.name);
      moved.add(a.s);
      if (PROTECT.has(id)) { protectedS.add(a.s); ev.push({ s: a.s, t: `${mon.species} se protege` }); continue; }
      if (a.d.category === 'Status') {
        if (id === 'tailwind') fx[sideOf(a.s) === 'me' ? 'twMe' : 'twFoe'] = true;
        if (id === 'trickroom') fx.tr = true;
        ev.push({ s: a.s, t: `${mon.species} usa ${a.name}${id === 'tailwind' ? ' (cuenta desde el turno siguiente)' : id === 'trickroom' ? ' (el orden cambia el turno siguiente)' : ''}` });
        continue;
      }
      if (id === 'fakeout' && turnN > 1) { ev.push({ s: a.s, t: `${mon.species} usa Fake Out: falla (no es su primer turno)` }); continue; }
      const tgtKind = a.d.target || 'normal';
      let targets;
      if (tgtKind === 'allAdjacentFoes') targets = foesOf(a.s);
      else if (tgtKind === 'allAdjacent') targets = [...foesOf(a.s), allyOf(a.s)];
      else {
        let t = a.tgt && hp[a.tgt] > 0 ? a.tgt : foesOf(a.s).find(x => hp[x] > 0);
        if (t && sideOf(t) === sideOf(a.s) && t === a.s) t = foesOf(a.s).find(x => hp[x] > 0);
        targets = t ? [t] : [];
      }
      targets = targets.filter(t => hp[t] > 0 && monOf(st, t));
      if (!targets.length) { ev.push({ s: a.s, t: `${mon.species} usa ${a.name}: no queda objetivo` }); continue; }
      const mine = sideOf(a.s) === 'me';
      const parts = [];
      for (const t of targets) {
        const tm = monOf(st, t);
        if (protectedS.has(t)) { parts.push(`${tm.species} se protege`); continue; }
        const r = dmgOf(a.s, t, a.name);
        if (!r || r.err) { parts.push(`${tm.species}: no calcula`); continue; }
        const dmg = Math.min(hp[t], pick(r, mode, mine));
        if (dmg <= 0) { parts.push(`${tm.species}: no le afecta`); continue; }
        hp[t] -= dmg;
        const left = Math.max(0, (hp[t] / maxhp[t]) * 100);
        parts.push(`${tm.species} −${P.pct((dmg / maxhp[t]) * 100)}%${hp[t] <= 0 ? ' · CAE' : ` (le queda ${P.pct(left)}%)`}`);
        if (id === 'fakeout' && hp[t] > 0 && !moved.has(t)) flinched.add(t);
      }
      ev.push({ s: a.s, t: `${mon.species} usa ${a.name} → ${parts.join(' · ')}`, ko: targets.some(t => hp[t] <= 0) });
    }
    const out = {};
    for (const s of Object.keys(hp)) out[s] = Math.max(0, (hp[s] / maxhp[s]) * 100);
    return { hp: out, ev, order: acts.map(a => a.s), fx };
  }

  /* ---------- todas las opciones ---------- */
  function optionsFor(st, s) {
    const m = monOf(st, s);
    if (!m || startHP(st, s) <= 0) return [{ mv: -1 }];
    const out = [];
    m.moves.forEach((name, i) => {
      const d = P.moveOf(name);
      if (!d) return;
      const single = d.category !== 'Status' && !['allAdjacentFoes', 'allAdjacent'].includes(d.target);
      if (single) foesOf(s).filter(t => monOf(st, t) && startHP(st, t) > 0).forEach(t => out.push({ mv: i, tgt: t }));
      else out.push({ mv: i });
    });
    return out.length ? out : [{ mv: -1 }];
  }
  const label = (st, s, o) => {
    const m = monOf(st, s);
    if (!m || o.mv < 0) return '—';
    const name = m.moves[o.mv];
    return o.tgt ? `${name} → ${monOf(st, o.tgt).species}` : name;
  };
  function score(st, r) {
    let kos = 0, lost = 0, foeHp = 0, myHp = 0;
    for (const [s, side] of SLOTS) {
      if (!monOf(st, s) || startHP(st, s) <= 0) continue;
      const dead = r.hp[s] <= 0;
      if (side === 'me') { if (dead) lost++; myHp += r.hp[s]; } else { if (dead) kos++; foeHp += r.hp[s]; }
    }
    return { kos, lost, v: (kos - lost) * 1000 + (myHp - foeHp), myHp, foeHp };
  }
  function computeAll(st) {
    const dmgOf = makeDamage(st);
    const A = optionsFor(st, 'a'), B = optionsFor(st, 'b'), C = optionsFor(st, 'c'), D = optionsFor(st, 'd');
    const rows = [];
    for (const oa of A) for (const ob of B) {
      let worst = null, best = null;
      for (const oc of C) for (const od of D) {
        const plays = { a: oa, b: ob, c: oc, d: od };
        const w = score(st, simulate(st, plays, 'peor', dmgOf, M.turn));
        const b = score(st, simulate(st, plays, 'mejor', dmgOf, M.turn));
        if (!worst || w.v < worst.v) worst = { ...w, reply: plays };
        if (!best || b.v > best.v) best = { ...b, reply: plays };
      }
      rows.push({ oa, ob, worst, best });
    }
    rows.sort((x, y) => (y.worst.v - x.worst.v) || (y.best.v - x.best.v));
    return { rows: rows.slice(0, 40), total: rows.length, foeTotal: C.length * D.length };
  }

  /* ---------- árbol: todas las opciones, turno a turno ---------- */
  const nextMods = (mods, fx, st) => { const m = { ...mods }; if (fx.tr) m.tr = !(m.tr != null ? m.tr : st.field.tr); if (fx.twMe) m.twMe = true; if (fx.twFoe) m.twFoe = true; return m; };
  /** Desde un estado: tus 4 mejores jugadas (por su peor caso) y, de cada una, las 3 respuestas del rival que más te duelen. */
  function branch(st, state) {
    const keep = CTX;
    CTX = state;
    try {
      const dmgOf = makeDamage(st);
      const A = optionsFor(st, 'a'), B = optionsFor(st, 'b'), C = optionsFor(st, 'c'), D = optionsFor(st, 'd');
      const rows = [];
      for (const oa of A) for (const ob of B) {
        const replies = [];
        for (const oc of C) for (const od of D) {
          const plays = { a: oa, b: ob, c: oc, d: od };
          const r = simulate(st, plays, M.roll, dmgOf, state.turn);
          replies.push({ plays, r, sc: score(st, r) });
        }
        replies.sort((x, y) => x.sc.v - y.sc.v);
        rows.push({ oa, ob, worst: replies[0].sc, replies: replies.slice(0, 3) });
      }
      rows.sort((x, y) => y.worst.v - x.worst.v);
      return rows.slice(0, 4);
    } finally { CTX = keep; }
  }
  /** Una jugada en dibujo: quién, qué movimiento (color de su tipo) y a quién. */
  function actHTML(st, s, o, hp) {
    const m = monOf(st, s);
    if (!m) return '';
    if ((hp[s] ?? 0) <= 0) return `<div class="tact out">${spr(m.species, 'xs dim')}<span class="tmv none">KO</span></div>`;
    if (!o || o.mv < 0) return `<div class="tact">${spr(m.species, 'xs')}<span class="tmv none">—</span></div>`;
    const name = m.moves[o.mv], d = P.moveOf(name) || {};
    const area = ['allAdjacentFoes', 'allAdjacent'].includes(d.target);
    let tg = '';
    if (o.tgt && monOf(st, o.tgt)) tg = `<i class="tarr">➜</i>${spr(monOf(st, o.tgt).species, 'xs')}`;
    else if (area) tg = `<i class="tarr">➜</i>${(d.target === 'allAdjacent' ? [...foesOf(s), allyOf(s)] : foesOf(s)).map(t => monOf(st, t) && (hp[t] ?? 0) > 0 ? spr(monOf(st, t).species, 'xs') : '').join('')}`;
    const prio = d.priority ? `<small>${d.priority > 0 ? '+' : ''}${d.priority}</small>` : '';
    return `<div class="tact">${spr(m.species, 'xs')}<span class="tmv t-${esc(d.type || '')}${d.category === 'Status' ? ' st' : ''}" title="${esc(name)}">${esc(name)}${prio}</span>${tg}</div>`;
  }
  /** Los cuatro tras el turno: barra de PS con lo que pierden en el turno. */
  function boardHTML(st, before, after) {
    const mon = s => {
      const m = monOf(st, s);
      if (!m) return '';
      const b0 = Math.max(0, before[s] ?? 0), v = Math.max(0, after[s] ?? 0), dead = v <= 0;
      const cls = v <= 25 ? 'r' : v <= 50 ? 'y' : '';
      return `<div class="tmon${dead ? ' dead' : ''}" title="${esc(m.species)}">${spr(m.species, 'sm')}<div class="tbar"><i class="lost" style="width:${b0}%"></i><i class="${cls}" style="width:${v}%"></i></div><b>${dead ? 'KO' : `${P.pct(v)}%`}</b>${b0 > v && !dead ? `<small>−${P.pct(b0 - v)}</small>` : ''}</div>`;
    };
    return `<div class="tboard"><div class="tside me">${mon('a')}${mon('b')}</div><div class="tside foe">${mon('c')}${mon('d')}</div></div>`;
  }
  const badge = o => {
    const cls = o.kos > o.lost ? 'good' : o.lost > o.kos ? 'bad' : '';
    const txt = [o.kos ? `${o.kos} KO` : '', o.lost ? `pierdes ${o.lost}` : ''].filter(Boolean).join(' · ') || 'Ningún KO';
    return `<span class="tbadge ${cls}">${txt}</span>`;
  };
  function treeHTML(st, state, path, depth) {
    const rows = M.tree[path] || (M.tree[path] = branch(st, state));
    if (!rows.length) return '<p class="note">Faltan Pokémon o movimientos para ver las opciones.</p>';
    const hp0 = state.hp;
    return `<ol class="ttree">${rows.map((row, i) => {
      const key = `${path}.${i}`;
      const cls = row.worst.kos > row.worst.lost ? 'good' : row.worst.lost > row.worst.kos ? 'bad' : '';
      return `<li class="tbranch"><div class="tcard my ${cls}">
          <div class="trank"><b>${i + 1}</b><span>T${state.turn}</span></div>
          <div class="tacts">${actHTML(st, 'a', row.oa, hp0)}${actHTML(st, 'b', row.ob, hp0)}</div>
          <div class="tsum"><span class="note">Peor caso</span>${badge(row.worst)}</div></div>
        <ul class="treps">${row.replies.map((rep, j) => {
          const k2 = `${key}.${j}`;
          const next = { hp: { ...rep.r.hp }, mods: nextMods(state.mods || {}, rep.r.fx, st), turn: state.turn + 1 };
          const alive = x => (next.hp[x] || 0) > 0;
          const canGo = ['a', 'b'].some(alive) && ['c', 'd'].some(alive) && depth < 3;
          const fx = [rep.r.fx.tr && 'Espacio Raro', (rep.r.fx.twMe || rep.r.fx.twFoe) && 'Viento Afín'].filter(Boolean);
          return `<li><div class="tcard rep${j === 0 ? ' worst' : ''}">
              <div class="trephead"><span class="note">${j === 0 ? 'Su respuesta más dura' : 'Si el rival hace'}</span><div class="tacts">${actHTML(st, 'c', rep.plays.c, hp0)}${actHTML(st, 'd', rep.plays.d, hp0)}</div>${badge(rep.sc)}</div>
              ${boardHTML(st, hp0, rep.r.hp)}
              <div class="tfoot"><span class="torder"><span class="note">Orden</span>${rep.r.order.map(x => spr(monOf(st, x).species, 'xs')).join('<i>›</i>')}</span>${fx.length ? `<span class="pill tie">${fx.join(' · ')}</span>` : ''}
                <span style="flex:1"></span>${canGo ? `<button class="btn sm${M.open[k2] ? '' : ' primary'}" data-tnext="${k2}">${M.open[k2] ? 'Ocultar' : `Turno ${state.turn + 1} ▸`}</button>` : ''}<button class="btn sm" data-tuse="${k2}" title="Pone este turno (PS y movimientos) en la Multicalc">Usarlo este turno</button></div></div>
            ${M.open[k2] ? `<div class="tsub">${treeHTML(st, next, k2, depth + 1)}</div>` : ''}</li>`;
        }).join('')}</ul></li>`;
    }).join('')}</ol>`;
  }
  /** Busca el estado y las jugadas de una rama por su ruta ("r.0.1.2.0…"). */
  function nodeAt(st, path) {
    const parts = path.split('.').slice(1).map(Number);
    let state = rootState(st), p = 'r', node = null;
    for (let i = 0; i < parts.length; i += 2) {
      const rows = M.tree[p] || (M.tree[p] = branch(st, state));
      const row = rows[parts[i]], rep = row && row.replies[parts[i + 1]];
      if (!rep) return null;
      node = { state, plays: rep.plays };
      state = { hp: { ...rep.r.hp }, mods: nextMods(state.mods || {}, rep.r.fx, st), turn: state.turn + 1 };
      p = `${p}.${parts[i]}.${parts[i + 1]}`;
    }
    return node;
  }
  const rootState = st => ({ hp: Object.fromEntries(SLOTS.map(([s]) => [s, startHP(st, s)])), mods: { ...M.mods }, turn: M.turn });

  /* ---------- pintar ---------- */
  function slotBox(st, s) {
    const side = sideOf(s), sl = M.slots[s], list = st[side];
    const m = monOf(st, s);
    const hpNow = startHP(st, s);
    const opts = `<option value="-1">—</option>${list.map((x, i) => `<option value="${i}"${i === sl.idx ? ' selected' : ''}>${esc(x.species)}</option>`).join('')}`;
    const mvs = m ? m.moves.map((name, i) => {
      if (!name) return '';
      const d = P.moveOf(name);
      const single = d && d.category !== 'Status' && !['allAdjacentFoes', 'allAdjacent'].includes(d.target);
      const area = d && ['allAdjacentFoes', 'allAdjacent'].includes(d.target);
      return `<label class="mvopt${sl.mv === i ? ' on' : ''}"><input type="radio" name="mm-${s}" data-mmv="${s}:${i}"${sl.mv === i ? ' checked' : ''}>${P.typeDot(d ? d.type : '')}${esc(name)}${area ? '<small>área</small>' : ''}${d && d.priority ? `<small>${d.priority > 0 ? '+' : ''}${d.priority}</small>` : ''}</label>${single && sl.mv === i ? `<div class="tgts">${foesOf(s).map(t => { const tm = monOf(st, t); return tm ? `<button class="chipbtn${sl.tgt === t ? ' on' : ''}" data-mtgt="${s}:${t}">→ ${esc(tm.species)}</button>` : ''; }).join('')}</div>` : ''}`;
    }).join('') : '';
    return `<div class="mslot ${side}${hpNow <= 0 && m ? ' dead' : ''}">
      <div class="mstop">${m ? spr(m.species, 'sm') : ''}<select data-mmon="${s}">${opts}</select></div>
      ${m ? `<div class="mhp"><div class="hpline"><i style="width:${hpNow}%" class="${hpNow <= 25 ? 'r' : hpNow <= 50 ? 'y' : ''}"></i></div><label>PS <input type="number" min="0" max="100" value="${Math.round(hpNow)}" data-mhp="${s}">%</label></div>
      <div class="mvlist">${mvs}<label class="mvopt${sl.mv === -1 ? ' on' : ''}"><input type="radio" name="mm-${s}" data-mmv="${s}:-1"${sl.mv === -1 ? ' checked' : ''}>No hace nada</label></div>` : '<p class="note">Vacío</p>'}
    </div>`;
  }
  function render(st) {
    sync(st);
    if (!st.me.length || !st.foe.length) return '<p class="note">Faltan Pokémon: carga tu equipo y el rival (o abre un combate) para usar la Multicalc.</p>';
    const plays = Object.fromEntries(SLOTS.map(([s]) => [s, M.slots[s]]));
    const r = simulate(st, plays, M.roll, makeDamage(st), M.turn);
    const res = SLOTS.map(([s, side]) => {
      const m = monOf(st, s);
      if (!m) return '';
      const before = startHP(st, s), after = r.hp[s] ?? before;
      const tag = before <= 0 ? '<span class="pill">ya debilitado</span>' : after <= 0 ? '<span class="pill loss">Cae este turno</span>' : after < before ? '<span class="pill tie">Aguanta el turno</span>' : '<span class="pill win">No recibe daño</span>';
      return `<div class="mres ${side}">${spr(m.species, 'xs')}<b>${esc(m.species)}</b><div class="hpline"><i style="width:${after}%" class="${after <= 25 ? 'r' : after <= 50 ? 'y' : ''}"></i></div><span>${P.pct(after)}%</span>${tag}</div>`;
    }).join('');
    const all = M.all ? `<div class="mall"><h3>Todas tus jugadas contra todas las suyas <span class="note">${M.all.total} tuyas × ${M.all.foeTotal} suyas · las 40 mejores</span></h3>
      <table><thead><tr><th>Tu jugada</th><th>Peor caso<small>su mejor respuesta, malas tiradas</small></th><th>Mejor caso</th><th></th></tr></thead><tbody>
      ${M.all.rows.map((row, i) => `<tr><td>${esc(label(st, 'a', row.oa))}<br>${esc(label(st, 'b', row.ob))}</td>
        <td class="${row.worst.kos > row.worst.lost ? 'good' : row.worst.lost > row.worst.kos ? 'bad' : ''}">${outcome(row.worst)}<small>Si el rival hace: ${esc(label(st, 'c', row.worst.reply.c))} / ${esc(label(st, 'd', row.worst.reply.d))}</small></td>
        <td class="${row.best.kos > row.best.lost ? 'good' : row.best.lost > row.best.kos ? 'bad' : ''}">${outcome(row.best)}</td>
        <td><button class="btn sm" data-muse="${i}">Usarla</button></td></tr>`).join('')}</tbody></table></div>` : '';
    return `<div class="multi">
      <div class="mrow">${slotBox(st, 'a')}${slotBox(st, 'b')}</div>
      <div class="mvs">VS</div>
      <div class="mrow">${slotBox(st, 'c')}${slotBox(st, 'd')}</div>
      <div class="mctl"><span class="note">Turno ${M.turn}${(() => { const f = fieldFor(st); const x = [f.weather && P.WEATHERS.find(w => w[0] === f.weather)[1], f.terrain && `Campo ${P.TERRAINS.find(w => w[0] === f.terrain)[1]}`, f.tr && 'Espacio Raro', f.me.tw && 'Viento Afín tuyo', f.foe.tw && 'Viento Afín rival'].filter(Boolean); return x.length ? ` · ${x.join(' · ')}` : ''; })()}</span><div class="seg">${ROLLS.map(([k, l]) => `<button data-mroll="${k}" aria-pressed="${M.roll === k}">${l}</button>`).join('')}</div>
        <span style="flex:1"></span><button class="btn sm" data-mnext="1">Siguiente turno</button><button class="btn sm" data-mreset="1" title="Vuelve al turno 1 con los PS de ahora">Reiniciar turnos</button></div>
      <div class="mlog"><h3>Qué pasa este turno</h3>${r.ev.length ? `<ol>${r.ev.map(e => `<li class="${sideOf(e.s)}${e.ko ? ' ko' : ''}">${esc(e.t)}</li>`).join('')}</ol>` : '<p class="note">Nadie ataca este turno.</p>'}</div>
      <div class="mresults">${res}</div>
      <div class="row-btns"><button class="btn${M.all ? '' : ' primary'}" data-mall="1" title="Todas tus jugadas contra todas las del rival, y qué pasa en cada caso">${M.all ? 'Recalcular la tabla' : 'Todas las opciones (tabla)'}</button>
        <button class="btn${M.tree ? '' : ' primary'}" data-mtree="1" title="Tus mejores jugadas, lo que puede responder el rival y qué pasa después, turno a turno">${M.tree ? 'Recalcular el árbol' : 'Todas las opciones, turno a turno'}</button></div>
      ${M.tree ? `<div class="mtree"><h3>Todas las opciones, turno a turno <span class="note">tus 4 mejores jugadas (por su peor caso) y las 3 respuestas del rival que más te duelen · ${ROLLS.find(r => r[0] === M.roll)[1].toLowerCase()} · los que caen no se sustituyen</span></h3>${treeHTML(st, rootState(st), 'r', 1)}</div>` : ''}
      ${all}
    </div>`;
  }
  /** Pestaña Árbol de la calculadora: solo el árbol de jugadas, desde los PS de ahora. */
  function renderTree(st) {
    sync(st);
    if (!st.me.length || !st.foe.length) return '<p class="note">Faltan Pokémon: carga tu equipo y el rival (o abre un combate) para ver el árbol.</p>';
    if (!M.tree) { M.tree = {}; M.open = {}; }
    const on = s => monOf(st, s);
    const side = ss => ss.map(s => (on(s) ? `${spr(on(s).species, 'sm')}<span class="nolang">${esc(on(s).species)}</span>` : '')).join('');
    return `<div class="multi mtreetab">
      <div class="mtreehead"><div class="mtvs"><span>${side(['a', 'b'])}</span><b>VS</b><span>${side(['c', 'd'])}</span></div>
        <div class="seg">${ROLLS.map(([k, l]) => `<button data-mroll="${k}" aria-pressed="${M.roll === k}">${l}</button>`).join('')}</div>
        <button class="btn sm" data-mtree="1" title="Volver a calcular desde los PS de ahora">Recalcular</button></div>
      <p class="note">Tus 4 mejores jugadas (por su peor caso) y las 3 respuestas del rival que más te duelen. «Turno siguiente» abre lo que pasa después; «Usarlo este turno» lo lleva a la Multicalc. Los que están en el campo se eligen en las tiras de arriba (clic derecho).</p>
      <div class="mtree">${treeHTML(st, rootState(st), 'r', 1)}</div></div>`;
  }
  const outcome = o => `${o.kos ? `<b>${o.kos} KO</b>` : 'Ningún KO'}${o.lost ? ` · <b>pierdes ${o.lost}</b>` : ''}`;

  /* ---------- eventos (los recibe el panel de la calculadora) ---------- */
  function click(t, st) {
    if (t.dataset.mtgt) { const [s, tg] = t.dataset.mtgt.split(':'); M.slots[s].tgt = tg; M.slots[s].userSet = true; M.all = null; return true; }
    if (t.dataset.mroll) { M.roll = t.dataset.mroll; if (M.tree) M.tree = {}; return true; }
    if (t.dataset.mnext) {
      const r = simulate(st, Object.fromEntries(SLOTS.map(([s]) => [s, M.slots[s]])), M.roll, makeDamage(st), M.turn);
      M.hp = { ...r.hp }; M.turn++; M.all = null;
      M.mods = { ...M.mods };
      if (r.fx.tr) M.mods.tr = !fieldFor(st).tr;
      if (r.fx.twMe) M.mods.twMe = true;
      if (r.fx.twFoe) M.mods.twFoe = true;
      return true;
    }
    if (t.dataset.mreset) { M.hp = null; M.turn = 1; M.all = null; M.mods = {}; return true; }
    if (t.dataset.mall) { M.all = computeAll(st); return true; }
    if (t.dataset.mtree) { M.tree = {}; M.open = {}; return true; }
    if (t.dataset.tnext) { M.open[t.dataset.tnext] = !M.open[t.dataset.tnext]; return true; }
    if (t.dataset.tuse) {
      const n = nodeAt(st, t.dataset.tuse);
      if (!n) return false;
      for (const [s] of SLOTS) if (M.slots[s] && n.plays[s]) Object.assign(M.slots[s], { mv: n.plays[s].mv, tgt: n.plays[s].tgt || M.slots[s].tgt, userSet: true });
      M.hp = { ...n.state.hp }; M.mods = { ...(n.state.mods || {}) }; M.turn = n.state.turn; M.all = null;
      return true;
    }
    if (t.dataset.muse) {
      const row = M.all.rows[+t.dataset.muse];
      Object.assign(M.slots.a, row.oa.mv >= 0 ? { mv: row.oa.mv, tgt: row.oa.tgt || M.slots.a.tgt } : { mv: -1 });
      Object.assign(M.slots.b, row.ob.mv >= 0 ? { mv: row.ob.mv, tgt: row.ob.tgt || M.slots.b.tgt } : { mv: -1 });
      Object.assign(M.slots.c, row.worst.reply.c); Object.assign(M.slots.d, row.worst.reply.d);
      M.roll = 'peor';
      return true;
    }
    return false;
  }
  function change(t, st) {
    if (t.dataset.mmv) { const [s, i] = t.dataset.mmv.split(':'); M.slots[s].mv = +i; M.slots[s].userSet = true; M.all = null; return true; }
    if (t.dataset.mhp || t.dataset.mmon) { if (M.tree) { M.tree = {}; M.open = {}; } }
    if (t.dataset.mmon) { const s = t.dataset.mmon; const idx = +t.value; M.slots[s] = { idx, mv: -1, tgt: M.slots[s].tgt }; Object.assign(M.slots[s], bestPlay(st, s)); if (M.hp) delete M.hp[s]; M.all = null; return true; }
    if (t.dataset.mhp) { const s = t.dataset.mhp; M.hp = { ...(M.hp || {}), [s]: Math.max(0, Math.min(100, +t.value || 0)) }; M.all = null; return true; }
    return false;
  }

  return { render, renderTree, click, change, _sim: simulate };
})();
