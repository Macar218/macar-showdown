'use strict';
/*
 * Macar Showdown · Inicio: tu plan de temporada (la primera sección del menú; la app se abre aquí).
 * Pestañas:
 *   Hoy        · empezar la sesión (solo el objetivo) o la que tienes abierta, cómo va la semana (horas, reparto y
 *                Jugar:Análisis frente a tu base) con tu plan para la semana, y tu foco.
 *   Calendario · el mes con tus sesiones, partidas y torneos; al pulsar un día, su detalle y planear una sesión.
 *   Temporada  · cada regulación con sus números y tu valoración, y tu base.
 *   Torneos    · tus torneos con CP (Best Finish Limit), premios y gastos.
 * Sin horas fijas ni reglas: la base es una referencia (por defecto, entre 2 y 3 horas de juego por cada una de
 * análisis). La barra de abajo (#sessBar) es el cronómetro de la sesión abierta: tú eliges qué estás haciendo.
 * También pinta la ventana de cerrar o ver una sesión. Los cálculos están en season.js.
 */
/* global $, $$, esc, spr, api, DB, P, M, SET, F, Sess, Season, Stats, Dash, VIEWS, VIEW, show, load, closeModal, I18N, W2 */

const Home = (() => {
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* nada */ } return null; };
  const TABS = [['hoy', 'Hoy'], ['cal', 'Calendario'], ['temp', 'Temporada'], ['torneos', 'Torneos']];
  const ICO = {
    hoy: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
    cal: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M7 14h2M11 14h2M15 14h2M7 17h2M11 17h2"/>',
    temp: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    torneos: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>'
  };
  const t0 = Season.today();
  const savedTab = ls('msHomeTab') === 'semana' ? 'cal' : ls('msHomeTab');
  const H = {
    tab: TABS.some(([k]) => k === savedTab) ? savedTab : 'hoy',
    month: t0.slice(0, 7), day: t0, goal: '', planGoal: '',
    reg: '', season: Season.seasonOf(t0), msg: '', imp: []
  };
  const EN = () => typeof I18N !== 'undefined' && I18N.lang === 'en';
  const LOC = () => (EN() ? 'en-GB' : 'es-ES');
  const fd = (d, o) => Season.parseDay(d).toLocaleDateString(LOC(), o);
  const dShort = d => fd(d, { weekday: 'short', day: 'numeric', month: 'short' });
  const num = (v, dec = 1) => (Math.round((+v || 0) * 10 ** dec) / 10 ** dec).toLocaleString(LOC());
  const hrs = h => `${num(h)} h`;
  const pctS = v => (v == null ? '—' : `${Math.round(v * 100)}%`);
  const eur = v => `${(Math.round((+v || 0) * 100) / 100).toLocaleString(LOC(), { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
  const PIL = Object.fromEntries(Season.PILLARS);
  const ST = { plan: 'Prevista', open: 'En curso', done: 'Hecha', skip: 'Saltada' };
  const mine = () => M.filter(s => s.me);
  /** Lo que trajo la importación: una línea por archivo (así se traduce cada una). */
  const impMsg = () => H.imp.map(x => `<span class="note">${esc(x)}</span>`).join('');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* ---------- datos ---------- */
  const normPlan = p => ({ cfg: { ...((p && p.cfg) || {}) }, weeks: { ...((p && p.weeks) || {}) }, regs: Array.isArray(p && p.regs) ? p.regs.slice() : [] });
  async function savePlan(fn) { const p = normPlan(await DB.get('plan')); fn(p); await DB.set('plan', p); return p; }
  async function data() {
    const [sess, plan, tours, teams] = await Promise.all([Sess.list(), DB.get('plan'), DB.get('misTorneos'), P.teams()]);
    const openId = SET.sessionId || '';
    // La sesión abierta, con lo que el cronómetro aún no ha guardado.
    const list = sess.map(s => (s.id === openId ? { ...s, track: Sess.trackOf(s) } : s));
    return { sess: list, plan: normPlan(plan), tours: Array.isArray(tours) ? tours : [], teams: (Array.isArray(teams) ? teams : []).filter(t => t && t.side === 'me'), openId };
  }
  const stateOf = (s, d) => Season.stateOf(s, d.openId);

  /* ---------- piezas ---------- */
  const tabs = () => `<div class="seg dtabs hmtabs">${TABS.map(([k, l]) => `<button data-hmtab="${k}" aria-pressed="${H.tab === k}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICO[k]}</svg>${l}</button>`).join('')}</div>`;
  /** Barra de los cuatro pilares (minutos). */
  function pillBar(m) {
    const tot = Season.sum(m);
    if (!tot) return '<div class="hmpbar empty"></div>';
    return `<div class="hmpbar">${Season.PK.filter(k => m[k] > 0).map(k => `<i class="p-${k}" style="width:${(m[k] / tot) * 100}%" title="${PIL[k]}: ${Season.dur(m[k])}"></i>`).join('')}</div>`;
  }
  /** Leyenda con los minutos de cada pilar. */
  const legend = m => `<div class="hmleg">${Season.PILLARS.map(([k, n]) => `<span><i class="p-${k}"></i>${n}${m ? ` <b>${Season.dur(m[k])}</b>` : ''}</span>`).join('')}</div>`;
  /** Jugar : Análisis frente a tu base. */
  function ratioHTML(m, plan) {
    const r = Season.ratio(m), l = Season.ratioLight(r, plan), [lo, hi] = Season.cfgOf(plan).ratio;
    const adv = Season.ratioAdvice(r, plan);
    return `<div class="hmratio ${l}"><small>Jugar : Análisis</small><b>${Season.ratioTxt(r, LOC())}</b><span class="note">tu base: ${num(lo)}:1 a ${num(hi)}:1</span>${adv && l !== 'good' ? `<p class="hmadv">${adv}</p>` : ''}</div>`;
  }

  /** Una sesión en lista (Hoy, Calendario): objetivo, duración, si lo cumpliste y lo que te llevas. */
  function sessRow(s, d) {
    const st = stateOf(s, d), r = Season.realMin(s, M, d.openId), day = Season.dayCount(s, d.openId);
    const ng = mine().filter(m => m.session === s.id).length;
    const go = st === 'plan' && (!s.day || s.day <= Season.today()) ? `<button class="btn sm primary" data-hm="start" data-id="${esc(s.id)}">▶ <span>Empezar</span></button>` : st === 'open' ? `<button class="btn sm primary" data-hm="close" data-id="${esc(s.id)}">Cerrar sesión</button>` : '';
    return `<div class="hmsess st-${st}">
      <span class="hmsday">${day ? esc(dShort(day)) : '—'}</span>
      <span class="hmsgoal">${s.ok === true ? '<b class="hmok">✔</b>' : s.ok === false ? '<b class="hmko">✘</b>' : ''}${s.goal ? `<span class="nolang">${esc(s.goal)}</span>` : '<span class="note">Sin objetivo</span>'}${s.lesson ? `<small><span>Te llevas</span>: <span class="nolang">${esc(s.lesson)}</span></small>` : ''}</span>
      <span class="hmsdur">${(st === 'done' || st === 'open') && r.total ? `${Season.dur(r.total)}${r.est ? '<sup title="Estimado por tus partidas">*</sup>' : ''}` : st === 'plan' ? '<span class="hmstate st-plan">Prevista</span>' : st === 'skip' ? '<span class="hmstate">Saltada</span>' : ''}</span>
      <span class="hmsact">${ng ? `<button class="btn sm" data-hm="sgames" data-id="${esc(s.id)}" title="Ver sus partidas en el Dashboard">${ng === 1 ? '1 partida' : `${ng} partidas`}</button>` : ''}${go}<button class="btn sm ibtn" data-hm="edit" data-id="${esc(s.id)}" title="Ver o cambiar la sesión">✎</button><button class="btn sm ibtn danger" data-hm="del" data-id="${esc(s.id)}" title="Borrar la sesión (sus partidas se quedan)">✕</button></span></div>`;
  }

  /* ---------- Hoy ---------- */
  function focusData(d) {
    const ms = mine().sort((a, b) => b.endedAt - a.endedAt);
    const W = Stats.whyCount(ms.filter(s => s.result === 'loss').slice(0, 20));
    const top = Object.entries(W.n).sort((a, b) => b[1] - a[1])[0];
    const err = top && top[1] ? { k: top[0], n: top[1], label: (Stats.WHY.find(w => w.k === top[0]) || {})[EN() ? 'en' : 'es'] || top[0] } : null;
    const les = [
      ...d.sess.filter(s => String(s.lesson || '').trim()).map(s => ({ t: Season.parseDay(Season.dayCount(s, d.openId) || Season.today()).getTime() + 1, text: s.lesson.trim() })),
      ...Stats.whyCount(ms).lessons.map(x => ({ t: x.t, text: x.text, id: x.id, result: x.result }))
    ].sort((a, b) => b.t - a.t).slice(0, 3);
    const toAn = ms.filter(s => s.mark && s.mark.a === true).length;
    const pred = Stats.predCount(ms.slice(0, 50));
    return { err, les, toAn, pred };
  }
  /** Los botones del cronómetro (la misma pieza en Hoy y en la barra de abajo). */
  function actBtns(s, big) {
    const t = Sess.trackOf(s), a = Sess.act();
    return `<div class="sbacts${big ? ' big' : ''}">${['play', 'serious', 'an', 'tb'].map(k => [k, PIL[k]]).map(([k, n]) => `<button class="sbact p-${k}${a === k ? ' on' : ''}" data-sbact="${k}" aria-pressed="${a === k}"><span>${n}</span><b data-sbmin="${k}">${Season.dur(t[k])}</b></button>`).join('')}<button class="sbact pause${a === 'pause' ? ' on' : ''}" data-sbact="pause" aria-pressed="${a === 'pause'}" title="Para el cronómetro"><span>⏸ Pausa</span></button></div>`;
  }
  function hoyHTML(d) {
    const t = Season.today(), wk = Season.week(Season.weekOf(t), d.sess, d.plan, M, d.openId);
    const lp = Season.lastPlay(d.sess, M, d.openId, t), cur = d.sess.find(s => s.id === d.openId && stateOf(s, d) === 'open');
    const todayPlan = d.sess.find(s => s.state === 'plan' && s.day === t);
    const past = Season.pendingPast(d.sess, t), fo = focusData(d), w = d.plan.weeks[wk.k] || {};
    let sess;
    if (cur) {
      const r = Season.realMin(cur, M, d.openId);
      sess = `<div class="card hmcard hmsesscard on"><h2>Tu sesión <span class="hmtimer" id="hmTimer">${Season.dur(r.total)}</span></h2>
        <label class="field">Objetivo<input type="text" id="hmGoalNow" maxlength="300" value="${esc(cur.goal || '')}" placeholder="Tu error más repetido o lo que toque probar"></label>
        <div class="field"><span>Ahora estás…</span>${actBtns(cur, true)}</div>
        <div class="row-btns"><button class="btn primary" data-go="jugar">▶ <span>Ir a Jugar</span></button><span style="flex:1"></span><button class="btn" data-hm="close" data-id="${esc(cur.id)}">Cerrar sesión</button></div></div>`;
    } else {
      if (!H.goal && todayPlan && todayPlan.goal) H.goal = todayPlan.goal;
      sess = `<div class="card hmcard hmsesscard"><h2>Empezar una sesión</h2>
        ${todayPlan ? '<p class="note">Hoy tenías una sesión prevista: cambia el objetivo si quieres y empieza.</p>' : ''}
        <label class="field">Objetivo de hoy<input type="text" id="hmGoal" maxlength="300" value="${esc(H.goal)}" placeholder="${fo.err ? esc(`Ej.: menos errores de ${fo.err.label}`) : 'Ej.: jugar con Trick Room y analizar las derrotas'}"></label>
        <div class="row-btns"><button class="btn primary hmgo" data-hm="begin">▶ <span>Empezar</span></button><span class="note">El cronómetro de abajo empieza en Jugar: cámbialo cuando analices o hagas TB.</span></div>
        ${past.length ? `<p class="note hmpast">${past.length === 1 ? '1 sesión prevista de otro día sin hacer.' : `${past.length} sesiones previstas de otros días sin hacer.`} <button class="btn sm" data-hm="skipold">Marcarlas como saltadas</button></p>` : ''}</div>`;
    }
    return `<div class="hmgrid hmtoday">${sess}
      <div class="card hmcard"><h2>Esta semana <span class="note">${esc(fd(wk.k, { day: 'numeric', month: 'short' }))} – ${esc(fd(wk.end, { day: 'numeric', month: 'short' }))}</span></h2>
        <div class="hmbig"><b>${hrs(wk.doneH)}</b><span class="note">${wk.doneN === 1 ? '1 sesión' : `${wk.doneN} sesiones`}${lp.days != null ? ` · <span>${lp.days === 0 ? 'has jugado hoy' : lp.days === 1 ? '1 día sin jugar' : `${lp.days} días sin jugar`}</span>` : ''}</span></div>
        ${pillBar(wk.done)}${legend(wk.done)}
        ${ratioHTML(wk.done, d.plan)}
        <label class="field">Tu plan para la semana<textarea data-hmw="want" rows="3" maxlength="2000" placeholder="Ej.: probar Trick Room, un Bo3 serio el sábado y analizar todas las derrotas">${esc(w.want || '')}</textarea></label>
        <p class="note hmsaved" id="hmWSaved"></p></div>
      <div class="card hmcard"><h2>Tu foco</h2>
        <div class="hmfo"><small>El error que más repites</small>${fo.err ? `<b class="hmerr">${esc(fo.err.label)}</b>` : '<span class="note">Aún no has analizado derrotas: en la replay, pestaña Análisis.</span>'}</div>
        <div class="hmfo"><small>Lo que te has llevado</small>${fo.les.length ? `<ul class="hmles">${fo.les.map(x => `<li${x.id ? ` data-view="${esc(x.id)}" class="link ${x.result || ''}" title="Ver la replay"` : ''}><span class="nolang">${esc(x.text.slice(0, 200))}</span></li>`).join('')}</ul>` : '<span class="note">Lo que te llevas de cada sesión y de cada partida analizada sale aquí.</span>'}</div>
        <div class="hmfo"><small>Tu lectura</small>${fo.pred.n ? `<b class="hmpred">${Math.round(fo.pred.pct * 100)}%</b><span class="note">${fo.pred.n === 1 ? 'de aciertos en 1 turno predicho' : `de aciertos en ${fo.pred.n} turnos predichos`}</span>` : '<span class="note">En una replay, «🎯 Predecir».</span>'}</div>
        ${fo.toAn ? `<div class="hmfo"><small>Por analizar</small><button class="btn sm" data-hm="toan">🔍 <span>${fo.toAn === 1 ? '1 partida por analizar' : `${fo.toAn} partidas por analizar`}</span></button></div>` : ''}</div>
    </div>
    ${H.sync ? `<p class="note hmsync">Tus partidas y replays solo están en este ordenador. <button class="btn sm" data-hm="onedrive">Usar OneDrive</button> para verlas también en tus otros ordenadores.</p>` : ''}`;
  }

  /* ---------- Calendario ---------- */
  function calHTML(d) {
    const [y, mo] = H.month.split('-').map(Number);
    const first = `${H.month}-01`, start = Season.weekOf(first);
    const lastDay = Season.dayOf(new Date(y, mo, 0));
    const weeks = [];
    for (let k = start; k <= lastDay; k = Season.addDays(k, 7)) weeks.push(k);
    const byDay = new Map();
    const put = (day, kind, x) => { if (!day) return; if (!byDay.has(day)) byDay.set(day, { s: [], m: [], t: [] }); byDay.get(day)[kind].push(x); };
    for (const s of d.sess) put(Season.dayCount(s, d.openId), 's', s);
    for (const s of mine()) put(Season.dayOf(s.endedAt), 'm', s);
    for (const t of d.tours) if (Season.isDay(t.date)) put(t.date, 't', t);
    const today = Season.today();
    const wd = Array.from({ length: 7 }, (_, i) => fd(Season.addDays('2024-01-01', i), { weekday: 'short' })); // 2024-01-01 fue lunes
    const cell = day => {
      const x = byDay.get(day) || { s: [], m: [], t: [] }, w = x.m.filter(s => s.result === 'win').length, l = x.m.filter(s => s.result === 'loss').length;
      const mins = x.s.reduce((a, s) => a + Season.realMin(s, M, d.openId).total, 0);
      return `<button class="hmday${day.slice(0, 7) !== H.month ? ' out' : ''}${day === today ? ' today' : ''}${day === H.day ? ' sel' : ''}" data-hmday="${day}">
        <span class="hmdn">${+day.slice(8)}</span>
        ${x.s.map(s => { const st = stateOf(s, d); return `<span class="hmchip st-${st}${s.ok === false ? ' ko' : ''}">${st === 'plan' ? '○' : s.ok === true ? '✔' : s.ok === false ? '✘' : '●'} <span class="nolang">${esc(s.goal || '')}</span></span>`; }).join('')}
        ${x.t.map(t => `<span class="hmchip tour">🏆 <span class="nolang">${esc(t.name)}</span></span>`).join('')}
        <span class="hmdm">${mins ? `<b>${Season.dur(mins)}</b>` : ''}${x.m.length ? ` ${w}-${l}` : ''}</span></button>`;
    };
    const wkCol = k => { const w = Season.week(k, d.sess, d.plan, M, d.openId); return w.doneH ? `<div class="hmwk" title="Horas de la semana"><b>${num(w.doneH)}</b><small>h</small></div>` : '<div class="hmwk empty"></div>'; };
    const sel = byDay.get(H.day) || { s: [], m: [], t: [] };
    const sw = sel.m.filter(s => s.result === 'win').length, sl = sel.m.filter(s => s.result === 'loss').length;
    const title = fd(first, { month: 'long', year: 'numeric' });
    return `<div class="hmweeknav"><button class="btn sm ibtn" data-hmmonth="-1" title="Mes anterior">◀</button><b class="hmmonth">${esc(cap(title))}</b><button class="btn sm ibtn" data-hmmonth="1" title="Mes siguiente">▶</button>${H.month !== today.slice(0, 7) ? '<button class="btn sm" data-hmmonth="0">Hoy</button>' : ''}
      <span class="hmcalleg"><span class="hmchip st-done">✔ Hecha</span><span class="hmchip st-plan">○ Prevista</span><span class="hmchip st-skip">Saltada</span></span></div>
    <div class="hmcalwrap"><div class="hmcal"><div class="hmcalh">${wd.map(x => `<span>${esc(x)}</span>`).join('')}<span>Horas</span></div>
      ${weeks.map(k => `<div class="hmcalw">${Array.from({ length: 7 }, (_, i) => cell(Season.addDays(k, i))).join('')}${wkCol(k)}</div>`).join('')}</div>
    <div class="card hmcard hmdaycard"><h2>${esc(cap(fd(H.day, { weekday: 'long', day: 'numeric', month: 'long' })))}</h2>
      ${sel.s.length ? `<div class="hmlist">${sel.s.map(s => sessRow(s, d)).join('')}</div>` : ''}
      ${sel.t.map(t => `<p class="hmdtour">🏆 <b class="nolang">${esc(t.name)}</b> <span class="note"><span>${esc((Season.TIER[t.tier] || {}).n || '')}</span>${t.place ? ` · <span>puesto ${esc(t.place)}</span>` : ''}</span></p>`).join('')}
      ${sel.m.length ? `<div class="hmdmatches"><small>Partidas</small> <b>${sel.m.length}</b> <span class="note">· ${sw}-${sl}</span> <button class="btn sm" data-hm="dgames" data-day="${esc(H.day)}">Ver en el Dashboard</button><div class="hmdmlist">${sel.m.slice().sort((a, b) => a.endedAt - b.endedAt).slice(0, 30).map(s => `<button class="hmdmx ${s.result || ''}" data-view="${esc(s.id)}" title="Ver la replay">${spr((s[s.opp] || { leads: [] }).leads[0] || 'Pikachu', 'xs')}<span class="nolang">${esc((s[s.opp] || {}).name || '?')}</span></button>`).join('')}</div></div>` : ''}
      ${!sel.s.length && !sel.m.length && !sel.t.length ? '<p class="note">Nada este día.</p>' : ''}
      ${H.day >= today ? `<div class="hmline hmplanday"><label class="field hmgrow">Planear una sesión este día<input type="text" id="hmPlanGoal" maxlength="300" value="${esc(H.planGoal)}" placeholder="Objetivo (lo puedes cambiar ese día)"></label><button class="btn" data-hm="planday">+ <span>Planear</span></button></div>` : ''}
      <p class="note">${esc(H.msg)}</p></div></div>`;
  }

  /* ---------- Temporada ---------- */
  function tempHTML(d) {
    const regs = d.plan.regs.slice().sort((a, b) => String(b.start).localeCompare(String(a.start)));
    const cur = Season.regOf(d.plan, Season.today());
    if (!H.reg || (H.reg !== 'all' && !regs.some(r => r.id === H.reg))) H.reg = cur ? cur.id : regs[0] ? regs[0].id : 'all';
    const R = H.reg === 'all' ? allReg(d) : regs.find(r => r.id === H.reg);
    const st = R && Season.reg(R, d.sess, d.plan, M, d.openId);
    const cfg = Season.cfgOf(d.plan), fo = focusData(d);
    const ns = R ? d.sess.filter(s => { const x = Season.dayCount(s, d.openId); const stt = stateOf(s, d); return (stt === 'done' || stt === 'open') && x >= R.start && (!R.end || x <= R.end); }).length : 0;
    const kpi = (v, l, sub, cls = '') => `<div class="hmkpi ${cls}"><b>${v}</b><span>${l}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const r = st ? Season.ratio(st.split) : null;
    return `<div class="hmweeknav"><label class="field hmregsel">Ver<select id="hmRegSel">${regs.map(x => `<option value="${esc(x.id)}"${H.reg === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}<option value="all"${H.reg === 'all' ? ' selected' : ''}>Todo</option></select></label>
      ${R && H.reg !== 'all' ? `<span class="note">${esc(fd(R.start, { day: 'numeric', month: 'short', year: 'numeric' }))}${R.end ? ` – ${esc(fd(R.end, { day: 'numeric', month: 'short', year: 'numeric' }))}` : ''}</span>` : ''}<span style="flex:1"></span><button class="btn sm" data-hm="regnew">+ <span>Nueva regulación</span></button></div>
    ${st ? `<div class="hmkpis">${kpi(hrs(st.doneH), 'Horas')}${kpi(ns, 'Sesiones')}${kpi(st.avg == null ? '—' : hrs(st.avg), 'Media por semana')}${kpi(Season.ratioTxt(r, LOC()), 'Jugar : Análisis', `tu base: ${num(cfg.ratio[0])}:1 a ${num(cfg.ratio[1])}:1`, Season.ratioLight(r, d.plan))}${kpi(pctS(Season.sum(st.split) ? st.split.tb / Season.sum(st.split) : null), 'TB / Teoría', 'del tiempo')}</div>
      <div class="hmgrid hmtemp"><div class="card hmcard"><h2>Reparto</h2>${pillBar(st.split)}${legend(st.split)}${ratioHTML(st.split, d.plan)}</div>
        <div class="card hmcard"><h2>Horas por semana</h2>${weeksChart(st.weeks, d)}</div></div>` : '<div class="card"><p class="note">Aún no tienes ninguna regulación. Crea una con sus fechas y tu objetivo: las semanas se asignan solas.</p></div>'}
    <div class="card hmcard"><h2>Regulaciones</h2>${regs.length ? regs.map(x => regRow(x, d, fo)).join('') : '<p class="note">Ninguna todavía.</p>'}</div>
    <div class="card hmcard"><h2>Tu base</h2>
      <div class="hmrules"><label class="field">Horas de juego por cada una de análisis<span class="hmpair"><input type="number" min="0.5" max="10" step="0.5" data-hmc="ratio0" value="${esc(cfg.ratio[0])}"><input type="number" min="0.5" max="10" step="0.5" data-hmc="ratio1" value="${esc(cfg.ratio[1])}"></span></label>
        <label class="field">Cambio de moneda (1 € = X $)<input type="number" min="0.1" max="5" step="0.01" data-hmc="rate" value="${esc(cfg.rate)}"></label></div>
      <p class="note">Una referencia, no una regla: no hay horas fijas. Juego = Jugar + Juego serio.</p>
      <div class="row-btns"><button class="btn sm" data-hm="import" title="Trae tus semanas, sesiones, regulaciones y torneos de tus Excel de Road to Worlds">Importar tus Excel…</button>${impMsg()}<span class="note hmsaved" id="hmCSaved"></span></div></div>`;
  }
  /** «Todo»: desde la primera sesión hasta hoy. */
  function allReg(d) {
    const days = d.sess.map(s => Season.dayCount(s, d.openId)).filter(Season.isDay).sort();
    return { id: 'all', name: 'Todo', start: days[0] || Season.today(), end: '' };
  }
  function weeksChart(ks, d) {
    const ws = ks.slice(-16).map(k => Season.week(k, d.sess, d.plan, M, d.openId));
    if (!ws.length) return '';
    const max = Math.max(1, ...ws.map(w => w.doneH));
    return `<div class="hmchart">${ws.map(w => `<div class="hmcol" title="${esc(fd(w.k, { day: 'numeric', month: 'short' }))}: ${hrs(w.doneH)}"><div class="hmcolbar">${Season.PK.map(k => `<i class="seg p-${k}" style="height:${(w.done[k] / 60 / max) * 100}%"></i>`).join('')}</div><small>${esc(fd(w.k, { day: 'numeric', month: 'numeric' }))}</small></div>`).join('')}</div>`;
  }
  const EVAL = [['', '—'], ['short', 'Corto'], ['ok', 'Bien'], ['long', 'Largo']];
  function regRow(r, d, fo) {
    const st = Season.reg(r, d.sess, d.plan, M, d.openId);
    const ev = r.eval || {};
    return `<div class="hmreg">
      <div class="hmreghead"><b class="nolang">${esc(r.name)}</b><span class="note">${esc(fd(r.start, { day: 'numeric', month: 'short', year: 'numeric' }))}${r.end ? ` – ${esc(fd(r.end, { day: 'numeric', month: 'short', year: 'numeric' }))}` : ''}</span>${r.ok === true ? '<span class="pill win">Objetivo cumplido</span>' : r.ok === false ? '<span class="pill loss">No cumplido</span>' : ''}<span style="flex:1"></span><button class="btn sm" data-hm="regedit" data-id="${esc(r.id)}">✎ <span>Editar</span></button><button class="btn sm ibtn danger" data-hm="regdel" data-id="${esc(r.id)}" title="Borrar la regulación">✕</button></div>
      ${r.goal ? `<p class="hmgoal"><small>Objetivo</small> <span class="nolang">${esc(r.goal)}</span></p>` : ''}
      ${st ? `<p class="hmregnums"><span><b>${hrs(st.doneH)}</b> hechas</span><span><b>${st.avg == null ? '—' : hrs(st.avg)}</b> por semana</span><span><b>${Season.ratioTxt(Season.ratio(st.split), LOC())}</b> <span>Jugar : Análisis</span></span></p>${pillBar(st.split)}` : ''}
      ${r.result || r.impr || r.change || r.error || Object.values(ev).some(Boolean) ? `<dl class="kv hmkv">${r.result ? `<dt>Resultado</dt><dd class="nolang">${esc(r.result)}</dd>` : ''}${Object.values(ev).some(Boolean) ? `<dt>Cada pilar</dt><dd>${Season.PILLARS.filter(([p]) => ev[p]).map(([p, n]) => `<span>${n}</span> <b>${(EVAL.find(e => e[0] === ev[p]) || ['', ev[p]])[1]}</b>`).join(' · ')}</dd>` : ''}${r.error ? `<dt>Error más repetido</dt><dd class="nolang">${esc(r.error)}</dd>` : ''}${r.impr ? `<dt>Impresiones</dt><dd class="nolang">${esc(r.impr)}</dd>` : ''}${r.change ? `<dt>Qué cambiarías</dt><dd class="nolang">${esc(r.change)}</dd>` : ''}</dl>` : ''}
      ${!r.error && fo.err && r.id === (Season.regOf(d.plan, Season.today()) || {}).id ? `<p class="note">Error más repetido ahora: ${esc(fo.err.label)}.</p>` : ''}</div>`;
  }

  /* ---------- Torneos ---------- */
  function torneosHTML(d) {
    const seasons = [...new Set([Season.seasonOf(Season.today()), ...d.tours.filter(t => Season.isDay(t.date)).map(t => Season.seasonOf(t.date))])].sort((a, b) => b - a);
    if (!seasons.includes(+H.season) && H.season !== 'all') H.season = seasons[0];
    const list = d.tours.filter(t => H.season === 'all' || (Season.isDay(t.date) ? Season.seasonOf(t.date) === +H.season : +H.season === Season.seasonOf(Season.today())));
    const S = Season.seasonSum(list, d.plan);
    const counted = new Set(S.groups.flatMap(g => g.ids));
    const kpi = (v, l, sub, cls = '') => `<div class="hmkpi ${cls}"><b>${v}</b><span>${l}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const rows = S.list.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return `<div class="hmweeknav"><label class="field hmregsel">Temporada<select id="hmSeason">${seasons.map(s => `<option value="${s}"${+H.season === s ? ' selected' : ''}>${s - 1}-${String(s).slice(2)}</option>`).join('')}<option value="all"${H.season === 'all' ? ' selected' : ''}>Todas</option></select></label><span class="note">De septiembre a agosto (Worlds).</span><span style="flex:1"></span><button class="btn sm primary" data-hm="tnew">+ <span>Añadir torneo</span></button></div>
    <div class="hmkpis">${kpi(S.cp, 'CP de la temporada', 'con el Best Finish Limit', S.cp ? 'good' : '')}${kpi(S.n, 'Torneos', `${S.off} oficiales`)}${kpi(eur(S.won), 'Premios')}${kpi(eur(S.cost), 'Gastos', 'entradas y viajes')}${kpi(eur(S.net), 'Beneficio', '', S.net > 0 ? 'good' : S.net < 0 ? 'bad' : '')}${kpi(S.invite ? 'Sí' : 'No', 'Invitación directa a Worlds', 'ganar un Regional o top 4 en un International', S.invite ? 'good' : '')}</div>
    <div class="card hmcard"><h2>Tus torneos</h2>${rows.length ? `<div class="hmtours"><div class="hmtour hmthead"><span>Fecha</span><span>Evento</span><span>Puesto</span><span>CP</span><span>Premio</span><span>Gastos</span><span>Neto</span><span></span></div>
      ${rows.map(t => `<div class="hmtour${t.off ? ' off' : ''}"><span>${Season.isDay(t.date) ? esc(fd(t.date, { day: 'numeric', month: 'short', year: '2-digit' })) : '—'}</span><span class="hmtname"><b class="nolang">${esc(t.name)}</b><small><span>${esc((Season.TIER[t.tier] || {}).n || '')}</span> · <span>${t.mode === 'online' ? 'Online' : 'Presencial'}</span>${t.players ? ` · <span>${esc(t.players)} jugadores</span>` : ''}</small></span>
        <span>${t.place ? `<b>${esc(t.place)}</b>` : '—'}</span><span title="${t.kick ? 'Menos jugadores que el cupo mínimo de ese puesto: sin CP' : counted.has(t.id) ? 'Cuenta para tu CP (Best Finish Limit)' : t.off ? 'No cuenta: tienes mejores resultados en su grupo' : 'No da CP'}">${t.cp ? `${counted.has(t.id) ? '★ ' : ''}${t.cp}` : t.kick ? '0 ⚠' : '—'}</span><span>${t.won ? eur(t.won) : '—'}</span><span>${t.cost ? eur(t.cost) : '—'}</span><span class="${t.net > 0 ? 'hmgood' : t.net < 0 ? 'hmbad' : ''}">${eur(t.net)}</span>
        <span class="hmsact">${tGames(t)}<button class="btn sm ibtn" data-hm="tedit" data-id="${esc(t.id)}" title="Editar">✎</button><button class="btn sm ibtn danger" data-hm="tdel" data-id="${esc(t.id)}" title="Borrar">✕</button></span></div>`).join('')}</div>` : '<p class="note">Apunta cada torneo (oficial o Limitless, online o presencial): el CP y el premio oficial salen solos de la tabla de la temporada.</p>'}</div>
    <div class="hmgrid hmtemp"><div class="card hmcard"><h2>CP por grupo</h2><table class="hmtypes"><thead><tr><th>Grupo</th><th>Cuentan</th><th>Jugados</th><th>CP</th></tr></thead><tbody>${S.groups.map(g => `<tr><td>${g.n}</td><td>${g.counted} / ${g.bfl}</td><td>${g.played}</td><td><b>${g.cp}</b></td></tr>`).join('')}</tbody></table>
      <p class="note">Solo cuentan tus mejores resultados de cada grupo (Best Finish Limit). Regional e International comparten los 5. Limitless no da CP.</p></div>
      <div class="card hmcard"><h2>Clasificación a Worlds</h2><dl class="kv hmkv"><dt>Europa</dt><dd>80 plazas</dd><dt>Norteamérica</dt><dd>80 plazas</dd><dt>Latinoamérica</dt><dd>60 plazas</dd><dt>Oceanía</dt><dd>20 plazas</dd><dt>Oriente Medio y Sudáfrica</dt><dd>5 plazas</dd></dl>
        <p class="note">Por ranking de CP a final de temporada (Masters), además de la invitación directa. Tabla de CP y premios de la temporada 2026: si cambia, pon tú el CP en el torneo.</p></div></div>`;
  }

  /** Partidas tuyas del día de un torneo (botón al Dashboard con ese día). */
  function tGames(t) {
    if (!Season.isDay(t.date)) return '';
    const g = mine().filter(m => Season.dayOf(m.endedAt) === t.date);
    if (!g.length) return '';
    const w = g.filter(m => m.result === 'win').length;
    return `<button class="btn sm" data-hm="dgames" data-day="${esc(t.date)}" title="Tus partidas de ese día en el Dashboard">${w}-${g.length - w}</button>`;
  }
  /** Al Dashboard (Partidas) con las de una sesión o las de un día. */
  function goGames(o) {
    Object.assign(F, { result: 'all', lead: '', back: '', rival: '', oppLead: '', minElo: 0, mark: '', why: '', team: '' });
    if (o.sid) Object.assign(F, { sid: o.sid, scope: 'session', days: 0, from: 0, to: 0 });
    else { const a = Season.parseDay(o.day).getTime(); Object.assign(F, { sid: '', scope: 'all', days: -1, from: a, to: a + 86399999 }); }
    if (typeof Dash !== 'undefined') Dash.state.tab = 'games';
    show('dash');
  }


  /* ---------- pintar ---------- */
  let painting = false, again = false;
  async function paint() {
    if (W2 && VIEW !== 'inicio') return;
    if (painting) { again = true; return; }
    painting = true;
    try {
      const el = $('#v-inicio'), d = await data();
      if (H.sync == null) { const dd = await api.dataDir().catch(() => null); H.sync = !!(dd && !dd.fixed && dd.onedrive && !String(dd.dir || '').toLowerCase().startsWith(String(dd.onedrive).toLowerCase())); }
      const body = H.tab === 'cal' ? calHTML(d) : H.tab === 'temp' ? tempHTML(d) : H.tab === 'torneos' ? torneosHTML(d) : hoyHTML(d);
      const top = el.scrollTop;
      el.innerHTML = `<div class="hm"><div class="head"><div><h1>In<span>icio</span></h1><p class="note" style="margin-top:4px">${esc(cap(fd(Season.today(), { weekday: 'long', day: 'numeric', month: 'long' })))}${SET.reg && SET.reg.name ? ` · <span class="nolang">${esc(SET.reg.name)}</span>` : ''}</p></div>${tabs()}</div>${body}</div>`;
      el.scrollTop = top;
    } catch (e) {
      console.error('[inicio]', e && e.stack ? e.stack : e);
      $('#v-inicio').innerHTML = `<div class="card"><p class="note">No se ha podido pintar Inicio.</p><button class="btn" data-go="jugar">Ir a Jugar</button></div>`;
    } finally {
      painting = false;
      if (again) { again = false; paint(); }
    }
    bar();
  }
  /** Repintar si no estás escribiendo en Inicio. */
  function refresh() {
    bar();
    if (VIEW !== 'inicio') return;
    const a = document.activeElement;
    if (a && $('#v-inicio').contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
    paint();
  }

  /* ---------- acciones ---------- */
  async function startSession(id, goal) {
    const cur = SET.sessionId && (await Sess.current());
    if (cur && cur.id !== id && cur.state === 'open') {
      if (!confirm(`Tienes abierta «${cur.name}». ¿Cerrarla y empezar esta? (La puedes cerrar con sus datos después en el Calendario.)`)) return;
      await Sess.finish(cur.id, {});
    }
    if (goal != null) await Sess.update(id, { goal: String(goal).trim().slice(0, 300) });
    await Sess.open(id);
    H.goal = '';
    show('jugar');
  }
  async function onClick(e) {
    const tb = e.target.closest('[data-hmtab]');
    if (tb) { H.tab = tb.dataset.hmtab; ls('msHomeTab', H.tab); H.msg = ''; paint(); return; }
    const mo = e.target.closest('[data-hmmonth]');
    if (mo) {
      const n = +mo.dataset.hmmonth;
      if (!n) { H.month = Season.today().slice(0, 7); H.day = Season.today(); } else { const [y, m] = H.month.split('-').map(Number); H.month = Season.dayOf(new Date(y, m - 1 + n, 1)).slice(0, 7); }
      H.msg = ''; paint(); return;
    }
    const dy = e.target.closest('[data-hmday]');
    if (dy) { H.day = dy.dataset.hmday; if (H.day.slice(0, 7) !== H.month) H.month = H.day.slice(0, 7); H.msg = ''; paint(); return; }
    const b = e.target.closest('[data-hm]');
    if (!b) return;
    const k = b.dataset.hm, id = b.dataset.id;
    if (k === 'start') await startSession(id);
    else if (k === 'begin') {
      // La prevista de hoy (si la hay) o una nueva, con el objetivo que hayas escrito.
      const t = Season.today(), plan = (await Sess.list()).find(s => s.state === 'plan' && s.day === t);
      const goal = ($('#hmGoal') || {}).value || H.goal;
      if (plan) await startSession(plan.id, goal);
      else { const s = await Sess.create({ goal, day: t, planned: false }, false); await startSession(s.id); }
    } else if (k === 'planday') {
      const goal = (($('#hmPlanGoal') || {}).value || '').trim();
      await Sess.create({ goal, day: H.day, planMin: 0 }, false);
      H.planGoal = ''; H.msg = 'Sesión prevista.'; paint();
    } else if (k === 'skipold') {
      const past = Season.pendingPast(await Sess.list(), Season.today());
      const all = await Sess.list();
      for (const s of all) if (past.some(x => x.id === s.id)) { s.state = 'skip'; s.up = Date.now(); }
      await Sess.save(all); paint();
    } else if (k === 'close') sessDialog(id, 'close');
    else if (k === 'edit') sessDialog(id, 'edit');
    else if (k === 'del') {
      const s = (await Sess.list()).find(x => x.id === id);
      if (!s || !confirm(`¿Borrar la sesión «${s.name}»? Sus partidas no se borran: quedan sin sesión.`)) return;
      await Sess.remove(id); paint();
    } else if (k === 'toan') { Object.assign(F, { mark: 'analyze', scope: 'all', team: '', sid: '' }); if (typeof Dash !== 'undefined') Dash.state.tab = 'games'; show('dash'); }
    else if (k === 'import') await importExcel();
    else if (k === 'sgames') goGames({ sid: id });
    else if (k === 'dgames') goGames({ day: b.dataset.day });
    else if (k === 'onedrive') {
      if (!confirm('¿Usar OneDrive para tus datos? Se copian allí (sin pisar lo que ya haya) y la app se reinicia. En tus otros ordenadores, elige también «Usar OneDrive» en Ajustes (o se pondrá solo al abrirla).')) return;
      const r = await api.setDataDir('onedrive');
      if (!r.ok && r.why) { H.imp = [r.why]; paint(); }
    } else if (k === 'regnew') regDialog('');
    else if (k === 'regedit') regDialog(id);
    else if (k === 'regdel') {
      const p = normPlan(await DB.get('plan')), r = p.regs.find(x => x.id === id);
      if (!r || !confirm(`¿Borrar la regulación «${r.name}»? Tus sesiones no se borran.`)) return;
      await savePlan(x => { x.regs = x.regs.filter(y => y.id !== id); }); paint();
    } else if (k === 'tnew') tourDialog('');
    else if (k === 'tedit') tourDialog(id);
    else if (k === 'tdel') {
      const all = (await DB.get('misTorneos')) || [], t = all.find(x => x.id === id);
      if (!t || !confirm(`¿Borrar el torneo «${t.name}»?`)) return;
      await DB.set('misTorneos', all.filter(x => x.id !== id)); paint();
    }
  }
  const wTimer = {}; // uno por campo: escribir en otro no cancela lo pendiente
  function onInput(e) {
    const t = e.target;
    if (t.id === 'hmGoal') H.goal = t.value;
    else if (t.id === 'hmPlanGoal') H.planGoal = t.value;
    else if (t.id === 'hmGoalNow') {
      // El objetivo de la sesión abierta se guarda mientras escribes.
      clearTimeout(wTimer.goal);
      const v = t.value;
      wTimer.goal = setTimeout(() => { if (SET.sessionId) Sess.update(SET.sessionId, { goal: v.trim().slice(0, 300) }).then(bar); }, 600);
    } else if (t.dataset.hmw) {
      const k = Season.weekOf(Season.today()), f = t.dataset.hmw, v = t.value;
      clearTimeout(wTimer[f]);
      wTimer[f] = setTimeout(async () => {
        await savePlan(p => { p.weeks[k] = { ...(p.weeks[k] || {}), [f]: String(v).slice(0, 2000) }; });
        const m = $('#hmWSaved'); if (m) m.textContent = 'Guardado';
      }, 500);
    } else if (t.dataset.hmc) {
      const f = t.dataset.hmc, v = +t.value;
      clearTimeout(wTimer[f]);
      wTimer[f] = setTimeout(async () => {
        if (!(v > 0)) return;
        await savePlan(p => {
          const c = { ...Season.CFG, ...p.cfg };
          if (/^ratio[01]$/.test(f)) { const a = (c.ratio || Season.CFG.ratio).slice(); a[+f.slice(-1)] = v; c.ratio = a[0] <= a[1] ? a : [a[1], a[0]]; } else c[f] = v;
          p.cfg = c;
        });
        const m = $('#hmCSaved'); if (m) m.textContent = 'Guardado';
      }, 600);
    }
  }
  function onChange(e) {
    const t = e.target;
    if (t.id === 'hmRegSel') { H.reg = t.value; paint(); }
    else if (t.id === 'hmSeason') { H.season = t.value === 'all' ? 'all' : +t.value; paint(); }
  }
  function onKey(e) {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'hmGoal') { e.preventDefault(); onClick({ target: $('[data-hm="begin"]') }); }
    if (e.target.id === 'hmPlanGoal') { e.preventDefault(); onClick({ target: $('[data-hm="planday"]') }); }
  }

  /* ---------- ventanas: sesión, regulación, torneo ---------- */
  const modal = html => { $('#modalBox').innerHTML = html; $('#modal').classList.remove('hide'); $('#mClose').onclick = closeModal; };
  /**
   * Cerrar o ver una sesión. Al cerrarla: los minutos ya vienen del cronómetro (se pueden corregir), si cumpliste el
   * objetivo, lo que hiciste, lo que te llevas y qué partidas quieres analizar. Una prevista: su día y objetivo.
   */
  async function sessDialog(id, mode) {
    await Sess.flush();
    const d = await data(), s = d.sess.find(x => x.id === id);
    if (!s) return;
    const st = stateOf(s, d), real = mode === 'close' || st === 'done';
    const r = Season.realMin(s, M, d.openId);
    const min = s.min && Season.sum(s.min) ? { ...Season.zero(), ...s.min } : (() => { const o = Season.zero(); for (const k of Season.PK) o[k] = Math.round(r[k] || 0); return o; })();
    const games = mine().filter(m => m.session === s.id).sort((a, b) => b.endedAt - a.endedAt);
    modal(`<div class="head"><div><h1 style="font-size:22px">${mode === 'close' ? 'Cerrar sesión' : 'Sesión'}</h1><p class="note"><span class="nolang">${esc(s.name)}</span> · <span>${ST[st] || ''}</span></p></div><button class="btn" id="mClose">Cerrar</button></div>
      <div class="hmform">
        <label class="field">Objetivo<input type="text" id="sfGoal" maxlength="300" value="${esc(s.goal || '')}" placeholder="Tu error más repetido o lo que toque probar"></label>
        ${real ? `<div class="hmline"><span class="field">¿Lo has cumplido?<span class="seg" id="sfOk"><button data-ok="1" aria-pressed="${s.ok === true}">✔ Sí</button><button data-ok="0" aria-pressed="${s.ok === false}">✘ No</button></span></span>
          <span class="field hmgrow"><span>Tiempo <b id="sfTotal"></b></span><span class="hmmins">${Season.PILLARS.map(([p, n]) => `<label class="hmmin" data-p="${p}"><span>${n}</span><input type="number" min="0" max="900" step="1" data-sfmin="${p}" value="${esc(min[p])}"><small>min</small></label>`).join('')}</span></span></div>
        <label class="field">Lo que has hecho<textarea id="sfNotes" rows="3" maxlength="4000">${esc([s.notes, s.other].filter(Boolean).join('\n'))}</textarea></label>
        <label class="field">Lo que te llevas a la siguiente<textarea id="sfLesson" rows="2" maxlength="1000">${esc(s.lesson || '')}</textarea></label>
        ${games.length ? `<div class="field"><span>Partidas para analizar</span><div class="hmgames">${games.slice(0, 24).map(m => `<label class="hmgame ${m.result || ''}"><input type="checkbox" data-sfan="${esc(m.id)}"${m.mark && m.mark.a === true ? ' checked' : ''}${m.mark && m.mark.a === 'done' ? ' disabled' : ''}>${spr((m[m.opp] || { leads: [] }).leads[0] || 'Pikachu', 'xs')}<span class="nolang">${esc((m[m.opp] || {}).name || '?')}</span>${m.mark && m.mark.a === 'done' ? '<small>analizada</small>' : ''}</label>`).join('')}</div></div>` : ''}
        ${st === 'done' ? `<label class="field">Día<input type="date" id="sfRDay" value="${esc(s.realDay || Season.dayCount(s, d.openId) || '')}"></label>` : ''}`
    : `<label class="field">Día<input type="date" id="sfDay" value="${esc(s.day || '')}"></label>`}
        <div class="row-btns"><span class="note" id="sfMsg"></span><span style="flex:1"></span>${st === 'done' || st === 'skip' ? '<button class="btn" data-sf="reopen" title="Seguir con ella: el cronómetro vuelve a contar">Volver a abrirla</button>' : ''}<button class="btn primary" data-sf="save">${mode === 'close' ? 'Guardar y cerrar' : 'Guardar'}</button></div>
      </div>`);
    const box = $('#modalBox');
    let ok = s.ok;
    const total = () => { const el = $('#sfTotal'); if (el) el.textContent = Season.dur(Season.PK.reduce((a, p) => a + (+(box.querySelector(`[data-sfmin="${p}"]`) || {}).value || 0), 0)); };
    total();
    box.oninput = total; box.onchange = null;
    box.onclick = async e => {
      const o = e.target.closest('[data-ok]');
      if (o) { ok = ok === (o.dataset.ok === '1') ? null : o.dataset.ok === '1'; $$('#sfOk button').forEach(x => x.setAttribute('aria-pressed', String(ok === (x.dataset.ok === '1')))); return; }
      const b = e.target.closest('[data-sf]');
      if (!b) return;
      if (b.dataset.sf === 'reopen') { closeModal(); await startSession(id); return; }
      const patch = { goal: $('#sfGoal').value.trim().slice(0, 300) };
      if (real) {
        const m = {}; for (const p of Season.PK) m[p] = Math.max(0, Math.round(+box.querySelector(`[data-sfmin="${p}"]`).value || 0));
        Object.assign(patch, { realDay: $('#sfRDay') && Season.isDay($('#sfRDay').value) ? $('#sfRDay').value : s.realDay || Season.today(), realMin: Season.sum(m), min: Season.sum(m) ? m : null, ok, notes: $('#sfNotes').value.slice(0, 4000), other: '', lesson: $('#sfLesson').value.trim().slice(0, 1000) });
        for (const c of box.querySelectorAll('[data-sfan]:not([disabled])')) {
          const g = M.find(x => x.id === c.dataset.sfan); if (!g) continue;
          const was = !!(g.mark && g.mark.a === true);
          if (was !== c.checked) { const mk = { r: '', ...(g.mark || {}), a: c.checked }; g.mark = mk.r || mk.a ? mk : null; await api.setMark(g.id, g.mark); }
        }
      } else if ($('#sfDay')) patch.day = Season.isDay($('#sfDay').value) ? $('#sfDay').value : s.day;
      b.disabled = true;
      if (mode === 'close') await Sess.finish(id, patch); else await Sess.update(id, patch);
      closeModal(); paint();
    };
  }
  async function regDialog(id) {
    const p = normPlan(await DB.get('plan')), r = p.regs.find(x => x.id === id) || { id: '', name: SET.reg && SET.reg.name ? SET.reg.name.replace(/^Reg\s+/i, '') : '', start: Season.weekOf(Season.today()), end: '', goal: '', ok: null, result: '', eval: {}, error: '', impr: '', change: '' };
    const ev = r.eval || {};
    modal(`<div class="head"><div><h1 style="font-size:22px">${id ? 'Regulación' : 'Nueva regulación'}</h1><p class="note">Las semanas entre sus fechas cuentan para ella.</p></div><button class="btn" id="mClose">Cerrar</button></div>
      <div class="hmform">
        <div class="hmline"><label class="field hmgrow">Nombre<input type="text" id="rfName" maxlength="60" value="${esc(r.name)}" placeholder="M-C"></label><label class="field">Inicio<input type="date" id="rfStart" value="${esc(r.start)}"></label><label class="field">Fin<input type="date" id="rfEnd" value="${esc(r.end || '')}"></label></div>
        <label class="field">Objetivo<textarea id="rfGoal" rows="2" maxlength="500">${esc(r.goal || '')}</textarea></label>
        <h3 class="hmfh">Al terminar</h3>
        <div class="hmline"><span class="field">¿Objetivo cumplido?<span class="seg" id="rfOk"><button data-ok="1" aria-pressed="${r.ok === true}">✔ Sí</button><button data-ok="0" aria-pressed="${r.ok === false}">✘ No</button></span></span><label class="field hmgrow">Resultado final<input type="text" id="rfResult" maxlength="300" value="${esc(r.result || '')}" placeholder="ELO, rango, torneo…"></label></div>
        <div class="hmline">${Season.PILLARS.map(([pk, n]) => `<label class="field">${n}<select data-rfev="${pk}">${EVAL.map(([v, l]) => `<option value="${v}"${(ev[pk] || '') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`).join('')}</div>
        <label class="field">Error más repetido<input type="text" id="rfError" maxlength="300" value="${esc(r.error || '')}"></label>
        <label class="field">Impresiones finales<textarea id="rfImpr" rows="2" maxlength="2000">${esc(r.impr || '')}</textarea></label>
        <label class="field">Qué cambiarías la próxima regulación<textarea id="rfChange" rows="2" maxlength="2000">${esc(r.change || '')}</textarea></label>
        <div class="row-btns"><span class="note" id="rfMsg"></span><span style="flex:1"></span><button class="btn primary" data-rf="save">Guardar</button></div></div>`);
    const box = $('#modalBox');
    let ok = r.ok;
    box.oninput = box.onchange = null;
    box.onclick = async e => {
      const o = e.target.closest('[data-ok]');
      if (o) { ok = ok === (o.dataset.ok === '1') ? null : o.dataset.ok === '1'; $$('#rfOk button').forEach(x => x.setAttribute('aria-pressed', String(ok === (x.dataset.ok === '1')))); return; }
      if (!e.target.closest('[data-rf]')) return;
      const name = $('#rfName').value.trim(), start = $('#rfStart').value, end = $('#rfEnd').value;
      if (!name || !Season.isDay(start)) { $('#rfMsg').textContent = 'Ponle un nombre y la fecha de inicio.'; $('#rfMsg').className = 'errmsg'; return; }
      if (Season.isDay(end) && end < start) { $('#rfMsg').textContent = 'El fin va después del inicio.'; $('#rfMsg').className = 'errmsg'; return; }
      const ev2 = {}; for (const s of box.querySelectorAll('[data-rfev]')) ev2[s.dataset.rfev] = s.value;
      const x = { ...r, id: r.id || `r${Date.now().toString(36)}`, name: name.slice(0, 60), start, end: Season.isDay(end) ? end : '', goal: $('#rfGoal').value.trim().slice(0, 500), ok, result: $('#rfResult').value.trim().slice(0, 300), eval: ev2, error: $('#rfError').value.trim().slice(0, 300), impr: $('#rfImpr').value.trim().slice(0, 2000), change: $('#rfChange').value.trim().slice(0, 2000) };
      await savePlan(pp => { const i = pp.regs.findIndex(y => y.id === x.id); if (i >= 0) pp.regs[i] = x; else pp.regs.push(x); });
      H.reg = x.id; closeModal(); paint();
    };
  }
  async function tourDialog(id) {
    const all = (await DB.get('misTorneos')) || [], d = await data();
    const t = all.find(x => x.id === id) || { id: '', name: '', date: Season.today(), tier: 'limitless', mode: 'online', players: '', place: '', cp: null, entry: 0, extra: 0, costs: {}, notes: '', teamId: SET.teamId || '' };
    const c = t.costs || {};
    const nv = v => (v === '' || v == null ? '' : esc(v));
    modal(`<div class="head"><div><h1 style="font-size:22px">${id ? 'Torneo' : 'Añadir torneo'}</h1><p class="note">Todo en euros. El CP y el premio oficial salen de la tabla de la temporada.</p></div><button class="btn" id="mClose">Cerrar</button></div>
      <div class="hmform">
        <div class="hmline"><label class="field hmgrow">Evento<input type="text" id="tfName" maxlength="100" value="${esc(t.name)}" placeholder="Ej.: Regional de Sevilla"></label><label class="field">Fecha<input type="date" id="tfDate" value="${esc(t.date || '')}"></label></div>
        <div class="hmline"><label class="field hmgrow">Tier<select id="tfTier">${Season.TIERS.map(x => `<option value="${x.k}"${t.tier === x.k ? ' selected' : ''}>${x.n}</option>`).join('')}</select></label><label class="field">Modalidad<select id="tfMode"><option value="online"${t.mode === 'online' ? ' selected' : ''}>Online</option><option value="inperson"${t.mode !== 'online' ? ' selected' : ''}>Presencial</option></select></label></div>
        <div class="hmline"><label class="field">Jugadores<input type="number" id="tfPlayers" min="0" max="100000" value="${nv(t.players)}"></label><label class="field">Puesto<input type="number" id="tfPlace" min="1" max="100000" value="${nv(t.place)}"></label><label class="field">CP <span class="note" id="tfCpAuto"></span><input type="number" id="tfCp" min="0" max="2000" value="${t.cp != null && t.cp !== '' ? esc(t.cp) : ''}" placeholder="De la tabla"></label><label class="field hmgrow">Equipo<select id="tfTeam">${teamOpts(d, t.teamId)}</select></label></div>
        <h3 class="hmfh">Dinero</h3>
        <div class="hmline"><label class="field">Entrada<input type="number" id="tfEntry" min="0" step="0.01" value="${nv(t.entry)}"></label><label class="field">Premio extra <span class="note">(el del organizador)</span><input type="number" id="tfExtra" min="0" step="0.01" value="${nv(t.extra)}"></label><span class="note" id="tfPrize"></span></div>
        <div class="hmline">${[['travel', 'Transporte'], ['lodging', 'Alojamiento'], ['food', 'Comida y gastos'], ['other', 'Otros gastos']].map(([k, n]) => `<label class="field">${n}<input type="number" min="0" step="0.01" data-tfc="${k}" value="${nv(c[k])}"></label>`).join('')}</div>
        <label class="field">Notas<textarea id="tfNotes" rows="2" maxlength="2000">${esc(t.notes || '')}</textarea></label>
        <div class="row-btns"><span class="note" id="tfMsg"></span><span style="flex:1"></span><button class="btn primary" data-tf="save">Guardar</button></div></div>`);
    const box = $('#modalBox');
    const auto = () => {
      const r = Season.cpFor($('#tfTier').value, $('#tfPlace').value, $('#tfPlayers').value), rate = Season.cfgOf(d.plan).rate || 1;
      $('#tfCpAuto').textContent = r.kick ? '(sin CP: pocos jugadores)' : Season.TIER[$('#tfTier').value].off ? `(tabla: ${r.cp})` : '(no da CP)';
      $('#tfPrize').textContent = r.usd ? `Premio oficial: ${eur(r.usd / rate)} (${r.usd} $)` : '';
    };
    auto();
    box.oninput = box.onchange = auto;
    box.onclick = async e => {
      if (!e.target.closest('[data-tf]')) return;
      const name = $('#tfName').value.trim();
      if (!name) { $('#tfMsg').textContent = 'Ponle un nombre.'; $('#tfMsg').className = 'errmsg'; return; }
      const n = v => (v === '' ? '' : Math.max(0, +v || 0));
      const costs = {}; for (const i of box.querySelectorAll('[data-tfc]')) costs[i.dataset.tfc] = Math.max(0, +i.value || 0);
      const x = { ...t, id: t.id || `t${Date.now().toString(36)}`, name: name.slice(0, 100), date: Season.isDay($('#tfDate').value) ? $('#tfDate').value : '', tier: $('#tfTier').value, mode: $('#tfMode').value, players: n($('#tfPlayers').value), place: n($('#tfPlace').value), cp: $('#tfCp').value === '' ? null : Math.max(0, +$('#tfCp').value || 0), entry: Math.max(0, +$('#tfEntry').value || 0), extra: Math.max(0, +$('#tfExtra').value || 0), costs, notes: $('#tfNotes').value.slice(0, 2000), teamId: $('#tfTeam').value };
      const list = ((await DB.get('misTorneos')) || []).slice(), i = list.findIndex(y => y.id === x.id);
      if (i >= 0) list[i] = x; else list.push(x);
      await DB.set('misTorneos', list);
      if (x.date) H.season = Season.seasonOf(x.date);
      closeModal(); paint();
    };
  }

  /** Importar tus Excel (plan y torneos): se juntan con lo que ya tengas (lo importado antes se sustituye). */
  async function importExcel() {
    const r = await api.importExcel();
    if (!r || !r.ok) return;
    const out = [];
    for (const f of r.files) {
      if (f.kind === 'error') { out.push(`${f.file}: ${f.why}`); continue; }
      if (f.kind === 'plan') {
        const all = await Sess.list(), ids = new Set(f.sessions.map(s => s.id));
        await Sess.save([...f.sessions, ...all.filter(s => !ids.has(s.id))]);
        await savePlan(p => {
          for (const [k, w] of Object.entries(f.weeks)) p.weeks[k] = { ...(p.weeks[k] || {}), ...w };
          for (const g of f.regs) { const i = p.regs.findIndex(x => x.id === g.id || x.name === g.name); if (i >= 0) p.regs[i] = { ...p.regs[i], ...g, id: p.regs[i].id }; else p.regs.push(g); }
          p.cfg = { ...p.cfg, ...f.cfg };
        });
        out.push(`${f.file}: ${f.sessions.length} sesiones, ${Object.keys(f.weeks).length} semanas y ${f.regs.length} regulaciones.`);
      } else if (f.kind === 'tours') {
        const all = ((await DB.get('misTorneos')) || []).slice(), ids = new Set(f.tours.map(t => t.id));
        await DB.set('misTorneos', [...all.filter(t => !ids.has(t.id)), ...f.tours]);
        if (f.cfg.rate) await savePlan(p => { p.cfg = { ...p.cfg, rate: f.cfg.rate }; });
        out.push(`${f.file}: ${f.tours.length} torneos.`);
      }
    }
    H.imp = out;
    load(); paint();
  }


  /* ---------- barra de abajo: el cronómetro de la sesión abierta ---------- */
  let barSid = '';
  async function bar() {
    const el = $('#sessBar');
    if (!el || W2) return;
    const s = SET.sessionId ? (await Sess.list()).find(x => x.id === SET.sessionId) : null;
    const on = !!(s && (!s.state || s.state === 'open'));
    document.body.classList.toggle('sesson', on);
    if (!on) { el.classList.add('hide'); el.innerHTML = ''; barSid = ''; return; }
    el.classList.remove('hide');
    barSid = s.id;
    const r = Season.realMin({ ...s, track: Sess.trackOf(s) }, M, s.id);
    const idle = Sess.wasIdle();
    el.innerHTML = `<span class="sbtime" title="Tiempo de la sesión">⏱ <b id="sbTimer">${Season.dur(r.total)}</b></span>${actBtns(s)}
      <span class="sbgoal">${idle ? '<span class="hmwarn">Pausado: 20 minutos sin tocar el ordenador.</span>' : s.goal ? `<small>Objetivo</small> <span class="nolang">${esc(s.goal)}</span>` : '<small>Sin objetivo</small>'}</span>
      <button class="btn sm" data-sbclose="1">Cerrar sesión</button>`;
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-sbact]');
    if (a && SET.sessionId) { Sess.flush().then(() => { Sess.setAct(a.dataset.sbact); bar(); if (VIEW === 'inicio') $$('#v-inicio [data-sbact]').forEach(x => { const on = x.dataset.sbact === a.dataset.sbact; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); }); }); return; }
    if (e.target.closest('[data-sbclose]') && SET.sessionId) sessDialog(SET.sessionId, 'close');
  });
  /** Desde el cronómetro (cada 15 s): el tiempo en la barra y en Hoy. */
  function tick(s) {
    const t = Sess.trackOf(s), r = Season.realMin({ ...s, track: t }, M, s.id);
    for (const id of ['#hmTimer', '#sbTimer']) { const x = $(id); if (x) x.textContent = Season.dur(r.total); }
    for (const x of $$('[data-sbmin]')) x.textContent = Season.dur(t[x.dataset.sbmin]);
  }

  const el = $('#v-inicio');
  el.addEventListener('click', onClick);
  el.addEventListener('input', onInput);
  el.addEventListener('change', onChange);
  el.addEventListener('keydown', onKey);
  VIEWS.inicio = paint;
  DB.onChange(k => { if (k === 'sesiones' || k === 'plan' || k === 'misTorneos') refresh(); });
  return { render: paint, refresh, tick, bar, sessDialog, state: H };
})();

/** Lo que antes era la pantalla de inicio: ahora es la sección Inicio. */
const Start = { show: () => show('inicio'), hide() {}, refresh: () => Home.refresh(), defName: () => Sess.defName(), state: {} };
