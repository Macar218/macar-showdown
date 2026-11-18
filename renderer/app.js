'use strict';
/* Macar Showdown · interfaz */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = window.macar;
const { toID, leadKey } = Stats;

let M = [];          // resúmenes de partidas
let SET = {};        // ajustes
let VIEW = 'jugar';
const F = { result: 'all', days: 0, format: '', lead: '', rival: '' };

/* ---------- sprites ---------- */
const NOHYPHEN = new Set(['kommoo', 'hakamoo', 'jangmoo', 'hooh', 'porygonz', 'chiyu', 'chienpao', 'tinglu', 'wochien', 'mrmime', 'mimejr', 'typenull', 'mrrime', 'nidoranf', 'nidoranm']);
function spriteId(name) {
  const full = toID(name);
  if (NOHYPHEN.has(full)) return full;
  const i = name.indexOf('-');
  return i < 0 ? full : `${toID(name.slice(0, i))}-${toID(name.slice(i + 1))}`;
}
const SPR = 'https://play.pokemonshowdown.com/sprites/gen5/';
function spr(name, cls = '') {
  const base = name.includes('-') && !NOHYPHEN.has(toID(name)) ? toID(name.split('-')[0]) : '';
  return `<img class="spr ${cls}" src="${SPR}${spriteId(name)}.png" ${base ? `data-fb="${SPR}${base}.png"` : ''} alt="" title="${esc(name)}" loading="lazy">`;
}
document.addEventListener('error', e => {
  const t = e.target;
  if (t.tagName !== 'IMG') return;
  if (t.dataset.fb) { const fb = t.dataset.fb; delete t.dataset.fb; t.src = fb; } else t.classList.add('broken');
}, true);

/* ---------- utilidades ---------- */
const pct = (w, n) => (n ? Math.round((w / n) * 100) : 0);
const fmtDate = t => { const d = new Date(t); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const shortFormat = f => String(f || '').replace(/^\[Gen \d+[^\]]*\]\s*/, '') || '—';
const RES = { win: 'Victoria', loss: 'Derrota', tie: 'Empate' };
const pill = r => `<span class="pill ${r || 'none'}">${RES[r] || 'Sin identificar'}</span>`;
const head = (title, sub, right = '') => `<div class="head"><div><h1>${title}</h1>${sub ? `<p class="note" style="margin-top:4px">${sub}</p>` : ''}</div>${right}</div>`;

function wrRow(x, label) {
  const p = pct(x.w, x.n), cls = x.n >= 3 ? (p >= 55 ? 'hi' : p <= 45 ? 'lo' : '') : '';
  return `<div class="row"><div class="who">${label}</div><div class="bar" title="${p}% de victorias"><i class="${cls}" style="width:${Math.max(2, p)}%"></i></div><div class="num"><b>${p}%</b> · ${x.n}</div></div>`;
}
function wrCard(title, list, labelFn, empty, limit = 8) {
  if (!list.length) return `<div class="card"><h2>${title}</h2><p class="note">${empty}</p></div>`;
  return `<div class="card"><h2>${title}</h2><div class="rows">${list.slice(0, limit).map(x => wrRow(x, labelFn(x))).join('')}</div>${list.length > limit ? `<p class="note more">y ${list.length - limit} más</p>` : ''}</div>`;
}
const monLabel = x => `${spr(x.key, 'sm')}<span>${esc(x.key)}</span>`;
const pairLabel = x => `${x.key.split(' + ').map(n => spr(n, 'sm')).join('')}<span>${esc(x.key)}</span>`;

/* ---------- navegación ---------- */
function show(v) {
  VIEW = v;
  $$('.nav [data-v]').forEach(b => b.setAttribute('aria-current', b.dataset.v === v ? 'page' : 'false'));
  $$('.view').forEach(x => x.classList.toggle('on', x.id === `v-${v}`));
  render();
}
$('.nav').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) show(b.dataset.v); });
document.addEventListener('keydown', e => {
  if (e.ctrlKey && !e.altKey && !e.shiftKey && /^[1-5]$/.test(e.key)) { e.preventDefault(); show(['jugar', 'calc', 'dash', 'partidas', 'ajustes'][+e.key - 1]); }
  if (e.key === 'Escape') closeModal();
});

async function load() {
  [M, SET] = await Promise.all([api.list(), api.settings()]);
  render(false);
}
function render(force = true) {
  $('#navCount').textContent = M.length;
  if (VIEW === 'calc') openCalc();
  else if (VIEW === 'dash') renderDash();
  else if (VIEW === 'partidas') renderList();
  else if (VIEW === 'ajustes' && force) renderSettings(); // no se repinta mientras escribes
}

/* ---------- Jugar ---------- */
$('#reloadSd').addEventListener('click', () => { const w = $('#sd'); if (w && w.reload) w.reload(); });
async function pollStatus() {
  try {
    const s = await api.status();
    const el = $('#capState');
    el.classList.toggle('ok', !!s.ok);
    el.classList.toggle('err', !s.ok && !!s.lastCheck);
    const txt = s.ok
      ? `Captura activa${s.me ? ` · ${esc(s.me)}` : ''}<br>${s.open} combate${s.open === 1 ? '' : 's'} abierto${s.open === 1 ? '' : 's'} · ${s.saved} guardada${s.saved === 1 ? '' : 's'} hoy`
      : esc(s.why || 'Esperando a Showdown…');
    $('span', el).innerHTML = txt;
  } catch (e) { /* sin estado */ }
}
setInterval(pollStatus, 4000);

/* ---------- Calculadora (Macar Dex) ---------- */
// Se crea al abrir la pestaña por primera vez, para no cargarla al arrancar.
const DEX_URL = 'https://macar218.github.io/macar-dex/';
function openCalc() {
  if ($('#dex')) return;
  const w = document.createElement('webview');
  w.id = 'dex';
  w.setAttribute('partition', 'persist:macardex');
  w.setAttribute('src', `${DEX_URL}#calc`);
  const msg = $('#calcMsg');
  w.addEventListener('did-finish-load', () => { msg.classList.add('hide'); });
  w.addEventListener('did-fail-load', e => {
    if (e.isMainFrame === false || e.errorCode === -3) return; // -3: navegación cancelada, no es un fallo
    msg.classList.remove('hide');
    msg.textContent = 'No se pudo abrir la calculadora. Comprueba la conexión y pulsa Recargar.';
  });
  $('#calcWrap').appendChild(w);
}
$('#calcReload').addEventListener('click', () => {
  const w = $('#dex');
  if (!w) return openCalc();
  $('#calcMsg').textContent = 'Abriendo la calculadora…';
  $('#calcMsg').classList.remove('hide');
  w.loadURL(`${DEX_URL}#calc`);
});
$('#calcHome').addEventListener('click', () => {
  const w = $('#dex');
  if (w) w.executeJavaScript("typeof showTab === 'function' && showTab('calc')").catch(() => w.loadURL(`${DEX_URL}#calc`));
});

/* ---------- Dashboard ---------- */
function emptyState() {
  return `<div class="card empty"><span class="lens" style="width:64px;height:64px" aria-hidden="true"></span><div class="steps">
    <div class="step"><b class="n">1</b><span>Pon tu usuario de Showdown para saber qué jugador eres en cada partida.</span><button class="btn" data-go="ajustes">Ir a Ajustes</button></div>
    <div class="step"><b class="n">2</b><span>Juega en la pestaña Jugar: ladder, torneos o retos. Cada combate se guarda al terminar.</span><button class="btn primary" data-go="jugar">Ir a Jugar</button></div>
    <div class="step"><b class="n">3</b><span>¿Tienes replays de antes? Impórtalos y también cuentan.</span><button class="btn" data-go="ajustes">Importar replays</button></div>
  </div></div>`;
}
function seg(key, opts) {
  return `<div class="seg" role="group">${opts.map(([v, l]) => `<button data-f="${key}" data-val="${v}" aria-pressed="${String(F[key]) === String(v)}">${l}</button>`).join('')}</div>`;
}
function sel(key, label, opts, all) {
  return `<label class="field">${label}<select data-fs="${key}"><option value="">${all}</option>${opts.map(([v, l]) => `<option value="${esc(v)}"${F[key] === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
}
function eloChart(pts) {
  if (pts.length < 2) return '<p class="note">Hace falta más de un dato de ELO para dibujar la evolución.</p>';
  const W = 600, H = 150, pad = 30;
  const rs = pts.map(p => p.r), lo = Math.min(...rs), hi = Math.max(...rs), span = Math.max(1, hi - lo);
  const xy = pts.map((p, i) => [pad + (i * (W - pad - 8)) / (pts.length - 1), H - 14 - ((p.r - lo) / span) * (H - 34)]);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución del ELO de ${lo} a ${hi}">
    <text x="0" y="${H - 12}">${lo}</text><text x="0" y="20">${hi}</text>
    <polyline points="${xy.map(p => p.join(',')).join(' ')}" fill="none" stroke="#38d4ff" stroke-width="2.5" stroke-linejoin="round"/>
    ${xy.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === xy.length - 1 ? 4.5 : 2.5}" fill="#38d4ff"/>`).join('')}</svg>`;
}
function renderDash() {
  const el = $('#v-dash');
  const known = Stats.usable(M);
  if (!M.length) { el.innerHTML = head('Dash<span>board</span>', 'Se llena solo con cada partida que juegues.') + emptyState(); return; }
  const unknown = M.length - known.length;
  const o = Stats.options(M);
  const ms = Stats.filter(M, F), r = Stats.compute(ms);
  const warn = unknown ? `<div class="warnbox"><span>${unknown} partida${unknown === 1 ? '' : 's'} sin identificar: no sé qué jugador eras. Pon tu usuario de Showdown en Ajustes.</span><button class="btn" data-go="ajustes">Ir a Ajustes</button></div>` : '';
  el.innerHTML = head('Dash<span>board</span>', `${known.length} partida${known.length === 1 ? '' : 's'} identificada${known.length === 1 ? '' : 's'}`) + warn + `
    <div class="filters">
      <div class="field">Resultado${seg('result', [['all', 'Todas'], ['win', 'Victorias'], ['loss', 'Derrotas']])}</div>
      <div class="field">Fechas${seg('days', [[0, 'Todo'], [1, 'Hoy'], [7, '7 días'], [30, '30 días']])}</div>
      ${sel('format', 'Formato', o.formats.map(([id, n]) => [id, shortFormat(n)]), 'Todos')}
      ${sel('lead', 'Tu lead', o.leads.map(x => [x, x]), 'Cualquiera')}
      ${sel('rival', 'Rival con', o.rivals.map(x => [x, x]), 'Cualquiera')}
    </div>
    ${!ms.length ? '<div class="card"><p class="note">No hay partidas con estos filtros.</p></div>' : `
    <div class="kpis">
      <div class="kpi"><small>Partidas</small><b>${r.n}</b></div>
      <div class="kpi"><small>Récord</small><b>${r.w}–${r.l}${r.t ? `–${r.t}` : ''}</b></div>
      <div class="kpi"><small>Victorias</small><b>${pct(r.w, r.n)}%</b></div>
      <div class="kpi"><small>ELO</small><b>${r.eloNow ?? '—'}</b><i>último conocido</i></div>
      <div class="kpi"><small>Turnos</small><b>${r.avgTurns.toFixed(1)}</b><i>de media</i></div>
      <div class="kpi"><small>Apuros de tiempo</small><b>${r.timeScares}</b><i>≤10 s en algún turno</i></div>
    </div>
    <div class="grid">
      ${wrCard('Tus Pokémon', r.myMons, monLabel, 'Sin datos.')}
      ${wrCard('Tus leads', r.myLeads, pairLabel, 'Sin datos.')}
      ${wrCard('Rivales más vistos', r.oppPreview, monLabel, 'Sin datos.', 10)}
      ${wrCard('Leads rivales', r.oppLeads, pairLabel, 'Sin datos.')}
      ${wrCard('Megas rivales', r.oppMegas, monLabel, 'Ningún rival ha mega-evolucionado.')}
      <div class="card elo"><h2>ELO</h2>${eloChart(r.elo)}</div>
    </div>
    <p class="note" style="margin-top:12px">% = tus victorias en las partidas donde aparece. Verde ≥55 % y rojo ≤45 % solo con 3 partidas o más. "Tus Pokémon" cuenta los que salieron al combate.</p>`}`;
}
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) { closeModal(); show(g.dataset.go); return; }
  const f = e.target.closest('[data-f]');
  if (f) { F[f.dataset.f] = f.dataset.f === 'days' ? +f.dataset.val : f.dataset.val; render(); }
});
document.addEventListener('change', e => { const s = e.target.closest('[data-fs]'); if (s) { F[s.dataset.fs] = s.value; render(); } });

/* ---------- Partidas ---------- */
function renderList() {
  const el = $('#v-partidas');
  const right = '<button class="btn" data-go="ajustes">Importar replays</button>';
  if (!M.length) { el.innerHTML = head('Parti<span>das</span>', 'Aquí aparece cada combate que termines.', right) + emptyState(); return; }
  el.innerHTML = head('Parti<span>das</span>', `${M.length} guardada${M.length === 1 ? '' : 's'} · pulsa una para ver el detalle`, right) + `<div class="mlist">${M.map(s => {
    const me = s.me ? s[s.me] : s.p1, op = s.opp ? s[s.opp] : s.p2;
    const brought = new Set(op.brought);
    return `<button class="match" data-id="${esc(s.id)}">
      <span class="d">${fmtDate(s.endedAt)}</span>
      ${pill(s.result)}
      <span class="vs"><b>${s.me ? `vs ${esc(op.name)}` : `${esc(s.p1.name)} vs ${esc(s.p2.name)}`}</b><small>${op.rating ? `${op.rating} ELO · ` : ''}${esc(shortFormat(s.format))}</small></span>
      <span class="mons" title="Tu lead">${me.leads.map(n => spr(n, 'sm')).join('')}</span>
      <span class="mons" title="Equipo rival (en gris, los que no salieron)">${op.preview.map(n => spr(n, `sm${brought.has(n) ? '' : ' dim'}`)).join('')}</span>
      <span class="t">${s.turns} t${s.notes ? ' ✎' : ''}</span>
    </button>`;
  }).join('')}</div>`;
}
$('#v-partidas').addEventListener('click', e => { const b = e.target.closest('.match'); if (b) openDetail(b.dataset.id); });

function sideCard(s, sd, title) {
  const x = s[sd], brought = new Set(x.brought);
  const moves = Object.entries(x.moves);
  return `<div class="card"><h2>${title}: ${esc(x.name)}</h2>
    <p class="note" style="margin-bottom:8px">${x.rating ? `ELO ${x.rating}${x.ratingAfter ? ` → ${x.ratingAfter}` : ''}` : 'Sin ELO'}${x.minTime != null ? ` · mínimo ${x.minTime} s en el reloj` : ''}</p>
    <div class="mons" style="margin-bottom:10px">${(x.preview.length ? x.preview : x.brought).map(n => spr(n, brought.has(n) ? '' : 'dim')).join('')}</div>
    <div class="tags" style="margin-bottom:10px"><span class="tag">Lead: ${esc(x.leads.join(' + ') || '—')}</span>${x.megas.map(m => `<span class="tag">✦ ${esc(m)}</span>`).join('')}${x.fainted.length ? `<span class="tag">Debilitados: ${x.fainted.length}</span>` : ''}</div>
    ${moves.length ? moves.map(([sp, mv]) => `<div class="mv">${spr(sp, 'sm')}<b>${esc(sp)}</b><span>${mv.map(esc).join(' · ')}</span></div>`).join('') : '<p class="note">Sin movimientos registrados.</p>'}
  </div>`;
}
let notesTimer = null;
async function openDetail(id) {
  const m = await api.get(id);
  if (!m) return;
  const s = m.summary;
  const a = s.me || 'p1', b = s.opp || 'p2';
  $('#modalBox').innerHTML = `<div class="head"><div><h1 style="font-size:22px">${s.me ? `vs ${esc(s[b].name)}` : `${esc(s.p1.name)} vs ${esc(s.p2.name)}`}</h1>
      <p class="note">${fmtDate(s.endedAt)} · ${esc(s.format)} · ${s.turns} turnos${s.forfeit ? ` · ${esc(s.forfeit)} abandonó` : ''}${s.timeout ? ` · ${esc(s.timeout)} perdió por tiempo` : ''} · ${s.source === 'importada' ? 'importada' : 'guardada al jugar'}</p></div>
      <div style="display:flex;gap:8px;align-items:center">${pill(s.result)}<button class="btn" id="mClose">Cerrar</button></div></div>
    <div class="sides">${sideCard(s, a, s.me ? 'Tú' : 'Jugador 1')}${sideCard(s, b, s.me ? 'Rival' : 'Jugador 2')}</div>
    <label class="field">Notas de la partida<textarea id="mNotes" placeholder="Qué viste del rival, errores, ideas para la próxima…">${esc(m.notes || '')}</textarea></label>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px"><span class="note" id="mSaved"></span><button class="btn danger" id="mDel">Borrar partida</button></div>`;
  $('#modal').classList.remove('hide');
  $('#mClose').onclick = closeModal;
  $('#mNotes').oninput = e => {
    clearTimeout(notesTimer);
    notesTimer = setTimeout(async () => { await api.setNotes(id, e.target.value); $('#mSaved').textContent = 'Notas guardadas'; const x = M.find(y => y.id === id); if (x) x.notes = e.target.value; }, 600);
  };
  $('#mDel').onclick = async e => {
    const btn = e.currentTarget;
    if (!btn.classList.contains('sure')) { btn.classList.add('sure'); btn.textContent = '¿Seguro? Pulsa otra vez para borrar'; return; }
    await api.remove(id); closeModal(); load();
  };
}
function closeModal() { $('#modal').classList.add('hide'); if (VIEW === 'partidas') renderList(); }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

/* ---------- Ajustes ---------- */
async function renderSettings() {
  const el = $('#v-ajustes');
  const st = await api.status();
  el.innerHTML = head('Aj<span>ustes</span>', `Macar Showdown ${esc(SET.version || '')}`) + `<div class="grid">
    <div class="card"><h2>Tu usuario de Showdown</h2>
      <p class="note" style="margin-bottom:10px">Sirve para saber qué jugador eres en cada partida. Si tienes varias cuentas, sepáralas con comas. El usuario con el que estés conectado en Showdown se detecta solo.</p>
      <div style="display:flex;gap:8px"><input type="text" id="sName" style="flex:1" value="${esc(SET.showdownName || '')}" placeholder="Por ejemplo: toto110"><button class="btn primary" id="sSave">Guardar</button></div>
      <p id="sMsg" class="okmsg" style="margin-top:8px"></p></div>
    <div class="card"><h2>Importar replays</h2>
      <p class="note" style="margin-bottom:10px">Archivos de replay descargados de Showdown (.html) o enlaces de replay.pokemonshowdown.com. Si una partida ya estaba, no se duplica.</p>
      <button class="btn primary" id="iFiles">Elegir archivos…</button>
      <div style="display:flex;gap:8px;margin-top:12px"><input type="text" id="iUrl" style="flex:1" placeholder="https://replay.pokemonshowdown.com/…"><button class="btn" id="iGo">Importar enlace</button></div>
      <p id="iMsg" style="margin-top:8px"></p></div>
    <div class="card"><h2>Captura automática</h2>
      <dl class="kv"><dt>Estado</dt><dd>${st.ok ? 'Activa' : esc(st.why || '—')}</dd><dt>Conectado como</dt><dd>${esc(st.me || '—')}</dd>
      <dt>Combates abiertos</dt><dd>${st.open ?? 0}</dd><dt>Guardadas en esta sesión</dt><dd>${st.saved ?? 0}</dd>
      <dt>Última comprobación</dt><dd>${st.lastCheck ? new Date(st.lastCheck).toLocaleTimeString('es-ES') : '—'}</dd></dl></div>
    <div class="card"><h2>Tus datos</h2><p class="note" style="margin-bottom:10px">Todo se guarda solo en este ordenador, un archivo por partida.</p>
      <dl class="kv"><dt>Carpeta</dt><dd>${esc(SET.dataDir || '')}</dd></dl><button class="btn" id="oData" style="margin-top:10px">Abrir carpeta</button></div>
  </div>`;
  $('#sSave').onclick = async () => { SET = { ...SET, ...(await api.setSettings({ showdownName: $('#sName').value.trim() })) }; $('#sMsg').textContent = 'Guardado. Partidas actualizadas.'; M = await api.list(); $('#navCount').textContent = M.length; };
  $('#iFiles').onclick = async () => {
    const r = await api.importFiles();
    const m = $('#iMsg');
    m.className = r.failed.length && !r.added ? 'errmsg' : 'okmsg';
    m.innerHTML = `${r.added} nueva${r.added === 1 ? '' : 's'}${r.updated ? `, ${r.updated} ya estaba${r.updated === 1 ? '' : 'n'}` : ''}.${r.failed.length ? `<br>No se pudieron leer: ${r.failed.map(esc).join('; ')}` : ''}`;
    M = await api.list(); $('#navCount').textContent = M.length;
  };
  $('#iGo').onclick = async () => {
    const r = await api.importUrl($('#iUrl').value);
    const m = $('#iMsg');
    m.className = r.ok ? 'okmsg' : 'errmsg';
    m.textContent = r.ok ? (r.saved ? 'Partida importada.' : 'Esa partida ya estaba guardada.') : r.why;
    M = await api.list(); $('#navCount').textContent = M.length;
  };
  $('#oData').onclick = () => api.openData();
}

/* ---------- arranque ---------- */
api.onChanged(() => load());
load();
pollStatus();
