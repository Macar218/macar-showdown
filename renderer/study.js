'use strict';
/*
 * Macar Showdown · Estudiar (sección Equipo).
 * El paso 2 de tu proceso: estudiar el equipo.
 * - Fuerza propia: control de velocidad, potencia y cobertura ofensiva, sinergia defensiva y revisión.
 * - Fuerza relativa: cómo le va contra lo más usado del meta (torneos de Limitless o, si no hay, Smogon),
 *   con el motor de daño (@smogon/calc): tu mejor golpe, su mejor golpe y quién es más rápido.
 * Nada se inventa: todo sale de tus sets, del motor y de los datos de uso.
 */
/* global $, esc, spr, P, Team, SET, VIEWS, show, I18N */

const Study = (() => {
  const V = { id: null, rel: null, relKey: '' };
  const EN = () => typeof I18N !== 'undefined' && I18N.lang === 'en';
  const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const SPEED_CONTROL = ['tailwind', 'trickroom', 'icywind', 'electroweb', 'thunderwave', 'scaryface', 'bulldoze', 'rocktomb', 'glare', 'nuzzle', 'quash', 'afteryou', 'cottonspore', 'stringshot'];
  const AB_IMMUNE = { Levitate: 'Ground', 'Flash Fire': 'Fire', 'Water Absorb': 'Water', 'Storm Drain': 'Water', 'Dry Skin': 'Water', 'Volt Absorb': 'Electric', 'Lightning Rod': 'Electric', 'Motor Drive': 'Electric', 'Sap Sipper': 'Grass', 'Earth Eater': 'Ground', 'Well-Baked Body': 'Fire' };
  const N = n => `<span class="nolang">${esc(n || '')}</span>`;
  const pcls = x => (x >= 100 ? 'ko' : x >= 50 ? 'mid' : 'low');
  const pct = x => `${Math.round(x)}%`;

  /** La forma con la que juega (Mega si lleva su piedra) y su habilidad. */
  const formOf = m => { const sp = P.megaOf(m); return { sp, ab: sp !== m.species ? (P.abilitiesOf(sp)[0] || m.ability) : m.ability }; };
  const spe = (m, side) => { try { return P.speed(m, P.blankField(), side) || 0; } catch (e) { return 0; } };

  /* ---------- fuerza propia ---------- */
  function speedCard(S) {
    const rows = S.map(m => ({ m, v: spe(m, 'me') })).sort((a, b) => b.v - a.v);
    const tr = rows.slice().reverse();
    const ctl = S.map(m => ({ m, mv: m.moves.filter(x => SPEED_CONTROL.includes(toID(x))) })).filter(x => x.mv.length);
    const prio = S.map(m => ({ m, mv: m.moves.filter(x => { const d = x && P.moveOf(x); return d && d.category !== 'Status' && (d.priority || 0) > 0; }) })).filter(x => x.mv.length);
    return `<div class="card stcard"><h3>Control de velocidad</h3>
      <p class="stline">${ctl.length ? ctl.map(x => `${spr(x.m.species, 'xs')}${N(x.m.moves.length ? x.mv.join(', ') : '')}`).join(' · ') : '<span class="badc">Sin control de velocidad (Tailwind, Trick Room, Icy Wind…)</span>'}</p>
      <p class="stline"><span class="note">Prioridad:</span> ${prio.length ? prio.map(x => `${spr(x.m.species, 'xs')}${N(x.mv.join(', '))}`).join(' · ') : '<span class="note">sin movimientos con prioridad</span>'}</p>
      <table class="sttab"><thead><tr><th></th><th>Velocidad</th><th>Con Viento Afín</th><th>En Trick Room</th></tr></thead><tbody>
      ${rows.map(x => `<tr><td>${spr(x.m.species, 'xs')} ${N(formOf(x.m).sp)}</td><td><b>${x.v}</b></td><td>${x.v * 2}</td><td>${tr.indexOf(x) + 1}º</td></tr>`).join('')}
      </tbody></table></div>`;
  }
  function coverageCard(S) {
    const off = Team.offense(S);
    const types = new Set();
    const row = m => {
      const mv = m.moves.filter(Boolean).map(x => ({ x, d: P.moveOf(x) })).filter(o => o.d && o.d.category !== 'Status');
      mv.forEach(o => types.add(o.d.type));
      return `<tr><td>${spr(m.species, 'xs')} ${N(formOf(m).sp)}</td><td>${mv.length ? mv.map(o => `<span class="stmv">${P.typeBadge(o.d.type)} ${N(o.x)} <i>${o.d.basePower || '—'}</i></span>`).join('') : '<span class="note">solo movimientos de estado</span>'}</td></tr>`;
    };
    const body = S.map(row).join('');
    const miss = off.filter(o => !o.hit);
    return `<div class="card stcard"><h3>Potencia y cobertura</h3>
      <table class="sttab stcov"><tbody>${body}</tbody></table>
      <p class="stline"><span class="note">Supereficaz contra ${18 - miss.length} de 18 tipos.</span> ${miss.length ? `<span class="note">Sin supereficaz contra:</span> ${miss.map(o => P.typeBadge(o.def)).join(' ')}` : '<span class="okc">Cubres todos los tipos.</span>'}</p></div>`;
  }
  function defenseCard(S) {
    const forms = S.map(m => { const f = formOf(m); return { m, sp: f.sp, ab: f.ab, ty: P.typesOf(f.sp) }; });
    const eff = (at, f) => { let e = P.effectiveness(at, f.ty); if (AB_IMMUNE[f.ab] === at) e = 0; if (f.ab === 'Thick Fat' && (at === 'Fire' || at === 'Ice')) e *= 0.5; return e; };
    const lbl = e => (e === 0 ? '0' : e >= 4 ? '×4' : e >= 2 ? '×2' : e <= 0.25 ? '¼' : e < 1 ? '½' : '');
    const cls = e => (e === 0 ? 'imm' : e >= 4 ? 'w4' : e >= 2 ? 'w2' : e < 1 ? 'res' : '');
    const rows = P.TYPES.map(at => {
      const es = forms.map(f => eff(at, f));
      const w = es.filter(e => e > 1).length, r = es.filter(e => e < 1).length;
      return { at, es, w, r, bad: w >= 3 && r === 0 };
    });
    return `<div class="card stcard stwide"><h3>Sinergia defensiva <span class="note">· ×2 y ×4 débil, ½ y ¼ resiste, 0 inmune</span></h3>
      <div class="stdefwrap"><table class="sttab stdef"><thead><tr><th></th>${forms.map(f => `<th title="${esc(f.sp)}">${spr(f.m.species, 'xs')}</th>`).join('')}<th>Débiles</th><th>Resisten</th></tr></thead><tbody>
      ${rows.map(x => `<tr class="${x.bad ? 'bad' : ''}"><td>${P.typeBadge(x.at)}</td>${x.es.map(e => `<td class="${cls(e)}">${lbl(e)}</td>`).join('')}<td class="${x.w >= 3 ? 'badc' : ''}">${x.w || ''}</td><td>${x.r || ''}</td></tr>`).join('')}
      </tbody></table></div>
      <ul class="tchk sm">${Team.checks(S).map(([k, t]) => `<li class="${k}">${esc(t)}</li>`).join('')}</ul></div>`;
  }

  /* ---------- fuerza relativa: contra lo más usado del meta ---------- */
  async function relative(S, key) {
    const box = $('#stRel');
    if (!box) return;
    if (V.relKey === key && V.rel) { box.innerHTML = V.rel; return; }
    const [U, T] = await Promise.all([P.usage().catch(() => null), P.tour().catch(() => null)]);
    const fromTour = !!(T && T.sets);
    const rank = (fromTour ? P.tourRank(T) : P.usageRank(U)).map(n => P.calcSpecies(n)).filter(Boolean);
    const mine = new Set(S.map(m => toID(P.baseSpecies(m.species))));
    const threats = [];
    for (const sp of rank) {
      if (threats.length >= 12) break;
      if (mine.has(toID(P.baseSpecies(sp)))) continue;
      const set = (fromTour && P.tourSet(T, U, sp)) || P.usageSet(U, sp);
      if (!set || !set.moves.some(Boolean)) continue;
      const t = fromTour ? P.tourOf(T, sp) : null;
      threats.push({ sp, set, use: t ? t.usage : null });
    }
    if (!threats.length) { box.innerHTML = '<p class="note">Sin datos del meta ahora mismo (torneos ni Smogon). Prueba más tarde.</p>'; return; }
    const f = P.blankField();
    const rows = [];
    for (const th of threats) {
      let my = null, their = null;
      for (const m of S) for (const mv of m.moves.filter(Boolean)) {
        const r = P.damage(m, th.set, mv, f, 'me');
        if (r && !r.err && r.hi > 0 && (!my || r.pHi > my.r.pHi)) my = { m, mv, r };
      }
      for (const mv of th.set.moves.filter(Boolean)) for (const m of S) {
        const r = P.damage(th.set, m, mv, f, 'foe');
        if (r && !r.err && r.hi > 0 && (!their || r.pHi > their.r.pHi)) their = { m, mv, r };
      }
      const ts = spe(th.set, 'foe'), faster = S.filter(m => spe(m, 'me') > ts).length;
      rows.push({ th, my, their, ts, faster });
      await new Promise(r => setTimeout(r, 0)); // que no se congele la pantalla
      if (V.relKey !== key && V.pending !== key) return;
    }
    const hit = x => (x ? `<span class="strel ${pcls(x.r.pHi)}">${spr(x.m.species, 'xs')} ${N(x.mv)} <b>${pct(x.r.pLo)}–${pct(x.r.pHi)}</b>${x.r.ko ? ` <i>${esc(P.koEs(x.r.ko))}</i>` : ''}</span>` : '<span class="note">—</span>');
    const html = `<p class="note"><span>${fromTour ? 'Los 12 más llevados en torneos de Limitless (30 días), con su set más común.' : 'Los 12 más usados en Smogon, con su set más común.'}</span> <span>Objetivo único y sin campo: para el detalle, la Calculadora. Tus Pokémon ya en el meta no salen.</span></p>
      <div class="stdefwrap"><table class="sttab strelt"><thead><tr><th>Rival</th><th>Velocidad</th><th>Tu mejor golpe</th><th>Su mejor golpe</th></tr></thead><tbody>
      ${rows.map(x => `<tr><td>${spr(x.th.sp, 'sm')} ${N(x.th.sp)}${x.th.use != null ? ` <span class="note">${String(x.th.use).replace('.', EN() ? '.' : ',')}%</span>` : ''}<br><span class="note">${N(x.th.set.item || '')}</span></td>
        <td><b>${x.ts}</b><br><span class="${x.faster >= 3 ? 'okc' : x.faster ? '' : 'badc'}">${x.faster} de ${S.length} más rápidos</span></td>
        <td>${hit(x.my)}</td><td>${x.their ? `${hit(x.their)} <span class="note">→</span> ${N(x.their.m.species)}` : '<span class="note">—</span>'}</td></tr>`).join('')}
      </tbody></table></div>`;
    V.rel = html; V.relKey = key;
    if ($('#stRel')) $('#stRel').innerHTML = html;
  }

  async function render() {
    const el = $('#v-estudio');
    const all = (await P.teams()).filter(t => t.side === 'me');
    if (!V.id || !all.some(t => t.id === V.id)) V.id = SET.teamId && all.some(t => t.id === SET.teamId) ? SET.teamId : (all[0] ? all[0].id : null);
    const team = all.find(t => t.id === V.id);
    const S = team ? P.parseTeam(team.text).sets.filter(m => m.species) : [];
    const head = `<div class="head"><div><h1>Estu<span>diar</span></h1><p class="note" style="margin-top:4px">Fuerza propia del equipo y cómo le va contra lo más usado del meta.</p></div>
      <div class="row-btns"><select id="stTeam" title="Equipo que estudias">${all.map(t => `<option value="${esc(t.id)}"${t.id === V.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
      <button class="btn" data-go="opt" title="Repartos de puntos (SP) con cálculos">Repartos (SP)</button><button class="btn" data-go="calc">Calculadora</button></div></div>`;
    if (!S.length) { el.innerHTML = `${head}<div class="card"><p class="note">Elige o crea un equipo en «Elegir y construir».</p></div>`; return; }
    el.innerHTML = `${head}
      <h2 class="sth">Fuerza propia</h2>
      <div class="stgrid">${speedCard(S)}${coverageCard(S)}${defenseCard(S)}</div>
      <h2 class="sth">Fuerza relativa <span class="note">· contra el meta</span></h2>
      <div class="card stcard" id="stRel"><p class="note">Calculando…</p></div>`;
    const key = `${team.id}|${team.text}|${typeof I18N !== 'undefined' ? I18N.lang : ''}`;
    V.pending = key;
    relative(S, key);
  }

  document.addEventListener('change', e => { if (e.target.id === 'stTeam') { V.id = e.target.value; render(); } });
  VIEWS.estudio = render;
  return { render };
})();
