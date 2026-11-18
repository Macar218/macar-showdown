'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const fs = require('fs');
const path = require('path');
const { Store } = require('./src/store');
const { parseFile } = require('./src/parser');
const capture = require('./src/capture');
const { LIVE } = require('./src/live');
const { Usage } = require('./src/usage');

const SHOWDOWN = /^https:\/\/([a-z0-9-]+\.)*pokemonshowdown\.com(\/|$)/i;
const PARTITION = 'persist:showdown';

let win = null;
let store = null;
let usage = null;
let sdContents = null; // el webview de Showdown, para leer el combate en directo
let capStatus = { ok: false, why: 'Abre la pestaña Jugar para empezar', open: 0, finished: 0, saved: 0 };

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

const openExternal = url => { if (/^https:\/\//i.test(String(url))) shell.openExternal(url); };
const notify = (summary) => { if (win && !win.isDestroyed()) win.webContents.send('ms:changed', summary || null); };

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1000, minHeight: 640,
    backgroundColor: '#050d24',
    title: 'Macar Showdown',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
      spellcheck: false
    }
  });

  // El webview solo puede ser Showdown, sin preload y aislado.
  win.webContents.on('will-attach-webview', (event, prefs, params) => {
    delete prefs.preload;
    prefs.nodeIntegration = false;
    prefs.contextIsolation = true;
    prefs.sandbox = true;
    if (params.partition !== PARTITION || !SHOWDOWN.test(params.src)) event.preventDefault();
  });
  win.webContents.on('did-attach-webview', (_e, contents) => {
    contents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
    contents.on('will-navigate', (event, url) => { if (!SHOWDOWN.test(url)) { event.preventDefault(); openExternal(url); } });
    sdContents = contents;
    contents.once('destroyed', () => { if (sdContents === contents) sdContents = null; });
    capStatus = capture.attach(contents, ({ id, log, clientName }) => {
      try {
        const r = store.saveLog({ id, log, clientName, source: 'auto' });
        if (r.saved) notify(r.summary);
        return r;
      } catch (e) {
        console.error('[captura]', e);
        return null;
      }
    });
  });

  // La propia app no navega a ningún sitio; los enlaces externos van al navegador.
  win.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('file://')) { event.preventDefault(); openExternal(url); } });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  if (!app.isPackaged && process.env.MACAR_CAPTURAS) win.webContents.once('did-finish-load', () => capturas(process.env.MACAR_CAPTURAS));
  win.on('closed', () => { win = null; });
  // Al volver a la ventana se relee la carpeta: si jugaste en otro ordenador (OneDrive), aparece aquí.
  win.on('focus', () => { if (store) { store.cache = null; notify({ focus: true }); } });
}

/**
 * Solo desarrollo: ejecuta un guion de pasos y guarda capturas (MACAR_CAPTURAS = carpeta).
 * MACAR_PASOS = archivo JSON con [{ "js": "...", "wait": 1000, "shot": "nombre" }]. Sin él, recorre las pantallas.
 * Los errores de la consola van a <carpeta>/consola.txt.
 */
async function capturas(dir) {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const shot = async name => fs.writeFileSync(path.join(dir, `${name}.png`), (await win.webContents.capturePage()).toPNG());
  const log = path.join(dir, 'consola.txt');
  fs.writeFileSync(log, '');
  win.webContents.on('console-message', (e) => { const lv = e.level; if (lv === 'warning' || lv === 'error' || lv === 2 || lv === 3) fs.appendFileSync(log, `[${lv}] ${e.message}
`); });
  let steps = ['dash', 'partidas', 'ajustes', 'jugar'].map(v => ({ js: `show('${v}')`, wait: 1500, shot: v }));
  if (process.env.MACAR_PASOS) steps = JSON.parse(fs.readFileSync(process.env.MACAR_PASOS, 'utf8'));
  await wait(2500);
  for (const st of steps) {
    try {
      if (st.js) { const r = await win.webContents.executeJavaScript(st.js); if (r !== undefined) fs.appendFileSync(log, `[js] ${JSON.stringify(r).slice(0, 4000)}
`); }
    } catch (e) { fs.appendFileSync(log, `[paso] ${e.message}
`); }
    await wait(st.wait || 800);
    if (st.shot) await shot(st.shot);
  }
  app.quit();
}

function importText(text, name, mtime) {
  const r = parseFile(text, { id: name, endedAt: mtime });
  if (!r) return { ok: false, why: 'No parece una partida de Showdown' };
  const id = r.summary.id && /\d/.test(r.summary.id) ? r.summary.id : `importada-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const res = store.saveLog({ id, log: r.log, endedAt: r.summary.endedAt || mtime, source: 'importada' });
  return { ok: true, saved: res.saved };
}

/* ---------- carpeta de datos ---------- */
const locationFile = () => path.join(app.getPath('userData'), 'ubicacion.json');
const defaultDataDir = () => path.join(app.getPath('userData'), 'datos');
function oneDriveDir() {
  const c = [process.env.OneDrive, process.env.OneDriveConsumer, process.env.OneDriveCommercial, path.join(app.getPath('home'), 'OneDrive')];
  return c.find(d => d && fs.existsSync(d)) || null;
}
function readLocation() {
  try { const j = JSON.parse(fs.readFileSync(locationFile(), 'utf8')); return j && j.dataDir ? j.dataDir : null; } catch (e) { return null; }
}
function writeLocation(dir) { fs.writeFileSync(locationFile(), JSON.stringify({ dataDir: dir }, null, 2)); }
/** Copia a la carpeta nueva lo que no esté ya allí (no pisa nada: si en el otro ordenador ya hay datos, mandan esos). */
function copyMissing(from, to) {
  let n = 0;
  fs.mkdirSync(to, { recursive: true });
  if (!fs.existsSync(from)) return 0;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) n += copyMissing(a, b);
    else if (!fs.existsSync(b) && !/\.tmp-|\.danado-/.test(e.name)) { fs.copyFileSync(a, b); n++; }
  }
  return n;
}

function registerIpc() {
  ipcMain.handle('ms:list', () => store.list());
  ipcMain.handle('ms:get', (_e, id) => store.get(String(id)));
  ipcMain.handle('ms:delete', (_e, id) => { store.remove(String(id)); notify(); return true; });
  ipcMain.handle('ms:notes', (_e, id, text) => store.setNotes(String(id), String(text || '')));
  ipcMain.handle('ms:settings', () => ({ ...store.settings(), dataDir: store.dir, version: app.getVersion() }));
  ipcMain.handle('ms:setSettings', (_e, patch) => {
    const clean = {};
    if (patch && typeof patch.showdownName === 'string') clean.showdownName = patch.showdownName.slice(0, 200);
    if (patch && typeof patch.teamId === 'string') clean.teamId = patch.teamId.slice(0, 60);
    const s = store.setSettings(clean);
    notify();
    return s;
  });
  ipcMain.handle('ms:status', () => ({ ...capStatus }));
  ipcMain.handle('ms:openData', () => shell.openPath(store.dir));
  ipcMain.handle('ms:openExternal', (_e, url) => openExternal(url));

  // Calculadora
  ipcMain.handle('ms:live', async () => {
    if (!sdContents || sdContents.isDestroyed()) return { ok: false, why: 'Showdown no está abierto' };
    try { return await sdContents.executeJavaScript(LIVE, false); } catch (e) { return { ok: false, why: e.message }; }
  });
  ipcMain.handle('ms:usage', async (_e, tier) => {
    try { return { ok: true, ...(await usage.get(String(tier || ''))) }; } catch (e) { return { ok: false, why: e.message }; }
  });
  ipcMain.handle('ms:data', (_e, key) => store.data(String(key)));
  ipcMain.handle('ms:setData', (_e, key, value) => { const r = store.setData(String(key), value); notify({ data: String(key) }); return r; });
  ipcMain.handle('ms:matchLog', (_e, id) => { const m = store.get(String(id)); return m ? m.log : null; });

  // Carpeta de datos (para tenerlo todo igual en todos tus ordenadores, por ejemplo en OneDrive).
  ipcMain.handle('ms:dataDir', () => ({ dir: store.dir, def: defaultDataDir(), onedrive: oneDriveDir(), fixed: !!(!app.isPackaged && process.env.MACAR_DATOS) }));
  ipcMain.handle('ms:setDataDir', async (_e, mode) => {
    let target;
    if (mode === 'onedrive') { const od = oneDriveDir(); if (!od) return { ok: false, why: 'No encuentro OneDrive en este ordenador' }; target = path.join(od, 'Macar Showdown'); }
    else if (mode === 'default') target = defaultDataDir();
    else {
      const r = await dialog.showOpenDialog(win, { title: 'Carpeta de datos de Macar Showdown', properties: ['openDirectory', 'createDirectory'] });
      if (r.canceled || !r.filePaths[0]) return { ok: false, why: null };
      target = r.filePaths[0];
    }
    if (path.resolve(target) === path.resolve(store.dir)) return { ok: true, same: true };
    try {
      const copied = copyMissing(store.dir, target);
      writeLocation(target);
      setTimeout(() => { app.relaunch(); app.exit(0); }, 400);
      return { ok: true, dir: target, copied };
    } catch (e) { return { ok: false, why: e.message }; }
  });
  // Añadir un equipo al teambuilder de Showdown (se guarda en la sesión de Showdown de la pestaña Jugar).
  ipcMain.handle('ms:sdAddTeam', async (_e, name, text, format) => {
    if (!sdContents || sdContents.isDestroyed()) return { ok: false, why: 'Abre la pestaña Jugar primero' };
    const js = `(() => { try {
      const S = window.Storage;
      if (!S || !S.importTeam || !S.packTeam || !S.teams) return { ok: false, why: 'Showdown aún no ha cargado' };
      const team = S.importTeam(${JSON.stringify(String(text || '').slice(0, 20000))});
      if (!team || !team.length) return { ok: false, why: 'El equipo está vacío' };
      S.teams.unshift({ name: ${JSON.stringify(String(name || 'Macar Showdown').slice(0, 80))}, format: ${JSON.stringify(String(format || 'gen9championsvgc2026regmc'))}, team: S.packTeam(team), folder: '', iconCache: '' });
      S.saveTeams();
      try { window.app.user.trigger('saveteams'); } catch (e) {}
      return { ok: true };
    } catch (e) { return { ok: false, why: String((e && e.message) || e) }; } })()`;
    try { return await sdContents.executeJavaScript(js, false); } catch (e) { return { ok: false, why: e.message }; }
  });
  // Documento de preparación a PDF: se pinta en una ventana oculta y se imprime.
  ipcMain.handle('ms:savePdf', async (_e, html, name) => {
    const devPdf = !app.isPackaged && process.env.MACAR_PDF;
    const r = devPdf ? { canceled: false, filePath: devPdf } : await dialog.showSaveDialog(win, { title: 'Guardar PDF de preparación', defaultPath: path.join(app.getPath('documents'), String(name || 'preparacion.pdf').replace(/[\\/:*?"<>|]/g, '_')), filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (r.canceled || !r.filePath) return { ok: false, why: null };
    const w = new BrowserWindow({ show: false, width: 900, height: 1200, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false } });
    try {
      w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      w.webContents.on('will-navigate', ev => ev.preventDefault());
      await w.loadURL(`data:text/html;charset=utf-8;base64,${Buffer.from(String(html)).toString('base64')}`);
      await new Promise(res => setTimeout(res, 1200)); // que carguen los sprites
      const pdf = await w.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { marginType: 'none' } });
      fs.writeFileSync(r.filePath, pdf);
      if (!devPdf) shell.showItemInFolder(r.filePath);
      return { ok: true, file: r.filePath };
    } catch (e) { return { ok: false, why: e.message }; } finally { w.destroy(); }
  });
  ipcMain.handle('ms:fetchPaste', async (_e, url) => {
    let u;
    try { u = new URL(String(url).trim()); } catch (e) { return { ok: false, why: 'Enlace no válido' }; }
    if (u.protocol !== 'https:' || !/^pokepast\.es$/i.test(u.hostname)) return { ok: false, why: 'Solo enlaces de pokepast.es' };
    const id = u.pathname.split('/').filter(Boolean)[0] || '';
    if (!/^[a-z0-9]+$/i.test(id)) return { ok: false, why: 'Enlace no válido' };
    try {
      const r = await fetch(`https://pokepast.es/${id}/json`, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) return { ok: false, why: `Pokepaste respondió ${r.status}` };
      const j = await r.json();
      return { ok: true, title: String(j.title || '').slice(0, 100), text: String(j.paste || '').slice(0, 20000) };
    } catch (e) { return { ok: false, why: e.message }; }
  });

  ipcMain.handle('ms:importFiles', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Importar replays',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Replays de Showdown', extensions: ['html', 'htm', 'json', 'log', 'txt'] }]
    });
    const out = { added: 0, updated: 0, failed: [] };
    if (r.canceled) return out;
    for (const f of r.filePaths) {
      try {
        const st = fs.statSync(f);
        if (st.size > 10 * 1024 * 1024) { out.failed.push(`${path.basename(f)}: demasiado grande`); continue; }
        const x = importText(fs.readFileSync(f, 'utf8'), path.basename(f).replace(/\.[^.]+$/, ''), st.mtimeMs);
        if (!x.ok) out.failed.push(`${path.basename(f)}: ${x.why}`); else if (x.saved) out.added++; else out.updated++;
      } catch (e) { out.failed.push(`${path.basename(f)}: ${e.message}`); }
    }
    notify();
    return out;
  });

  ipcMain.handle('ms:importUrl', async (_e, url) => {
    let u;
    try { u = new URL(String(url).trim()); } catch (e) { return { ok: false, why: 'Enlace no válido' }; }
    if (u.protocol !== 'https:' || !/^replay\.pokemonshowdown\.com$/i.test(u.hostname)) return { ok: false, why: 'Solo enlaces de replay.pokemonshowdown.com' };
    const id = u.pathname.replace(/^\/+|\/+$/g, '').replace(/\.(json|log)$/, '');
    if (!/^[a-z0-9-]+$/i.test(id)) return { ok: false, why: 'Enlace no válido' };
    try {
      const res = await fetch(`https://replay.pokemonshowdown.com/${id}.json`, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) return { ok: false, why: `Showdown respondió ${res.status}` };
      const x = importText(await res.text(), id, Date.now());
      notify();
      return x;
    } catch (e) { return { ok: false, why: e.message }; }
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId('app.macar.showdown');
  // En desarrollo se puede usar otra carpeta de datos (MACAR_DATOS) para probar sin tocar la real.
  store = new Store((!app.isPackaged && process.env.MACAR_DATOS) || readLocation() || defaultDataDir());
  usage = new Usage(store.dir);
  // Showdown no necesita permisos especiales (cámara, ubicación…): se deniegan todos.
  session.fromPartition(PARTITION).setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  registerIpc();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
