'use strict';
/*
 * Macar Showdown · visor de replays.
 * La partida guardada se ve dentro de la app con el reproductor oficial de Showdown (msreplay://, servido desde
 * el registro guardado: no hace falta haberla subido). Al lado: leads y reserva de los dos y las notas de la
 * partida, con marcas de turno [T5] que saltan a ese momento. Arranca en silencio (botón del altavoz).
 */
/* global api, esc, spr, pill, fmtDate, Transcript, P, I18N, NoteHL, CalcReplay, teamOf, SET, Stats */

const Viewer = (() => {
  const SPEEDS = [['hyperfast', 'Muy rápida'], ['fast', 'Rápida'], ['normal', 'Normal'], ['slow', 'Lenta']];
  let V = null; // { id, s, timer, ready, turn, speed }
  let muted = true; // las replays empiezan sin sonido
  const MUTE_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
  const MUTE_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
  const web = () => document.querySelector('#rvWeb');
  function applyMute() {
    const w = web();
    try { if (w) w.setAudioMuted(muted); } catch (e) { /* aún no ha cargado */ }
    const b = document.querySelector('#rvMute');
    if (b) { b.innerHTML = muted ? MUTE_ON : MUTE_OFF; b.title = muted ? 'Sin sonido: pulsa para activarlo' : 'Silenciar'; b.classList.toggle('on', !muted); }
  }
  /** Ejecuta algo en el reproductor de Showdown (solo cuando ya ha cargado). */
  async function run(js) {
    const w = web();
    if (!w || !V || !V.ready) return null;
    try { return await w.executeJavaScript(`(() => { try { return ${js}; } catch (e) { return null; } })()`); } catch (e) { return null; }
  }

  function playerHTML() {
    const turns = V.s.turns || 0;
    return `<webview id="rvWeb" partition="persist:replay" src="msreplay://r/${esc(V.id)}"></webview>
      <div class="rvbar">
        <button class="btn sm" data-rv="prev" title="Turno anterior">⏮</button><button class="btn sm primary" data-rv="play" id="rvPlay">▶ Play</button><button class="btn sm" data-rv="next" title="Turno siguiente">⏭</button>
        <div class="rvturns">${Array.from({ length: turns + 1 }, (_, t) => `<button class="rvt" data-rvturn="${t}" title="${t ? `Turno ${t}` : 'Inicio del combate'}">${t || '0'}</button>`).join('')}</div>
        <select id="rvSpeed" title="Velocidad">${SPEEDS.map(([k, l]) => `<option value="${k}"${k === V.speed ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <button class="btn sm" data-rv="side" title="Ver la partida desde el otro lado">⇄ Lados</button>
        <button class="btn sm rvpredbtn" data-rv="pred" id="rvPredBtn" title="Modo predicción: la replay se para al empezar cada turno, apuntas qué harías tú y qué hará el rival, y luego lo ves">🎯 Predecir</button>
        <button class="btn sm ibtn mute" data-rv="mute" id="rvMute"></button>
      </div>
      <div class="rvpred hide" id="rvPred"></div>
      <div class="rvtx nolang" id="rvTx">${txHTML()}</div>
      <div class="rvnotes">
        <div class="rvnhead"><h3>Notas</h3><button class="btn sm primary" id="rvMark">+ Nota en el turno 0</button><span class="note">Pulsa una línea que empiece por [T5] para saltar a ese turno.</span><span class="rvlegend"><i class="bad">${tt('Rojo: mal hecho', 'Red: done badly')}</i><i class="good">${tt('Verde: bien hecho', 'Green: done well')}</i></span><span style="flex:1"></span><span class="note" id="rvSaved"></span></div>
        <textarea id="rvNotes" placeholder="Pulsa «+ Nota» o una línea de la transcripción para apuntar con el turno de la replay…">${esc(V.notes)}</textarea>
      </div>`;
  }

  /* ---------- hoja de equipo (OTS): la del rival por defecto, con pestaña para ver la tuya ---------- */
  function otsHTML() {
    const s = V.s, me = s.me || 'p1', opp = s.opp || (me === 'p1' ? 'p2' : 'p1');
    const sd = V.otsSide === 'me' ? me : opp;
    const x = s[sd] || {};
    // Primero el análisis (si la partida es tuya) y luego las hojas de equipo.
    const tabs = `<div class="seg rvotstabs">${[...(s.me ? [['rev', tt('Análisis', 'Analysis')]] : []), ['foe', s.me ? tt('Hoja rival', 'Rival sheet') : tt('Jugador 2', 'Player 2')], ['me', s.me ? tt('Tu hoja', 'Your sheet') : tt('Jugador 1', 'Player 1')]].map(([k, l]) => `<button data-rvots="${k}" aria-pressed="${(V.otsSide || 'foe') === k}">${l}</button>`).join('')}</div>`;
    // Arriba los leads, en medio la reserva y al final los que no salieron.
    const id = n => P.toID(P.baseSpecies(n));
    const isLead = n => (x.leads || []).some(b => id(b) === id(n)), isIn = n => (x.brought || []).some(b => id(b) === id(n));
    const grp = n => (isLead(n) ? 0 : isIn(n) ? 1 : 2);
    const LBL = [tt('Leads', 'Leads'), tt('Reserva', 'Back'), tt('No salieron', 'Not brought')];
    const groups = list => [0, 1, 2].map(g => ({ g, list: list.filter(o => grp(o.n) === g) })).filter(o => o.list.length);
    let body;
    if (V.otsSide === 'rev' && s.me) body = reviewHTML();
    else if (x.sheet && x.sheet.length) {
      body = groups(x.sheet.map(m => ({ n: m.species, m }))).map(({ g, list }) => `<div class="rvgrp g${g}"><small>${LBL[g]}</small><div class="shgrid">${list.map(({ m }) => P.sheetCard(m, { abbr: true, played: g < 2 })).join('')}</div></div>`).join('');
    } else {
      const seen = x.moves || {};
      body = groups((x.preview && x.preview.length ? x.preview : x.brought || []).map(n => ({ n }))).map(({ g, list }) => `<div class="rvgrp g${g}"><small>${LBL[g]}</small><div class="otsgrid nolang">${list.map(({ n }) => {
        const k = Object.keys(seen).find(y => id(y) === id(n));
        return `<div class="otsmon${g < 2 ? '' : ' out'}">${spr(n, 'sm')}<div><b>${esc(n)}</b><small>${k && seen[k].length ? seen[k].map(esc).join(' · ') : tt('sin movimientos vistos', 'no moves seen')}</small></div></div>`;
      }).join('')}</div></div>`).join('') + `<p class="note otsnone">${tt('Sin hoja de equipo (CTS): solo lo que se vio.', 'No team sheet (CTS): only what was seen.')}</p>`;
    }
    const open = V.otsOpen !== false;
    // Escondida, la columna se queda en una pestaña estrecha y la replay gana todo ese sitio.
    if (!open) return `<button class="rvsidetab" data-rvotsopen="1" title="${tt('Sacar el análisis y la hoja de equipo', 'Show the analysis and the team sheet')}">▶ ${s.me ? tt('Análisis y hoja', 'Analysis and sheet') : tt('Hoja de equipo', 'Team sheet')}</button>`;
    return `<div class="rvotshead">${tabs}<span style="flex:1"></span><button class="btn sm ibtn" data-rvotsopen="1" title="${tt('Esconder la columna: más sitio para la replay', 'Hide the column: more room for the replay')}">▶</button></div>${body}`;
  }

  /* ---------- análisis: por qué ha ido así (tu método), lo que te llevas y los momentos clave ---------- */
  // Preguntas guía de cada motivo, para pensarlo al repasar la partida.
  const GUIDE = {
    team: ['¿Le falta algo al equipo contra esto? Plantéate cambiar un Pokémon, un set o el reparto (Team Selection).', 'Is the team missing something against this? Consider changing a Pokémon, a set or the spread (Team Selection).'],
    preview: ['¿Elegiste bien los 4 y los leads? Mejora el plan del matchup en Matchups.', 'Did you pick the right 4 and leads? Improve the matchup plan in Matchups.'],
    mechanic: ['¿Qué mecánica no conocías (p. ej. Hyper Voice contra Soundproof)? Léela, apúntala y conoce bien las de tu equipo.', 'Which mechanic did you not know (e.g. Hyper Voice into Soundproof)? Read it, write it down and know your own team\'s mechanics.'],
    expect: ['Jugaste pensando en otro set, objeto o reparto (p. ej. Scarf y era Focus Sash). ¿Hubo señales? Equilibra lo que supones con lo que ves en la partida.', 'You played around another set, item or spread (e.g. Scarf and it was Focus Sash). Were there signs? Balance what you assume with what the game shows.'],
    predict: ['Predijiste de más. ¿Hacía falta o había una jugada más segura? Míralo desde el lado del rival: ¿por qué hizo esa jugada?', 'You over-predicted. Was it needed, or was there a safer play? Look from the rival\'s side: why did they make that play?'],
    macro: ['No tuviste en cuenta el plan general (p. ej. cambiaste a Garchomp por Sneasler y te quedaste sin respuesta a Charizard). ¿Qué te habría dejado mejor en los turnos siguientes? ¿Cuándo cambió la partida?', 'You lost sight of the game plan (e.g. traded Garchomp for Sneasler and had no answer to Charizard). What would have kept you better placed later? When did the game turn?'],
    detail: ['¿Qué detalle se te escapó (Tailwind, Trick Room, un objeto…)? ¿Pasó algo raro que lo provocó? Apúntalo y juega concentrado.', 'Which detail did you miss (Tailwind, Trick Room, an item…)? Did something unusual cause it? Write it down and play focused.'],
    play: ['Otro error al jugar: apúntalo y apréndelo para la próxima.', 'Another playing mistake: write it down and learn it for next time.'],
    luck: ['Críticos, fallos, efectos… Sigue jugando.', 'Crits, misses, effects… Keep playing.'],
    other: ['Sigue jugando.', 'Keep playing.'],
    gplay: ['¿Qué jugada salió bien y por qué? Apúntala para repetirla.', 'Which play worked and why? Write it down to repeat it.'],
    gpredict: ['Leíste bien al rival: ¿qué te dio la pista?', 'You read the rival well: what gave it away?'],
    gplan: ['El plan funcionó (leads, los 4, cómo cerrar): llévalo a Matchups.', 'The plan worked (leads, the 4, how to close): take it to Matchups.'],
    gteam: ['El equipo respondió bien a esto: ¿qué Pokémon, set o reparto lo hizo?', 'The team handled this well: which Pokémon, set or spread did it?']
  };
  const GROUPS = [['El equipo', 'The team'], ['Al jugar', 'While playing'], ['Ni lo uno ni lo otro', 'Neither'], ['Bien hecho', 'Done well']];
  const wLabel = w => tt(w.es, w.en);
  /** «Apuntar»: en qué turno (o general), qué tipo (mal o bien hecho) y el texto. Va a las notas en rojo o verde. */
  function addHTML() {
    const A = V.add, W = Stats.ALL, w = W.find(x => x.k === A.k);
    const opt = g => W.filter(x => x.g === g).map(x => `<option value="${x.k}"${x.k === A.k ? ' selected' : ''}>${wLabel(x)}</option>`).join('');
    return `<div class="rvadd${w ? (w.g === 3 ? ' good' : ' bad') : ''}">
      <div class="rvaddrow"><div class="seg rvwhere">${[['turn', `${tt('Turno', 'Turn')} <span id="rvAddTurn">${V.turn || 0}</span>`], ['gen', tt('General', 'General')]].map(([k, l]) => `<button data-rvwhere="${k}" aria-pressed="${A.where === k}" title="${k === 'turn' ? tt('En el turno que estás viendo en la replay', 'At the turn you are watching in the replay') : tt('Sobre la partida entera, sin turno', 'About the whole game, no turn')}">${l}</button>`).join('')}</div>
        <select id="rvAddK" title="${tt('Rojo: mal hecho · Verde: bien hecho', 'Red: done badly · Green: done well')}"><option value="">${tt('Elige qué es…', 'Choose what it is…')}</option><optgroup label="${tt('✗ Mal hecho', '✗ Done badly')}">${opt(0)}${opt(1)}${opt(2)}</optgroup><optgroup label="${tt('✓ Bien hecho', '✓ Done well')}">${opt(3)}</optgroup></select></div>
      ${w ? `<p class="rvaddguide">${esc(tt(...GUIDE[w.k]))}</p>` : ''}
      <textarea id="rvAddTxt" rows="2" placeholder="${tt('Qué pasó y qué harías la próxima vez…', 'What happened and what you would do next time…')}">${esc(A.text)}</textarea>
      <div class="row-btns"><button class="btn sm primary" data-rvadd="1"${w ? '' : ' disabled'}>${tt('Añadir a las notas', 'Add to the notes')}</button><span class="note" id="rvAddMsg">${esc(A.msg || '')}</span></div></div>`;
  }
  /** Lo que ya has apuntado (las líneas de análisis de las notas), en su color. */
  function tagsHTML() {
    const L = Stats.tagsOf(V.notes);
    const bad = L.filter(t => !t.good).length, good = L.length - bad;
    if (!L.length) return `<p class="note">${tt('Aún nada. Lo que apuntes sale aquí y en las notas: en rojo lo mal hecho, en verde lo bien hecho.', 'Nothing yet. What you write shows here and in the notes: red for done badly, green for done well.')}</p>`;
    return `<p class="rvtagsum"><span class="bad">✗ ${bad}</span><span class="good">✓ ${good}</span></p><div class="rvtags">${L.map(t => `<button class="rvtag ${t.good ? 'good' : 'bad'}"${t.turn != null ? ` data-rvturn="${t.turn}"` : ' data-rvnoop="1"'} title="${t.turn != null ? tt('Ir a ese turno', 'Go to that turn') : tt('Nota general', 'General note')}"><b>${t.turn != null ? `T${t.turn}` : tt('Gen.', 'Gen.')}</b><i>${esc(t.label)}</i><span class="nolang">${esc(t.text)}</span></button>`).join('')}</div>`;
  }
  function reviewHTML() {
    const r = V.review || { why: [], lesson: '' }, on = new Set(r.why || []);
    const notesWhy = Stats.whyOf({ notes: V.notes }), lost = V.s.result === 'loss';
    const W = Stats.ALL;
    const chips = [0, 1, 2, 3].map(g => `<div class="rvwg${g === 3 ? ' good' : ''}"><small>${tt(...GROUPS[g])}</small><div class="rvwchips">${W.filter(w => w.g === g).map(w => `<button class="rvw${g === 3 ? ' good' : ''}${on.has(w.k) ? ' on' : ''}${!on.has(w.k) && notesWhy.has(w.k) ? ' innotes' : ''}" data-rvwhy="${w.k}" aria-pressed="${on.has(w.k)}" title="${esc(tt(...GUIDE[w.k]))}">${wLabel(w)}</button>`).join('')}</div></div>`).join('');
    const km = V.km || [];
    const mine = side => side && side === (V.s.me || 'p1');
    const nm = n => `<span class="nolang">${esc(n || '')}</span>`;
    const kmText = k => {
      const who = k.sp ? `${nm(k.sp)}${k.side ? ` <i class="rvkside${mine(k.side) ? ' me' : ''}">${mine(k.side) ? tt('tuyo', 'yours') : tt('rival', 'rival')}</i>` : ''}` : '';
      if (k.t === 'ko') return `${tt('KO', 'KO')}: ${who}${k.by ? ` · ${nm(k.move)} ${tt('de', 'by')} ${nm(k.by)}` : ''}`;
      if (k.t === 'crit') return `${tt('Crítico', 'Crit')}: ${nm(k.move)} ${tt('de', 'by')} ${who}${k.on ? ` → ${nm(k.on)}` : ''}`;
      if (k.t === 'miss') return `${tt('Falla', 'Miss')}: ${nm(k.move)} ${tt('de', 'by')} ${who}`;
      if (k.t === 'cant') return `${tt('No se mueve', 'Can\'t move')}: ${who} (${nm(k.what)})`;
      if (k.t === 'item') return `${tt('Objeto', 'Item')}: ${nm(k.what)} · ${who}`;
      if (k.t === 'ability') return `${tt('Habilidad', 'Ability')}: ${nm(k.what)} · ${who}`;
      if (k.t === 'mega') return `${tt('Mega', 'Mega')}: ${who}`;
      return `${nm(k.what)}${k.side ? ` <i class="rvkside${mine(k.side) ? ' me' : ''}">${mine(k.side) ? tt('tu lado', 'your side') : tt('su lado', 'their side')}</i>` : ''}`;
    };
    const KCLS = { ko: 'ko', crit: 'luck', miss: 'luck', cant: 'luck', item: 'info', ability: 'info', mega: 'info', field: 'field' };
    const done = (V.s.mark || {}).a === 'done';
    return `<div class="rvrev">
      <h4><i class="rvstep">1</i>${tt('Apunta lo que ves', 'Write down what you see')} <span class="note">${tt('turno a turno o en general', 'turn by turn or in general')}</span></h4>
      ${addHTML()}
      <h4><i class="rvstep">2</i>${tt('Tus apuntes', 'Your notes')} <span class="note">${tt('pulsa para ir al turno', 'click to go to the turn')}</span></h4>
      <div id="rvTags">${tagsHTML()}</div>
      <h4><i class="rvstep">3</i>${lost ? tt('¿Por qué has perdido?', 'Why did you lose?') : tt('¿Qué ha decidido la partida?', 'What decided the game?')} <span class="note">${tt('para tus estadísticas', 'for your stats')}</span></h4>
      ${chips}
      <p class="note">${tt('Si no es ninguno de estos, suele ser el equipo. Con borde discontinuo: ya está en tus notas.', 'If it is none of these, it is usually the team. Dashed border: already in your notes.')}</p>
      <label class="field">${tt('Lo que te llevas', 'What you take away')}<textarea id="rvLesson" rows="2" placeholder="${tt('Una frase para recordar la próxima vez…', 'One sentence to remember next time…')}">${esc(r.lesson || '')}</textarea></label>
      <div class="row-btns"><button class="btn sm${done ? ' on' : ''}" data-rvdone="1">${done ? tt('✓ Analizada', '✓ Analysed') : tt('Marcar como analizada', 'Mark as analysed')}</button><span class="note" id="rvRevSaved"></span></div>
      <h4>${tt('Momentos clave', 'Key moments')} <span class="note">${tt('del registro · pulsa para ir al turno', 'from the log · click to go to the turn')}</span></h4>
      ${km.length ? `<div class="rvkm">${km.map(k => `<button class="rvk ${KCLS[k.t] || ''}" data-rvturn="${k.turn}"><b>T${k.turn}</b><span>${kmText(k)}</span></button>`).join('')}</div>` : `<p class="note">${tt('Nada destacado en el registro.', 'Nothing notable in the log.')}</p>`}
    </div>`;
  }
  /** Añade la nota de análisis: las de turno, en su sitio por orden de turnos; las generales, arriba. */
  function addTag() {
    const A = V.add, w = Stats.ALL.find(x => x.k === A.k);
    if (!w) return;
    const text = String(A.text || '').trim().replace(/\s*\n\s*/g, ' ');
    const turn = A.where === 'turn' ? V.turn || 0 : null;
    const line = `${turn != null ? `[T${turn}] ` : ''}${wLabel(w)}: ${text}`;
    const L = V.notes ? V.notes.split('\n') : [];
    let at;
    if (turn == null) { at = 0; while (at < L.length && Stats.tagOf(L[at]) && Stats.tagOf(L[at]).turn == null) at++; }
    else {
      at = L.length;
      for (let i = L.length - 1; i >= 0; i--) { const m = L[i].match(/^\s*\[T(\d+)\]/); if (m && +m[1] > turn) at = i; else if (m) break; }
    }
    L.splice(at, 0, line);
    V.notes = L.join('\n').replace(/\n+$/, '');
    const ta = document.querySelector('#rvNotes');
    if (ta) { ta.value = V.notes; NoteHL.sync(ta); }
    A.text = ''; A.msg = tt('Añadida a las notas', 'Added to the notes');
    save();
    redrawOts();
  }
  let revTimer = null;
  function saveReview() {
    clearTimeout(revTimer);
    const id = V.id, r = { why: [...(V.review.why || [])], lesson: V.review.lesson || '' };
    revTimer = setTimeout(async () => {
      await api.setReview(id, r);
      const x = typeof M !== 'undefined' && Array.isArray(M) ? M.find(y => y.id === id) : null;
      if (x) x.review = r.why.length || r.lesson.trim() ? r : null;
      const el = document.querySelector('#rvRevSaved'); if (el) el.textContent = tt('Guardado', 'Saved');
    }, 500);
  }
  const redrawOts = () => { const el = document.querySelector('#rvOts'); if (el) el.innerHTML = otsHTML(); };

  /* ---------- transcripción: la partida entera, turno a turno, con sprites ---------- */
  const EN = () => typeof I18N !== 'undefined' && I18N.lang === 'en';
  const tt = (es, en) => (EN() ? en : es);
  const ST = { brn: ['quemado', 'burned'], par: ['paralizado', 'paralyzed'], slp: ['dormido', 'asleep'], frz: ['congelado', 'frozen'], psn: ['envenenado', 'poisoned'], tox: ['gravemente envenenado', 'badly poisoned'] };
  const WX = { SunnyDay: ['Sol', 'Sun'], RainDance: ['Lluvia', 'Rain'], Sandstorm: ['Tormenta de arena', 'Sandstorm'], Snow: ['Nieve', 'Snow'], Snowscape: ['Nieve', 'Snow'], DesolateLand: ['Sol abrasador', 'Harsh sun'], PrimordialSea: ['Diluvio', 'Heavy rain'] };
  const STATN = { Atq: ['Atq', 'Atk'], Def: ['Def', 'Def'], AtE: ['AtE', 'SpA'], DfE: ['DfE', 'SpD'], Vel: ['Vel', 'Spe'] };
  function txHTML() {
    if (!V.tx || !V.tx.length) return `<p class="note">${tt('No hay registro para transcribir.', 'No log to transcribe.')}</p>`;
    const me = V.s.me || 'p1';
    const sideCls = side => (side === me ? 'me' : 'foe');
    const name = w => `${spr(w.sp, 'xs')}<b>${esc(w.sp)}</b>`;
    const pill = (txt, c = '') => `<span class="txp ${c}">${txt}</span>`;
    const fxPill = f => {
      const good = f.who && f.who.side !== me;
      if (f.t === 'dmg') return pill(`${spr(f.who.sp, 'xs')}${f.d}%`, good ? 'ok' : 'bad');
      if (f.t === 'heal') return pill(`${spr(f.who.sp, 'xs')}+${f.d}%${f.from ? ` · ${esc(f.from)}` : ''}`, good ? 'bad' : 'ok');
      if (f.t === 'faint') return pill(`${spr(f.who.sp, 'xs')}KO`, good ? 'okko' : 'badko');
      if (f.t === 'boost') { const sn = STATN[f.stat] ? tt(...STATN[f.stat]) : f.stat; return pill(`${spr(f.who.sp, 'xs')}${f.n > 0 ? '+' : ''}${f.n} ${esc(sn)}`, f.n > 0 ? 'up' : 'dn'); }
      if (f.t === 'crit') return pill(tt('crítico', 'crit'), 'warn');
      if (f.t === 'se') return pill(tt('supereficaz', 'super effective'), 'warn');
      if (f.t === 'res') return pill(tt('poco eficaz', 'resisted'), 'mut');
      if (f.t === 'imm') return pill(`${spr(f.who.sp, 'xs')}${tt('no le afecta', 'immune')}`, 'mut');
      if (f.t === 'miss') return pill(`${spr(f.who.sp, 'xs')}${tt('falla', 'missed')}`, 'mut');
      if (f.t === 'fail') return pill(tt('falla', 'failed'), 'mut');
      if (f.t === 'protect') return pill(`${spr(f.who.sp, 'xs')}${tt('se protege', 'protected')}`, 'mut');
      if (f.t === 'status') return pill(`${spr(f.who.sp, 'xs')}${ST[f.st] ? tt(...ST[f.st]) : esc(f.st)}`, 'warn');
      return '';
    };
    return V.tx.map(t => `<div class="txturn" data-txt="${t.turn}"><button class="txhead" data-txnote="${t.turn}" title="${tt('Apuntar una nota en este turno', 'Write a note at this turn')}"><b>${t.turn ? `${tt('Turno', 'Turn')} ${t.turn}` : tt('Inicio', 'Start')}</b><span>+ ${tt('Nota', 'Note')}</span></button>
      ${t.ev.map(e => {
        let body = '', line = '';
        if (e.k === 'switch') { body = `${name(e.who)}<i class="txv">${e.drag ? tt('sale a la fuerza', 'is dragged out') : tt('entra', 'comes in')}</i>${e.hp != null && e.hp < 100 ? pill(`${Math.round(e.hp)}%`, 'mut') : ''}`; line = `${e.who.sp} ${tt('entra', 'comes in')}`; }
        else if (e.k === 'mega') { body = `${name(e.who)}${pill(tt('megaevoluciona', 'mega evolves'), 'gold')}`; line = `${e.who.sp} ${tt('megaevoluciona', 'mega evolves')}`; }
        else if (e.k === 'move') {
          const d = P.moveOf(e.move);
          const tgt = e.tgt && !(e.tgt.sp === e.who.sp && e.tgt.side === e.who.side) ? `<i class="txa">→</i>${spr(e.tgt.sp, 'xs')}<span class="txt2">${esc(e.tgt.sp)}</span>` : '';
          body = `${name(e.who)}<span class="tmv t-${esc(d ? d.type : '')}${d && d.category === 'Status' ? ' st' : ''}">${esc(e.move)}</span>${tgt}${e.miss ? pill(tt('falla', 'missed'), 'mut') : ''}<span class="txfx">${e.fx.map(fxPill).join('')}</span>`;
          line = `${e.who.sp} · ${e.move}${e.tgt && e.tgt.sp !== e.who.sp ? ` → ${e.tgt.sp}` : ''}`;
        } else if (e.k === 'cant') { const why = { flinch: tt('retrocede', 'flinched'), par: tt('está paralizado', 'is paralyzed'), slp: tt('está dormido', 'is asleep'), frz: tt('está congelado', 'is frozen') }[e.why] || esc(e.why); body = `${name(e.who)}<i class="txv">${tt('no se mueve', 'cannot move')}: ${why}</i>`; line = `${e.who.sp} ${tt('no se mueve', 'cannot move')}`; }
        else if (e.k === 'fx') {
          if (e.t === 'item') body = `${name(e.who)}<i class="txv">${e.eat ? tt('se come', 'eats') : tt('usa', 'uses')}</i>${pill(esc(e.what), 'gold')}`;
          else if (e.t === 'ability') body = `${name(e.who)}${pill(esc(e.what), 'gold')}`;
          else if (e.t === 'note') body = `${name(e.who)}<i class="txv">${esc(e.what)}</i>`;
          else if (e.t === 'dmg' || e.t === 'heal') body = `${name(e.who)}${pill(`${e.t === 'heal' ? '+' : ''}${e.d}%`, (e.t === 'heal') === (e.who.side === me) ? 'ok' : 'bad')}${e.from ? `<i class="txv">${esc(e.from)}</i>` : ''}`;
          else if (e.t === 'boost') body = `${name(e.who)}${fxPill(e)}${e.from ? `<i class="txv">${esc(e.from)}</i>` : ''}`;
          else body = `${name(e.who)}${fxPill(e)}`;
          line = `${e.who ? e.who.sp : ''} ${e.what || e.from || ''}`.trim();
        } else if (e.k === 'field') { const w = WX[e.what] ? tt(...WX[e.what]) : e.what; body = `<span class="txfield">${e.end ? tt('Se acaba', 'Ends') : '⛅'} ${esc(w)}${e.side ? ` (${e.side === me ? tt('tu lado', 'your side') : tt('su lado', 'their side')})` : ''}</span>`; line = w; }
        else if (e.k === 'win') { body = `<span class="txwin">🏆 ${tt('Gana', 'Winner')}: <b>${esc(e.name || '')}</b></span>`; line = ''; }
        if (!body) return '';
        return `<div class="txrow ${e.who ? sideCls(e.who.side) : ''}" data-txline="${esc(line)}" data-txt="${t.turn}" title="${tt('Pulsa para apuntar una nota sobre esto', 'Click to write a note about this')}">${body}</div>`;
      }).join('')}</div>`).join('');
  }

  function draw() {
    const s = V.s, b = s.opp || 'p2';
    const el = document.querySelector('#rvWrap');
    el.innerHTML = `<div class="rv" role="dialog" aria-label="Replay de la partida">
      <header class="rvhead">${pill(s.result)}<b>${s.me ? `vs <span class="nolang">${esc(s[b].name)}</span>` : `<span class="nolang">${esc(s.p1.name)} vs ${esc(s.p2.name)}</span>`}</b>
        <span class="note">${fmtDate(s.endedAt)} · ${esc(s.format)} · ${s.turns} turnos</span><span style="flex:1"></span>
        <button class="btn primary rvcalcbtn" data-rv="calc" id="rvCalcBtn" title="La calculadora con los Pokémon, PS, cambios y clima del turno que estás viendo. Las notas siguen a mano.">Calculadora de este turno</button>
        ${s.replay ? '<button class="btn sm" data-rv="ext">Abrir en el navegador</button>' : ''}<button class="btn" data-rv="close" title="Cerrar la replay">Cerrar</button></header>
      <div class="rvbody">
        <div class="rvplayer">${playerHTML()}</div>
        <aside class="rvside">
          <div class="rvots" id="rvOts">${otsHTML()}</div>
        </aside>
        <aside class="rvcalc"><div class="rvchead"><b>Calculadora</b><button class="btn sm" data-rv="prev" title="Turno anterior">⏮</button><span class="rvcturn" id="rvCalcTurn"></span><button class="btn sm" data-rv="next" title="Turno siguiente">⏭</button><span style="flex:1"></span><button class="btn sm" data-rv="cfull" id="rvCalcFull" title="La calculadora en todo el visor (la replay sigue detrás: «Ver la replay» o Ctrl+K para cambiar)"></button><button class="btn sm" data-rv="calc" title="Esconder la calculadora (Ctrl+K la vuelve a sacar, tal cual la dejaste)">${tt('Esconder', 'Hide')}</button></div><div class="rvcbox" id="rvCalcBox"></div></aside>
      </div></div>`;
    NoteHL.wrap(document.querySelector('#rvNotes'));
    el.querySelector('.rv').classList.toggle('sidehid', V.otsOpen === false);
    hook();
  }

  /** Conecta el reproductor. */
  function hook() {
    clearInterval(V.timer);
    V.ready = false;
    const w = web();
    applyMute();
    w.addEventListener('dom-ready', () => {
      applyMute();
      w.insertCSS(`h1,.replay-controls,.replay-controls-2,.battle-log-inline{display:none!important}
        html,body{background:#0b1a42!important;padding:0!important;margin:0!important;overflow:hidden!important}
        .wrapper{max-width:none!important;margin:0!important}`);
    });
    const id = V.id;
    // Esperar a que el reproductor esté listo; entonces modo oscuro, velocidad y, si eras p2, verlo desde tu lado.
    const wait = setInterval(async () => {
      if (!V || V.id !== id || !web()) { clearInterval(wait); return; }
      let ok = false;
      try { ok = await w.executeJavaScript('typeof Replays !== "undefined" && !!Replays.battle && !!Replays.battle.scene'); } catch (e) { ok = false; }
      if (!ok) return;
      clearInterval(wait);
      V.ready = true;
      await run("Replays.changeSetting('color', 'dark')");
      await run(`Replays.changeSetting('speed', ${JSON.stringify(V.speed)})`);
      if (V.s.me === 'p2') await run('Replays.battle.switchViewpoint()');
      fit();
      // Volver a encajarlo cuando cambie el tamaño del reproductor (ventana, panel…).
      new ResizeObserver(() => { if (V && V.ready) { clearTimeout(V.fitT); V.fitT = setTimeout(fit, 120); } }).observe(w);
      V.timer = setInterval(poll, 400);
      poll();
      if (V.calcWant) setCalc(true);
    }, 300);
  }
  /** El combate y su registro, a todo el hueco del reproductor. */
  function fit() {
    // El combate mide 640×360 y su registro va al lado: se escala todo para llenar el hueco.
    // Si así el combate sale bastante más grande, el registro va debajo.
    run(`(() => {
      const W = innerWidth, H = innerHeight, b = document.querySelector('.battle'), l = document.querySelector('.battle-log');
      if (!b || !l) return 0;
      const side = Math.min(W / 1000, H / 364), stack = Math.min(W / 644, H / 520);
      const st = stack > side * 1.12, z = Math.max(0.4, st ? stack : side);
      document.body.style.zoom = z;
      const w = W / z, h = H / z;
      const bl = Math.max(0, (w - (st ? 640 : 1000)) / 2);
      Object.assign(b.style, { left: bl + 'px', top: '2px' });
      document.querySelector('.wrapper').style.height = (h - 2) + 'px';
      if (st) Object.assign(l.style, { left: '2px', top: '366px', right: 'auto', bottom: '2px', width: (w - 4) + 'px', height: 'auto', maxHeight: 'none' });
      else Object.assign(l.style, { left: (bl + 642) + 'px', top: '2px', right: 'auto', width: (w - bl * 2 - 642) + 'px', height: '360px' });
      l.scrollTop = l.scrollHeight;
      return z; })()`);
  }
  async function poll() {
    if (!V) return;
    const st = await run('[Replays.battle.turn, Replays.battle.paused, Replays.battle.atQueueEnd]');
    if (!st || !V) return;
    const [turn, paused, end] = st;
    const prev = V.turn;
    V.turn = Math.max(0, turn || 0);
    // Al cambiar de turno, el registro baja hasta lo último.
    if (V.turn !== prev) run("(l => { if (l) l.scrollTop = l.scrollHeight; return 1; })(document.querySelector('.battle-log'))");
    document.querySelectorAll('.rvt').forEach(b => b.classList.toggle('on', +b.dataset.rvturn === V.turn));
    // La transcripción sigue a la replay: marca el turno y lo deja a la vista.
    if (V.turn !== V.txTurn) {
      V.txTurn = V.turn;
      const box = document.querySelector('#rvTx');
      document.querySelectorAll('#rvTx .txturn').forEach(b => b.classList.toggle('on', +b.dataset.txt === V.turn));
      const blk = box && box.querySelector(`.txturn[data-txt="${V.turn}"]`);
      // El turno que se está viendo, arriba del todo.
      if (box && blk) box.scrollTo({ top: Math.max(0, blk.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 4), behavior: 'smooth' });
    }
    const p = document.querySelector('#rvPlay');
    if (p) p.textContent = paused || end ? '▶ Play' : '⏸ Pausa';
    const m = document.querySelector('#rvMark');
    if (m) m.textContent = `+ Nota en el turno ${V.turn}`;
    const at = document.querySelector('#rvAddTurn'); if (at) at.textContent = V.turn;
    if (V.calc) { const c = document.querySelector('#rvCalcTurn'); if (c) c.textContent = `Turno ${V.turn}`; if (V.turn !== prev) CalcReplay.tick(); }
  }
  /* ---------- calculadora del turno (la misma de Jugar, siguiendo la replay) ---------- */
  let READER = { side: '', js: '' };
  async function battle() {
    if (!V || !V.ready) return null;
    const id = V.id, side = V.s.me || 'p1';
    if (READER.side !== side) READER = { side, js: await api.replayReader(side) };
    const r = await run(READER.js);
    if (!V || V.id !== id) return null; // se cerró el visor mientras leía
    return r && r.ok && r.battle ? { ok: true, battle: { ...r.battle, id: `rv:${id}` } } : null;
  }
  /** Sacar o esconder la calculadora: al lado de la replay o en todo el visor. Esconderla no borra lo que hayas cambiado. */
  function setCalc(on) {
    const body = document.querySelector('#rvCalcBody'), box = document.querySelector('#rvCalcBox');
    V.calc = on;
    const rv = document.querySelector('#rvWrap .rv');
    rv.classList.toggle('withcalc', on && !V.full);
    rv.classList.toggle('calcfull', on && !!V.full);
    const b = document.querySelector('#rvCalcBtn');
    if (b) { b.classList.toggle('on', on); b.textContent = on ? (V.full ? 'Ver la replay' : 'Esconder la calculadora') : 'Calculadora de este turno'; }
    const f = document.querySelector('#rvCalcFull');
    if (f) f.textContent = V.full ? '⤡ Al lado de la replay' : '⤢ Pantalla completa';
    if (on) {
      if (body.parentNode !== box) box.appendChild(body);
      // Los equipos solo la primera vez en esta replay: así no se pierden tus cambios al esconderla y sacarla.
      if (!V.calcInit) { V.calcInit = true; const t = typeof teamOf === 'function' ? teamOf(V.s) : ''; CalcReplay.setTeams(t || (typeof SET !== 'undefined' && SET.teamId) || ''); }
      CalcReplay.setOpen(true);
      const c = document.querySelector('#rvCalcTurn'); if (c) c.textContent = `Turno ${V.turn}`;
    } else CalcReplay.setOpen(false);
    try { localStorage.setItem('msRvCalc', on ? '1' : '0'); localStorage.setItem('msRvCalcFull', V.full ? '1' : '0'); } catch (e) { /* nada */ }
  }

  /** Salta al turno de la línea pulsada ([T5]). */
  function jumpFromLine(text, pos) {
    const line = text.slice(text.lastIndexOf('\n', pos - 1) + 1).split('\n')[0];
    const t = line.match(/^\s*\[T(\d+)\]/i);
    if (!t) return;
    const n = +t[1];
    const go = () => (!V ? null : V.ready ? run(`Replays.battle.seekTurn(${n})`) : setTimeout(go, 300));
    go();
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    const id = V.id, text = V.notes;
    saveTimer = setTimeout(async () => {
      await api.setNotes(id, text);
      const x = typeof M !== 'undefined' && Array.isArray(M) ? M.find(y => y.id === id) : null;
      if (x) x.notes = text;
      const el = document.querySelector('#rvSaved');
      if (el) el.textContent = 'Guardado';
    }, 500);
    const tg = document.querySelector('#rvTags');
    if (tg) tg.innerHTML = tagsHTML();
    const el = document.querySelector('#rvSaved');
    if (el) el.textContent = 'Guardando…';
  }
  function mark(text, turnN) {
    const ta = document.querySelector('#rvNotes');
    const tag = `[T${turnN != null ? turnN : V.turn || 0}] ${text ? `${text}: ` : ''}`;
    // En una línea nueva, debajo de donde estaba el cursor (si no se ha tocado, al final).
    const cur = V.caret != null && V.caret <= ta.value.length ? V.caret : ta.value.length;
    const nl = ta.value.indexOf('\n', cur);
    const at = nl < 0 ? ta.value.length : nl;
    const pre = at > 0 && ta.value[at - 1] !== '\n' ? '\n' : '';
    ta.value = ta.value.slice(0, at) + pre + tag + ta.value.slice(at);
    V.notes = ta.value;
    const c = at + pre.length + tag.length;
    NoteHL.sync(ta);
    ta.focus(); ta.setSelectionRange(c, c); V.caret = c;
    run('Replays.battle.pause()');
    save();
  }

  /*
   * ---------- modo predicción ----------
   * La replay se para al empezar cada turno (sin ver lo que viene: la transcripción se esconde desde ese turno).
   * Escribes qué harías tú y qué esperas del rival; «Ver el turno» lo enseña y dices si acertaste. Cada predicción
   * queda en las notas como «[T5] 🎯 ✔ lo que escribiste» (✔ acerté, ≈ a medias, ✘ fallé), igual en los dos idiomas.
   */
  function predPaint() {
    const el = document.querySelector('#rvPred'), b = document.querySelector('#rvPredBtn');
    if (b) { b.classList.toggle('primary', !!V.pred); b.textContent = V.pred ? tt('🎯 Salir de predecir', '🎯 Stop predicting') : tt('🎯 Predecir', '🎯 Predict'); }
    // La transcripción, solo hasta lo que ya has visto.
    const upto = V.pred ? (V.pred.stage === 'rate' ? V.pred.turn : V.pred.turn - 1) : Infinity;
    document.querySelectorAll('#rvTx .txturn').forEach(t => { t.hidden = +t.dataset.txt > upto; });
    if (!el) return;
    el.classList.toggle('hide', !V.pred);
    if (!V.pred) { el.innerHTML = ''; return; }
    const P0 = V.pred, last = V.s.turns || 0;
    const score = P0.n ? `<span class="note">${tt('Aciertos', 'Hits')}: <b>${P0.ok + P0.half / 2}</b> / ${P0.n}</span>` : '';
    if (P0.turn > last) {
      el.innerHTML = `<b>🎯 ${tt('Fin de la partida', 'End of the match')}</b>${score}<span style="flex:1"></span><button class="btn sm" data-pred="exit">${tt('Salir', 'Exit')}</button>`;
      return;
    }
    el.innerHTML = P0.stage === 'ask'
      ? `<div class="rvpredq"><b>🎯 ${tt('Turno', 'Turn')} ${P0.turn}</b><span class="note">${tt('¿Qué harías tú? ¿Y el rival? Escríbelo antes de verlo (Intro).', 'What would you do? And the rival? Write it before seeing it (Enter).')}</span></div>
        <textarea id="rvPredTxt" rows="2" maxlength="400" placeholder="${tt('Ej.: Protect con Incineroar y Heat Wave; el rival hará Fake Out a Charizard', 'E.g.: Protect with Incineroar and Heat Wave; the rival will Fake Out Charizard')}">${esc(P0.txt)}</textarea>
        <div class="row-btns"><button class="btn sm primary" data-pred="show">${tt('Ver el turno', 'Show the turn')}</button><button class="btn sm" data-pred="skip">${tt('Saltar este turno', 'Skip this turn')}</button>${score}<span style="flex:1"></span><button class="btn sm" data-pred="exit">${tt('Salir', 'Exit')}</button></div>`
      : `<div class="rvpredq"><b>🎯 ${tt('Turno', 'Turn')} ${P0.turn}</b><span class="note">${tt('Tu predicción', 'Your prediction')}:</span> <span class="nolang rvpredyou">${esc(P0.txt || '—')}</span></div>
        <div class="row-btns"><span class="note">${tt('Mira lo que pasó en la transcripción. ¿Acertaste?', 'Look at what happened in the transcript. Did you get it right?')}</span><button class="btn sm rvp-ok" data-pred="ok">✔ ${tt('Acerté', 'Right')}</button><button class="btn sm rvp-half" data-pred="half">≈ ${tt('A medias', 'Half')}</button><button class="btn sm rvp-ko" data-pred="ko">✘ ${tt('Fallé', 'Wrong')}</button>${score}<span style="flex:1"></span><button class="btn sm" data-pred="exit">${tt('Salir', 'Exit')}</button></div>`;
    if (P0.stage === 'ask') { const t = el.querySelector('#rvPredTxt'); if (t) setTimeout(() => t.focus(), 0); }
  }
  async function predGo(n) {
    V.pred.turn = n; V.pred.stage = 'ask'; V.pred.txt = '';
    await run(`(Replays.battle.pause(), Replays.battle.seekTurn(${n}), 1)`);
    await poll();
    predPaint();
  }
  function predToggle() {
    if (!V.ready) return;
    if (V.pred) { V.pred = null; predPaint(); return; }
    V.pred = { turn: 1, stage: 'ask', txt: '', n: 0, ok: 0, half: 0 };
    predGo(Math.max(1, V.turn || 1));
  }
  async function predAct(k) {
    const P0 = V.pred;
    if (!P0) return;
    if (k === 'exit') { V.pred = null; predPaint(); return; }
    if (k === 'skip') { predGo(P0.turn + 1); return; }
    if (k === 'show') {
      const t = document.querySelector('#rvPredTxt'); if (t) P0.txt = t.value;
      P0.stage = 'rate';
      // Se ve el turno entero (hasta el principio del siguiente) y su transcripción.
      await run(`(Replays.battle.seekTurn(${P0.turn}), Replays.battle.play(), 1)`);
      predPaint(); waitTurn(P0.turn + 1);
      return;
    }
    const sym = { ok: '✔', half: '≈', ko: '✘' }[k];
    if (!sym) return;
    P0.n++; if (k === 'ok') P0.ok++; if (k === 'half') P0.half++;
    const txt = String(P0.txt || '').trim().replace(/\s*\n\s*/g, ' ');
    if (txt) {
      const line = `[T${P0.turn}] 🎯 ${sym} ${txt}`;
      const L = V.notes ? V.notes.split('\n') : [];
      let at = L.length;
      for (let i = L.length - 1; i >= 0; i--) { const m = L[i].match(/^\s*\[T(\d+)\]/); if (m && +m[1] > P0.turn) at = i; else if (m) break; }
      L.splice(at, 0, line);
      V.notes = L.join('\n').replace(/\n+$/, '');
      const ta = document.querySelector('#rvNotes');
      if (ta) { ta.value = V.notes; NoteHL.sync(ta); }
      save();
    }
    predGo(P0.turn + 1);
  }
  /** Para la replay al llegar al principio del turno n (o al final). */
  function waitTurn(n) {
    const id = V.id;
    const t = setInterval(async () => {
      if (!V || V.id !== id || !V.pred) { clearInterval(t); return; }
      const st = await run('[Replays.battle.turn, Replays.battle.atQueueEnd]');
      if (!st) return;
      if (st[0] >= n || st[1]) { clearInterval(t); await run(`(Replays.battle.pause(), ${st[0] >= n ? `Replays.battle.seekTurn(${n})` : '0'}, 1)`); poll(); }
    }, 250);
  }

  async function open(id) {
    const m = await api.get(id);
    if (!m) return;
    if (V) close();
    let tx = [];
    try { tx = Transcript.parse(m.log); } catch (e) { tx = []; }
    V = { id, s: m.summary, notes: m.notes || '', otsSide: m.summary.me ? 'rev' : 'foe', add: { where: 'turn', k: '', text: '', msg: '' }, review: m.review ? { why: [...(m.review.why || [])], lesson: m.review.lesson || '' } : { why: [], lesson: '' }, km: (() => { try { return Transcript.keyMoments(tx); } catch (e) { return []; } })(), turn: 0, speed: 'fast', ready: false, timer: null, tx, otsOpen: (() => { try { return localStorage.getItem('msRvOts') !== '0'; } catch (e) { return true; } })(), calcWant: (() => { try { return localStorage.getItem('msRvCalc') === '1'; } catch (e) { return false; } })(), full: (() => { try { return localStorage.getItem('msRvCalcFull') === '1'; } catch (e) { return false; } })() };
    let el = document.querySelector('#rvWrap');
    if (!el) { el = document.createElement('div'); el.id = 'rvWrap'; document.body.appendChild(el); }
    el.classList.remove('hide');
    draw();
  }
  function close() {
    if (!V) return;
    if (V.calc) CalcReplay.setOpen(false);
    { const body = document.querySelector('#rvCalcBody'), hold = document.querySelector('#rvCalcHold'); if (body && hold && body.parentNode !== hold) hold.appendChild(body); }
    clearInterval(V.timer);
    clearTimeout(saveTimer);
    const notes = V.notes, id = V.id;
    api.setNotes(id, notes);
    V = null;
    const el = document.querySelector('#rvWrap');
    if (el) { el.innerHTML = ''; el.classList.add('hide'); }
    // Si el detalle de la partida estaba abierto, que muestre las notas nuevas.
    const ta = document.querySelector('#modal:not(.hide) #mNotes');
    if (ta) ta.value = notes;
    const tr = document.querySelector(`#modal:not(.hide) [data-rnote="${CSS.escape(id)}"]`);
    if (tr) tr.value = notes;
  }

  document.addEventListener('click', e => {
    if (!V) return;
    const b = e.target.closest('#rvWrap button');
    if (!b) return;
    const d = b.dataset;
    if (d.rv === 'close') close();
    else if (d.rv === 'ext') api.openExternal(V.s.replay);
    else if (d.rv === 'calc') { if (V.ready) { setCalc(!V.calc); run('Replays.battle.pause()').then(poll); } }
    else if (d.rv === 'cfull') { V.full = !V.full; setCalc(true); }
    else if (d.rv === 'play') run('Replays.battle.paused || Replays.battle.atQueueEnd ? Replays.battle.play() : Replays.battle.pause()').then(poll);
    else if (d.rv === 'prev') run('Replays.battle.seekBy(-1)').then(poll);
    else if (d.rv === 'next') run('Replays.battle.seekBy(1)').then(poll);
    else if (d.rv === 'side') run('Replays.battle.switchViewpoint()');
    else if (d.rv === 'pred') predToggle();
    else if (d.pred) predAct(d.pred);
    else if (d.rvturn != null) run(`Replays.battle.seekTurn(${+d.rvturn})`).then(poll);
    else if (d.rv === 'mute') { muted = !muted; applyMute(); }
    else if (d.rvotsopen) { V.otsOpen = V.otsOpen === false; try { localStorage.setItem('msRvOts', V.otsOpen ? '1' : '0'); } catch (e) { /* nada */ } document.querySelector('#rvOts').innerHTML = otsHTML(); document.querySelector('#rvWrap .rv').classList.toggle('sidehid', !V.otsOpen); }
    else if (d.rvots) { V.otsSide = d.rvots; document.querySelector('#rvOts').innerHTML = otsHTML(); }
    else if (d.rvwhy) { const w = new Set(V.review.why); if (w.has(d.rvwhy)) w.delete(d.rvwhy); else w.add(d.rvwhy); V.review.why = Stats.ALL.map(x => x.k).filter(k => w.has(k)); saveReview(); redrawOts(); }
    else if (d.rvwhere) { V.add.where = d.rvwhere; V.add.msg = ''; redrawOts(); }
    else if (d.rvadd) addTag();
    else if (d.rvdone) { const mk = { ...(V.s.mark || {}) }; mk.a = mk.a === 'done' ? false : 'done'; V.s.mark = mk.r || mk.a ? mk : null; api.setMark(V.id, V.s.mark || {}); const x = typeof M !== 'undefined' ? M.find(y => y.id === V.id) : null; if (x) x.mark = V.s.mark; redrawOts(); }
    else if (d.txnote != null) { const n = +d.txnote; run(`Replays.battle.seekTurn(${n})`); mark('', n); }
    else if (b.id === 'rvMark') mark();
  });
  // Ctrl+K con el visor abierto: saca o esconde su calculadora (no la de Jugar).
  document.addEventListener('keydown', e => {
    if (!V || !V.ready || !e.ctrlKey || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'k') return;
    e.preventDefault(); e.stopImmediatePropagation();
    setCalc(!V.calc);
    if (V.calc) run('Replays.battle.pause()').then(poll);
  }, true);
  // Pulsar una línea de la transcripción: salta a ese turno y apunta una nota enlazada a ese momento.
  document.addEventListener('click', e => {
    if (!V) return;
    const r = e.target.closest('#rvTx .txrow');
    if (!r) return;
    const n = +r.dataset.txt;
    run(`Replays.battle.seekTurn(${n})`);
    mark(r.dataset.txline || '', n);
  });
  document.addEventListener('change', e => {
    if (V && e.target.id === 'rvAddK') { V.add.k = e.target.value; V.add.msg = ''; redrawOts(); const t = document.querySelector('#rvAddTxt'); if (t) t.focus(); run('Replays.battle.pause()'); }
    if (V && e.target.id === 'rvSpeed') { V.speed = e.target.value; run(`Replays.changeSetting('speed', ${JSON.stringify(V.speed)})`); }
  });
  document.addEventListener('input', e => { if (V && e.target.id === 'rvLesson') { V.review.lesson = e.target.value; saveReview(); } });
  document.addEventListener('input', e => { if (V && e.target.id === 'rvAddTxt') V.add.text = e.target.value; });
  document.addEventListener('input', e => { if (V && V.pred && e.target.id === 'rvPredTxt') V.pred.txt = e.target.value; });
  document.addEventListener('keydown', e => { if (V && V.pred && e.target.id === 'rvPredTxt' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); predAct('show'); } });
  // Intro en el texto: añadirla (con Mayús+Intro se sigue escribiendo; al añadirla queda en una línea).
  document.addEventListener('keydown', e => { if (V && e.target.id === 'rvAddTxt' && e.key === 'Enter' && (e.ctrlKey || !e.shiftKey)) { e.preventDefault(); addTag(); } });
  document.addEventListener('input', e => { if (V && e.target.id === 'rvNotes') { V.notes = e.target.value; V.caret = e.target.selectionStart; save(); } });
  document.addEventListener('keyup', e => { if (V && e.target.id === 'rvNotes') V.caret = e.target.selectionStart; });
  document.addEventListener('mouseup', e => {
    if (!V || e.target.id !== 'rvNotes') return;
    const ta = e.target;
    V.caret = ta.selectionStart;
    if (ta.selectionStart === ta.selectionEnd) jumpFromLine(ta.value, ta.selectionStart);
  });
  // El visor solo se cierra con «Cerrar» (ni con un clic fuera ni con Esc).

  return { open, close, battle, isOpen: () => !!V };
})();
