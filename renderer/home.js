'use strict';
/*
 * Macar Showdown · Inicio: tu plan de temporada (la primera sección del menú; la app se abre aquí).
 * Pestañas:
 *   Hoy        · tu sesión (en curso, la próxima prevista o empezar una ya), cómo va la semana y tu foco
 *                (lo último que te has llevado, el error que más repites y lo que tienes por analizar).
 *   Semana     · lo que quieres hacer esa semana (objetivo de horas, foco, plan y nota) y sus sesiones.
 *   Calendario · el mes con tus sesiones (previstas, hechas, saltadas o no previstas), partidas y torneos.
 *   Temporada  · cada regulación con sus números y tu valoración, y las reglas del plan.
 *   Torneos    · tus torneos con CP (Best Finish Limit), premios y gastos.
 * El cronómetro de la sesión abierta está en el menú lateral (#sessTimer): tú eliges qué estás haciendo (TB / Estudio,
 * Jugar volumen, Jugar serio o Análisis). Sin horas fijas: el objetivo de horas de cada semana es opcional; lo que
 * cuenta es el reparto (tipos de sesión y estudio de las últimas 3 semanas). Los cálculos están en season.js.
 */
/* global $, $$, esc, spr, api, DB, P, M, SET, F, Sess, Season, Stats, Dash, VIEWS, VIEW, show, load, closeModal, I18N, W2 */

const Home = (() => {
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* nada */ } return null; };
  const TABS = [['hoy', 'Hoy'], ['semana', 'Semana'], ['cal', 'Calendario'], ['temp', 'Temporada'], ['torneos', 'Torneos']];
  const ICO = {
    hoy: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
    semana: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M7 14h4"/>',
    cal: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M7 14h2M11 14h2M15 14h2M7 17h2M11 17h2"/>',
    temp: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    torneos: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>'
  };
  const t0 = Season.today();
  const H = {
    tab: TABS.some(([k]) => k === ls('msHomeTab')) ? ls('msHomeTab') : 'hoy',
    week: Season.weekOf(t0), month: t0.slice(0, 7), day: t0,
    quick: { type: 'play', goal: '' }, add: { day: t0, type: 'play', dur: 120, goal: '' },
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
  const typeN = k => (Season.TYPE[k] || {}).n || 'Sesión';
  /** Para títulos con texto tuyo dentro: se traduce solo lo de la app. */
  const tt = s => (typeof I18N !== 'undefined' ? I18N.tr(s) : s);
  const PIL = Object.fromEntries(Season.PILLARS);
  const ST = { plan: 'Prevista', open: 'En curso', done: 'Hecha', skip: 'Saltada', extra: 'No prevista' };
  const mine = () => M.filter(s => s.me);
  /** Lo que trajo la importación: una línea por archivo (así se traduce cada una). */
  const impMsg = () => H.imp.map(x => `<span class="note">${esc(x)}</span>`).join('');

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
  const stateX = (s, d) => { const st = Season.stateOf(s, d.openId); return st === 'done' && !(s.planMin > 0) ? 'extra' : st; };

  /* ---------- piezas ---------- */
  const tabs = () => `<div class="seg dtabs hmtabs">${TABS.map(([k, l]) => `<button data-hmtab="${k}" aria-pressed="${H.tab === k}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICO[k]}</svg>${l}</button>`).join('')}</div>`;
  /** Barra de los cuatro pilares (minutos). */
  function pillBar(m, scale) {
    const tot = Season.sum(m), max = scale || tot;
    if (!tot) return '<div class="hmpbar empty"></div>';
    return `<div class="hmpbar">${Season.PK.filter(k => m[k] > 0).map(k => `<i class="p-${k}" style="width:${(m[k] / max) * 100}%" title="${PIL[k]}: ${Season.dur(m[k])}"></i>`).join('')}</div>`;
  }
  const legend = () => `<div class="hmleg">${Season.PILLARS.map(([k, n]) => `<span><i class="p-${k}"></i>${n}</span>`).join('')}</div>`;
  const lightDot = (v, plan) => { const l = Season.light(v, plan); return `<span class="hmlight ${l}" title="Verde ${Season.cfgOf(plan).green.join('-')}%"></span>`; };
  const typeOpts = sel => Season.TYPES.map(t => `<option value="${t.k}"${t.k === sel ? ' selected' : ''} title="${esc(t.d)}">${t.n}</option>`).join('');
  const durOpts = (sel, none) => `${none ? `<option value="0"${!+sel ? ' selected' : ''}>Sin prever</option>` : ''}${Season.DURS.map(m => `<option value="${m}"${+sel === m ? ' selected' : ''}>${Season.dur(m)}</option>`).join('')}${sel && !Season.DURS.includes(+sel) && +sel ? `<option value="${+sel}" selected>${Season.dur(sel)}</option>` : ''}`;
  const teamOpts = (d, sel) => `<option value="">El que tengas puesto</option>${d.teams.map(t => `<option value="${esc(t.id)}"${t.id === sel ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}`;

  /** Una sesión en lista (Semana, Calendario, Hoy). */
  function sessRow(s, d) {
    const st = stateX(s, d), r = Season.realMin(s, M, d.openId), day = Season.dayCount(s, d.openId);
    const btns = st === 'plan' ? `<button class="btn sm primary" data-hm="start" data-id="${esc(s.id)}">▶ <span>Empezar</span></button><button class="btn sm" data-hm="skip" data-id="${esc(s.id)}" title="No la hiciste: queda como saltada">Saltada</button>`
      : st === 'open' ? `<button class="btn sm primary" data-hm="close" data-id="${esc(s.id)}">Cerrar sesión</button>` : '';
    const ng = mine().filter(m => m.session === s.id).length;
    const games = ng ? `<button class="btn sm" data-hm="sgames" data-id="${esc(s.id)}" title="Ver sus partidas en el Dashboard">${ng === 1 ? '1 partida' : `${ng} partidas`}</button>` : '';
    return `<div class="hmsess st-${st}">
      <span class="hmsday">${day ? esc(dShort(day)) : '—'}</span>
      <span class="hmstype"><b>${typeN(s.type)}</b><small class="nolang">${esc(s.name)}</small></span>
      <span class="hmsdur">${s.planMin > 0 ? `<span><small>Previsto</small> ${Season.dur(s.planMin)}</span>` : ''}${(st === 'done' || st === 'open' || st === 'extra') && r.total ? `<span><small>Hecho</small> ${Season.dur(r.total)}${r.est ? '<sup title="Estimado por tus partidas">*</sup>' : ''}</span>` : ''}</span>
      <span class="hmsgoal">${s.ok === true ? '<b class="hmok">✔</b>' : s.ok === false ? '<b class="hmko">✘</b>' : ''}${s.goal ? `<span class="nolang">${esc(s.goal)}</span>` : '<span class="note">Sin objetivo</span>'}</span>
      <span class="hmsst"><span class="hmstate st-${st}">${ST[st]}</span></span>
      <span class="hmsact">${games}${btns}<button class="btn sm ibtn" data-hm="edit" data-id="${esc(s.id)}" title="Ver o cambiar la sesión">✎</button><button class="btn sm ibtn danger" data-hm="del" data-id="${esc(s.id)}" title="Borrar la sesión (sus partidas se quedan)">✕</button></span></div>`;
  }

  /* ---------- Hoy ---------- */
  function focusData(d) {
    const ms = mine().sort((a, b) => b.endedAt - a.endedAt);
    const W = Stats.whyCount(ms.filter(s => s.result === 'loss').slice(0, 20));
    const top = Object.entries(W.n).sort((a, b) => b[1] - a[1])[0];
    const err = top && top[1] ? { k: top[0], n: top[1], label: (Stats.WHY.find(w => w.k === top[0]) || {})[EN() ? 'en' : 'es'] || top[0] } : null;
    const les = [
      ...d.sess.filter(s => String(s.lesson || '').trim()).map(s => ({ t: Season.parseDay(Season.dayCount(s, d.openId) || Season.today()).getTime() + 1, text: s.lesson.trim(), from: 's' })),
      ...Stats.whyCount(ms).lessons.map(x => ({ t: x.t, text: x.text, id: x.id, result: x.result, from: 'm' }))
    ].sort((a, b) => b.t - a.t).slice(0, 4);
    const toAn = ms.filter(s => s.mark && s.mark.a === true).length;
    const pred = Stats.predCount(ms.slice(0, 50));
    return { err, les, toAn, pred };
  }
  function hoyHTML(d) {
    const t = Season.today(), wk = Season.week(Season.weekOf(t), d.sess, d.plan, M, d.openId);
    const sd = Season.study(wk.k, d.sess, d.plan, M, d.openId), lp = Season.lastPlay(d.sess, M, d.openId, t);
    const cfg = Season.cfgOf(d.plan), cur = d.sess.find(s => s.id === d.openId), nx = Season.next(d.sess, t), past = Season.pendingPast(d.sess, t);
    const reg = Season.regOf(d.plan, t), fo = focusData(d);
    let sess;
    if (cur) {
      const r = Season.realMin(cur, M, d.openId);
      sess = `<div class="hmnow"><small>Sesión en curso</small><b>${typeN(cur.type)}</b><span class="nolang hmnowname">${esc(cur.name)}</span>
        ${cur.goal ? `<p class="hmgoal"><small>Objetivo</small> <span class="nolang">${esc(cur.goal)}</span></p>` : ''}
        <div class="hmtimer"><span id="hmTimer">${Season.dur(r.total)}</span>${pillBar(r)}</div>
        <div class="field"><span>Ahora estás… <span class="note">(también en el menú de la izquierda)</span></span>${actBtns(cur, true)}</div>
        <div class="row-btns"><button class="btn primary" data-go="jugar">▶ <span>Ir a Jugar</span></button><button class="btn" data-hm="close" data-id="${esc(cur.id)}">Cerrar sesión</button><button class="btn sm" data-hm="edit" data-id="${esc(cur.id)}">✎ <span>Cambiar</span></button></div></div>`;
    } else {
      sess = `${nx ? `<div class="hmnext"><small>${nx.day === t ? 'Hoy tienes prevista' : 'Tu próxima sesión'}</small><b>${typeN(nx.type)}</b><span>${esc(dShort(nx.day))} · ${Season.dur(nx.planMin)}</span>${nx.goal ? `<p class="hmgoal"><small>Objetivo</small> <span class="nolang">${esc(nx.goal)}</span></p>` : '<p class="note">Sin objetivo: ponle uno antes de empezar (tu error más repetido o lo que toque probar).</p>'}
        <div class="row-btns"><button class="btn primary" data-hm="start" data-id="${esc(nx.id)}">▶ <span>Empezar</span></button><button class="btn sm" data-hm="edit" data-id="${esc(nx.id)}">✎ <span>Objetivo</span></button></div></div>` : '<p class="note">No tienes ninguna sesión prevista. Planea tu semana o empieza una ahora.</p>'}
        <div class="hmquick"><h3>Empezar una sesión ahora</h3>
          <div class="hmline"><label class="field">Tipo<select id="hmQType">${typeOpts(H.quick.type)}</select></label>
            <label class="field hmgrow">Objetivo<input id="hmQGoal" type="text" maxlength="300" value="${esc(H.quick.goal)}" placeholder="${fo.err ? esc(`Ej.: menos errores de ${fo.err.label}`) : 'Ej.: jugar 10 partidas con Trick Room y revisar las derrotas'}"></label>
            <button class="btn primary" data-hm="quick">▶ <span>Empezar</span></button></div></div>`;
    }
    const pend = past.length ? `<div class="hmpend"><b>Sin cerrar</b><span class="note">Sesiones previstas de días que ya pasaron: márcalas como hechas o saltadas.</span>${past.slice(0, 4).map(s => sessRow(s, d)).join('')}${past.length > 4 ? `<button class="btn sm" data-hmtab="semana">Ver todas</button>` : ''}</div>` : '';
    const gap = lp.days != null && lp.days > cfg.gap;
    return `<div class="hmgrid hmtoday">
      <div class="card hmcard hmsesscard"><h2>Tu sesión</h2>${sess}${pend}</div>
      <div class="card hmcard"><h2>Esta semana <span class="note">${esc(fd(wk.k, { day: 'numeric', month: 'short' }))} – ${esc(fd(wk.end, { day: 'numeric', month: 'short' }))}</span></h2>
        ${progHTML(wk)}
        <dl class="kv hmkv"><dt>Previsto</dt><dd>${hrs(wk.prevH)}${wk.target && wk.prevH < wk.target ? ' <span class="hmwarn">· menos que tu objetivo</span>' : ''}</dd>
          <dt>Plan cumplido</dt><dd>${pctS(wk.planOk)}</dd>
          <dt>Estudio (3 semanas)</dt><dd>${lightDot(sd.real, d.plan)}${pctS(sd.real)} <span class="note">real · previsto ${pctS(sd.prev)}</span></dd>
          <dt>Días sin jugar</dt><dd class="${gap ? 'hmbad' : ''}">${lp.days == null ? '—' : lp.days}${gap ? ` <span>· más de ${cfg.gap}</span>` : ''}</dd>
          ${wk.focus ? `<dt>Foco</dt><dd>${(Season.FOCUS.find(f => f[0] === wk.focus) || ['', ''])[1]}</dd>` : ''}</dl>
        ${Season.advice(sd.prev != null ? sd.prev : sd.real, d.plan) ? `<p class="hmadv">${Season.advice(sd.prev != null ? sd.prev : sd.real, d.plan)}</p>` : ''}
        ${wk.want ? `<p class="hmwant"><small>Lo que quieres hacer</small> <span class="nolang">${esc(wk.want)}</span></p>` : ''}
        <div class="row-btns"><button class="btn sm primary" data-hmtab="semana">Planear la semana</button><button class="btn sm" data-hmtab="cal">Calendario</button></div></div>
      <div class="card hmcard"><h2>Tu foco</h2>
        <div class="hmfo"><small>El error que más repites</small>${fo.err ? `<b class="hmerr">${esc(fo.err.label)}</b><span class="note">en tus últimas derrotas analizadas</span>` : '<span class="note">Aún no has analizado derrotas: en la replay, pestaña Análisis.</span>'}</div>
        <div class="hmfo"><small>Lo que te has llevado</small>${fo.les.length ? `<ul class="hmles">${fo.les.map(x => `<li${x.id ? ` data-view="${esc(x.id)}" class="link ${x.result || ''}" title="Ver la replay"` : ''}><span class="nolang">${esc(x.text.slice(0, 200))}</span></li>`).join('')}</ul>` : '<span class="note">Cuando cierres una sesión o analices una partida, lo que te llevas sale aquí.</span>'}</div>
        <div class="hmfo"><small>Tu lectura</small>${fo.pred.n ? `<b class="hmpred">${Math.round(fo.pred.pct * 100)}%</b><span class="note">${fo.pred.n === 1 ? 'de aciertos en 1 turno predicho' : `de aciertos en ${fo.pred.n} turnos predichos`}</span><span class="note">(modo predicción de las replays)</span>` : '<span class="note">En una replay, «🎯 Predecir»: la replay se para en cada turno, dices qué harías y qué hará el rival, y lo compruebas.</span>'}</div>
        <div class="hmfo"><small>Por analizar</small>${fo.toAn ? `<button class="btn sm" data-hm="toan">🔍 <span>${fo.toAn === 1 ? '1 partida por analizar' : `${fo.toAn} partidas por analizar`}</span></button>` : '<span class="note">Nada pendiente.</span>'}</div></div>
      ${reg ? `<div class="card hmcard hmregmini"><h2>Regulación</h2><b class="nolang">${esc(reg.name)}</b><span class="note">${esc(fd(reg.start, { day: 'numeric', month: 'short' }))}${reg.end ? ` – ${esc(fd(reg.end, { day: 'numeric', month: 'short' }))}` : ''}</span>${reg.goal ? `<p class="hmgoal"><small>Objetivo</small> <span class="nolang">${esc(reg.goal)}</span></p>` : ''}<div class="row-btns"><button class="btn sm" data-hmtab="temp">Temporada</button></div></div>` : ''}
    </div>
    ${H.sync ? `<p class="note hmsync">Tus partidas y replays solo están en este ordenador. <button class="btn sm" data-hm="onedrive">Usar OneDrive</button> para verlas también en tus otros ordenadores.</p>` : ''}
    <div class="hmfoot">${d.sess.some(s => s.from === 'excel') ? '' : '<button class="btn sm" data-hm="import" title="Trae tus semanas, sesiones, regulaciones y torneos de tus Excel de Road to Worlds">Importar tus Excel…</button>'}<button class="btn sm" data-tourstart="1">Ver el tutorial</button>${impMsg()}</div>`;
  }

  /** Horas hechas de la semana (y su objetivo si le pusiste uno). */
  function progHTML(wk) {
    if (!wk.target) return `<div class="hmbig"><b>${hrs(wk.doneH)}</b><span class="note">${wk.doneN === 1 ? '1 sesión hecha' : `${wk.doneN} sesiones hechas`}</span></div>`;
    return `<div class="hmprog"><div class="hmprogbar"><i class="${wk.doneH >= wk.target ? 'ok' : ''}" style="width:${Math.round(wk.progress * 100)}%"></i></div><span><b>${hrs(wk.doneH)}</b> / ${hrs(wk.target)}</span></div>`;
  }
  const SHORT = { tb: 'TB', play: 'Vol.', serious: 'Serio', an: 'Anál.' };
  /** Los botones del cronómetro (Hoy y el menú lateral). */
  function actBtns(s, big) {
    const t = Sess.trackOf(s), a = Sess.act();
    return `<div class="sbacts${big ? ' big' : ''}">${['tb', 'play', 'serious', 'an'].map(k => `<button class="sbact p-${k}${a === k ? ' on' : ''}" data-sbact="${k}" aria-pressed="${a === k}" title="${PIL[k]}"><span class="sbl">${PIL[k]}</span><span class="sbs">${SHORT[k]}</span><b data-sbmin="${k}">${Season.dur(t[k])}</b></button>`).join('')}<button class="sbact pause${a === 'pause' ? ' on' : ''}" data-sbact="pause" aria-pressed="${a === 'pause'}" title="Para el cronómetro"><span>⏸ Pausa</span></button></div>`;
  }
  /** La semana en 7 columnas: cada sesión con su tipo, objetivo, tiempo (previsto → hecho), si la cumpliste y lo que te llevas. */
  function boardHTML(wk, d) {
    const t = Season.today();
    return `<div class="hmboard">${Array.from({ length: 7 }, (_, i) => Season.addDays(wk.k, i)).map(day => {
      const ss = wk.sessions.filter(s => Season.dayCount(s, d.openId) === day || (Season.stateOf(s, d.openId) === 'plan' && s.day === day));
      const ms = mine().filter(m => Season.dayOf(m.endedAt) === day), w = ms.filter(m => m.result === 'win').length;
      return `<div class="hmbday${day === t ? ' today' : ''}${day < t ? ' past' : ''}"><div class="hmbdh"><b>${esc(fd(day, { weekday: 'short' }))}</b><span>${+day.slice(8)}</span><button class="btn sm ibtn" data-hm="addday" data-day="${day}" title="Planear una sesión este día">+</button></div>
        ${ss.map(s => { const st = stateX(s, d), r = Season.realMin(s, M, d.openId); return `<button class="hmbs st-${st} t-${esc(s.type || 'play')}" data-hm="edit" data-id="${esc(s.id)}" title="Ver o cambiar la sesión"><span class="hmbt">${typeN(s.type)}${s.ok === true ? ' <b class="hmok">✔</b>' : s.ok === false ? ' <b class="hmko">✘</b>' : ''}</span>${s.goal ? `<span class="hmbg nolang">${esc(s.goal)}</span>` : ''}<span class="hmbm">${s.planMin > 0 ? Season.dur(s.planMin) : ''}${(st === 'done' || st === 'open' || st === 'extra') && r.total ? `${s.planMin > 0 ? ' → ' : ''}<b>${Season.dur(r.total)}</b>` : ''} <i>${ST[st]}</i></span>${s.lesson ? `<small class="hmbl">💡 <span class="nolang">${esc(s.lesson)}</span></small>` : ''}</button>`; }).join('')}
        ${ms.length ? `<button class="hmbmx" data-hm="dgames" data-day="${day}" title="Tus partidas de ese día en el Dashboard">${ms.length} · ${w}-${ms.length - w}</button>` : ''}</div>`;
    }).join('')}</div>`;
  }

  /* ---------- Semana ---------- */
  function semanaHTML(d) {
    const k = H.week, wk = Season.week(k, d.sess, d.plan, M, d.openId), sd = Season.study(k, d.sess, d.plan, M, d.openId);
    const cfg = Season.cfgOf(d.plan), cur = Season.weekOf(Season.today()), w = d.plan.weeks[k] || {};
    const days = Array.from({ length: 7 }, (_, i) => Season.addDays(k, i));
    if (!days.includes(H.add.day)) H.add.day = days.includes(Season.today()) ? Season.today() : k;
    const adv = Season.advice(sd.prev != null ? sd.prev : sd.real, d.plan);
    const max = Math.max(1, ...Season.PK.map(p => Math.max(wk.prev[p], wk.done[p])));
    return `<div class="hmweeknav"><button class="btn sm ibtn" data-hmweek="-7" title="Semana anterior">◀</button><b>${esc(fd(k, { day: 'numeric', month: 'short' }))} – ${esc(fd(wk.end, { day: 'numeric', month: 'short', year: 'numeric' }))}</b>${k === cur ? '<span class="pill win">Esta semana</span>' : `<button class="btn sm" data-hmweek="0">Ir a esta semana</button>`}<button class="btn sm ibtn" data-hmweek="7" title="Semana siguiente">▶</button>
      ${Season.regOf(d.plan, k) ? `<span class="note">· <span class="nolang">${esc(Season.regOf(d.plan, k).name)}</span></span>` : ''}</div>
    <div class="hmgrid hmweek">
      <div class="card hmcard"><h2>Lo que quieres hacer</h2>
        <div class="hmline"><label class="field">Objetivo de horas<input type="number" min="0" max="80" step="0.5" data-hmw="target" value="${w.target != null && w.target !== '' ? esc(w.target) : ''}" placeholder="Opcional"></label>
          <label class="field">Foco<select data-hmw="focus">${Season.FOCUS.map(([v, l]) => `<option value="${v}"${(w.focus || '') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
        <label class="field">Tu plan para la semana<textarea data-hmw="want" rows="3" maxlength="2000" placeholder="Ej.: probar el equipo de Trick Room en 3 sesiones, un Bo3 serio el sábado y analizar todas las derrotas">${esc(w.want || '')}</textarea></label>
        <label class="field">Nota de la semana <span class="note">(al acabarla: qué ha ido bien y qué cambiar)</span><textarea data-hmw="note" rows="2" maxlength="2000">${esc(w.note || '')}</textarea></label>
        <p class="note hmsaved" id="hmWSaved"></p></div>
      <div class="card hmcard"><h2>Cómo va</h2>
        ${progHTML(wk)}
        <dl class="kv hmkv"><dt>Previsto</dt><dd class="${!wk.target ? '' : wk.prevH >= wk.target ? 'hmgood' : 'hmbad'}">${hrs(wk.prevH)}</dd><dt>Plan cumplido</dt><dd>${pctS(wk.planOk)}</dd>
          <dt>Estudio previsto</dt><dd>${lightDot(sd.prev, d.plan)}${pctS(sd.prev)}</dd><dt>Estudio real</dt><dd>${lightDot(sd.real, d.plan)}${pctS(sd.real)}</dd><dt>Sesiones hechas</dt><dd>${wk.doneN}</dd></dl>
        ${adv ? `<p class="hmadv">${adv}</p>` : ''}
        <div class="hmpils">${Season.PILLARS.map(([p, n]) => `<div class="hmpil"><span>${n}</span><div class="hmpilbars"><i class="prev p-${p}" style="width:${(wk.prev[p] / max) * 100}%" title="Previsto: ${Season.dur(wk.prev[p])}"></i><i class="done p-${p}" style="width:${(wk.done[p] / max) * 100}%" title="Hecho: ${Season.dur(wk.done[p])}"></i></div><b>${Season.dur(wk.done[p])}</b><small>/ ${Season.dur(wk.prev[p])}</small></div>`).join('')}</div>
        <p class="note">Barra clara: previsto · barra fuerte: hecho. Estudio = TB / Teoría + Análisis (verde ${cfg.green[0]}-${cfg.green[1]}%).</p></div>
      <div class="card hmcard wide"><h2>Sesiones de la semana</h2>
        <div class="hmadd"><label class="field">Día<select id="hmADay">${days.map(x => `<option value="${x}"${x === H.add.day ? ' selected' : ''}>${esc(dShort(x))}</option>`).join('')}</select></label>
          <label class="field">Tipo<select id="hmAType">${typeOpts(H.add.type)}</select></label>
          <label class="field">Duración<select id="hmADur">${durOpts(H.add.dur)}</select></label>
          <label class="field hmgrow">Objetivo<input id="hmAGoal" type="text" maxlength="300" value="${esc(H.add.goal)}" placeholder="Tu error más repetido o lo que toque probar"></label>
          <button class="btn primary" data-hm="add">+ <span>Añadir</span></button></div>
        ${boardHTML(wk, d)}
        <div class="row-btns">${wk.sessions.length ? '' : `<button class="btn sm" data-hm="copyweek" title="Las mismas sesiones previstas que la semana anterior (tipo, día y duración)">Copiar la semana anterior</button>`}<span class="note">${esc(H.msg)}</span></div></div>
    </div>`;
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
      return `<button class="hmday${day.slice(0, 7) !== H.month ? ' out' : ''}${day === today ? ' today' : ''}${day === H.day ? ' sel' : ''}" data-hmday="${day}">
        <span class="hmdn">${+day.slice(8)}</span>
        ${x.s.map(s => `<span class="hmchip st-${stateX(s, d)}" title="${esc(`${tt(typeN(s.type))}${s.goal ? ` · ${s.goal}` : ''}`)}">${typeN(s.type)}</span>`).join('')}
        ${x.t.map(t => `<span class="hmchip tour" title="${esc(t.name)}">🏆 <span class="nolang">${esc(t.name)}</span></span>`).join('')}
        ${x.m.length ? `<span class="hmdm" title="Partidas de ese día">${x.m.length} · ${w}-${l}</span>` : ''}</button>`;
    };
    // Semanas sin nada (ni sesiones ni objetivo puesto): sin números.
    const wkCol = k => { const w = Season.week(k, d.sess, d.plan, M, d.openId); if (!w.sessions.length && !d.plan.weeks[k]) return '<div class="hmwk empty"></div>'; return `<div class="hmwk" title="Hecho / objetivo"><b>${num(w.doneH)}</b><small>/ ${num(w.target)} h</small><div class="hmprogbar"><i class="${w.doneH >= w.target ? 'ok' : ''}" style="width:${Math.round(w.progress * 100)}%"></i></div></div>`; };
    const sel = byDay.get(H.day) || { s: [], m: [], t: [] };
    const sw = sel.m.filter(s => s.result === 'win').length, sl = sel.m.filter(s => s.result === 'loss').length;
    const title = fd(first, { month: 'long', year: 'numeric' });
    return `<div class="hmweeknav"><button class="btn sm ibtn" data-hmmonth="-1" title="Mes anterior">◀</button><b class="hmmonth">${esc(title.charAt(0).toUpperCase() + title.slice(1))}</b><button class="btn sm ibtn" data-hmmonth="1" title="Mes siguiente">▶</button>${H.month !== today.slice(0, 7) ? '<button class="btn sm" data-hmmonth="0">Hoy</button>' : ''}
      <span class="hmcalleg"><span class="hmchip st-done">Hecha</span><span class="hmchip st-extra">No prevista</span><span class="hmchip st-plan">Prevista</span><span class="hmchip st-skip">Saltada</span><span class="hmchip st-open">En curso</span></span></div>
    <div class="hmcal"><div class="hmcalh">${wd.map(x => `<span>${esc(x)}</span>`).join('')}<span>Horas</span></div>
      ${weeks.map(k => `<div class="hmcalw">${Array.from({ length: 7 }, (_, i) => cell(Season.addDays(k, i))).join('')}${wkCol(k)}</div>`).join('')}</div>
    <div class="card hmcard hmdaycard"><div class="hmdayhead"><h2>${esc(fd(H.day, { weekday: 'long', day: 'numeric', month: 'long' }))}</h2><button class="btn sm" data-hm="planday">+ <span>Planear una sesión este día</span></button></div>
      ${sel.s.length ? `<div class="hmlist">${sel.s.map(s => sessRow(s, d)).join('')}</div>` : '<p class="note">Sin sesiones este día.</p>'}
      ${sel.s.filter(s => s.notes || s.lesson).map(s => `<div class="hmdnotes">${s.notes ? `<p><small>${typeN(s.type)} · Lo que hiciste</small> <span class="nolang">${esc(s.notes)}</span></p>` : ''}${s.lesson ? `<p><small>Lo que te llevas</small> <span class="nolang">${esc(s.lesson)}</span></p>` : ''}</div>`).join('')}
      ${sel.t.map(t => `<p class="hmdtour">🏆 <b class="nolang">${esc(t.name)}</b> <span class="note"><span>${esc((Season.TIER[t.tier] || {}).n || '')}</span>${t.place ? ` · <span>puesto ${esc(t.place)}</span>` : ''}</span></p>`).join('')}
      ${sel.m.length ? `<div class="hmdmatches"><small>Partidas</small> <b>${sel.m.length}</b> <span class="note">· ${sw}-${sl}</span> <button class="btn sm" data-hm="dgames" data-day="${esc(H.day)}">Ver en el Dashboard</button><div class="hmdmlist">${sel.m.slice().sort((a, b) => a.endedAt - b.endedAt).slice(0, 30).map(s => `<button class="hmdmx ${s.result || ''}" data-view="${esc(s.id)}" title="Ver la replay">${spr((s[s.opp] || { leads: [] }).leads[0] || 'Pikachu', 'xs')}<span class="nolang">${esc((s[s.opp] || {}).name || '?')}</span></button>`).join('')}</div></div>` : ''}
    </div>`;
  }

  /* ---------- Temporada ---------- */
  function tempHTML(d) {
    const regs = d.plan.regs.slice().sort((a, b) => String(b.start).localeCompare(String(a.start)));
    const cur = Season.regOf(d.plan, Season.today());
    if (!H.reg || (H.reg !== 'all' && !regs.some(r => r.id === H.reg))) H.reg = cur ? cur.id : regs[0] ? regs[0].id : 'all';
    const R = H.reg === 'all' ? allReg(d) : regs.find(r => r.id === H.reg);
    const st = R && Season.reg(R, d.sess, d.plan, M, d.openId);
    const cfg = Season.cfgOf(d.plan), lp = Season.lastPlay(d.sess, M, d.openId), nx = Season.next(d.sess);
    const kpi = (v, l, sub, cls = '') => `<div class="hmkpi ${cls}"><b>${v}</b><span>${l}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const chart = st ? weeksChart(st.weeks, d) : '';
    const fo = focusData(d);
    return `<div class="hmweeknav"><label class="field hmregsel">Ver<select id="hmRegSel">${regs.map(r => `<option value="${esc(r.id)}"${H.reg === r.id ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}<option value="all"${H.reg === 'all' ? ' selected' : ''}>Todo</option></select></label>
      ${R && H.reg !== 'all' ? `<span class="note">${esc(fd(R.start, { day: 'numeric', month: 'short', year: 'numeric' }))}${R.end ? ` – ${esc(fd(R.end, { day: 'numeric', month: 'short', year: 'numeric' }))}` : ''}</span>` : ''}<span style="flex:1"></span><button class="btn sm primary" data-hm="regnew">+ <span>Nueva regulación</span></button></div>
    ${st ? `<div class="hmkpis">${kpi(hrs(st.doneH), 'Horas hechas')}${kpi(st.avg == null ? '—' : hrs(st.avg), 'Media por semana', 'semanas cerradas')}${kpi(`${st.met} / ${st.closed}`, 'Semanas con tu objetivo', 'semanas cerradas')}${kpi(pctS(st.planOk), 'Plan cumplido')}${kpi(pctS(st.study), 'Estudio', 'TB + Análisis', Season.light(st.study, d.plan))}${kpi(lp.days == null ? '—' : lp.days, 'Días sin jugar', '', lp.days > cfg.gap ? 'bad' : '')}${kpi(nx ? esc(dShort(nx.day)) : '—', 'Próxima sesión', nx ? typeN(nx.type) : '')}</div>
      <div class="hmgrid hmtemp"><div class="card hmcard"><h2>Reparto por pilar</h2>${pillBar(st.split)}${legend()}
        <div class="hmpils">${Season.PILLARS.map(([p, n]) => `<div class="hmpil"><span>${n}</span><b>${hrs(st.split[p] / 60)}</b><small>${pctS(Season.sum(st.split) ? st.split[p] / Season.sum(st.split) : null)}</small></div>`).join('')}</div></div>
        <div class="card hmcard"><h2>Horas por semana</h2>${chart}</div></div>` : '<div class="card"><p class="note">Aún no tienes ninguna regulación. Crea una con sus fechas y tu objetivo: las semanas se asignan solas.</p></div>'}
    <div class="card hmcard"><h2>Regulaciones</h2>${regs.length ? regs.map(r => regRow(r, d, fo)).join('') : '<p class="note">Ninguna todavía.</p>'}</div>
    <div class="hmgrid hmtemp">
      <div class="card hmcard"><h2>Reglas del plan</h2>
        <div class="hmrules">
          <label class="field">Máx. días seguidos sin jugar<input type="number" min="1" max="30" step="1" data-hmc="gap" value="${esc(cfg.gap)}"></label>
          <label class="field">Estudio en verde (%)<span class="hmpair"><input type="number" min="0" max="100" data-hmc="green0" value="${esc(cfg.green[0])}"><input type="number" min="0" max="100" data-hmc="green1" value="${esc(cfg.green[1])}"></span></label>
          <label class="field">Estudio en amarillo (%)<span class="hmpair"><input type="number" min="0" max="100" data-hmc="yellow0" value="${esc(cfg.yellow[0])}"><input type="number" min="0" max="100" data-hmc="yellow1" value="${esc(cfg.yellow[1])}"></span></label>
          <label class="field">Cambio de moneda (1 € = X $)<input type="number" min="0.1" max="5" step="0.01" data-hmc="rate" value="${esc(cfg.rate)}"></label></div>
        <p class="note">Sin horas fijas: si quieres, pon un objetivo de horas en cada semana. Estudio = TB / Teoría + Análisis de las últimas 3 semanas. Referencia: los maestros de ajedrez dedican cerca del 40% al estudio individual.</p>
        <p class="note hmsaved" id="hmCSaved"></p></div>
      <div class="card hmcard"><h2>Tipos de sesión</h2><table class="hmtypes"><thead><tr><th>Tipo</th>${Season.PILLARS.map(([, n]) => `<th>${n}</th>`).join('')}</tr></thead>
        <tbody>${Season.TYPES.map(t => `<tr title="${esc(t.d)}"><td>${t.n}</td>${Season.PK.map(p => { const m = Season.split(90, t.k); return `<td>${m[p] ? Season.dur(m[p]) : '·'}</td>`; }).join('')}</tr>`).join('')}</tbody></table>
        <p class="note">Reparto previsto en una sesión de 1h30. Si el real fue otro, lo cambias al cerrar la sesión.</p>
        <div class="row-btns"><button class="btn sm" data-hm="import" title="Trae tus semanas, sesiones, regulaciones y torneos de tus Excel de Road to Worlds">Importar tus Excel…</button>${impMsg()}</div></div>
    </div>`;
  }
  /** «Todo»: desde la primera sesión hasta hoy. */
  function allReg(d) {
    const days = d.sess.map(s => Season.dayCount(s, d.openId)).filter(Season.isDay).sort();
    return { id: 'all', name: 'Todo', start: days[0] || Season.today(), end: '' };
  }
  function weeksChart(ks, d) {
    const ws = ks.slice(-16).map(k => Season.week(k, d.sess, d.plan, M, d.openId));
    if (!ws.length) return '';
    const max = Math.max(1, ...ws.map(w => Math.max(w.doneH, w.target)));
    return `<div class="hmchart">${ws.map(w => `<div class="hmcol" title="${esc(fd(w.k, { day: 'numeric', month: 'short' }))}: ${hrs(w.doneH)} / ${hrs(w.target)}"><div class="hmcolbar"><i class="tgt" style="bottom:${(w.target / max) * 100}%"></i><i class="bar${w.doneH >= w.target ? ' ok' : ''}" style="height:${(w.doneH / max) * 100}%"></i></div><small>${esc(fd(w.k, { day: 'numeric', month: 'numeric' }))}</small></div>`).join('')}</div><p class="note">Barra: horas hechas · raya: tu objetivo de esa semana.</p>`;
  }
  const EVAL = [['', '—'], ['short', 'Corto'], ['ok', 'Bien'], ['long', 'Largo']];
  function regRow(r, d, fo) {
    const st = Season.reg(r, d.sess, d.plan, M, d.openId);
    const ev = r.eval || {};
    return `<div class="hmreg">
      <div class="hmreghead"><b class="nolang">${esc(r.name)}</b><span class="note">${esc(fd(r.start, { day: 'numeric', month: 'short', year: 'numeric' }))}${r.end ? ` – ${esc(fd(r.end, { day: 'numeric', month: 'short', year: 'numeric' }))}` : ''}</span>${r.ok === true ? '<span class="pill win">Objetivo cumplido</span>' : r.ok === false ? '<span class="pill loss">No cumplido</span>' : ''}<span style="flex:1"></span><button class="btn sm" data-hm="regedit" data-id="${esc(r.id)}">✎ <span>Editar</span></button><button class="btn sm ibtn danger" data-hm="regdel" data-id="${esc(r.id)}" title="Borrar la regulación">✕</button></div>
      ${r.goal ? `<p class="hmgoal"><small>Objetivo</small> <span class="nolang">${esc(r.goal)}</span></p>` : ''}
      ${st ? `<p class="hmregnums"><span><b>${hrs(st.doneH)}</b> hechas</span><span><b>${st.avg == null ? '—' : hrs(st.avg)}</b> por semana</span><span><b>${pctS(st.study)}</b> estudio</span><span><b>${pctS(st.planOk)}</b> plan</span></p>${pillBar(st.split)}` : ''}
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
      const body = H.tab === 'semana' ? semanaHTML(d) : H.tab === 'cal' ? calHTML(d) : H.tab === 'temp' ? tempHTML(d) : H.tab === 'torneos' ? torneosHTML(d) : hoyHTML(d);
      const top = el.scrollTop;
      el.innerHTML = `<div class="hm">${`<div class="head"><div><h1>In<span>icio</span></h1><p class="note" style="margin-top:4px">${esc(cap(fd(Season.today(), { weekday: 'long', day: 'numeric', month: 'long' })))}${SET.reg && SET.reg.name ? ` · <span class="nolang">${esc(SET.reg.name)}</span>` : ''}</p></div>${tabs()}</div>`}${body}</div>`;
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
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  /** Repintar si no estás escribiendo en Inicio. */
  function refresh() {
    bar();
    if (VIEW !== 'inicio') return;
    const a = document.activeElement;
    if (a && $('#v-inicio').contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
    paint();
  }

  /* ---------- acciones ---------- */
  async function startSession(id) {
    const cur = SET.sessionId && (await Sess.current());
    if (cur && cur.id !== id && cur.state !== 'done') {
      if (!confirm(`Tienes abierta «${cur.name}». ¿Cerrarla y empezar esta? (La puedes cerrar con sus datos después en Semana.)`)) return;
      await Sess.finish(cur.id, {});
    }
    await Sess.open(id);
    show('jugar');
  }
  async function onClick(e) {
    const tb = e.target.closest('[data-hmtab]');
    if (tb) { H.tab = tb.dataset.hmtab; ls('msHomeTab', H.tab); H.msg = ''; paint(); return; }
    const wk = e.target.closest('[data-hmweek]');
    if (wk) { H.week = +wk.dataset.hmweek ? Season.addDays(H.week, +wk.dataset.hmweek) : Season.weekOf(Season.today()); H.msg = ''; paint(); return; }
    const mo = e.target.closest('[data-hmmonth]');
    if (mo) {
      const n = +mo.dataset.hmmonth;
      if (!n) { H.month = Season.today().slice(0, 7); H.day = Season.today(); } else { const [y, m] = H.month.split('-').map(Number); const x = new Date(y, m - 1 + n, 1); H.month = Season.dayOf(x).slice(0, 7); }
      paint(); return;
    }
    const dy = e.target.closest('[data-hmday]');
    if (dy) { H.day = dy.dataset.hmday; if (H.day.slice(0, 7) !== H.month) H.month = H.day.slice(0, 7); paint(); return; }
    const b = e.target.closest('[data-hm]');
    if (!b) return;
    const k = b.dataset.hm, id = b.dataset.id;
    if (k === 'start') await startSession(id);
    else if (k === 'quick') {
      const s = await Sess.create({ type: H.quick.type, goal: H.quick.goal, planned: false }, false);
      H.quick.goal = '';
      await startSession(s.id);
    } else if (k === 'add') {
      const goal = H.add.goal;
      await Sess.create({ type: H.add.type, goal, day: H.add.day, planMin: +H.add.dur || 120 }, false);
      H.add.goal = ''; H.msg = 'Sesión añadida.';
      paint();
    } else if (k === 'addday') { H.add.day = b.dataset.day; paint(); setTimeout(() => { const g = $('#hmAGoal'); if (g) g.focus(); }, 0); }
    else if (k === 'planday') { H.week = Season.weekOf(H.day); H.add.day = H.day; H.tab = 'semana'; ls('msHomeTab', H.tab); paint(); setTimeout(() => { const g = $('#hmAGoal'); if (g) g.focus(); }, 0); }
    else if (k === 'copyweek') {
      const prev = Season.addDays(H.week, -7), d = await data();
      const src = d.sess.filter(s => s.planMin > 0 && s.day && Season.weekOf(s.day) === prev);
      if (!src.length) { H.msg = 'La semana anterior no tenía sesiones previstas.'; paint(); return; }
      for (const s of src.reverse()) await Sess.create({ type: s.type, goal: '', day: Season.addDays(s.day, 7), planMin: s.planMin, teamId: s.teamId }, false);
      H.msg = `${src.length} sesiones copiadas.`; paint();
    } else if (k === 'skip') { await Sess.update(id, { state: 'skip' }); paint(); }
    else if (k === 'close') sessDialog(id, 'close');
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
    if (t.id === 'hmQGoal') H.quick.goal = t.value;
    else if (t.id === 'hmAGoal') H.add.goal = t.value;
    else if (t.dataset.hmw) {
      // Lo de la semana se guarda solo, mientras escribes.
      const k = H.week, f = t.dataset.hmw, v = t.value;
      clearTimeout(wTimer[f]);
      wTimer[f] = setTimeout(async () => {
        await savePlan(p => { const w = { ...(p.weeks[k] || {}) }; if (f === 'target') { if (v === '') delete w.target; else w.target = Math.max(0, Math.min(80, +v || 0)); } else w[f] = String(v).slice(0, 2000); p.weeks[k] = w; });
        const m = $('#hmWSaved'); if (m) m.textContent = 'Guardado';
        if (f === 'target' || f === 'focus') { const a = document.activeElement; if (!(a && a.dataset && a.dataset.hmw === 'want') && !(a && a.dataset && a.dataset.hmw === 'note')) paint(); }
      }, f === 'focus' ? 0 : 500);
    } else if (t.dataset.hmc) {
      const f = t.dataset.hmc, v = +t.value;
      clearTimeout(wTimer[f]);
      wTimer[f] = setTimeout(async () => {
        if (!(v >= 0)) return;
        await savePlan(p => { const c = { ...Season.CFG, ...p.cfg }; if (/^(green|yellow)[01]$/.test(f)) { const a = (c[f.slice(0, -1)] || []).slice(); a[+f.slice(-1)] = v; c[f.slice(0, -1)] = a; } else c[f] = v; p.cfg = { avg: c.avg, green: c.green, yellow: c.yellow, gap: c.gap, rate: c.rate }; });
        const m = $('#hmCSaved'); if (m) m.textContent = 'Guardado';
      }, 500);
    }
  }
  function onChange(e) {
    const t = e.target;
    if (t.id === 'hmQType') H.quick.type = t.value;
    else if (t.id === 'hmADay') H.add.day = t.value;
    else if (t.id === 'hmAType') H.add.type = t.value;
    else if (t.id === 'hmADur') H.add.dur = +t.value;
    else if (t.id === 'hmRegSel') { H.reg = t.value; paint(); }
    else if (t.id === 'hmSeason') { H.season = t.value === 'all' ? 'all' : +t.value; paint(); }
    else if (t.dataset.hmw === 'focus') onInput(e);
  }
  function onKey(e) {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'hmQGoal') { e.preventDefault(); onClick({ target: $('[data-hm="quick"]') }); }
    if (e.target.id === 'hmAGoal') { e.preventDefault(); onClick({ target: $('[data-hm="add"]') }); }
  }

  /* ---------- ventanas: sesión, regulación, torneo ---------- */
  const modal = html => { $('#modalBox').innerHTML = html; $('#modal').classList.remove('hide'); $('#mClose').onclick = closeModal; };
  /** Cerrar (o ver y cambiar) una sesión: lo previsto, lo real con los minutos por pilar, si cumpliste y lo que te llevas. */
  async function sessDialog(id, mode) {
    const all = await Sess.list(), s0 = all.find(x => x.id === id);
    if (!s0) return;
    const d = await data(), s = d.sess.find(x => x.id === id);
    const st = Season.stateOf(s, d.openId);
    // Lo real se pone al cerrarla (o al ver una hecha); mientras está abierta, el tiempo lo sigue contando la app.
    const real = mode === 'close' || st === 'done';
    const tr = Season.tracked(s), trTot = Season.round5(Season.sum(tr));
    const realMin = s.realMin || (st === 'open' || mode === 'close' ? trTot || s.planMin || 0 : Season.realMin(s, M, d.openId).total);
    let min = s.min && Season.sum(s.min) ? { ...Season.zero(), ...s.min } : trTot ? roundTo(tr, realMin) : Season.split(realMin, s.type);
    const games = mine().filter(m => m.session === s.id).sort((a, b) => b.endedAt - a.endedAt);
    modal(`<div class="head"><div><h1 style="font-size:22px">${mode === 'close' ? 'Cerrar sesión' : 'Sesión'}</h1><p class="note"><span class="nolang">${esc(s.name)}</span> · <span>${ST[stateX(s, d)]}</span></p></div><button class="btn" id="mClose">Cerrar</button></div>
      <div class="hmform">
        <div class="hmline"><label class="field hmgrow">Nombre<input type="text" id="sfName" maxlength="80" value="${esc(s.name)}"></label><label class="field">Tipo<select id="sfType">${typeOpts(s.type)}</select></label></div>
        <label class="field">Objetivo<input type="text" id="sfGoal" maxlength="300" value="${esc(s.goal || '')}" placeholder="Tu error más repetido o lo que toque probar"></label>
        <div class="hmline"><label class="field">Día previsto<input type="date" id="sfDay" value="${esc(s.day || '')}"></label><label class="field">Duración prevista<select id="sfPlan">${durOpts(s.planMin || 0, true)}</select></label><label class="field hmgrow">Equipo<select id="sfTeam">${teamOpts(d, s.teamId)}</select></label></div>
        ${real ? `<h3 class="hmfh">Lo que hiciste</h3>
        <div class="hmline"><label class="field">Día<input type="date" id="sfRDay" value="${esc(s.realDay || Season.today())}"></label><label class="field">Duración (min)<input type="number" id="sfRMin" min="0" max="900" step="5" value="${esc(realMin)}"></label>
          <span class="hmmins">${Season.PILLARS.map(([p, n]) => `<label class="field">${n}<input type="number" min="0" max="900" step="5" data-sfmin="${p}" value="${esc(min[p])}"></label>`).join('')}</span></div>
        <p class="note" id="sfSum"></p>
        ${trTot ? `<p class="note">Medido por la app: ${Season.PILLARS.filter(([p]) => tr[p]).map(([p, n]) => `${n} ${Season.dur(tr[p])}`).join(' · ')}.</p>` : ''}
        <div class="hmline"><span class="field">¿Has cumplido el objetivo?<span class="seg" id="sfOk"><button data-ok="1" aria-pressed="${s.ok === true}">✔ Sí</button><button data-ok="0" aria-pressed="${s.ok === false}">✘ No</button></span></span></div>
        <label class="field">Lo que has hecho<textarea id="sfNotes" rows="3" maxlength="4000">${esc(s.notes || '')}</textarea></label>
        <label class="field">Lo que te llevas a la siguiente <span class="note">(sale en Inicio y en Jugar)</span><textarea id="sfLesson" rows="2" maxlength="1000">${esc(s.lesson || '')}</textarea></label>
        <label class="field">Otras notas <span class="note">(si hiciste algo distinto de lo previsto, por qué)</span><textarea id="sfOther" rows="2" maxlength="4000">${esc(s.other || '')}</textarea></label>
        ${games.length ? `<h3 class="hmfh">Partidas de la sesión <span class="note">· marca las que quieres analizar</span></h3><div class="hmgames">${games.slice(0, 24).map(m => `<label class="hmgame ${m.result || ''}"><input type="checkbox" data-sfan="${esc(m.id)}"${m.mark && m.mark.a === true ? ' checked' : ''}${m.mark && m.mark.a === 'done' ? ' disabled' : ''}>${spr((m[m.opp] || { leads: [] }).leads[0] || 'Pikachu', 'xs')}<span class="nolang">${esc((m[m.opp] || {}).name || '?')}</span>${m.mark && m.mark.a === 'done' ? '<small>analizada</small>' : ''}</label>`).join('')}</div>` : ''}` : ''}
        <div class="row-btns"><span class="note" id="sfMsg"></span><span style="flex:1"></span>${st === 'done' || st === 'skip' ? '<button class="btn" data-sf="reopen" title="Seguir con ella: vuelve a contar el tiempo">Volver a abrirla</button>' : st === 'plan' ? '<button class="btn" data-sf="reopen">▶ Empezar</button>' : ''}<button class="btn primary" data-sf="save">${mode === 'close' ? 'Cerrar la sesión' : 'Guardar'}</button></div>
      </div>`);
    const box = $('#modalBox');
    let ok = s.ok;
    const sumMsg = () => {
      const r = +($('#sfRMin') || {}).value || 0, m = Season.PK.reduce((a, p) => a + (+(box.querySelector(`[data-sfmin="${p}"]`) || {}).value || 0), 0), el = $('#sfSum');
      if (el) { el.textContent = m === r ? `Los minutos suman ${Season.dur(m)}.` : `Los minutos suman ${Season.dur(m)} y la sesión dura ${Season.dur(r)}.`; el.className = m === r ? 'note' : 'errmsg'; }
    };
    sumMsg();
    box.oninput = e => {
      if (e.target.id === 'sfRMin') { const r = +e.target.value || 0; min = trTot ? roundTo(tr, r) : Season.split(r, $('#sfType').value); for (const p of Season.PK) { const i = box.querySelector(`[data-sfmin="${p}"]`); if (i) i.value = min[p]; } }
      sumMsg();
    };
    box.onchange = e => { if (e.target.id === 'sfType' && $('#sfRMin') && !trTot) { min = Season.split(+$('#sfRMin').value || 0, e.target.value); for (const p of Season.PK) { const i = box.querySelector(`[data-sfmin="${p}"]`); if (i) i.value = min[p]; } sumMsg(); } };
    box.onclick = async e => {
      const o = e.target.closest('[data-ok]');
      if (o) { ok = ok === (o.dataset.ok === '1') ? null : o.dataset.ok === '1'; $$('#sfOk button').forEach(x => x.setAttribute('aria-pressed', String(ok === (x.dataset.ok === '1')))); return; }
      const b = e.target.closest('[data-sf]');
      if (!b) return;
      if (b.dataset.sf === 'reopen') { closeModal(); await startSession(id); return; }
      const patch = {
        name: ($('#sfName').value.trim() || s.name).slice(0, 80), type: $('#sfType').value, goal: $('#sfGoal').value.trim().slice(0, 300),
        day: Season.isDay($('#sfDay').value) ? $('#sfDay').value : '', planMin: +$('#sfPlan').value || 0, teamId: $('#sfTeam').value
      };
      if (real) {
        const m = {}; for (const p of Season.PK) m[p] = Math.max(0, Math.round(+box.querySelector(`[data-sfmin="${p}"]`).value || 0));
        Object.assign(patch, { realDay: Season.isDay($('#sfRDay').value) ? $('#sfRDay').value : Season.today(), realMin: Math.max(0, Math.round(+$('#sfRMin').value || 0)), min: Season.sum(m) ? m : null, ok, notes: $('#sfNotes').value.slice(0, 4000), lesson: $('#sfLesson').value.trim().slice(0, 1000), other: $('#sfOther').value.slice(0, 4000) });
        for (const c of box.querySelectorAll('[data-sfan]:not([disabled])')) {
          const g = M.find(x => x.id === c.dataset.sfan); if (!g) continue;
          const was = !!(g.mark && g.mark.a === true);
          if (was !== c.checked) { const mk = { r: '', ...(g.mark || {}), a: c.checked }; g.mark = mk.r || mk.a ? mk : null; await api.setMark(g.id, g.mark); }
        }
      }
      b.disabled = true;
      if (mode === 'close') await Sess.finish(id, patch); else await Sess.update(id, patch);
      closeModal(); paint();
    };
  }
  /** Los minutos medidos llevados a la duración que pongas (de 5 en 5). */
  function roundTo(tr, total) {
    const tot = Season.sum(tr);
    if (!tot) return Season.zero();
    const parts = {}; for (const p of Season.PK) parts[p] = tr[p];
    const out = Season.zero(), keys = Season.PK.filter(p => tr[p] > 0);
    for (const p of keys) out[p] = Math.round(((tr[p] / tot) * total) / 5) * 5;
    const diff = total - Season.sum(out);
    if (diff) { const big = keys.slice().sort((a, b) => tr[b] - tr[a])[0]; out[big] = Math.max(0, out[big] + diff); }
    return out;
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

  /* ---------- cronómetro de la sesión abierta, en el menú lateral ---------- */
  async function bar() {
    const el = $('#sessTimer');
    if (!el || W2) return;
    const s = SET.sessionId ? (await Sess.list()).find(x => x.id === SET.sessionId) : null;
    const on = !!(s && (!s.state || s.state === 'open'));
    document.body.classList.toggle('timeron', on); // con el cronómetro, el menú se compacta para que quepa
    if (!on) { el.classList.add('hide'); el.innerHTML = ''; return; }
    el.classList.remove('hide');
    const r = Season.realMin({ ...s, track: Sess.trackOf(s) }, M, s.id), idle = Sess.wasIdle();
    el.innerHTML = `<div class="sttop2"><span class="sbtime" title="Tiempo de la sesión">⏱ <b id="sbTimer">${Season.dur(r.total)}</b></span><button class="btn sm" data-sbclose="1">Cerrar sesión</button></div>${actBtns(s)}${idle ? '<p class="hmwarn sbidle">Pausado: 20 minutos sin tocar el ordenador.</p>' : ''}`;
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-sbact]');
    if (a && SET.sessionId) { Sess.flush().then(() => { Sess.setAct(a.dataset.sbact); bar(); $$('#v-inicio [data-sbact]').forEach(x => { const on = x.dataset.sbact === a.dataset.sbact; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); }); }); return; }
    if (e.target.closest('[data-sbclose]') && SET.sessionId) sessDialog(SET.sessionId, 'close');
  });
  /** Desde el cronómetro (cada 15 s): el tiempo en el menú y en Hoy. */
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
