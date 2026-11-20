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
    return { showdownName: '', teamId: '', sessionId: '', autoReplay: true, ...this.readJSON(this.settingsFile, {}) };
  }

  setSettings(patch) {
    const before = this.settings();
    const s = { ...before, ...patch };
    this.writeAtomic(this.settingsFile, JSON.stringify(s, null, 2));
    if (before.showdownName !== s.showdownName) this.reidentify();
    return s;
  }

  /**
   * Colecciones de la app, un archivo JSON cada una en la carpeta de datos:
   * equipos (Team Box: tuyos y de rivales), pc (sets guardados en Mi PC), docs (documentos de preparación),
   * partidaTeam (qué equipo usaste en cada partida).
   */
  data(key) {
    if (!Store.KEYS.includes(key)) throw new Error(`Colección desconocida: ${key}`);
    const fallback = key === 'equipos' || key === 'pc' || key === 'sesiones' ? [] : {};
    const v = this.readJSON(path.join(this.dir, `${key}.json`), fallback);
    return v == null ? fallback : v;
  }

  setData(key, value) {
    if (!Store.KEYS.includes(key)) throw new Error(`Colección desconocida: ${key}`);
    const txt = JSON.stringify(value == null ? null : value, null, 1);
    if (txt.length > 20 * 1024 * 1024) throw new Error('Demasiados datos');
    this.writeAtomic(path.join(this.dir, `${key}.json`), txt);
    return true;
  }

  /** Mis nombres: los de ajustes (separados por comas) y el del cliente en el momento de la partida. */
  myNames(match) {
    return this.settings().showdownName.split(',').map(x => x.trim()).filter(Boolean).concat(match && match.clientName ? [match.clientName] : []);
  }

  /** Guarda una partida y apunta su fecha de modificación (para no releerla al volver a la ventana). */
  writeMatch(id, m) {
    const file = this.file(id);
    this.writeAtomic(file, JSON.stringify(m));
    if (this.cache) this.cache.set(id, m.summary);
    try { (this.mtimes || (this.mtimes = new Map())).set(path.basename(file), { t: fs.statSync(file).mtimeMs, id }); } catch (e) { /* nada */ }
  }

  file(id) { return path.join(this.mdir, `${String(id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)}.json`); }

  list() {
    if (!this.cache || this.stale) this.refresh();
    return [...this.cache.values()].sort((a, b) => b.endedAt - a.endedAt);
  }

  /**
   * Relee la carpeta de partidas. Solo abre los archivos nuevos o cambiados (por fecha de modificación):
   * así volver a la ventana no bloquea la app aunque haya cientos de partidas.
   */
  refresh() {
    const old = this.cache || new Map(), seen = this.mtimes || new Map();
    const cache = new Map(), mtimes = new Map();
    for (const f of fs.readdirSync(this.mdir)) {
      if (!f.endsWith('.json')) continue;
      const file = path.join(this.mdir, f);
      let t = 0;
      try { t = fs.statSync(file).mtimeMs; } catch (e) { continue; }
      const prev = seen.get(f);
      if (prev && prev.t === t && old.has(prev.id)) { cache.set(prev.id, old.get(prev.id)); mtimes.set(f, prev); continue; }
      const m = this.readJSON(file, null);
      if (m && m.summary && m.summary.id) { cache.set(m.summary.id, m.summary); mtimes.set(f, { t, id: m.summary.id }); }
    }
    this.cache = cache; this.mtimes = mtimes; this.stale = false;
  }

  get(id) { return fs.existsSync(this.file(id)) ? this.readJSON(this.file(id), null) : null; }

  /** Guarda (o actualiza, si el registro ha crecido) una partida a partir de su registro. */
  saveLog({ id, log, clientName = null, endedAt = null, source = 'auto' }) {
    this.list();
    const mid = matchId(id);
    const prev = this.get(mid);
    if (prev && prev.log && prev.log.length >= log.length) return { saved: false, summary: prev.summary };
    // Notas escritas durante el combate (barra de notas de Jugar): pasan a la partida al guardarla.
    let live = '';
    try { live = (this.data('liveNotes') || {})[mid] || ''; } catch (e) { live = ''; }
    const m = { log, clientName: clientName || (prev && prev.clientName) || null, source: prev ? prev.source : source, notes: (prev && prev.notes) || live, replay: prev ? prev.replay || null : null,
      // La partida se apunta en la sesión abierta al jugarla.
      session: prev ? prev.session || null : (this.settings().sessionId || null) };
    m.summary = this.summarize(mid, m, endedAt || (prev && prev.summary.endedAt) || Date.now());
    this.writeMatch(mid, m);
    this.cache.set(mid, m.summary);
    return { saved: true, summary: m.summary, isNew: !prev };
  }

  summarize(id, m, endedAt) {
    const s = parseLog(m.log, { id, endedAt, me: this.myNames(m) });
    s.source = m.source;
    s.notes = m.notes || '';
    s.replay = m.replay || null;
    s.session = m.session || null;
    s.rounds = m.rounds || null;
    return s;
  }

  /** Vuelve a calcular quién soy en todas las partidas (al cambiar el usuario en ajustes). */
  reidentify() {
    for (const s of this.list()) {
      const m = this.get(s.id);
      if (!m) continue;
      m.summary = this.summarize(s.id, m, s.endedAt);
      this.writeMatch(s.id, m);
      this.cache.set(s.id, m.summary);
    }
  }

  setNotes(id, notes) {
    const m = this.get(id);
    if (!m) return false;
    m.notes = String(notes || '').slice(0, 5000);
    m.summary.notes = m.notes;
    this.writeMatch(id, m);
    this.cache.set(id, m.summary);
    return true;
  }

  /** Cambiar la sesión de una partida (null = sin sesión). */
  setSession(id, sid) {
    const m = this.get(id);
    if (!m) return false;
    m.session = sid || null;
    m.summary.session = m.session;
    this.writeMatch(id, m);
    if (this.cache) this.cache.set(id, m.summary);
    return true;
  }
  /** Quitar una sesión de todas sus partidas (al borrarla). */
  clearSession(sid) {
    let n = 0;
    for (const s of this.list()) if (s.session === sid) { this.setSession(s.id, null); n++; }
    return n;
  }

  /** Enlace de la replay subida a Showdown. */
  setReplay(id, url) {
    const m = this.get(id);
    if (!m) return false;
    m.replay = String(url || '') || null;
    m.summary.replay = m.replay;
    this.writeMatch(id, m);
    if (this.cache) this.cache.set(id, m.summary);
    return true;
  }

  remove(id) {
    try { fs.unlinkSync(this.file(id)); } catch (e) { /* ya no estaba */ }
    this.list();
    this.cache.delete(id);
  }
}

Store.KEYS = ['equipos', 'pc', 'docs', 'partidaTeam', 'liveNotes', 'sesiones', 'bo3Notes'];

module.exports = { Store, matchId };
