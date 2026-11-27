'use strict';
/*
 * Macar Showdown · copia de seguridad.
 * Todo lo tuyo (partidas, equipos, Mi PC, documentos, matchups, sesiones, notas y ajustes) en un solo archivo
 * comprimido (.macarbackup). Lo que se puede volver a descargar (Smogon, Macar Dex, torneos) no entra.
 * Restaurar añade las partidas de la copia (las que ya tienes con el mismo id se sustituyen) y pone las colecciones
 * de la copia; antes guarda una copia de cómo estaba todo, por si acaso.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OK = rel => /^partidas\/[A-Za-z0-9_-]{1,120}\.json$/.test(rel) || /^[A-Za-z]{1,40}\.json$/.test(rel);
const SKIP = new Set(['torneos.json']);

/** Lo que entra en la copia: los .json de la carpeta de datos y de partidas. */
function collect(dir) {
  const files = {};
  const add = rel => { if (!OK(rel) || SKIP.has(rel)) return; try { files[rel] = fs.readFileSync(path.join(dir, rel), 'utf8'); } catch (e) { /* nada */ } };
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) add(f);
  const pd = path.join(dir, 'partidas');
  if (fs.existsSync(pd)) for (const f of fs.readdirSync(pd)) if (f.endsWith('.json')) add(`partidas/${f}`);
  return files;
}

function create(dir, file, version) {
  const files = collect(dir);
  const body = JSON.stringify({ app: 'macar-showdown', v: 1, version, created: Date.now(), files });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, zlib.gzipSync(body));
  fs.renameSync(tmp, file);
  const matches = Object.keys(files).filter(k => k.startsWith('partidas/')).length;
  return { file, matches, files: Object.keys(files).length, bytes: fs.statSync(file).size };
}

function read(file) {
  let x;
  try { x = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')); } catch (e) { throw new Error('No es una copia de Macar Showdown o está dañada.'); }
  if (!x || x.app !== 'macar-showdown' || x.v !== 1 || !x.files || typeof x.files !== 'object') throw new Error('No es una copia de Macar Showdown.');
  return x;
}

/** Lo que trae una copia, sin tocar nada (para preguntar antes). */
function peek(file) {
  const x = read(file);
  const keys = Object.keys(x.files).filter(OK);
  return { created: x.created, version: x.version || '', matches: keys.filter(k => k.startsWith('partidas/')).length, files: keys.length };
}

/** Restaura: primero una copia de cómo estaba (before), luego escribe lo de la copia. */
function restore(dir, file, before, version) {
  const x = read(file);
  const saved = create(dir, before, version);
  let n = 0;
  fs.mkdirSync(path.join(dir, 'partidas'), { recursive: true });
  for (const [rel, txt] of Object.entries(x.files)) {
    if (!OK(rel) || SKIP.has(rel) || typeof txt !== 'string') continue;
    try { JSON.parse(txt); } catch (e) { continue; } // nada roto
    const to = path.join(dir, ...rel.split('/'));
    const tmp = `${to}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, txt); fs.renameSync(tmp, to); n++;
  }
  return { restored: n, before: saved.file };
}

/** Copia automática local: una por semana, se quedan las 4 últimas. */
function auto(dir, folder, version) {
  fs.mkdirSync(folder, { recursive: true });
  const list = fs.readdirSync(folder).filter(f => /^auto-.*\.macarbackup$/.test(f)).sort();
  const last = list.length ? fs.statSync(path.join(folder, list[list.length - 1])).mtimeMs : 0;
  if (Date.now() - last < 7 * 24 * 3600 * 1000) return null;
  const r = create(dir, path.join(folder, `auto-${new Date().toISOString().slice(0, 10)}.macarbackup`), version);
  for (const f of fs.readdirSync(folder).filter(f => /^auto-.*\.macarbackup$/.test(f)).sort().slice(0, -4)) { try { fs.unlinkSync(path.join(folder, f)); } catch (e) { /* nada */ } }
  return r;
}

module.exports = { create, peek, restore, auto, collect };
