'use strict';
/* DJ KOLJA ONE · Library — Desktop-App (Electron).
   Lädt dieselbe Oberfläche wie die Web-App und ergänzt echten Dateizugriff: vollständige Pfade,
   Tags schreiben und Dateien umbenennen ohne Browser-Rückfragen, direkter Abgleich mit DJ-Software. */
const { app, BrowserWindow, dialog, ipcMain, protocol, net, shell } = require('electron');
const fs = require('fs'), fsp = fs.promises, path = require('path'), os = require('os');
const { Readable } = require('stream');
const { pathToFileURL } = require('url');

const WEB = fs.existsSync(path.join(__dirname, 'web', 'index.html')) ? path.join(__dirname, 'web') : path.join(__dirname, '..');
const AUDIO = /\.(mp3|m4a|aac|mp4|flac|wav|aiff?|ogg|opus)$/i;
const MIME = { mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', wav: 'audio/wav', aif: 'audio/aiff', aiff: 'audio/aiff', ogg: 'audio/ogg', opus: 'audio/ogg' };

protocol.registerSchemesAsPrivileged([{ scheme: 'one', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

async function scan(dir, out = []) {
  let entries = [];
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await scan(p, out);
    else if (AUDIO.test(e.name)) { try { out.push({ path: p, size: (await fsp.stat(p)).size }); } catch { /* nicht lesbar */ } }
  }
  return out;
}

function handlers(win) {
  const on = (name, fn) => ipcMain.handle('one:' + name, (_e, ...args) => fn(...args));
  on('paths', () => ({ home: os.homedir(), music: app.getPath('music'), documents: app.getPath('documents'), platform: process.platform }));
  on('pickFolder', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] }); return r.canceled ? null : r.filePaths[0]; });
  on('pickFiles', async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Audio', extensions: Object.keys(MIME) }] });
    if (r.canceled) return [];
    return Promise.all(r.filePaths.map(async p => ({ path: p, size: (await fsp.stat(p)).size })));
  });
  on('scan', dir => scan(dir));
  on('expand', async paths => { // abgelegte Dateien und Ordner
    const out = [];
    for (const p of paths) {
      const st = await fsp.stat(p).catch(() => null);
      if (!st) continue;
      if (st.isDirectory()) await scan(p, out); else if (AUDIO.test(p)) out.push({ path: p, size: st.size });
    }
    return out;
  });
  on('stat', async p => { const st = await fsp.stat(p).catch(() => null); return st && st.isFile() ? { size: st.size } : null; });
  on('read', async (p, start, end) => {
    const fh = await fsp.open(p, 'r');
    try { const buf = Buffer.alloc(Math.max(0, end - start)); const { bytesRead } = await fh.read(buf, 0, buf.length, start); return buf.subarray(0, bytesRead); }
    finally { await fh.close(); }
  });
  // Audiodatei ersetzen: erst vollständig daneben schreiben, dann umbenennen – so bleibt bei einem Abbruch das Original heil
  on('write', async (p, data) => {
    const tmp = path.join(path.dirname(p), '.one-' + process.pid + '-' + Date.now() + '.tmp');
    try { await fsp.writeFile(tmp, Buffer.from(data)); await fsp.rename(tmp, p); }
    catch (e) { await fsp.rm(tmp, { force: true }); throw e; }
    return true;
  });
  on('rename', async (from, to) => {
    if (await fsp.stat(to).catch(() => null)) throw new Error('Zieldatei existiert bereits');
    await fsp.rename(from, to);
    return true;
  });
  on('readBin', p => fsp.readFile(p).catch(() => null));
  on('writeBin', async (p, data, backup) => {
    await fsp.mkdir(path.dirname(p), { recursive: true });
    if (backup && await fsp.stat(p).catch(() => null)) await fsp.copyFile(p, p + '.one-sicherung-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
    await fsp.writeFile(p, typeof data === 'string' ? data : Buffer.from(data));
    return true;
  });
  on('list', async dir => { try { return (await fsp.readdir(dir, { withFileTypes: true })).map(e => ({ name: e.name, dir: e.isDirectory() })); } catch { return []; } });
}

async function serve(req) {
  const u = new URL(req.url);
  if (u.host === 'app') {
    const rel = decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname), full = path.join(WEB, rel);
    if (!full.startsWith(WEB)) return new Response('', { status: 403 });
    return net.fetch(pathToFileURL(full).toString());
  }
  if (u.host === 'file') { // Audiodatei mit Teilabrufen, damit sich im Titel springen lässt
    const p = decodeURIComponent(u.pathname.slice(1));
    const st = await fsp.stat(p).catch(() => null);
    if (!st || !AUDIO.test(p)) return new Response('', { status: 404 });
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
    let start = 0, end = st.size - 1;
    if (m) { if (m[1] === '') start = Math.max(0, st.size - +m[2]); else { start = +m[1]; if (m[2]) end = Math.min(end, +m[2]); } }
    if (start > end) return new Response('', { status: 416, headers: { 'Content-Range': `bytes */${st.size}` } });
    const headers = { 'Content-Type': MIME[path.extname(p).slice(1).toLowerCase()] || 'application/octet-stream', 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' };
    if (m) headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
    return new Response(Readable.toWeb(fs.createReadStream(p, { start, end })), { status: m ? 206 : 200, headers });
  }
  return new Response('', { status: 404 });
}

app.whenReady().then(() => {
  protocol.handle('one', serve);
  const win = new BrowserWindow({ width: 1480, height: 920, minWidth: 1000, minHeight: 640, backgroundColor: '#111315', title: 'ONE Library',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false } });
  win.setMenuBarVisibility(false);
  handlers(win);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('one://app/docs/')) return { action: 'allow', overrideBrowserWindowOptions: { width: 1180, height: 900, autoHideMenuBar: true, backgroundColor: '#111315', title: 'ONE Library – Handbuch' } };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('one://app/')) e.preventDefault(); });
  win.loadURL('one://app/index.html');
});
app.on('window-all-closed', () => app.quit());
