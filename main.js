'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, session, protocol, screen, powerMonitor } = require('electron');
const fs = require('fs');
const path = require('path');
const { Store } = require('./src/store');
const { parseFile } = require('./src/parser');
const capture = require('./src/capture');
const { LIVE, REPLAY } = require('./src/live');
const { Usage } = require('./src/usage');
const { CURRENT, uploadReplay } = require('./src/media');
const { SDAPP } = require('./src/sdapp');
const { Tournaments } = require('./src/tournaments');
const { Extensions } = require('./src/extensions');
const { MacarDex } = require('./src/macardex');
const { matchId } = require('./src/store');
const { REGS, regOf } = require('./src/regs');
const backup = require('./src/backup');

// Visor de replays: msreplay:// sirve la partida guardada al reproductor de Showdown.
protocol.registerSchemesAsPrivileged([{ scheme: 'msreplay', privileges: { standard: true, secure: true } }]);

const SHOWDOWN = /^https:\/\/([a-z0-9-]+\.)*pokemonshowdown\.com(\/|$)/i;
const PARTITION = 'persist:showdown';
const REPLAY_PARTITION = 'persist:replay'; // visor de replays: el reproductor oficial de Showdown con el registro guardado
const REPLAY_URL = /^msreplay:\/\/r\/[A-Za-z0-9_-]+$/;
const DEX_PARTITION = 'persist:dex'; // la Macar Dex (web del usuario) dentro de la app
const DEX_URL = /^https:\/\/macar218\.github\.io\/macar-dex(\/|$)/;

let win = null;
const extra = new Set(); // otras ventanas (calculadora, Mi PC… en el otro monitor o al lado): sin Showdown
let store = null;
let usage = null;
let tours = null;
let exts = null;
let dex = null;
let sdContents = null; // el webview de Showdown, para leer el combate en directo
let capStatus = { ok: false, why: 'Abre la pestaña Jugar para empezar', open: 0, finished: 0, saved: 0 };
const replaying = new Set();

// Solo desarrollo: un perfil aparte (sin tu sesión de Showdown ni tus extensiones) para pruebas.
if (!app.isPackaged && process.env.MACAR_PERFIL) app.setPath('userData', process.env.MACAR_PERFIL);
// Solo desarrollo: las capturas de prueba funcionan aunque la ventana quede tapada.
if (!app.isPackaged && process.env.MACAR_CAPTURAS) { app.commandLine.appendSwitch('disable-backgrounding-occluded-windows'); app.commandLine.appendSwitch('disable-renderer-backgrounding'); }
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

const openExternal = url => { if (/^https:\/\//i.test(String(url))) shell.openExternal(url); };
/** Avisa a todas las ventanas. from = la ventana que hizo el cambio (las demás lo reciben con other: true). */
const notify = (summary, from) => {
  for (const w of [win, ...extra]) if (w && !w.isDestroyed()) w.webContents.send('ms:changed', from && w.webContents !== from ? { ...(summary || {}), other: true } : summary || null);
};

/** Las reglas de seguridad de cada ventana: solo los webviews permitidos y nada de navegar. second = ventana extra, sin Showdown. */
function guard(w, second) {
  w.webContents.on('will-attach-webview', (event, prefs, params) => {
    delete prefs.preload;
    prefs.nodeIntegration = false;
    prefs.contextIsolation = true;
    prefs.sandbox = true;
    const sd = !second && params.partition === PARTITION && SHOWDOWN.test(params.src);
    const rp = params.partition === REPLAY_PARTITION && REPLAY_URL.test(params.src);
    const dx = params.partition === DEX_PARTITION && DEX_URL.test(params.src);
    if (!sd && !rp && !dx) event.preventDefault();
  });
  w.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  w.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('file://')) { event.preventDefault(); openExternal(url); } });
  // Al volver a la ventana se relee la carpeta: si jugaste en otro ordenador (OneDrive), aparece aquí.
  w.on('focus', () => { if (store) { store.stale = true; w.webContents.send('ms:changed', { focus: true }); } });
}

/**
 * Otra ventana de la app (sin Showdown) abierta en una sección. Con dos monitores va al otro, a pantalla completa;
 * con uno, las dos ventanas se ponen una al lado de la otra.
 */
function openExtra(from, view) {
  const wb = from.getBounds();
  const here = screen.getDisplayMatching(wb);
  // Solo pruebas: MACAR_UNAPANTALLA hace como si hubiera un solo monitor.
  const others = !app.isPackaged && process.env.MACAR_UNAPANTALLA ? [] : screen.getAllDisplays().filter(d => d.id !== here.id);
  let bounds, max = false;
  if (others.length) { bounds = others[0].workArea; max = true; }
  else {
    const a = here.workArea, mw = Math.max(720, Math.round(a.width * 0.52));
    if (from.isMaximized()) from.unmaximize();
    from.setBounds({ x: a.x, y: a.y, width: mw, height: a.height });
    bounds = { x: a.x + mw, y: a.y, width: Math.max(560, a.width - mw), height: a.height };
  }
  const w = new BrowserWindow({
    ...bounds, minWidth: 560, minHeight: 500,
    backgroundColor: '#050d24', title: 'Macar Showdown', icon: path.join(__dirname, 'build', 'icon.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: true, spellcheck: false }
  });
  guard(w, true);
  extra.add(w);
  w.on('closed', () => extra.delete(w));
  if (max) w.maximize();
  w.loadFile(path.join(__dirname, 'renderer', 'index.html'), { query: { w: '2', view: /^[a-z]+$/.test(String(view)) ? String(view) : 'calc' } });
  return true;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 720, minHeight: 640,
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

  // Los webviews solo pueden ser Showdown, las replays o la Macar Dex, sin preload y aislados.
  guard(win, false);
  win.webContents.on('did-attach-webview', (_e, contents) => {
    if (contents.session === session.fromPartition(DEX_PARTITION)) {
      contents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
      contents.on('will-navigate', (event, url) => { if (!DEX_URL.test(url)) { event.preventDefault(); openExternal(url); } });
      return;
    }
    if (contents.session === session.fromPartition(REPLAY_PARTITION)) {
      contents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
      contents.on('will-navigate', (event, url) => { if (!REPLAY_URL.test(url)) { event.preventDefault(); openExternal(url); } });
      return;
    }
    contents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
    contents.on('will-navigate', (event, url) => { if (!SHOWDOWN.test(url)) { event.preventDefault(); openExternal(url); } });
    sdContents = contents;
    contents.once('destroyed', () => { if (sdContents === contents) sdContents = null; });
    // Zoom a mano como en el navegador: Ctrl + / Ctrl − / Ctrl 0 (sin la rueda: 'zoom-changed' entraba en bucle). La página de la app lo guarda y pinta.
    const zoomBy = d => { const z = d === 0 ? 1 : Math.round(Math.max(0.5, Math.min(2.5, contents.getZoomFactor() + d * 0.1)) * 10) / 10; contents.setZoomFactor(z); if (win && !win.isDestroyed()) win.webContents.send('ms:sdZoom', z); };
    contents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown' || !(input.control || input.meta) || input.alt) return;
      const k = input.key;
      if (k === '+' || k === '=' || input.code === 'NumpadAdd') { event.preventDefault(); zoomBy(1); }
      else if (k === '-' || input.code === 'NumpadSubtract') { event.preventDefault(); zoomBy(-1); }
      else if (k === '0' || input.code === 'Numpad0') { event.preventDefault(); zoomBy(0); }
    });
    capStatus = capture.attach(contents, ({ id, log, clientName }) => {
      try {
        const r = store.saveLog({ id, log, clientName, source: 'auto' });
        if (r.saved) notify(r.summary);
        // Replay automática: solo de tus combates, una vez por partida.
        if (r.saved && r.summary && r.summary.me && !r.summary.replay && store.settings().autoReplay && !replaying.has(id)) {
          replaying.add(id);
          uploadReplay(contents, id).then(url => { if (url) { store.setReplay(matchId(id), url); notify({ replay: url }); } }).catch(() => {});
        }
        return r;
      } catch (e) {
        console.error('[captura]', e);
        return null;
      }
    });
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  if (!app.isPackaged && process.env.MACAR_CAPTURAS) win.webContents.once('did-finish-load', () => capturas(process.env.MACAR_CAPTURAS));
  // Al cerrar la ventana principal se cierran también las otras.
  win.on('closed', () => { win = null; for (const w of [...extra]) if (!w.isDestroyed()) w.close(); });
}

/**
 * Solo desarrollo: ejecuta un guion de pasos y guarda capturas (MACAR_CAPTURAS = carpeta).
 * MACAR_PASOS = archivo JSON con [{ "js": "...", "wait": 1000, "shot": "nombre" }]. Sin él, recorre las pantallas.
 * Los errores de la consola van a <carpeta>/consola.txt.
 */
async function capturas(dir) {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const shot = async name => {
    const img = await Promise.race([win.webContents.capturePage(), wait(10000).then(() => null)]);
    if (img) fs.writeFileSync(path.join(dir, `${name}.png`), img.toPNG()); else fs.appendFileSync(path.join(dir, 'consola.txt'), `[captura] ${name}: sin imagen (ventana sin pintar)
`);
  };
  const log = path.join(dir, 'consola.txt');
  fs.writeFileSync(log, '');
  win.webContents.on('console-message', (e) => { const lv = e.level; if (lv === 'warning' || lv === 'error' || lv === 2 || lv === 3) fs.appendFileSync(log, `[${lv}] ${e.message}
`); });
  let steps = ['dash', 'partidas', 'ajustes', 'jugar'].map(v => ({ js: `show('${v}')`, wait: 1500, shot: v }));
  if (process.env.MACAR_PASOS) steps = JSON.parse(fs.readFileSync(process.env.MACAR_PASOS, 'utf8'));
  await wait(2500);
  for (const st of steps) {
    try {
      if (st.size) { if (win.isMaximized()) win.unmaximize(); win.setSize(st.size[0], st.size[1]); }
      if (st.zoom) win.webContents.setZoomFactor(st.zoom);
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

/* ---------- actualización automática (versiones de GitHub) ---------- */
let updater = null;
let updateState = { state: 'idle' };
function setupUpdater() {
  if (!app.isPackaged) return;
  try { updater = require('electron-updater').autoUpdater; } catch (e) { return; }
  const send = st => { updateState = st; if (win && !win.isDestroyed()) win.webContents.send('ms:update', st); };
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.on('checking-for-update', () => send({ state: 'checking' }));
  updater.on('update-available', i => send({ state: 'downloading', version: i.version, percent: 0 }));
  updater.on('update-not-available', () => send({ state: 'idle' }));
  updater.on('download-progress', p => send({ state: 'downloading', version: updateState.version, percent: Math.round(p.percent || 0) }));
  updater.on('update-downloaded', i => send({ state: 'ready', version: i.version }));
  updater.on('error', e => send({ state: 'error', why: String((e && e.message) || e).slice(0, 200) }));
  const check = () => updater.checkForUpdates().catch(() => {});
  setTimeout(check, 8000);
  setInterval(check, 3 * 3600 * 1000);
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

/**
 * Carpeta de datos al arrancar: la elegida o, si en este ordenador no se ha elegido ninguna y ya hay datos de
 * Macar Showdown en OneDrive (de otro ordenador tuyo), esa, para ver lo mismo en todos sin tener que tocar nada.
 * Lo que hubiera solo aquí se copia allí sin pisar nada.
 */
function startDataDir() {
  const loc = readLocation();
  if (loc) return loc;
  const od = oneDriveDir();
  const t = od && path.join(od, 'Macar Showdown');
  if (t && (fs.existsSync(path.join(t, 'partidas')) || fs.existsSync(path.join(t, 'equipos.json')))) {
    try { copyMissing(defaultDataDir(), t); writeLocation(t); return t; } catch (e) { console.error('[datos]', e); }
  }
  return defaultDataDir();
}

function registerIpc() {
  ipcMain.handle('ms:list', () => store.listAsync());
  // Solo la lista si ha cambiado desde la versión que ya tiene la ventana (al volver a ella no se manda todo otra vez).
  ipcMain.handle('ms:listIf', async (_e, ver) => { const list = await store.listAsync(); return store.ver === ver ? { ver: store.ver, same: true } : { ver: store.ver, list }; });
  ipcMain.handle('ms:get', (_e, id) => store.get(String(id)));
  ipcMain.handle('ms:delete', (_e, id) => { store.remove(String(id)); notify(); return true; });
  ipcMain.handle('ms:notes', (e, id, text) => { const r = store.setNotes(String(id), String(text || '')); for (const w of [win, ...extra]) if (w && !w.isDestroyed() && w.webContents !== e.sender) w.webContents.send('ms:changed', { notes: String(id), other: true }); return r; });
  ipcMain.handle('ms:settings', () => { const s = store.settings(); return { ...s, reg: regOf(s), regs: REGS, dataDir: store.dir, version: app.getVersion() }; });
  ipcMain.handle('ms:setSettings', (_e, patch) => {
    const clean = {};
    if (patch && typeof patch.showdownName === 'string') clean.showdownName = patch.showdownName.slice(0, 200);
    if (patch && typeof patch.teamId === 'string') clean.teamId = patch.teamId.slice(0, 60);
    if (patch && typeof patch.autoReplay === 'boolean') clean.autoReplay = patch.autoReplay;
    if (patch && typeof patch.sessionId === 'string') clean.sessionId = patch.sessionId.slice(0, 60);
    if (patch && patch.reg && typeof patch.reg === 'object') clean.reg = regOf({ reg: patch.reg });
    const s = store.setSettings(clean);
    notify();
    return { ...s, reg: regOf(s), regs: REGS };
  });
  ipcMain.handle('ms:status', () => ({ ...capStatus }));
  ipcMain.handle('ms:openData', () => shell.openPath(store.dir));
  // Copia de seguridad: guardar todo en un archivo, ver qué trae una y restaurarla.
  const devBackup = !app.isPackaged && process.env.MACAR_COPIA; // pruebas: archivo fijo, sin diálogos
  ipcMain.handle('ms:backupSave', async () => {
    const name = `macar-showdown-${new Date().toISOString().slice(0, 10)}.macarbackup`;
    const r = devBackup ? { canceled: false, filePath: devBackup } : await dialog.showSaveDialog(win, { title: 'Copia de seguridad', defaultPath: path.join(app.getPath('documents'), name), filters: [{ name: 'Copia de Macar Showdown', extensions: ['macarbackup'] }] });
    if (r.canceled || !r.filePath) return { ok: false };
    try { return { ok: true, ...backup.create(store.dir, r.filePath, app.getVersion()) }; } catch (e) { return { ok: false, why: e.message }; }
  });
  let pickedBackup = null;
  ipcMain.handle('ms:backupPick', async () => {
    const r = devBackup ? { canceled: false, filePaths: [devBackup] } : await dialog.showOpenDialog(win, { title: 'Restaurar una copia', properties: ['openFile'], filters: [{ name: 'Copia de Macar Showdown', extensions: ['macarbackup'] }] });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    try { const info = backup.peek(r.filePaths[0]); pickedBackup = r.filePaths[0]; return { ok: true, name: path.basename(r.filePaths[0]), ...info }; } catch (e) { return { ok: false, why: e.message }; }
  });
  ipcMain.handle('ms:backupRestore', async () => {
    if (!pickedBackup) return { ok: false, why: 'Elige antes la copia' };
    try {
      const before = path.join(app.getPath('userData'), 'copias', `antes-de-restaurar-${new Date().toISOString().replace(/[:.]/g, '-')}.macarbackup`);
      const r = backup.restore(store.dir, pickedBackup, before, app.getVersion());
      pickedBackup = null; store.stale = true; store.cache = null; notify();
      return { ok: true, ...r };
    } catch (e) { return { ok: false, why: e.message }; }
  });
  ipcMain.handle('ms:backupFolder', () => { const d = path.join(app.getPath('userData'), 'copias'); fs.mkdirSync(d, { recursive: true }); return shell.openPath(d); });
  ipcMain.handle('ms:openExternal', (_e, url) => openExternal(url));

  // Combate que tienes delante (barra de notas).
  ipcMain.handle('ms:current', async () => {
    if (!sdContents || sdContents.isDestroyed()) return null;
    try { const c = await capture.run(sdContents, CURRENT); return c ? { ...c, mid: matchId(c.id) } : null; } catch (e) { return null; }
  });
  ipcMain.handle('ms:matchExists', (_e, id) => !!store.get(String(id)));
  // Documento de preparación a PDF: se pinta en una ventana oculta y se imprime.
  ipcMain.handle('ms:savePdf', async (_e, html, name) => {
    const devPdf = !app.isPackaged && process.env.MACAR_PDF;
    const r = devPdf ? { canceled: false, filePath: devPdf } : await dialog.showSaveDialog(win, { title: 'PDF', defaultPath: path.join(app.getPath('documents'), String(name || 'prep.pdf').replace(/[\/:*?"<>|]/g, '_')), filters: [{ name: 'PDF', extensions: ['pdf'] }] });
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
  ipcMain.handle('ms:downloadReplay', async (_e, id) => {
    const m = store.get(String(id));
    if (!m) return { ok: false, why: 'No está guardada' };
    const s = m.summary;
    const title = `${s.format} ${s.p1.name} vs ${s.p2.name}`.replace(/[\\/:*?"<>|]/g, '_');
    const r = await dialog.showSaveDialog(win, { title: 'Descargar replay', defaultPath: path.join(app.getPath('downloads'), `${title.slice(0, 120)}.html`), filters: [{ name: 'Replay de Showdown', extensions: ['html'] }] });
    if (r.canceled || !r.filePath) return { ok: false };
    const html = replayHTML(m, title);
    fs.writeFileSync(r.filePath, html);
    shell.showItemInFolder(r.filePath);
    return { ok: true, file: r.filePath };
  });
  ipcMain.handle('ms:setReview', (_e, id, review) => { const r = store.setReview(String(id), review || null); notify(); return r; });
  ipcMain.handle('ms:setMark', (_e, id, mark) => { const r = store.setMark(String(id), mark || null); notify(); return r; });
  ipcMain.handle('ms:setMatchSession', (_e, id, sid) => { const r = store.setSession(String(id), sid ? String(sid) : null); notify(); return r; });
  ipcMain.handle('ms:clearSession', (_e, sid) => { const n = store.clearSession(String(sid)); notify(); return n; });
  ipcMain.handle('ms:replayNow', async (_e, id) => {
    const m = store.get(String(id));
    if (!m) return { ok: false, why: 'No está guardada' };
    if (m.replay) return { ok: true, url: m.replay };
    if (!sdContents) return { ok: false, why: 'Abre Jugar' };
    const room = `battle-${m.summary.id}`;
    const url = await uploadReplay(sdContents, room);
    if (url) { store.setReplay(m.summary.id, url); notify({ replay: url }); return { ok: true, url }; }
    return { ok: false, why: 'Showdown ya no tiene la sala abierta: solo se puede subir mientras sigue abierta.' };
  });

  // Extensiones de Chrome dentro de Showdown.
  ipcMain.handle('ms:extList', () => exts.list().map(({ id, name, version, source }) => ({ id, name, version, source })));
  ipcMain.handle('ms:extAdd', async (_e, kind, value) => {
    try {
      let r;
      if (kind === 'store') r = await exts.addStore(String(value || ''));
      else if (kind === 'folder' || kind === 'file') {
        const d = await dialog.showOpenDialog(win, kind === 'folder'
          ? { title: 'Carpeta descomprimida de la extensión', properties: ['openDirectory'] }
          : { title: 'Extensión (.crx o .zip)', properties: ['openFile'], filters: [{ name: 'Extensión de Chrome', extensions: ['crx', 'zip'] }] });
        if (d.canceled || !d.filePaths[0]) return { ok: false };
        r = kind === 'folder' ? await exts.addFolder(d.filePaths[0]) : await exts.addFile(d.filePaths[0]);
      } else return { ok: false, why: 'Tipo desconocido' };
      return { ok: true, ...r };
    } catch (e) { return { ok: false, why: e.message }; }
  });
  ipcMain.handle('ms:extRemove', (_e, id) => exts.remove(String(id)));

  // Tu ELO y GXE en el ladder (perfil público de Showdown).
  ipcMain.handle('ms:ladder', async (_e, name) => {
    const id = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!id) return { ok: false };
    try {
      const r = await fetch(`https://pokemonshowdown.com/users/${id}.json`, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) return { ok: false, why: `Showdown respondió ${r.status}` };
      const j = await r.json();
      const ratings = Object.entries(j.ratings || {}).filter(([k]) => /champions/.test(k)).map(([format, x]) => ({ format, elo: Math.round(x.elo), gxe: x.gxe, w: x.w, l: x.l }));
      return { ok: true, user: j.username, ratings };
    } catch (e) { return { ok: false, why: e.message }; }
  });

  // Datos de la Macar Dex (se renuevan cada día; la Dex se actualiza los lunes).
  ipcMain.handle('ms:dex', async (_e, force) => {
    try { const d = await dex.get(!!force); return d ? { ok: true, ...d } : { ok: false, why: 'Sin datos de la Macar Dex (¿sin conexión?)' }; } catch (e) { return { ok: false, why: e.message }; }
  });

  // Equipos y sets de torneo (Limitless).
  ipcMain.handle('ms:tournaments', async (_e, force) => {
    try { return { ok: true, ...(await tours.get(!!force)) }; } catch (e) { return { ok: false, why: e.message }; }
  });

  // Actualización automática.
  ipcMain.handle('ms:updateInstall', () => { if (updater) { setImmediate(() => updater.quitAndInstall(false, true)); return true; } return false; });
  ipcMain.handle('ms:updateState', () => updateState);

  // Calculadora
  ipcMain.handle('ms:live', async () => {
    if (!sdContents || sdContents.isDestroyed()) return { ok: false, why: 'Showdown no está abierto' };
    try { return await capture.run(sdContents, LIVE); } catch (e) { return { ok: false, why: e.message }; }
  });
  ipcMain.handle('ms:usage', async (_e, tier) => {
    try { return { ok: true, ...(await usage.get(String(tier || ''))) }; } catch (e) { return { ok: false, why: e.message }; }
  });
  ipcMain.handle('ms:data', (_e, key) => store.data(String(key)));
  // Plan de temporada: segundos sin tocar el ordenador (para no contar el tiempo de la sesión si te vas) e importar tus Excel.
  ipcMain.handle('ms:idle', () => { try { return powerMonitor.getSystemIdleTime(); } catch (e) { return 0; } });
  ipcMain.handle('ms:importExcel', async e => {
    const dev = !app.isPackaged && process.env.MACAR_EXCEL; // pruebas: archivos fijos (separados por ;), sin diálogo
    const r = dev ? { canceled: false, filePaths: dev.split(';') } : await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { title: 'Importar tus Excel (plan y torneos)', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Excel', extensions: ['xlsx'] }] });
    if (r.canceled || !r.filePaths.length) return { ok: false };
    const out = [];
    for (const f of r.filePaths) {
      try { out.push({ file: path.basename(f), ...require('./src/rtw').parse(fs.readFileSync(f)) }); } catch (err) { out.push({ file: path.basename(f), kind: 'error', why: err.message }); }
    }
    return { ok: true, files: out };
  });
  ipcMain.handle('ms:setData', (e, key, value) => { const r = store.setData(String(key), value); notify({ data: String(key) }, e.sender); return r; });
  ipcMain.handle('ms:newWindow', (e, view) => { const from = BrowserWindow.fromWebContents(e.sender); return from ? openExtra(from, view) : false; });
  ipcMain.handle('ms:replayReader', (_e, mine) => REPLAY(String(mine || 'p1')));
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
  // Llevar un equipo al teambuilder de Showdown (carpeta «Macar Showdown»; si ya estaba con ese nombre, se actualiza)
  // y, si se pide, buscar partida con él en el ladder.
  const SD_TEAM = (name, text, format, search) => `(() => { try {
      const a = ${SDAPP};
      const S = window.Storage, P = window.PS, T = window.Teams;
      const text = ${JSON.stringify(String(text || '').slice(0, 20000))}, name = ${JSON.stringify(String(name || 'Macar Showdown').slice(0, 80))}, format = ${JSON.stringify(String(format || regOf(store.settings()).id))};
      let packed;
      if (a && a.ps) {
        // Cliente nuevo de Showdown: equipos en PS.teams, importar y empaquetar con Teams.
        if (!P.teams || !T || !T.import || !T.pack) return { ok: false, why: 'Showdown aún no ha cargado' };
        const team = T.import(text);
        if (!team || !team.length) return { ok: false, why: 'El equipo está vacío' };
        packed = T.pack(team);
        const old = P.teams.list.find(t => t.folder === 'Macar Showdown' && t.name === name);
        if (old) { old.packedTeam = packed; old.format = format; old.iconCache = null; }
        else P.teams.unshift({ name, format, packedTeam: packed, folder: 'Macar Showdown', iconCache: null, isBox: false });
        P.teams.save();
      } else {
        if (!S || !S.importTeam || !S.packTeam || !S.teams || !a) return { ok: false, why: 'Showdown aún no ha cargado' };
        const team = S.importTeam(text);
        if (!team || !team.length) return { ok: false, why: 'El equipo está vacío' };
        packed = S.packTeam(team);
        const old = S.teams.find(t => t.folder === 'Macar Showdown' && t.name === name);
        if (old) { old.team = packed; old.format = format; old.iconCache = ''; }
        else S.teams.unshift({ name, format, team: packed, folder: 'Macar Showdown', iconCache: '' });
        S.saveTeams();
        try { a.user.trigger('saveteams'); } catch (e) {}
      }
      if (${search ? 'true' : 'false'}) {
        if (!a.user || !a.user.get('named')) return { ok: false, why: 'Inicia sesión en Showdown para buscar partida' };
        a.send('/utm ' + packed);
        a.send('/search ' + format);
      }
      return { ok: true };
    } catch (e) { return { ok: false, why: String((e && e.message) || e) }; } })()`;
  ipcMain.handle('ms:sdAddTeam', async (_e, name, text, format) => {
    if (!sdContents || sdContents.isDestroyed()) return { ok: false, why: 'Abre la pestaña Jugar primero' };
    try { return await sdContents.executeJavaScript(SD_TEAM(name, text, format, false), false); } catch (e) { return { ok: false, why: e.message }; }
  });
  ipcMain.handle('ms:sdSearch', async (_e, name, text, format) => {
    if (!sdContents || sdContents.isDestroyed()) return { ok: false, why: 'Abre la pestaña Jugar primero' };
    format = format || regOf(store.settings()).id;
    try { return await sdContents.executeJavaScript(SD_TEAM(name, text, format, true), false); } catch (e) { return { ok: false, why: e.message }; }
  });
  ipcMain.handle('ms:sdCancelSearch', async () => {
    if (!sdContents || sdContents.isDestroyed()) return false;
    try { await sdContents.executeJavaScript(`(() => { const a = ${SDAPP}; if (a) a.send('/cancelsearch'); return true; })()`, false); return true; } catch (e) { return false; }
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

  // Subir tu equipo a pokepast.es (solo cuando lo pides con el botón) y devolver el enlace.
  ipcMain.handle('ms:createPaste', async (_e, title, text) => {
    const paste = String(text || '').slice(0, 20000);
    if (!paste.trim()) return { ok: false, why: 'El equipo está vacío' };
    try {
      const body = new URLSearchParams({ paste, title: String(title || '').slice(0, 100), author: '', notes: '' });
      const r = await fetch('https://pokepast.es/create', { method: 'POST', body, redirect: 'manual', signal: AbortSignal.timeout(20000) });
      const loc = r.headers.get('location') || '';
      const url = loc ? new URL(loc, 'https://pokepast.es/').toString() : (r.url && r.url !== 'https://pokepast.es/create' ? r.url : '');
      if (!/^https:\/\/pokepast\.es\/[a-z0-9]+$/i.test(url)) return { ok: false, why: `Pokepaste respondió ${r.status}` };
      return { ok: true, url };
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

/** Replay de Showdown (el formato de sus archivos .html descargados) con el registro guardado. */
function replayHTML(m, title) {
  const s = m.summary;
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<meta charset="utf-8" />
<!-- version 1 -->
<title>${esc(title)}</title>
<style>html,body {font-family:Verdana, sans-serif;font-size:10pt;margin:0;padding:0;}body{padding:12px 0;} .battle-log {font-family:Verdana, sans-serif;font-size:10pt;} .battle-log-inline {border:1px solid #AAAAAA;background:#EEF2F5;color:black;max-width:640px;margin:0 auto 80px;padding-bottom:5px;} .battle-log .inner {padding:4px 8px 0px 8px;} .battle-log .inner-preempt {padding:0 8px 4px 8px;} .battle-log .inner-after {margin-top:0.5em;} .battle-log h2 {margin:0.5em -8px;padding:4px 8px;border:1px solid #AAAAAA;background:#E0E7EA;border-left:0;border-right:0;font-family:Verdana, sans-serif;font-size:13pt;} .battle-log .chat {vertical-align:middle;padding:3px 0 3px 0;font-size:8pt;} .battle-log .chat strong {color:#40576A;} .battle-log .chat em {padding:1px 4px 1px 3px;color:#000000;font-style:normal;} .chat.mine {background:rgba(0,0,0,0.05);margin-left:-8px;margin-right:-8px;padding-left:8px;padding-right:8px;} .spoiler {color:#BBBBBB;background:#BBBBBB;padding:0px 3px;} .spoiler:hover, .spoiler:active, .spoiler-shown {color:#000000;background:#E2E2E2;padding:0px 3px;} .spoiler a {color:#BBBBBB;} .spoiler:hover a, .spoiler:active a, .spoiler-shown a {color:#2288CC;} .chat code, .chat .spoiler:hover code, .chat .spoiler:active code, .chat .spoiler-shown code {border:1px solid #C0C0C0;background:#EEEEEE;color:black;padding:0 2px;} .chat .spoiler code {border:1px solid #CCCCCC;background:#CCCCCC;color:#CCCCCC;} .battle-log .rated {padding:3px 4px;} .battle-log .rated strong {color:white;background:#89A;padding:1px 4px;border-radius:4px;} .spacer {margin-top:0.5em;} .message-announce {background:#6688AA;color:white;padding:1px 4px 2px;} .message-announce a, .broadcast-green a, .broadcast-blue a, .broadcast-red a {color:#DDEEFF;} .broadcast-green {background-color:#559955;color:white;padding:2px 4px;} .broadcast-blue {background-color:#6688AA;color:white;padding:2px 4px;} .infobox {border:1px solid #6688AA;padding:2px 4px;} .infobox-limited {max-height:200px;overflow:auto;overflow-x:hidden;} .broadcast-red {background-color:#AA5544;color:white;padding:2px 4px;} .message-learn-canlearn {font-weight:bold;color:#228822;text-decoration:underline;} .message-learn-cannotlearn {font-weight:bold;color:#CC2222;text-decoration:underline;} .message-effect-weak {font-weight:bold;color:#CC2222;} .message-effect-resist {font-weight:bold;color:#6688AA;} .message-effect-immune {font-weight:bold;color:#666666;} .message-learn-list {margin-top:0;margin-bottom:0;} .message-throttle-notice, .message-error {color:#992222;} .message-overflow, .chat small.message-overflow {font-size:0pt;} .message-overflow::before {font-size:9pt;content:'...';} .subtle {color:#3A4A66;}</style>
<div class="wrapper replay-wrapper" style="max-width:1180px;margin:0 auto">
<input type="hidden" name="replayid" value="${esc(s.id)}" />
<div class="battle"></div><div class="battle-log"></div><div class="replay-controls"></div><div class="replay-controls-2"></div>
<h1 style="font-weight:normal;text-align:center"><strong>${esc(s.format)}</strong><br /><a href="https://pokemonshowdown.com/users/${esc(s.p1.name.toLowerCase().replace(/[^a-z0-9]/g, ''))}" class="subtle" target="_blank">${esc(s.p1.name)}</a> vs. <a href="https://pokemonshowdown.com/users/${esc(s.p2.name.toLowerCase().replace(/[^a-z0-9]/g, ''))}" class="subtle" target="_blank">${esc(s.p2.name)}</a></h1>
<script type="text/plain" class="battle-log-data">${m.log.replace(/\//g, '\\/')}</script>
</div>
<div class="battle-log battle-log-inline"><div class="inner"></div></div>
</div>
<script>
let daily = Math.floor(Date.now()/1000/60/60/24);document.write('<script src="https://play.pokemonshowdown.com/js/replay-embed.js?version'+daily+'"></'+'script>');
</script>
`;
}

app.whenReady().then(async () => {
  app.setAppUserModelId('app.macar.showdown');
  // En desarrollo se puede usar otra carpeta de datos (MACAR_DATOS) para probar sin tocar la real.
  store = new Store((!app.isPackaged && process.env.MACAR_DATOS) || startDataDir(), path.join(app.getPath('userData'), 'indice-partidas.json'));
  app.on('before-quit', () => { try { store.flushIndex(); } catch (e) { /* nada */ } });
  usage = new Usage(store.dir, () => regOf(store.settings()).id);
  tours = new Tournaments(store.dir, () => regOf(store.settings()).limitless);
  // Copia automática local (fuera de OneDrive): una por semana, las 4 últimas.
  setTimeout(() => { backup.auto(store.dir, path.join(app.getPath('userData'), 'copias'), app.getVersion()).catch(() => {}); }, 20000);
  dex = new MacarDex(store.dir);
  // Visor de replays: la partida guardada en el reproductor oficial de Showdown (sin tener que subirla).
  const rs = session.fromPartition(REPLAY_PARTITION);
  rs.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  rs.protocol.handle('msreplay', req => {
    const id = decodeURIComponent(new URL(req.url).pathname.replace(/^\//, ''));
    const m = /^[A-Za-z0-9_-]+$/.test(id) ? store.get(id) : null;
    if (!m || !m.log) return new Response('Not found', { status: 404 });
    const s = m.summary;
    return new Response(replayHTML(m, `${s.format} ${s.p1.name} vs ${s.p2.name}`), { headers: { 'content-type': 'text/html; charset=utf-8' } });
  });
  // Showdown no necesita permisos especiales (cámara, ubicación…): se deniegan todos.
  session.fromPartition(PARTITION).setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  session.fromPartition(DEX_PARTITION).setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  registerIpc();
  exts = new Extensions(app.getPath('userData'), session.fromPartition(PARTITION));
  try { await exts.loadAll(); } catch (e) { console.error('[extensiones]', e); }
  createWindow();
  setupUpdater();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
