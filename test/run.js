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

t('motor de daño Champions (nivel 50, SP)', () => {
  const c = require('@smogon/calc');
  const g = c.Generations.get(0);
  const a = new c.Pokemon(g, 'Sneasler', { level: 50, nature: 'Adamant', evs: { hp: 2, atk: 32, spe: 32 } });
  assert.deepStrictEqual([a.maxHP(), a.rawStats.atk, a.rawStats.spe], [157, 200, 172]);
});

// Replays reales, si se indica una carpeta: REPLAYS=/ruta npm test
if (process.env.REPLAYS) {
  for (const f of fs.readdirSync(process.env.REPLAYS)) {
    const r = parseFile(fs.readFileSync(path.join(process.env.REPLAYS, f), 'utf8'), { id: f });
    t(`replay real ${f.slice(0, 40)}`, () => { assert.ok(r && r.summary.finished && r.summary.p1.preview.length === 6); });
  }
}
console.log(`\n${ok} pruebas correctas`);
