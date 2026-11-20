'use strict';
/* DJ KOLJA ONE · Library — Oberfläche und Ablaufsteuerung */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const time = s => { s = Math.max(0, Math.round(s || 0)); const m = Math.floor(s / 60); return (m >= 60 ? Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); };
  const date = ms => ms ? new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
  const nf = n => n.toLocaleString('de-DE');
  const ROW = 34;
  const COLORS = ['', '#B79A6B', '#C96A5A', '#D9A441', '#7FA66B', '#5E9BB5', '#8E7CC3', '#B9B5AD'];
  const CUE_COLORS = ['#C8AF82', '#C96A5A', '#D9A441', '#7FA66B', '#5E9BB5', '#8E7CC3', '#D987B0', '#F4F0E8'];
  const IC = {
    play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 4.5h4.5v15H6zm7.5 0H18v15h-4.5z"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z"/></svg>'
  };
  // min: Spalte erscheint erst ab dieser Tabellenbreite (px)
  const ALL_COLS = [
    { f: 'pos', l: '#', w: '44px' }, { f: 'color', l: '', w: '22px' },
    { f: 'title', l: 'Titel', w: 'minmax(150px,2.2fr)' }, { f: 'artist', l: 'Artist', w: 'minmax(110px,1.6fr)' },
    { f: 'album', l: 'Album', w: 'minmax(90px,1.2fr)', min: 1120 }, { f: 'genre', l: 'Genre', w: 'minmax(70px,.9fr)', min: 700 },
    { f: 'bpm', l: 'BPM', w: '62px' }, { f: 'key', l: 'Key', w: '54px' }, { f: 'duration', l: 'Zeit', w: '56px' },
    { f: 'rating', l: 'Bewertung', w: '96px', min: 600 }, { f: 'year', l: 'Jahr', w: '52px', min: 900 },
    { f: 'tags', l: 'Tags', w: 'minmax(80px,1fr)', min: 800 }, { f: 'added', l: 'Hinzugefügt', w: '96px', min: 1000 }
  ];
  let COLS = ALL_COLS;
  function fitCols() {
    const w = $('#tbody').clientWidth;
    const next = ALL_COLS.filter(c => !c.min || w >= c.min);
    const changed = next.length !== COLS.length || !document.documentElement.style.getPropertyValue('--cols');
    COLS = next;
    if (changed) { document.documentElement.style.setProperty('--cols', COLS.map(c => c.w).join(' ')); renderHead(); }
  }
  const RULE_FIELDS = { title: 'Titel', artist: 'Artist', album: 'Album', genre: 'Genre', comment: 'Kommentar', tags: 'Tags', key: 'Tonart', bpm: 'BPM', year: 'Jahr', rating: 'Bewertung', duration: 'Dauer (Sek.)', playCount: 'Wiedergaben', addedDays: 'Hinzugefügt vor (Tagen)' };
  const RULE_NUM = new Set(['bpm', 'year', 'rating', 'duration', 'playCount', 'addedDays']);
  const RULE_OPS = { has: 'enthält', hasnt: 'enthält nicht', is: 'ist', isnt: 'ist nicht', gt: 'größer als', lt: 'kleiner als' };

  const S = {
    tracks: new Map(), lists: [], roots: [], files: new Map(),
    view: { type: 'all' }, sel: new Set(), anchor: null, sort: { f: 'added', d: -1 }, q: '', rows: [],
    settings: { keyMode: 'camelot', basePath: '', quantize: true, volume: 0.9 },
    cur: null, curWave: null, busy: null, dupes: null
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
  const connected = t => S.files.has(t.id) || (!!t.root && S.roots.some(r => r.id === t.root));
  const isMissing = t => !connected(t) || !!t.missing;
  const absPath = t => /^(\/|[A-Za-z]:[\\/])/.test(t.path) ? t.path : (S.settings.basePath || '').replace(/[\\/]*$/, '/') + t.path;
  const selected = () => S.rows.filter(t => S.sel.has(t.id));
  const fileName = t => (t.path || '').replace(/\\/g, '/').split('/').pop();

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
    el.innerHTML = items.map((it, i) => !it ? '<hr>' : it.head ? `<div class="mhd">${esc(it.head)}</div>` : `<button data-i="${i}"${it.off ? ' disabled' : ''}>${esc(it.l)}</button>`).join('');
    document.body.append(el);
    const r = el.getBoundingClientRect();
    el.style.left = Math.max(6, Math.min(x, innerWidth - r.width - 6)) + 'px';
    el.style.top = Math.max(6, Math.min(y, innerHeight - r.height - 6)) + 'px';
    el.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { closeMenu(); items[+b.dataset.i].fn(); } });
  }
  function closeMenu() { const m = $('.menu'); if (m) m.remove(); }

  /* ---------- Dateizugriff ---------- */
  async function perm(h, ask) {
    if (!h.queryPermission) return true;
    let p = await h.queryPermission({ mode: 'read' });
    if (p !== 'granted' && ask) p = await h.requestPermission({ mode: 'read' });
    return p === 'granted';
  }
  async function fileOf(t, ask) {
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
    if (window.showDirectoryPicker) {
      let h;
      try { h = await window.showDirectoryPicker({ mode: 'read' }); } catch { return; }
      status('Ordner wird gelesen …');
      addItems(await addRoot(h));
    } else $('#pickDir').click();
  }
  async function pickFiles() {
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
          bpm: tag.bpm, key: Keys.parse(tag.key), duration: await Tags.duration(file), rating: 0, color: '', tags: [], cues: [], gridStart: 0,
          path: it.path, size: file.size, added: Date.now(), playCount: 0, analyzed: false };
        S.tracks.set(t.id, t);
        bySize.set(n + '|' + file.size, t);
        added++;
      }
      if (it.root) { t.root = it.root; t.rel = it.rel; if (!/^(\/|[A-Za-z]:)/.test(t.path)) t.path = it.path; }
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
        t.analyzed = true; delete t.missing;
        await DB.put('waves', r.wave, t.id);
        await DB.put('tracks', t);
        if (S.cur === t) { S.curWave = r.wave; drawWave(); renderDeck(); }
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
    const cs = (l.rules && l.rules.conds) || [];
    const all = [...S.tracks.values()];
    if (!cs.length) return all;
    return all.filter(t => l.rules.match === 'any' ? cs.some(c => ruleMatch(t, c)) : cs.every(c => ruleMatch(t, c)));
  };

  function viewTracks(v) {
    const all = [...S.tracks.values()];
    switch (v.type) {
      case 'recent': { const lim = Date.now() - 30 * 864e5; return all.filter(t => t.added >= lim); }
      case 'unanalyzed': return all.filter(t => !t.analyzed);
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
      const val = f === 'key' ? t => Keys.sortVal(t.key) : f === 'tags' ? t => (t.tags || []).join(',').toLowerCase() : t => t[f];
      const cmp = (a, b) => {
        const x = val(a), y = val(b);
        if (typeof x === 'string' || typeof y === 'string') return String(x || '').localeCompare(String(y || ''), 'de', { sensitivity: 'base', numeric: true });
        return (x || 0) - (y || 0);
      };
      if (S.view.type === 'dupes') { const dm = dupes(); rows.sort((a, b) => dm.get(a.id).localeCompare(dm.get(b.id)) || cmp(a, b) * d); }
      else rows.sort((a, b) => cmp(a, b) * d);
    }
    S.rows = rows;
    for (const id of S.sel) if (!S.tracks.has(id)) S.sel.delete(id);
  }

  function setView(v) {
    S.view = v;
    const plain = v.type === 'list' && (S.lists.find(l => l.id === v.id) || {}).type === 'list';
    S.sort = plain ? { f: 'pos', d: 1 } : S.sort.f === 'pos' ? { f: 'added', d: -1 } : S.sort;
    S.sel.clear(); S.anchor = null;
    refresh();
    $('#tbody').scrollTop = 0;
  }
  function dirty() { S.dupes = null; refresh(); }
  function refresh() { computeRows(); renderSide(); renderHead(); drawRows(); renderInspector(); renderCount(); }

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
      <input type="file" id="pickImport" accept=".xml,.nml,.m3u,.m3u8,.json" hidden>
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
      item('dupes', '', 'Duplikate', dupes().size) +
      item('missing', '', 'Fehlende Dateien', all.filter(isMissing).length);
    if (S.view.type === 'match') h += item('match', S.view.id, 'Passend zum Deck', S.view.type === 'match' ? viewTracks(S.view).length : undefined);
    h += `<div class="sh">Playlists<button class="add" data-new="list" title="Neue Playlist">${IC.plus}</button></div>`;
    h += S.lists.filter(l => l.type === 'list').map(l => item('list', l.id, l.name, l.trackIds.length, ' data-drop="1"')).join('') || '<div class="hint">Titel hierher ziehen, sobald eine Playlist angelegt ist.</div>';
    h += `<div class="sh">Smartlists<button class="add" data-new="smart" title="Neue Smartlist">${IC.plus}</button></div>`;
    h += S.lists.filter(l => l.type === 'smart').map(l => item('list', l.id, l.name, smartTracks(l).length)).join('') || '<div class="hint">Listen, die sich über Regeln selbst füllen.</div>';
    h += '<div class="sh">Tags</div>';
    h += [...tagCount].sort((a, b) => a[0].localeCompare(b[0], 'de')).map(([g, n]) => item('tag', g, g, n, ' data-drop="1"')).join('') || '<div class="hint">Tags im Bereich rechts vergeben.</div>';
    $('#side').innerHTML = h;
  }

  function renderHead() {
    const plain = S.sort.f === 'pos';
    $('#thead').innerHTML = COLS.map(c => `<div class="th${S.sort.f === c.f ? ' on' : ''}" data-f="${c.f}">${c.f === 'pos' && !plain ? '' : esc(c.l)}${S.sort.f === c.f && c.f !== 'pos' ? (S.sort.d > 0 ? ' ▲' : ' ▼') : ''}</div>`).join('');
  }

  function cell(t, c, i) {
    switch (c.f) {
      case 'pos': return S.cur === t ? `<span class="now">${audio.paused ? '❙❙' : '▶'}</span>` : `<span class="mut">${i + 1}</span>`;
      case 'color': return t.color ? `<i class="dot" style="background:${t.color}"></i>` : '';
      case 'title': return `<span class="tt${isMissing(t) ? ' miss' : ''}">${esc(t.title)}</span>`;
      case 'bpm': return t.bpm ? (Math.round(t.bpm * 10) / 10).toLocaleString('de-DE') : '';
      case 'key': { const m = /^(\d+)([AB])$/.exec(t.key || ''); return m ? `<span class="key" style="--h:${(+m[1] * 30 + 200) % 360}">${esc(keyShow(t.key))}</span>` : ''; }
      case 'duration': return t.duration ? time(t.duration) : '';
      case 'rating': return `<span class="stars">${'★'.repeat(t.rating || 0)}<s>${'★'.repeat(5 - (t.rating || 0))}</s></span>`;
      case 'year': return t.year || '';
      case 'tags': return (t.tags || []).map(g => `<span class="tag">${esc(g)}</span>`).join('');
      case 'added': return date(t.added);
      default: return esc(t[c.f]);
    }
  }
  function drawRows() {
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
      ${field('title', 'Titel')}${field('artist', 'Artist')}${field('album', 'Album')}${field('genre', 'Genre')}
      <div class="grid3">${field('bpm', 'BPM', 'number')}${field('key', 'Tonart')}${field('year', 'Jahr', 'number')}</div>
      <div class="field"><span class="lbl">Bewertung</span><div class="rate">${[1, 2, 3, 4, 5].map(n => `<button data-rate="${n}" class="${rating >= n ? 'on' : ''}">★</button>`).join('')}</div></div>
      <div class="field"><span class="lbl">Farbe</span><div class="swatches">${COLORS.map(c => `<button data-color="${c}" class="${color === c ? 'on' : ''}" style="--c:${c || 'transparent'}" title="${c ? '' : 'Keine'}"></button>`).join('')}</div></div>
      <div class="field"><span class="lbl">Tags</span><div class="tagbox">${tags.map(g => `<span class="tag">${esc(g)}<button data-untag="${esc(g)}" aria-label="Tag entfernen">×</button></span>`).join('')}<input id="tagIn" placeholder="Tag hinzufügen + Enter" list="tagList"><datalist id="tagList">${[...new Set([...S.tracks.values()].flatMap(x => x.tags || []))].map(g => `<option value="${esc(g)}">`).join('')}</datalist></div></div>
      <label class="field"><span class="lbl">Kommentar</span><textarea class="in" data-f="comment" rows="3" placeholder="${common('comment') === null ? '(verschiedene)' : ''}">${esc(common('comment') || '')}</textarea></label>
      ${multi ? '' : `<div class="meta"><div><span class="lbl">Datei</span><code>${esc(t.path)}</code></div><div><span class="lbl">Status</span>${isMissing(t) ? '<span class="warn">Datei nicht verbunden</span>' : 'Verbunden'} · ${t.analyzed ? 'analysiert' : 'nicht analysiert'} · ${nf(t.playCount || 0)}× gespielt</div></div>`}`;
  }

  /* ---------- Bearbeiten ---------- */
  async function edit(f, raw) {
    const sel = selected();
    if (!sel.length) return;
    let v = raw;
    if (f === 'bpm') v = Math.round((parseFloat(String(raw).replace(',', '.')) || 0) * 100) / 100;
    else if (f === 'year' || f === 'rating') v = parseInt(raw, 10) || 0;
    else if (f === 'key') { v = Keys.parse(raw); if (raw.trim() && !v) return toast('Tonart nicht erkannt. Beispiele: 8A, Am, F#m, C.', true); }
    else if (typeof v === 'string') v = v.trim();
    for (const t of sel) t[f] = v;
    await saveTracks(sel);
    dirty();
    if (sel.includes(S.cur)) renderDeck();
  }
  async function tagSel(name, addIt, tracks = selected()) {
    name = name.trim();
    if (!name || !tracks.length) return;
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
      const ids = new Set(sel.map(t => t.id));
      list.trackIds = list.trackIds.filter(id => !ids.has(id));
      await saveList(list);
    } else {
      if (!(await confirmBox('Aus Bibliothek entfernen', `${nf(sel.length)} Titel aus der Bibliothek entfernen? Die Audiodateien selbst bleiben unangetastet.`, 'Entfernen'))) return;
      const ids = sel.map(t => t.id), set = new Set(ids);
      for (const id of ids) { S.tracks.delete(id); S.files.delete(id); }
      for (const l of S.lists) if (l.trackIds && l.trackIds.some(id => set.has(id))) { l.trackIds = l.trackIds.filter(id => !set.has(id)); await saveList(l); }
      await DB.delMany('tracks', ids); await DB.delMany('waves', ids); await DB.delMany('handles', ids);
      if (S.cur && set.has(S.cur.id)) unload();
    }
    S.sel.clear();
    dirty();
  }

  async function addToList(list, tracks) {
    const have = new Set(list.trackIds);
    const fresh = tracks.filter(t => !have.has(t.id));
    list.trackIds.push(...fresh.map(t => t.id));
    await saveList(list);
    dirty();
    toast(fresh.length ? `${nf(fresh.length)} Titel zu „${list.name}“ hinzugefügt.` : 'Die Titel sind bereits in dieser Playlist.');
  }
  async function newList(tracks) {
    const f = await modal({ title: 'Neue Playlist', body: '<label class="field"><span class="lbl">Name</span><input class="in" name="name" required></label>', ok: 'Anlegen' });
    if (!f) return;
    const l = { id: uid(), type: 'list', name: f.name.value.trim() || 'Playlist', trackIds: (tracks || []).map(t => t.id) };
    S.lists.push(l);
    await saveList(l);
    tracks ? dirty() : setView({ type: 'list', id: l.id });
  }

  async function editSmart(list) {
    const l = list || { id: uid(), type: 'smart', name: '', rules: { match: 'all', conds: [{ field: 'genre', op: 'has', value: '' }] } };
    const row = c => `<div class="rule"><select class="in" data-k="field">${Object.entries(RULE_FIELDS).map(([k, v]) => `<option value="${k}"${c.field === k ? ' selected' : ''}>${v}</option>`).join('')}</select><select class="in" data-k="op">${Object.entries(RULE_OPS).map(([k, v]) => `<option value="${k}"${c.op === k ? ' selected' : ''}>${v}</option>`).join('')}</select><input class="in" data-k="value" value="${esc(c.value)}"><button type="button" class="btn ghost icon" data-delrule aria-label="Regel entfernen">${IC.x}</button></div>`;
    const f = await modal({
      title: list ? 'Smartlist bearbeiten' : 'Neue Smartlist', wide: true,
      body: `<label class="field"><span class="lbl">Name</span><input class="in" name="name" required value="${esc(l.name)}"></label>
        <label class="field"><span class="lbl">Titel aufnehmen, wenn</span><select class="in" name="match"><option value="all"${l.rules.match === 'all' ? ' selected' : ''}>alle Regeln zutreffen</option><option value="any"${l.rules.match === 'any' ? ' selected' : ''}>mindestens eine Regel zutrifft</option></select></label>
        <div id="rules">${l.rules.conds.map(row).join('')}</div><button type="button" class="btn" id="addRule">${IC.plus} Regel</button>`,
      onOpen: ov => ov.addEventListener('click', e => {
        if (e.target.closest('#addRule')) $('#rules', ov).insertAdjacentHTML('beforeend', row({ field: 'bpm', op: 'gt', value: '' }));
        const d = e.target.closest('[data-delrule]'); if (d) d.parentElement.remove();
      })
    });
    if (!f) return;
    l.name = f.name.value.trim() || 'Smartlist';
    l.rules = { match: f.match.value, conds: $$('.rule', f).map(r => ({ field: $('[data-k=field]', r).value, op: $('[data-k=op]', r).value, value: $('[data-k=value]', r).value.trim() })).filter(c => c.value !== '') };
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
    for (const t of sel) { const v = String(t[k] || ''); const w = v.split(a).join(b).trim(); if (w !== v) { t[k] = w; n++; } }
    await saveTracks(sel);
    dirty();
    toast(`${nf(n)} Titel geändert.`);
  }
  async function fromFileName() {
    const sel = selected();
    if (!sel.length) return toast('Zuerst Titel auswählen.', true);
    for (const t of sel) { const p = Tags.fromName(fileName(t)); t.title = p.title; if (p.artist) t.artist = p.artist; }
    await saveTracks(sel);
    dirty();
    toast(`${nf(sel.length)} Titel aus dem Dateinamen benannt.`);
  }

  /* ---------- Deck ---------- */
  function renderDeck() {
    const t = S.cur, el = $('#deck');
    if (!t) { el.innerHTML = '<div class="deckempty mut">Kein Titel geladen – Doppelklick auf einen Titel lädt ihn hier ins Deck.</div>'; return; }
    el.innerHTML = `
      <button class="btn primary icon big" id="pp" aria-label="Wiedergabe / Pause">${audio.paused ? IC.play : IC.pause}</button>
      <div class="dinfo"><div class="dt">${esc(t.title)}</div><div class="da">${esc(t.artist)}</div>
        <div class="dm"><span id="dtime">0:00</span> / ${time(t.duration)}${t.bpm ? ` · <b>${(Math.round(t.bpm * 10) / 10).toLocaleString('de-DE')}</b> BPM` : ''}${t.key ? ` · <b>${esc(keyShow(t.key))}</b>` : ''}</div></div>
      <div class="dwave"><canvas id="wave"></canvas></div>
      <div class="dside"><div class="cues">${[0, 1, 2, 3, 4, 5, 6, 7].map(n => { const c = (t.cues || []).find(x => x.n === n); return `<button class="cue${c ? ' set' : ''}" data-cue="${n}" style="--c:${CUE_COLORS[n]}" title="${c ? 'Springen zu ' + time(c.t) + ' · Rechtsklick löscht' : 'Cue an aktueller Position setzen'}">${n + 1}</button>`; }).join('')}</div>
        <div class="row"><button class="btn sm" id="bMatch" ${t.key ? '' : 'disabled'}>Passende Titel</button><input type="range" id="vol" min="0" max="1" step="0.01" value="${S.settings.volume}" aria-label="Lautstärke"></div></div>`;
    drawWave();
  }

  function drawWave() {
    const cv = $('#wave'), t = S.cur;
    if (!cv || !t) return;
    const w = cv.clientWidth, h = cv.clientHeight, dpr = devicePixelRatio || 1;
    if (!w) return;
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    const dur = t.duration || audio.duration || 0, pos = dur ? audio.currentTime / dur : 0, mid = h / 2;
    const wave = S.curWave;
    if (wave) {
      for (let x = 0; x < w; x++) {
        const v = wave[Math.min(wave.length - 1, Math.floor(x / w * wave.length))] / 255;
        g.fillStyle = x / w < pos ? '#B79A6B' : 'rgba(244,240,232,.42)';
        g.fillRect(x, mid - v * (mid - 3), 1, Math.max(1, v * (h - 6)));
      }
    } else {
      g.fillStyle = 'rgba(244,240,232,.18)'; g.fillRect(0, mid, w, 1);
      g.fillStyle = '#B79A6B'; g.fillRect(0, mid, w * pos, 1);
      g.fillStyle = '#B9B5AD'; g.font = '12px "Fira Sans", sans-serif'; g.textAlign = 'center';
      g.fillText('Noch keine Wellenform – Titel analysieren', w / 2, mid - 10);
    }
    if (dur && t.bpm) { // Taktstriche alle 16 Beats
      g.fillStyle = 'rgba(244,240,232,.16)';
      const step = 60 / t.bpm * 16;
      for (let s = t.gridStart || 0; s < dur; s += step) g.fillRect(Math.round(s / dur * w), 0, 1, h);
    }
    if (dur) for (const c of t.cues || []) {
      const x = Math.round(c.t / dur * w);
      g.fillStyle = CUE_COLORS[c.n]; g.fillRect(x, 0, 2, h);
      g.fillRect(x, 0, 13, 13);
      g.fillStyle = '#111315'; g.font = '600 10px "Fira Sans", sans-serif'; g.textAlign = 'center'; g.fillText(c.n + 1, x + 7, 10);
    }
    g.fillStyle = '#F4F0E8'; g.fillRect(Math.round(pos * w), 0, 1.5, h);
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
    audioUrl = URL.createObjectURL(f);
    S.cur = t; S.curCounted = false;
    S.curWave = await DB.get('waves', t.id) || null;
    audio.src = audioUrl;
    audio.volume = S.settings.volume;
    renderDeck(); drawRows();
    if (autoplay) audio.play().catch(() => {});
  }
  function unload() { audio.pause(); audio.removeAttribute('src'); S.cur = null; S.curWave = null; renderDeck(); drawRows(); }
  const toggle = () => { if (S.cur) audio.paused ? audio.play().catch(() => {}) : audio.pause(); };

  async function cue(n, remove) {
    const t = S.cur;
    if (!t) return;
    t.cues = t.cues || [];
    const c = t.cues.find(x => x.n === n);
    if (remove) { if (!c) return; t.cues = t.cues.filter(x => x.n !== n); }
    else if (c) { audio.currentTime = c.t; return drawWave(); }
    else {
      let pos = audio.currentTime;
      if (S.settings.quantize && t.bpm) { const b = 60 / t.bpm; pos = Math.max(0, Math.round((pos - (t.gridStart || 0)) / b) * b + (t.gridStart || 0)); }
      t.cues.push({ n, t: Math.round(pos * 1000) / 1000, name: '' });
      t.cues.sort((a, b) => a.n - b.n);
    }
    await DB.put('tracks', t);
    renderDeck();
  }

  /* ---------- Import / Export ---------- */
  async function importData(file) {
    const text = await file.text();
    try {
      if (/\.json$/i.test(file.name)) return await restore(JSON.parse(text));
      const data = Formats.parse(text, file.name);
      const byPath = new Map(), byName = new Map();
      for (const t of S.tracks.values()) { byPath.set(t.path.toLowerCase(), t); byName.set(fileName(t).toLowerCase() + '|' + (t.size || 0), t); }
      const changed = [], ids = [];
      let added = 0, merged = 0;
      for (const d of data.tracks) {
        const name = d.path.replace(/\\/g, '/').split('/').pop().toLowerCase();
        let t = byPath.get(d.path.toLowerCase()) || (d.size ? byName.get(name + '|' + d.size) : null);
        if (t) {
          for (const k of ['title', 'artist', 'album', 'genre', 'comment', 'key']) if (!t[k] && d[k]) t[k] = d[k];
          for (const k of ['bpm', 'year', 'rating', 'duration', 'gridStart']) if (!t[k] && d[k]) t[k] = d[k];
          if (!(t.cues || []).length && d.cues.length) t.cues = d.cues;
          merged++;
        } else {
          t = { id: uid(), title: '', artist: '', album: '', genre: '', year: 0, comment: '', bpm: 0, key: '', duration: 0, rating: 0, color: '', tags: [], cues: [], gridStart: 0, size: 0, added: Date.now(), playCount: 0, analyzed: false, ...d };
          S.tracks.set(t.id, t); byPath.set(t.path.toLowerCase(), t);
          added++;
        }
        changed.push(t); ids.push(t.id);
      }
      await saveTracks(changed);
      for (const l of data.lists) {
        let nl = S.lists.find(x => x.type === 'list' && x.name === l.name);
        if (nl) nl.trackIds = [...new Set([...nl.trackIds, ...l.refs.map(i => ids[i])])];
        else { nl = { id: uid(), type: 'list', name: l.name, trackIds: [...new Set(l.refs.map(i => ids[i]))] }; S.lists.push(nl); }
        await saveList(nl);
      }
      dirty();
      toast(`${data.kind}: ${nf(added)} neue Titel, ${nf(merged)} ergänzt, ${nf(data.lists.length)} Playlists.`);
      if (added) toast('Zum Abspielen und Analysieren den Musikordner über „Musik hinzufügen“ wählen – die Dateien werden automatisch zugeordnet.');
    } catch (e) { toast(e.message || 'Import fehlgeschlagen.', true); }
  }

  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode(...u8.subarray(i, i + 8192)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function backup() {
    const waves = {};
    for (const [id, w] of await DB.entries('waves')) waves[id] = b64(w);
    download(`one-library-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'one-library', version: 1, created: new Date().toISOString(), settings: S.settings, tracks: [...S.tracks.values()], lists: S.lists, waves }), 'application/json');
  }
  async function restore(data) {
    if (!data || data.app !== 'one-library' || !Array.isArray(data.tracks)) throw new Error('Das ist kein ONE-Library-Backup.');
    if (!(await confirmBox('Backup einspielen', `Die aktuelle Bibliothek (${nf(S.tracks.size)} Titel) wird durch das Backup (${nf(data.tracks.length)} Titel) ersetzt.`, 'Ersetzen'))) return;
    for (const s of ['tracks', 'lists', 'waves']) await DB.clear(s);
    await saveTracks(data.tracks);
    await DB.putMany('lists', data.lists || []);
    for (const [id, w] of Object.entries(data.waves || {})) await DB.put('waves', unb64(w), id);
    S.settings = { ...S.settings, ...(data.settings || {}) };
    await saveSettings();
    S.tracks = new Map(data.tracks.map(t => [t.id, t])); S.lists = data.lists || [];
    unload();
    setView({ type: 'all' });
    toast('Backup eingespielt.');
  }

  async function exportDialog() {
    const f = await modal({ title: 'Exportieren', ok: 'Exportieren',
      body: `<label class="field"><span class="lbl">Format</span><select class="in" name="fmt">
          <option value="rb">Rekordbox XML – ganze Bibliothek mit Playlists</option><option value="nml">Traktor NML – ganze Bibliothek mit Playlists</option>
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
      case 'm3u': return download(`one-library-${stamp}.m3u8`, Formats.m3uExport(S.rows, absPath), 'audio/x-mpegurl');
      case 'csv': return download(`one-library-${stamp}.csv`, Formats.csvExport(S.rows, S.settings.keyMode), 'text/csv');
      default: return backup();
    }
  }

  async function settingsDialog() {
    const f = await modal({ title: 'Einstellungen',
      body: `<label class="field"><span class="lbl">Tonart-Anzeige</span><select class="in" name="keyMode"><option value="camelot">Quintenzirkel-Nummern (8A, 8B …)</option><option value="musical"${S.settings.keyMode === 'musical' ? ' selected' : ''}>Musikalisch (Am, C …)</option></select></label>
        <label class="tog"><input type="checkbox" name="quantize"${S.settings.quantize ? ' checked' : ''}><span class="sw"></span><span><span class="tl">Cues am Beatraster einrasten</span><small>Neue Cue-Punkte springen auf den nächsten Beat, sobald der Titel analysiert ist.</small></span></label>
        <label class="field"><span class="lbl">Musikordner auf diesem Rechner (für Exporte)</span><input class="in" name="base" value="${esc(S.settings.basePath)}" placeholder="/Users/name/Music/"></label>
        <div class="field"><span class="lbl">Verbundene Ordner</span>${S.roots.map(r => `<div class="mut">${esc(r.name)}</div>`).join('') || '<div class="mut">Noch keine.</div>'}</div>` });
    if (!f) return;
    S.settings.keyMode = f.keyMode.value; S.settings.quantize = f.quantize.checked; S.settings.basePath = f.base.value.trim();
    await saveSettings();
    refresh(); renderDeck();
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
      ...S.lists.filter(l => l.type === 'list').map(l => ({ l: l.name, fn: () => addToList(l, sel) })),
      { l: 'Neue Playlist aus Auswahl …', fn: () => newList(sel) },
      null,
      { l: inList ? 'Aus Playlist entfernen' : 'Aus Bibliothek entfernen …', fn: removeSelected }
    ]);
  }
  function listMenu(e, l) {
    menu(e.clientX, e.clientY, [
      l.type === 'smart' ? { l: 'Regeln bearbeiten …', fn: () => editSmart(l) } : { l: 'Umbenennen …', fn: async () => {
        const f = await modal({ title: 'Playlist umbenennen', body: `<label class="field"><span class="lbl">Name</span><input class="in" name="name" required value="${esc(l.name)}"></label>` });
        if (f) { l.name = f.name.value.trim() || l.name; await saveList(l); refresh(); }
      } },
      { l: 'Löschen …', fn: async () => {
        if (!(await confirmBox('Liste löschen', `„${l.name}“ löschen? Die Titel bleiben in der Bibliothek.`))) return;
        S.lists = S.lists.filter(x => x !== l);
        await DB.del('lists', l.id);
        setView({ type: 'all' });
      } }
    ]);
  }

  function bind() {
    const body = $('#tbody');
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

    $('#thead').addEventListener('click', e => {
      const th = e.target.closest('.th'); if (!th) return;
      const f = th.dataset.f;
      if (f === 'color') return;
      if (f === 'pos') { if ((S.lists.find(l => l.id === S.view.id) || {}).type !== 'list' || S.view.type !== 'list') return; S.sort = { f: 'pos', d: 1 }; }
      else S.sort = { f, d: S.sort.f === f ? -S.sort.d : (['rating', 'added', 'bpm'].includes(f) ? -1 : 1) };
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
        { l: 'Suchen & Ersetzen …', fn: findReplace }, { l: 'Titel/Artist aus Dateiname', fn: fromFileName }, null,
        { l: 'Dateien prüfen (fehlende finden)', fn: checkFiles }, { l: 'Duplikate anzeigen', fn: () => setView({ type: 'dupes' }) }
      ]);
      e.stopPropagation();
    });
    $('#bIO').addEventListener('click', e => {
      const r = e.currentTarget.getBoundingClientRect();
      menu(r.left, r.bottom + 4, [{ l: 'Importieren (Rekordbox XML, Traktor NML, M3U, Backup) …', fn: () => $('#pickImport').click() }, { l: 'Exportieren …', fn: exportDialog }, null, { l: 'Backup jetzt speichern', fn: backup }]);
      e.stopPropagation();
    });
    $('#bSet').addEventListener('click', settingsDialog);
    $('#bStop').addEventListener('click', () => { if (S.busy) S.busy.stop = true; });
    $('#pickFiles').addEventListener('change', e => { addItems(itemsFromFiles(e.target.files)); e.target.value = ''; });
    $('#pickDir').addEventListener('change', e => { addItems(itemsFromFiles(e.target.files)); e.target.value = ''; });
    $('#pickImport').addEventListener('change', e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; });

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
      if (e.target.id === 'wave' && S.cur) {
        const r = e.target.getBoundingClientRect(), dur = S.cur.duration || audio.duration;
        if (dur) { audio.currentTime = (e.clientX - r.left) / r.width * dur; drawWave(); }
      }
    });
    deck.addEventListener('contextmenu', e => { const c = e.target.closest('[data-cue]'); if (c) { e.preventDefault(); cue(+c.dataset.cue, true); } });
    deck.addEventListener('input', e => { if (e.target.id === 'vol') { audio.volume = S.settings.volume = +e.target.value; saveSettings(); } });

    audio.addEventListener('timeupdate', () => {
      const el = $('#dtime'); if (el) el.textContent = time(audio.currentTime);
      drawWave();
      const t = S.cur;
      if (t && !S.curCounted && audio.currentTime > 30) { S.curCounted = true; t.playCount = (t.playCount || 0) + 1; DB.put('tracks', t); }
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
      if (e.key === 'Escape') return closeMenu();
      if (e.code === 'Space') { e.preventDefault(); return toggle(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); S.sel = new Set(S.rows.map(t => t.id)); drawRows(); renderInspector(); return renderCount(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); return moveSel(e.key === 'ArrowDown' ? 1 : -1, e.shiftKey); }
      if (e.key === 'Enter') { const t = selected()[0]; if (t) load(t); return; }
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
      const one = [...dt.files].find(f => /\.(xml|nml|m3u8?|json)$/i.test(f.name));
      if (one) return importData(one);
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
    shell();
    try {
      await DB.open();
      const [tracks, lists, settings, roots, handles] = await Promise.all([DB.all('tracks'), DB.all('lists'), DB.get('meta', 'settings'), DB.get('meta', 'roots'), DB.entries('handles')]);
      S.tracks = new Map(tracks.map(t => [t.id, t]));
      S.lists = lists;
      S.settings = { ...S.settings, ...(settings || {}) };
      S.roots = roots || [];
      for (const [id, h] of handles) S.files.set(id, h);
    } catch (e) { toast('Der lokale Speicher des Browsers ist nicht verfügbar – Änderungen gehen beim Schließen verloren.', true); }
    bind();
    fitCols();
    renderDeck();
    refresh();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  }
  start();
})();
