'use strict';
/*
 * Macar Showdown · sets más usados.
 * Descarga las estadísticas mensuales de Smogon (chaos) del formato del combate y se queda con lo útil
 * para la calculadora: habilidades, objetos, repartos de puntos (SP) y movimientos más usados de cada Pokémon.
 * Se guarda en <datos>/uso para no volver a descargarlo (se busca un mes nuevo como mucho una vez al día).
 */
const fs = require('fs');
const path = require('path');

const BASE = 'https://www.smogon.com/stats/';
const DEFAULT_FORMAT = 'gen9championsvgc2026regmc';
const CUTOFF = 1760;
const DAY = 24 * 3600 * 1000;

const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** "[Gen 9 Champions] VGC 2026 Reg M-C (Bo3)" → candidatos de nombre de archivo, del más concreto al más general. */
function formatCandidates(tier) {
  const id = toID(tier);
  const out = [];
  if (id) { out.push(id); if (id.endsWith('bo3')) out.push(id.slice(0, -3)); }
  if (!out.includes(DEFAULT_FORMAT)) out.push(DEFAULT_FORMAT);
  return out;
}

const top = (obj, n, total) => Object.entries(obj || {})
  .filter(([k]) => k && k !== 'nothing' && k !== '')
  .sort((a, b) => b[1] - a[1]).slice(0, n)
  .map(([k, v]) => [k, total ? Math.round((v / total) * 1000) / 10 : 0]);

/** De los datos de Smogon a algo pequeño: por Pokémon, lo más usado. */
function compact(chaos) {
  const out = {};
  for (const [name, d] of Object.entries(chaos.data || {})) {
    const total = Object.values(d.Abilities || {}).reduce((a, b) => a + b, 0) || 1;
    const spreads = top(d.Spreads, 4, total).map(([k, pc]) => {
      const [nature, rest] = k.split(':');
      return { nature, sp: String(rest || '').split('/').map(Number), pc };
    });
    out[name] = {
      usage: Math.round((d.usage || 0) * 1000) / 10,
      abilities: top(d.Abilities, 3, total),
      items: top(d.Items, 5, total),
      spreads,
      moves: top(d.Moves, 10, total)
    };
  }
  return out;
}

async function getText(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`Smogon respondió ${r.status}`);
  return r.text();
}

class Usage {
  constructor(dir) {
    this.dir = path.join(dir, 'uso');
    fs.mkdirSync(this.dir, { recursive: true });
    this.mem = new Map();
    this.pending = new Map();
  }

  file(format) { return path.join(this.dir, `${format}.json`); }

  readCache(format) {
    if (this.mem.has(format)) return this.mem.get(format);
    try {
      const c = JSON.parse(fs.readFileSync(this.file(format), 'utf8'));
      this.mem.set(format, c);
      return c;
    } catch (e) { return null; }
  }

  async months() {
    const html = await getText(BASE);
    return [...new Set([...html.matchAll(/href="(\d{4}-\d{2})\/"/g)].map(m => m[1]))].sort().reverse();
  }

  async download(format, known) {
    const months = (await this.months()).slice(0, 4);
    for (const month of months) {
      if (known && known.month === month) return known; // no hay mes nuevo
      const url = `${BASE}${month}/chaos/${format}-${CUTOFF}.json`;
      let txt;
      try { txt = await getText(url); } catch (e) { continue; }
      const c = { format, month, cutoff: CUTOFF, checked: Date.now(), sets: compact(JSON.parse(txt)) };
      fs.writeFileSync(this.file(format), JSON.stringify(c));
      this.mem.set(format, c);
      return c;
    }
    return null;
  }

  /** Sets del formato del combate. Usa la copia guardada y, si toca, busca un mes nuevo. */
  async get(tier) {
    let firstErr = null;
    for (const format of formatCandidates(tier)) {
      const cached = this.readCache(format);
      if (cached && Date.now() - (cached.checked || 0) < DAY) return cached;
      if (!this.pending.has(format)) {
        this.pending.set(format, this.download(format, cached).finally(() => this.pending.delete(format)));
      }
      try {
        const c = await this.pending.get(format);
        if (c) {
          if (c === cached) { c.checked = Date.now(); try { fs.writeFileSync(this.file(format), JSON.stringify(c)); } catch (e) { /* nada */ } }
          return c;
        }
      } catch (e) {
        firstErr = firstErr || e;
        if (cached) return cached; // sin conexión: lo que haya
      }
    }
    if (firstErr) throw firstErr;
    return null;
  }
}

module.exports = { Usage, compact, formatCandidates, toID };
