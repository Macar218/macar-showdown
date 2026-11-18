'use strict';
/*
 * Macar Showdown · Optimizador de SP (el "EVs optimizer").
 * Para un Pokémon de tu equipo, busca el reparto de puntos (66 en total, máx. 32 por stat) y la naturaleza
 * que más rivales supera en velocidad, más golpes fuertes aguanta y más KOs hace, contra los rivales elegidos
 * (tus equipos rivales del Team Box o los más usados del formato). Todo el daño, con el motor de Smogon.
 */
/* global P, api, $, $$, esc, spr, VIEWS, Calc, SET, Team */

const Opt = (() => {
  const V = { slot: 0, src: 'tour', top: 20, teams: [], goal: 'eq', tw: false, res: null, pick: 0, busy: false, msg: '' };
  const STEP = 4;                       // los repartos se buscan de 4 en 4 (y lo que sobra va a PS)
  const VALS = [0, 4, 8, 12, 16, 20, 24, 28, 32];
  const GOALS = { eq: ['Equilibrado', { spe: 1, ohko: 1, two: 0.35, ko: 1, ko2: 0.35 }], spe: ['Velocidad', { spe: 2.5, ohko: 0.7, two: 0.2, ko: 0.6, ko2: 0.2 }], bulk: ['Aguante', { spe: 0.5, ohko: 2, two: 0.7, ko: 0.4, ko2: 0.15 }], off: ['Daño', { spe: 1, ohko: 0.6, two: 0.2, ko: 2, ko2: 0.7 }] };
  const tick = () => new Promise(r => setTimeout(r, 0));

  async function rivals() {
    const out = [];
    if (V.src === 'teams') {
      const teams = (await P.teams()).filter(t => V.teams.includes(t.id));
      for (const t of teams) for (const s of P.parseTeam(t.text).sets) if (!out.some(o => o.species === s.species)) out.push({ ...s, from: t.name });
    } else if (V.src === 'tour') {
      const [U, T] = await Promise.all([P.usage(''), P.tour()]);
      for (const id of P.tourRank(T).slice(0, V.top)) { const sp = P.calcSpecies(id); const s = sp && P.tourSet(T, U, sp); if (s && P.spOf(s.species)) out.push({ ...s, from: 'torneos' }); }
    } else {
      const U = await P.usage('');
      for (const sp of P.usageRank(U).slice(0, V.top)) { const s = P.usageSet(U, P.calcSpecies(sp) || sp); if (s && P.spOf(s.species)) out.push({ ...s, from: 'Smogon' }); }
    }
    return out;
  }

  /** Mejor ataque (el que más quita) de a contra d. */
  function bestHit(a, d, f, side) {
    let best = null;
    for (const mv of a.moves) {
      const md = P.moveOf(mv);
      if (!md || md.category === 'Status') continue;
      const r = P.damage(a, d, mv, f, side);
      if (r && !r.err && r.hi > 0 && (!best || r.hi > best.r.hi)) best = { mv, r, cat: md.category };
    }
    return best;
  }

  async function run() {
    const { team } = await Team.current();
    const mine = Team.sets(team)[V.slot];
    if (!mine) return;
    V.busy = true; V.res = null; V.msg = 'Calculando los repartos…'; render();
    const R = await rivals();
    if (!R.length) { V.busy = false; V.msg = 'Elige al menos un equipo rival.'; render(); return; }
    const f = { ...P.blankField(), me: { ...P.blankSide(), tw: V.tw } };
    const usesPhys = mine.moves.some(m => (P.moveOf(m) || {}).category === 'Physical');
    const usesSpec = mine.moves.some(m => (P.moveOf(m) || {}).category === 'Special');
    const offStat = usesPhys && !usesSpec ? 'atk' : usesSpec && !usesPhys ? 'spa' : (P.spOf(mine.species).baseStats.atk >= P.spOf(mine.species).baseStats.spa ? 'atk' : 'spa');
    const dump = offStat === 'atk' ? 'spa' : 'atk';
    // Naturalezas que tienen sentido: la tuya, y las que suben algo útil y bajan el ataque que no usas.
    const nats = new Set([mine.nature]);
    for (const n of P.NATURES) if (n.minus === dump && ['atk', 'spa', 'def', 'spd', 'spe'].includes(n.plus) && n.plus !== dump) nats.add(n.name);
    // Rivales: su velocidad y su golpe más fuerte (físico y especial) contra ti.
    const base = { ...mine, sp: [0, 0, 0, 0, 0, 0], hp: 100, boosts: {} };
    const foeInfo = R.map(r => ({ r, spe: P.speed(r, f, 'foe') }));
    const hits = [];
    for (const fi of foeInfo) {
      let phys = null, spec = null;
      for (const mv of fi.r.moves) {
        const md = P.moveOf(mv);
        if (!md || md.category === 'Status') continue;
        const x = P.damage(fi.r, base, mv, f, 'foe');
        if (!x || x.err || x.hi <= 0) continue;
        if (md.category === 'Physical' && (!phys || x.hi > phys.hi)) phys = { mv, hi: x.hi };
        if (md.category === 'Special' && (!spec || x.hi > spec.hi)) spec = { mv, hi: x.hi };
      }
      hits.push({ phys: phys && phys.mv, spec: spec && spec.mv });
    }
    const table = {};       // daño máximo que recibes (por PS, defensa, naturaleza)
    const offT = {};        // daño mínimo que haces (por SP de ataque, naturaleza)
    let n = 0;
    for (const nat of nats) {
      for (const hp of VALS) for (const dv of VALS) {
        for (let i = 0; i < R.length; i++) {
          for (const [cat, stat] of [['phys', 'def'], ['spec', 'spd']]) {
            const mv = hits[i][cat];
            if (!mv) continue;
            const me = { ...base, nature: nat, sp: [hp, 0, stat === 'def' ? dv : 0, 0, stat === 'spd' ? dv : 0, 0] };
            const x = P.damage(R[i], me, mv, f, 'foe');
            table[`${nat}|${i}|${cat}|${hp}|${dv}`] = x && !x.err ? { hi: x.hi, max: x.max } : { hi: 0, max: 1 };
          }
        }
        if (++n % 20 === 0) { V.msg = `Calculando los repartos… ${Math.round((n / (nats.size * 81)) * 100)}%`; const m = $('#opMsg'); if (m) m.textContent = V.msg; await tick(); }
      }
      for (const ov of VALS) for (let i = 0; i < R.length; i++) {
        const me = { ...base, nature: nat, sp: P.STATS.map(s => (s === offStat ? ov : 0)) };
        let best = null;
        for (const mv of mine.moves) {
          const md = P.moveOf(mv);
          if (!md || md.category === 'Status') continue;
          const x = P.damage(me, { ...R[i], hp: 100 }, mv, f, 'me');
          if (x && !x.err && (!best || x.lo > best.lo)) best = { lo: x.lo, hi: x.hi, max: x.max, mv };
        }
        offT[`${nat}|${i}|${ov}`] = best || { lo: 0, hi: 0, max: 1 };
      }
    }
    // Evaluar todos los repartos.
    const W = GOALS[V.goal][1];
    const spCache = new Map();
    const evalSpread = (nat, sp) => {
      const st = P.stats({ ...mine, nature: nat, sp });
      const sk = `${nat}|${sp[5]}`;
      if (!spCache.has(sk)) spCache.set(sk, P.speed({ ...mine, nature: nat, sp, boosts: {} }, f, 'me'));
      const mySpe = spCache.get(sk);
      let out = 0, ohko = 0, two = 0, ko = 0, ko2 = 0;
      const per = [];
      for (let i = 0; i < R.length; i++) {
        const faster = mySpe > foeInfo[i].spe;
        if (faster) out++;
        const hpv = sp[0] - (sp[0] % STEP);
        const ph = hits[i].phys ? table[`${nat}|${i}|phys|${hpv}|${sp[2] - (sp[2] % STEP)}`] : null;
        const sh = hits[i].spec ? table[`${nat}|${i}|spec|${hpv}|${sp[4] - (sp[4] % STEP)}`] : null;
        const worst = Math.max(ph ? ph.hi : 0, sh ? sh.hi : 0);
        const maxhp = st.hp;
        if (worst < maxhp) ohko++;
        if (worst * 2 < maxhp) two++;
        const o = offT[`${nat}|${i}|${sp[P.STATS.indexOf(offStat)] - (sp[P.STATS.indexOf(offStat)] % STEP)}`];
        if (o.lo >= o.max) ko++; else if (o.lo * 2 >= o.max) ko2++;
        per.push({ faster, mySpe, foeSpe: foeInfo[i].spe, taken: (worst / maxhp) * 100, dealt: [(o.lo / o.max) * 100, (o.hi / o.max) * 100], mv: o.mv, ohko: o.lo >= o.max });
      }
      const score = out * W.spe + ohko * W.ohko + two * W.two + ko * W.ko + ko2 * W.ko2;
      return { nat, sp, score, out, ohko, two, ko, ko2, per, mySpe };
    };
    const res = [];
    const idx = { hp: 0, off: P.STATS.indexOf(offStat), def: 2, spd: 4, spe: 5 };
    let c = 0;
    for (const nat of nats) {
      for (const spe of VALS) for (const off of VALS) for (const def of VALS) for (const spd of VALS) {
        const used = spe + off + def + spd;
        if (used > 66) continue;
        const hp = Math.min(32, 66 - used);
        if (used + hp > 66) continue;
        const sp = [0, 0, 0, 0, 0, 0];
        sp[idx.hp] = hp; sp[idx.off] = off; sp[idx.def] = def; sp[idx.spd] = spd; sp[idx.spe] = spe;
        // Lo que sobra (si PS ya está a 32) va a las defensas.
        let left = 66 - sp.reduce((a, b) => a + b, 0);
        for (const k of [2, 4]) { const add = Math.min(left, 32 - sp[k]); sp[k] += add; left -= add; }
        res.push(evalSpread(nat, sp));
        if (++c % 3000 === 0) await tick();
      }
    }
    // Ajuste fino de velocidad: el mínimo que da la misma cantidad de rivales superados.
    res.sort((a, b) => b.score - a.score || a.sp[5] - b.sp[5]);
    const top = [];
    for (const r of res) {
      if (top.length >= 6) break;
      if (top.some(t => t.nat === r.nat && t.sp.join() === r.sp.join())) continue;
      if (top.some(t => t.out === r.out && t.ohko === r.ohko && t.two === r.two && t.ko === r.ko && t.ko2 === r.ko2)) continue;
      top.push(r);
    }
    const cur = evalSpread(mine.nature, mine.sp.map(x => x));
    V.res = { mine, R, top, cur, offStat };
    V.pick = 0; V.busy = false; V.msg = '';
    render();
  }

  const bars = (sp, ref) => P.STATS.map((s, i) => `<div class="obar"><small>${P.SL[s]}</small><div><i class="ref" style="width:${(ref[i] / 32) * 100}%"></i><i class="new" style="width:${(sp[i] / 32) * 100}%"></i></div><b>${sp[i]}</b><em class="${sp[i] > ref[i] ? 'up' : sp[i] < ref[i] ? 'dn' : ''}">${sp[i] === ref[i] ? '' : `${sp[i] > ref[i] ? '+' : ''}${sp[i] - ref[i]}`}</em></div>`).join('');
  const metric = (r, N) => `<span title="Rivales que superas en velocidad">⚡ ${r.out}/${N}</span><span title="Golpes más fuertes de cada rival que aguantas sin caer">🛡 ${r.ohko}/${N}</span><span title="Rivales a los que haces KO de un golpe (tirada mínima)">💥 ${r.ko}/${N}</span>`;

  async function render() {
    const el = $('#v-opt');
    const { team } = await Team.current();
    const S = Team.sets(team);
    const allTeams = (await P.teams()).filter(t => t.side === 'foe');
    if (V.slot >= S.length) V.slot = 0;
    let out = `<div class="head"><div><h1>Optimizador <span>SP</span></h1><p class="note" style="margin-top:4px">Busca el mejor reparto de puntos y naturaleza para un Pokémon de tu equipo contra los rivales que elijas.</p></div></div>`;
    if (!S.length) { el.innerHTML = `${out}<div class="card"><p class="note">Primero crea o importa tu equipo en el Teambuilder.</p></div>`; return; }
    out += `<div class="card optcfg">
      <div class="optmons">${S.map((m, i) => `<button class="mchip${i === V.slot ? ' sel' : ''}" data-oslot="${i}" title="${esc(m.species)}">${spr(m.species, 'sm')}</button>`).join('')}<span class="note">${esc(team.name)}</span></div>
      <div class="optrow"><label class="field">Contra
        <select id="opSrc"><option value="tour"${V.src === 'tour' ? ' selected' : ''}>Los más llevados en torneos</option><option value="top"${V.src === 'top' ? ' selected' : ''}>Los más usados en Smogon</option><option value="teams"${V.src === 'teams' ? ' selected' : ''}>Equipos rivales del Team Box</option></select></label>
        ${V.src !== 'teams' ? `<label class="field">Cuántos<select id="opTop">${[10, 20, 30, 40].map(x => `<option${x === V.top ? ' selected' : ''}>${x}</option>`).join('')}</select></label>` : ''}
        <label class="field">Prioridad<div class="seg">${Object.entries(GOALS).map(([k, [l]]) => `<button data-ogoal="${k}" aria-pressed="${V.goal === k}">${l}</button>`).join('')}</div></label>
        <label class="tog${V.tw ? ' on' : ''}" style="align-self:flex-end"><input type="checkbox" id="opTw"${V.tw ? ' checked' : ''}>Con Viento Afín</label>
        <button class="btn primary" id="opGo" style="align-self:flex-end"${V.busy ? ' disabled' : ''}>Buscar repartos</button></div>
      ${V.src === 'teams' ? `<div class="optteams">${allTeams.length ? allTeams.map(t => `<label class="tog${V.teams.includes(t.id) ? ' on' : ''}"><input type="checkbox" data-oteam="${t.id}"${V.teams.includes(t.id) ? ' checked' : ''}>${esc(t.name)}</label>`).join('') : '<span class="note">Todavía no hay equipos rivales. Añádelos en Mi PC → Team Box (pegando su texto o su enlace de Pokepaste).</span>'}</div>` : ''}
      <p class="note" id="opMsg">${esc(V.msg)}</p></div>`;
    const r = V.res;
    if (r && r.mine.species === (S[V.slot] || {}).species) {
      const N = r.R.length, sel = r.top[V.pick] || r.top[0];
      out += `<div class="optres">
        <div class="card"><h2>Propuestas</h2>
          <div class="optlist"><button class="optitem cur${V.pick === -1 ? ' on' : ''}" data-opick="-1"><b>Tu reparto</b><span class="note">${esc(P.natLabel(r.mine.nature))} · ${esc(P.spLine(r.mine))}</span><div class="optm">${metric(r.cur, N)}</div></button>
          ${r.top.map((t, i) => `<button class="optitem${V.pick === i ? ' on' : ''}" data-opick="${i}"><b>${i === 0 ? 'La mejor' : `Opción ${i + 1}`}</b><span class="note">${esc(P.natLabel(t.nat))} · ${t.sp.join('/')}</span><div class="optm">${metric(t, N)}</div></button>`).join('')}</div>
          ${r.top[0] && r.top[0].nat === r.mine.nature ? '<p class="note" style="margin-top:8px">Tu naturaleza ya es la que mejor sale contra estos rivales.</p>' : ''}</div>
        ${(() => {
          const t = V.pick === -1 ? r.cur : sel;
          const st = P.stats({ ...r.mine, nature: t.nat, sp: t.sp });
          return `<div class="card"><h2>${V.pick === -1 ? 'Tu reparto' : 'Comparativa'} <span class="note">tus puntos (gris) y la propuesta (color)</span></h2>
            <div class="obars">${bars(t.sp, r.mine.sp)}</div>
            <p class="note" style="margin:8px 0">${esc(P.natLabel(t.nat))} · PS ${st.hp} · Atq ${st.atk} · Def ${st.def} · AtE ${st.spa} · DfE ${st.spd} · Vel ${st.spe}${V.tw ? ` (${t.mySpe} con Viento Afín)` : ''}</p>
            ${V.pick === -1 ? '' : `<div class="row-btns"><button class="btn primary" data-oapply="1">Ponerlo en mi equipo</button><button class="btn" data-opc="1">Guardar en Mi PC</button><button class="btn" data-ocopy="1">Copiar</button><span class="note" id="opDone"></span></div>`}
            <table class="opttable"><thead><tr><th>Rival</th><th>Velocidad</th><th>Su golpe más fuerte</th><th>Tu mejor golpe</th></tr></thead><tbody>
            ${t.per.map((p, i) => `<tr><td>${spr(r.R[i].species, 'xs')}${esc(r.R[i].species)}<small>${esc(r.R[i].from)}</small></td>
              <td class="${p.faster ? 'good' : 'bad'}">${p.faster ? 'Te mueves antes' : 'Él se mueve antes'} <small>${p.mySpe} vs ${p.foeSpe}</small></td>
              <td class="${p.taken >= 100 ? 'bad' : p.taken >= 50 ? '' : 'good'}">${p.taken > 0 ? `hasta ${P.pct(p.taken)}%${p.taken >= 100 ? ' · te tumba' : ''}` : 'No te hace daño'}</td>
              <td class="${p.ohko ? 'good' : ''}">${p.mv ? `${esc(p.mv)}: ${P.pct(p.dealt[0])}–${P.pct(p.dealt[1])}%${p.ohko ? ' · KO' : ''}` : '—'}</td></tr>`).join('')}</tbody></table></div>`;
        })()}</div>`;
    }
    el.innerHTML = out;
  }

  const el = $('#v-opt');
  el.addEventListener('click', async e => {
    const t = e.target.closest('button');
    if (!t) return;
    const d = t.dataset;
    if (d.oslot) { V.slot = +d.oslot; V.res = null; render(); }
    else if (d.ogoal) { V.goal = d.ogoal; if (V.res) run(); else render(); }
    else if (t.id === 'opGo') run();
    else if (d.opick) { V.pick = +d.opick; render(); }
    else if (d.oapply || d.opc || d.ocopy) {
      const r = V.res, s = r.top[V.pick];
      const m = { ...P.cleanSet(r.mine), nature: s.nat, sp: s.sp.slice() };
      if (d.ocopy) { navigator.clipboard.writeText(P.exportSet(m)); $('#opDone').textContent = 'Copiado.'; }
      if (d.opc) { const x = await P.pcAdd(m, { name: `${m.species} optimizado`, side: 'me', notes: `Optimizador: ${GOALS[V.goal][0]}, contra ${r.R.length} rivales.` }); $('#opDone').textContent = x.ok ? 'Guardado en Mi PC.' : x.why; }
      if (d.oapply) {
        const { team } = await Team.current();
        const S = Team.sets(team);
        S[V.slot] = { ...S[V.slot], nature: s.nat, sp: s.sp.slice() };
        team.text = P.exportTeam(S.map(P.cleanSet));
        await P.saveTeam(team); Calc.reloadTeams();
        V.res.mine = { ...V.res.mine, nature: s.nat, sp: s.sp.slice() };
        $('#opDone').textContent = 'Puesto en tu equipo.';
      }
    }
  });
  el.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'opSrc') { V.src = t.value; V.res = null; render(); }
    else if (t.id === 'opTop') { V.top = +t.value; V.res = null; render(); }
    else if (t.id === 'opTw') { V.tw = t.checked; V.res = null; render(); }
    else if (t.dataset.oteam) { const id = t.dataset.oteam; V.teams = t.checked ? [...V.teams, id] : V.teams.filter(x => x !== id); V.res = null; render(); }
  });

  VIEWS.opt = render;
  return { render, run };
})();
