'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const fs = require('fs');
const path = require('path');
const { Store } = require('./src/store');
const { parseFile } = require('./src/parser');
const capture = require('./src/capture');

const SHOWDOWN = /^https:\/\/([a-z0-9-]+\.)*pokemonshowdown\.com(\/|$)/i;
const PARTITION = 'persist:showdown';
// Calculadora: la Macar Dex publicada (motor de Smogon + datos que se actualizan cada semana).
const DEX = /^https:\/\/macar218\.github\.io\/macar-dex(\/|$)/i;
const DEX_PARTITION = 'persist:macardex';

let win = null;
let store = null;
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

  // Los webviews solo pueden ser Showdown o la Macar Dex, cada uno en su sesión, sin preload y aislados.
  win.webContents.on('will-attach-webview', (event, prefs, params) => {
    delete prefs.preload;
    prefs.nodeIntegration = false;
    prefs.contextIsolation = true;
    prefs.sandbox = true;
    const ok = (params.partition === PARTITION && SHOWDOWN.test(params.src)) || (params.partition === DEX_PARTITION && DEX.test(params.src));
    if (!ok) event.preventDefault();
  });
  win.webContents.on('did-attach-webview', (_e, contents) => {
    contents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
    if (contents.session === session.fromPartition(DEX_PARTITION)) {
      contents.on('will-navigate', (event, url) => { if (!DEX.test(url)) { event.preventDefault(); openExternal(url); } });
      return; // la calculadora no lleva captura
    }
    contents.on('will-navigate', (event, url) => { if (!SHOWDOWN.test(url)) { event.preventDefault(); openExternal(url); } });
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
}

/** Solo desarrollo: recorre las pantallas y guarda una captura de cada una. */
async function capturas(dir) {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const shot = async name => fs.writeFileSync(path.join(dir, `${name}.png`), (await win.webContents.capturePage()).toPNG());
  await wait(2500);
  for (const v of ['dash', 'partidas', 'ajustes', 'jugar']) { await win.webContents.executeJavaScript(`show('${v}')`); await wait(1500); await shot(v); }
  await win.webContents.executeJavaScript(`show('partidas'); setTimeout(() => document.querySelector('.match').click(), 300)`);
  await wait(1500); await shot('detalle');
  app.quit();
}

function importText(text, name, mtime) {
  const r = parseFile(text, { id: name, endedAt: mtime });
  if (!r) return { ok: false, why: 'No parece una partida de Showdown' };
  const id = r.summary.id && /\d/.test(r.summary.id) ? r.summary.id : `importada-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const res = store.saveLog({ id, log: r.log, endedAt: r.summary.endedAt || mtime, source: 'importada' });
  return { ok: true, saved: res.saved };
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
    const s = store.setSettings(clean);
    notify();
    return s;
  });
  ipcMain.handle('ms:status', () => ({ ...capStatus }));
  ipcMain.handle('ms:openData', () => shell.openPath(store.dir));
  ipcMain.handle('ms:openExternal', (_e, url) => openExternal(url));

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
  store = new Store((!app.isPackaged && process.env.MACAR_DATOS) || path.join(app.getPath('userData'), 'datos'));
  // Showdown no necesita permisos especiales (cámara, ubicación…): se deniegan todos.
  session.fromPartition(PARTITION).setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  session.fromPartition(DEX_PARTITION).setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'clipboard-sanitized-write'));
  registerIpc();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
