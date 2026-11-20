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

// Replays reales, si se indica una carpeta: REPLAYS=/ruta npm test
if (process.env.REPLAYS) {
  for (const f of fs.readdirSync(process.env.REPLAYS)) {
    const r = parseFile(fs.readFileSync(path.join(process.env.REPLAYS, f), 'utf8'), { id: f });
    t(`replay real ${f.slice(0, 40)}`, () => { assert.ok(r && r.summary.finished && r.summary.p1.preview.length === 6); });
  }
}
console.log(`\n${ok} pruebas correctas`);
