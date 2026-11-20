'use strict';
/*
 * Macar Showdown · Dashboard.
 * Cinco pestañas (Resumen, Partidas, Rivales, Tu equipo y Hábitos) con los mismos filtros arriba. Las partidas que
 * cuentan son las de la sesión abierta, las de todo su equipo o todas (arriba a la derecha). Pulsar un Pokémon,
 * un lead o un rival filtra todo el panel.
 */
/* global $, esc, spr, ani, M, F, SET, SESS, LADDER, Stats, P, groupBo3, openSet, importModal, insights, eloChart, emptyState, render, scopeIds, scopeInfo, Viewer, wrp, shortFormat, DASH */

const Dash = (() => {
  const D = { tab: 'res', rv: '', cal: false };
  try { D.tab = localStorage.getItem('msDashTab') || 'res'; } catch (e) { /* nada */ }
  const ICO = {
    res: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    games: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    riv: '<path d="M4 4l9 9M20 4l-9 9M5 19l3-3M19 19l-3-3M4 15l5 5M20 15l-5 5"/>',
    team: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
    hab: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M5 8c2.5 1.5 4.5 1.5 7 0s4.5-1.5 7 0M5 16c2.5-1.5 4.5-1.5 7 0s4.5 1.5 7 0"/>'
  };
  const TABS = [['res', 'Resumen'], ['games', 'Partidas'], ['riv', 'Rivales'], ['team', 'Tu equipo'], ['hab', 'Hábitos']];
  const TCOL = { Fire: '#ff7a3d', Water: '#4a9dff', Grass: '#5fd068', Electric: '#ffd23f', Ice: '#7fe3ff', Fighting: '#e0553d', Poison: '#b55dd6', Ground: '#d9a94a', Flying: '#9fb4ff', Psychic: '#ff5c9a', Bug: '#a8c23a', Rock: '#b8a05a', Ghost: '#7a6bd1', Dragon: '#6a5cff', Dark: '#6b5a50', Steel: '#9fb3c8', Fairy: '#ff9fe0', Normal: '#b9b39c' };
  const EN = () => typeof I18N !== 'undefined' && I18N.lang === 'en';
  const W = () => (EN() ? 'W' : 'V'), L = () => (EN() ? 'L' : 'D');
  const pc = x => (x && x.n ? `${wrp(x)}%` : '—');
  const cls = x => (!x || !x.n ? '' : wrp(x) >= 55 ? 'okc' : wrp(x) <= 45 ? 'badc' : '');
  const hhmm = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  function ago(t) {
    const m = Math.max(1, Math.round((Date.now() - t) / 60000));
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.round(h / 24);
    return d === 1 ? 'hace 1 día' : `hace ${d} días`;
  }
  const typesOf = sp => { try { return P.typesOf(sp) || []; } catch (e) { return []; } };
  const tint = sp => TCOL[typesOf(sp)[0]] || '#38d4ff';
  const moveType = mv => { try { const d = P.moveOf(mv); return d ? { type: d.type, st: d.category === 'Status' } : { type: '', st: false }; } catch (e) { return { type: '', st: false }; } };
  const moveChip = (mv, n) => { const t = moveType(mv); return `<span class="tmv t-${esc(t.type)}${t.st ? ' st' : ''}">${esc(mv)}${n != null ? `<small>${n}</small>` : ''}</span>`; };
  const pairSpr = (k, c = 'sm') => `<span class="lsp">${String(k).split(' + ').map(n => spr(n, c)).join('')}</span>`;
  const pairNames = k => `<span class="pairn nolang">${String(k).split(' + ').map(esc).join('<br>')}</span>`;
  const bar = x => `<span class="wbar ${wrp(x) >= 50 ? 'ok' : 'bad'}"><i style="width:${Math.max(4, wrp(x))}%"></i></span>`;

  /* ---------- filtros ---------- */
  function filtersHTML(base) {
    const o = Stats.options(base);
    const r = Stats.compute(base);
    const opts = (list, cur) => { const l = cur && !list.includes(cur) ? [cur, ...list] : list; return l.map(v => `<option value="${esc(v)}"${cur === v ? ' selected' : ''}>${esc(v)}</option>`).join(''); };
    const sel = (key, label, groups) => `<label class="field">${label}<select data-fs="${key}"><option value="">Cualquiera</option>${groups.map(([g, list]) => (list.length ? (g ? `<optgroup label="${g}">${opts(list, F[key])}</optgroup>` : opts(list, F[key])) : '')).join('')}</select></label>`;
    const seg = (key, list) => `<div class="seg" role="group">${list.map(([v, l]) => `<button data-f="${key}" data-val="${v}" aria-pressed="${String(F[key]) === String(v)}">${l}</button>`).join('')}</div>`;
    const dstr = t => (t ? new Date(t).toISOString().slice(0, 10) : '');
    const any = F.result !== 'all' || F.days || F.lead || F.back || F.rival || F.oppLead || F.minElo;
    return `<div class="filters dfil">
      <div class="field">Resultado${seg('result', [['all', 'Todas'], ['win', 'Victorias'], ['loss', 'Derrotas']])}</div>
      <div class="field">Fechas<div class="dfdates">${seg('days', [[0, 'Todo'], [1, 'Hoy'], [7, '7 días'], [30, '30 días']])}<button class="btn ibtn${F.days === -1 ? ' on' : ''}" data-dcal="1" title="Elegir fechas"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/></svg></button></div></div>
      ${F.days === -1 ? `<div class="field">Desde<input type="date" data-fdate="from" value="${dstr(F.from)}"></div><div class="field">Hasta<input type="date" data-fdate="to" value="${dstr(F.to ? F.to - 86399999 : 0)}"></div>` : ''}
      ${sel('lead', 'Tu lead', [[EN() ? 'One Pokémon' : 'Un Pokémon', o.leadMons], [EN() ? 'Pair' : 'Pareja', o.leads]])}
      ${sel('back', 'Tu reserva', [['', o.backs]])}
      ${sel('rival', 'Rival con', [['', o.rivals]])}
      ${sel('oppLead', 'Lead rival', [[EN() ? 'One Pokémon' : 'Un Pokémon', o.oppLeads], [EN() ? 'Pair' : 'Pareja', r.oppLeads.map(x => x.key)]])}
      <label class="field">ELO mín.<input type="number" class="delo" data-fn="minElo" min="0" max="3000" step="50" placeholder="—" value="${F.minElo || ''}" title="Solo partidas contra rivales con este ELO o más"></label>
      ${any ? '<button class="btn sm" data-fclear="1">Quitar filtros</button>' : ''}
    </div>`;
  }

  /* ---------- Resumen ---------- */
  function resumen(ms) {
    const r = Stats.compute(ms), a = Stats.advanced(ms), ov = Stats.overview(ms);
    const st = ov.streak;
    const streak = st ? `<b class="${st > 0 ? 'okc' : 'badc'}">${Math.abs(st)}${st > 0 ? W() : L()}</b>` : '<b>—</b>';
    const bo3 = a.bo3.n ? `<b>${wrp(a.bo3)}%</b> <small>${a.bo3.w}-${a.bo3.n - a.bo3.w}</small>` : '<b>—</b>';
    const gxe = LADDER && LADDER.gxe != null ? `${LADDER.gxe}%` : '—';
    const recent = a.recent.slice(0, 3);
    const mvp = a.mvp;
    const card = mvp ? Stats.teamCards(ms, [mvp.key])[0] : null;
    const best = r.oppPreview.filter(x => x.n >= 2).sort((x, y) => wrp(y) - wrp(x) || y.n - x.n).slice(0, 3);
    const worst = r.oppPreview.filter(x => x.n >= 2).sort((x, y) => wrp(x) - wrp(y) || y.n - x.n).slice(0, 3);
    const monRow = (x, c) => `<button class="dmrow" data-frival="${esc(x.key)}" title="Filtrar por ${esc(x.key)}">${spr(x.key)}<span><b class="nolang">${esc(x.key)}</b><small>${x.w} de ${x.n} ganadas</small></span><em class="${c}">${wrp(x)}%</em></button>`;
    const leadsBest = r.myLeads.filter(x => x.n >= 2).sort((x, y) => wrp(y) - wrp(x) || y.n - x.n).slice(0, 4);
    const leadRow = x => `<button class="lrow" data-flead="${esc(x.key)}" title="Filtrar por este lead">${pairSpr(x.key)}${pairNames(x.key)}${bar(x)}<em class="${cls(x)}">${wrp(x)}%</em><small>${x.w}/${x.n}</small></button>`;
    const types = mvp ? typesOf(mvp.key) : [];
    return `<div class="dovw">
      <div class="dcol">
        <div class="card dsum"><h2>Tu resumen</h2>
          <div class="dsumg">
            <div class="dmini"><div><small>Sets Bo3</small>${bo3}</div><div><small>Racha</small>${streak}</div>
              <div><small>OTS · CTS</small><b>${pc(ov.ots)} · ${pc(ov.cts)}</b></div><div><small>ELO</small><b>${r.eloNow ?? '—'}</b></div>
              <div><small>GXE</small><b title="GXE del ladder de Showdown">${gxe}</b></div></div>
            <div class="dbig"><b class="${cls(r)}">${r.n ? Math.round((r.w / r.n) * 100) : 0}%</b><span>de victorias · ${r.w} de ${r.n}</span>
              <div class="dchips">${ov.last.map(x => `<i class="${x === 'win' ? 'w' : x === 'loss' ? 'l' : 't'}">${x === 'win' ? W() : x === 'loss' ? L() : '='}</i>`).join('')}</div>
              <small class="note">Últimas ${ov.last.length} partidas</small></div>
          </div></div>
        <div class="card"><div class="dch"><h2>Últimas partidas</h2><span class="note">Pulsa una para ver su replay</span></div>
          <div class="drecent">${recent.map(s => { const op = Stats.theirs(s); return `<button class="drc ${s.result}" data-view="${esc(s.id)}"><span class="drcr">${s.result === 'win' ? '✓ <span>Victoria</span>' : '✕ <span>Derrota</span>'}</span><span class="drcm">${op.leads.map(n => spr(n, 'sm')).join('')}</span><b class="nolang">${esc(op.name)}</b><small>${ago(s.endedAt)}</small></button>`; }).join('') || '<p class="note">Sin partidas.</p>'}</div></div>
      </div>
      <div class="hero" style="--tc:${mvp ? tint(mvp.key) : '#38d4ff'}">${mvp && card ? `
        <span class="herobg nolang" aria-hidden="true">${esc(mvp.key.toUpperCase())}</span>
        <div class="heroimg">${ani(mvp.key, 'heroani')}</div>
        <div class="herotxt"><h2 class="nolang">${esc(mvp.key)}</h2><p><i>♛</i> <span>Tu MVP</span>${types.map(t => ` · <span>${esc(P.TYPES_ES[t] || t)}</span>`).join('')}</p></div>
        <div class="heropanel"><div class="herost"><div><b class="${cls(card)}">${pc(card)}</b><small>cuando lo llevas</small></div><div><b>${card.n}</b><small>partidas</small></div><div><b>${Math.round(card.leadPct * 100)}%</b><small>abre</small></div></div>
          ${card.moves.length ? `<h4>Lo que más usas</h4><div class="movechips">${card.moves.slice(0, 4).map(([mv, n]) => moveChip(mv, n)).join('')}</div>` : ''}</div>` : '<p class="note heroempty">Juega unas partidas y aquí sale tu MVP.</p>'}</div>
      <div class="dcol">
        <div class="card"><h2 class="dh okh"><i>↗</i><span>Contra lo que más ganas</span></h2>${best.length ? best.map(x => monRow(x, 'okc')).join('') : '<p class="note">Hacen falta al menos 2 partidas contra el mismo Pokémon.</p>'}</div>
        <div class="card"><h2 class="dh badh"><i>↘</i><span>Lo que más te cuesta</span></h2>${worst.length ? worst.map(x => monRow(x, 'badc')).join('') : '<p class="note">Hacen falta al menos 2 partidas contra el mismo Pokémon.</p>'}</div>
      </div>
    </div>
    <div class="drow3">
      <div class="card"><h2>Tus leads más jugados</h2>${r.myLeads.slice(0, 4).map(leadRow).join('') || '<p class="note">Sin datos.</p>'}</div>
      <div class="card"><h2>Los leads que mejor te funcionan</h2>${leadsBest.map(leadRow).join('') || '<p class="note">Hacen falta al menos 2 partidas con el mismo lead.</p>'}</div>
      <div class="card"><h2>Los rivales que más te encuentras</h2>${r.oppPreview.slice(0, 5).map(x => `<button class="dmrow" data-frival="${esc(x.key)}">${spr(x.key, 'sm')}<span><b class="nolang">${esc(x.key)}</b><small>En el ${Math.round((x.n / r.n) * 100)}% de tus partidas</small></span><em class="${cls(x)}">${wrp(x)}%</em></button>`).join('') || '<p class="note">Sin datos.</p>'}</div>
    </div>`;
  }

  /* ---------- Partidas ---------- */
  function dayLabel(t) {
    const d = new Date(t), today = new Date(); today.setHours(0, 0, 0, 0);
    const d0 = new Date(d); d0.setHours(0, 0, 0, 0);
    const diff = Math.round((today - d0) / 864e5);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    const t = d.toLocaleDateString(EN() ? 'en-GB' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function partidas(ms) {
    const a = Stats.advanced(ms);
    const groups = groupBo3(ms);
    const days = [];
    for (const g of groups) {
      const key = new Date(g.games[0].endedAt).toDateString();
      const last = days[days.length - 1];
      if (last && last.key === key) last.groups.push(g); else days.push({ key, t: g.games[0].endedAt, groups: [g] });
    }
    const res = g => { const w = g.games.filter(x => x.result === 'win').length, l = g.games.filter(x => x.result === 'loss').length; return { w, l, r: g.bo3 && g.games.length > 1 ? (w > l ? 'win' : l > w ? 'loss' : 'tie') : g.games[0].result || 'tie' }; };
    const kp = (label, x) => `<div><small>${label}</small><b>${x && x.n ? `${wrp(x)}%` : '—'}</b></div>`;
    const row = g => {
      const f = g.games[0], me = Stats.mine(f), op = Stats.theirs(f), x = res(g);
      const bo3 = /bo3/.test(f.formatId || '');
      const slots = bo3 ? [0, 1, 2] : [0];
      return `<div class="grow ${x.r}" data-set="${esc(g.games.map(y => y.id).join(','))}" tabindex="0">
        <div class="gres"><b>${x.r === 'win' ? W() : x.r === 'loss' ? L() : '='}</b><small>${bo3 ? `${x.w}-${x.l}` : 'Bo1'}</small></div>
        <div class="gleads">${me.leads.map(n => spr(n)).join('')}<i>vs</i>${op.leads.map(n => spr(n)).join('')}</div>
        <div class="ginfo"><b class="nolang">${esc(op.name)}</b><span>${esc(shortFormat(f.format))} · ${bo3 ? 'Bo3' : 'Bo1'} · ${hhmm(f.endedAt)}${op.rating ? ` · ${op.rating} ELO` : ''}${g.games.some(y => y.notes) ? ' · ✎' : ''}</span><span class="gprev">${op.preview.map(n => spr(n, `xs${op.brought.includes(n) ? '' : ' dim'}`)).join('')}</span></div>
        <div class="ggames">${slots.map(i => { const y = g.games[i]; return y ? `<button class="gplay ${y.result || ''}" data-view="${esc(y.id)}" title="Ver la replay de G${i + 1}"><small>G${i + 1}</small>▶</button>` : `<span class="gplay none"><small>G${i + 1}</small>—</span>`; }).join('')}</div>
      </div>`;
    };
    return `<div class="row-btns dgbtns"><span class="note">Pulsa una partida para ver sus notas y escribir las notas finales; ▶ abre la replay.</span><span style="flex:1"></span><button class="btn" id="dImport">Importar replays</button><button class="btn" id="dCsv">Exportar CSV</button></div>
      <div class="dkpis">${kp('Sets ganados (Bo3)', a.bo3)}${kp('Ganas el G1', a.bo3.g1)}${kp('Cierras tras ganar el G1', a.bo3.closeAfterG1)}${kp('Remontas tras perder el G1', a.bo3.comeback)}<div><small>Sets incompletos</small><b>${a.bo3.incomplete || 0}</b></div></div>
      ${days.map(d => { const w = d.groups.filter(g => res(g).r === 'win').length, l = d.groups.filter(g => res(g).r === 'loss').length; return `<div class="gday"><b>${esc(dayLabel(d.t))}</b><span class="note">${d.groups.length} ${d.groups.length === 1 ? 'set' : 'sets'} · ${w}-${l}</span></div>${d.groups.map(row).join('')}`; }).join('') || '<div class="card"><p class="note">Aún no hay partidas con estos filtros.</p></div>'}`;
  }
  function csv(ms) {
    const q = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const head = ['fecha', 'resultado', 'formato', 'rival', 'elo_rival', 'tu_lead', 'tus_pokemon', 'lead_rival', 'equipo_rival', 'turnos', 'notas'];
    const rows = ms.map(s => { const me = Stats.mine(s), op = Stats.theirs(s); return [new Date(s.endedAt).toISOString(), s.result, s.format, op.name, op.rating || '', me.leads.join(' + '), me.brought.join(' / '), op.leads.join(' + '), op.preview.join(' / '), s.turns, s.notes || ''].map(q).join(','); });
    const blob = new Blob([`﻿${[head.join(','), ...rows].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `macar-showdown-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /* ---------- Rivales ---------- */
  function rivales(ms) {
    const r = Stats.compute(ms);
    if (!r.oppPreview.length) return '<div class="card"><p class="note">Aún no hay partidas con estos filtros.</p></div>';
    const sel = D.rv && r.oppPreview.some(x => x.key === D.rv) ? D.rv : r.oppPreview[0].key;
    const R = Stats.rival(ms, sel);
    return `<div class="driv">
      <div class="card dlist"><h2>Los que más ves</h2><div class="dscroll">${r.oppPreview.slice(0, 30).map(x => `<button class="dmrow${x.key === sel ? ' on' : ''}" data-rv="${esc(x.key)}">${spr(x.key, 'sm')}<span><b class="nolang">${esc(x.key)}</b><small>En el ${Math.round((x.n / r.n) * 100)}% de tus partidas</small></span><em class="${cls(x)}">${wrp(x)}%</em></button>`).join('')}</div></div>
      <div class="rvhero" style="--tc:${tint(sel)}">
        <div class="rvtop">${ani(sel, 'rvani')}<div><h2 class="nolang">${esc(sel.toUpperCase())}</h2><p class="rvwr"><b class="${cls(R)}">${pc(R)}</b><span>${R.w} de ${R.n} ganadas</span></p>
          <div class="rvchips"><span>Lo ves en el ${Math.round(R.seen * 100)}%</span><span>Abre en el ${R.n ? Math.round((R.leadN / R.n) * 100) : 0}%</span><span>Lo saca en el ${R.n ? Math.round((R.broughtN / R.n) * 100) : 0}%</span></div>
          <button class="btn sm" data-rvonly="${esc(sel)}"><span>Ver solo las partidas contra</span> <span class="nolang">${esc(sel)}</span></button></div></div>
        <div class="rvgrid">
          <div><h4>Suele ir con</h4><div class="rvmates">${R.mates.map(x => `<button class="mate" data-rv="${esc(x.key)}" title="${esc(x.key)}">${spr(x.key)}</button>`).join('') || '<p class="note">Sin datos.</p>'}</div></div>
          <div><h4>Tus leads contra él</h4>${R.myLeads.slice(0, 4).map(x => `<div class="lrow">${pairSpr(x.key)}${pairNames(x.key)}${bar(x)}<em class="${cls(x)}">${wrp(x)}%</em><small>${x.w}/${x.n}</small></div>`).join('') || '<p class="note">Sin datos.</p>'}</div>
          <div><h4>Cómo abre con él</h4>${R.oppLeads.slice(0, 4).map(x => `<div class="lrow">${pairSpr(x.key)}${pairNames(x.key)}${bar(x)}<em class="${cls(x)}">${wrp(x)}%</em><small>${x.w}/${x.n}</small></div>`).join('') || '<p class="note">Nunca te ha abierto con él.</p>'}</div>
          <div><h4>Últimas partidas contra él</h4>${R.recent.map(s => { const me = Stats.mine(s), op = Stats.theirs(s); return `<div class="rvg"><i class="dres1 ${s.result}">${s.result === 'win' ? W() : L()}</i>${me.leads.map(n => spr(n, 'xs')).join('')}<span><b class="nolang">${esc(op.name)}</b><small>${new Date(s.endedAt).toLocaleDateString(EN() ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short' })}</small></span><button class="btn sm ibtn" data-view="${esc(s.id)}" title="Ver la replay">▶</button></div>`; }).join('')}</div>
          ${R.moves.length ? `<div class="rvwide"><h4>Sus movimientos</h4><div class="movechips">${R.moves.slice(0, 8).map(([mv, n]) => moveChip(mv, n)).join('')}</div></div>` : ''}
        </div>
      </div>
      <div class="card"><div class="dch"><h2>Cómo te abren</h2><span class="note">y cómo te va</span></div>${r.oppLeads.slice(0, 8).map(x => `<button class="lrow" data-foplead="${esc(x.key)}" title="Filtrar por este lead rival">${pairSpr(x.key)}${pairNames(x.key)}${bar(x)}<em class="${cls(x)}">${wrp(x)}%</em><small>${x.w}/${x.n}</small></button>`).join('')}</div>
    </div>`;
  }

  /* ---------- Tu equipo ---------- */
  function equipo(ms) {
    const r = Stats.compute(ms);
    const sets = (DASH.teamSets && DASH.teamSets.sets) || [];
    const species = sets.length ? sets.map(m => m.species) : r.myMons.slice(0, 6).map(x => x.key);
    if (!species.length) return '<div class="card"><p class="note">Elige tu equipo al empezar la sesión y aquí verás cómo rinde cada Pokémon.</p></div>';
    const cards = Stats.teamCards(ms, species);
    return `<div class="dtm"><div class="dtcards">${cards.map((c, i) => {
      const set = sets[i];
      const moves = set ? set.moves.filter(Boolean).map(mv => [mv, (c.moves.find(([k]) => k === mv) || [0, 0])[1]]) : c.moves.slice(0, 4);
      const extra = c.moves.filter(([k]) => set && !set.moves.includes(k));
      const all = [...moves, ...extra].sort((x, y) => y[1] - x[1]).slice(0, 4);
      const mx = Math.max(1, ...all.map(x => x[1]));
      const mega = set && /ite( [XY])?$/.test(set.item || '') && set.item !== 'Eviolite';
      return `<div class="dtc" style="--tc:${tint(c.key)}"><span class="dtcbg nolang" aria-hidden="true">${esc(c.key.toUpperCase())}</span>${ani(c.key, 'dtani')}
        <div class="dtcbody"><h3 class="nolang">${esc(c.key)}</h3><p class="note">Lo llevas ${Math.round(c.broughtPct * 100)}% · Abre ${Math.round(c.leadPct * 100)}%</p>
          <p class="dtcwr"><b class="${cls(c)}">${pc(c)}</b><span>cuando lo llevas</span></p>
          ${mega ? `<p class="dtmega">Con mega: ${c.mega.n ? `${wrp(c.mega)}% en ${c.mega.n} partidas` : 'aún no ha megaevolucionado'}</p>` : ''}
          <div class="dtmoves">${all.map(([mv, n]) => `<div><span class="nolang">${esc(mv)}</span><i><b style="width:${(n / mx) * 100}%"></b></i><em>${n}</em></div>`).join('')}</div></div></div>`;
    }).join('')}</div>
      <div class="card"><div class="dch"><h2>Tus parejas de leads</h2><span class="note">de más a menos jugadas</span></div>${r.myLeads.slice(0, 10).map(x => `<button class="lrow" data-flead="${esc(x.key)}">${pairSpr(x.key)}${pairNames(x.key)}${bar(x)}<em class="${cls(x)}">${wrp(x)}%</em><small>${x.w}/${x.n}</small></button>`).join('') || '<p class="note">Sin datos.</p>'}</div></div>`;
  }

  /* ---------- Hábitos ---------- */
  function habitos(ms) {
    const H = Stats.habits(ms), r = Stats.compute(ms), a = Stats.advanced(ms);
    const ins = ms.length ? insights(r, a) : [];
    const row = x => `<div class="hrow"><span>${esc(x.key)}</span><em class="${x.delta > 0 ? 'okc' : 'badc'}">${x.delta > 0 ? '+' : ''}${x.delta} pts</em><b>${Math.round((x.w / x.n) * 100)}%</b><small>${x.n} partidas</small></div>`;
    const bars = list => list.filter(h => h.n).map(h => `<div class="lrow"><span class="hk">${esc(h.key)}</span>${bar(h)}<em class="${cls(h)}">${wrp(h)}%</em><small>${h.n}</small></div>`).join('') || '<p class="note">Sin datos.</p>';
    return `${H.n < 30 ? `<div class="card hprog"><div><b>Con 30 partidas se ve claro qué te hace ganar o perder.</b><span class="note">Llevas ${H.n}: de momento son pistas, no conclusiones.</span></div><i><b style="width:${Math.min(100, (H.n / 30) * 100)}%"></b></i></div>` : ''}
      <p class="note hbase">Tu media: ${Math.round(H.base * 100)}% de victorias. Al lado, cuánto más o menos ganas en cada caso.</p>
      <div class="dgrid2">
        <div class="card"><h2 class="dh okh"><i>↗</i><span>Lo que más te hace ganar</span></h2>${H.win.map(row).join('') || '<p class="note">Nada destaca todavía.</p>'}</div>
        <div class="card"><h2 class="dh badh"><i>↘</i><span>Lo que más te hace perder</span></h2>${H.lose.map(row).join('') || '<p class="note">Nada destaca todavía.</p>'}</div>
      </div>
      <div class="dgrid3">
        <div class="card"><h2>Por hora</h2>${bars(H.hours)}</div>
        <div class="card"><h2>Por día de la semana</h2>${bars(H.days)}</div>
        <div class="card"><h2>Partidas seguidas</h2>${bars([a.afterWin, a.afterLoss, a.early, a.late, a.short, a.long])}</div>
        <div class="card"><h2>Lo que dice tu juego</h2>${ins.length ? `<ul class="ins">${ins.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="note">Aún hay pocas partidas para saberlo.</p>'}</div>
        <div class="card elo wide2"><h2>ELO</h2>${eloChart(r.elo)}</div>
      </div>`;
  }

  /* ---------- pintar ---------- */
  function paint() {
    const el = $('#v-dash');
    const top = el.scrollTop;
    const info = scopeInfo();
    const seg = `<div class="seg dscope" role="group" title="Qué partidas cuentan">${info.session ? `<button data-f="scope" data-val="session" aria-pressed="${F.scope === 'session'}">Esta sesión</button>` : ''}${info.team ? `<button data-f="scope" data-val="team" aria-pressed="${F.scope === 'team'}">Todo el equipo</button>` : ''}<button data-f="scope" data-val="all" aria-pressed="${F.scope === 'all' || (!info.session && !info.team)}">Todas</button></div>`;
    const sub = info.session ? `<span class="note">${F.scope === 'all' ? 'Todas tus partidas' : F.scope === 'team' ? `Todas las sesiones de <span class="nolang">${esc(info.team)}</span>` : `<span class="nolang">${esc(info.session.name)}</span>${info.session.goal ? ` · Objetivo: <span class="nolang">${esc(info.session.goal)}</span>` : ''}`}</span>` : '<span class="note">Todas tus partidas</span>';
    if (!M.length) { el.innerHTML = `<div class="head"><div><h1>Dash<span>board</span></h1></div></div>${emptyState()}`; return; }
    const ids = scopeIds();
    const base = Stats.usable(M).filter(s => !ids || ids.has(s.id));
    const ms = Stats.filter(M, { ...F, ids });
    const unknown = M.length - Stats.usable(M).length;
    const body = D.tab === 'games' ? partidas(ms) : D.tab === 'riv' ? rivales(ms) : D.tab === 'team' ? equipo(ms) : D.tab === 'hab' ? habitos(ms) : resumen(ms);
    el.innerHTML = `<div class="dhead"><nav class="dtabs">${TABS.map(([k, l]) => `<button data-dtab="${k}" aria-current="${D.tab === k}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICO[k]}</svg>${l}</button>`).join('')}</nav>
        <div class="dscopebox">${sub}${seg}<button class="btn sm" data-go="doc" title="Documento de preparación">PDF</button></div></div>
      ${unknown ? `<div class="warnbox"><span>${unknown} partida${unknown === 1 ? '' : 's'} sin identificar: no sé qué jugador eras. Pon tu usuario de Showdown en Tu equipo.</span><button class="btn" data-go="miequipo">Ir a Tu equipo</button></div>` : ''}
      ${filtersHTML(base)}
      ${!ms.length && D.tab !== 'games' ? `<div class="card"><p class="note">${!base.length && info.session && F.scope === 'session' ? 'Esta sesión aún no tiene partidas: juega en Jugar o mira «Todo el equipo».' : 'Aún no hay partidas con estos filtros.'}</p></div>` : body}`;
    el.scrollTop = top;
    const imp = $('#dImport'); if (imp) imp.onclick = importModal;
    const c = $('#dCsv'); if (c) c.onclick = () => csv(ms);
  }
  let soon = 0;
  /** Varios avisos seguidos (guardar, volver a la ventana…) se juntan en un solo repintado. */
  function renderSoon() { if (soon) return; soon = setTimeout(() => { soon = 0; paint(); }, 0); }

  $('#v-dash').addEventListener('click', e => {
    const t = e.target.closest('button,[data-set]');
    if (!t) return;
    const d = t.dataset;
    if (d.view) { e.stopPropagation(); Viewer.open(d.view); return; }
    if (d.dtab) { D.tab = d.dtab; try { localStorage.setItem('msDashTab', D.tab); } catch (x) { /* nada */ } $('#v-dash').scrollTop = 0; paint(); return; }
    if (d.dcal) { F.days = F.days === -1 ? 0 : -1; if (F.days !== -1) { F.from = 0; F.to = 0; } paint(); return; }
    if (d.frival) { F.rival = d.frival; paint(); return; }
    if (d.flead) { F.lead = d.flead; paint(); return; }
    if (d.foplead) { F.oppLead = d.foplead; paint(); return; }
    if (d.rv) { D.rv = d.rv; paint(); return; }
    if (d.rvonly) { F.rival = d.rvonly; D.tab = 'games'; $('#v-dash').scrollTop = 0; paint(); return; }
    if (d.set) openSet(d.set.split(','));
  });
  $('#v-dash').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.set) openSet(e.target.dataset.set.split(',')); });
  $('#v-dash').addEventListener('change', e => { if (e.target.dataset && e.target.dataset.fn === 'minElo') { F.minElo = Math.max(0, +e.target.value || 0); paint(); } });

  return { render: renderSoon, paint, state: D };
})();
