'use strict';
/*
 * Macar Showdown · Dashboard.
 * Cinco pestañas (Resumen, Partidas, Rivales, Tu equipo y Hábitos) con los mismos filtros arriba. Las partidas que
 * cuentan son las de la sesión abierta, las de todo su equipo o todas (arriba a la derecha). Pulsar un Pokémon,
 * un lead o un rival filtra todo el panel.
 */
/* global $, esc, spr, pill, wrRow, monLabel, pairLabel, unusedMoves, M, F, SET, SESS, LADDER, Stats, P, groupBo3, openSet, importModal, insights, eloChart, emptyState, render, scopeIds, scopeInfo, Viewer, wrp, shortFormat, DASH, I18N */

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
  const moveType = mv => { try { const d = P.moveOf(mv); return d ? { type: d.type, st: d.category === 'Status' } : { type: '', st: false }; } catch (e) { return { type: '', st: false }; } };
  const moveChip = (mv, n) => { const t = moveType(mv); return `<span class="tmv t-${esc(t.type)}${t.st ? ' st' : ''}">${esc(mv)}${n != null ? `<small>${n}</small>` : ''}</span>`; };

  /* ---------- filtros ---------- */
  function filtersHTML(base) {
    const o = Stats.options(base);
    const r = Stats.compute(base);
    const opts = (list, cur) => { const l = cur && !list.includes(cur) ? [cur, ...list] : list; return l.map(v => `<option value="${esc(v)}"${cur === v ? ' selected' : ''}>${esc(v)}</option>`).join(''); };
    const sel = (key, label, groups) => `<label class="field">${label}<select data-fs="${key}"><option value="">Cualquiera</option>${groups.map(([g, list]) => (list.length ? (g ? `<optgroup label="${g}">${opts(list, F[key])}</optgroup>` : opts(list, F[key])) : '')).join('')}</select></label>`;
    const seg = (key, list) => `<div class="seg" role="group">${list.map(([v, l]) => `<button data-f="${key}" data-val="${v}" aria-pressed="${String(F[key]) === String(v)}">${l}</button>`).join('')}</div>`;
    const dstr = t => (t ? new Date(t).toISOString().slice(0, 10) : '');
    const any = F.result !== 'all' || F.days || F.lead || F.back || F.rival || F.oppLead || F.minElo || F.mark;
    const MK = [['', 'Cualquiera'], ['notes', 'Con notas'], ['analyze', 'Por analizar'], ['analyzed', 'Ya analizadas'], ['good', 'Buenas'], ['meh', 'Indiferentes'], ['bad', 'Malas'], ['none', 'Sin marcar']];
    return `<div class="filters dfil">
      <div class="field">Resultado${seg('result', [['all', 'Todas'], ['win', 'Victorias'], ['loss', 'Derrotas']])}</div>
      <div class="field">Fechas<div class="dfdates">${seg('days', [[0, 'Todo'], [1, 'Hoy'], [7, '7 días'], [30, '30 días']])}<button class="btn ibtn${F.days === -1 ? ' on' : ''}" data-dcal="1" title="Elegir fechas"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/></svg></button></div></div>
      ${F.days === -1 ? `<div class="field">Desde<input type="date" data-fdate="from" value="${dstr(F.from)}"></div><div class="field">Hasta<input type="date" data-fdate="to" value="${dstr(F.to ? F.to - 86399999 : 0)}"></div>` : ''}
      ${sel('lead', 'Tu lead', [[EN() ? 'One Pokémon' : 'Un Pokémon', o.leadMons], [EN() ? 'Pair' : 'Pareja', o.leads]])}
      ${sel('back', 'Tu reserva', [['', o.backs]])}
      ${sel('rival', 'Rival con', [['', o.rivals]])}
      ${sel('oppLead', 'Lead rival', [[EN() ? 'One Pokémon' : 'Un Pokémon', o.oppLeads], [EN() ? 'Pair' : 'Pareja', r.oppLeads.map(x => x.key)]])}
      <label class="field">Marcas<select data-fs="mark" title="Tus marcas y notas de cada partida">${MK.map(([v, l]) => `<option value="${v}"${(F.mark || '') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field">ELO mín.<input type="number" class="delo" data-fn="minElo" min="0" max="3000" step="50" placeholder="—" value="${F.minElo || ''}" title="Solo partidas contra rivales con este ELO o más"></label>
      ${any ? '<button class="btn sm ibtn dfx" data-fclear="1" title="Quitar filtros">✕</button>' : ''}
    </div>`;
  }

  /* ---------- piezas comunes (estilo Macar: filas con barra) ---------- */
  const pick = (attr, key, html) => `<div class="dpick" data-${attr}="${esc(key)}" title="Filtrar el panel">${html}</div>`;
  const rowHead = '<div class="row rowhead"><div></div><div>% de victorias</div><div>de cuántas partidas</div></div>';
  const rowsCard = (title, list, labelFn, empty, attr, extra = '') => `<div class="card"><h2>${title}</h2>${extra}${list.length ? `<div class="rows">${rowHead}${list.map(x => (attr ? pick(attr, x.key, wrRow(x, labelFn(x))) : wrRow(x, labelFn(x)))).join('')}</div>` : `<p class="note">${empty}</p>`}</div>`;
  const kpi = (label, value, sub = '', c = '') => `<div class="kpi"><small>${label}</small><b class="${c}">${value}</b>${sub ? `<i>${sub}</i>` : ''}</div>`;
  const form = last => `<span class="dform">${last.map(x => `<i class="${x === 'win' ? 'w' : x === 'loss' ? 'l' : 't'}">${x === 'win' ? W() : x === 'loss' ? L() : '='}</i>`).join('')}</span>`;
  const statTile = (label, value, c = '') => `<div class="dtile"><small>${label}</small><b class="${c}">${value}</b></div>`;
  /** Anillo con el % de victorias. */
  const donut = (p, c) => { const r = 22, L = 2 * Math.PI * r; return `<svg class="ddonut ${c}" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="${r}" class="bg"/><circle cx="28" cy="28" r="${r}" class="fg" stroke-dasharray="${(p / 100) * L} ${L}" transform="rotate(-90 28 28)"/><text x="28" y="32" text-anchor="middle">${p}%</text></svg>`; };
  /** Línea pequeña con la evolución del ELO. */
  const spark = pts => { if (pts.length < 2) return ''; const rs = pts.map(x => x.r), lo = Math.min(...rs), hi = Math.max(...rs), sp = Math.max(1, hi - lo); return `<svg class="dspark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts.map((x, i) => `${(i / (pts.length - 1)) * 100},${26 - ((x.r - lo) / sp) * 24}`).join(' ')}"/></svg>`; };
  /** Barra horizontal pequeña con un %. */
  const minibar = (x, label) => `<div class="dminib"><span>${label}</span><i><b class="${cls(x)}" style="width:${x && x.n ? wrp(x) : 0}%"></b></i><em>${pc(x)}</em></div>`;
  /** Columnas verticales (hora, día…): alto = % de victorias; encima, las partidas. */
  const vbars = (list, lab) => `<div class="dvbars">${list.map((h, i) => `<div class="dvb${h.n ? '' : ' none'}" title="${h.n ? `${wrp(h)}% · ${h.n} partida${h.n === 1 ? '' : 's'}` : '—'}"><small>${h.n || ''}</small><i><b class="${cls(h) || 'mid'}" style="height:${h.n ? Math.max(4, wrp(h)) : 0}%"></b></i><span>${esc(lab ? lab(h, i) : h.key)}</span></div>`).join('')}</div>`;

  /* ---------- Resumen ---------- */
  /** Color del % de victorias según tu ELO (cuanto más alto, más cuesta ganar). */
  function winColor(p, elo) {
    const [g, y] = elo >= 1650 ? [65, 55] : elo >= 1400 ? [70, 60] : [80, 70];
    return p >= g ? 'okc' : p >= y ? 'midc' : 'badc';
  }
  const gxeColor = v => (v > 80 ? 'okc' : v >= 65 ? 'midc' : 'badc');
  function resumen(ms) {
    const r = Stats.compute(ms), a = Stats.advanced(ms), ov = Stats.overview(ms);
    const st = ov.streak;
    const gxe = LADDER && LADDER.gxe != null ? `${LADDER.gxe}%` : '—';
    const mvp = a.mvp;
    const card = mvp ? Stats.teamCards(ms, [mvp.key])[0] : null;
    const best = r.oppPreview.filter(x => x.n >= 2).sort((x, y) => wrp(y) - wrp(x) || y.n - x.n).slice(0, 5);
    const worst = r.oppPreview.filter(x => x.n >= 2).sort((x, y) => wrp(x) - wrp(y) || y.n - x.n).slice(0, 5);
    const leadsBest = r.myLeads.filter(x => x.n >= 2).sort((x, y) => wrp(y) - wrp(x) || y.n - x.n).slice(0, 5);
    const seen = r.oppPreview.slice(0, 6).map(x => ({ ...x }));
    const winP = r.n ? Math.round((r.w / r.n) * 100) : 0;
    const elo = (LADDER && +LADDER.elo) || r.eloNow || 0;
    const wc = r.n ? winColor(winP, elo) : '', gc = LADDER && LADDER.gxe != null ? gxeColor(+LADDER.gxe) : '';
    const band = elo >= 1650 ? '1650+' : elo >= 1400 ? '1400–1650' : '1000–1399';
    return `<div class="dkbig">
        <div class="kpi dkw dkhero ${wc}">${donut(winP, wc)}<div><small>Porcentaje de victorias</small><b>${r.n ? `${winP}%` : '—'}</b><i>${r.w}–${r.l} · ${r.n} partida${r.n === 1 ? '' : 's'}</i><em class="dkband" title="Verde, amarillo o rojo según tu ELO">ELO ${band}: ${elo >= 1650 ? 'verde ≥ 65% · amarillo 55–65%' : elo >= 1400 ? 'verde ≥ 70% · amarillo 60–70%' : 'verde ≥ 80% · amarillo 70–80%'}</em></div></div>
        <div class="kpi dkhero ${gc}"><small>GXE</small><b>${gxe}</b><i>ladder de Showdown</i><em class="dkband">verde &gt; 80% · amarillo 65–80%</em></div>
      </div>
      <div class="dksmall">
        <div class="kpi"><small>Sets Bo3</small><b class="${a.bo3.n ? cls(a.bo3) : ''}">${a.bo3.n ? `${wrp(a.bo3)}%` : '—'}</b><i>${a.bo3.n ? `${a.bo3.w}–${a.bo3.n - a.bo3.w} en sets` : 'sin sets'}</i></div>
        <div class="kpi"><small>Forma</small>${form(ov.last)}<i>Últimas ${ov.last.length} partidas</i></div>
        ${kpi('Racha', st ? `${Math.abs(st)}${st > 0 ? W() : L()}` : '—', st > 0 ? 'ganando' : st < 0 ? 'perdiendo' : '', st > 0 ? 'okc' : st < 0 ? 'badc' : '')}
        <div class="kpi"><small>ELO</small><b>${r.eloNow ?? '—'}</b>${spark(r.elo)}</div>
      </div>
      <div class="dtwo">
        <div class="card dmvp"><h2>Tu MVP</h2>${mvp && card ? `<div class="dmvpb"><span class="dmvpimg">${spr(mvp.key, 'huge')}</span><div class="dmvpi"><b class="nolang">${esc(mvp.key)}</b><div class="tytags">${typesOf(mvp.key).map(P.typeBadge).join('')}</div>
            <div class="dtiles">${statTile('Cuando lo llevas', pc(card), cls(card))}${statTile('Partidas', card.n)}${statTile('Abre', `${Math.round(card.leadPct * 100)}%`)}</div></div></div>
            ${card.moves.length ? `<div class="dlabel">Lo que más usas</div><div class="movechips">${card.moves.slice(0, 4).map(([mv, n]) => moveChip(mv, n)).join('')}</div>` : ''}` : '<p class="note">Juega unas partidas y aquí sale tu MVP.</p>'}</div>
        <div class="card"><div class="dch"><h2>Últimas partidas</h2><span class="note">▶ abre la replay</span></div>
          <div class="dlast">${a.recent.slice(0, 6).map(s => { const me = Stats.mine(s), op = Stats.theirs(s); return `<div class="dlrow">${pill(s.result)}<span class="dlm">${me.leads.map(n => spr(n, 'xs')).join('')}<i>vs</i>${op.leads.map(n => spr(n, 'xs')).join('')}</span><b class="nolang">${esc(op.name)}</b><small>${ago(s.endedAt)}</small><button class="btn sm ibtn" data-view="${esc(s.id)}" title="Ver la replay">▶</button></div>`; }).join('') || '<p class="note">Sin partidas.</p>'}</div></div>
      </div>
      <div class="grid dgrid">
        ${rowsCard('Contra lo que más ganas', best, monLabel, 'Hacen falta al menos 2 partidas contra el mismo Pokémon.', 'frival')}
        ${rowsCard('Lo que más te cuesta', worst, monLabel, 'Hacen falta al menos 2 partidas contra el mismo Pokémon.', 'frival')}
        ${rowsCard('Los rivales que más te encuentras', seen, x => `${spr(x.key, 'sm')}<span>${esc(x.key)} <small class="note">${Math.round((x.n / r.n) * 100)}%</small></span>`, 'Sin datos.', 'frival')}
        ${rowsCard('Tus leads más jugados', r.myLeads.slice(0, 5), pairLabel, 'Sin datos.', 'flead')}
        ${rowsCard('Los leads que mejor te funcionan', leadsBest, pairLabel, 'Hacen falta al menos 2 partidas con el mismo lead.', 'flead')}
      </div>
      <p class="note dnote2">% = tus victorias en las partidas donde aparece · número = partidas. Pulsa una fila para filtrar todo el panel.</p>`;
  }

  /* ---------- Partidas ---------- */
  function dayLabel(t) {
    const d = new Date(t), today = new Date(); today.setHours(0, 0, 0, 0);
    const d0 = new Date(d); d0.setHours(0, 0, 0, 0);
    const diff = Math.round((today - d0) / 864e5);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    const txt = d.toLocaleDateString(EN() ? 'en-GB' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  }
  /** Las marcas de las partidas de una fila: buena / indiferente / mala y «analizar». */
  function markTags(games) {
    const L = { good: 'Buena', meh: 'Indiferente', bad: 'Mala' };
    const rows = games.map((y, i) => { const mk = y.mark || {}; const note = String(y.notes || '').trim();
      if (!mk.r && !mk.a && !note) return '';
      return `<span class="mkg"><b class="mkgn">G${i + 1}</b>${mk.r ? `<i class="mktag mk-${mk.r}">${L[mk.r]}</i>` : '<i class="mktag mkempty"></i>'}${mk.a === 'done' ? '<i class="mktag mk-done">✓ Analizada</i>' : mk.a ? '<i class="mktag mk-a">🔍 Por analizar</i>' : '<i class="mktag mkempty"></i>'}${note ? `<i class="mktag mk-n" title="${esc(note.slice(0, 300))}">✎ Notas</i>` : '<i class="mktag mkempty"></i>'}</span>`; }).join('');
    return `<span class="mkcol mkrows">${rows}</span>`;
  }
  /** Un equipo en su fila: siempre 6 huecos fijos; los leads con raya amarilla y los que salieron detrás, azul. */
  function teamLine(label, x) {
    const base = n => Stats.toID(P.baseSpecies(n));
    const list = (x.preview && x.preview.length ? x.preview : x.brought || []).slice(0, 6);
    const isLead = n => (x.leads || []).some(y => base(y) === base(n)), isIn = n => (x.brought || []).some(y => base(y) === base(n));
    const ord = [...list.filter(isLead), ...list.filter(n => !isLead(n) && isIn(n)), ...list.filter(n => !isLead(n) && !isIn(n))];
    const cells = Array.from({ length: 6 }, (_, i) => { const n = ord[i]; if (!n) return '<i class="dts"></i>'; const k = isLead(n) ? 'ld' : isIn(n) ? 'in' : ''; const gap = i && (isLead(ord[i - 1]) !== isLead(n)) ? ' gap' : ''; return `<i class="dts ${k}${gap}" title="${esc(n)}${k === 'ld' ? ' · lead' : k === 'in' ? ' · salió' : ''}">${spr(n, 'sm')}</i>`; }).join('');
    return `<span class="dtl"><small>${label}</small>${cells}</span>`;
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
    const kp = (label, x) => kpi(label, x && x.n ? `${wrp(x)}%` : '—', x && x.n ? `${x.w} de ${x.n}` : '');
    const row = g => {
      const f = g.games[0], me = Stats.mine(f), op = Stats.theirs(f), x = res(g);
      const bo3 = /bo3/.test(f.formatId || '');
      const mks = g.games.map(y => y.mark || {}), pend = mks.some(x => x.a === true), done = !pend && mks.some(x => x.a === 'done');
      return `<div class="match dmatch${pend ? ' mk-pend' : done ? ' mk-donerow' : ''}" data-set="${esc(g.games.map(y => y.id).join(','))}" tabindex="0">
        <span class="d">${hhmm(f.endedAt)}</span>
        <span class="pill ${x.r}">${bo3 ? `Bo3 ${x.w}–${x.l}` : (x.r === 'win' ? 'Victoria' : x.r === 'loss' ? 'Derrota' : 'Empate')}</span>
        <span class="vs"><b class="nolang">vs ${esc(op.name)}</b><small>${op.rating ? `${op.rating} ELO · ` : ''}${esc(shortFormat(f.format))}</small></span>
        ${markTags(g.games)}
        <span class="dteams2">${teamLine('Tú', me)}${teamLine('Rival', op)}</span>
        <span class="bo3g">${g.games.map((y, i) => `<button class="gbtn ${y.result || ''}" data-view="${esc(y.id)}" title="Ver la replay de G${i + 1}">▶ G${i + 1}</button>`).join('')}</span>
      </div>`;
    };
    return `<div class="kpis dk">${kp('Sets ganados (Bo3)', a.bo3)}${kp('Ganas el G1', a.bo3.g1)}${kp('Cierras tras ganar el G1', a.bo3.closeAfterG1)}${kp('Remontas tras perder el G1', a.bo3.comeback)}${kpi('Sets incompletos', a.bo3.incomplete || 0)}</div>
      <div class="row-btns dgbtns"><span class="note">Pulsa una partida para ver sus notas y escribir las notas finales; ▶ abre la replay.</span><span class="dleg"><i class="dts ld"></i><span>Lead</span><i class="dts in"></i><span>Salió detrás</span></span><span style="flex:1"></span><button class="btn" id="dImport">Importar replays</button><button class="btn" id="dCsv">Exportar CSV</button></div>
      ${days.map(d => { const w = d.groups.filter(g => res(g).r === 'win').length, l = d.groups.filter(g => res(g).r === 'loss').length; return `<h3 class="dsec dday">${esc(dayLabel(d.t))} <span class="note">${w}–${l}</span></h3><div class="mlist">${d.groups.map(row).join('')}</div>`; }).join('') || '<div class="card"><p class="note">Aún no hay partidas con estos filtros.</p></div>'}`;
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
    return `<div class="card"><div class="dch"><h2>Los que más ves <span class="note">· elige uno</span></h2>
        <label class="rvsearch"><input list="dlRivals" id="rvFind" placeholder="Buscar cualquier Pokémon rival…" autocomplete="off"><datalist id="dlRivals">${r.oppPreview.map(x => `<option value="${esc(x.key)}">`).join('')}</datalist></label></div>
        ${D.rvMsg ? `<p class="note">${esc(D.rvMsg)}</p>` : ''}
        <div class="rvstrip">${(r.oppPreview.slice(0, 10).some(x => x.key === sel) ? r.oppPreview.slice(0, 10) : [r.oppPreview.find(x => x.key === sel), ...r.oppPreview.slice(0, 9)]).map(x => `<button class="rvchip${x.key === sel ? ' on' : ''}" data-rv="${esc(x.key)}" title="${esc(x.key)}">${spr(x.key, 'sm')}<span><b class="nolang">${esc(x.key)}</b><small>${Math.round((x.n / r.n) * 100)}% · <em class="${cls(x)}">${wrp(x)}%</em></small></span></button>`).join('')}</div></div>
      <div class="drvgrid">
        <div class="card drvfile"><h2>Ficha del rival</h2>
          <div class="dmvpb">${spr(sel, 'big')}<div class="dmvpi"><b class="nolang">${esc(sel)}</b><div class="tytags">${typesOf(sel).map(P.typeBadge).join('')}</div></div></div>
          <div class="dtiles four">${statTile('Ganas', pc(R), cls(R))}${statTile('Lo ves en', `${Math.round(R.seen * 100)}%`)}${statTile('Abre en', `${R.n ? Math.round((R.leadN / R.n) * 100) : 0}%`)}${statTile('Lo saca en', `${R.n ? Math.round((R.broughtN / R.n) * 100) : 0}%`)}</div>
          <p class="note">${R.w} de ${R.n} ganadas</p>
          <div class="row-btns"><button class="btn sm primary" data-rvonly="${esc(sel)}"><span>Ver solo las partidas contra</span> <span class="nolang">${esc(sel)}</span></button></div>
          ${R.moves.length ? `<div class="dlabel">Sus movimientos</div><div class="movechips">${R.moves.slice(0, 8).map(([mv, n]) => moveChip(mv, n)).join('')}</div>` : ''}</div>
        ${rowsCard('Suele ir con', R.mates, monLabel, 'Sin datos.', 'rv')}
        ${rowsCard('Tus leads contra él', R.myLeads.slice(0, 5), pairLabel, 'Sin datos.', 'flead')}
        ${rowsCard('Cómo abre con él', R.oppLeads.slice(0, 5), pairLabel, 'Nunca te ha abierto con él.', 'foplead')}
        <div class="card"><h2>Últimas partidas contra él</h2><div class="dlast">${R.recent.map(s => { const me = Stats.mine(s), op = Stats.theirs(s); return `<div class="dlrow">${pill(s.result)}<span class="dlm">${me.leads.map(n => spr(n, 'xs')).join('')}</span><b class="nolang">${esc(op.name)}</b><small>${new Date(s.endedAt).toLocaleDateString(EN() ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short' })}</small><button class="btn sm ibtn" data-view="${esc(s.id)}" title="Ver la replay">▶</button></div>`; }).join('')}</div></div>
        ${rowsCard('Cómo te abren', r.oppLeads.slice(0, 8), pairLabel, 'Sin datos.', 'foplead', '<p class="note" style="margin:-4px 0 8px">Todos los rivales: sus leads y cómo te va contra ellos.</p>')}
      </div>`;
  }

  /* ---------- Tu equipo ---------- */
  function equipo(ms) {
    const r = Stats.compute(ms);
    const sets = (DASH.teamSets && DASH.teamSets.sets) || [];
    const species = sets.length ? sets.map(m => m.species) : r.myMons.slice(0, 6).map(x => x.key);
    if (!species.length) return '<div class="card"><p class="note">Elige tu equipo al empezar la sesión y aquí verás cómo rinde cada Pokémon.</p></div>';
    const cards = Stats.teamCards(ms, species);
    const pctBar = (v, c = '') => `<span class="dpb ${c}"><i style="width:${Math.round(v * 100)}%"></i><em>${Math.round(v * 100)}%</em></span>`;
    const bar2 = (label, v, sub = '', c = '') => `<div class="dtbar"><span>${label}</span><i><b class="${c}" style="width:${Math.max(0, Math.min(100, v))}%"></b></i><em>${Math.round(v)}%</em>${sub ? `<small>${sub}</small>` : ''}</div>`;
    return `<h3 class="dsec">Cómo rinde cada Pokémon</h3><div class="dtcards3">${cards.map((c, i) => {
          const set = sets[i];
          const used = new Map(c.moves);
          const list = set ? set.moves.filter(Boolean).map(mv => [mv, used.get(mv) || 0]) : c.moves.slice(0, 4);
          const mx = Math.max(1, ...list.map(x => x[1]));
          const mega = set && /ite( [XY])?$/.test(set.item || '') && set.item !== 'Eviolite';
          return `<div class="mtc dtc3"><div class="mthead">${spr(c.key, 'big')}<div><b class="nolang">${esc(c.key)}</b><div class="tytags">${typesOf(c.key).map(P.typeBadge).join('')}</div></div>
              <div class="dtc3wr"><b class="${cls(c)}">${pc(c)}</b><small><span>ganas cuando lo llevas</span>${c.n ? ` <span>(${c.w} de ${c.n})</span>` : ''}</small></div></div>
            ${bar2('Lo llevas', c.broughtPct * 100, `en ${c.n} de ${ms.length} partidas`)}
            ${bar2('Abre', c.leadPct * 100, `en ${c.lead} de ${ms.length} partidas`)}
            ${mega ? `<p class="dtmega">${c.mega.n ? `Con mega: ganas el ${wrp(c.mega)}% de ${c.mega.n} ${c.mega.n === 1 ? 'partida' : 'partidas'}` : 'Aún no ha megaevolucionado'}</p>` : ''}
            <div class="dlabel">Cuántas partidas usa cada movimiento</div>
            <div class="dtmv">${list.map(([mv, n]) => { const d = P.moveOf(mv); return `<div><span class="tmv t-${esc(d ? d.type : '')}${d && d.category === 'Status' ? ' st' : ''}">${esc(mv)}</span><i><b style="width:${(n / mx) * 100}%"></b></i><em>${n}</em></div>`; }).join('')}</div></div>`;
        }).join('')}</div>
      ${(() => {
        const a = Stats.advanced(ms);
        const sel = D.mon && a.mons.some(x => x.key === D.mon) ? D.mon : (a.mons[0] || {}).key;
        const mon = a.mons.find(x => x.key === sel);
        return `<div class="grid dgrid">${rowsCard('Con quién funciona', a.pairs.slice(0, 8), pairLabel, 'Hacen falta al menos 2 partidas con la misma pareja.', '', '<p class="note" style="margin:-4px 0 8px">Cuando van juntos en la partida.</p>')}
          <div class="card dwide2"><h2>Contra quién brilla y contra quién sufre</h2><div class="rvstrip">${a.mons.map(x => `<button class="rvchip${x.key === sel ? ' on' : ''}" data-dmon="${esc(x.key)}">${spr(x.key, 'sm')}<span><b class="nolang">${esc(x.key)}</b></span></button>`).join('')}</div>
            ${mon ? `<div class="dbs"><div><h4 class="okc">Brilla contra</h4>${mon.best.length ? `<div class="rows">${rowHead}${mon.best.map(x => wrRow(x, monLabel(x))).join('')}</div>` : '<p class="note">Pocas partidas aún.</p>'}</div><div><h4 class="badc">Sufre contra</h4>${mon.worst.length ? `<div class="rows">${rowHead}${mon.worst.map(x => wrRow(x, monLabel(x))).join('')}</div>` : '<p class="note">Pocas partidas aún.</p>'}</div></div>` : '<p class="note">Sin datos.</p>'}</div></div>`;
      })()}
      <div class="grid dgrid">${rowsCard('Tus parejas de leads', r.myLeads.slice(0, 10), pairLabel, 'Sin datos.', 'flead', '<p class="note" style="margin:-4px 0 8px">De más a menos jugadas.</p>')}
        <div class="card"><h2>¿Abriendo o desde atrás?</h2>${(() => { const a = Stats.advanced(ms); return a.mons.length ? `<table class="lb"><thead><tr><th></th><th>De lead</th><th>De reserva</th></tr></thead><tbody>${a.mons.slice(0, 8).map(m => `<tr><td>${spr(m.key, 'sm')}${esc(m.key)}</td><td>${m.lead.n ? `<b>${wrp(m.lead)}%</b> <small>${m.lead.n}</small>` : '—'}</td><td>${m.back.n ? `<b>${wrp(m.back)}%</b> <small>${m.back.n}</small>` : '—'}</td></tr>`).join('')}</tbody></table>` : '<p class="note">Sin datos.</p>'; })()}</div></div>`;
  }

  /* ---------- Hábitos: cada tarjeta, un dato y lo que significa ---------- */
  function habitos(ms) {
    const H = Stats.habits(ms), r = Stats.compute(ms), a = Stats.advanced(ms);
    const d = (x, y) => (x.n >= 3 && y.n >= 3 ? wrp(x) - wrp(y) : null);
    const verdict = (t, c = '') => `<p class="hverd ${c}">${t}</p>`;
    const few = verdict('Aún hay pocas partidas para saberlo.', 'mut');
    const row = x => `<div class="hrow"><span>${esc(x.key)}</span><em class="${x.delta > 0 ? 'okc' : 'badc'}">${x.delta > 0 ? '+' : ''}${x.delta} pts</em><b>${Math.round((x.w / x.n) * 100)}%</b><small>${x.n} partida${x.n === 1 ? '' : 's'}</small></div>`;
    const two = (x, y) => `<div class="htwo"><div><small>${esc(x.key)}</small><b class="${cls(x)}">${pc(x)}</b><i>${x.n} partida${x.n === 1 ? '' : 's'}</i></div><div><small>${esc(y.key)}</small><b class="${cls(y)}">${pc(y)}</b><i>${y.n} partida${y.n === 1 ? '' : 's'}</i></div></div>`;
    // Hora y día
    const bh = a.hours.filter(h => h.n >= 3).sort((x, y) => wrp(y) - wrp(x))[0];
    const days = a.days, dd = days.filter(h => h.n >= 3).sort((x, y) => wrp(y) - wrp(x));
    const DL = EN() ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    // Tras perder
    const dl = d(a.afterLoss, a.afterWin);
    // Sesiones largas
    const ds = d(a.late, a.early);
    // Cortas o largas (7 turnos o menos)
    const sh = { key: '7 turnos o menos', n: 0, w: 0 }, lg = { key: 'Más de 7 turnos', n: 0, w: 0 };
    for (const s of ms) { const x = (s.turns || 0) <= 7 ? sh : lg; x.n++; if (s.result === 'win') x.w++; }
    const dsl = d(lg, sh);
    // Con él / sin él
    const keyMons = a.mons.filter(m => m.n >= 3 && m.without.n >= 3).map(m => ({ key: m.key, w: m, wo: m.without, delta: wrp(m) - wrp(m.without) })).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
    const un = unusedMoves(a);
    return `${H.n < 30 ? `<div class="warnbox hprog"><span><b>Con 30 partidas se ve claro qué te hace ganar o perder.</b> <span>Llevas ${H.n}: de momento son pistas, no conclusiones.</span></span><i><b style="width:${Math.min(100, (H.n / 30) * 100)}%"></b></i></div>` : ''}
      <p class="note hbase">Tu media: ${Math.round(H.base * 100)}% de victorias. Al lado, cuánto más o menos ganas en cada caso.</p>
      <div class="dgrid2">
        <div class="card"><h2 class="okh2">Lo que más te hace ganar</h2>${H.win.map(row).join('') || '<p class="note">Nada destaca todavía.</p>'}</div>
        <div class="card"><h2 class="badh2">Lo que más te hace perder</h2>${H.lose.map(row).join('') || '<p class="note">Nada destaca todavía.</p>'}</div>
      </div>
      <div class="hgrid">
        <div class="card"><h2>Tu mejor hora</h2>${vbars(a.hours, h => h.key.replace(' h', '').split('–')[0])}${bh ? verdict(`Rindes mejor de ${esc(bh.key)}: ${wrp(bh)}% en ${bh.n} partidas.`, 'ok') : few}</div>
        <div class="card"><h2>Por día de la semana</h2>${vbars(days, (h, i) => DL[i])}${dd.length >= 2 ? verdict(`Tu mejor día: <b>${esc(dd[0].key)}</b> (${wrp(dd[0])}%). El peor: <b>${esc(dd[dd.length - 1].key)}</b> (${wrp(dd[dd.length - 1])}%).`) : few}</div>
        <div class="card"><h2>Después de perder</h2>${two(a.afterWin, a.afterLoss)}${dl == null ? few : dl <= -8 ? verdict(`Tras una derrota ganas ${-dl} puntos menos. Respira un momento antes de buscar la siguiente.`, 'bad') : verdict('Las derrotas no te arrastran: en la siguiente rindes igual.', 'ok')}</div>
        <div class="card"><h2>Sesiones largas</h2>${two(a.early, a.late)}${ds == null ? few : ds <= -8 ? verdict(`Desde la 6.ª partida de la sesión bajas ${-ds} puntos: el cansancio cuenta.`, 'bad') : verdict('Aguantas bien las sesiones largas.', 'ok')}</div>
        <div class="card"><h2>Cortas o largas</h2>${two(sh, lg)}${dsl == null ? few : dsl >= 10 ? verdict('Ganas más cuando la partida se alarga: tu fuerte es el final.', 'ok') : dsl <= -10 ? verdict('Ganas más cuando la partida es rápida: tu fuerte es el principio.', 'ok') : verdict('Rindes igual en partidas cortas y largas.')}</div>
        <div class="card"><h2>En el Bo3</h2>${a.bo3.n ? `<div class="htwo three"><div><small>Ganas la G1</small><b class="${cls(a.bo3.g1)}">${pc(a.bo3.g1)}</b></div><div><small>Cierras tras ganar la G1</small><b class="${cls(a.bo3.closeAfterG1)}">${pc(a.bo3.closeAfterG1)}</b></div><div><small>Remontas tras perder la G1</small><b class="${cls(a.bo3.comeback)}">${pc(a.bo3.comeback)}</b></div></div>
          ${verdict(`De ${a.bo3.n} sets terminados ganas ${a.bo3.w} (${wrp(a.bo3)}%).`)}` : '<p class="note">Sin series Bo3 todavía.</p>'}</div>
        <div class="card"><h2>Con él o sin él</h2>${keyMons.length ? `<div class="hcon"><div class="hconh"><span></span><span>Con él</span><span>Sin él</span><span></span></div>${keyMons.slice(0, 6).map(k => `<div class="hconr"><span>${spr(k.key, 'xs')}<b class="nolang">${esc(k.key)}</b></span><b class="${cls(k.w)}">${pc(k.w)}</b><b class="${cls(k.wo)}">${pc(k.wo)}</b><em class="${k.delta > 0 ? 'okc' : 'badc'}">${k.delta > 0 ? '+' : ''}${k.delta}</em></div>`).join('')}</div>
          ${keyMons[0].delta >= 10 ? verdict(`<b class="nolang">${esc(keyMons[0].key)}</b>: <span>${keyMons[0].delta} puntos más cuando lo llevas. Es una pieza clave.</span>`, 'ok') : keyMons[0].delta <= -10 ? verdict(`<b class="nolang">${esc(keyMons[0].key)}</b>: <span>${-keyMons[0].delta} puntos más cuando no lo llevas. Plantéate si te compensa sacarlo.</span>`, 'bad') : verdict('Ninguno cambia mucho tu resultado por sí solo.')}` : few}</div>
        <div class="card"><h2>Movimientos que nunca usas</h2>${un.length ? `<ul class="ins">${un.map(t => `<li class="nolang">${esc(t)}</li>`).join('')}</ul>${verdict('Quizá te sirva más otro movimiento en su lugar.')}` : verdict(ms.length >= 5 ? 'Usas todos los movimientos de tu equipo.' : 'Aún hay pocas partidas para saberlo.', ms.length >= 5 ? 'ok' : 'mut')}</div>
        <div class="card elo hwide"><h2>ELO</h2>${eloChart(r.elo)}</div>
      </div>`;
  }

  /* ---------- pintar ---------- */
  function paint() {
    const el = $('#v-dash');
    const top = el.scrollTop;
    const info = scopeInfo();
    const seg = `<div class="seg dscope" role="group" title="Qué partidas cuentan">${info.session ? `<button data-f="scope" data-val="session" aria-pressed="${F.scope === 'session'}">Esta sesión</button>` : ''}${info.team ? `<button data-f="scope" data-val="team" aria-pressed="${F.scope === 'team'}">Todo el equipo</button>` : ''}<button data-f="scope" data-val="all" aria-pressed="${F.scope === 'all' || (!info.session && !info.team)}">Todas</button></div>`;
    const sub = info.session ? `<span>${F.scope === 'all' ? 'Todas tus partidas' : F.scope === 'team' ? `Todas las sesiones de <span class="nolang">${esc(info.team)}</span>` : `<span class="nolang">${esc(info.session.name)}</span>${info.session.goal ? ` · Objetivo: <span class="nolang">${esc(info.session.goal)}</span>` : ''}`}</span>` : '<span>Todas tus partidas</span>';
    if (!M.length) { el.innerHTML = `<div class="head"><div><h1>Dash<span>board</span></h1></div></div>${emptyState()}`; return; }
    const ids = scopeIds();
    const base = Stats.usable(M).filter(s => !ids || ids.has(s.id));
    const ms = Stats.filter(M, { ...F, ids });
    const unknown = M.length - Stats.usable(M).length;
    // En Partidas, con el filtro de marcas se ve el Bo3 entero si alguna de sus partidas cumple.
    let games = ms;
    if (F.mark) {
      const all = Stats.filter(M, { ...F, ids, mark: '' }), hit = new Set(ms.map(s => s.id));
      games = groupBo3(all).filter(g => g.games.some(s => hit.has(s.id))).flatMap(g => g.games);
    }
    const body = D.tab === 'games' ? partidas(games) : D.tab === 'riv' ? rivales(ms) : D.tab === 'team' ? equipo(ms) : D.tab === 'hab' ? habitos(ms) : resumen(ms);
    el.innerHTML = `<div class="head"><div><h1>Dash<span>board</span></h1><p class="note" style="margin-top:4px">${sub}</p></div><div class="row-btns" style="margin:0">${seg}<button class="btn sm" data-go="doc" title="Documento de preparación">PDF</button></div></div>
      <div class="seg dtabs">${TABS.map(([k, l]) => `<button data-dtab="${k}" aria-pressed="${D.tab === k}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICO[k]}</svg>${l}</button>`).join('')}</div>
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
    const t = e.target.closest('button,[data-set],[data-frival],[data-flead],[data-foplead],[data-rv]');
    if (!t) return;
    const d = t.dataset;
    if (d.view) { e.stopPropagation(); Viewer.open(d.view); return; }
    if (d.dtab) { D.tab = d.dtab; try { localStorage.setItem('msDashTab', D.tab); } catch (x) { /* nada */ } $('#v-dash').scrollTop = 0; paint(); return; }
    if (d.dcal) { F.days = F.days === -1 ? 0 : -1; if (F.days !== -1) { F.from = 0; F.to = 0; } paint(); return; }
    if (d.frival) { F.rival = d.frival; paint(); return; }
    if (d.flead) { F.lead = d.flead; paint(); return; }
    if (d.foplead) { F.oppLead = d.foplead; paint(); return; }
    if (d.rv) { D.rv = d.rv; paint(); return; }
    if (d.dmon) { D.mon = d.dmon; paint(); return; }
    if (d.rvonly) { F.rival = d.rvonly; D.tab = 'games'; $('#v-dash').scrollTop = 0; paint(); return; }
    if (d.set) openSet(d.set.split(','));
  });
  $('#v-dash').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.set) openSet(e.target.dataset.set.split(',')); });
  $('#v-dash').addEventListener('change', e => {
    if (e.target.id === 'rvFind') {
      const v = e.target.value.trim().toLowerCase(), base = Stats.usable(M);
      const all = Stats.compute(base).oppPreview.map(x => x.key);
      const hit = all.find(k => k.toLowerCase() === v) || all.find(k => k.toLowerCase().startsWith(v));
      if (hit) { D.rv = hit; D.rvMsg = ''; } else D.rvMsg = `No has jugado contra ${e.target.value.trim()} todavía.`;
      paint(); return;
    } if (e.target.dataset && e.target.dataset.fn === 'minElo') { F.minElo = Math.max(0, +e.target.value || 0); paint(); } });

  return { render: renderSoon, paint, state: D };
})();
