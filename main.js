'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, session, protocol, net } = require('electron');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');
const { Store } = require('./src/store');
const { parseFile } = require('./src/parser');
const capture = require('./src/capture');
const { LIVE } = require('./src/live');
const { Usage } = require('./src/usage');
const { CURRENT, uploadReplay } = require('./src/media');
const { Tournaments } = require('./src/tournaments');
const { matchId } = require('./src/store');

// Vídeos de las partidas: se sirven a la interfaz por msvideo:// (con saltos dentro del vídeo).
protocol.registerSchemesAsPrivileged([{ scheme: 'msvideo', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } }]);

const SHOWDOWN = /^https:\/\/([a-z0-9-]+\.)*pokemonshowdown\.com(\/|$)/i;
const PARTITION = 'persist:showdown';

let win = null;
let store = null;
let usage = null;
let tours = null;
let sdContents = null; // el webview de Showdown, para leer el combate en directo
let capStatus = { ok: false, why: 'Abre la pestaña Jugar para empezar', open: 0, finished: 0, saved: 0 };
const replaying = new Set();
let rec = null; // grabación en curso: { mid, file, stream }

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

/* ---------- ajustes solo de este ordenador (no se sincronizan) ---------- */
const localFile = () => path.join(app.getPath('userData'), 'local.json');
function readLocal() { try { return JSON.parse(fs.readFileSync(localFile(), 'utf8')) || {}; } catch (e) { return {}; } }
function writeLocal(patch) { fs.writeFileSync(localFile(), JSON.stringify({ ...readLocal(), ...patch }, null, 2)); }
const videosDir = () => (!app.isPackaged && process.env.MACAR_VIDEOS) || readLocal().videosDir || path.join(app.getPath('videos'), 'Macar Showdown');
function finishRec() {
  if (!rec) return { ok: false };
  const r = rec;
  rec = null;
  return new Promise(res => r.stream.end(() => {
    try { if (fs.statSync(r.file).size < 10000) fs.unlinkSync(r.file); } catch (e) { /* nada */ }
    notify({ video: r.mid });
    res({ ok: true, file: r.file, mid: r.mid });
  }));
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
    if (patch && typeof patch.autoReplay === 'boolean') clean.autoReplay = patch.autoReplay;
    if (patch && typeof patch.recordVideo === 'boolean') clean.recordVideo = patch.recordVideo;
    const s = store.setSettings(clean);
    notify();
    return s;
  });
  ipcMain.handle('ms:status', () => ({ ...capStatus }));
  ipcMain.handle('ms:openData', () => shell.openPath(store.dir));
  ipcMain.handle('ms:openExternal', (_e, url) => openExternal(url));

  // Combate que tienes delante (barra de notas y grabación).
  ipcMain.handle('ms:current', async () => {
    if (!sdContents || sdContents.isDestroyed()) return null;
    try { const c = await sdContents.executeJavaScript(CURRENT, false); return c ? { ...c, mid: matchId(c.id) } : null; } catch (e) { return null; }
  });
  ipcMain.handle('ms:matchExists', (_e, id) => !!store.get(String(id)));
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

  // Vídeo de la partida: graba solo el Showdown (no la calculadora) y lo guarda en tu carpeta de Vídeos.
  ipcMain.handle('ms:recStart', (_e, id) => {
    if (rec) finishRec();
    const mid = matchId(String(id));
    const dir = videosDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${mid.replace(/[^a-zA-Z0-9_-]/g, '_')}.webm`);
    rec = { mid, file, stream: fs.createWriteStream(file) };
    return { ok: true, file };
  });
  ipcMain.on('ms:recChunk', (_e, buf) => { if (rec && buf) rec.stream.write(Buffer.from(buf)); });
  ipcMain.handle('ms:recStop', () => finishRec());
  ipcMain.handle('ms:videoFor', (_e, id) => {
    const f = path.join(videosDir(), `${String(id).replace(/[^a-zA-Z0-9_-]/g, '_')}.webm`);
    return fs.existsSync(f) && fs.statSync(f).size > 10000 ? `msvideo://v/${encodeURIComponent(path.basename(f))}` : null;
  });
  ipcMain.handle('ms:deleteVideo', (_e, id) => {
    const f = path.join(videosDir(), `${String(id).replace(/[^a-zA-Z0-9_-]/g, '_')}.webm`);
    try { fs.unlinkSync(f); return true; } catch (e) { return false; }
  });
  ipcMain.handle('ms:videosDir', () => ({ dir: videosDir() }));
  ipcMain.handle('ms:setVideosDir', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Carpeta para los vídeos de tus partidas', properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    writeLocal({ videosDir: r.filePaths[0] });
    return { ok: true, dir: r.filePaths[0] };
  });
  ipcMain.handle('ms:openVideos', () => { fs.mkdirSync(videosDir(), { recursive: true }); return shell.openPath(videosDir()); });

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
  tours = new Tournaments(store.dir);
  // Vídeos servidos a la interfaz (solo archivos de la carpeta de vídeos).
  protocol.handle('msvideo', req => {
    const name = decodeURIComponent(new URL(req.url).pathname.replace(/^\//, ''));
    if (!/^[a-zA-Z0-9_-]+\.webm$/.test(name)) return new Response('no', { status: 404 });
    return net.fetch(pathToFileURL(path.join(videosDir(), name)).toString(), { headers: req.headers });
  });
  // La grabación pide "compartir pantalla": se le da solo el webview de Showdown, sin preguntar.
  session.defaultSession.setDisplayMediaRequestHandler((_req, cb) => {
    if (sdContents && !sdContents.isDestroyed()) cb({ video: sdContents.mainFrame }); else cb({});
  });
  // Showdown no necesita permisos especiales (cámara, ubicación…): se deniegan todos.
  session.fromPartition(PARTITION).setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  registerIpc();
  createWindow();
  setupUpdater();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
