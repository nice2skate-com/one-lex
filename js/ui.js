'use strict';
/* DJ KOLJA ONE · Library — Oberfläche und Ablaufsteuerung */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const LOC = typeof I18n === 'undefined' ? 'de-DE' : I18n.locale; // Zahlen- und Datumsformat der gewählten Sprache
  const tr = s => typeof I18n === 'undefined' ? s : I18n.t(s);     // für Texte außerhalb des Seiteninhalts (Wellenform)
  const time = s => { s = Math.max(0, Math.round(s || 0)); const m = Math.floor(s / 60); return (m >= 60 ? Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); };
  const date = ms => ms ? new Date(ms).toLocaleDateString(LOC, { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
  const nf = n => n.toLocaleString(LOC);
  const ROW = 34;
  const COLORS = ['', '#B79A6B', '#C96A5A', '#D9A441', '#7FA66B', '#5E9BB5', '#8E7CC3', '#B9B5AD'];
  const CUE_COLORS = ['#C8AF82', '#C96A5A', '#D9A441', '#7FA66B', '#5E9BB5', '#8E7CC3', '#D987B0', '#F4F0E8'];
  const IC = {
    play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 4.5h4.5v15H6zm7.5 0H18v15h-4.5z"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z"/></svg>'
  };
  // min: Spalte erscheint erst ab dieser Tabellenbreite (px); opt: nur auf Wunsch (Rechtsklick auf die Kopfzeile)
  const ALL_COLS = [
    { f: 'pos', l: '#', w: '44px' }, { f: 'color', l: '', w: '22px' },
    { f: 'title', l: 'Titel', w: 'minmax(150px,2.2fr)' }, { f: 'artist', l: 'Artist', w: 'minmax(110px,1.6fr)' },
    { f: 'album', l: 'Album', w: 'minmax(90px,1.2fr)', min: 1120 }, { f: 'genre', l: 'Genre', w: 'minmax(70px,.9fr)', min: 700 },
    { f: 'bpm', l: 'BPM', w: '62px' }, { f: 'key', l: 'Key', w: '54px' }, { f: 'duration', l: 'Zeit', w: '56px' },
    { f: 'rating', l: 'Bewertung', w: '96px', min: 600 }, { f: 'year', l: 'Jahr', w: '52px', min: 900 },
    { f: 'tags', l: 'Tags', w: 'minmax(80px,1fr)', min: 800 }, { f: 'added', l: 'Hinzugefügt', w: '96px', min: 1000 },
    { f: 'energy', l: 'Energie', w: '72px', opt: true }, { f: 'playCount', l: 'Plays', w: '58px', opt: true }, { f: 'lastPlayed', l: 'Gespielt', w: '96px', opt: true },
    { f: 'comment', l: 'Kommentar', w: 'minmax(100px,1.3fr)', opt: true }, { f: 'format', l: 'Typ', w: '56px', opt: true },
    { f: 'bitrate', l: 'kbit/s', w: '64px', opt: true }, { f: 'file', l: 'Datei', w: 'minmax(120px,1.5fr)', opt: true }
  ];
  const FIXED_COL = f => f === 'pos' || f === 'color';
  let COLS = ALL_COLS.filter(c => !c.opt);
  function fitCols(force) {
    const w = $('#tbody').clientWidth, cs = S.settings.cols;
    const rank = f => f === 'pos' ? -2 : f === 'color' ? -1 : cs.order.includes(f) ? cs.order.indexOf(f) : 1000 + ALL_COLS.findIndex(c => c.f === f);
    const next = ALL_COLS.filter(c => FIXED_COL(c.f) || c.f === 'title' ? true : cs.hidden.includes(c.f) ? false : cs.shown.includes(c.f) ? true : !c.opt && (!c.min || w >= c.min))
      .sort((a, b) => rank(a.f) - rank(b.f));
    const sig = next.map(c => c.f + (cs.w[c.f] || '')).join();
    if (sig === fitCols.sig && !force) return;
    fitCols.sig = sig;
    COLS = next;
    document.documentElement.style.setProperty('--cols', COLS.map(c => cs.w[c.f] ? cs.w[c.f] + 'px' : c.w).join(' '));
    renderHead();
  }
  function colMenu(e) {
    const cs = S.settings.cols, vis = new Set(COLS.map(c => c.f));
    const apply = () => { saveSettings(); fitCols(true); drawRows(); };
    menu(e.clientX, e.clientY, [{ head: 'Spalten' }, ...ALL_COLS.filter(c => !FIXED_COL(c.f) && c.f !== 'title').map(c => ({ l: (vis.has(c.f) ? '✓  ' : '     ') + c.l, fn: () => {
      const on = vis.has(c.f);
      cs.hidden = cs.hidden.filter(x => x !== c.f); cs.shown = cs.shown.filter(x => x !== c.f);
      (on ? cs.hidden : cs.shown).push(c.f);
      apply();
    } })), null, { l: 'Standard wiederherstellen', fn: () => { S.settings.cols = { hidden: [], shown: [], order: [], w: {} }; apply(); } }]);
  }
  const RULE_FIELDS = { title: 'Titel', artist: 'Artist', album: 'Album', genre: 'Genre', comment: 'Kommentar', tags: 'Tags', key: 'Tonart', bpm: 'BPM', year: 'Jahr', rating: 'Bewertung', duration: 'Dauer (Sek.)', playCount: 'Wiedergaben', energy: 'Energie', addedDays: 'Hinzugefügt vor (Tagen)' };
  const RULE_NUM = new Set(['bpm', 'year', 'rating', 'duration', 'playCount', 'energy', 'addedDays']);
  const ACTIONS = { play: ['Wiedergabe / Pause', 'Space'], load: ['Auswahl ins Deck laden', 'Enter'], memory: ['Memory-Cue setzen', 'KeyM'], panel: ['Cues & Raster öffnen', 'KeyE'],
    zoom: ['Wellenform-Zoom', 'KeyZ'], match: ['Passende Titel anzeigen', 'KeyH'], analyze: ['Auswahl analysieren', 'KeyA'], search: ['Suche', 'Slash'] };
  const keyLabel = c => c === 'None' ? '–' : c === 'Space' ? 'Leertaste' : c === 'Slash' ? '/' : c.replace(/^(Key|Digit)/, '');
  const RULE_OPS = { has: 'enthält', hasnt: 'enthält nicht', is: 'ist', isnt: 'ist nicht', gt: 'größer als', lt: 'kleiner als' };

  const D = window.oneDesktop || null; // nur in der Desktop-App vorhanden
  const isAbs = p => /^(\/|[A-Za-z]:[\\/])/.test(p || '');
  const toAB = u => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength);
  /* Datei auf der Platte (Desktop-App): verhält sich für Tag-Leser, Analyse und Tag-Schreiber wie ein File-Objekt */
  const dfile = (path, size) => ({ path, size, name: path.replace(/\\/g, '/').split('/').pop(), url: 'one://file/' + encodeURIComponent(path),
    slice(a, b) { return { arrayBuffer: async () => toAB(await D.read(path, a || 0, Math.min(b == null ? size : b, size))) }; },
    arrayBuffer: async () => toAB(await D.read(path, 0, size)) });
  const ditems = list => list.map(f => ({ file: dfile(f.path, f.size), path: f.path, desktop: true }));

  const S = {
    tracks: new Map(), lists: [], roots: [], files: new Map(),
    view: { type: 'all' }, sel: new Set(), anchor: null, sort: { f: 'added', d: -1 }, q: '', rows: [],
    settings: { keyMode: 'camelot', basePath: '', quantize: true, volume: 0.9, theme: 'dark', normalize: false, cols: { hidden: [], shown: [], order: [], w: {} }, sorts: {}, keys: {} },
    cur: null, curWave: null, busy: null, dupes: null, loop: null, click: false, panel: false, zoom: false, curHi: null, wish: [], spotify: null
  };
  const audio = new Audio();
  let audioUrl = null;

  /* ---------- Hilfen ---------- */
  function toast(msg, warn) {
    const el = document.createElement('div');
    el.className = 'toast' + (warn ? ' warn' : '');
    el.textContent = msg;
    $('#toasts').append(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, warn ? 5200 : 3000);
  }
  function download(name, text, type = 'text/plain') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  const saveSettings = () => DB.put('meta', S.settings, 'settings');
  const saveTracks = ts => DB.putMany('tracks', ts);
  const saveList = l => DB.put('lists', l);
  const keyShow = k => Keys.show(k, S.settings.keyMode);
  const connected = t => D ? isAbs(t.path) : S.files.has(t.id) || (!!t.root && S.roots.some(r => r.id === t.root));
  const isMissing = t => !connected(t) || !!t.missing;
  const absPath = t => /^(\/|[A-Za-z]:[\\/])/.test(t.path) ? t.path : (S.settings.basePath || '').replace(/[\\/]*$/, '/') + t.path;
  const selected = () => S.rows.filter(t => S.sel.has(t.id));
  const fileName = t => (t.path || '').replace(/\\/g, '/').split('/').pop();
  const extOf = t => (/\.([a-z0-9]+)$/i.exec(t.path || '') || [0, ''])[1].toUpperCase();
  const bitrate = t => t.size && t.duration ? Math.round(t.size * 8 / t.duration / 1000) : 0;
  const sortVal = (t, f) => f === 'key' ? Keys.sortVal(t.key) : f === 'tags' ? (t.tags || []).join(',').toLowerCase() : f === 'format' ? extOf(t) : f === 'bitrate' ? bitrate(t) : f === 'file' ? fileName(t) : t[f];
  const cmpVal = (a, b, f) => {
    const x = sortVal(a, f), y = sortVal(b, f);
    if (typeof x === 'string' || typeof y === 'string') return String(x || '').localeCompare(String(y || ''), 'de', { sensitivity: 'base', numeric: true });
    return (x || 0) - (y || 0);
  };
  const keyOf = a => S.settings.keys[a] || ACTIONS[a][1];
  const viewKey = v => v.type + ':' + (v.id || '');
  const applyTheme = () => { document.body.dataset.theme = S.settings.theme || 'dark'; };

  /* Rückgängig: vor jeder Änderung den Stand der betroffenen Titel und aller Listen merken */
  const undoStack = [];
  function snap(label, tracks = []) {
    undoStack.push({ label, tracks: structuredClone(tracks), lists: structuredClone(S.lists) });
    if (undoStack.length > 40) undoStack.shift();
  }
  async function undo() {
    const u = undoStack.pop();
    if (!u) return toast('Nichts zum Rückgängigmachen.');
    for (const t of u.tracks) S.tracks.set(t.id, t);
    await saveTracks(u.tracks);
    S.lists = u.lists;
    await DB.clear('lists'); await DB.putMany('lists', S.lists);
    S.loop = null;
    if (S.cur) S.cur = S.tracks.get(S.cur.id) || null;
    if (S.view.type === 'list' && !S.lists.some(l => l.id === S.view.id)) S.view = { type: 'all' };
    dirty(); renderDeck();
    toast('Rückgängig: ' + u.label);
  }

  function modal({ title, body, ok = 'Speichern', wide, onOpen }) {
    return new Promise(res => {
      const ov = document.createElement('div');
      ov.className = 'ov';
      ov.innerHTML = `<form class="modal${wide ? ' wide' : ''}"><div class="mhead"><h3>${esc(title)}</h3><button type="button" class="btn ghost icon" data-x aria-label="Schließen">${IC.x}</button></div><div class="mbody">${body}<div class="row end"><button type="button" class="btn" data-x>Abbrechen</button>${ok ? `<button class="btn primary">${esc(ok)}</button>` : ''}</div></div></form>`;
      const close = v => { ov.remove(); document.removeEventListener('keydown', onKey, true); res(v); };
      const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } };
      ov.addEventListener('mousedown', e => { if (e.target === ov) close(null); });
      ov.addEventListener('click', e => { if (e.target.closest('[data-x]')) close(null); });
      ov.querySelector('form').addEventListener('submit', e => { e.preventDefault(); close(e.target); });
      document.addEventListener('keydown', onKey, true);
      document.body.append(ov);
      if (onOpen) onOpen(ov);
      const first = ov.querySelector('input:not([type=hidden]), select, textarea');
      if (first) first.focus();
    });
  }
  const confirmBox = (title, text, ok = 'Löschen') => modal({ title, body: `<p class="mut">${esc(text)}</p>`, ok });

  function menu(x, y, items) {
    closeMenu();
    const el = document.createElement('div');
    el.className = 'menu';
    el.innerHTML = items.map((it, i) => !it ? '<hr>' : it.head ? `<div class="mhd">${esc(it.head)}</div>` : `<button data-i="${i}"${it.raw ? ' class="raw"' : ''}${it.off ? ' disabled' : ''}>${esc(it.l)}</button>`).join('');
    document.body.append(el);
    const r = el.getBoundingClientRect();
    el.style.left = Math.max(6, Math.min(x, innerWidth - r.width - 6)) + 'px';
    el.style.top = Math.max(6, Math.min(y, innerHeight - r.height - 6)) + 'px';
    el.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { closeMenu(); items[+b.dataset.i].fn(); } });
  }
  function closeMenu() { const m = $('.menu'); if (m) m.remove(); }

  /* ---------- Dateizugriff ---------- */
  async function perm(h, ask, mode = 'read') {
    if (!h.queryPermission) return true;
    let p = await h.queryPermission({ mode });
    if (p !== 'granted' && ask) p = await h.requestPermission({ mode });
    return p === 'granted';
  }
  /* Schreibbarer Zugriff auf die Originaldatei (nur Chrome/Edge, nur über gewählte Ordner oder Dateien) */
  async function writableOf(t, ask) {
    if (D) {
      const file = await fileOf(t);
      let data = null;
      return file && { getFile: async () => file, createWritable: async () => ({ write: async d => { data = d; }, close: () => D.write(t.path, data) }) };
    }
    const f = S.files.get(t.id);
    if (f && f.createWritable) return (await perm(f, ask, 'readwrite')) ? f : null;
    const root = t.root && S.roots.find(r => r.id === t.root);
    if (!root || !root.handle.getFileHandle || !(await perm(root.handle, ask, 'readwrite'))) return null;
    const parts = t.rel.split('/');
    let dir = root.handle;
    for (let i = 0; i < parts.length - 1; i++) dir = await dir.getDirectoryHandle(parts[i]);
    return dir.getFileHandle(parts[parts.length - 1]);
  }
  async function fileOf(t, ask) {
    if (D) { const st = isAbs(t.path) ? await D.stat(t.path) : null; return st ? dfile(t.path, st.size) : null; }
    const f = S.files.get(t.id);
    if (f instanceof File) return f;
    if (f && f.getFile) return (await perm(f, ask)) ? f.getFile() : null;
    const root = t.root && S.roots.find(r => r.id === t.root);
    if (!root || !(await perm(root.handle, ask))) return null;
    const parts = t.rel.split('/');
    let dir = root.handle;
    for (let i = 0; i < parts.length - 1; i++) dir = await dir.getDirectoryHandle(parts[i]);
    return (await dir.getFileHandle(parts[parts.length - 1])).getFile();
  }

  async function walk(dir, prefix, rootId, out) {
    for await (const [name, h] of dir.entries()) {
      if (name.startsWith('.')) continue;
      if (h.kind === 'directory') await walk(h, prefix + name + '/', rootId, out);
      else if (Tags.isAudio(name)) out.push({ handle: h, root: rootId, rel: prefix + name, path: out.rootName + '/' + prefix + name });
    }
  }
  async function addRoot(handle) {
    let root = null;
    for (const r of S.roots) if (await r.handle.isSameEntry(handle)) root = r;
    if (!root) { root = { id: uid(), name: handle.name, handle }; S.roots.push(root); await DB.put('meta', S.roots, 'roots'); }
    const out = []; out.rootName = handle.name;
    await walk(handle, '', root.id, out);
    return out;
  }

  async function pickFolder() {
    if (D) {
      const dir = await D.pickFolder();
      if (!dir) return;
      status('Ordner wird gelesen …');
      return addItems(ditems(await D.scan(dir)));
    }
    if (window.showDirectoryPicker) {
      let h;
      try { h = await window.showDirectoryPicker({ mode: 'read' }); } catch { return; }
      status('Ordner wird gelesen …');
      addItems(await addRoot(h));
    } else $('#pickDir').click();
  }
  async function pickFiles() {
    if (D) return addItems(ditems(await D.pickFiles()));
    if (window.showOpenFilePicker) {
      let hs;
      try { hs = await window.showOpenFilePicker({ multiple: true }); } catch { return; }
      addItems(hs.filter(h => Tags.isAudio(h.name)).map(h => ({ handle: h, path: h.name })));
    } else $('#pickFiles').click();
  }
  const itemsFromFiles = files => [...files].filter(f => Tags.isAudio(f.name)).map(f => ({ file: f, path: f.webkitRelativePath || f.name }));

  async function addItems(items) {
    if (!items.length) { status(); return toast('Keine Audiodateien gefunden.', true); }
    if (S.busy) return toast('Bitte warten, es läuft noch ein Vorgang.', true);
    const job = S.busy = { stop: false };
    const bySize = new Map(), byName = new Map();
    for (const t of S.tracks.values()) {
      const n = fileName(t).toLowerCase();
      bySize.set(n + '|' + t.size, t);
      if (!byName.has(n)) byName.set(n, t);
    }
    let added = 0, linked = 0, done = 0;
    const changed = [];
    const one = async it => {
      const file = it.file || await it.handle.getFile();
      const n = file.name.toLowerCase();
      let t = bySize.get(n + '|' + file.size);
      if (!t) { const c = byName.get(n); if (c && (!c.size || !connected(c))) t = c; }
      if (t) {
        if (!connected(t) || t.missing) linked++;
        t.size = file.size; delete t.missing;
      } else {
        const tag = await Tags.read(file);
        t = { id: uid(), title: tag.title, artist: tag.artist || '', album: tag.album || '', genre: tag.genre || '', year: tag.year, comment: tag.comment || '',
          bpm: tag.bpm, key: Keys.parse(tag.key), duration: await Tags.duration(file), rating: 0, color: '', tags: [], cues: tag.cues || [], gridStart: 0,
          path: it.path, size: file.size, added: Date.now(), playCount: 0, analyzed: false };
        S.tracks.set(t.id, t);
        bySize.set(n + '|' + file.size, t);
        await storeCover(t, tag.picture);
        added++;
      }
      if (it.desktop) t.path = it.path;
      else if (it.root) { t.root = it.root; t.rel = it.rel; if (!/^(\/|[A-Za-z]:)/.test(t.path)) t.path = it.path; }
      else {
        S.files.set(t.id, it.handle || file);
        if (it.handle) await DB.put('handles', it.handle, t.id);
      }
      changed.push(t);
    };
    for (let i = 0; i < items.length && !job.stop; i += 4) {
      await Promise.all(items.slice(i, i + 4).map(it => one(it).catch(() => {})));
      done = Math.min(items.length, i + 4);
      status(`Import ${nf(done)} / ${nf(items.length)}`, done / items.length);
    }
    await saveTracks(changed);
    S.busy = null;
    status();
    dirty();
    toast(`${nf(added)} Titel hinzugefügt` + (linked ? `, ${nf(linked)} neu verbunden` : '') + '.');
  }

  async function storeCover(t, pic) {
    if (!pic) return;
    try {
      const bmp = await createImageBitmap(new Blob([pic.data], { type: pic.mime }));
      const k = Math.min(1, 240 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
      if (blob) { await DB.put('covers', blob, t.id); t.cover = true; }
    } catch { /* Bild nicht lesbar: ohne Cover weiter */ }
  }
  const coverUrls = new Map();
  async function fillCovers(root) {
    for (const img of $$('[data-cover]', root)) {
      const id = img.dataset.cover;
      if (!coverUrls.has(id)) {
        const b = await DB.get('covers', id);
        if (!b) continue;
        coverUrls.set(id, URL.createObjectURL(b));
        if (coverUrls.size > 60) { const [k, u] = coverUrls.entries().next().value; URL.revokeObjectURL(u); coverUrls.delete(k); }
      }
      img.src = coverUrls.get(id);
    }
  }

  /* ---------- Analyse ---------- */
  async function analyze(tracks) {
    tracks = tracks.filter(connected);
    if (!tracks.length) return toast('Keine verbundenen Dateien in der Auswahl.', true);
    if (S.busy) return toast('Bitte warten, es läuft noch ein Vorgang.', true);
    const job = S.busy = { stop: false };
    let ok = 0, fail = 0;
    for (let i = 0; i < tracks.length && !job.stop; i++) {
      const t = tracks[i];
      status(`Analyse ${i + 1} / ${tracks.length}: ${t.title}`, i / tracks.length);
      try {
        const f = await fileOf(t, i === 0);
        if (!f) throw new Error('kein Zugriff');
        const r = await Analyze.run(f);
        if (r.bpm) { t.bpm = r.bpm; t.gridStart = r.gridStart; }
        if (r.key) t.key = Keys.fromPc(r.key.pc, r.key.minor);
        if (r.duration) t.duration = r.duration;
        t.loud = r.loud;
        if (!t.energy) t.energy = r.energy;
        if (!t.cover) await storeCover(t, (await Tags.read(f)).picture);
        t.analyzed = true; delete t.missing;
        await DB.put('waves', r.wave, t.id);
        await DB.put('waves', r.waveHi, t.id + '~hi');
        await DB.put('tracks', t);
        if (S.cur === t) { S.curWave = r.wave; S.curHi = r.waveHi; drawWave(); renderDeck(); }
        ok++;
        drawRows();
      } catch (e) { fail++; }
    }
    S.busy = null;
    status();
    dirty();
    toast(`${nf(ok)} Titel analysiert` + (fail ? `, ${nf(fail)} fehlgeschlagen` : '') + '.', fail > 0);
  }

  async function checkFiles() {
    if (S.busy) return;
    const job = S.busy = { stop: false };
    const all = [...S.tracks.values()], changed = [];
    let gone = 0, asked = false;
    for (let i = 0; i < all.length && !job.stop; i++) {
      const t = all[i];
      if (i % 25 === 0) status(`Dateien prüfen ${nf(i)} / ${nf(all.length)}`, i / all.length);
      let miss = true;
      if (connected(t)) {
        try { miss = !(await fileOf(t, !asked)); } catch { miss = true; }
        asked = true;
      }
      if (miss) gone++;
      if (!!t.missing !== miss && connected(t)) { if (miss) t.missing = true; else delete t.missing; changed.push(t); }
    }
    await saveTracks(changed);
    S.busy = null;
    status();
    dirty();
    toast(gone ? `${nf(gone)} Dateien fehlen. Ordner erneut hinzufügen, um sie neu zu verbinden.` : 'Alle Dateien sind erreichbar.', gone > 0);
    if (gone) setView({ type: 'missing' });
  }

  /* ---------- Ansichten, Filter, Sortierung ---------- */
  const norm = s => String(s || '').toLowerCase().replace(/\((original|extended|radio)[^)]*\)/g, '').replace(/[^a-z0-9äöüß]+/g, '');
  function dupes() {
    if (S.dupes) return S.dupes;
    const groups = new Map();
    for (const t of S.tracks.values()) {
      const k = norm(t.artist) + '|' + norm(t.title);
      if (k.length < 3) continue;
      (groups.get(k) || groups.set(k, []).get(k)).push(t);
    }
    const map = new Map();
    for (const [k, g] of groups) if (g.length > 1) for (const t of g) map.set(t.id, k);
    return S.dupes = map;
  }

  function ruleMatch(t, c) {
    if (c.conds) return c.match === 'any' ? c.conds.some(x => ruleMatch(t, x)) : c.conds.every(x => ruleMatch(t, x));
    const now = Date.now();
    if (RULE_NUM.has(c.field)) {
      const v = c.field === 'addedDays' ? (now - (t.added || now)) / 864e5 : +t[c.field] || 0, x = parseFloat(String(c.value).replace(',', '.')) || 0;
      return c.op === 'gt' ? v > x : c.op === 'lt' ? v < x : c.op === 'isnt' || c.op === 'hasnt' ? Math.round(v * 100) !== Math.round(x * 100) : Math.round(v * 100) === Math.round(x * 100);
    }
    const x = String(c.value || '').toLowerCase().trim();
    if (c.field === 'tags') {
      const tags = (t.tags || []).map(s => s.toLowerCase());
      const hit = c.op === 'is' || c.op === 'isnt' ? tags.includes(x) : tags.some(s => s.includes(x));
      return c.op === 'isnt' || c.op === 'hasnt' ? !hit : hit;
    }
    const v = c.field === 'key' ? (t.key || '').toLowerCase() : String(t[c.field] || '').toLowerCase();
    const xv = c.field === 'key' ? (Keys.parse(c.value) || x).toLowerCase() : x;
    switch (c.op) {
      case 'has': return v.includes(xv);
      case 'hasnt': return !v.includes(xv);
      case 'is': return v === xv;
      case 'isnt': return v !== xv;
      case 'gt': return v > xv;
      default: return v < xv;
    }
  }
  const smartTracks = l => {
    const r = l.rules || {}, cs = r.conds || [];
    let out = [...S.tracks.values()];
    if (cs.length) out = out.filter(t => r.match === 'any' ? cs.some(c => ruleMatch(t, c)) : cs.every(c => ruleMatch(t, c)));
    if (r.limit > 0) { out.sort((a, b) => cmpVal(a, b, r.sortBy || 'added') * (r.sortDir || -1)); out = out.slice(0, r.limit); }
    return out;
  };

  function viewTracks(v) {
    const all = [...S.tracks.values()];
    switch (v.type) {
      case 'recent': { const lim = Date.now() - 30 * 864e5; return all.filter(t => t.added >= lim); }
      case 'unanalyzed': return all.filter(t => !t.analyzed);
      case 'played': return all.filter(t => t.lastPlayed);
      case 'wishlist': return [];
      case 'dupes': { const d = dupes(); return all.filter(t => d.has(t.id)); }
      case 'missing': return all.filter(isMissing);
      case 'tag': return all.filter(t => (t.tags || []).includes(v.id));
      case 'match': {
        const c = S.tracks.get(v.id);
        if (!c) return [];
        return all.filter(t => t !== c && Keys.compatible(c.key, t.key) && (!c.bpm || !t.bpm || Math.abs(t.bpm - c.bpm) / c.bpm <= 0.06));
      }
      case 'list': {
        const l = S.lists.find(x => x.id === v.id);
        if (!l) return [];
        return l.type === 'smart' ? smartTracks(l) : l.trackIds.map(id => S.tracks.get(id)).filter(Boolean);
      }
      default: return all;
    }
  }

  function computeRows() {
    let rows = viewTracks(S.view);
    const words = S.q.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length) rows = rows.filter(t => {
      const hay = `${t.title} ${t.artist} ${t.album} ${t.genre} ${t.comment} ${(t.tags || []).join(' ')} ${keyShow(t.key)} ${t.bpm ? Math.round(t.bpm) : ''}`.toLowerCase();
      return words.every(w => hay.includes(w));
    });
    const { f, d } = S.sort;
    if (f !== 'pos') {
      const cmp = (a, b) => cmpVal(a, b, f);
      if (S.view.type === 'dupes') { const dm = dupes(); rows.sort((a, b) => dm.get(a.id).localeCompare(dm.get(b.id)) || cmp(a, b) * d); }
      else rows.sort((a, b) => cmp(a, b) * d);
    }
    S.rows = rows;
    for (const id of S.sel) if (!S.tracks.has(id)) S.sel.delete(id);
  }

  function setView(v) {
    S.view = v;
    const plain = v.type === 'list' && (S.lists.find(l => l.id === v.id) || {}).type === 'list';
    S.sort = S.settings.sorts[viewKey(v)] || (plain ? { f: 'pos', d: 1 } : v.type === 'played' ? { f: 'lastPlayed', d: -1 } : { f: 'added', d: -1 });
    if (S.sort.f === 'pos' && !plain) S.sort = { f: 'added', d: -1 };
    S.sel.clear(); S.anchor = null;
    refresh();
    $('#tbody').scrollTop = 0;
  }
  function dirty() { S.dupes = null; refresh(); }
  function refresh() { wishStale = true; computeRows(); renderSide(); renderHead(); drawRows(); renderInspector(); renderCount(); }

  /* ---------- Rendering ---------- */
  function shell() {
    $('#app').innerHTML = `
      <header class="bar">
        <img class="logo" src="assets/logo.svg" alt="DJ KOLJA ONE"><span class="eyebrow">Library</span>
        <input id="q" class="in" type="search" placeholder="Suchen: Titel, Artist, Genre, Tag, Key, BPM …" autocomplete="off">
        <button class="btn primary" id="bAdd">${IC.plus}<span>Musik hinzufügen</span></button>
        <button class="btn" id="bAnalyze">Analysieren</button>
        <button class="btn" id="bTools">Werkzeuge</button>
        <button class="btn" id="bIO">Import / Export</button>
        <button class="btn ghost" id="bSet">Einstellungen</button>
        <a class="btn ghost" id="bHelp" href="docs/index.html" target="_blank" rel="noopener">Hilfe</a>
      </header>
      <nav class="side scroll" id="side"></nav>
      <main class="main">
        <div class="thead" id="thead"></div>
        <div class="tbody scroll" id="tbody" tabindex="0"><div id="tspace"></div></div>
        <div class="foot"><span id="count"></span><span class="grow"></span><span id="status"></span><button class="btn ghost sm" id="bStop" hidden>Abbrechen</button><div class="prog" id="prog" hidden><i></i></div></div>
      </main>
      <aside class="insp scroll" id="insp"></aside>
      <section class="deck" id="deck"></section>
      <input type="file" id="pickFiles" multiple accept="audio/*,.mp3,.m4a,.aac,.flac,.wav,.aif,.aiff,.ogg,.opus" hidden>
      <input type="file" id="pickDir" webkitdirectory multiple hidden>
      <input type="file" id="pickImport" multiple hidden>
      <div id="toasts"></div>
      <div class="drop" id="drop" hidden><div>Dateien oder Ordner hier ablegen</div></div>`;
  }

  function status(text, frac) {
    $('#status').textContent = text || '';
    $('#prog').hidden = frac === undefined;
    $('#bStop').hidden = !S.busy;
    if (frac !== undefined) $('#prog i').style.width = Math.round(frac * 100) + '%';
  }
  function renderCount() {
    if (S.view.type === 'wishlist') { $('#count').textContent = `${nf(S.wish.length)} Titel auf der Einkaufsliste`; return; }
    const dur = S.rows.reduce((a, t) => a + (t.duration || 0), 0);
    $('#count').textContent = `${nf(S.rows.length)} Titel · ${time(dur)}` + (S.sel.size ? ` · ${nf(S.sel.size)} ausgewählt` : '');
  }

  function renderSide() {
    const all = [...S.tracks.values()];
    const on = (type, id) => S.view.type === type && S.view.id === id ? ' on' : '';
    const item = (type, id, label, n, extra = '') => `<button class="si${on(type, id)}" data-view="${type}" data-id="${esc(id || '')}"${extra}><span class="grow">${esc(label)}</span>${n === undefined ? '' : `<span class="n">${nf(n)}</span>`}</button>`;
    const tagCount = new Map();
    for (const t of all) for (const g of t.tags || []) tagCount.set(g, (tagCount.get(g) || 0) + 1);
    const lim = Date.now() - 30 * 864e5;
    let h = '<div class="sh">Bibliothek</div>' +
      item('all', '', 'Alle Titel', all.length) +
      item('recent', '', 'Neu (30 Tage)', all.filter(t => t.added >= lim).length) +
      item('unanalyzed', '', 'Nicht analysiert', all.filter(t => !t.analyzed).length) +
      item('played', '', 'Zuletzt gespielt', all.filter(t => t.lastPlayed).length) +
      item('dupes', '', 'Duplikate', dupes().size) +
      item('missing', '', 'Fehlende Dateien', all.filter(isMissing).length) +
      (S.wish.length || S.spotify || S.view.type === 'wishlist' ? item('wishlist', '', 'Einkaufsliste', S.wish.length) : '');
    if (S.view.type === 'match') h += item('match', S.view.id, 'Passend zum Deck', S.view.type === 'match' ? viewTracks(S.view).length : undefined);
    h += `<div class="sh">Playlists<button class="add" data-new="list" title="Neue Playlist">${IC.plus}</button></div>`;
    // Namen mit „ / “ werden als Ordner dargestellt
    const listItems = type => {
      let open = [], out = '';
      for (const l of S.lists.filter(x => x.type === type).sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }))) {
        const parts = l.name.split(' / '), leaf = parts.pop();
        parts.forEach((p, i) => { if (open[i] !== p) { open = open.slice(0, i); open[i] = p; out += `<div class="fold" style="--d:${i}">${esc(p)}</div>`; } });
        open = open.slice(0, parts.length);
        out += item('list', l.id, leaf, type === 'smart' ? smartTracks(l).length : l.trackIds.length, ` style="--d:${parts.length}"` + (type === 'list' ? ' data-drop="1"' : ''));
      }
      return out;
    };
    h += listItems('list') || '<div class="hint">Titel hierher ziehen, sobald eine Playlist angelegt ist.</div>';
    h += `<div class="sh">Smartlists<button class="add" data-new="smart" title="Neue Smartlist">${IC.plus}</button></div>`;
    h += listItems('smart') || '<div class="hint">Listen, die sich über Regeln selbst füllen.</div>';
    h += '<div class="sh">Tags</div>';
    h += [...tagCount].sort((a, b) => a[0].localeCompare(b[0], 'de')).map(([g, n]) => item('tag', g, g, n, ' data-drop="1"')).join('') || '<div class="hint">Tags im Bereich rechts vergeben.</div>';
    $('#side').innerHTML = h;
  }

  function renderHead() {
    $('#thead').hidden = S.view.type === 'wishlist';
    const plain = S.sort.f === 'pos';
    $('#thead').innerHTML = COLS.map(c => `<div class="th${S.sort.f === c.f ? ' on' : ''}" data-f="${c.f}"${FIXED_COL(c.f) ? '' : ' draggable="true"'}>${c.f === 'pos' && !plain ? '' : esc(c.l)}${S.sort.f === c.f && c.f !== 'pos' ? (S.sort.d > 0 ? ' ▲' : ' ▼') : ''}${FIXED_COL(c.f) ? '' : '<i class="rz"></i>'}</div>`).join('');
  }

  function cell(t, c, i) {
    switch (c.f) {
      case 'pos': return S.cur === t ? `<span class="now">${audio.paused ? '❙❙' : '▶'}</span>` : `<span class="mut">${i + 1}</span>`;
      case 'color': return t.color ? `<i class="dot" style="background:${t.color}"></i>` : '';
      case 'title': return `<span class="tt${isMissing(t) ? ' miss' : ''}">${esc(t.title)}</span>`;
      case 'bpm': return t.bpm ? (Math.round(t.bpm * 10) / 10).toLocaleString(LOC) : '';
      case 'key': { const m = /^(\d+)([AB])$/.exec(t.key || ''); return m ? `<span class="key" style="--h:${(+m[1] * 30 + 200) % 360}">${esc(keyShow(t.key))}</span>` : ''; }
      case 'duration': return t.duration ? time(t.duration) : '';
      case 'rating': return `<span class="stars">${'★'.repeat(t.rating || 0)}<s>${'★'.repeat(5 - (t.rating || 0))}</s></span>`;
      case 'year': return t.year || '';
      case 'tags': return (t.tags || []).map(g => `<span class="tag">${esc(g)}</span>`).join('');
      case 'added': return date(t.added);
      case 'energy': return t.energy ? `<span class="en" style="--e:${t.energy * 10}%">${t.energy}</span>` : '';
      case 'playCount': return t.playCount || '';
      case 'lastPlayed': return date(t.lastPlayed);
      case 'format': return esc(extOf(t));
      case 'bitrate': return bitrate(t) || '';
      case 'file': return esc(fileName(t));
      default: return esc(t[c.f]);
    }
  }
  function drawRows() {
    if (S.view.type === 'wishlist') return drawWish();
    const body = $('#tbody'), space = $('#tspace');
    space.style.height = S.rows.length * ROW + 'px';
    if (!S.rows.length) {
      space.innerHTML = `<div class="empty">${S.tracks.size ? 'Keine Titel in dieser Ansicht.' : '<b>Noch keine Musik in der Bibliothek.</b><br>Oben auf „Musik hinzufügen“ klicken oder einen Ordner in dieses Fenster ziehen.<br>Die Dateien bleiben, wo sie sind – es wird nichts kopiert oder hochgeladen.'}</div>`;
      return;
    }
    const a = Math.max(0, Math.floor(body.scrollTop / ROW) - 10), b = Math.min(S.rows.length, Math.ceil((body.scrollTop + body.clientHeight) / ROW) + 10);
    let h = '';
    for (let i = a; i < b; i++) {
      const t = S.rows[i];
      h += `<div class="tr${S.sel.has(t.id) ? ' sel' : ''}${S.cur === t ? ' cur' : ''}" data-id="${t.id}" draggable="true" style="top:${i * ROW}px">${COLS.map(c => `<div class="td c-${c.f}">${cell(t, c, i)}</div>`).join('')}</div>`;
    }
    space.innerHTML = h;
  }

  function renderInspector() {
    const sel = selected(), el = $('#insp');
    if (!sel.length) { el.innerHTML = '<div class="sh">Details</div><div class="hint">Einen oder mehrere Titel auswählen, um sie zu bearbeiten.<br><br>Doppelklick lädt einen Titel ins Deck. Rechtsklick öffnet das Kontextmenü.</div>'; return; }
    const multi = sel.length > 1, t = sel[0];
    const common = f => sel.every(x => String(x[f] || '') === String(t[f] || '')) ? (t[f] || '') : null;
    const field = (f, label, type = 'text', cls = '') => {
      const v = f === 'key' ? (common('key') === null ? null : keyShow(t.key)) : common(f);
      return `<label class="field ${cls}"><span class="lbl">${label}</span><input class="in" data-f="${f}" type="${type}" value="${v === null ? '' : esc(v || '')}" placeholder="${v === null ? '(verschiedene)' : ''}" ${type === 'number' ? 'step="any"' : ''}></label>`;
    };
    const rating = common('rating'), color = common('color');
    const tags = [...new Set(sel.flatMap(x => x.tags || []))].sort((a, b) => a.localeCompare(b, 'de'));
    el.innerHTML = `<div class="sh">${multi ? nf(sel.length) + ' Titel bearbeiten' : 'Details'}</div>
      ${!multi && t.cover ? `<img class="cover big" data-cover="${t.id}" alt="">` : ''}
      ${field('title', 'Titel')}${field('artist', 'Artist')}${field('album', 'Album')}${field('genre', 'Genre')}
      <div class="grid3">${field('bpm', 'BPM', 'number')}${field('key', 'Tonart')}${field('year', 'Jahr', 'number')}</div>
      <div class="grid3">${field('energy', 'Energie', 'number')}</div>
      <div class="field"><span class="lbl">Bewertung</span><div class="rate">${[1, 2, 3, 4, 5].map(n => `<button data-rate="${n}" class="${rating >= n ? 'on' : ''}">★</button>`).join('')}</div></div>
      <div class="field"><span class="lbl">Farbe</span><div class="swatches">${COLORS.map(c => `<button data-color="${c}" class="${color === c ? 'on' : ''}" style="--c:${c || 'transparent'}" title="${c ? '' : 'Keine'}"></button>`).join('')}</div></div>
      <div class="field"><span class="lbl">Tags</span><div class="tagbox">${tags.map(g => `<span class="tag">${esc(g)}<button data-untag="${esc(g)}" aria-label="Tag entfernen">×</button></span>`).join('')}<input id="tagIn" placeholder="Tag hinzufügen + Enter" list="tagList"><datalist id="tagList">${[...new Set([...S.tracks.values()].flatMap(x => x.tags || []))].map(g => `<option value="${esc(g)}">`).join('')}</datalist></div></div>
      <label class="field"><span class="lbl">Kommentar</span><textarea class="in" data-f="comment" rows="3" placeholder="${common('comment') === null ? '(verschiedene)' : ''}">${esc(common('comment') || '')}</textarea></label>
      ${multi ? '' : `<div class="meta"><div><span class="lbl">Datei</span><code>${esc(t.path)}</code></div><div><span class="lbl">Status</span>${isMissing(t) ? '<span class="warn">Datei nicht verbunden</span>' : 'Verbunden'} · ${t.analyzed ? 'analysiert' : 'nicht analysiert'} · ${nf(t.playCount || 0)}× gespielt</div></div>`}`;
    fillCovers(el);
  }

  /* ---------- Bearbeiten ---------- */
  async function edit(f, raw) {
    const sel = selected();
    if (!sel.length) return;
    let v = raw;
    if (f === 'bpm') v = Math.round((parseFloat(String(raw).replace(',', '.')) || 0) * 100) / 100;
    else if (f === 'year' || f === 'rating') v = parseInt(raw, 10) || 0;
    else if (f === 'energy') v = Math.max(0, Math.min(10, parseInt(raw, 10) || 0));
    else if (f === 'key') { v = Keys.parse(raw); if (raw.trim() && !v) return toast('Tonart nicht erkannt. Beispiele: 8A, Am, F#m, C.', true); }
    else if (typeof v === 'string') v = v.trim();
    snap('Bearbeiten', sel);
    for (const t of sel) t[f] = v;
    await saveTracks(sel);
    dirty();
    if (sel.includes(S.cur)) renderDeck();
  }
  async function tagSel(name, addIt, tracks = selected()) {
    name = name.trim();
    if (!name || !tracks.length) return;
    snap('Tags', tracks);
    for (const t of tracks) {
      const set = new Set(t.tags || []);
      addIt ? set.add(name) : set.delete(name);
      t.tags = [...set];
    }
    await saveTracks(tracks);
    dirty();
  }

  async function removeSelected() {
    const sel = selected();
    if (!sel.length) return;
    const list = S.view.type === 'list' && S.lists.find(l => l.id === S.view.id && l.type === 'list');
    if (list) {
      snap('Aus Playlist entfernen');
      const ids = new Set(sel.map(t => t.id));
      list.trackIds = list.trackIds.filter(id => !ids.has(id));
      await saveList(list);
    } else {
      if (!(await confirmBox('Aus Bibliothek entfernen', `${nf(sel.length)} Titel aus der Bibliothek entfernen? Die Audiodateien selbst bleiben unangetastet.`, 'Entfernen'))) return;
      snap('Aus Bibliothek entfernen', sel);
      const ids = sel.map(t => t.id), set = new Set(ids);
      for (const id of ids) S.tracks.delete(id);
      for (const l of S.lists) if (l.trackIds && l.trackIds.some(id => set.has(id))) { l.trackIds = l.trackIds.filter(id => !set.has(id)); await saveList(l); }
      await DB.delMany('tracks', ids); // Wellenform, Cover und Dateiverbindung bleiben bis zum nächsten Start (für Rückgängig)
      if (S.cur && set.has(S.cur.id)) unload();
    }
    S.sel.clear();
    dirty();
  }

  async function addToList(list, tracks) {
    const have = new Set(list.trackIds);
    const fresh = tracks.filter(t => !have.has(t.id));
    if (fresh.length) snap('Zu Playlist hinzufügen');
    list.trackIds.push(...fresh.map(t => t.id));
    await saveList(list);
    dirty();
    toast(fresh.length ? `${nf(fresh.length)} Titel zu „${list.name}“ hinzugefügt.` : 'Die Titel sind bereits in dieser Playlist.');
  }
  async function newList(tracks) {
    const f = await modal({ title: 'Neue Playlist', body: '<label class="field"><span class="lbl">Name</span><input class="in" name="name" required><small>Mit „Ordner / Name“ landet die Playlist in einem Ordner.</small></label>', ok: 'Anlegen' });
    if (!f) return;
    snap('Neue Playlist');
    const l = { id: uid(), type: 'list', name: f.name.value.trim() || 'Playlist', trackIds: (tracks || []).map(t => t.id) };
    S.lists.push(l);
    await saveList(l);
    tracks ? dirty() : setView({ type: 'list', id: l.id });
  }

  async function editSmart(list) {
    const l = list || { id: uid(), type: 'smart', name: '', rules: { match: 'all', conds: [{ field: 'genre', op: 'has', value: '' }] } };
    const row = c => `<div class="rule"><select class="in" data-k="field">${Object.entries(RULE_FIELDS).map(([k, v]) => `<option value="${k}"${c.field === k ? ' selected' : ''}>${v}</option>`).join('')}</select><select class="in" data-k="op">${Object.entries(RULE_OPS).map(([k, v]) => `<option value="${k}"${c.op === k ? ' selected' : ''}>${v}</option>`).join('')}</select><input class="in" data-k="value" value="${esc(c.value)}"><button type="button" class="btn ghost icon" data-delrule aria-label="Regel entfernen">${IC.x}</button></div>`;
    const group = c => `<div class="rgroup"><div class="row"><span class="lbl">Gruppe:</span><select class="in" data-k="gmatch"><option value="any">mindestens eine Regel</option><option value="all"${c.match === 'all' ? ' selected' : ''}>alle Regeln</option></select><button type="button" class="btn sm" data-addin>${IC.plus} Regel</button><button type="button" class="btn ghost icon sm" data-delgroup aria-label="Gruppe entfernen">${IC.x}</button></div><div class="grules">${c.conds.map(row).join('')}</div></div>`;
    const read = r => ({ field: $('[data-k=field]', r).value, op: $('[data-k=op]', r).value, value: $('[data-k=value]', r).value.trim() });
    const f = await modal({
      title: list ? 'Smartlist bearbeiten' : 'Neue Smartlist', wide: true,
      body: `<label class="field"><span class="lbl">Name</span><input class="in" name="name" required value="${esc(l.name)}"></label>
        <label class="field"><span class="lbl">Titel aufnehmen, wenn</span><select class="in" name="match"><option value="all"${l.rules.match === 'all' ? ' selected' : ''}>alle Regeln zutreffen</option><option value="any"${l.rules.match === 'any' ? ' selected' : ''}>mindestens eine Regel zutrifft</option></select></label>
        <div id="rules">${l.rules.conds.map(c => c.conds ? group(c) : row(c)).join('')}</div><div class="row"><button type="button" class="btn" id="addRule">${IC.plus} Regel</button><button type="button" class="btn" id="addGroup">${IC.plus} Gruppe</button></div>
        <div class="grid3"><label class="field"><span class="lbl">Höchstens (Titel)</span><input class="in" name="limit" type="number" min="0" value="${l.rules.limit || ''}" placeholder="unbegrenzt"></label>
          <label class="field"><span class="lbl">Auswahl nach</span><select class="in" name="sortBy">${[['added', 'Hinzugefügt'], ['lastPlayed', 'Zuletzt gespielt'], ['playCount', 'Wiedergaben'], ['rating', 'Bewertung'], ['bpm', 'BPM'], ['energy', 'Energie'], ['year', 'Jahr']].map(([k, v]) => `<option value="${k}"${l.rules.sortBy === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="field"><span class="lbl">Richtung</span><select class="in" name="sortDir"><option value="-1">höchste / neueste zuerst</option><option value="1"${l.rules.sortDir === 1 ? ' selected' : ''}>niedrigste / älteste zuerst</option></select></label></div>`,
      onOpen: ov => ov.addEventListener('click', e => {
        const blank = { field: 'bpm', op: 'gt', value: '' };
        if (e.target.closest('#addRule')) $('#rules', ov).insertAdjacentHTML('beforeend', row(blank));
        if (e.target.closest('#addGroup')) $('#rules', ov).insertAdjacentHTML('beforeend', group({ match: 'any', conds: [blank] }));
        const a = e.target.closest('[data-addin]'); if (a) $('.grules', a.closest('.rgroup')).insertAdjacentHTML('beforeend', row(blank));
        const g = e.target.closest('[data-delgroup]'); if (g) return g.closest('.rgroup').remove();
        const d = e.target.closest('[data-delrule]'); if (d) d.parentElement.remove();
      })
    });
    if (!f) return;
    snap('Smartlist');
    l.name = f.name.value.trim() || 'Smartlist';
    l.rules = { match: f.match.value, limit: parseInt(f.limit.value, 10) || 0, sortBy: f.sortBy.value, sortDir: +f.sortDir.value, conds: [...$('#rules', f).children].map(el => el.classList.contains('rgroup') ? { match: $('[data-k=gmatch]', el).value, conds: $$('.rule', el).map(read).filter(c => c.value !== '') } : read(el)).filter(c => c.conds ? c.conds.length : c.value !== '') };
    if (!list) S.lists.push(l);
    await saveList(l);
    setView({ type: 'list', id: l.id });
  }

  async function findReplace() {
    const sel = selected();
    if (!sel.length) return toast('Zuerst Titel auswählen.', true);
    const f = await modal({ title: `Suchen & Ersetzen (${nf(sel.length)} Titel)`, ok: 'Ersetzen',
      body: `<label class="field"><span class="lbl">Feld</span><select class="in" name="field">${['title', 'artist', 'album', 'genre', 'comment'].map(k => `<option value="${k}">${RULE_FIELDS[k]}</option>`).join('')}</select></label>
        <label class="field"><span class="lbl">Suchen</span><input class="in" name="a" required></label><label class="field"><span class="lbl">Ersetzen durch</span><input class="in" name="b"></label>` });
    if (!f) return;
    const a = f.a.value, b = f.b.value, k = f.field.value;
    let n = 0;
    snap('Suchen & Ersetzen', sel);
    for (const t of sel) { const v = String(t[k] || ''); const w = v.split(a).join(b).trim(); if (w !== v) { t[k] = w; n++; } }
    await saveTracks(sel);
    dirty();
    toast(`${nf(n)} Titel geändert.`);
  }
  async function fromFileName() {
    const sel = selected();
    if (!sel.length) return toast('Zuerst Titel auswählen.', true);
    snap('Aus Dateiname benennen', sel);
    for (const t of sel) { const p = Tags.fromName(fileName(t)); t.title = p.title; if (p.artist) t.artist = p.artist; }
    await saveTracks(sel);
    dirty();
    toast(`${nf(sel.length)} Titel aus dem Dateinamen benannt.`);
  }

  /* ---------- Werkzeuge ---------- */
  async function batch(kind) {
    const sel = selected();
    if (!sel.length) return toast('Zuerst Titel auswählen.', true);
    const word = w => /^(feat\.?|ft\.?|vs\.?|pres\.?)$/i.test(w) ? w.toLowerCase() : /[A-ZÄÖÜ]/.test(w.slice(1)) && /[a-zäöüß]/.test(w) ? w : w.length <= 3 && w === w.toUpperCase() && /[A-ZÄÖÜ]{2}/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    snap({ caps: 'Groß-/Kleinschreibung', swap: 'Artist und Titel tauschen', trim: 'Leerzeichen bereinigen' }[kind], sel);
    for (const t of sel) {
      if (kind === 'swap') [t.title, t.artist] = [t.artist, t.title];
      else for (const f of ['title', 'artist', 'album', 'genre']) {
        const v = String(t[f] || '');
        t[f] = kind === 'caps' ? v.replace(/[^\s\-(\[\/&,]+/g, word) : v.replace(/\s+/g, ' ').trim();
      }
    }
    await saveTracks(sel);
    dirty();
    toast(`${nf(sel.length)} Titel bearbeitet. Mit Strg/⌘+Z rückgängig.`);
  }

  /* Duplikate: gleicher Artist + Titel und gleiche Länge (±3 s). Der beste Eintrag bleibt, Angaben und Playlists werden übernommen. */
  async function mergeDupes() {
    const groups = new Map();
    for (const [id, k] of dupes()) (groups.get(k) || groups.set(k, []).get(k)).push(S.tracks.get(id));
    const score = t => (connected(t) && !t.missing ? 8 : 0) + (t.analyzed ? 4 : 0) + ((t.cues || []).length ? 2 : 0) + Math.min(1, (t.size || 0) / 1e9);
    const plan = [];
    for (const g of groups.values()) {
      g.sort((a, b) => score(b) - score(a));
      const keep = g[0], gone = g.slice(1).filter(t => !keep.duration || !t.duration || Math.abs(keep.duration - t.duration) <= 3);
      if (gone.length) plan.push({ keep, gone });
    }
    const n = plan.reduce((a, p) => a + p.gone.length, 0);
    if (!n) return toast('Keine Duplikate mit gleicher Länge gefunden.');
    if (!(await confirmBox('Duplikate zusammenführen', `${n === 1 ? '1 doppelter Eintrag wird' : nf(n) + ' doppelte Einträge werden'} entfernt, ${nf(plan.length)} ${plan.length === 1 ? 'bleibt' : 'bleiben'}. Bewertung, Tags, Cues und Playlist-Zugehörigkeit gehen auf den verbleibenden Eintrag über. Die Audiodateien bleiben unangetastet.`, 'Zusammenführen'))) return;
    snap('Duplikate zusammenführen', plan.flatMap(p => [p.keep, ...p.gone]));
    const map = new Map(), kept = [];
    for (const { keep, gone } of plan) {
      for (const t of gone) {
        keep.tags = [...new Set([...(keep.tags || []), ...(t.tags || [])])];
        keep.rating = Math.max(keep.rating || 0, t.rating || 0);
        keep.playCount = (keep.playCount || 0) + (t.playCount || 0);
        for (const f of ['album', 'genre', 'comment', 'key', 'color', 'year', 'bpm', 'energy']) if (!keep[f] && t[f]) keep[f] = t[f];
        if (!(keep.cues || []).length && (t.cues || []).length) keep.cues = t.cues;
        map.set(t.id, keep.id);
        S.tracks.delete(t.id);
        if (S.cur === t) unload();
      }
      kept.push(keep);
    }
    await saveTracks(kept);
    await DB.delMany('tracks', [...map.keys()]);
    for (const l of S.lists) if (l.trackIds && l.trackIds.some(id => map.has(id))) { l.trackIds = [...new Set(l.trackIds.map(id => map.get(id) || id))]; await saveList(l); }
    S.sel.clear();
    dirty();
    toast(n === 1 ? '1 Duplikat zusammengeführt.' : `${nf(n)} Duplikate zusammengeführt.`);
  }

  async function writeTags() {
    const sel = selected();
    if (!sel.length) return toast('Zuerst Titel auswählen.', true);
    const ok = sel.filter(t => TagWrite.supported(fileName(t)));
    if (!ok.length) return toast('In der Auswahl ist keine Datei, deren Typ sich beschreiben lässt (MP3, FLAC, M4A, WAV, AIFF).', true);
    if (S.busy) return toast('Bitte warten, es läuft noch ein Vorgang.', true);
    const form = await modal({ title: 'Tags in Dateien schreiben', ok: 'Schreiben', body: `<p>Titel, Artist, Album, Genre, Jahr, BPM, Tonart und Kommentar werden in <b>${nf(ok.length)}</b> Audiodatei${ok.length === 1 ? '' : 'en'} geschrieben${ok.length < sel.length ? ` (${nf(sel.length - ok.length)} andere Dateitypen werden übersprungen)` : ''}.</p><p class="mut">Die Originaldateien werden dabei geändert; Cover und fremde Angaben bleiben erhalten. Das lässt sich nicht rückgängig machen.${D ? '' : ' Der Browser fragt gleich nach Schreibzugriff auf den Musikordner.'}</p>
      <label class="tog"><input type="checkbox" name="serato"><span class="sw"></span><span><span class="tl">Cues für Serato mitschreiben (experimentell)</span><small>Hot Cues und Loops werden zusätzlich so abgelegt, wie Serato sie erwartet – nur bei MP3, WAV und AIFF und nur, wenn die Datei noch keine Serato-Cues enthält. Nicht mit Serato gegengeprüft; bitte zuerst an Kopien ausprobieren.</small></span></label>` });
    if (!form) return;
    const serato = form.serato.checked;
    const job = S.busy = { stop: false }, fails = new Map();
    let done = 0, sWritten = 0, sKept = 0;
    for (let i = 0; i < ok.length && !job.stop; i++) {
      const t = ok[i];
      status(`Tags schreiben ${i + 1} / ${ok.length}: ${t.title}`, i / ok.length);
      try {
        const h = await writableOf(t, true);
        if (!h) throw new Error('kein Schreibzugriff (Ordner über „Musik hinzufügen“ in Chrome oder Edge wählen)');
        const opts = { serato };
        const data = await TagWrite.build(await h.getFile(), t, opts);
        if (opts.result === 'written') sWritten++; else if (opts.result === 'kept') sKept++;
        const w = await h.createWritable();
        await w.write(data);
        await w.close();
        t.size = data.length; delete t.missing;
        await DB.put('tracks', t);
        done++;
      } catch (e) { const m = tr(e.message || 'unbekannter Fehler'); fails.set(m, (fails.get(m) || 0) + 1); }
    }
    S.busy = null;
    status();
    dirty();
    if (serato) toast(`Serato-Cues: in ${nf(sWritten)} Dateien geschrieben, in ${nf(sKept)} vorhandene belassen.`);
    toast(`${nf(done)} Datei${done === 1 ? '' : 'en'} geschrieben.` + (fails.size ? ' Nicht geschrieben: ' + [...fails].map(([m, n]) => `${nf(n)}× ${m}`).join('; ') + '.' : ''), fails.size > 0);
  }

  /* Fehlende Angaben online ergänzen (MusicBrainz). Gesendet werden nur Artist und Titel, höchstens eine Anfrage pro Sekunde. */
  async function onlineLookup() {
    const sel = selected().filter(t => t.title && t.artist && (!t.album || !t.year || !t.genre));
    if (!sel.length) return toast('In der Auswahl fehlt nichts, was sich ergänzen ließe (Titel und Artist müssen vorhanden sein).', true);
    if (S.busy) return toast('Bitte warten, es läuft noch ein Vorgang.', true);
    if (!(await modal({ title: 'Angaben online ergänzen', ok: 'Suchen', body: `<p>Für <b>${nf(sel.length)}</b> Titel werden Artist und Titel an den freien Musikkatalog musicbrainz.org gesendet, um fehlendes Album, Jahr und Genre zu ergänzen.</p><p class="mut">Vorhandene Angaben bleiben unverändert. Die Suche dauert etwa eine Sekunde pro Titel und lässt sich mit Strg/⌘+Z rückgängig machen.</p>` }))) return;
    const job = S.busy = { stop: false };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const q = v => String(v).replace(/\((original|extended|radio|club)[^)]*\)/gi, '').replace(/[\\"]/g, ' ').trim();
    const same = (a, b) => norm(a) === norm(b) || norm(a).includes(norm(b)) || norm(b).includes(norm(a));
    snap('Online ergänzen', sel);
    let found = 0, fail = 0;
    const changed = [];
    for (let i = 0; i < sel.length && !job.stop; i++) {
      const t = sel[i];
      status(`Online-Suche ${i + 1} / ${sel.length}: ${t.title}`, i / sel.length);
      let data = null;
      for (let k = 0; k < 3 && !data && !job.stop; k++) {
        try {
          const r = await fetch('https://musicbrainz.org/ws/2/recording?fmt=json&limit=25&query=' + encodeURIComponent(`artist:"${q(t.artist)}" AND recording:"${q(t.title)}"`));
          const j = r.ok ? await r.json() : null;
          if (j && j.recordings) data = j;
        } catch { /* Netzfehler: gleich noch einmal */ }
        await wait(data ? 1100 : 2500);
      }
      if (!data) { fail++; continue; }
      // alle passenden Aufnahmen zusammen betrachten: frühestes Jahr, bevorzugt ein reguläres Album statt Sammlung oder Mitschnitt
      const recs = data.recordings.filter(r => r.score >= 85 && same(r.title, q(t.title)) && (r['artist-credit'] || []).some(a => same(a.name, t.artist)));
      if (!recs.length) continue;
      const rank = r => { const g = r['release-group'] || {}; return (r.status && r.status !== 'Official' ? 20 : 0) + ((g['secondary-types'] || []).length ? 10 : 0) + (g['primary-type'] === 'Album' ? 0 : g['primary-type'] === 'EP' ? 1 : g['primary-type'] === 'Single' ? 2 : 3); };
      const rel = recs.flatMap(r => r.releases || []).sort((a, b) => rank(a) - rank(b) || String(a.date || '9').localeCompare(String(b.date || '9')))[0];
      const years = recs.map(r => +(/^\d{4}/.exec(r['first-release-date'] || '') || [0])[0]).filter(Boolean);
      const year = years.length ? Math.min(...years) : +(/^\d{4}/.exec((rel && rel.date) || '') || [0])[0];
      const tag = recs.flatMap(r => r.tags || []).sort((a, b) => b.count - a.count)[0];
      let hit = false;
      if (!t.album && rel && rel.title) { t.album = rel.title; hit = true; }
      if (!t.year && year) { t.year = year; hit = true; }
      if (!t.genre && tag && tag.name) { t.genre = tag.name.replace(/(^|[\s-])\S/g, c => c.toUpperCase()); hit = true; }
      if (hit) { found++; changed.push(t); }
    }
    await saveTracks(changed);
    S.busy = null;
    status();
    dirty();
    toast(`${nf(found)} von ${nf(sel.length)} Titeln ergänzt.` + (fail ? ` ${nf(fail)} Anfragen sind fehlgeschlagen (Dienst nicht erreichbar oder ausgelastet).` : ''), fail > 0);
  }

  /* ---------- Deck ---------- */
  const time2 = s => { const m = Math.floor(s / 60); return m + ':' + (s - m * 60).toFixed(1).padStart(4, '0'); };
  const cueColor = c => c.color || (c.n >= 0 ? CUE_COLORS[c.n] : '#B9B5AD');
  const normFactor = t => S.settings.normalize && t && typeof t.loud === 'number' ? Math.max(0.2, Math.min(1, Math.pow(10, (-14 - t.loud) / 20))) : 1;
  const applyVol = () => { audio.volume = Math.max(0, Math.min(1, S.settings.volume * normFactor(S.cur))); };

  /* Beatraster: erster Abschnitt ab gridStart mit t.bpm, danach optionale Tempowechsel t.tempos = [{ t, bpm }] */
  const sections = t => [{ t: t.gridStart || 0, bpm: t.bpm }, ...(t.tempos || [])].filter(s => s.bpm > 0);
  function sectionAt(t, pos) { let s = null; for (const x of sections(t)) if (!s || x.t <= pos + 1e-6) s = x; return s; }
  const snapBeat = (t, pos) => { const s = sectionAt(t, pos); if (!s) return pos; const b = 60 / s.bpm; return Math.max(0, Math.round((pos - s.t) / b) * b + s.t); };
  function eachBeat(t, from, to, fn) {
    const ss = sections(t);
    ss.forEach((s, i) => {
      const b = 60 / s.bpm, end = Math.min(to, i + 1 < ss.length ? ss[i + 1].t : Infinity);
      let k = Math.ceil((from - s.t) / b - 1e-6);
      if (i > 0 && k < 0) k = 0;
      for (; s.t + k * b < end - 1e-6; k++) fn(s.t + k * b, k);
    });
  }

  function panelHtml(t) {
    const beat = t.bpm ? 60 / t.bpm : 0, beatAt = c => { const s = sectionAt(t, c.t); return s ? 60 / s.bpm : 0; };
    const row = (c, i) => `<div class="crow" data-i="${i}"><button type="button" class="cbadge" data-ccolor style="--c:${cueColor(c)}" title="Farbe wechseln">${c.n >= 0 ? c.n + 1 : 'M'}</button><button type="button" class="ctime" data-cgo title="Anspringen">${time2(c.t)}</button><input class="in" data-cname value="${esc(c.name)}" placeholder="Name" aria-label="Cue-Name"><select class="in" data-clen ${beat ? '' : 'disabled'} aria-label="Loop-Länge">${[0, 4, 8, 16, 32].map(b => `<option value="${b}"${beat && Math.round((c.len || 0) / beatAt(c)) === b ? ' selected' : ''}>${b ? b + ' Beats' : 'kein Loop'}</option>`).join('')}</select><button type="button" class="btn ghost icon sm" data-cdel aria-label="Cue löschen">${IC.x}</button></div>`;
    return `<div class="dpanel scroll" id="dpanel">
      <div class="sh">Beatraster</div>
      <div class="gridrow"><label class="field"><span class="lbl">BPM</span><input class="in" id="gBpm" type="number" step="any" value="${t.bpm || ''}"></label>
        <button type="button" class="btn sm" data-grid="half">÷ 2</button><button type="button" class="btn sm" data-grid="double">× 2</button>
        <button type="button" class="btn sm" data-grid="-10" title="Raster 10 ms früher">◀◀</button><button type="button" class="btn sm" data-grid="-1" title="Raster 1 ms früher">◀</button>
        <button type="button" class="btn sm" data-grid="1" title="Raster 1 ms später">▶</button><button type="button" class="btn sm" data-grid="10" title="Raster 10 ms später">▶▶</button>
        <button type="button" class="btn sm" data-grid="here" title="Beat an die aktuelle Position legen">Beat hier</button>
        <button type="button" class="btn sm${S.click ? ' active' : ''}" data-grid="click" title="Klick auf jeden Beat zum Prüfen des Rasters">Klick</button>
        <button type="button" class="btn sm" data-grid="tempo" title="Ab der aktuellen Position gilt ein anderes Tempo">Tempowechsel hier</button></div>
      ${(t.tempos || []).map((x, i) => `<div class="trow" data-i="${i}"><span class="mut">ab ${time2(x.t)}</span><input class="in" data-tbpm type="number" step="any" value="${x.bpm}" aria-label="BPM ab hier"><span class="mut">BPM</span><button type="button" class="btn ghost icon sm" data-tdel aria-label="Tempowechsel entfernen">${IC.x}</button></div>`).join('')}
      <div class="sh">Cues<span class="row"><button type="button" class="btn sm" id="cSuggest">Vorschlagen</button><button type="button" class="btn sm" id="cMem">+ Memory-Cue</button></span></div>
      ${(t.cues || []).map(row).join('') || '<div class="hint">Noch keine Cues. Tasten 1–8 setzen Hot Cues an der aktuellen Position.</div>'}</div>`;
  }

  function renderDeck() {
    const t = S.cur, el = $('#deck');
    if (!t) { el.innerHTML = '<div class="deckempty mut">Kein Titel geladen – Doppelklick auf einen Titel lädt ihn hier ins Deck.</div>'; return; }
    el.innerHTML = `
      <button class="btn primary icon big" id="pp" aria-label="Wiedergabe / Pause">${audio.paused ? IC.play : IC.pause}</button>
      ${t.cover ? `<img class="cover" data-cover="${t.id}" alt="">` : ''}
      <div class="dinfo"><div class="dt">${esc(t.title)}</div><div class="da">${esc(t.artist)}</div>
        <div class="dm"><span id="dtime">${time(audio.currentTime)}</span> / ${time(t.duration)}${t.bpm ? ` · <b>${(Math.round(t.bpm * 10) / 10).toLocaleString(LOC)}</b> BPM` : ''}${t.key ? ` · <b>${esc(keyShow(t.key))}</b>` : ''}</div></div>
      <div class="dwave"><canvas id="wave"></canvas></div>
      <div class="dside"><div class="cues">${[0, 1, 2, 3, 4, 5, 6, 7].map(n => { const c = (t.cues || []).find(x => x.n === n); return `<button class="cue${c ? ' set' : ''}${c && c.len ? ' lp' : ''}${c && S.loop === c ? ' active' : ''}" data-cue="${n}" style="--c:${c ? cueColor(c) : CUE_COLORS[n]}" title="${c ? esc((c.name ? c.name + ' · ' : '') + time2(c.t) + (c.len ? ' · Loop' : '')) + ' · Rechtsklick löscht' : 'Cue an aktueller Position setzen'}">${n + 1}</button>`; }).join('')}</div>
        <div class="row"><button class="btn sm${S.panel ? ' active' : ''}" id="bEdit">Cues &amp; Raster</button><button class="btn sm" id="bMatch" ${t.key ? '' : 'disabled'} title="Passende Titel nach Tonart und Tempo">Passend</button><button class="btn sm${S.zoom ? ' active' : ''}" id="bZoom" title="Ausschnitt um die aktuelle Position">Zoom</button><input type="range" id="vol" min="0" max="1" step="0.01" value="${S.settings.volume}" aria-label="Lautstärke"></div></div>
      ${S.panel ? panelHtml(t) : ''}`;
    fillCovers(el);
    drawWave();
  }

  function drawWave() {
    const cv = $('#wave'), t = S.cur;
    if (!cv || !t) return;
    const w = cv.clientWidth, h = cv.clientHeight, dpr = devicePixelRatio || 1;
    if (!w) return;
    if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const ink = S.settings.theme === 'light' ? '17,19,21' : '244,240,232';
    const dur = t.duration || audio.duration || 0, pos = dur ? audio.currentTime / dur : 0, mid = h / 2;
    const wave = S.curWave;
    const mark = (c, x) => {
      g.fillStyle = cueColor(c); g.fillRect(x, 0, 2, h);
      if (c.n < 0) { g.beginPath(); g.moveTo(x - 4, 0); g.lineTo(x + 6, 0); g.lineTo(x + 1, 8); g.fill(); return; }
      g.fillRect(x, 0, 13, 13);
      g.fillStyle = '#111315'; g.font = '600 10px "Fira Sans", sans-serif'; g.textAlign = 'center'; g.fillText(c.n + 1, x + 7, 10);
    };
    if (S.zoom && dur) { // Ausschnitt von 8 Sekunden um die aktuelle Position, mit jedem Beat
      const span = 8, ct = audio.currentTime, a = ct - span / 2, hi = S.curHi || wave, X = tm => (tm - a) / span * w;
      for (const c of t.cues || []) if (c.len) { g.fillStyle = cueColor(c); g.globalAlpha = S.loop === c ? 0.34 : 0.16; g.fillRect(X(c.t), 0, c.len / span * w, h); g.globalAlpha = 1; }
      if (hi) for (let x = 0; x < w; x++) {
        const tm = a + x / w * span;
        if (tm < 0 || tm > dur) continue;
        const v = hi[Math.min(hi.length - 1, Math.floor(tm / dur * hi.length))] / 255;
        g.fillStyle = tm < ct ? '#B79A6B' : `rgba(${ink},.5)`;
        g.fillRect(x, mid - v * (mid - 3), 1, Math.max(1, v * (h - 6)));
      }
      if (t.bpm) eachBeat(t, Math.max(0, a), Math.min(dur, a + span), (tm, k) => {
        const bar = ((k % 4) + 4) % 4 === 0;
        g.fillStyle = `rgba(${ink},${bar ? 0.6 : 0.25})`;
        g.fillRect(Math.round(X(tm)), bar ? 0 : h * 0.22, 1, bar ? h : h * 0.56);
      });
      for (const c of t.cues || []) { const x = Math.round(X(c.t)); if (x > -16 && x < w) mark(c, x); }
      g.fillStyle = `rgb(${ink})`; g.fillRect(Math.round(w / 2), 0, 1.5, h);
      return;
    }
    if (dur) for (const c of t.cues || []) if (c.len) { // Loop-Bereiche
      g.fillStyle = cueColor(c); g.globalAlpha = S.loop === c ? 0.34 : 0.16;
      g.fillRect(c.t / dur * w, 0, Math.max(2, c.len / dur * w), h);
      g.globalAlpha = 1;
    }
    if (wave) {
      for (let x = 0; x < w; x++) {
        const v = wave[Math.min(wave.length - 1, Math.floor(x / w * wave.length))] / 255;
        g.fillStyle = x / w < pos ? '#B79A6B' : `rgba(${ink},.42)`;
        g.fillRect(x, mid - v * (mid - 3), 1, Math.max(1, v * (h - 6)));
      }
    } else {
      g.fillStyle = `rgba(${ink},.18)`; g.fillRect(0, mid, w, 1);
      g.fillStyle = '#B79A6B'; g.fillRect(0, mid, w * pos, 1);
      g.fillStyle = `rgba(${ink},.7)`; g.font = '12px "Fira Sans", sans-serif'; g.textAlign = 'center';
      g.fillText(tr('Noch keine Wellenform – Titel analysieren'), w / 2, mid - 10);
    }
    if (dur && t.bpm) { // Taktstriche alle 16 Beats, Tempowechsel hervorgehoben
      g.fillStyle = `rgba(${ink},.16)`;
      eachBeat(t, 0, dur, (tm, k) => { if (k % 16 === 0) g.fillRect(Math.round(tm / dur * w), 0, 1, h); });
      g.fillStyle = '#B79A6B';
      for (const x of t.tempos || []) g.fillRect(Math.round(x.t / dur * w), h - 6, 2, 6);
    }
    if (dur) for (const c of t.cues || []) mark(c, Math.round(c.t / dur * w));
    g.fillStyle = `rgb(${ink})`; g.fillRect(Math.round(pos * w), 0, 1.5, h);
  }

  async function load(t, autoplay = true) {
    let f = null;
    try { f = await fileOf(t, true); } catch { f = null; }
    if (!f) {
      if (connected(t) && !t.missing) { t.missing = true; await DB.put('tracks', t); dirty(); }
      return toast('Datei nicht gefunden. Den Musikordner über „Musik hinzufügen“ erneut wählen, um sie zu verbinden.', true);
    }
    if (t.missing) { delete t.missing; await DB.put('tracks', t); }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = f.url ? null : URL.createObjectURL(f);
    S.cur = t; S.curCounted = false; S.loop = null; lastBeat = -1;
    S.curWave = await DB.get('waves', t.id) || null;
    S.curHi = await DB.get('waves', t.id + '~hi') || null;
    audio.src = f.url || audioUrl;
    applyVol();
    renderDeck(); drawRows();
    if (autoplay) audio.play().catch(() => {});
  }
  function unload() { audio.pause(); audio.removeAttribute('src'); S.cur = null; S.curWave = null; S.curHi = null; S.loop = null; renderDeck(); drawRows(); }
  const toggle = () => { if (S.cur) audio.paused ? audio.play().catch(() => {}) : audio.pause(); };

  function cuePos() {
    const t = S.cur;
    let pos = audio.currentTime;
    if (S.settings.quantize && t.bpm) pos = snapBeat(t, pos);
    return Math.round(pos * 1000) / 1000;
  }
  async function saveCur() { await DB.put('tracks', S.cur); renderDeck(); }
  async function cue(n, remove) {
    const t = S.cur;
    if (!t) return;
    t.cues = t.cues || [];
    const c = t.cues.find(x => x.n === n);
    if (remove) { if (!c) return; snap('Cue löschen', [t]); t.cues = t.cues.filter(x => x !== c); if (S.loop === c) S.loop = null; }
    else if (c) { audio.currentTime = c.t; S.loop = c.len ? (S.loop === c ? null : c) : null; return renderDeck(); }
    else { snap('Cue setzen', [t]); t.cues.push({ n, t: cuePos(), name: '' }); t.cues.sort((a, b) => a.t - b.t); }
    await saveCur();
  }
  /* Bearbeiten einer Cue-Zeile im Bereich „Cues & Raster“ */
  async function cueEdit(i, what, value) {
    const t = S.cur, c = t && (t.cues || [])[i];
    if (!c) return;
    if (what === 'go') { audio.currentTime = c.t; S.loop = c.len ? c : null; return drawWave(); }
    snap('Cue bearbeiten', [t]);
    if (what === 'del') { t.cues.splice(i, 1); if (S.loop === c) S.loop = null; }
    else if (what === 'name') c.name = value.trim();
    else if (what === 'len') { const b = +value, s = sectionAt(t, c.t); if (b && s) c.len = Math.round(b * 60 / s.bpm * 1000) / 1000; else { delete c.len; if (S.loop === c) S.loop = null; } }
    else if (what === 'color') { const k = CUE_COLORS.indexOf(cueColor(c)); c.color = CUE_COLORS[(k + 1) % CUE_COLORS.length]; }
    await saveCur();
  }
  async function memoryCue() {
    const t = S.cur;
    if (!t) return;
    snap('Memory-Cue', [t]);
    t.cues = t.cues || [];
    t.cues.push({ n: -1, t: cuePos(), name: '' });
    t.cues.sort((a, b) => a.t - b.t);
    await saveCur();
  }

  async function grid(op, value) {
    const t = S.cur;
    if (!t) return;
    if (op === 'click') { S.click = !S.click; lastBeat = -1; return renderDeck(); }
    if (op === 'tempo' || op === 'tbpm' || op === 'tdel') { // Tempowechsel anlegen, ändern, entfernen
      if (!t.bpm) return toast('Zuerst BPM eintragen oder den Titel analysieren.', true);
      let v = 0, at = 0;
      if (op === 'tempo') {
        at = Math.round(snapBeat(t, audio.currentTime) * 1000) / 1000;
        if (at <= (t.gridStart || 0) + 0.05) return toast('Der Tempowechsel muss nach dem ersten Beat liegen.', true);
        const f = await modal({ title: `Tempowechsel ab ${time2(at)}`, ok: 'Anlegen', body: `<label class="field"><span class="lbl">Neues Tempo (BPM)</span><input class="in" name="bpm" type="number" step="any" required value="${sectionAt(t, at).bpm}"></label>` });
        if (!f) return;
        v = f.bpm.value;
      } else if (op === 'tbpm') v = value.v;
      if (op !== 'tdel') { v = Math.round((parseFloat(String(v).replace(',', '.')) || 0) * 100) / 100; if (v < 30 || v > 300) return toast('BPM zwischen 30 und 300 eingeben.', true); }
      snap('Tempowechsel', [t]);
      t.tempos = t.tempos || [];
      if (op === 'tempo') t.tempos = [...t.tempos.filter(x => Math.abs(x.t - at) > 0.05), { t: at, bpm: v }].sort((a, b) => a.t - b.t);
      else if (op === 'tbpm') t.tempos[value.i].bpm = v;
      else t.tempos.splice(value.i, 1);
      if (!t.tempos.length) delete t.tempos;
      return saveCur();
    }
    if (op === 'bpm') {
      const v = Math.round((parseFloat(String(value).replace(',', '.')) || 0) * 100) / 100;
      if (v < 30 || v > 300) return toast('BPM zwischen 30 und 300 eingeben.', true);
      snap('Beatraster', [t]); t.bpm = v;
    } else {
      if (!t.bpm) return toast('Zuerst BPM eintragen oder den Titel analysieren.', true);
      snap('Beatraster', [t]);
      const k = op === 'half' ? 0.5 : op === 'double' ? 2 : 0;
      if (k) { t.bpm = Math.round(t.bpm * k * 100) / 100; for (const x of t.tempos || []) x.bpm = Math.round(x.bpm * k * 100) / 100; }
      else if (op === 'here') t.gridStart = audio.currentTime;
      else { t.gridStart = (t.gridStart || 0) + (+op) / 1000; for (const x of t.tempos || []) x.t = Math.round((x.t + (+op) / 1000) * 1000) / 1000; }
    }
    const b = 60 / t.bpm;
    t.gridStart = Math.round(((((t.gridStart || 0) % b) + b) % b) * 1000) / 1000;
    if (t.tempos) { t.tempos = t.tempos.filter(x => x.t > t.gridStart + 0.05); if (!t.tempos.length) delete t.tempos; }
    await saveCur();
    drawRows();
  }

  /* Cue-Vorschläge: Start sowie die stärksten Pegelsprünge an Phrasengrenzen (32 Beats) */
  async function suggestCues() {
    const t = S.cur, w = S.curWave;
    if (!t || !w || !t.bpm || !t.duration) return toast('Dafür muss der Titel analysiert sein.', true);
    const beat = 60 / t.bpm, dur = t.duration;
    const phrase = (dur / beat >= 128 ? 32 : 16) * beat;
    const lvl = (a, b) => { const i = Math.max(0, Math.floor(a / dur * w.length)), j = Math.min(w.length, Math.ceil(b / dur * w.length)); let sum = 0; for (let k = i; k < j; k++) sum += w[k]; return j > i ? sum / (j - i) : 0; };
    const cand = [];
    for (let p = (t.gridStart || 0) + phrase; p < dur - phrase / 2; p += phrase) cand.push({ t: p, d: lvl(p, p + phrase) - lvl(p - phrase, p) });
    const ups = cand.filter(c => c.d > 10).sort((a, b) => b.d - a.d).slice(0, 3).map(c => ({ t: c.t, name: 'Einsatz' }));
    const down = cand.filter(c => c.d < -10).sort((a, b) => a.d - b.d).slice(0, 1).map(c => ({ t: c.t, name: 'Break' }));
    const picks = [{ t: t.gridStart || 0, name: 'Start' }, ...ups, ...down].sort((a, b) => a.t - b.t);
    snap('Cues vorschlagen', [t]);
    t.cues = t.cues || [];
    let added = 0;
    for (const p of picks) {
      if (t.cues.some(c => Math.abs(c.t - p.t) < beat)) continue;
      const n = [0, 1, 2, 3, 4, 5, 6, 7].find(k => !t.cues.some(c => c.n === k));
      if (n === undefined) break;
      t.cues.push({ n, t: Math.round(p.t * 1000) / 1000, name: p.name });
      added++;
    }
    t.cues.sort((a, b) => a.t - b.t);
    await saveCur();
    toast(added ? `${added} Cue${added === 1 ? '' : 's'} vorgeschlagen – bitte prüfen.` : 'Keine weiteren sinnvollen Stellen gefunden.');
  }

  /* Laufende Wiedergabe: Loop halten, Klick auf den Beat, Wellenform nachführen */
  let lastBeat = -1, actx = null;
  function blip(accent) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain(), now = actx.currentTime;
      o.frequency.value = accent ? 1600 : 1100;
      g.gain.setValueAtTime(0.25, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      o.connect(g).connect(actx.destination);
      o.start(now); o.stop(now + 0.06);
    } catch { /* ohne Tonausgabe weiter */ }
  }
  function holdLoop() { if (S.loop && audio.currentTime >= S.loop.t + S.loop.len) audio.currentTime = S.loop.t; }
  function tick() {
    const t = S.cur;
    if (t && !audio.paused) {
      holdLoop();
      if (S.click && t.bpm) {
        const s = sectionAt(t, audio.currentTime), k = Math.floor((audio.currentTime - s.t) / (60 / s.bpm)), b = Math.round(s.t * 1000) * 100000 + k;
        if (b !== lastBeat) { if (lastBeat !== -1 && b === lastBeat + 1) blip(((k % 4) + 4) % 4 === 0); lastBeat = b; }
      }
      drawWave();
    }
    requestAnimationFrame(tick);
  }

  /* ---------- Import / Export ---------- */
  /* Importierte Titel mit der Bibliothek abgleichen: gleicher Pfad, gleiche Datei (Name + Größe) oder gleicher Dateiname am Pfadende */
  async function mergeData(data) {
    const np = p => String(p || '').replace(/\\/g, '/').toLowerCase(), base = p => np(p).split('/').pop();
    const byPath = new Map(), bySize = new Map(), byFile = new Map();
    const index = t => { byPath.set(np(t.path), t); if (t.size) bySize.set(base(t.path) + '|' + t.size, t); const k = base(t.path); (byFile.get(k) || byFile.set(k, []).get(k)).push(t); };
    for (const t of S.tracks.values()) index(t);
    const byName = new Map(); // für Listen ohne Dateipfad (rekordbox-Textexport): Zuordnung über Artist + Titel
    for (const t of S.tracks.values()) { const k = norm(t.artist) + '|' + norm(t.title); if (!byName.has(k)) byName.set(k, t); }
    const find = d => {
      if (!d.path) return byName.get(norm(d.artist) + '|' + norm(d.title)) || null;
      const p = np(d.path), name = base(d.path);
      let t = byPath.get(p) || (d.size ? bySize.get(name + '|' + d.size) : null);
      if (t) return t;
      const c = byFile.get(name) || [];
      return c.find(x => { const q = np(x.path); return p.endsWith('/' + q) || q.endsWith('/' + p); }) || (c.length === 1 && (!d.size || !c[0].size) ? c[0] : null);
    };
    const changed = [], ids = [];
    let added = 0, merged = 0, skipped = 0;
    for (const d of data.tracks) {
      delete d.volume;
      let t = find(d);
      if (!t && !d.path) { skipped++; ids.push(null); continue; } // ohne Pfad und ohne Treffer: nicht als leeren Eintrag anlegen
      if (t) {
        for (const k of ['title', 'artist', 'album', 'genre', 'comment', 'key']) if (!t[k] && d[k]) t[k] = d[k];
        for (const k of ['bpm', 'year', 'rating', 'duration', 'gridStart', 'playCount']) if (!t[k] && d[k]) t[k] = d[k];
        if (!(t.cues || []).length && (d.cues || []).length) t.cues = d.cues;
        if (!/^(\/|[A-Za-z]:)/.test(t.path) && /^(\/|[A-Za-z]:)/.test(d.path)) { t.path = d.path; byPath.set(np(t.path), t); } // vollständigen Pfad übernehmen
        merged++;
      } else {
        t = { id: uid(), title: '', artist: '', album: '', genre: '', year: 0, comment: '', bpm: 0, key: '', duration: 0, rating: 0, color: '', tags: [], cues: [], gridStart: 0, size: 0, added: Date.now(), playCount: 0, analyzed: false, ...d };
        S.tracks.set(t.id, t); index(t);
        added++;
      }
      if (data.played) t.lastPlayed = Math.max(t.lastPlayed || 0, data.played);
      changed.push(t); ids.push(t.id);
    }
    await saveTracks(changed);
    for (const l of data.lists) {
      let nl = S.lists.find(x => x.type === 'list' && x.name === l.name);
      const mine = l.refs.map(i => ids[i]).filter(Boolean);
      if (nl) nl.trackIds = [...new Set([...nl.trackIds, ...mine])];
      else { nl = { id: uid(), type: 'list', name: l.name, trackIds: [...new Set(mine)] }; S.lists.push(nl); }
      await saveList(nl);
    }
    return { added, merged, skipped, lists: data.lists.length };
  }

  async function importData(files) {
    files = [...files];
    try {
      const json = files.find(f => /\.json$/i.test(f.name));
      if (json) return await restore(JSON.parse(await json.text()));
      const sets = [];
      for (const f of files) sets.push(await Formats.parseFile(f));
      sets.sort((a, b) => (b.full ? 1 : 0) - (a.full ? 1 : 0)); // Datenbanken vor Playlists, damit deren Angaben gewinnen
      let added = 0, merged = 0, lists = 0, skipped = 0;
      for (const data of sets) { const r = await mergeData(data); added += r.added; merged += r.merged; lists += r.lists; skipped += r.skipped; }
      dirty();
      toast(`${[...new Set(sets.map(d => d.kind))].join(', ')}: ${nf(added)} neue Titel, ${nf(merged)} abgeglichen, ${nf(lists)} Playlists.`);
      if (skipped) toast(`${nf(skipped)} Einträge ohne Dateipfad ließen sich keinem Titel der Bibliothek zuordnen.`, true);
      if (added) toast('Zum Abspielen und Analysieren den Musikordner über „Musik hinzufügen“ wählen – die Dateien werden automatisch zugeordnet.');
    } catch (e) { dirty(); toast(e.message || 'Import fehlgeschlagen.', true); }
  }

  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode(...u8.subarray(i, i + 8192)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function backup() {
    const waves = {};
    for (const [id, w] of await DB.entries('waves')) if (!String(id).includes('~')) waves[id] = b64(w);
    download(`one-library-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'one-library', version: 1, created: new Date().toISOString(), settings: S.settings, tracks: [...S.tracks.values()], lists: S.lists, wishlist: S.wish, waves }), 'application/json');
  }
  async function restore(data, auto) {
    if (!data || data.app !== 'one-library' || !Array.isArray(data.tracks)) throw new Error('Das ist kein ONE-Library-Backup.');
    if (!(await confirmBox('Backup einspielen', `Die aktuelle Bibliothek (${nf(S.tracks.size)} Titel) wird durch das Backup (${nf(data.tracks.length)} Titel) ersetzt.`, 'Ersetzen'))) return;
    for (const s of auto ? ['tracks', 'lists'] : ['tracks', 'lists', 'waves']) await DB.clear(s);
    await saveTracks(data.tracks);
    await DB.putMany('lists', data.lists || []);
    for (const [id, w] of Object.entries(data.waves || {})) await DB.put('waves', unb64(w), id);
    S.settings = { ...S.settings, ...(data.settings || {}) };
    await saveSettings();
    applyTheme(); undoStack.length = 0;
    S.tracks = new Map(data.tracks.map(t => [t.id, t])); S.lists = data.lists || [];
    if (Array.isArray(data.wishlist)) { S.wish = data.wishlist; await DB.put('meta', S.wish, 'wishlist'); }
    unload();
    setView({ type: 'all' });
    toast('Backup eingespielt.');
  }

  /* Automatische Sicherung: höchstens einmal am Tag, die letzten 7 bleiben im Browser gespeichert */
  async function autoBackup() {
    if (!S.tracks.size) return;
    const keys = (await DB.entries('backups')).map(([k]) => +k).sort((a, b) => b - a);
    if (keys.length && Date.now() - keys[0] < 20 * 3600e3) return;
    await DB.put('backups', { app: 'one-library', version: 1, created: new Date().toISOString(), settings: S.settings, tracks: [...S.tracks.values()], lists: S.lists }, Date.now());
    await DB.delMany('backups', keys.slice(6));
  }

  async function exportDialog() {
    const f = await modal({ title: 'Exportieren', ok: 'Exportieren',
      body: `<label class="field"><span class="lbl">Format</span><select class="in" name="fmt">
          <option value="rb">Rekordbox XML – ganze Bibliothek mit Playlists</option><option value="nml">Traktor NML – ganze Bibliothek mit Playlists</option>
          <option value="serato">Serato – Playlists als Crates (ZIP)</option><option value="vdj">VirtualDJ – database.xml und Playlists (ZIP)</option>
          <option value="m3u">M3U8-Playlist – aktuelle Ansicht</option><option value="csv">CSV-Tabelle – aktuelle Ansicht</option><option value="json">Backup (JSON) – alles</option></select></label>
        <label class="field"><span class="lbl">Musikordner auf diesem Rechner</span><input class="in" name="base" value="${esc(S.settings.basePath)}" placeholder="/Users/name/Music/"><small>Der Browser kennt keine vollständigen Dateipfade. Dieser Pfad wird den Ordnernamen aus der Bibliothek vorangestellt, damit die DJ-Software die Dateien findet.</small></label>` });
    if (!f) return;
    S.settings.basePath = f.base.value.trim();
    await saveSettings();
    const all = [...S.tracks.values()], lists = S.lists.map(l => l.type === 'smart' ? { ...l, trackIds: smartTracks(l).map(t => t.id) } : l);
    const stamp = new Date().toISOString().slice(0, 10);
    switch (f.fmt.value) {
      case 'rb': return download(`one-library-rekordbox-${stamp}.xml`, Formats.rekordboxExport(all, lists, absPath), 'application/xml');
      case 'nml': return download(`one-library-traktor-${stamp}.nml`, Formats.traktorExport(all, lists, absPath), 'application/xml');
      case 'serato': {
        if (!lists.length) return toast('Für Serato werden Playlists exportiert – bitte zuerst eine Playlist anlegen.', true);
        return download(`one-library-serato-${stamp}.zip`, Formats.zip(Formats.seratoExport(lists, S.tracks, absPath)), 'application/zip');
      }
      case 'vdj': {
        const used = new Set(), files = [{ name: 'database.xml', data: Formats.vdjExport(all, absPath) }];
        for (const l of lists) {
          let base = Formats.safeName(l.name), name = base;
          for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base} ${i}`;
          used.add(name.toLowerCase());
          files.push({ name: `Playlists/${name}.m3u`, data: Formats.m3uExport(l.trackIds.map(id => S.tracks.get(id)).filter(Boolean), absPath) });
        }
        return download(`one-library-virtualdj-${stamp}.zip`, Formats.zip(files), 'application/zip');
      }
      case 'm3u': return download(`one-library-${stamp}.m3u8`, Formats.m3uExport(S.rows, absPath), 'audio/x-mpegurl');
      case 'csv': return download(`one-library-${stamp}.csv`, Formats.csvExport(S.rows, S.settings.keyMode), 'text/csv');
      default: return backup();
    }
  }

  async function settingsDialog() {
    const backups = (await DB.entries('backups')).sort((a, b) => b[0] - a[0]);
    let pick = null;
    const f = await modal({ title: 'Einstellungen',
      body: `${typeof I18n === 'undefined' ? '' : `<label class="field"><span class="lbl">Sprache / Language</span><select class="in" name="lang">${I18n.langs().map(([c, n]) => `<option class="raw" value="${c}"${I18n.lang === c ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`}
        <label class="field"><span class="lbl">Darstellung</span><select class="in" name="theme"><option value="dark">Dunkel</option><option value="light"${S.settings.theme === 'light' ? ' selected' : ''}>Hell</option></select></label>
        <label class="field"><span class="lbl">Tonart-Anzeige</span><select class="in" name="keyMode"><option value="camelot">Quintenzirkel-Nummern (8A, 8B …)</option><option value="musical"${S.settings.keyMode === 'musical' ? ' selected' : ''}>Musikalisch (Am, C …)</option></select></label>
        <label class="tog"><input type="checkbox" name="quantize"${S.settings.quantize ? ' checked' : ''}><span class="sw"></span><span><span class="tl">Cues am Beatraster einrasten</span><small>Neue Cue-Punkte springen auf den nächsten Beat, sobald der Titel analysiert ist.</small></span></label>
        <label class="tog"><input type="checkbox" name="normalize"${S.settings.normalize ? ' checked' : ''}><span class="sw"></span><span><span class="tl">Lautstärke beim Vorhören angleichen</span><small>Laute Titel werden im Deck leiser wiedergegeben. Die Dateien bleiben unverändert.</small></span></label>
        <label class="field"><span class="lbl">Musikordner auf diesem Rechner (für Exporte)</span><input class="in" name="base" value="${esc(S.settings.basePath)}" placeholder="/Users/name/Music/"></label>
        <div class="field"><span class="lbl">Bedienung</span><div><button type="button" class="btn sm" id="keysGo">Tastenkürzel anpassen …</button></div></div>
        <div class="field"><span class="lbl">Verbundene Ordner</span>${S.roots.map(r => `<div class="mut" data-raw>${esc(r.name)}</div>`).join('') || '<div class="mut">Noch keine.</div>'}</div>
        <div class="field"><span class="lbl">Automatische Sicherungen (täglich, die letzten 7)</span>${backups.length ? `<div class="row"><select class="in" id="bkSel">${backups.map(([k, b]) => `<option value="${k}">${new Date(+k).toLocaleString(LOC, { dateStyle: 'medium', timeStyle: 'short' })} – ${nf(b.tracks.length)} Titel</option>`).join('')}</select><button type="button" class="btn" id="bkGo">Wiederherstellen</button></div>` : '<div class="mut">Noch keine – die erste entsteht beim nächsten Start mit Titeln in der Bibliothek.</div>'}</div>`,
      onOpen: ov => ov.addEventListener('click', e => { if (e.target.closest('#keysGo')) { pick = 'keys'; return $('[data-x]', ov).click(); } if (e.target.closest('#bkGo')) { pick = backups.find(([k]) => String(k) === $('#bkSel', ov).value); $('[data-x]', ov).click(); } }) });
    if (pick === 'keys') return keysDialog();
    if (pick) return restore(pick[1], true).catch(e => toast(e.message, true));
    if (!f) return;
    S.settings.theme = f.theme.value; S.settings.keyMode = f.keyMode.value; S.settings.quantize = f.quantize.checked; S.settings.normalize = f.normalize.checked; S.settings.basePath = f.base.value.trim();
    await saveSettings();
    if (f.lang && f.lang.value !== I18n.lang) return I18n.set(f.lang.value); // lädt die Seite in der neuen Sprache
    applyTheme(); applyVol();
    refresh(); renderDeck();
  }

  /* ---------- Spotify: Playlists abgleichen, Einkaufsliste ----------
     Gelesen werden nur Titelangaben der eigenen Playlists (keine Musik). Die Anmeldung läuft über eine eigene Entwickler-App
     des Nutzers bei Spotify (Client-ID, Verfahren „Authorization Code mit PKCE“, kein Geheimnis nötig). */
  const SP = { auth: 'https://accounts.spotify.com/authorize', token: 'https://accounts.spotify.com/api/token', api: 'https://api.spotify.com/v1' };
  const spRedirect = () => D ? 'http://127.0.0.1:8779/callback' : location.origin + location.pathname;
  const saveSpotify = () => DB.put('meta', S.spotify, 'spotify');
  const saveWish = () => DB.put('meta', S.wish, 'wishlist');
  let wishStale = true;

  async function spToken(params) {
    const r = await fetch(SP.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.access_token) throw new Error('Die Anmeldung bei Spotify ist fehlgeschlagen' + (j && j.error_description ? ': ' + j.error_description : '.'));
    S.spotify = { ...S.spotify, access: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000, refresh: j.refresh_token || (S.spotify && S.spotify.refresh) };
    await saveSpotify();
  }
  async function spGet(path) {
    const s = S.spotify;
    if (!s || !s.refresh) throw new Error('Nicht mit Spotify verbunden.');
    if (!s.access || s.exp < Date.now() + 60000) await spToken({ grant_type: 'refresh_token', refresh_token: s.refresh, client_id: s.clientId });
    for (let k = 0; k < 3; k++) {
      const r = await fetch(path.startsWith('http') ? path : SP.api + path, { headers: { Authorization: 'Bearer ' + S.spotify.access } });
      if (r.status === 429) { await new Promise(res => setTimeout(res, (+r.headers.get('Retry-After') || 2) * 1000)); continue; }
      if (!r.ok) { const e = new Error(`Spotify meldet einen Fehler (${r.status}).`); e.status = r.status; throw e; }
      return r.json();
    }
    throw new Error('Spotify ist gerade ausgelastet. Bitte später erneut versuchen.');
  }
  async function spConnect(clientId) {
    const rnd = crypto.getRandomValues(new Uint8Array(48)), b64u = u => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const verifier = b64u(rnd), state = uid();
    const challenge = b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    const url = SP.auth + '?' + new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: spRedirect(), code_challenge_method: 'S256', code_challenge: challenge, scope: 'playlist-read-private playlist-read-collaborative', state });
    if (!D) { sessionStorage.setItem('one-spotify', JSON.stringify({ clientId, verifier, state })); location.href = url; return false; }
    status('Warte auf die Anmeldung bei Spotify im Browser …');
    const q = await D.spotifyAuth(url, 8779).finally(() => status());
    if (!q || q.state !== state || !q.code) throw new Error('Die Anmeldung bei Spotify wurde abgebrochen.');
    S.spotify = { clientId };
    await spToken({ grant_type: 'authorization_code', code: q.code, redirect_uri: spRedirect(), client_id: clientId, code_verifier: verifier });
    return true;
  }
  /* Browser: Rückkehr von der Spotify-Anmeldung (Adresse enthält ?code=…) */
  async function spotifyReturn() {
    if (D) return;
    const q = new URLSearchParams(location.search), raw = sessionStorage.getItem('one-spotify');
    if (!raw || (!q.get('code') && !q.get('error'))) return;
    sessionStorage.removeItem('one-spotify');
    history.replaceState(null, '', location.pathname);
    const p = JSON.parse(raw);
    try {
      if (q.get('error') || q.get('state') !== p.state) throw new Error('Die Anmeldung bei Spotify wurde abgebrochen.');
      S.spotify = { clientId: p.clientId };
      await spToken({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: spRedirect(), client_id: p.clientId, code_verifier: p.verifier });
      renderSide();
      spotifyDialog();
    } catch (e) { S.spotify = null; toast(e.message, true); }
  }

  /* Zuordnung Spotify-Titel → Bibliothek: gleicher Kerntitel und Artist; bei abweichender Fassung (Remix, Edit, Länge) nur als Hinweis */
  const coreTitle = s => norm(String(s || '').replace(/\s+[-–]\s+.*$/, '').replace(/[([][^)\]]*[)\]]/g, ''));
  const fullTitle = s => norm(String(s || '').replace(/\b(original mix|original version|remaster(ed)?( \d{4})?|\d{4} remaster(ed)?)\b/gi, ''));
  function wishMatcher() {
    const idx = new Map();
    for (const t of S.tracks.values()) { const k = coreTitle(t.title); if (k) (idx.get(k) || idx.set(k, []).get(k)).push(t); }
    return w => {
      const artists = (w.artists || [w.artist]).map(norm).filter(Boolean);
      const cands = (idx.get(coreTitle(w.title)) || []).filter(t => { const a = norm(t.artist); return !a || artists.some(x => a.includes(x) || x.includes(a)); });
      if (!cands.length) return { track: null };
      const near = t => !w.duration || !t.duration || Math.abs(t.duration - w.duration) <= 6;
      const hit = cands.find(t => fullTitle(t.title) === fullTitle(w.title) && near(t)) || cands.find(t => fullTitle(t.title) === fullTitle(w.title)) || cands.find(near);
      return hit ? { track: hit } : { track: null, other: cands[0] };
    };
  }

  async function spotifySync(picked) {
    if (S.busy) return toast('Bitte warten, es läuft noch ein Vorgang.', true);
    const job = S.busy = { stop: false };
    let have = 0, miss = 0;
    try {
      snap('Spotify-Abgleich');
      const match = wishMatcher(), wish = new Map(S.wish.map(w => [w.id, w]));
      for (let i = 0; i < picked.length && !job.stop; i++) {
        const pl = picked[i];
        status(`Spotify ${i + 1} / ${picked.length}: ${pl.name}`, i / picked.length);
        const items = [];
        let url = `/playlists/${pl.id}/tracks?limit=100`;
        while (url && !job.stop) {
          let page;
          try { page = await spGet(url); }
          catch (e) { if (e.status === 404 && url.includes('/tracks?')) { url = url.replace('/tracks?', '/items?'); continue; } throw e; } // neuere Schnittstelle
          for (const it of page.items || []) { const tr = it.track || it.item; if (tr && tr.name && tr.type !== 'episode') items.push(tr); }
          url = page.next;
        }
        const ids = [], name = 'Spotify / ' + pl.name;
        for (const tr of items) {
          const w = { id: tr.id || tr.uri || tr.name, title: tr.name, artists: (tr.artists || []).map(a => a.name), artist: (tr.artists || []).map(a => a.name).join(', '), album: (tr.album && tr.album.name) || '',
            year: +(/^\d{4}/.exec((tr.album && tr.album.release_date) || '') || [0])[0], duration: Math.round((tr.duration_ms || 0) / 1000), isrc: (tr.external_ids && tr.external_ids.isrc) || '', url: (tr.external_urls && tr.external_urls.spotify) || '' };
          const m = match(w);
          if (m.track) { ids.push(m.track.id); wish.delete(w.id); have++; continue; }
          const old = wish.get(w.id);
          wish.set(w.id, { ...w, other: m.other ? m.other.title : '', lists: [...new Set([...((old && old.lists) || []), pl.name])], added: (old && old.added) || Date.now() });
          miss++;
        }
        let l = S.lists.find(x => x.type === 'list' && x.name === name);
        if (!l) { l = { id: uid(), type: 'list', name, trackIds: [] }; S.lists.push(l); }
        l.trackIds = [...new Set(ids)];
        await saveList(l);
      }
      S.wish = [...wish.values()];
      await saveWish();
    } catch (e) { toast(e.message || 'Der Abgleich mit Spotify ist fehlgeschlagen.', true); S.busy = null; status(); dirty(); return; }
    S.busy = null;
    status();
    toast(`Spotify-Abgleich: ${nf(have)} Titel vorhanden, ${nf(miss)} ${miss === 1 ? 'fehlt und steht' : 'fehlen und stehen'} auf der Einkaufsliste.`);
    setView({ type: 'wishlist' });
  }

  async function spotifyDialog() {
    if (!D && location.hostname !== '127.0.0.1') {
      const url = 'http://127.0.0.1:' + (location.port || '8778') + location.pathname;
      return modal({ title: 'Spotify-Playlists abgleichen', ok: '', body: `<p>Spotify erlaubt die Anmeldung nur über die Adresse 127.0.0.1. Bitte öffne die App dafür unter:</p><p><a href="${esc(url)}" data-raw>${esc(url)}</a></p><p class="mut">Der Browser führt die Bibliothek je Adresse getrennt. Sichere sie vorher über „Import / Export → Backup jetzt speichern“ und spiele das Backup unter der neuen Adresse ein.</p>` });
    }
    if (!S.spotify || !S.spotify.refresh) {
      const f = await modal({ title: 'Mit Spotify verbinden', ok: 'Verbinden', wide: true,
        body: `<p>Der Abgleich liest die Titelangaben deiner Spotify-Playlists und zeigt, welche Titel du schon hast und welche fehlen. Musik wird dabei nicht geladen.</p>
          <ol class="howto"><li>Auf <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener" data-raw>developer.spotify.com/dashboard</a> anmelden und eine App anlegen (Art: Web API).</li>
          <li>Dort als „Redirect URI“ genau diese Adresse eintragen: <code data-raw>${esc(spRedirect())}</code></li>
          <li>Die „Client ID“ der App hier einfügen.</li></ol>
          <label class="field"><span class="lbl">Client ID</span><input class="in" name="cid" required pattern="[0-9a-fA-F]{32}" placeholder="32 Zeichen" value="${esc((S.spotify && S.spotify.clientId) || '')}" autocomplete="off"></label>
          <p class="mut">Die Verbindung wird nur auf diesem Rechner gespeichert und ist nicht Teil der Backups.</p>` });
      if (!f) return;
      try { if (!(await spConnect(f.cid.value.trim()))) return; } catch (e) { S.spotify = null; return toast(e.message, true); }
      renderSide();
    }
    let lists = [];
    const f = await modal({ title: 'Spotify-Playlists abgleichen', ok: 'Abgleichen', wide: true,
      body: `<p class="mut">Vorhandene Titel kommen in eine Playlist „Spotify / Name“, fehlende auf die Einkaufsliste.</p><div id="spLists" class="splists"><div class="hint">Playlists werden geladen …</div></div>
        <div><button type="button" class="btn sm" id="spOff">Verbindung zu Spotify trennen</button></div>`,
      onOpen: async ov => {
        ov.addEventListener('click', async e => { if (e.target.closest('#spOff')) { S.spotify = null; await DB.del('meta', 'spotify'); $('[data-x]', ov).click(); renderSide(); toast('Verbindung zu Spotify getrennt.'); } });
        try {
          let url = '/me/playlists?limit=50';
          while (url) { const p = await spGet(url); lists.push(...(p.items || []).filter(Boolean)); url = p.next; }
          const box = $('#spLists', ov);
          if (box) box.innerHTML = lists.map((l, i) => `<label class="sprow"><input type="checkbox" name="pl" value="${i}"><span class="grow" data-raw>${esc(l.name)}</span><span class="n">${nf((l.tracks || l.items || {}).total || 0)}</span></label>`).join('') || '<div class="hint">Keine Playlists gefunden.</div>';
        } catch (e) { const box = $('#spLists', ov); if (box) box.innerHTML = `<div class="hint warn">${esc(tr(e.message))}</div>`; }
      } });
    if (!f) return;
    const picked = $$('[name=pl]:checked', f).map(c => lists[+c.value]);
    if (!picked.length) return toast('Keine Playlist ausgewählt.', true);
    spotifySync(picked);
  }

  /* Einkaufsliste: eigene Ansicht statt der Titeltabelle */
  function drawWish() {
    const space = $('#tspace');
    if (!wishStale && $('.wish', space)) return;
    wishStale = false;
    space.style.height = 'auto';
    const q = encodeURIComponent, words = S.q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = S.wish.filter(w => words.every(x => `${w.title} ${w.artist} ${w.album} ${(w.lists || []).join(' ')}`.toLowerCase().includes(x))).sort((a, b) => a.artist.localeCompare(b.artist, 'de') || a.title.localeCompare(b.title, 'de'));
    space.innerHTML = `<div class="wish">
      <div class="wishbar"><span class="grow">Titel aus deinen Spotify-Playlists, die in der Bibliothek fehlen. Die Links öffnen die Suche im jeweiligen Shop.</span>
        <button class="btn sm" data-wish="check">Erneut prüfen</button><button class="btn sm" data-wish="csv">Als CSV speichern</button><button class="btn sm" data-wish="sync">Spotify abgleichen …</button></div>
      ${rows.map(w => { const s = q(`${(w.artists || [w.artist])[0] || ''} ${w.title}`.trim()); return `<div class="wrow">
        <div class="grow"><div class="wt" data-raw>${esc(w.title)}</div><div class="wm" data-raw>${esc([w.artist, w.album, w.year || '', w.duration ? time(w.duration) : ''].filter(Boolean).join(' · '))}</div>
          <div class="wn"><span>In:</span> <span data-raw>${esc((w.lists || []).join(', '))}</span>${w.other ? ` · <span class="warn">Andere Fassung vorhanden:</span> <span data-raw>${esc(w.other)}</span>` : ''}</div></div>
        <div class="wlinks"><a class="raw" href="https://www.beatport.com/search?q=${s}" target="_blank" rel="noopener">Beatport</a><a class="raw" href="https://bandcamp.com/search?q=${s}" target="_blank" rel="noopener">Bandcamp</a><a class="raw" href="https://www.amazon.de/s?k=${s}&i=digital-music" target="_blank" rel="noopener">Amazon</a>${w.url ? `<a class="raw" href="${esc(w.url)}" target="_blank" rel="noopener">Spotify</a>` : ''}</div>
        <button class="btn ghost icon sm" data-wish="del" data-id="${esc(w.id)}" aria-label="Von der Einkaufsliste entfernen">${IC.x}</button></div>`; }).join('') || `<div class="empty">${S.wish.length ? 'Kein Eintrag passt zur Suche.' : 'Die Einkaufsliste ist leer.<br>Über „Import / Export → Spotify-Playlists abgleichen …“ füllt sie sich mit Titeln, die dir noch fehlen.'}</div>`}</div>`;
  }
  async function wishAction(what, id) {
    if (what === 'sync') return spotifyDialog();
    if (what === 'del') S.wish = S.wish.filter(w => w.id !== id);
    else if (what === 'csv') {
      const c = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      return download(`one-library-einkaufsliste-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + [['Titel', 'Artist', 'Album', 'Jahr', 'Dauer (s)', 'ISRC', 'Playlists', 'Spotify'].map(tr).map(c).join(';'),
        ...S.wish.map(w => [w.title, w.artist, w.album, w.year || '', w.duration || '', w.isrc, (w.lists || []).join(', '), w.url].map(c).join(';'))].join('\r\n') + '\r\n', 'text/csv');
    } else if (what === 'check') { // inzwischen hinzugefügte Titel von der Liste nehmen und in ihre Playlists einsortieren
      const match = wishMatcher(), keep = [];
      let found = 0;
      snap('Einkaufsliste prüfen');
      for (const w of S.wish) {
        const m = match(w);
        if (!m.track) { keep.push({ ...w, other: m.other ? m.other.title : '' }); continue; }
        found++;
        for (const n of w.lists || []) {
          let l = S.lists.find(x => x.type === 'list' && x.name === 'Spotify / ' + n);
          if (!l) { l = { id: uid(), type: 'list', name: 'Spotify / ' + n, trackIds: [] }; S.lists.push(l); }
          if (!l.trackIds.includes(m.track.id)) { l.trackIds.push(m.track.id); await saveList(l); }
        }
      }
      S.wish = keep;
      toast(found === 1 ? '1 Titel ist inzwischen in der Bibliothek und wurde einsortiert.' : found ? `${nf(found)} Titel sind inzwischen in der Bibliothek und wurden einsortiert.` : 'Keiner der Titel ist bisher in der Bibliothek.');
    }
    await saveWish();
    refresh();
  }

  /* ---------- Desktop-App: Dateien umbenennen, direkter Abgleich ---------- */
  async function renameFiles() {
    const sel = selected().filter(t => isAbs(t.path));
    if (!sel.length) return toast('Zuerst Titel auswählen.', true);
    const f = await modal({ title: `${nf(sel.length)} Datei${sel.length === 1 ? '' : 'en'} umbenennen`, ok: 'Umbenennen',
      body: `<label class="field"><span class="lbl">Muster</span><input class="in" name="pat" required value="%artist% - %title%"><small>Platzhalter: %artist%, %title%, %album%, %genre%, %year%, %bpm%, %key%. Die Dateiendung bleibt.</small></label>
        <p class="mut">Die Dateien werden auf der Platte umbenannt; das lässt sich hier nicht rückgängig machen. DJ-Software, die die Dateien schon kennt, findet sie erst nach einem erneuten Abgleich wieder.</p>` });
    if (!f) return;
    let done = 0, fail = 0;
    for (const t of sel) {
      const name = f.pat.value.replace(/%(\w+)%/g, (_, k) => k === 'key' ? keyShow(t.key) : k === 'bpm' ? (t.bpm ? Math.round(t.bpm) : '') : (t[k] == null ? '' : t[k])).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\(\s*\)|\[\s*\]/g, '').replace(/\s+/g, ' ').replace(/^[\s\-–]+|[\s\-–]+$/g, '');
      const i = Math.max(t.path.lastIndexOf('/'), t.path.lastIndexOf('\\')), ext = (/\.[^.\\/]+$/.exec(t.path) || [''])[0];
      const to = t.path.slice(0, i + 1) + name + ext;
      if (!name || name === '-' || to === t.path) continue;
      try { await D.rename(t.path, to); t.path = to; await DB.put('tracks', t); done++; } catch { fail++; }
    }
    dirty();
    toast(`${nf(done)} Datei${done === 1 ? '' : 'en'} umbenannt.` + (fail ? ` ${nf(fail)} übersprungen (Zielname existiert bereits oder Datei fehlt).` : ''), fail > 0);
  }

  /* Laufwerk eines Pfads: '' = Systemlaufwerk, sonst /Volumes/Name (Mac) oder X: (Windows). Serato und VirtualDJ führen je Laufwerk eigene Daten. */
  const volumeOf = (p, P) => {
    p = p.replace(/\\/g, '/');
    let m = /^\/Volumes\/[^/]+/.exec(p);
    if (m) return m[0];
    m = /^([A-Za-z]:)\//.exec(p);
    return m && m[1].toLowerCase() !== P.home.slice(0, 2).toLowerCase() ? m[1] : '';
  };
  async function syncRun(app, dir) {
    const P = await D.paths(), all = [...S.tracks.values()].filter(t => isAbs(t.path));
    const lists = S.lists.map(l => l.type === 'smart' ? { ...l, trackIds: smartTracks(l).map(t => t.id) } : l);
    const vols = ['', ...new Set(all.map(t => volumeOf(t.path, P)).filter(Boolean))];
    const sys = P.platform === 'win32' ? P.home.slice(0, 2) : '';
    const parse = (u8, name) => Formats.parseFile(new File([u8], name));
    const sets = [];
    let written = 0, note = '';
    if (dir === 'write' && !all.length) throw new Error('In der Bibliothek sind noch keine Titel mit vollständigem Pfad.');
    if (dir === 'history') { // gespielte Titel der letzten 30 Sitzungen als Playlists „Verlauf / …“
      const stamp = n => { const m = /(\d{4})[y-](\d\d)[m-](\d\d)/.exec(n); return m ? Date.parse(`${m[1]}-${m[2]}-${m[3]}T12:00:00`) : 0; };
      const take = async (folder, re) => {
        const names = (await D.list(folder)).filter(e => !e.dir && re.test(e.name)).map(e => e.name).sort((a, b) => b.localeCompare(a, 'en', { numeric: true })).slice(0, 30);
        for (const n of names) {
          const c = await D.readBin(folder + '/' + n);
          if (!c) continue;
          const d = await parse(c, n);
          if (!d.tracks.length) continue;
          d.played = d.played || stamp(n);
          const label = d.kind === 'Serato-Verlauf' ? d.lists[0].name : n.replace(/\.[^.]+$/, '');
          d.lists = [{ name: 'Verlauf / ' + label, refs: d.tracks.map((_, i) => i) }];
          d.full = false;
          sets.push(d);
        }
      };
      if (app === 'serato') await take(P.music + '/_Serato_/History/Sessions', /\.session$/i);
      else if (app === 'vdj') { for (const c of [P.home + '/Library/Application Support/VirtualDJ', P.home + '/AppData/Local/VirtualDJ', P.documents + '/VirtualDJ']) await take(c + '/History', /\.m3u8?$/i); }
      else if (app === 'traktor') { for (const e of await D.list(P.documents + '/Native Instruments')) if (e.dir && /^Traktor/i.test(e.name)) await take(P.documents + '/Native Instruments/' + e.name + '/History', /\.nml$/i); }
      else { // rekordbox: Verlaufslisten dort als Datei exportieren (M3U8 oder TXT) und in diesen Ordner legen
        const folder = P.documents + '/ONE Library/rekordbox-verlauf';
        await take(folder, /\.(m3u8?|txt)$/i);
        if (!sets.length) throw new Error('Kein rekordbox-Verlauf gefunden. In rekordbox die gewünschte Liste unter „Verlauf“ per Rechtsklick als Datei exportieren (M3U8 oder TXT) und hier ablegen: ' + folder);
      }
      if (!sets.length) throw new Error('Kein Verlauf dieser DJ-Software gefunden.');
      let added = 0, merged = 0;
      for (const d of sets) { const r = await mergeData(d); added += r.added; merged += r.merged; }
      dirty();
      return { text: `${nf(sets.length)} Sitzungen eingelesen: ${nf(merged)} bekannte und ${nf(added)} neue Titel.`, note: '' };
    }
    if (app === 'serato') {
      for (const v of vols) {
        const base = (v || P.music) + '/_Serato_';
        if (dir === 'read') {
          const fix = d => { for (const t of d.tracks) { if (v && !t.path.startsWith(v)) t.path = v + t.path; else if (!v && sys && t.path.startsWith('/')) t.path = sys + t.path; } return d; };
          const db = await D.readBin(base + '/database V2');
          if (db) sets.push(fix(await parse(db, 'database V2')));
          for (const e of await D.list(base + '/Subcrates')) if (/\.crate$/i.test(e.name)) { const c = await D.readBin(base + '/Subcrates/' + e.name); if (c) sets.push(fix(await parse(c, e.name))); }
        } else {
          const ids = new Set(all.filter(t => volumeOf(t.path, P) === v).map(t => t.id));
          const part = lists.map(l => ({ ...l, trackIds: l.trackIds.filter(id => ids.has(id)) })).filter(l => l.trackIds.length);
          for (const f of Formats.seratoExport(part, S.tracks, absPath)) { await D.writeBin((v || P.music) + '/' + f.name, f.data, true); written++; }
        }
      }
      if (dir === 'write' && !written) throw new Error('Für Serato werden Playlists übertragen – bitte zuerst eine Playlist mit Titeln anlegen.');
    } else if (app === 'vdj') {
      const cands = [P.home + '/Library/Application Support/VirtualDJ', P.home + '/AppData/Local/VirtualDJ', P.documents + '/VirtualDJ'];
      let main = cands[2];
      for (const c of cands) if ((await D.list(c)).length) { main = c; break; }
      for (const v of vols) {
        const file = (v ? v + '/VirtualDJ' : main) + '/database.xml', old = await D.readBin(file);
        if (dir === 'read') { if (old) sets.push(await parse(old, 'database.xml')); continue; }
        const mine = all.filter(t => volumeOf(t.path, P) === v);
        if (mine.length) { await D.writeBin(file, Formats.vdjMerge(old ? new TextDecoder().decode(old) : '', mine, absPath), true); written++; }
      }
      if (dir === 'read') { for (const e of await D.list(main + '/Playlists')) if (/\.(m3u8?|vdjfolder)$/i.test(e.name)) { const c = await D.readBin(main + '/Playlists/' + e.name); if (c) sets.push(await parse(c, e.name)); } }
      else for (const l of lists.filter(x => x.trackIds.length)) { await D.writeBin(main + '/Playlists/' + Formats.safeName(l.name) + '.m3u', Formats.m3uExport(l.trackIds.map(id => S.tracks.get(id)).filter(Boolean), absPath), true); written++; }
    } else if (app === 'traktor') {
      const ni = P.documents + '/Native Instruments';
      const dirs = (await D.list(ni)).filter(e => e.dir && /^Traktor/i.test(e.name)).map(e => e.name).sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));
      if (!dirs.length) throw new Error('Kein Traktor-Ordner unter „Dokumente/Native Instruments“ gefunden.');
      const base = ni + '/' + dirs[0];
      if (dir === 'read') {
        const c = await D.readBin(base + '/collection.nml');
        if (!c) throw new Error('In ' + base + ' liegt keine collection.nml.');
        const d = await parse(c, 'collection.nml');
        // Titel auf anderen Laufwerken (Mac): Traktor nennt nur den Laufwerksnamen
        for (const t of d.tracks) if (t.volume && !/^[A-Za-z]:$/.test(t.volume) && !(await D.stat(t.path)) && await D.stat('/Volumes/' + t.volume + t.path)) t.path = '/Volumes/' + t.volume + t.path;
        sets.push(d);
      } else {
        await D.writeBin(base + '/ONE Library.nml', Formats.traktorExport(all, lists, absPath), true); written++;
        note = 'In Traktor: Rechtsklick auf „Track Collection“ → „Import Another Collection …“ und die Datei „ONE Library.nml“ im Traktor-Ordner wählen.';
      }
    } else {
      const file = P.documents + '/ONE Library/rekordbox.xml';
      if (dir === 'read') {
        const c = await D.readBin(file);
        if (!c) throw new Error('Bitte in rekordbox „Datei → Sammlung im xml-Format exportieren“ wählen und hier speichern: ' + file);
        sets.push(await parse(c, 'rekordbox.xml'));
      } else {
        await D.writeBin(file, Formats.rekordboxExport(all, lists, absPath), true); written++;
        note = 'In rekordbox einmalig unter Einstellungen → Erweitert → Datenbank → „rekordbox xml“ diese Datei eintragen: ' + file + '. Danach erscheint die Bibliothek dort im Baum unter „rekordbox xml“.';
      }
    }
    if (dir === 'write') return { text: `${nf(written)} Datei${written === 1 ? '' : 'en'} geschrieben. Ersetzte Dateien wurden vorher als Kopie gesichert.`, note };
    if (!sets.length) throw new Error('Keine Daten dieser DJ-Software gefunden.');
    sets.sort((a, b) => (b.full ? 1 : 0) - (a.full ? 1 : 0));
    let added = 0, merged = 0, nl = 0;
    for (const d of sets) { const r = await mergeData(d); added += r.added; merged += r.merged; nl += r.lists; }
    dirty();
    return { text: `${nf(added)} neue Titel, ${nf(merged)} abgeglichen, ${nf(nl)} Playlists.`, note };
  }
  async function syncDialog() {
    const f = await modal({ title: 'Direkter Abgleich mit DJ-Software', ok: 'Ausführen',
      body: `<label class="field"><span class="lbl">Programm</span><select class="in" name="app"><option value="serato">Serato</option><option value="vdj">VirtualDJ</option><option value="traktor">Traktor</option><option value="rekordbox">rekordbox</option></select></label>
        <label class="field"><span class="lbl">Richtung</span><select class="in" name="dir"><option value="read">Aus der DJ-Software einlesen</option><option value="write">In die DJ-Software schreiben</option><option value="history">Verlauf einlesen (gespielte Titel)</option></select></label>
        <p class="mut">Die DJ-Software sollte dabei geschlossen sein. Vor dem Schreiben wird jede Datei, die ersetzt wird, als Kopie daneben gesichert. Serato erhält die Playlists als Crates, VirtualDJ wird ergänzt statt ersetzt; Traktor und rekordbox übernehmen eine Austauschdatei.</p>` });
    if (!f) return;
    if (S.busy) return toast('Bitte warten, es läuft noch ein Vorgang.', true);
    status('Abgleich läuft …');
    try {
      const r = await syncRun(f.app.value, f.dir.value);
      status();
      if (r.note) await modal({ title: 'Abgleich abgeschlossen', ok: 'OK', body: `<p>${esc(r.text)}</p><p class="mut">${esc(r.note)}</p>` });
      else toast(r.text);
    } catch (e) { status(); toast(e.message || 'Abgleich fehlgeschlagen.', true); }
  }

  function runAction(a) {
    const sel = selected();
    switch (a) {
      case 'play': return toggle();
      case 'load': return sel[0] && load(sel[0]);
      case 'memory': return memoryCue();
      case 'panel': if (S.cur) { S.panel = !S.panel; renderDeck(); } return;
      case 'zoom': if (S.cur) { S.zoom = !S.zoom; renderDeck(); } return;
      case 'match': return S.cur && S.cur.key && setView({ type: 'match', id: S.cur.id });
      case 'analyze': return sel.length && analyze(sel);
      default: return $('#q').select();
    }
  }
  async function keysDialog() {
    const keys = { ...S.settings.keys };
    const cur = a => keys[a] || ACTIONS[a][1];
    let wait = null;
    const f = await modal({ title: 'Tastenkürzel',
      body: `<p class="mut">Auf eine Taste klicken und die neue Taste drücken. Fest belegt bleiben: 1–8 (Hot Cues), Pfeiltasten, Entf, Strg/⌘+Z, +A, +F.</p>${Object.entries(ACTIONS).map(([a, [label]]) => `<div class="krow"><span>${label}</span><button type="button" class="btn sm" data-key="${a}">${esc(keyLabel(cur(a)))}</button></div>`).join('')}<button type="button" class="btn sm" id="keysReset">Standard wiederherstellen</button>`,
      onOpen: ov => {
        const paint = () => $$('[data-key]', ov).forEach(b => { b.textContent = wait === b.dataset.key ? 'Taste drücken …' : keyLabel(cur(b.dataset.key)); b.classList.toggle('active', wait === b.dataset.key); });
        ov.addEventListener('click', e => {
          const b = e.target.closest('[data-key]');
          if (b) { wait = b.dataset.key; paint(); }
          if (e.target.closest('#keysReset')) { for (const a of Object.keys(keys)) delete keys[a]; wait = null; paint(); }
        });
        ov.addEventListener('keydown', e => {
          if (!wait || e.key === 'Escape' || e.key === 'Tab' || /^(Shift|Control|Alt|Meta)/.test(e.code)) return;
          e.preventDefault(); e.stopPropagation();
          if (/^Digit[1-8]$|^Arrow|^Delete$|^Backspace$/.test(e.code)) return toast('Diese Taste ist fest belegt.', true);
          for (const a of Object.keys(ACTIONS)) if (a !== wait && cur(a) === e.code) keys[a] = 'None'; // Doppelbelegung auflösen
          keys[wait] = e.code; wait = null; paint();
        }, true);
      } });
    if (!f) return;
    S.settings.keys = keys;
    await saveSettings();
  }

  /* ---------- Ereignisse ---------- */
  function selectRow(id, e) {
    const idx = S.rows.findIndex(t => t.id === id);
    if (e.shiftKey && S.anchor != null) {
      const a = S.rows.findIndex(t => t.id === S.anchor);
      if (!(e.metaKey || e.ctrlKey)) S.sel.clear();
      for (let i = Math.min(a, idx); i <= Math.max(a, idx); i++) if (i >= 0) S.sel.add(S.rows[i].id);
    } else if (e.metaKey || e.ctrlKey) { S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id); S.anchor = id; }
    else { S.sel.clear(); S.sel.add(id); S.anchor = id; }
    drawRows(); renderInspector(); renderCount();
  }
  function moveSel(d, shift) {
    if (!S.rows.length) return;
    let i = S.rows.findIndex(t => t.id === S.anchor);
    i = Math.max(0, Math.min(S.rows.length - 1, i + d));
    const id = S.rows[i].id;
    if (!shift) S.sel.clear();
    S.sel.add(id); S.anchor = id;
    const body = $('#tbody');
    if (i * ROW < body.scrollTop) body.scrollTop = i * ROW;
    else if ((i + 1) * ROW > body.scrollTop + body.clientHeight) body.scrollTop = (i + 1) * ROW - body.clientHeight;
    drawRows(); renderInspector(); renderCount();
  }

  function rowMenu(e, t) {
    if (!S.sel.has(t.id)) { S.sel.clear(); S.sel.add(t.id); S.anchor = t.id; drawRows(); renderInspector(); renderCount(); }
    const sel = selected();
    const inList = S.view.type === 'list' && (S.lists.find(l => l.id === S.view.id) || {}).type === 'list';
    menu(e.clientX, e.clientY, [
      { l: 'Ins Deck laden', fn: () => load(t) },
      { l: `Analysieren (${nf(sel.length)})`, fn: () => analyze(sel) },
      null, { head: 'Zu Playlist hinzufügen' },
      ...S.lists.filter(l => l.type === 'list').map(l => ({ l: l.name, raw: true, fn: () => addToList(l, sel) })),
      { l: 'Neue Playlist aus Auswahl …', fn: () => newList(sel) },
      null,
      { l: inList ? 'Aus Playlist entfernen' : 'Aus Bibliothek entfernen …', fn: removeSelected }
    ]);
  }
  function listMenu(e, l) {
    menu(e.clientX, e.clientY, [
      l.type === 'smart' ? { l: 'Regeln bearbeiten …', fn: () => editSmart(l) } : { l: 'Umbenennen …', fn: async () => {
        const f = await modal({ title: 'Playlist umbenennen', body: `<label class="field"><span class="lbl">Name</span><input class="in" name="name" required value="${esc(l.name)}"></label>` });
        if (f) { snap('Umbenennen'); l.name = f.name.value.trim() || l.name; await saveList(l); refresh(); }
      } },
      { l: 'Löschen …', fn: async () => {
        if (!(await confirmBox('Liste löschen', `„${l.name}“ löschen? Die Titel bleiben in der Bibliothek.`))) return;
        snap('Liste löschen');
        S.lists = S.lists.filter(x => x !== l);
        await DB.del('lists', l.id);
        setView({ type: 'all' });
      } }
    ]);
  }

  function bind() {
    const body = $('#tbody');
    body.addEventListener('click', e => { const w = e.target.closest('[data-wish]'); if (w) wishAction(w.dataset.wish, w.dataset.id); });
    body.addEventListener('scroll', () => requestAnimationFrame(drawRows));
    new ResizeObserver(() => { fitCols(); drawRows(); drawWave(); }).observe(body);
    // Doppelklick selbst erkennen: die Zeilen werden beim ersten Klick neu gezeichnet, das native dblclick bleibt dann aus
    let last = { id: null, at: 0 };
    body.addEventListener('click', e => {
      const r = e.target.closest('.tr');
      if (!r) { if (e.target === body || e.target.id === 'tspace') { S.sel.clear(); drawRows(); renderInspector(); renderCount(); } return; }
      const id = r.dataset.id, now = performance.now();
      if (last.id === id && now - last.at < 450 && !e.shiftKey && !e.metaKey && !e.ctrlKey) { last = { id: null, at: 0 }; return load(S.tracks.get(id)); }
      last = { id, at: now };
      selectRow(id, e);
    });
    body.addEventListener('contextmenu', e => { const r = e.target.closest('.tr'); if (r) { e.preventDefault(); rowMenu(e, S.tracks.get(r.dataset.id)); } });
    body.addEventListener('dragstart', e => {
      const r = e.target.closest('.tr'); if (!r) return;
      if (!S.sel.has(r.dataset.id)) { S.sel.clear(); S.sel.add(r.dataset.id); S.anchor = r.dataset.id; drawRows(); renderInspector(); }
      e.dataTransfer.setData('application/x-one-tracks', '1');
      e.dataTransfer.effectAllowed = 'copy';
    });

    // Playlist-Reihenfolge per Ziehen ändern (nur in der eigenen Reihenfolge, ohne Suchfilter)
    const marker = document.createElement('div');
    marker.className = 'dropline';
    body.addEventListener('dragover', e => {
      if (!e.dataTransfer.types.includes('application/x-one-tracks') || S.sort.f !== 'pos' || S.q) return;
      e.preventDefault();
      const r = body.getBoundingClientRect(), i = Math.max(0, Math.min(S.rows.length, Math.round((e.clientY - r.top + body.scrollTop) / ROW)));
      marker.style.top = i * ROW - 1 + 'px'; marker.dataset.i = i;
      $('#tspace').append(marker);
    });
    body.addEventListener('dragleave', e => { if (!body.contains(e.relatedTarget)) marker.remove(); });
    body.addEventListener('drop', async e => {
      if (!marker.isConnected) return;
      e.preventDefault();
      const i = +marker.dataset.i, list = S.lists.find(l => l.id === S.view.id);
      marker.remove();
      if (!list) return;
      snap('Reihenfolge ändern');
      const moving = new Set(S.sel), before = S.rows.slice(0, i).filter(t => !moving.has(t.id)).length;
      const rest = list.trackIds.filter(id => !moving.has(id));
      rest.splice(before, 0, ...list.trackIds.filter(id => moving.has(id)));
      list.trackIds = rest;
      await saveList(list);
      refresh();
    });

    // Kopfzeile: Spalten wählen (Rechtsklick), verschieben (Ziehen), Breite ändern (rechter Rand)
    const head = $('#thead');
    let rzAt = 0;
    head.addEventListener('contextmenu', e => { e.preventDefault(); colMenu(e); });
    head.addEventListener('mousedown', e => {
      if (!e.target.classList.contains('rz')) return;
      e.preventDefault();
      const th = e.target.parentElement, f = th.dataset.f, x0 = e.clientX, w0 = th.getBoundingClientRect().width;
      const move = ev => { S.settings.cols.w[f] = Math.max(40, Math.round(w0 + ev.clientX - x0)); fitCols(true); drawRows(); };
      const up = () => { removeEventListener('mousemove', move); removeEventListener('mouseup', up); rzAt = Date.now(); saveSettings(); };
      addEventListener('mousemove', move); addEventListener('mouseup', up);
    });
    head.addEventListener('dragstart', e => { const th = e.target.closest('.th'); if (!th) return; e.dataTransfer.setData('application/x-one-col', th.dataset.f); e.dataTransfer.effectAllowed = 'move'; });
    head.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('application/x-one-col') && e.target.closest('.th')) e.preventDefault(); });
    head.addEventListener('drop', e => {
      const th = e.target.closest('.th'), f = e.dataTransfer.getData('application/x-one-col');
      if (!th || !f || FIXED_COL(th.dataset.f) || th.dataset.f === f) return;
      e.preventDefault(); e.stopPropagation();
      const cur = COLS.map(c => c.f).filter(x => !FIXED_COL(x)), after = cur.indexOf(f) < cur.indexOf(th.dataset.f);
      const order = cur.filter(x => x !== f);
      order.splice(order.indexOf(th.dataset.f) + (after ? 1 : 0), 0, f);
      S.settings.cols.order = order;
      saveSettings(); fitCols(true); drawRows();
    });

    $('#thead').addEventListener('click', e => {
      const th = e.target.closest('.th'); if (!th || e.target.classList.contains('rz') || Date.now() - rzAt < 300) return;
      const f = th.dataset.f;
      if (f === 'color') return;
      if (f === 'pos') { if ((S.lists.find(l => l.id === S.view.id) || {}).type !== 'list' || S.view.type !== 'list') return; S.sort = { f: 'pos', d: 1 }; }
      else S.sort = { f, d: S.sort.f === f ? -S.sort.d : (['rating', 'added', 'bpm', 'energy', 'playCount', 'lastPlayed'].includes(f) ? -1 : 1) };
      S.settings.sorts[viewKey(S.view)] = S.sort; saveSettings();
      refresh();
    });

    const side = $('#side');
    side.addEventListener('click', e => {
      const n = e.target.closest('[data-new]');
      if (n) return n.dataset.new === 'smart' ? editSmart() : newList();
      const b = e.target.closest('.si');
      if (b) setView({ type: b.dataset.view, id: b.dataset.id || undefined });
    });
    side.addEventListener('contextmenu', e => {
      const b = e.target.closest('.si[data-view=list]'); if (!b) return;
      e.preventDefault();
      listMenu(e, S.lists.find(l => l.id === b.dataset.id));
    });
    side.addEventListener('dragover', e => { const b = e.target.closest('[data-drop]'); if (b && e.dataTransfer.types.includes('application/x-one-tracks')) { e.preventDefault(); b.classList.add('over'); } });
    side.addEventListener('dragleave', e => { const b = e.target.closest('[data-drop]'); if (b) b.classList.remove('over'); });
    side.addEventListener('drop', e => {
      const b = e.target.closest('[data-drop]'); if (!b) return;
      e.preventDefault(); e.stopPropagation(); b.classList.remove('over');
      const sel = selected();
      if (b.dataset.view === 'tag') tagSel(b.dataset.id, true, sel);
      else addToList(S.lists.find(l => l.id === b.dataset.id), sel);
    });

    let qTimer;
    $('#q').addEventListener('input', e => { clearTimeout(qTimer); qTimer = setTimeout(() => { S.q = e.target.value; refresh(); $('#tbody').scrollTop = 0; }, 120); });
    $('#bAdd').addEventListener('click', e => { const r = e.currentTarget.getBoundingClientRect(); menu(r.left, r.bottom + 4, [{ l: 'Ordner hinzufügen …', fn: pickFolder }, { l: 'Einzelne Dateien hinzufügen …', fn: pickFiles }]); e.stopPropagation(); });
    $('#bAnalyze').addEventListener('click', e => {
      const r = e.currentTarget.getBoundingClientRect(), sel = selected();
      menu(r.left, r.bottom + 4, [
        { l: `Auswahl analysieren (${nf(sel.length)})`, off: !sel.length, fn: () => analyze(sel) },
        { l: 'Alle nicht analysierten Titel', fn: () => analyze([...S.tracks.values()].filter(t => !t.analyzed)) },
        { l: 'Aktuelle Ansicht komplett neu analysieren', fn: () => analyze(S.rows.slice()) }
      ]);
      e.stopPropagation();
    });
    $('#bTools').addEventListener('click', e => {
      const r = e.currentTarget.getBoundingClientRect();
      menu(r.left, r.bottom + 4, [
        { l: 'Rückgängig' + (undoStack.length ? ': ' + undoStack[undoStack.length - 1].label : ''), off: !undoStack.length, fn: undo }, null,
        { head: 'Auswahl bearbeiten' },
        { l: 'Suchen & Ersetzen …', fn: findReplace }, { l: 'Titel/Artist aus Dateiname', fn: fromFileName },
        { l: 'Groß-/Kleinschreibung bereinigen', fn: () => batch('caps') }, { l: 'Artist und Titel tauschen', fn: () => batch('swap') }, { l: 'Leerzeichen bereinigen', fn: () => batch('trim') },
        { l: 'Album, Jahr und Genre online ergänzen …', fn: onlineLookup },
        { l: 'Tags in Dateien schreiben …', fn: writeTags }, ...(D ? [{ l: 'Dateien umbenennen …', fn: renameFiles }] : []), null,
        { head: 'Bibliothek' },
        { l: 'Dateien prüfen (fehlende finden)', fn: checkFiles }, { l: 'Duplikate anzeigen', fn: () => setView({ type: 'dupes' }) }, { l: 'Duplikate zusammenführen …', fn: mergeDupes }
      ]);
      e.stopPropagation();
    });
    $('#bIO').addEventListener('click', e => {
      const r = e.currentTarget.getBoundingClientRect();
      menu(r.left, r.bottom + 4, [{ l: 'Importieren (Rekordbox, Traktor, Serato, VirtualDJ, M3U, Backup) …', fn: () => $('#pickImport').click() }, { l: 'Exportieren …', fn: exportDialog }, null, { l: 'Backup jetzt speichern', fn: backup }, null, { l: 'Spotify-Playlists abgleichen …', fn: spotifyDialog }, ...(D ? [null, { l: 'Direkter Abgleich mit DJ-Software …', fn: syncDialog }] : [])]);
      e.stopPropagation();
    });
    $('#bSet').addEventListener('click', settingsDialog);
    $('#bStop').addEventListener('click', () => { if (S.busy) S.busy.stop = true; });
    $('#pickFiles').addEventListener('change', e => { addItems(itemsFromFiles(e.target.files)); e.target.value = ''; });
    $('#pickDir').addEventListener('change', e => { addItems(itemsFromFiles(e.target.files)); e.target.value = ''; });
    $('#pickImport').addEventListener('change', e => { if (e.target.files.length) importData(e.target.files); e.target.value = ''; });

    const insp = $('#insp');
    insp.addEventListener('change', e => { const f = e.target.dataset.f; if (f) edit(f, e.target.value); });
    insp.addEventListener('click', e => {
      const r = e.target.closest('[data-rate]'), c = e.target.closest('[data-color]'), u = e.target.closest('[data-untag]');
      if (r) { const n = +r.dataset.rate, sel = selected(); edit('rating', sel.every(t => t.rating === n) ? 0 : n); }
      else if (c) edit('color', c.dataset.color);
      else if (u) tagSel(u.dataset.untag, false);
    });
    insp.addEventListener('keydown', e => { if (e.target.id === 'tagIn' && e.key === 'Enter') { e.preventDefault(); tagSel(e.target.value, true).then(() => { const i = $('#tagIn'); if (i) i.focus(); }); } });

    const deck = $('#deck');
    deck.addEventListener('click', e => {
      if (e.target.closest('#pp')) return toggle();
      const c = e.target.closest('[data-cue]');
      if (c) return cue(+c.dataset.cue, e.altKey || e.shiftKey);
      if (e.target.closest('#bMatch')) return setView({ type: 'match', id: S.cur.id });
      if (e.target.closest('#bEdit')) { S.panel = !S.panel; return renderDeck(); }
      if (e.target.closest('#bZoom')) { S.zoom = !S.zoom; return renderDeck(); }
      const td = e.target.closest('[data-tdel]');
      if (td) return grid('tdel', { i: +td.closest('.trow').dataset.i });
      const g = e.target.closest('[data-grid]');
      if (g) return grid(g.dataset.grid);
      if (e.target.closest('#cSuggest')) return suggestCues();
      if (e.target.closest('#cMem')) return memoryCue();
      const row = e.target.closest('.crow');
      if (row) {
        if (e.target.closest('[data-cdel]')) return cueEdit(+row.dataset.i, 'del');
        if (e.target.closest('[data-cgo]')) return cueEdit(+row.dataset.i, 'go');
        if (e.target.closest('[data-ccolor]')) return cueEdit(+row.dataset.i, 'color');
        return;
      }
      if (e.target.id === 'wave' && S.cur) {
        const r = e.target.getBoundingClientRect(), dur = S.cur.duration || audio.duration;
        const frac = (e.clientX - r.left) / r.width;
        if (dur) { audio.currentTime = Math.max(0, Math.min(dur - 0.05, S.zoom ? audio.currentTime - 4 + frac * 8 : frac * dur)); S.loop = null; lastBeat = -1; drawWave(); }
      }
    });
    deck.addEventListener('change', e => {
      const row = e.target.closest('.crow');
      if (row && e.target.matches('[data-cname]')) return cueEdit(+row.dataset.i, 'name', e.target.value);
      if (row && e.target.matches('[data-clen]')) return cueEdit(+row.dataset.i, 'len', e.target.value);
      if (e.target.id === 'gBpm') grid('bpm', e.target.value);
      if (e.target.matches('[data-tbpm]')) grid('tbpm', { i: +e.target.closest('.trow').dataset.i, v: e.target.value });
    });
    deck.addEventListener('contextmenu', e => { const c = e.target.closest('[data-cue]'); if (c) { e.preventDefault(); cue(+c.dataset.cue, true); } });
    deck.addEventListener('input', e => { if (e.target.id === 'vol') { S.settings.volume = +e.target.value; applyVol(); saveSettings(); } });

    audio.addEventListener('timeupdate', () => {
      const el = $('#dtime'); if (el) el.textContent = time(audio.currentTime);
      holdLoop();
      drawWave();
      const t = S.cur;
      if (t && !S.curCounted && audio.currentTime > Math.min(30, (t.duration || 60) / 2)) { S.curCounted = true; t.playCount = (t.playCount || 0) + 1; t.lastPlayed = Date.now(); DB.put('tracks', t); }
    });
    const pp = () => { const b = $('#pp'); if (b) b.innerHTML = audio.paused ? IC.play : IC.pause; drawRows(); };
    audio.addEventListener('play', pp); audio.addEventListener('pause', pp);
    audio.addEventListener('loadedmetadata', () => { const t = S.cur; if (t && !t.duration && isFinite(audio.duration)) { t.duration = audio.duration; DB.put('tracks', t); renderDeck(); } });
    audio.addEventListener('ended', () => { const i = S.rows.indexOf(S.cur); if (i >= 0 && S.rows[i + 1]) load(S.rows[i + 1]); });

    document.addEventListener('mousedown', e => { if (!e.target.closest('.menu')) closeMenu(); });
    document.addEventListener('keydown', e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); return $('#q').select(); }
      if (typing || $('.ov')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); return undo(); }
      if (e.key === 'Escape') return closeMenu();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); S.sel = new Set(S.rows.map(t => t.id)); drawRows(); renderInspector(); return renderCount(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); return moveSel(e.key === 'ArrowDown' ? 1 : -1, e.shiftKey); }
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const act = Object.keys(ACTIONS).find(a => keyOf(a) === e.code);
        if (act) { e.preventDefault(); return runAction(act); }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); return removeSelected(); }
      const d = /^Digit([1-8])$/.exec(e.code);
      if (d && !e.metaKey && !e.ctrlKey) cue(+d[1] - 1, e.shiftKey);
    });

    // Dateien und Ordner per Drag & Drop
    let depth = 0;
    const external = e => e.dataTransfer && e.dataTransfer.types.includes('Files');
    addEventListener('dragenter', e => { if (external(e)) { depth++; $('#drop').hidden = false; } });
    addEventListener('dragleave', e => { if (external(e) && --depth <= 0) { depth = 0; $('#drop').hidden = true; } });
    addEventListener('dragover', e => { if (external(e)) e.preventDefault(); });
    addEventListener('drop', async e => {
      if (!external(e)) return;
      e.preventDefault(); depth = 0; $('#drop').hidden = true;
      const dt = e.dataTransfer, items = [];
      const data = [...dt.files].filter(f => /\.(xml|nml|m3u8?|json|crate|vdjfolder)$/i.test(f.name) || /^database V2$/i.test(f.name));
      if (data.length) return importData(data);
      if (D) { status('Ordner wird gelesen …'); return addItems(ditems(await D.expand([...dt.files].map(f => D.pathOf(f)).filter(Boolean)))); }
      if (dt.items && dt.items[0] && dt.items[0].getAsFileSystemHandle) {
        const hs = await Promise.all([...dt.items].filter(i => i.kind === 'file').map(i => i.getAsFileSystemHandle()));
        status('Ordner wird gelesen …');
        for (const h of hs) {
          if (!h) continue;
          if (h.kind === 'directory') items.push(...await addRoot(h));
          else if (Tags.isAudio(h.name)) items.push({ handle: h, path: h.name });
        }
      } else items.push(...itemsFromFiles(dt.files));
      addItems(items);
    });
  }

  /* ---------- Start ---------- */
  async function start() {
    if (typeof I18n !== 'undefined') I18n.start();
    shell();
    try {
      await DB.open();
      const [tracks, lists, settings, roots, handles] = await Promise.all([DB.all('tracks'), DB.all('lists'), DB.get('meta', 'settings'), DB.get('meta', 'roots'), DB.entries('handles')]);
      S.wish = (await DB.get('meta', 'wishlist')) || [];
      S.spotify = (await DB.get('meta', 'spotify')) || null;
      S.tracks = new Map(tracks.map(t => [t.id, t]));
      S.lists = lists;
      S.settings = { ...S.settings, ...(settings || {}) };
      S.settings.cols = { hidden: [], shown: [], order: [], w: {}, ...(S.settings.cols || {}) };
      S.settings.sorts = S.settings.sorts || {}; S.settings.keys = S.settings.keys || {};
      S.roots = roots || [];
      for (const [id, h] of handles) S.files.set(id, h);
    } catch (e) { toast('Der lokale Speicher des Browsers ist nicht verfügbar – Änderungen gehen beim Schließen verloren.', true); }
    applyTheme();
    bind();
    fitCols(true);
    renderDeck();
    refresh();
    requestAnimationFrame(tick);
    spotifyReturn();
    // Aufräumen: Daten zu entfernten Titeln löschen, danach die tägliche Sicherung
    try {
      for (const store of ['waves', 'covers', 'handles']) {
        const gone = (await DB.entries(store)).map(([k]) => k).filter(k => !S.tracks.has(String(k).split('~')[0]));
        if (gone.length) { await DB.delMany(store, gone); for (const k of gone) S.files.delete(k); }
      }
      await autoBackup();
    } catch { /* nicht kritisch */ }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  }
  start();
})();
