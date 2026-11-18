'use strict';
/*
 * Macar Showdown · guardado en disco.
 * Cada partida es un archivo JSON propio en <datos>/partidas, así un archivo dañado no se lleva al resto.
 * Las escrituras son atómicas: se escribe en un temporal y se renombra.
 */
const fs = require('fs');
const path = require('path');
const { parseLog } = require('./parser');

/** Identificador estable de una partida: "formato-número" (sin "battle-" ni la contraseña de los replays privados). */
const matchId = raw => String(raw || '').replace(/^battle-/, '').split('-').slice(0, 2).join('-');

class Store {
  constructor(dir) {
    this.dir = dir;
    this.mdir = path.join(dir, 'partidas');
    this.settingsFile = path.join(dir, 'ajustes.json');
    fs.mkdirSync(this.mdir, { recursive: true });
    this.cache = null;
  }

  writeAtomic(file, data) {
    const tmp = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, file);
  }

  readJSON(file, fallback) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      // Si existe pero no se puede leer, se aparta en vez de pisarlo.
      if (fs.existsSync(file)) { try { fs.renameSync(file, `${file}.danado-${Date.now()}`); } catch (_) { /* nada */ } }
      return fallback;
    }
  }

  settings() {
    return { showdownName: '', ...this.readJSON(this.settingsFile, {}) };
  }

  setSettings(patch) {
    const before = this.settings();
    const s = { ...before, ...patch };
    this.writeAtomic(this.settingsFile, JSON.stringify(s, null, 2));
    if (before.showdownName !== s.showdownName) this.reidentify();
    return s;
  }

  /** Mis nombres: los de ajustes (separados por comas) y el del cliente en el momento de la partida. */
  myNames(match) {
    return this.settings().showdownName.split(',').map(x => x.trim()).filter(Boolean).concat(match && match.clientName ? [match.clientName] : []);
  }

  file(id) { return path.join(this.mdir, `${String(id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)}.json`); }

  list() {
    if (!this.cache) {
      this.cache = new Map();
      for (const f of fs.readdirSync(this.mdir)) {
        if (!f.endsWith('.json')) continue;
        const m = this.readJSON(path.join(this.mdir, f), null);
        if (m && m.summary && m.summary.id) this.cache.set(m.summary.id, m.summary);
      }
    }
    return [...this.cache.values()].sort((a, b) => b.endedAt - a.endedAt);
  }

  get(id) { return fs.existsSync(this.file(id)) ? this.readJSON(this.file(id), null) : null; }

  /** Guarda (o actualiza, si el registro ha crecido) una partida a partir de su registro. */
  saveLog({ id, log, clientName = null, endedAt = null, source = 'auto' }) {
    this.list();
    const mid = matchId(id);
    const prev = this.get(mid);
    if (prev && prev.log && prev.log.length >= log.length) return { saved: false, summary: prev.summary };
    const m = { log, clientName: clientName || (prev && prev.clientName) || null, source: prev ? prev.source : source, notes: prev ? prev.notes || '' : '' };
    m.summary = this.summarize(mid, m, endedAt || (prev && prev.summary.endedAt) || Date.now());
    this.writeAtomic(this.file(mid), JSON.stringify(m));
    this.cache.set(mid, m.summary);
    return { saved: true, summary: m.summary, isNew: !prev };
  }

  summarize(id, m, endedAt) {
    const s = parseLog(m.log, { id, endedAt, me: this.myNames(m) });
    s.source = m.source;
    s.notes = m.notes || '';
    return s;
  }

  /** Vuelve a calcular quién soy en todas las partidas (al cambiar el usuario en ajustes). */
  reidentify() {
    for (const s of this.list()) {
      const m = this.get(s.id);
      if (!m) continue;
      m.summary = this.summarize(s.id, m, s.endedAt);
      this.writeAtomic(this.file(s.id), JSON.stringify(m));
      this.cache.set(s.id, m.summary);
    }
  }

  setNotes(id, notes) {
    const m = this.get(id);
    if (!m) return false;
    m.notes = String(notes || '').slice(0, 5000);
    m.summary.notes = m.notes;
    this.writeAtomic(this.file(id), JSON.stringify(m));
    this.cache.set(id, m.summary);
    return true;
  }

  remove(id) {
    try { fs.unlinkSync(this.file(id)); } catch (e) { /* ya no estaba */ }
    this.list();
    this.cache.delete(id);
  }
}

module.exports = { Store, matchId };
