'use strict';
/*
 * Macar Showdown · datos de la Macar Dex (https://macar218.github.io/macar-dex/).
 * La Macar Dex actualiza cada lunes su uso y sus sets. Aquí se bajan sus archivos de datos (movimientos con
 * descripción y lo que aprende cada Pokémon, sets de Smogon, objeto y reparto más usados, uso y nombres en español),
 * se guardan en <datos>/macardex y se vuelven a pedir como mucho una vez al día. Sin conexión, la última copia.
 * Los archivos son JS de datos («window.X = {...}»): se leen en un contexto aislado sin nada más que un «window».
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = 'https://macar218.github.io/macar-dex/';
const FILES = ['moves.js', 'sets.js', 'items.js', 'meta.js', 'es.js'];
const DAY = 24 * 3600 * 1000;

function readData(src) {
  const sandbox = { window: {} };
  vm.runInNewContext(String(src), sandbox, { timeout: 3000 });
  return sandbox.window;
}

class MacarDex {
  constructor(dataDir) {
    this.dir = path.join(dataDir, 'macardex');
    this.cache = null;
    this.loading = null;
  }

  stamp() { try { return JSON.parse(fs.readFileSync(path.join(this.dir, 'fecha.json'), 'utf8')).t || 0; } catch (e) { return 0; } }

  async download() {
    fs.mkdirSync(this.dir, { recursive: true });
    let ok = 0;
    for (const f of FILES) {
      try {
        const r = await fetch(BASE + f, { signal: AbortSignal.timeout(30000), cache: 'no-store' });
        if (!r.ok) continue;
        const txt = await r.text();
        readData(txt); // que se pueda leer antes de guardarlo
        fs.writeFileSync(path.join(this.dir, f), txt);
        ok++;
      } catch (e) { /* se queda la copia anterior */ }
    }
    if (ok) fs.writeFileSync(path.join(this.dir, 'fecha.json'), JSON.stringify({ t: Date.now() }));
    return ok;
  }

  /** Lo que usa la app, en un objeto compacto. */
  build() {
    const w = {};
    for (const f of FILES) {
      try { Object.assign(w, readData(fs.readFileSync(path.join(this.dir, f), 'utf8'))); } catch (e) { /* falta ese archivo */ }
    }
    if (!w.MOVES && !w.SETS) return null;
    const moves = {};
    for (const m of w.MOVES || []) moves[m.k] = { n: m.n, t: m.t, c: m.c, p: m.p, a: m.a, pp: m.pp, pr: m.pr, tg: m.tg, d: m.d };
    const list = w.MOVES || [];
    const learn = {};
    for (const [k, ids] of Object.entries(w.LEARN || {})) learn[k] = ids.map(i => (list[i] ? list[i].k : null)).filter(Boolean);
    return {
      t: this.stamp(), src: w.SRC || {}, moves, learn, sets: w.SETS || {}, csets: w.CSETS || {},
      usage: (w.USAGES && w.USAGES.showdown) || {}, online: (w.USAGES && w.USAGES.online) || {},
      es: { m: (w.ES && w.ES.m) || {}, md: (w.ES && w.ES.md) || {}, a: (w.ES && w.ES.a) || {}, ad: (w.ES && w.ES.ad) || {}, n: (w.ES && w.ES.n) || {} }
    };
  }

  async get(force) {
    if (this.cache && !force && Date.now() - this.stamp() < DAY) return this.cache;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      if (force || Date.now() - this.stamp() > DAY) await this.download();
      this.cache = this.build();
      return this.cache;
    })().finally(() => { this.loading = null; });
    return this.loading;
  }
}

module.exports = { MacarDex, readData };
