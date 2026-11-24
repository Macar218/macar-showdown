'use strict';
/*
 * Macar Showdown · visor de replays.
 * La partida guardada se ve dentro de la app con el reproductor oficial de Showdown (msreplay://, servido desde
 * el registro guardado: no hace falta haberla subido). Al lado: leads y reserva de los dos y las notas de la
 * partida, con marcas de turno [T5] que saltan a ese momento. Arranca en silencio (botón del altavoz).
 */
/* global api, esc, spr, pill, fmtDate, Transcript, P, I18N, NoteHL */

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

  function monsHTML(x) {
    const leads = x.leads || [], brought = x.brought || [];
    const back = brought.filter(p => !leads.includes(p));
    const out = (x.preview || []).filter(p => !brought.some(b => b.split('-')[0] === p.split('-')[0]));
    const row = (label, list, cls = '') => `<div class="rvmons"><small>${label}</small><span>${list.length ? list.map(p => spr(p, `sm ${cls}`)).join('') : '<span class="note">—</span>'}</span></div>`;
    return row('Leads', leads) + row('Reserva', back) + (out.length ? row('No salieron', out, 'dim') : '');
  }

  function playerHTML() {
    const turns = V.s.turns || 0;
    return `<webview id="rvWeb" partition="persist:replay" src="msreplay://r/${esc(V.id)}"></webview>
      <div class="rvbar">
        <button class="btn sm" data-rv="prev" title="Turno anterior">⏮</button><button class="btn sm primary" data-rv="play" id="rvPlay">▶ Play</button><button class="btn sm" data-rv="next" title="Turno siguiente">⏭</button>
        <div class="rvturns">${Array.from({ length: turns + 1 }, (_, t) => `<button class="rvt" data-rvturn="${t}" title="${t ? `Turno ${t}` : 'Inicio'}">${t || '0'}</button>`).join('')}</div>
        <select id="rvSpeed" title="Velocidad">${SPEEDS.map(([k, l]) => `<option value="${k}"${k === V.speed ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <button class="btn sm" data-rv="side" title="Ver la partida desde el otro lado">⇄ Lados</button>
        <button class="btn sm ibtn mute" data-rv="mute" id="rvMute"></button>
      </div>
      <div class="rvots" id="rvOts">${otsHTML()}</div>
      <div class="rvtx nolang" id="rvTx">${txHTML()}</div>`;
  }

  /* ---------- hoja de equipo (OTS): la del rival por defecto, con pestaña para ver la tuya ---------- */
  function otsHTML() {
    const s = V.s, me = s.me || 'p1', opp = s.opp || (me === 'p1' ? 'p2' : 'p1');
    const sd = V.otsSide === 'me' ? me : opp;
    const x = s[sd] || {};
    const tabs = `<div class="seg rvotstabs">${[['foe', s.me ? 'Rival' : 'Jugador 2'], ['me', s.me ? 'Tú' : 'Jugador 1']].map(([k, l]) => `<button data-rvots="${k}" aria-pressed="${(V.otsSide || 'foe') === k}">${l}</button>`).join('')}</div>`;
    let body;
    if (x.sheet && x.sheet.length) {
      body = x.sheet.map(m => {
        const brought = (x.brought || []).some(b => P.toID(P.baseSpecies(b)) === P.toID(P.baseSpecies(m.species)));
        const ab = /^[01H]$/.test(m.ability) ? '' : P.nameOf('abilities', m.ability);
        return `<div class="otsmon${brought ? '' : ' out'}">${spr(m.species, 'sm')}<div><b>${esc(m.species)}</b><span>${esc(P.nameOf('items', m.item) || '—')}${ab ? ` · ${esc(ab)}` : ''}${m.nature ? ` · ${esc(m.nature)}` : ''}</span><small>${m.moves.map(v => { const d = P.moveOf(P.nameOf('moves', v)); return `<i class="otsmv t-${esc(d ? d.type : '')}"></i>${esc(P.nameOf('moves', v))}`; }).join(' ')}</small></div></div>`;
      }).join('');
    } else {
      const seen = x.moves || {};
      body = (x.preview && x.preview.length ? x.preview : x.brought || []).map(n => {
        const k = Object.keys(seen).find(y => P.toID(P.baseSpecies(y)) === P.toID(P.baseSpecies(n)));
        const brought = (x.brought || []).includes(n);
        return `<div class="otsmon${brought ? '' : ' out'}">${spr(n, 'sm')}<div><b>${esc(n)}</b><small>${k && seen[k].length ? seen[k].map(esc).join(' · ') : tt('sin movimientos vistos', 'no moves seen')}</small></div></div>`;
      }).join('') + `<p class="note otsnone">${tt('Sin hoja de equipo (CTS): solo lo que se vio.', 'No team sheet (CTS): only what was seen.')}</p>`;
    }
    return `<div class="rvotshead"><b>${tt('Hoja de equipo', 'Team sheet')}</b>${tabs}</div><div class="otsgrid nolang">${body}</div>`;
  }

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
    const s = V.s, a = s.me || 'p1', b = s.opp || 'p2';
    const el = document.querySelector('#rvWrap');
    el.innerHTML = `<div class="rv" role="dialog" aria-label="Replay de la partida">
      <header class="rvhead">${pill(s.result)}<b>${s.me ? `vs <span class="nolang">${esc(s[b].name)}</span>` : `<span class="nolang">${esc(s.p1.name)} vs ${esc(s.p2.name)}</span>`}</b>
        <span class="note">${fmtDate(s.endedAt)} · ${esc(s.format)} · ${s.turns} turnos</span><span style="flex:1"></span>
        ${s.replay ? '<button class="btn sm" data-rv="ext">Abrir en el navegador</button>' : ''}<button class="btn" data-rv="close" title="Cerrar (Esc)">Cerrar</button></header>
      <div class="rvbody">
        <div class="rvplayer">${playerHTML()}</div>
        <aside class="rvside">
          <div class="rvteam me"><h3>${s.me ? 'Tú' : 'Jugador 1'}</h3>${monsHTML(s[a])}</div>
          <div class="rvteam foe"><h3>${s.me ? 'Rival' : 'Jugador 2'}</h3>${monsHTML(s[b])}</div>
          <div class="rvnhead"><h3>Notas</h3><span class="note" id="rvSaved"></span></div>
          <button class="btn sm primary" id="rvMark">+ Nota en el turno 0</button>
          <textarea id="rvNotes" placeholder="Pulsa «+ Nota» o una línea de la transcripción para apuntar con el turno de la replay…">${esc(V.notes)}</textarea>
          <p class="note">Pulsa una línea que empiece por [T5] para saltar a ese turno.</p>
        </aside>
      </div></div>`;
    NoteHL.wrap(document.querySelector('#rvNotes'));
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

  async function open(id) {
    const m = await api.get(id);
    if (!m) return;
    if (V) close();
    let tx = [];
    try { tx = Transcript.parse(m.log); } catch (e) { tx = []; }
    V = { id, s: m.summary, notes: m.notes || '', turn: 0, speed: 'fast', ready: false, timer: null, tx };
    let el = document.querySelector('#rvWrap');
    if (!el) { el = document.createElement('div'); el.id = 'rvWrap'; document.body.appendChild(el); }
    el.classList.remove('hide');
    draw();
  }
  function close() {
    if (!V) return;
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
    const wrap = document.querySelector('#rvWrap');
    if (e.target === wrap) { close(); return; }
    const b = e.target.closest('#rvWrap button');
    if (!b) return;
    const d = b.dataset;
    if (d.rv === 'close') close();
    else if (d.rv === 'ext') api.openExternal(V.s.replay);
    else if (d.rv === 'play') run('Replays.battle.paused || Replays.battle.atQueueEnd ? Replays.battle.play() : Replays.battle.pause()').then(poll);
    else if (d.rv === 'prev') run('Replays.battle.seekBy(-1)').then(poll);
    else if (d.rv === 'next') run('Replays.battle.seekBy(1)').then(poll);
    else if (d.rv === 'side') run('Replays.battle.switchViewpoint()');
    else if (d.rvturn != null) run(`Replays.battle.seekTurn(${+d.rvturn})`).then(poll);
    else if (d.rv === 'mute') { muted = !muted; applyMute(); }
    else if (d.rvots) { V.otsSide = d.rvots; document.querySelector('#rvOts').innerHTML = otsHTML(); }
    else if (d.txnote != null) { const n = +d.txnote; run(`Replays.battle.seekTurn(${n})`); mark('', n); }
    else if (b.id === 'rvMark') mark();
  });
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
    if (V && e.target.id === 'rvSpeed') { V.speed = e.target.value; run(`Replays.changeSetting('speed', ${JSON.stringify(V.speed)})`); }
  });
  document.addEventListener('input', e => { if (V && e.target.id === 'rvNotes') { V.notes = e.target.value; V.caret = e.target.selectionStart; save(); } });
  document.addEventListener('keyup', e => { if (V && e.target.id === 'rvNotes') V.caret = e.target.selectionStart; });
  document.addEventListener('mouseup', e => {
    if (!V || e.target.id !== 'rvNotes') return;
    const ta = e.target;
    V.caret = ta.selectionStart;
    if (ta.selectionStart === ta.selectionEnd) jumpFromLine(ta.value, ta.selectionStart);
  });
  document.addEventListener('keydown', e => { if (V && e.key === 'Escape') { e.stopPropagation(); close(); } }, true);

  return { open, close };
})();
