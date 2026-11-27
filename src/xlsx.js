'use strict';
/*
 * Macar Showdown · lector mínimo de Excel (.xlsx), sin dependencias.
 * Un .xlsx es un zip con XML dentro: se lee el directorio del zip, se descomprime cada parte con zlib y de cada hoja
 * se sacan los valores de las celdas (los ya calculados de las fórmulas). Solo lectura y solo valores.
 */
const zlib = require('zlib');

/** Entradas del zip: nombre → contenido (Buffer). */
function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('No es un archivo .xlsx');
  const n = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Archivo .xlsx dañado');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nl);
    p += 46 + nl + el + cl;
    if (!/\.(xml|rels)$/.test(name)) continue;
    const lnl = buf.readUInt16LE(off + 26), lel = buf.readUInt16LE(off + 28);
    const data = buf.subarray(off + 30 + lnl + lel, off + 30 + lnl + lel + csize);
    out[name] = method === 8 ? zlib.inflateRawSync(data) : method === 0 ? Buffer.from(data) : null;
  }
  return out;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unxml = s => String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()]));
/** Texto de un <si> o <is>: todos sus <t> (también los de texto enriquecido), sin la fonética (<rPh>). */
const textOf = x => [...x.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m => unxml(m[1])).join('');
const attr = (tag, a) => { const m = tag.match(new RegExp(`\\b${a}="([^"]*)"`)); return m ? unxml(m[1]) : ''; };

/** Libro: { hoja: { 'B7': valor } } con números, textos y verdadero/falso. */
function read(buf) {
  const z = unzip(buf);
  const str = k => (z[k] ? z[k].toString('utf8') : '');
  const shared = [...str('xl/sharedStrings.xml').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m => textOf(m[1]));
  const rels = {};
  for (const m of str('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)) rels[attr(m[0], 'Id')] = attr(m[0], 'Target');
  const book = {};
  for (const m of str('xl/workbook.xml').matchAll(/<sheet\b[^>]*>/g)) {
    const name = attr(m[0], 'name'), rid = attr(m[0], 'r:id');
    let target = rels[rid] || '';
    if (!target) continue;
    target = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    const xml = str(target), cells = {};
    for (const c of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const a = c[1], body = c[2] || '';
      const ref = attr(`<c${a}>`, 'r'), t = attr(`<c${a}>`, 't');
      if (!ref) continue;
      let v;
      if (t === 'inlineStr') v = textOf(body);
      else {
        const vm = body.match(/<v>([\s\S]*?)<\/v>/);
        if (!vm) continue;
        const raw = unxml(vm[1]);
        v = t === 's' ? shared[+raw] : t === 'str' || t === 'e' ? raw : t === 'b' ? raw === '1' : +raw;
      }
      if (v === '' || v == null || (typeof v === 'number' && isNaN(v))) continue;
      cells[ref] = v;
    }
    book[name] = cells;
  }
  return book;
}

/** Filas de una hoja: [{ n: número de fila, A: …, B: … }] en orden. */
function rows(sheet) {
  const by = new Map();
  for (const [ref, v] of Object.entries(sheet || {})) {
    const m = ref.match(/^([A-Z]+)(\d+)$/);
    if (!m) continue;
    const n = +m[2];
    if (!by.has(n)) by.set(n, { n });
    by.get(n)[m[1]] = v;
  }
  return [...by.values()].sort((a, b) => a.n - b.n);
}
/** Número de fecha de Excel → 'AAAA-MM-DD'. */
function excelDay(v) {
  if (typeof v !== 'number' || v < 20000 || v > 80000) return '';
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
  return d.toISOString().slice(0, 10);
}

module.exports = { read, rows, excelDay, unzip };
