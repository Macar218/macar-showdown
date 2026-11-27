'use strict';
// Pruebas del lector, del guardado y de las estadísticas. Uso: npm test
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseLog, parseFile, extractLog } = require('../src/parser');
const { Store, matchId } = require('../src/store');
const Stats = require('../renderer/stats');

const LOG = fs.readFileSync(path.join(__dirname, 'fixtures', 'partida.log'), 'utf8');
let ok = 0;
const t = (name, fn) => { fn(); ok++; console.log(`✓ ${name}`); };

t('lee jugadores, formato y resultado', () => {
  const s = parseLog(LOG, { me: 'Macar Test' });
  assert.strictEqual(s.format, '[Gen 9 Champions] VGC 2026 Reg M-C');
  assert.strictEqual(s.me, 'p2');
  assert.strictEqual(s.result, 'win');
  assert.strictEqual(s.turns, 3);
  assert.strictEqual(s.p2.rating, 1000);
  assert.strictEqual(s.p2.ratingAfter, 1030);
});

t('leads, traídos, megas y formas', () => {
  const s = parseLog(LOG, { me: 'macartest' });
  assert.deepStrictEqual(s.p2.leads, ['Incineroar', 'Charizard']);
  assert.deepStrictEqual(s.p1.leads, ['Mimikyu', 'Garchomp']);
  assert.ok(s.p1.brought.includes('Mimikyu') && !s.p1.brought.includes('Mimikyu-Busted'));
  assert.deepStrictEqual(s.p2.megas, ['Charizard-Mega-Y']);
  assert.deepStrictEqual(s.p2.moves.Charizard, ['Heat Wave']);
  assert.deepStrictEqual(s.p1.fainted, ['Garchomp', 'Mimikyu']);
  assert.strictEqual(s.p2.minTime, 10);
});

t('sin usuario no inventa el resultado', () => {
  const s = parseLog(LOG, {});
  assert.strictEqual(s.me, null);
  assert.strictEqual(s.result, null);
  assert.strictEqual(s.finished, true);
});

t('extrae el registro de un replay .html y de un .json', () => {
  const html = `<html><script type="text/plain" class="battle-log-data">${LOG.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</script></html>`;
  assert.ok(extractLog(html).log.includes('|win|Macar Test'));
  const json = JSON.stringify({ id: 'gen9championsvgc2026regmc-123', log: LOG, uploadtime: 1700000000 });
  const r = parseFile(json);
  assert.strictEqual(r.summary.id, 'gen9championsvgc2026regmc-123');
  assert.strictEqual(r.summary.endedAt, 1700000000000);
  assert.strictEqual(parseFile('hola'), null);
});

t('guardado: no duplica, actualiza si crece y reidentifica', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-'));
  const st = new Store(dir);
  const short = LOG.split('\n').filter(l => !l.includes('rating:')).join('\n');
  assert.ok(st.saveLog({ id: 'battle-gen9championsvgc2026regmc-123', log: short }).saved);
  assert.ok(!st.saveLog({ id: 'gen9championsvgc2026regmc-123-abcdef', log: short }).saved);
  assert.ok(st.saveLog({ id: 'battle-gen9championsvgc2026regmc-123', log: LOG }).saved);
  assert.strictEqual(st.list().length, 1);
  assert.strictEqual(st.list()[0].result, null);
  st.setSettings({ showdownName: 'otro, Macar Test' });
  assert.strictEqual(st.list()[0].result, 'win');
  assert.strictEqual(new Store(dir).list()[0].result, 'win');
  assert.ok(st.setNotes('gen9championsvgc2026regmc-123', 'nota'));
  assert.strictEqual(new Store(dir).get('gen9championsvgc2026regmc-123').notes, 'nota');
  fs.writeFileSync(path.join(dir, 'partidas', 'roto.json'), '{no es json');
  assert.strictEqual(new Store(dir).list().length, 1);
  assert.ok(fs.readdirSync(path.join(dir, 'partidas')).some(f => f.startsWith('roto.json.danado-')));
  st.remove('gen9championsvgc2026regmc-123');
  assert.strictEqual(st.list().length, 0);
  assert.strictEqual(matchId('battle-gen9championsvgc2026regmc-99-pass'), 'gen9championsvgc2026regmc-99');
});

t('estadísticas', () => {
  const s = parseLog(LOG, { me: 'Macar Test', id: 'a' });
  const r = Stats.compute(Stats.filter([s, { ...s, id: 'b', result: 'loss' }], {}));
  assert.strictEqual(r.n, 2); assert.strictEqual(r.w, 1);
  assert.strictEqual(r.myLeads[0].key, 'Charizard + Incineroar');
  assert.strictEqual(Stats.filter([s], { rival: 'Garchomp' }).length, 1);
  assert.strictEqual(Stats.filter([s], { rival: 'Pikachu' }).length, 0);
  assert.deepStrictEqual(r.elo.map(x => x.r), [1000, 1030, 1000, 1030]);
});

t('estadísticas avanzadas (Dashboard)', () => {
  const base = parseLog(LOG, { me: 'Macar Test', id: 'a', endedAt: Date.UTC(2026, 10, 2, 18) });
  const ms = [0, 1, 2, 3, 4].map(i => ({ ...base, id: `m${i}`, endedAt: base.endedAt + i * 20 * 60000, result: i % 2 ? 'loss' : 'win' }));
  const a = Stats.advanced(ms);
  assert.strictEqual(a.all.n, 5);
  assert.strictEqual(a.sessions, 1);
  assert.strictEqual(a.afterWin.n + a.afterLoss.n, 4);
  assert.strictEqual(a.mvp.key.length > 0, true);
  const inc = a.mons.find(x => x.key === 'Incineroar');
  assert.strictEqual(inc.lead.n, 5);
  assert.strictEqual(a.streak, 1);
  assert.strictEqual(Stats.leadsVs(ms, 'Garchomp + Mimikyu')[0].n, 5);
  // filtros por equipo y por fechas
  assert.strictEqual(Stats.filter(ms, { team: 'x', teamOf: s => (s.id === 'm0' ? 'x' : '') }).length, 1);
  assert.strictEqual(Stats.filter(ms, { from: base.endedAt + 30 * 60000 }).length, 3);
});

t('colecciones guardadas (equipos, Mi PC, documentos)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'macar-col-'));
  const st = new Store(dir);
  assert.deepStrictEqual(st.data('equipos'), []);
  assert.deepStrictEqual(st.data('docs'), {});
  st.setData('pc', [{ id: 's1', text: 'Sneasler' }]);
  assert.strictEqual(new Store(dir).data('pc')[0].id, 's1');
  assert.throws(() => st.data('../../etc'));
  st.setSettings({ teamId: 't1' });
  assert.strictEqual(st.settings().teamId, 't1');
});

t('sets más usados de Smogon (resumen)', () => {
  const { compact, formatCandidates } = require('../src/usage');
  assert.deepStrictEqual(formatCandidates('[Gen 9 Champions] VGC 2026 Reg M-C (Bo3)').slice(0, 2), ['gen9championsvgc2026regmcbo3', 'gen9championsvgc2026regmc']);
  const c = compact({ data: { Sneasler: { usage: 0.5, Abilities: { unburden: 70, poisontouch: 30 }, Items: { whiteherb: 50, nothing: 10 }, Spreads: { 'Adamant:2/32/0/0/0/32': 60 }, Moves: { closecombat: 99, '': 5 } } } });
  assert.strictEqual(c.Sneasler.usage, 50);
  assert.deepStrictEqual(c.Sneasler.spreads[0].sp, [2, 32, 0, 0, 0, 32]);
  assert.strictEqual(c.Sneasler.items.length, 1);
  assert.strictEqual(c.Sneasler.abilities[0][1], 70);
});

t('torneos: sets y equipos del top', () => {
  const { summarize } = require('../src/tournaments');
  const mon = (id, item, nature, attacks) => ({ id, name: id, item, ability: 'X', nature, attacks });
  const r = summarize([{ name: 'Copa', id: 't1', date: '2026-11-10', players: 20, standings: [
    { name: 'Ana', placing: 1, record: { wins: 5, losses: 0 }, decklist: [mon('sneasler', 'White Herb', 'Adamant', ['Close Combat', 'Fake Out']), mon('incineroar', 'Sitrus Berry', 'Careful', ['Fake Out'])] },
    { name: 'Bea', placing: 12, record: { wins: 2, losses: 3 }, decklist: [mon('sneasler', 'Focus Sash', 'Jolly', ['Close Combat'])] }
  ] }]);
  assert.strictEqual(r.nTeams, 2);
  assert.strictEqual(r.sets.sneasler.n, 2);
  assert.deepStrictEqual(r.sets.sneasler.moves[0], ['Close Combat', 100]);
  assert.strictEqual(r.teams.length, 1); // solo el top 8
  assert.strictEqual(r.teams[0].player, 'Ana');
});

t('notas en directo y replay pasan a la partida', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'macar-live-'));
  const st = new Store(dir);
  st.setData('liveNotes', { 'gen9championsvgc2026regmc-123': 'Trae Basculegion' });
  st.saveLog({ id: 'battle-gen9championsvgc2026regmc-123', log: LOG });
  assert.strictEqual(st.get('gen9championsvgc2026regmc-123').notes, 'Trae Basculegion');
  st.setReplay('gen9championsvgc2026regmc-123', 'https://replay.pokemonshowdown.com/gen9championsvgc2026regmc-123');
  assert.ok(new Store(dir).list()[0].replay.endsWith('-123'));
  assert.strictEqual(st.settings().autoReplay, true);
});

t('sesiones: la partida se apunta en la abierta', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'macar-ses-'));
  const st = new Store(dir);
  st.setSettings({ sessionId: 'sreg' });
  st.saveLog({ id: 'battle-gen9championsvgc2026regmc-1', log: LOG });
  st.setSettings({ sessionId: '' });
  st.saveLog({ id: 'battle-gen9championsvgc2026regmc-2', log: LOG });
  const L = new Store(dir).list();
  assert.strictEqual(L.find(s => s.id.endsWith('-1')).session, 'sreg');
  assert.strictEqual(L.find(s => s.id.endsWith('-2')).session, null);
  assert.strictEqual(Stats.filter(L.map(s => ({ ...s, me: 'p2', result: 'win' })), { session: 'sreg' }).length, 1);
  assert.strictEqual(st.clearSession('sreg'), 1);
  assert.strictEqual(st.list().filter(s => s.session).length, 0);
});

t('hoja de equipo abierta (showteam)', () => {
  const log = LOG + '\n|showteam|p1|Garchomp||lifeorb|roughskin|earthquake,dragonclaw,protect,rockslide|Jolly||M||||,,,,,]Mimikyu||focussash|disguise|playrough,trickroom|Brave|||||||';
  const s = parseLog(log, { me: 'Macar Test' });
  assert.strictEqual(s.p1.sheet.length, 2);
  assert.deepStrictEqual([s.p1.sheet[0].species, s.p1.sheet[0].item, s.p1.sheet[0].nature], ['Garchomp', 'lifeorb', 'Jolly']);
  assert.strictEqual(s.p1.sheet[1].moves[1], 'trickroom');
  assert.strictEqual(s.p2.sheet, null);
});

t('motor de daño Champions (nivel 50, SP)', () => {
  const c = require('@smogon/calc');
  const g = c.Generations.get(0);
  const a = new c.Pokemon(g, 'Sneasler', { level: 50, nature: 'Adamant', evs: { hp: 2, atk: 32, spe: 32 } });
  assert.deepStrictEqual([a.maxHP(), a.rawStats.atk, a.rawStats.spe], [157, 200, 172]);
});

t('filtros y análisis del Dashboard (lead, reserva, rival, ELO, rivales, equipo, hábitos)', () => {
  const side = (o) => ({ name: '', rating: null, ratingAfter: null, preview: [], leads: [], brought: [], megas: [], moves: {}, fainted: [], minTime: null, sheet: null, ...o });
  const mk = (i, won, me, op, extra = {}) => ({ id: `g-${i}`, endedAt: 1e12 + i * 6e5, formatId: 'gen9championsvgc2026regmc', turns: 6 + i, me: 'p1', opp: 'p2', result: won ? 'win' : 'loss', p1: side(me), p2: side(op), ...extra });
  const A = ['Garchomp', 'Kingambit', 'Charizard', 'Sylveon'];
  const ms = [
    mk(1, true, { leads: ['Garchomp', 'Kingambit'], brought: ['Garchomp', 'Kingambit', 'Charizard', 'Sylveon'], preview: A, moves: { Garchomp: ['Dragon Claw'] } }, { name: 'r1', rating: 1300, preview: ['Sneasler', 'Excadrill'], leads: ['Sneasler', 'Excadrill'], brought: ['Sneasler', 'Excadrill'], sheet: [{}] }),
    mk(2, false, { leads: ['Charizard', 'Sylveon'], brought: ['Charizard', 'Sylveon', 'Garchomp', 'Kingambit'], preview: A, megas: ['Charizard-Mega-Y'] }, { name: 'r2', rating: 1100, preview: ['Sneasler', 'Tyranitar'], leads: ['Tyranitar', 'Excadrill'], brought: ['Tyranitar'] }),
    mk(3, true, { leads: ['Garchomp', 'Charizard'], brought: ['Garchomp', 'Charizard', 'Kingambit', 'Sylveon'], preview: A, moves: { Garchomp: ['Dragon Claw', 'Earthquake'] } }, { name: 'r3', preview: ['Excadrill'], leads: ['Excadrill'], brought: ['Excadrill'] })
  ];
  const f = x => Stats.filter(ms, x).map(s => s.id);
  assert.deepStrictEqual(f({ lead: 'Garchomp' }), ['g-1', 'g-3']);
  assert.deepStrictEqual(f({ lead: 'Garchomp + Kingambit' }), ['g-1']);
  assert.deepStrictEqual(f({ back: 'Kingambit' }), ['g-2', 'g-3']);
  assert.deepStrictEqual(f({ rival: 'Sneasler' }), ['g-1', 'g-2']);
  assert.deepStrictEqual(f({ oppLead: 'Tyranitar' }), ['g-2']);
  assert.deepStrictEqual(f({ minElo: 1200 }), ['g-1']);
  assert.deepStrictEqual(f({ ids: new Set(['g-3']) }), ['g-3']);
  const ov = Stats.overview(ms);
  assert.deepStrictEqual([ov.ots, ov.cts, ov.streak], [{ n: 1, w: 1 }, { n: 2, w: 1 }, 1]);
  const R = Stats.rival(ms, 'Sneasler');
  assert.deepStrictEqual([R.n, R.w, R.leadN, R.mates[0].key], [2, 1, 1, 'Excadrill']);
  const [g] = Stats.teamCards(ms, ['Garchomp']);
  assert.deepStrictEqual([g.n, g.w, g.lead, g.moves[0]], [3, 2, 2, ['Dragon Claw', 2]]);
  const [c] = Stats.teamCards(ms, ['Charizard']);
  assert.deepStrictEqual([c.mega.n, c.mega.w], [1, 0]);
  const H = Stats.habits(ms);
  assert.ok(H.n === 3 && Array.isArray(H.win) && Array.isArray(H.lose));
});

t('guardado: al volver a la ventana solo se releen las partidas cambiadas', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-cache-'));
  const st = new Store(dir);
  st.saveLog({ id: 'battle-gen9championsvgc2026regmc-111', log: LOG });
  assert.strictEqual(st.list().length, 1);
  let reads = 0;
  const orig = st.readJSON.bind(st);
  st.readJSON = (...a) => { reads++; return orig(...a); };
  st.stale = true;
  assert.strictEqual(st.list().length, 1);
  assert.strictEqual(reads, 0);
  fs.copyFileSync(st.file('gen9championsvgc2026regmc-111'), path.join(dir, 'partidas', 'otra.json'));
  const j = JSON.parse(fs.readFileSync(path.join(dir, 'partidas', 'otra.json'), 'utf8')); j.summary.id = 'otra'; fs.writeFileSync(path.join(dir, 'partidas', 'otra.json'), JSON.stringify(j));
  st.stale = true;
  assert.strictEqual(st.list().length, 2);
  assert.strictEqual(reads, 1);
});

t('transcripción de la partida (turnos, movimientos, daño, KO, subidas)', () => {
  const Transcript = require('../renderer/transcript');
  const log = ['|player|p1|Yo|', '|player|p2|Rival|', '|switch|p1a: Gambit|Kingambit, L50|100/100', '|switch|p2a: Corviknight|Corviknight, L50|100/100', '|turn|1',
    '|move|p1a: Gambit|Kowtow Cleave|p2a: Corviknight', '|-damage|p2a: Corviknight|57/100', '|-boost|p1a: Gambit|atk|1', '|move|p2a: Corviknight|Protect|p2a: Corviknight',
    '|turn|2', '|move|p1a: Gambit|Sucker Punch|p2a: Corviknight', '|-crit|p2a: Corviknight', '|-damage|p2a: Corviknight|0 fnt', '|faint|p2a: Corviknight', '|win|Yo'].join('\n');
  const t = Transcript.parse(log);
  assert.deepStrictEqual(t.map(x => x.turn), [0, 1, 2]);
  const mv = t[1].ev[0];
  assert.deepStrictEqual([mv.who.sp, mv.move, mv.tgt.sp, mv.fx[0].t, mv.fx[0].d, mv.fx[1].stat, mv.fx[1].n], ['Kingambit', 'Kowtow Cleave', 'Corviknight', 'dmg', -43, 'Atq', 1]);
  assert.deepStrictEqual(t[2].ev[0].fx.map(f => f.t), ['crit', 'dmg', 'faint']);
});

t('Sitrus Berry en los KO (el motor no la cuenta)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'poke.js'), 'utf8');
  const sitrusKO = new Function(`${src.slice(src.indexOf('function sitrusKO'), src.indexOf('/** Daño de un movimiento'))};return sitrusKO;`)();
  const rolls = Array.from({ length: 16 }, (_, i) => 45 + Math.floor(i / 2)); // 45–52 sobre 200 PS
  const r = sitrusKO(rolls, 200, 200);
  assert.strictEqual(r.n, 5); // sin baya serían 4 golpes; con la cura de 50 PS hacen falta 5
  assert.ok(/after Sitrus Berry recovery/.test(r.text));
  assert.strictEqual(sitrusKO([250], 200, 200).text, 'guaranteed OHKO');
});

t('hoja de equipo (OTS) empaquetada de Showdown', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'poke.js'), 'utf8');
  const unpackSheet = new Function(`${src.slice(src.indexOf('function unpackSheet'), src.indexOf('/** El reparto que no se ve'))};return unpackSheet;`)();
  const s = unpackSheet('Gambit|Kingambit|choplberry|Defiant|kowtowcleave,suckerpunch,ironhead,protect|Adamant||||||]|Incineroar|sitrusberry|Intimidate|fakeout,partingshot|Careful|||||');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(s.map(x => [x.species, x.item, x.ability, x.moves.length, x.nature]))), [['Kingambit', 'choplberry', 'Defiant', 4, 'Adamant'], ['Incineroar', 'sitrusberry', 'Intimidate', 2, 'Careful']]);
});

t('notas: la marca de turno y lo que pasó van en otro color', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'notehl.js'), 'utf8');
  const esc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const NoteHL = new Function('esc', `${src.replace(/^'use strict';/, '')};return NoteHL;`)(esc);
  const out = NoteHL.paint('[T1] Kingambit entra: cuidado <Sucker>\nsin marca\n[T3] solo turno');
  assert.ok(out.startsWith('<span class="nhltag">[T1] Kingambit entra:</span> cuidado &lt;Sucker>'));
  assert.ok(out.includes('\nsin marca\n'));
  assert.ok(out.includes('<span class="nhltag">[T3]</span> solo turno'));
});

t('Macar Dex: lee sus archivos de datos en un contexto aislado', () => {
  const { MacarDex, readData } = require('../src/macardex');
  const w = readData('window.SETS={"garchomp":{"a":[["Rough Skin",90]],"m":[["Earthquake",99]]}};window.X=1;');
  assert.deepStrictEqual(Object.keys(w).sort(), ['SETS', 'X']);
  assert.throws(() => readData('require("fs")'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-dex-'));
  fs.mkdirSync(path.join(dir, 'macardex'));
  fs.writeFileSync(path.join(dir, 'macardex', 'moves.js'), 'window.MOVES=[{"k":"earthquake","n":"Earthquake","t":"Ground","c":"P","p":100,"a":100,"d":"Hits adjacent Pokemon."}];window.LEARN={"garchomp":[0]};');
  fs.writeFileSync(path.join(dir, 'macardex', 'sets.js'), 'window.SETS={"garchomp":{"a":[["Rough Skin",90]],"m":[["Earthquake",99]]}};');
  const d = new MacarDex(dir).build();
  assert.deepStrictEqual(JSON.parse(JSON.stringify([d.learn.garchomp, d.moves.earthquake.p, d.sets.garchomp.a[0][0]])), [["earthquake"], 100, "Rough Skin"]);
});

t('la interfaz no tiene errores de sintaxis', () => {
  const dir = path.join(__dirname, '..', 'renderer');
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.js'))) {
    try { new Function(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { throw new Error(`${f}: ${e.message}`); }
  }
});
t('marcas de cada partida (buena, mala, analizar) y su filtro', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-mark-'));
  const st = new Store(dir);
  st.saveLog({ id: 'battle-gen9championsvgc2026regmc-1', log: LOG });
  st.saveLog({ id: 'battle-gen9championsvgc2026regmc-2', log: LOG });
  st.setNotes('gen9championsvgc2026regmc-2', 'Mirar el turno 3');
  assert.ok(st.setMark('gen9championsvgc2026regmc-1', { r: 'good', a: true }));
  st.setMark('gen9championsvgc2026regmc-2', { r: 'nada' });
  // Al volver a guardar la partida (el registro crece) la marca se queda.
  st.saveLog({ id: 'battle-gen9championsvgc2026regmc-1', log: `${LOG}\n|raw|fin` });
  const L = new Store(dir).list().map(x => ({ ...x, me: 'p2', result: 'win' }));
  assert.deepStrictEqual(L.find(x => x.id.endsWith('-1')).mark, { r: 'good', a: true });
  assert.strictEqual(L.find(x => x.id.endsWith('-2')).mark, null);
  const ids = f => Stats.filter(L, { mark: f }).map(x => x.id.slice(-1)).sort().join(',');
  assert.strictEqual(ids('good'), '1');
  assert.strictEqual(ids('analyze'), '1');
  assert.strictEqual(ids('bad'), '');
  assert.strictEqual(ids('notes'), '2');
  assert.strictEqual(ids('none'), '2');
  // Analizada: deja de estar «por analizar» y pasa a «ya analizadas».
  st.setMark('gen9championsvgc2026regmc-1', { r: 'good', a: 'done' });
  const L2 = new Store(dir).list().map(x => ({ ...x, me: 'p2', result: 'win' }));
  assert.strictEqual(Stats.filter(L2, { mark: 'analyze' }).length, 0);
  assert.strictEqual(Stats.filter(L2, { mark: 'analyzed' }).map(x => x.id.slice(-1)).join(','), '1');
});

t('Macar Dex: habilidades posibles de cada Pokémon (data.js)', () => {
  const { MacarDex } = require('../src/macardex');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-dex2-'));
  fs.mkdirSync(path.join(dir, 'macardex'));
  fs.writeFileSync(path.join(dir, 'macardex', 'sets.js'), 'window.SETS={};');
  fs.writeFileSync(path.join(dir, 'macardex', 'data.js'), 'window.DEX=[{"k":"incineroar","n":"Incineroar","a":[["Blaze",0],["Intimidate",1]]}];');
  assert.strictEqual(new MacarDex(dir).build().abil.incineroar.join(','), 'Blaze,Intimidate');
});

t('sesiones: sin archivo de sesiones se devuelve una lista vacía', () => {
  const st = new Store(fs.mkdtempSync(path.join(os.tmpdir(), 'ms-ses-')));
  assert.ok(Array.isArray(st.data('sesiones')));
});

// Replays reales, si se indica una carpeta: REPLAYS=/ruta npm test
if (process.env.REPLAYS) {
  for (const f of fs.readdirSync(process.env.REPLAYS)) {
    const r = parseFile(fs.readFileSync(path.join(process.env.REPLAYS, f), 'utf8'), { id: f });
    t(`replay real ${f.slice(0, 40)}`, () => { assert.ok(r && r.summary.finished && r.summary.p1.preview.length === 6); });
  }
}
t('regulación: la de por defecto, una elegida y una escrita a mano', () => {
  const { regOf, REGS } = require('../src/regs');
  assert.strictEqual(regOf({}).id, REGS[0].id);
  assert.deepStrictEqual(regOf({ reg: { id: 'Gen9 Champions VGC 2027 Reg X', name: 'Reg X', limitless: 'X' } }), { id: 'gen9championsvgc2027regx', name: 'Reg X', limitless: 'X' });
  assert.strictEqual(regOf({ reg: { id: '' } }).id, REGS[0].id);
});

t('copia de seguridad: guarda todo, se lee y se restaura sin perder lo de antes', () => {
  const backup = require('../src/backup');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-')), out = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-'));
  const st = new Store(dir);
  st.saveLog({ id: 'battle-gen9championsvgc2026regmc-7', log: LOG });
  st.setData('equipos', [{ id: 't1', name: 'Mío', side: 'me', text: '' }]);
  fs.writeFileSync(path.join(dir, 'torneos.json'), '{}'); // caché: no entra
  const f = path.join(out, 'copia.macarbackup');
  const r = backup.create(dir, f, 'x');
  assert.strictEqual(r.matches, 1);
  assert.deepStrictEqual(backup.peek(f).matches, 1);
  assert.ok(!Object.keys(backup.collect(dir)).includes('torneos.json'));
  // En otra carpeta con una partida propia: se añaden las de la copia y se conserva la propia.
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-')), st2 = new Store(dir2);
  st2.saveLog({ id: 'battle-gen9championsvgc2026regmc-8', log: LOG });
  const x = backup.restore(dir2, f, path.join(out, 'antes.macarbackup'), 'x');
  assert.ok(fs.existsSync(x.before));
  assert.strictEqual(new Store(dir2).list().length, 2);
  assert.strictEqual(new Store(dir2).data('equipos')[0].name, 'Mío');
  fs.writeFileSync(path.join(out, 'mala.macarbackup'), 'nada');
  assert.throws(() => backup.peek(path.join(out, 'mala.macarbackup')));
});

t('análisis: momentos clave del registro, motivos (análisis y notas) y filtro', () => {
  const Transcript = require('../renderer/transcript');
  const km = Transcript.keyMoments(Transcript.parse(LOG));
  assert.ok(km.some(k => k.t === 'ko' && k.sp === 'Garchomp' && k.by === 'Charizard-Mega-Y' && k.move === 'Heat Wave'));
  assert.ok(km.some(k => k.t === 'mega'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-')), st = new Store(dir);
  st.setSettings({ showdownName: 'Macar Test' });
  st.saveLog({ id: 'battle-gen9championsvgc2026regmc-9', log: LOG });
  assert.ok(st.setReview('gen9championsvgc2026regmc-9', { why: ['macro', 'nada', 'macro'], lesson: 'Guardar a Garchomp para Charizard' }));
  const s = st.list()[0];
  assert.deepStrictEqual(s.review.why, ['macro']);
  st.setNotes(s.id, '[T2] Detalle: no vi el Tailwind\n[T3] Expectation: era Sash');
  const s2 = st.list()[0];
  assert.deepStrictEqual([...Stats.whyOf(s2)].sort(), ['detail', 'expect', 'macro']);
  assert.strictEqual(Stats.filter([s2], { why: 'detail' }).length, 1);
  assert.strictEqual(Stats.filter([s2], { why: 'luck' }).length, 0);
  const w = Stats.whyCount([{ ...s2, result: 'loss' }]);
  assert.strictEqual(w.n.macro, 1); assert.strictEqual(w.lessons[0].text, 'Guardar a Garchomp para Charizard');
  // Notas generales (sin turno) y lo bien hecho (verde): cuentan para el filtro, no para «Por qué pierdes».
  assert.deepStrictEqual(Stats.tagOf('Buena jugada: Protect en el T3'), { k: 'gplay', good: true, turn: null, label: 'Buena jugada', text: 'Protect en el T3' });
  assert.strictEqual(Stats.tagOf('[T4] Macro: cambio malo').turn, 4);
  assert.strictEqual(Stats.tagOf('[T1] Garchomp entra:'), null);
  st.setNotes(s.id, 'Macro: sin plan para Charizard\n[T5] Good read: Protect');
  const s3 = st.list()[0];
  assert.deepStrictEqual([...Stats.whyOf(s3)].sort(), ['gpredict', 'macro']);
  assert.strictEqual(Stats.filter([s3], { why: 'gpredict' }).length, 1);
  assert.ok(!('gpredict' in Stats.whyCount([{ ...s3, result: 'loss' }]).n));
  assert.ok(st.setReview(s.id, { why: ['gplan', 'team'], lesson: '' }));
  assert.deepStrictEqual(st.list()[0].review.why, ['gplan', 'team']);
  // Si el registro crece (se vuelve a guardar), no se pierden el análisis ni el equipo con que se jugó.
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-')), st2 = new Store(dir2);
  st2.setSettings({ showdownName: 'Macar Test', teamId: 't-uno' });
  st2.saveLog({ id: 'battle-gen9championsvgc2026regmc-8', log: LOG.split('\n').slice(0, 20).join('\n') });
  st2.setSettings({ teamId: 't-dos' });
  st2.setReview('gen9championsvgc2026regmc-8', { why: ['luck'], lesson: 'x' });
  st2.saveLog({ id: 'battle-gen9championsvgc2026regmc-8', log: LOG });
  const s4 = st2.list()[0];
  assert.strictEqual(s4.team, 't-uno');
  assert.deepStrictEqual(s4.review.why, ['luck']);
});

// El índice local de partidas: arranca sin abrir los archivos, ve los cambios de fuera y no pierde lo guardado mientras lee.
t('plan de temporada: reparto, semanas, estudio, días sin jugar y regulación', () => {
  const S = require('../renderer/season');
  // Reparto de 5 en 5 que suma el total.
  assert.deepStrictEqual(S.split(90, 'play'), { tb: 0, play: 65, serious: 0, an: 25 });
  assert.deepStrictEqual(S.split(90, 'tbplay'), { tb: 45, play: 30, serious: 0, an: 15 });
  for (const t of S.TYPES) for (const m of [30, 45, 60, 95, 120, 150]) assert.strictEqual(S.sum(S.split(m, t.k)), m);
  assert.strictEqual(S.weekOf('2026-11-29'), '2026-11-23');
  assert.strictEqual(S.weekOf('2026-11-23'), '2026-11-23');
  assert.strictEqual(S.parseDur('2h30'), 150); assert.strictEqual(S.parseDur('1h'), 60); assert.strictEqual(S.parseDur("45'"), 45); assert.strictEqual(S.parseDur(0.0625), 90);
  const plan = { cfg: { avg: 8 }, weeks: { '2026-11-23': { target: 6, focus: 'play' } }, regs: [{ id: 'r', name: 'M-C', start: '2026-11-09', end: '2026-12-06' }] };
  const sess = [
    { id: 'a', type: 'tb', state: 'done', day: '2026-11-10', planMin: 120, realDay: '2026-11-10', realMin: 150, min: { tb: 150, play: 0, serious: 0, an: 0 } },
    { id: 'b', type: 'play', state: 'done', day: '2026-11-24', planMin: 120, realDay: '2026-11-24', realMin: 120 },
    { id: 'c', type: 'serious', state: 'plan', day: '2026-11-27', planMin: 90 },
    { id: 'd', type: 'play', state: 'skip', day: '2026-11-25', planMin: 60 },
    { id: 'e', type: 'play', state: 'done', realDay: '2026-11-26', realMin: 0, track: { tb: 0, play: 40.4, serious: 0, an: 10.2 } },
    { id: 'f', type: 'serious', state: 'done', day: '2026-11-21', planMin: 60, realDay: '2026-11-24', realMin: 60 } // prevista una semana, hecha la siguiente
  ];
  const w = S.week('2026-11-23', sess, plan, [], '');
  assert.strictEqual(w.target, 6);
  assert.deepStrictEqual(w.done, { tb: 0, play: 90 + 40, serious: 40, an: 30 + 10 + 20 });
  assert.strictEqual(w.prevH, (120 + 90) / 60); // la saltada no cuenta en lo previsto; la de la semana anterior, tampoco
  assert.strictEqual(w.doneN, 3);
  const w0 = S.week('2026-11-16', sess, plan, [], '');
  assert.strictEqual(w0.prevH, 1); assert.strictEqual(w0.doneH, 0);
  assert.strictEqual(S.week('2026-11-30', sess, plan, [], '').target, 8);
  const st = S.study('2026-11-23', sess, plan, [], '');
  assert.ok(st.real > 0.5 && st.real < 0.6); // (150 + 60) / (150 + 220)
  assert.strictEqual(S.light(0.4, plan), 'good'); assert.strictEqual(S.light(0.25, plan), 'warn'); assert.strictEqual(S.light(0.1, plan), 'bad');
  assert.ok(/Jugar/.test(S.advice(0.7, plan)));
  const lp = S.lastPlay(sess, [{ me: 'p1', endedAt: new Date(2026, 10, 20, 20).getTime() }], '', '2026-11-29');
  assert.deepStrictEqual(lp, { last: '2026-11-26', days: 3 });
  assert.strictEqual(S.next(sess, '2026-11-26').id, 'c');
  assert.deepStrictEqual(S.pendingPast(sess, '2026-11-28').map(s => s.id), ['c']);
  const r = S.reg(plan.regs[0], sess, plan, [], '', '2026-11-29');
  assert.strictEqual(r.weeks.length, 4); assert.strictEqual(r.closed, 2); // la del 23 acaba el 29: aún no está cerrada
  assert.strictEqual(Math.round(r.doneH * 10), Math.round(((150 + 120 + 50 + 60) / 60) * 10));
  // Sesión antigua (sin estado): hecha, con lo jugado estimado por sus partidas.
  const old = S.realMin({ id: 'o', created: Date.now() }, [{ session: 'o', me: 'p1', turns: 6 }], '');
  assert.ok(old.est && old.play === 7);
});

t('modo predicción: aciertos en las notas', () => {
  const notes = ['[T1] 🎯 ✔ Protect y Heat Wave', 'Macro: algo', '[T2] 🎯 ≈ Fake Out al Charizard', '[T3] 🎯 ✘ cambio a Garchomp', '[T4] nota normal'].join('\n');
  assert.deepStrictEqual(Stats.predsOf(notes).map(p => [p.turn, p.r]), [[1, 1], [2, 0.5], [3, 0]]);
  const c = Stats.predCount([{ notes }, { notes: '' }, { notes: '[T5] 🎯 ✔ x' }]);
  assert.deepStrictEqual([c.n, c.hit, c.games], [4, 2.5, 2]);
  assert.strictEqual(Stats.tagOf('[T1] 🎯 ✔ Protect'), null); // no es una nota de análisis
});

t('base Jugar : Análisis (referencia, no regla)', () => {
  const S = require('../renderer/season');
  assert.strictEqual(S.ratio({ play: 90, serious: 30, an: 50 }), 2.4);
  assert.strictEqual(S.ratio({ play: 0, an: 0 }), null);
  assert.strictEqual(S.ratio({ play: 60, an: 0 }), Infinity);
  assert.strictEqual(S.ratioLight(2.4, {}), 'good'); assert.strictEqual(S.ratioLight(3.5, {}), 'warn'); assert.strictEqual(S.ratioLight(6, {}), 'bad'); assert.strictEqual(S.ratioLight(1, {}), 'bad');
  assert.strictEqual(S.ratioLight(1.6, { cfg: { ratio: [1.5, 2] } }), 'good');
  assert.ok(/analizar/.test(S.ratioAdvice(6, {}))); assert.ok(/jugar más/.test(S.ratioAdvice(1, {})));
  assert.strictEqual(S.ratioTxt(2.44, 'es-ES'), '2,4 : 1');
});

t('torneos: CP con el cupo de jugadores, Best Finish Limit y dinero', () => {
  const S = require('../renderer/season');
  assert.deepStrictEqual(S.cpFor('regional', 5, 620), { cp: 280, usd: 1000, kick: false });
  assert.deepStrictEqual(S.cpFor('regional', 5, 10), { cp: 0, usd: 0, kick: true }); // pocos jugadores para ese puesto
  assert.strictEqual(S.cpFor('limitless', 1, 500).cp, 0);
  assert.strictEqual(S.seasonOf('2026-09-01'), 2027); assert.strictEqual(S.seasonOf('2026-08-30'), 2026);
  const list = [1, 2, 3, 4, 5, 6].map(i => ({ id: `r${i}`, tier: i % 2 ? 'regional' : 'intl', place: i * 3, players: 2000, date: `2026-10-0${i}` }))
    .concat([{ id: 'w', tier: 'regional', place: 1, players: 900, entry: 50, extra: 0, costs: { travel: 100 } }, { id: 'l', tier: 'limitless', place: 1, extra: 20 }]);
  const s = S.seasonSum(list, { cfg: { rate: 1.25 } });
  const ri = s.groups.find(g => g.g === 'ri');
  assert.strictEqual(ri.played, 7); assert.strictEqual(ri.counted, 5);
  assert.ok(ri.ids.includes('w'));
  assert.ok(s.invite); // ganó un Regional
  const w = s.list.find(t => t.id === 'w');
  assert.strictEqual(w.prize, 6000 / 1.25); assert.strictEqual(w.cost, 150); assert.strictEqual(w.net, 6000 / 1.25 - 150);
  assert.strictEqual(s.list.find(t => t.id === 'l').won, 20);
  assert.strictEqual(S.tour({ tier: 'cup', place: 1, players: 10, cp: 33 }, {}).cp, 33); // el CP que pongas manda
});

t('importar los Excel del plan y de torneos', () => {
  const X = require('../src/xlsx');
  const R = require('../src/rtw');
  const book = X.read(fs.readFileSync(path.join(__dirname, 'fixtures', 'plan.xlsx')));
  assert.ok(book.Sesiones && book.Semanas);
  assert.strictEqual(X.excelDay(46335), '2026-11-09');
  const p = R.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'plan.xlsx')));
  assert.strictEqual(p.kind, 'plan');
  assert.strictEqual(p.sessions.length, 4);
  const [a, b, c, d] = p.sessions;
  assert.deepStrictEqual([a.type, a.day, a.planMin, a.state, a.realDay, a.realMin, a.ok, a.goal], ['play', '2026-03-03', 120, 'done', '2026-03-03', 150, true, 'Menos errores de macro']);
  assert.deepStrictEqual(a.min, { tb: 0, play: 110, serious: 0, an: 40 });
  assert.deepStrictEqual([b.type, b.state, b.realDay], ['serious', 'skip', '']);
  assert.deepStrictEqual([c.type, c.day, c.planMin, c.state, c.ok], ['tb', '', 0, 'done', false]); // hecha sin prever
  assert.deepStrictEqual([d.type, d.state, d.day], ['coach', 'plan', '2026-03-10']);
  assert.deepStrictEqual(p.weeks['2026-03-02'], { focus: 'play', target: 8, note: 'Buena semana' });
  assert.ok(p.weeks['2026-03-09']); // tiene una sesión prevista
  assert.deepStrictEqual(p.regs[0].eval, { tb: 'Corto', play: 'Bien', serious: '', an: 'Largo' });
  assert.strictEqual(p.regs[0].ok, true);
  assert.deepStrictEqual(p.cfg, { avg: 7, green: [25, 45], gap: 4 });
  // Importar dos veces da los mismos ids (sustituye, no duplica).
  assert.deepStrictEqual(R.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'plan.xlsx'))).sessions.map(s => s.id), p.sessions.map(s => s.id));
  const t = R.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'torneos.xlsx')));
  assert.strictEqual(t.kind, 'tours');
  assert.deepStrictEqual(t.tours.map(x => x.name), ['Regional Madrid', 'Limitless #3']); // sin el ejemplo ni el resumen
  const m = t.tours[0];
  assert.deepStrictEqual([m.tier, m.mode, m.players, m.place, m.entry, m.date], ['regional', 'inperson', 700, 7, 40, '2026-03-14']);
  assert.deepStrictEqual(m.costs, { travel: 100, lodging: 150, food: 50, other: 0 });
  assert.strictEqual(t.tours[1].tier, 'limitless'); assert.strictEqual(t.tours[1].extra, 15);
  assert.strictEqual(t.cfg.rate, 1.1);
  assert.throws(() => R.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'partida.log'))));
});

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-')), idx = dir + '-indice.json';
  let st = new Store(dir, idx);
  st.saveLog({ id: 'battle-gen9championsvgc2026regmc-1', log: LOG });
  st.saveLog({ id: 'battle-gen9championsvgc2026regmc-2', log: LOG });
  st.flushIndex();
  assert.ok(fs.existsSync(idx));
  st = new Store(dir, idx);
  assert.strictEqual(st.cache.size, 2); // del índice, sin leer la carpeta
  assert.strictEqual((await st.listAsync()).length, 2);
  const v = st.ver; st.stale = true; await st.listAsync(); assert.strictEqual(st.ver, v); // sin cambios, misma versión
  // Otro ordenador (OneDrive) borra una partida y cambia otra.
  fs.unlinkSync(st.file('gen9championsvgc2026regmc-2'));
  const f = st.file('gen9championsvgc2026regmc-1'), m = JSON.parse(fs.readFileSync(f, 'utf8'));
  m.summary.notes = 'de fuera'; fs.writeFileSync(f, JSON.stringify(m)); fs.utimesSync(f, new Date(), new Date(Date.now() + 5000));
  st.stale = true; const p = st.listAsync();
  st.saveLog({ id: 'battle-gen9championsvgc2026regmc-3', log: LOG }); // se guarda una mientras se lee
  const L = await p;
  assert.deepStrictEqual(L.map(x => x.id).sort(), ['gen9championsvgc2026regmc-1', 'gen9championsvgc2026regmc-3']);
  assert.strictEqual(L.find(x => x.id === 'gen9championsvgc2026regmc-1').notes, 'de fuera');
  assert.ok(st.ver > v);
  // El índice de otra carpeta no se usa.
  st.flushIndex();
  assert.strictEqual(new Store(fs.mkdtempSync(path.join(os.tmpdir(), 'ms-')), idx).list().length, 0);
  ok++; console.log('✓ índice de partidas: arranque rápido, cambios de fuera y guardado durante la lectura');
  // Copia automática: sin bloquear, una por semana.
  const backup = require('../src/backup');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-'));
  const a1 = await backup.auto(dir, folder, 'x');
  assert.ok(a1 && a1.matches === 2 && fs.existsSync(a1.file));
  assert.strictEqual(await backup.auto(dir, folder, 'x'), null);
  assert.strictEqual(backup.peek(a1.file).matches, 2);
  ok++; console.log('✓ copia automática semanal sin bloquear');
  console.log(`\n${ok} pruebas correctas`);
})().catch(e => { console.error(e); process.exit(1); });
