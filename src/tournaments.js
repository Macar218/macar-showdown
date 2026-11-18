'use strict';
/*
 * Macar Showdown · torneos (Limitless).
 * Lee los torneos online de la regulación actual (últimos 30 días, 16 jugadores o más) y sus hojas de equipo:
 * - sets de torneo: por Pokémon, los objetos, habilidades, naturalezas y movimientos más llevados;
 * - equipos de torneo: los del top 8 de cada torneo, listos para cargar.
 * Las hojas de equipo no traen puntos (SP): esos salen de Smogon.
 * Se guarda en <datos>/torneos.json y se renueva como mucho cada 12 horas.
 */
const fs = require('fs');
const path = require('path');

const API = 'https://play.limitlesstcg.com/api';
const FORMAT = 'M-C';
const DAYS = 30, MIN_PLAYERS = 16, MAX_TOURS = 30, TOP = 8, REFRESH = 12 * 3600 * 1000;

const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

async function getJSON(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`Limitless respondió ${r.status}`);
  return r.json();
}
async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (e) { out[k] = null; } } }));
  return out;
}
const pct = (n, tot) => Math.round((n / tot) * 1000) / 10;
const top = (m, n, tot) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, pct(v, tot)]);

/** De las hojas de equipo a sets por Pokémon y equipos del top. */
function summarize(tours) {
  const mons = new Map();
  const teams = [];
  let nTeams = 0;
  for (const t of tours) {
    if (!t || !t.standings) continue;
    const ranked = t.standings.filter(p => Array.isArray(p.decklist) && p.decklist.length);
    // Si el torneo no tiene puestos, se ordena por récord.
    ranked.sort((a, b) => (a.placing || 999) - (b.placing || 999) || ((b.record || {}).wins || 0) - ((a.record || {}).wins || 0));
    ranked.forEach((p, idx) => {
      nTeams++;
      for (const d of p.decklist) {
        const id = toID(d.id || d.name);
        if (!id) continue;
        if (!mons.has(id)) mons.set(id, { id, name: d.name, n: 0, items: new Map(), abilities: new Map(), natures: new Map(), moves: new Map(), mates: new Map() });
        const x = mons.get(id);
        x.n++;
        if (d.item) x.items.set(d.item, (x.items.get(d.item) || 0) + 1);
        if (d.ability) x.abilities.set(d.ability, (x.abilities.get(d.ability) || 0) + 1);
        if (d.nature) x.natures.set(d.nature, (x.natures.get(d.nature) || 0) + 1);
        for (const mv of d.attacks || []) x.moves.set(mv, (x.moves.get(mv) || 0) + 1);
        for (const o of p.decklist) if (o !== d) { const k = toID(o.id || o.name); x.mates.set(k, (x.mates.get(k) || 0) + 1); }
      }
      const place = p.placing || idx + 1;
      if (place <= TOP) {
        teams.push({
          tour: t.name, tourId: t.id, date: t.date, players: t.players, place, player: p.name, country: p.country || '',
          record: p.record || null,
          team: p.decklist.map(d => ({ id: toID(d.id || d.name), name: d.name, item: d.item || '', ability: d.ability || '', nature: d.nature || '', moves: (d.attacks || []).slice(0, 4) }))
        });
      }
    });
  }
  const sets = {};
  for (const x of mons.values()) {
    sets[x.id] = {
      name: x.name, n: x.n, usage: pct(x.n, nTeams || 1),
      items: top(x.items, 5, x.n), abilities: top(x.abilities, 3, x.n), natures: top(x.natures, 4, x.n), moves: top(x.moves, 10, x.n), mates: top(x.mates, 6, x.n)
    };
  }
  teams.sort((a, b) => new Date(b.date) - new Date(a.date) || a.place - b.place);
  return { sets, teams: teams.slice(0, 400), nTeams };
}

class Tournaments {
  constructor(dir) { this.file = path.join(dir, 'torneos.json'); this.mem = null; this.pending = null; }
  read() {
    if (this.mem) return this.mem;
    try { this.mem = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (e) { this.mem = null; }
    return this.mem;
  }
  async download() {
    const list = await getJSON(`${API}/tournaments?game=VGC&format=${encodeURIComponent(FORMAT)}&limit=150`);
    const since = Date.now() - DAYS * 86400000;
    const chosen = (Array.isArray(list) ? list : [])
      .filter(t => t.format === FORMAT && (t.players || 0) >= MIN_PLAYERS && new Date(t.date).getTime() >= since && new Date(t.date).getTime() <= Date.now())
      .sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, MAX_TOURS);
    const full = await pool(chosen, 4, async t => ({ ...t, standings: await getJSON(`${API}/tournaments/${t.id}/standings`) }));
    const s = summarize(full.filter(Boolean));
    const out = { format: FORMAT, checked: Date.now(), tours: chosen.length, days: DAYS, ...s };
    fs.writeFileSync(this.file, JSON.stringify(out));
    this.mem = out;
    return out;
  }
  async get(force) {
    const c = this.read();
    if (c && !force && Date.now() - (c.checked || 0) < REFRESH) return c;
    if (!this.pending) this.pending = this.download().finally(() => { this.pending = null; });
    try { return await this.pending; } catch (e) { if (c) return c; throw e; }
  }
}

module.exports = { Tournaments, summarize };
