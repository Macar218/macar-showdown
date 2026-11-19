'use strict';
/*
 * Macar Showdown · extensiones de Chrome dentro de Showdown (por ejemplo, Showdex).
 * Se añaden desde la Chrome Web Store (enlace o identificador), desde un .crx / .zip o desde una carpeta
 * descomprimida. Se guardan en <userData>/extensiones y se cargan solo en la sesión de Showdown.
 */
const fs = require('fs');
const path = require('path');
const extractZip = require('extract-zip');

const CWS = id => `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=130.0&acceptformat=crx2,crx3&x=id%3D${id}%26uc`;

class Extensions {
  constructor(userData, ses) {
    this.dir = path.join(userData, 'extensiones');
    this.file = path.join(userData, 'extensiones.json');
    this.ses = ses;
    fs.mkdirSync(this.dir, { recursive: true });
  }
  api() { return this.ses.extensions || this.ses; }
  list() { try { const l = JSON.parse(fs.readFileSync(this.file, 'utf8')); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  write(l) { fs.writeFileSync(this.file, JSON.stringify(l, null, 2)); }

  /** Cargar todas al arrancar. Devuelve las que fallan. */
  async loadAll() {
    const bad = [];
    for (const x of this.list()) {
      try { const e = await this.api().loadExtension(x.path, { allowFileAccess: true }); x.loadedId = e.id; } catch (err) { bad.push(`${x.name}: ${err.message}`); }
    }
    return bad;
  }

  async add(dir, source) {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    let name = manifest.name || path.basename(dir);
    if (/^__MSG_/.test(name)) { // nombre traducido: se busca en _locales
      try {
        const key = name.replace(/^__MSG_|__$/g, '');
        const loc = manifest.default_locale || 'en';
        const msgs = JSON.parse(fs.readFileSync(path.join(dir, '_locales', loc, 'messages.json'), 'utf8'));
        const hit = Object.entries(msgs).find(([k]) => k.toLowerCase() === key.toLowerCase());
        if (hit) name = hit[1].message;
      } catch (e) { /* se queda el nombre técnico */ }
    }
    const e = await this.api().loadExtension(dir, { allowFileAccess: true });
    const l = this.list().filter(x => x.path !== dir);
    l.push({ id: e.id, name, version: manifest.version || '', path: dir, source, added: Date.now() });
    this.write(l);
    return { id: e.id, name };
  }

  /** De un .crx (cabecera Cr24) o .zip a una carpeta descomprimida. */
  async unpack(buf, slug) {
    let zip = buf;
    if (buf.slice(0, 4).toString() === 'Cr24') {
      const ver = buf.readUInt32LE(4);
      const start = ver === 3 ? 12 + buf.readUInt32LE(8) : 16 + buf.readUInt32LE(8) + buf.readUInt32LE(12);
      zip = buf.slice(start);
    }
    const target = path.join(this.dir, `${slug.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}`);
    const tmp = `${target}.zip`;
    fs.writeFileSync(tmp, zip);
    try { await extractZip(tmp, { dir: target }); } finally { fs.rmSync(tmp, { force: true }); }
    if (!fs.existsSync(path.join(target, 'manifest.json'))) throw new Error('No parece una extensión (no tiene manifest.json)');
    return target;
  }

  async addFolder(dir) { return this.add(dir, 'carpeta'); }
  async addFile(file) { return this.add(await this.unpack(fs.readFileSync(file), path.basename(file, path.extname(file))), 'archivo'); }
  async addStore(input) {
    const m = String(input || '').match(/([a-p]{32})/);
    if (!m) throw new Error('Pega el enlace de la Chrome Web Store o el identificador de la extensión (32 letras)');
    const r = await fetch(CWS(m[1]), { redirect: 'follow', signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error(`La Chrome Web Store respondió ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 100) throw new Error('No se ha podido descargar la extensión');
    return this.add(await this.unpack(buf, m[1]), 'Chrome Web Store');
  }
  remove(id) {
    const l = this.list();
    const x = l.find(y => y.id === id);
    if (!x) return false;
    try { this.api().removeExtension(x.loadedId || x.id); } catch (e) { /* ya no estaba cargada */ }
    if (x.path.startsWith(this.dir)) fs.rmSync(x.path, { recursive: true, force: true });
    this.write(l.filter(y => y.id !== id));
    return true;
  }
}

module.exports = { Extensions };
