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

// Replays reales, si se indica una carpeta: REPLAYS=/ruta npm test
if (process.env.REPLAYS) {
  for (const f of fs.readdirSync(process.env.REPLAYS)) {
    const r = parseFile(fs.readFileSync(path.join(process.env.REPLAYS, f), 'utf8'), { id: f });
    t(`replay real ${f.slice(0, 40)}`, () => { assert.ok(r && r.summary.finished && r.summary.p1.preview.length === 6); });
  }
}
console.log(`\n${ok} pruebas correctas`);
