'use strict';
/* Tonart-Schreibweisen und Austauschformate (Rekordbox, Traktor, Serato, VirtualDJ, M3U8, CSV). */
const Keys = (() => {
  const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // Intern wird die Tonart als Quintenzirkel-Position gespeichert: "8A" = a-Moll, "8B" = C-Dur
  const fromPc = (pc, minor) => {
    const rel = minor ? (pc + 3) % 12 : pc;
    return (((rel * 7) % 12 + 7) % 12 + 1) + (minor ? 'A' : 'B');
  };
  const toPc = code => {
    const m = /^(\d{1,2})([AB])$/.exec(code || '');
    if (!m) return null;
    const rel = (((+m[1] - 8 + 12) % 12) * 7) % 12, minor = m[2] === 'A';
    return { pc: minor ? (rel + 9) % 12 : rel, minor };
  };

  function parse(str) {
    const s = String(str || '').trim();
    if (!s) return '';
    let m = /^(\d{1,2})\s*([ABab])$/.exec(s);
    if (m && +m[1] >= 1 && +m[1] <= 12) return +m[1] + m[2].toUpperCase();
    m = /^(\d{1,2})\s*([md])$/.exec(s); // Open Key
    if (m && +m[1] >= 1 && +m[1] <= 12) return ((+m[1] + 6) % 12 + 1) + (m[2] === 'm' ? 'A' : 'B');
    m = /^([A-Ga-g])\s*([#b♯♭]?)\s*(m|min|minor|moll|maj|major|dur)?$/i.exec(s);
    if (m) {
      let pc = LETTER[m[1].toUpperCase()];
      if (m[2] === '#' || m[2] === '♯') pc++;
      if (m[2] === 'b' || m[2] === '♭') pc--;
      return fromPc((pc + 12) % 12, /^(m|min|minor|moll)$/i.test(m[3] || ''));
    }
    return '';
  }

  function show(code, mode) {
    if (!code) return '';
    if (mode !== 'musical') return code;
    const k = toPc(code);
    return k ? NAMES[k.pc] + (k.minor ? 'm' : '') : code;
  }
  const musical = code => show(code, 'musical');
  const openKey = code => {
    const m = /^(\d{1,2})([AB])$/.exec(code || '');
    return m ? ((+m[1] + 4) % 12 + 1) + (m[2] === 'A' ? 'm' : 'd') : '';
  };
  const sortVal = code => {
    const m = /^(\d{1,2})([AB])$/.exec(code || '');
    return m ? +m[1] * 2 + (m[2] === 'B' ? 1 : 0) : 99;
  };
  /* Harmonisch passend: gleiche Position, Nachbarn im Quintenzirkel, Dur/Moll-Parallele */
  function compatible(a, b) {
    const x = /^(\d{1,2})([AB])$/.exec(a || ''), y = /^(\d{1,2})([AB])$/.exec(b || '');
    if (!x || !y) return false;
    const d = (+x[1] - +y[1] + 12) % 12;
    return x[2] === y[2] ? d === 0 || d === 1 || d === 11 : d === 0;
  }
  return { fromPc, toPc, parse, show, musical, openKey, sortVal, compatible };
})();

const Formats = (() => {
  const attr = v => String(v == null ? '' : v).replace(/[&<>"\n\r\t]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\n': '&#10;', '\r': '&#13;', '\t': '&#9;' }[c]));
  const day = ms => new Date(ms || Date.now()).toISOString().slice(0, 10);
  const KIND = { mp3: 'MP3 File', m4a: 'M4A File', aac: 'M4A File', mp4: 'M4A File', flac: 'FLAC File', wav: 'WAV File', aif: 'AIFF File', aiff: 'AIFF File' };
  const ext = p => (/\.([a-z0-9]+)$/i.exec(p || '') || [, ''])[1].toLowerCase();
  /* Cue übernehmen: Hot Cues 0–7 je einmal, alles andere als Memory-Cue (n = -1); len = Loop-Länge in Sekunden */
  const addCue = (t, n, pos, name, len, color) => {
    n = n >= 0 && n < 8 ? n : -1;
    if (n >= 0 && t.cues.some(x => x.n === n)) return;
    const c = { n, t: Math.round(pos * 1000) / 1000, name: name || '' };
    if (len > 0) c.len = Math.round(len * 1000) / 1000;
    if (color) c.color = color;
    t.cues.push(c);
    t.cues.sort((a, b) => a.t - b.t);
  };
  const parseXml = text => {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Datei ist kein gültiges XML.');
    return doc;
  };

  /* ---------- Rekordbox XML ---------- */
  function rekordboxExport(tracks, lists, abs) {
    const num = new Map();
    const out = ['<?xml version="1.0" encoding="UTF-8"?>', '<DJ_PLAYLISTS Version="1.0.0">',
      '  <PRODUCT Name="ONE Library" Version="1.0" Company="DJ KOLJA ONE"/>', `  <COLLECTION Entries="${tracks.length}">`];
    tracks.forEach((t, i) => {
      num.set(t.id, i + 1);
      const p = abs(t).replace(/\\/g, '/');
      const loc = 'file://localhost' + (p.startsWith('/') ? '' : '/') + p.split('/').map(encodeURIComponent).join('/').replace(/%3A/g, ':');
      out.push(`    <TRACK TrackID="${i + 1}" Name="${attr(t.title)}" Artist="${attr(t.artist)}" Album="${attr(t.album)}" Genre="${attr(t.genre)}" Kind="${KIND[ext(t.path)] || 'MP3 File'}" Size="${t.size || 0}" TotalTime="${Math.round(t.duration || 0)}" Year="${t.year || 0}" AverageBpm="${(t.bpm || 0).toFixed(2)}" DateAdded="${day(t.added)}" Comments="${attr(t.comment)}" PlayCount="${t.playCount || 0}" Rating="${(t.rating || 0) * 51}" Location="${attr(loc)}" Tonality="${attr(Keys.musical(t.key))}">`);
      if (t.bpm) out.push(`      <TEMPO Inizio="${(t.gridStart || 0).toFixed(3)}" Bpm="${t.bpm.toFixed(2)}" Metro="4/4" Battito="1"/>`);
      if (t.bpm) for (const x of t.tempos || []) out.push(`      <TEMPO Inizio="${x.t.toFixed(3)}" Bpm="${x.bpm.toFixed(2)}" Metro="4/4" Battito="1"/>`);
      for (const c of t.cues || []) {
        const rgb = c.n >= 0 && /^#[0-9a-f]{6}$/i.test(c.color || '') ? ` Red="${parseInt(c.color.slice(1, 3), 16)}" Green="${parseInt(c.color.slice(3, 5), 16)}" Blue="${parseInt(c.color.slice(5, 7), 16)}"` : '';
        out.push(`      <POSITION_MARK Name="${attr(c.name)}" Type="${c.len ? 4 : 0}" Start="${c.t.toFixed(3)}"${c.len ? ` End="${(c.t + c.len).toFixed(3)}"` : ''} Num="${c.n}"${rgb}/>`);
      }
      out.push('    </TRACK>');
    });
    out.push('  </COLLECTION>', '  <PLAYLISTS>', `    <NODE Type="0" Name="ROOT" Count="${lists.length}">`);
    for (const l of lists) {
      const ids = l.trackIds.filter(id => num.has(id));
      out.push(`      <NODE Name="${attr(l.name)}" Type="1" KeyType="0" Entries="${ids.length}">`);
      for (const id of ids) out.push(`        <TRACK Key="${num.get(id)}"/>`);
      out.push('      </NODE>');
    }
    out.push('    </NODE>', '  </PLAYLISTS>', '</DJ_PLAYLISTS>');
    return out.join('\n');
  }

  function rekordboxImport(doc) {
    const tracks = [], byId = new Map(), lists = [];
    for (const e of doc.querySelectorAll('COLLECTION > TRACK')) {
      const a = n => e.getAttribute(n) || '';
      let path = a('Location').replace(/^file:\/\/localhost/, '');
      try { path = decodeURIComponent(path); } catch { /* unverändert übernehmen */ }
      if (/^\/[A-Za-z]:\//.test(path)) path = path.slice(1);
      const tempo = e.querySelector('TEMPO');
      const t = { title: a('Name'), artist: a('Artist'), album: a('Album'), genre: a('Genre'), year: +a('Year') || 0, bpm: Math.round((+a('AverageBpm') || 0) * 100) / 100,
        key: Keys.parse(a('Tonality')), duration: +a('TotalTime') || 0, rating: Math.round((+a('Rating') || 0) / 51), comment: a('Comments'), path, size: +a('Size') || 0,
        playCount: +a('PlayCount') || 0, gridStart: tempo ? +tempo.getAttribute('Inizio') || 0 : 0, cues: [] };
      // Tempowechsel: nur echte Änderungen übernehmen (dynamische Raster bestehen sonst aus Hunderten Einträgen)
      const temps = [...e.querySelectorAll('TEMPO')].map(x => ({ t: +x.getAttribute('Inizio') || 0, bpm: Math.round((+x.getAttribute('Bpm') || 0) * 100) / 100 })).filter(x => x.bpm > 0);
      const changes = temps.filter((x, i) => i > 0 && Math.abs(x.bpm - temps[i - 1].bpm) > 0.01);
      if (changes.length && changes.length <= 64) { t.bpm = temps[0].bpm; t.tempos = changes; }
      for (const c of e.querySelectorAll('POSITION_MARK')) {
        const start = +c.getAttribute('Start') || 0, end = +c.getAttribute('End') || 0, r = c.getAttribute('Red');
        const hex = r === null ? '' : '#' + [r, c.getAttribute('Green'), c.getAttribute('Blue')].map(v => (+v || 0).toString(16).padStart(2, '0')).join('');
        addCue(t, +c.getAttribute('Num'), start, c.getAttribute('Name'), end > start ? end - start : 0, hex);
      }
      byId.set(a('TrackID'), tracks.length);
      tracks.push(t);
    }
    const walk = (node, prefix) => {
      for (const n of node.children) {
        if (n.tagName !== 'NODE') continue;
        const name = n.getAttribute('Name') || 'Playlist';
        if (n.getAttribute('Type') === '1') {
          const refs = [...n.children].filter(c => c.tagName === 'TRACK').map(c => byId.get(c.getAttribute('Key'))).filter(i => i !== undefined);
          lists.push({ name: prefix + name, refs });
        } else walk(n, name === 'ROOT' ? prefix : prefix + name + ' / ');
      }
    };
    const root = doc.querySelector('PLAYLISTS');
    if (root) walk(root, '');
    return { kind: 'Rekordbox XML', full: true, tracks, lists };
  }

  /* ---------- Traktor NML ---------- */
  function traktorLoc(path) {
    const p = path.replace(/\\/g, '/');
    const m = /^([A-Za-z]:)(\/.*)$/.exec(p);
    const volume = m ? m[1] : 'Macintosh HD', rest = m ? m[2] : (p.startsWith('/') ? p : '/' + p);
    const i = rest.lastIndexOf('/');
    return { volume, dir: rest.slice(0, i + 1).replace(/\//g, '/:'), file: rest.slice(i + 1) };
  }

  function traktorExport(tracks, lists, abs) {
    const keyOf = new Map();
    const out = ['<?xml version="1.0" encoding="UTF-8" standalone="no" ?>', '<NML VERSION="19">', '  <HEAD COMPANY="DJ KOLJA ONE" PROGRAM="ONE Library"/>', `  <COLLECTION ENTRIES="${tracks.length}">`];
    for (const t of tracks) {
      const l = traktorLoc(abs(t));
      keyOf.set(t.id, l.volume + l.dir + l.file);
      const k = Keys.toPc(t.key);
      out.push(`    <ENTRY TITLE="${attr(t.title)}" ARTIST="${attr(t.artist)}">`,
        `      <LOCATION DIR="${attr(l.dir)}" FILE="${attr(l.file)}" VOLUME="${attr(l.volume)}" VOLUMEID="${attr(l.volume)}"/>`,
        `      <ALBUM TITLE="${attr(t.album)}"/>`,
        `      <INFO GENRE="${attr(t.genre)}" COMMENT="${attr(t.comment)}" KEY="${Keys.openKey(t.key)}" PLAYCOUNT="${t.playCount || 0}" PLAYTIME="${Math.round(t.duration || 0)}" RANKING="${(t.rating || 0) * 51}" IMPORT_DATE="${day(t.added).replace(/-/g, '/')}"${t.year ? ` RELEASE_DATE="${t.year}/1/1"` : ''}/>`);
      if (t.bpm) out.push(`      <TEMPO BPM="${t.bpm.toFixed(6)}" BPM_QUALITY="100.000000"/>`);
      if (k) out.push(`      <MUSICAL_KEY VALUE="${k.pc + (k.minor ? 12 : 0)}"/>`);
      if (t.bpm) out.push(`      <CUE_V2 NAME="AutoGrid" DISPL_ORDER="0" TYPE="4" START="${((t.gridStart || 0) * 1000).toFixed(6)}" LEN="0.000000" REPEATS="-1" HOTCUE="-1"/>`);
      for (const c of t.cues || []) out.push(`      <CUE_V2 NAME="${attr(c.name || (c.n >= 0 ? 'Cue ' + (c.n + 1) : 'Cue'))}" DISPL_ORDER="0" TYPE="${c.len ? 5 : 0}" START="${(c.t * 1000).toFixed(6)}" LEN="${((c.len || 0) * 1000).toFixed(6)}" REPEATS="-1" HOTCUE="${c.n}"/>`);
      out.push('    </ENTRY>');
    }
    out.push('  </COLLECTION>', '  <PLAYLISTS>', '    <NODE TYPE="FOLDER" NAME="$ROOT">', `      <SUBNODES COUNT="${lists.length}">`);
    for (const l of lists) {
      const ids = l.trackIds.filter(id => keyOf.has(id));
      out.push(`        <NODE TYPE="PLAYLIST" NAME="${attr(l.name)}">`, `          <PLAYLIST ENTRIES="${ids.length}" TYPE="LIST" UUID="${attr(l.id)}">`);
      for (const id of ids) out.push('            <ENTRY>', `              <PRIMARYKEY TYPE="TRACK" KEY="${attr(keyOf.get(id))}"/>`, '            </ENTRY>');
      out.push('          </PLAYLIST>', '        </NODE>');
    }
    out.push('      </SUBNODES>', '    </NODE>', '  </PLAYLISTS>', '</NML>');
    return out.join('\n');
  }

  function traktorImport(doc) {
    const tracks = [], byKey = new Map(), lists = [];
    for (const e of doc.querySelectorAll('COLLECTION > ENTRY')) {
      const loc = e.querySelector('LOCATION'), info = e.querySelector('INFO'), tempo = e.querySelector('TEMPO'), mk = e.querySelector('MUSICAL_KEY'), album = e.querySelector('ALBUM');
      if (!loc) continue;
      const g = (el, n) => (el && el.getAttribute(n)) || '';
      const vol = g(loc, 'VOLUME'), dir = g(loc, 'DIR'), file = g(loc, 'FILE');
      const mkv = mk ? +mk.getAttribute('VALUE') : NaN;
      const t = { title: e.getAttribute('TITLE') || Tags.fromName(file).title, artist: e.getAttribute('ARTIST') || '', album: g(album, 'TITLE'), genre: g(info, 'GENRE'), comment: g(info, 'COMMENT'),
        year: +(/\d{4}/.exec(g(info, 'RELEASE_DATE')) || [0])[0], bpm: Math.round((+g(tempo, 'BPM') || 0) * 100) / 100,
        key: mkv >= 0 && mkv < 24 ? Keys.fromPc(mkv % 12, mkv >= 12) : Keys.parse(g(info, 'KEY')), duration: +g(info, 'PLAYTIME') || 0, rating: Math.round((+g(info, 'RANKING') || 0) / 51),
        playCount: +g(info, 'PLAYCOUNT') || 0, path: (/^[A-Za-z]:$/.test(vol) ? vol : '') + dir.replace(/\/:/g, '/') + file, volume: vol, size: 0, gridStart: 0, cues: [] };
      for (const c of e.querySelectorAll('CUE_V2')) {
        const type = c.getAttribute('TYPE'), n = +c.getAttribute('HOTCUE'), start = (+c.getAttribute('START') || 0) / 1000;
        if (type === '4') t.gridStart = start;
        else addCue(t, n, start, c.getAttribute('NAME'), type === '5' ? (+c.getAttribute('LEN') || 0) / 1000 : 0);
      }
      if (t.bpm && t.gridStart) t.gridStart %= 60 / t.bpm;
      byKey.set(vol + dir + file, tracks.length);
      tracks.push(t);
    }
    for (const n of doc.querySelectorAll('PLAYLISTS NODE[TYPE="PLAYLIST"]')) {
      if (/^_/.test(n.getAttribute('NAME') || '')) continue; // interne Listen (_LOOPS, _RECORDINGS)
      const refs = [...n.querySelectorAll('PRIMARYKEY')].map(k => byKey.get(k.getAttribute('KEY'))).filter(i => i !== undefined);
      lists.push({ name: n.getAttribute('NAME') || 'Playlist', refs });
    }
    return { kind: 'Traktor NML', full: true, tracks, lists };
  }

  /* ---------- M3U8 / CSV ---------- */
  function m3uExport(tracks, abs) {
    const out = ['#EXTM3U'];
    for (const t of tracks) out.push(`#EXTINF:${Math.round(t.duration || 0)},${t.artist ? t.artist + ' - ' : ''}${t.title}`, abs(t));
    return out.join('\n') + '\n';
  }

  /* Verlaufsdateien am Namen erkennen (z. B. „HISTORY 2026-05-01.m3u8“): Liste unter „Verlauf / …“, Titel gelten als an diesem Tag gespielt */
  function asHistory(d, name) {
    if (!/history|verlauf/i.test(name)) return d;
    const m = /(\d{4})[-_.\/](\d\d)[-_.\/](\d\d)/.exec(name);
    d.played = m ? Date.parse(`${m[1]}-${m[2]}-${m[3]}T12:00:00`) || 0 : 0;
    d.lists = d.lists.map(l => ({ ...l, name: 'Verlauf / ' + l.name }));
    return d;
  }

  /* rekordbox: als Textdatei exportierte Playlist oder Verlaufsliste (Tabulator-getrennt, Spalten je nach Ansicht).
     Ohne Spalte „Location“ werden die Titel über Artist und Titel zugeordnet. Nicht mit rekordbox gegengeprüft. */
  function rekordboxTxt(text, name) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const head = (lines.shift() || '').split('\t').map(h => h.trim().toLowerCase());
    const col = (...names) => head.findIndex(h => names.includes(h));
    const c = { title: col('track title', 'titel', 'track-titel', 'title'), artist: col('artist', 'interpret', 'künstler'), album: col('album'), genre: col('genre'), bpm: col('bpm'),
      key: col('key', 'tonart'), time: col('time', 'zeit', 'dauer'), path: col('location', 'speicherort', 'ort') };
    if (c.title < 0) throw new Error(`„${name}“: Format nicht erkannt. Unterstützt: Rekordbox XML, Traktor NML, Serato (database V2, .crate), VirtualDJ (database.xml, .vdjfolder), M3U/M3U8, ONE-Backup (JSON).`);
    const tracks = lines.map(l => {
      const f = l.split('\t'), g = i => (i >= 0 && f[i] ? f[i].trim() : ''), tm = /^(\d+):(\d\d)$/.exec(g(c.time));
      return { title: g(c.title), artist: g(c.artist), album: g(c.album), genre: g(c.genre), bpm: Math.round((parseFloat(g(c.bpm).replace(',', '.')) || 0) * 100) / 100, key: Keys.parse(g(c.key)),
        duration: tm ? +tm[1] * 60 + +tm[2] : 0, path: g(c.path).replace(/\\/g, '/'), size: 0, cues: [] };
    }).filter(t => t.title);
    return asHistory({ kind: 'rekordbox-Liste', tracks, lists: [{ name: name.replace(/\.[^.]+$/, ''), refs: tracks.map((_, i) => i) }] }, name);
  }

  function m3uImport(text, name) {
    const tracks = [];
    let info = null;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith('#EXTINF:')) {
        const m = /^#EXTINF:(-?\d+)[^,]*,(.*)$/.exec(line);
        if (m) info = { duration: Math.max(0, +m[1]), ...Tags.fromName(m[2] + '.x') };
      } else if (!line.startsWith('#')) {
        const file = line.replace(/\\/g, '/').split('/').pop();
        tracks.push({ ...Tags.fromName(file), duration: 0, ...(info || {}), path: line.replace(/\\/g, '/'), size: 0, cues: [] });
        info = null;
      }
    }
    return asHistory({ kind: 'M3U-Playlist', tracks, lists: [{ name: name.replace(/\.[^.]+$/, ''), refs: tracks.map((_, i) => i) }] }, name);
  }

  function csvExport(tracks, keyMode) {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const tr = s => typeof I18n === 'undefined' ? s : I18n.t(s);
    const rows = [['Titel', 'Artist', 'Album', 'Genre', 'Jahr', 'BPM', 'Tonart', 'Dauer (s)', 'Bewertung', 'Tags', 'Kommentar', 'Datei'].map(tr).map(q).join(';')];
    for (const t of tracks) rows.push([t.title, t.artist, t.album, t.genre, t.year || '', t.bpm || '', Keys.show(t.key, keyMode), Math.round(t.duration || 0), t.rating || 0, (t.tags || []).join(', '), t.comment, t.path].map(q).join(';'));
    return '﻿' + rows.join('\r\n') + '\r\n';
  }

  /* ---------- VirtualDJ (database.xml, .vdjfolder) ---------- */
  const winPath = p => /^[A-Za-z]:\//.test(p) ? p.replace(/\//g, '\\') : p;

  function vdjExport(tracks, abs) {
    const out = ['<?xml version="1.0" encoding="UTF-8"?>', '<VirtualDJ_Database Version="8.5">'];
    for (const t of tracks) {
      const spb = t.bpm ? (60 / t.bpm).toFixed(6) : '', key = Keys.musical(t.key);
      out.push(` <Song FilePath="${attr(winPath(abs(t).replace(/\\/g, '/')))}" FileSize="${t.size || 0}">`,
        `  <Tags Author="${attr(t.artist)}" Title="${attr(t.title)}" Genre="${attr(t.genre)}" Album="${attr(t.album)}"${t.year ? ` Year="${t.year}"` : ''}${spb ? ` Bpm="${spb}"` : ''}${key ? ` Key="${attr(key)}"` : ''}${t.rating ? ` Stars="${t.rating}"` : ''} Flag="1"/>`,
        `  <Infos SongLength="${(t.duration || 0).toFixed(3)}" FirstSeen="${Math.round((t.added || Date.now()) / 1000)}" PlayCount="${t.playCount || 0}"/>`);
      if (t.comment) out.push(`  <Comment>${attr(t.comment)}</Comment>`);
      if (spb) out.push(`  <Scan Version="801" Bpm="${spb}"${key ? ` Key="${attr(key)}"` : ''}/>`, `  <Poi Pos="${(t.gridStart || 0).toFixed(6)}" Type="beatgrid"/>`);
      for (const c of t.cues || []) out.push(`  <Poi Name="${attr(c.name || (c.n >= 0 ? 'Cue ' + (c.n + 1) : 'Cue'))}" Pos="${c.t.toFixed(6)}"${c.n >= 0 ? ` Num="${c.n + 1}"` : ''} Type="cue"/>`);
      out.push(' </Song>');
    }
    out.push('</VirtualDJ_Database>');
    return out.join('\r\n') + '\r\n';
  }

  /* Vorhandene VirtualDJ-Datenbank ergänzen statt ersetzen: fremde Einträge und Angaben bleiben stehen */
  function vdjMerge(existing, tracks, abs) {
    if (!existing || !/<VirtualDJ_Database/.test(existing)) return vdjExport(tracks, abs);
    const fresh = parseXml(vdjExport(tracks, abs)), doc = parseXml(existing), root = doc.documentElement, byPath = new Map();
    for (const s of doc.querySelectorAll('Song')) byPath.set((s.getAttribute('FilePath') || '').toLowerCase(), s);
    for (const n of fresh.querySelectorAll('Song')) {
      const old = byPath.get(n.getAttribute('FilePath').toLowerCase());
      if (!old) { root.appendChild(doc.importNode(n, true)); continue; }
      const nt = n.querySelector('Tags');
      let ot = old.querySelector('Tags');
      if (!ot) { ot = doc.createElement('Tags'); old.insertBefore(ot, old.firstChild); }
      for (const a of nt.attributes) if (a.value !== '' && a.name !== 'Flag') ot.setAttribute(a.name, a.value);
      const nc = n.querySelector('Comment'), oc = old.querySelector('Comment');
      if (nc) { if (oc) oc.remove(); old.appendChild(doc.importNode(nc, true)); }
      const cues = [...n.querySelectorAll('Poi')].filter(p => p.getAttribute('Type') === 'cue');
      if (!cues.length) continue; // ohne eigene Cues bleiben die in VirtualDJ gesetzten stehen
      for (const p of [...old.querySelectorAll('Poi')]) if ((p.getAttribute('Type') || 'cue') === 'cue') p.remove();
      for (const p of cues) old.appendChild(doc.importNode(p, true));
    }
    return new XMLSerializer().serializeToString(doc);
  }

  function vdjImport(doc) {
    const tracks = [];
    for (const e of doc.querySelectorAll('Song')) {
      const path = (e.getAttribute('FilePath') || '').replace(/\\/g, '/');
      if (!path) continue;
      const tags = e.querySelector('Tags'), infos = e.querySelector('Infos'), scan = e.querySelector('Scan'), com = e.querySelector('Comment');
      const g = (el, n) => (el && el.getAttribute(n)) || '';
      const raw = +g(tags, 'Bpm') || +g(scan, 'Bpm') || 0; // Sekunden pro Beat
      const fb = Tags.fromName(path.split('/').pop());
      const t = { title: g(tags, 'Title') || fb.title, artist: g(tags, 'Author') || (g(tags, 'Title') ? '' : fb.artist), album: g(tags, 'Album'), genre: g(tags, 'Genre'), year: +g(tags, 'Year') || 0,
        bpm: raw ? Math.round((raw < 5 ? 60 / raw : raw) * 100) / 100 : 0, key: Keys.parse(g(tags, 'Key') || g(scan, 'Key')), duration: +g(infos, 'SongLength') || 0,
        rating: Math.min(5, +g(tags, 'Stars') || 0), comment: com ? com.textContent.trim() : '', playCount: +g(infos, 'PlayCount') || 0, path, size: +e.getAttribute('FileSize') || 0, gridStart: 0, cues: [] };
      const seen = +g(infos, 'FirstSeen');
      if (seen) t.added = seen * 1000;
      for (const p of e.querySelectorAll('Poi')) {
        const type = p.getAttribute('Type') || 'cue', pos = +p.getAttribute('Pos') || 0, n = (+p.getAttribute('Num') || 0) - 1;
        if (type === 'beatgrid') t.gridStart = pos;
        else if (type === 'cue') addCue(t, n, pos, p.getAttribute('Name'));
      }
      if (t.bpm && t.gridStart) t.gridStart = Math.round((t.gridStart % (60 / t.bpm)) * 1000) / 1000;
      tracks.push(t);
    }
    return { kind: 'VirtualDJ-Datenbank', full: true, tracks, lists: [] };
  }

  function vdjFolderImport(doc, name) {
    const tracks = [...doc.querySelectorAll('song')].map(e => (e.getAttribute('path') || '').replace(/\\/g, '/')).filter(Boolean)
      .map(path => ({ ...Tags.fromName(path.split('/').pop()), path, size: 0, cues: [] }));
    return { kind: 'VirtualDJ-Liste', tracks, lists: [{ name: name.replace(/\.[^.]+$/, ''), refs: tracks.map((_, i) => i) }] };
  }

  /* ---------- Serato (database V2, .crate) ----------
     Aufbau: Folge von Blöcken aus 4 Zeichen Kennung, 4 Byte Länge (Big Endian), Inhalt.
     Texte sind UTF-16 BE; Pfade stehen relativ zum Laufwerk, ohne führenden Schrägstrich. */
  const be32 = (u8, o) => ((u8[o] << 24) | (u8[o + 1] << 16) | (u8[o + 2] << 8) | u8[o + 3]) >>> 0;
  const utf16 = s => { const u = new Uint8Array(s.length * 2); for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); u[i * 2] = c >> 8; u[i * 2 + 1] = c & 255; } return u; };
  const unUtf16 = u8 => new TextDecoder('utf-16be').decode(u8).replace(/\0+$/, '');
  const concat = parts => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
  const block = (tag, body) => { const h = new Uint8Array(8); for (let i = 0; i < 4; i++) h[i] = tag.charCodeAt(i); new DataView(h.buffer).setUint32(4, body.length); return concat([h, body]); };
  function* blocks(u8) {
    let o = 0;
    while (o + 8 <= u8.length) {
      const len = be32(u8, o + 4);
      yield [String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]), u8.subarray(o + 8, Math.min(u8.length, o + 8 + len))];
      o += 8 + len;
    }
  }
  const seratoIn = p => { p = p.replace(/\\/g, '/'); return /^([A-Za-z]:|\/)/.test(p) ? p : '/' + p; };
  const seratoOut = p => p.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '').replace(/^\/Volumes\/[^/]+/, '').replace(/^\/+/, '');

  function seratoImport(u8, name) {
    const first = blocks(u8).next().value;
    const version = first && first[0] === 'vrsn' ? unUtf16(first[1]) : '';
    const isCrate = /crate/i.test(version) || /\.crate$/i.test(name);
    const tracks = [];
    for (const [tag, body] of blocks(u8)) {
      if (tag !== 'otrk') continue;
      const f = {};
      for (const [k, v] of blocks(body)) f[k] = k[0] === 'u' ? be32(v, 0) : k[0] === 't' || k[0] === 'p' ? unUtf16(v) : v;
      const raw = isCrate ? f.ptrk : f.pfil;
      if (!raw) continue;
      const path = seratoIn(raw), fb = Tags.fromName(path.split('/').pop());
      if (isCrate) { tracks.push({ ...fb, path, size: 0, cues: [] }); continue; }
      const len = /^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/.exec(f.tlen || '');
      const t = { title: f.tsng || fb.title, artist: f.tart || (f.tsng ? '' : fb.artist), album: f.talb || '', genre: f.tgen || '', comment: f.tcom || '',
        year: +(/\d{4}/.exec(f.ttyr || '') || [0])[0], bpm: Math.round((parseFloat(f.tbpm) || 0) * 100) / 100, key: Keys.parse(f.tkey),
        duration: len ? (+len[1] || 0) * 3600 + +len[2] * 60 + +len[3] : 0, path, size: 0, cues: [], gridStart: 0 };
      const added = f.uadd || +f.tadd || 0;
      if (added) t.added = added * 1000;
      tracks.push(t);
    }
    if (!isCrate) return { kind: 'Serato-Datenbank', full: true, tracks, lists: [] };
    return { kind: 'Serato-Crate', tracks, lists: [{ name: name.replace(/\.crate$/i, '').replace(/%%/g, ' / '), refs: tracks.map((_, i) => i) }] };
  }

  /* Verlaufsdatei (_Serato_/History/Sessions/*.session): je gespieltem Titel ein Eintrag mit nummerierten Feldern (2 = Pfad, 28 = Startzeit).
     Aufbau nach der frei verfügbaren Formatbeschreibung; nicht mit Serato gegengeprüft. */
  function seratoSession(u8, name) {
    const tracks = [];
    let first = 0;
    for (const [tag, body] of blocks(u8)) {
      if (tag !== 'oent') continue;
      for (const [k, adat] of blocks(body)) {
        if (k !== 'adat') continue;
        const f = {};
        for (let o = 0; o + 8 <= adat.length;) { const id = be32(adat, o), len = be32(adat, o + 4); f[id] = adat.subarray(o + 8, o + 8 + len); o += 8 + len; }
        if (!f[2]) continue;
        const path = seratoIn(unUtf16(f[2])), fb = Tags.fromName(path.split('/').pop());
        if (!first && f[28] && f[28].length >= 4) first = be32(f[28], 0) * 1000;
        tracks.push({ title: f[6] ? unUtf16(f[6]) : fb.title, artist: f[7] ? unUtf16(f[7]) : fb.artist, path, size: 0, cues: [] });
      }
    }
    const label = first ? new Date(first).toISOString().slice(0, 10) : name.replace(/\.session$/i, '');
    return { kind: 'Serato-Verlauf', played: first || 0, tracks, lists: [{ name: label, refs: tracks.map((_, i) => i) }] };
  }

  /* Eine .crate-Datei je Playlist; gehört in den Ordner _Serato_/Subcrates des Laufwerks. */
  function seratoExport(lists, byId, abs) {
    const used = new Set();
    return lists.map(l => {
      const parts = [block('vrsn', utf16('1.0/Serato ScratchLive Crate'))];
      for (const id of l.trackIds) { const t = byId.get(id); if (t) parts.push(block('otrk', block('ptrk', utf16(seratoOut(abs(t)))))); }
      let base = l.name.split(' / ').map(s => s.replace(/[\\/:*?"<>|%]+/g, '-').trim() || 'Crate').join('%%'), name = base;
      for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base} ${i}`;
      used.add(name.toLowerCase());
      return { name: `_Serato_/Subcrates/${name}.crate`, data: concat(parts) };
    });
  }

  /* ---------- ZIP (unkomprimiert) für Exporte aus mehreren Dateien ---------- */
  let crcTable;
  function crc32(u8) {
    if (!crcTable) { crcTable = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; } }
    let c = 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) c = crcTable[(c ^ u8[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(files) {
    const enc = new TextEncoder(), d = new Date(), local = [], central = [];
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), day = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(10, time, true); h.setUint16(12, day, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(12, time, true); c.setUint16(14, day, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      local.push(new Uint8Array(h.buffer), name, data);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cd = concat(central), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cd.length, true); end.setUint32(16, offset, true);
    return concat([...local, cd, new Uint8Array(end.buffer)]);
  }

  const safeName = s => s.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Playlist';

  function parse(text, name) {
    const head = text.slice(0, 2000);
    if (/<DJ_PLAYLISTS/.test(head)) return rekordboxImport(parseXml(text));
    if (/<NML/.test(head)) return traktorImport(parseXml(text));
    if (/<VirtualDJ_Database/.test(head)) return vdjImport(parseXml(text));
    if (/<VirtualFolder/.test(head)) return vdjFolderImport(parseXml(text), name);
    if (/\.m3u8?$/i.test(name) || head.startsWith('#EXTM3U')) return m3uImport(text, name);
    if (/^#\t/.test(head) || /\.txt$/i.test(name)) return rekordboxTxt(text, name);
    throw new Error(`„${name}“: Format nicht erkannt. Unterstützt: Rekordbox XML, Traktor NML, Serato (database V2, .crate), VirtualDJ (database.xml, .vdjfolder), M3U/M3U8, ONE-Backup (JSON).`);
  }

  async function parseFile(file) {
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (String.fromCharCode(...head) === 'vrsn') { const u8 = new Uint8Array(await file.arrayBuffer()); return /\.session$/i.test(file.name) ? seratoSession(u8, file.name) : seratoImport(u8, file.name); }
    if (head[0] === 0xFF && head[1] === 0xFE) return parse(new TextDecoder('utf-16le').decode(await file.arrayBuffer()), file.name); // rekordbox schreibt Textdateien in UTF-16
    return parse(await file.text(), file.name);
  }

  return { rekordboxExport, traktorExport, vdjExport, vdjMerge, seratoExport, m3uExport, csvExport, zip, safeName, parse, parseFile };
})();
