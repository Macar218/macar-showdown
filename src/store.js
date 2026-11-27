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
  /**
   * indexFile (opcional): índice local de resúmenes (fuera de la carpeta de datos, así no lo sincroniza OneDrive).
   * Con él, arrancar con miles de partidas no obliga a abrir todos los archivos: solo los nuevos o cambiados.
   */
  constructor(dir, indexFile = null) {
    this.dir = dir;
    this.mdir = path.join(dir, 'partidas');
    this.settingsFile = path.join(dir, 'ajustes.json');
    fs.mkdirSync(this.mdir, { recursive: true });
    this.cache = null;
    this.ver = 0; // sube cada vez que cambia la lista de partidas
    this.indexFile = indexFile;
    this.loadIndex();
  }

  loadIndex() {
    if (!this.indexFile) return;
    try {
      const x = JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
      if (!x || x.v !== 1 || x.dir !== this.dir || !Array.isArray(x.files)) return;
      const cache = new Map(), mtimes = new Map();
      for (const [f, t, s] of x.files) if (s && s.id) { cache.set(s.id, s); mtimes.set(f, { t, id: s.id }); }
      this.cache = cache; this.mtimes = mtimes; this.stale = true; // se comprueba contra la carpeta en la primera lectura
    } catch (e) { /* sin índice: se lee la carpeta */ }
  }

  /** Guarda el índice un poco después del último cambio (varios cambios seguidos, una sola escritura). */
  saveIndexSoon() {
    if (!this.indexFile || this.idxTimer) return;
    this.idxTimer = setTimeout(() => this.writeIndex(), 1500);
    if (this.idxTimer.unref) this.idxTimer.unref();
  }
  /** Escribe el índice ya (al salir, si había uno pendiente). */
  writeIndex() {
    clearTimeout(this.idxTimer); this.idxTimer = null;
    {
      try {
        const files = [];
        for (const [f, { t, id }] of this.mtimes || []) { const s = this.cache && this.cache.get(id); if (s) files.push([f, t, s]); }
        fs.mkdirSync(path.dirname(this.indexFile), { recursive: true });
        this.writeAtomic(this.indexFile, JSON.stringify({ v: 1, dir: this.dir, files }));
      } catch (e) { /* el índice es solo una ayuda */ }
    }
  }
  flushIndex() { if (this.idxTimer) this.writeIndex(); }

  /** Algo cambió en la lista: nueva versión e índice al día. */
  touched() { this.ver++; this.sorted = null; this.saveIndexSoon(); }

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
    if (this.pending) (this.during || (this.during = new Map())).set(id, m.summary);
    this.touched();
  }

  file(id) { return path.join(this.mdir, `${String(id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)}.json`); }

  list() {
    if (!this.cache || this.stale) this.refresh();
    return this.sortedList();
  }
  sortedList() {
    if (!this.sorted) this.sorted = [...this.cache.values()].sort((a, b) => b.endedAt - a.endedAt);
    return this.sorted;
  }

  /** Como list(), pero sin bloquear: la carpeta se lee por tandas en segundo plano. Las llamadas a la vez comparten la lectura. */
  async listAsync() {
    if (!this.cache || this.stale) await this.refreshAsync();
    return this.sortedList();
  }

  refreshAsync() {
    if (this.pending) return this.pending;
    this.stale = false; // lo que cambie mientras se lee volverá a marcarlo
    this.pending = (async () => {
      const fsp = fs.promises;
      const old = this.cache || new Map(), seen = this.mtimes || new Map();
      const cache = new Map(), mtimes = new Map();
      let changed = !this.cache;
      const names = (await fsp.readdir(this.mdir)).filter(f => f.endsWith('.json'));
      for (let i = 0; i < names.length; i += 200) {
        await Promise.all(names.slice(i, i + 200).map(async f => {
          const file = path.join(this.mdir, f);
          let t = 0;
          try { t = (await fsp.stat(file)).mtimeMs; } catch (e) { return; }
          const prev = seen.get(f);
          if (prev && prev.t === t && old.has(prev.id)) { cache.set(prev.id, old.get(prev.id)); mtimes.set(f, prev); return; }
          changed = true;
          let m = null;
          try { m = JSON.parse(await fsp.readFile(file, 'utf8')); } catch (e) { m = this.readJSON(file, null); }
          if (m && m.summary && m.summary.id) { cache.set(m.summary.id, m.summary); mtimes.set(f, { t, id: m.summary.id }); }
        }));
      }
      if (cache.size !== old.size) changed = true;
      // Lo guardado o borrado mientras tanto (captura, notas) no se pierde.
      for (const [id, sum] of this.during || []) {
        const f = path.basename(this.file(id));
        if (sum) { cache.set(id, sum); const x = seen.get(f); if (x) mtimes.set(f, x); } else { cache.delete(id); mtimes.delete(f); }
        changed = true;
      }
      this.during = null;
      this.cache = cache; this.mtimes = mtimes;
      if (changed) this.touched();
    })().finally(() => { this.pending = null; });
    return this.pending;
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
    const changed = !this.cache || cache.size !== this.cache.size || [...cache].some(([id, s]) => this.cache.get(id) !== s);
    this.cache = cache; this.mtimes = mtimes; this.stale = false;
    if (changed) this.touched();
  }

  get(id) { return fs.existsSync(this.file(id)) ? this.readJSON(this.file(id), null) : null; }

  /** Guarda (o actualiza, si el registro ha crecido) una partida a partir de su registro. */
  saveLog({ id, log, clientName = null, endedAt = null, source = 'auto' }) {
    if (!this.cache) this.refresh();
    const mid = matchId(id);
    const prev = this.get(mid);
    if (prev && prev.log && prev.log.length >= log.length) return { saved: false, summary: prev.summary };
    // Notas escritas durante el combate (barra de notas de Jugar): pasan a la partida al guardarla.
    let live = '';
    try { live = (this.data('liveNotes') || {})[mid] || ''; } catch (e) { live = ''; }
    const m = { log, clientName: clientName || (prev && prev.clientName) || null, source: prev ? prev.source : source, notes: (prev && prev.notes) || live, replay: prev ? prev.replay || null : null, mark: (prev && prev.mark) || null,
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
    s.mark = m.mark || null;
    s.review = m.review || null;
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

  /** Marca de la partida: r = 'good' | 'meh' | 'bad' | '' (cómo fue) y a = true (por analizar) o 'done' (ya analizada). */
  setMark(id, mark) {
    const m = this.get(id);
    if (!m) return false;
    const r = ['good', 'meh', 'bad'].includes(mark && mark.r) ? mark.r : '';
    const a = mark && mark.a === 'done' ? 'done' : !!(mark && mark.a);
    m.mark = r || a ? { r, a } : null;
    m.summary.mark = m.mark;
    this.writeMatch(id, m);
    if (this.cache) this.cache.set(id, m.summary);
    return true;
  }

  /**
   * Análisis de la partida: why = por qué fue así (equipo, team preview, mecánica, expectativa, predicción, macro,
   * detalle, error de juego, suerte, otra cosa) y lesson = lo que te llevas.
   */
  setReview(id, review) {
    const m = this.get(id);
    if (!m) return false;
    const why = [...new Set((review && Array.isArray(review.why) ? review.why : []).filter(k => Store.WHY.includes(k)))];
    const lesson = String((review && review.lesson) || '').slice(0, 1000);
    m.review = why.length || lesson.trim() ? { why, lesson } : null;
    m.summary.review = m.review;
    this.writeMatch(id, m);
    if (this.cache) this.cache.set(id, m.summary);
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
    if (!this.cache) this.refresh();
    this.cache.delete(id);
    if (this.pending) (this.during || (this.during = new Map())).set(id, null);
    this.touched();
  }
}

Store.WHY = ['team', 'preview', 'mechanic', 'expect', 'predict', 'macro', 'detail', 'play', 'luck', 'other'];
Store.KEYS = ['equipos', 'pc', 'docs', 'partidaTeam', 'liveNotes', 'sesiones', 'bo3Notes', 'matchups'];

module.exports = { Store, matchId };
