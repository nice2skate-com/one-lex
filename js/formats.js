'use strict';
/* Tonart-Schreibweisen und Austauschformate (Rekordbox XML, Traktor NML, M3U8, CSV). */
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
      for (const c of t.cues || []) out.push(`      <POSITION_MARK Name="${attr(c.name)}" Type="0" Start="${c.t.toFixed(3)}" Num="${c.n}"/>`);
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
      for (const c of e.querySelectorAll('POSITION_MARK')) {
        const n = +c.getAttribute('Num');
        if (n >= 0 && n < 8 && !t.cues.some(x => x.n === n)) t.cues.push({ n, t: +c.getAttribute('Start') || 0, name: c.getAttribute('Name') || '' });
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
    return { kind: 'Rekordbox XML', tracks, lists };
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
      for (const c of t.cues || []) out.push(`      <CUE_V2 NAME="${attr(c.name || 'Cue ' + (c.n + 1))}" DISPL_ORDER="0" TYPE="0" START="${(c.t * 1000).toFixed(6)}" LEN="0.000000" REPEATS="-1" HOTCUE="${c.n}"/>`);
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
        playCount: +g(info, 'PLAYCOUNT') || 0, path: (/^[A-Za-z]:$/.test(vol) ? vol : '') + dir.replace(/\/:/g, '/') + file, size: 0, gridStart: 0, cues: [] };
      for (const c of e.querySelectorAll('CUE_V2')) {
        const type = c.getAttribute('TYPE'), n = +c.getAttribute('HOTCUE'), start = (+c.getAttribute('START') || 0) / 1000;
        if (type === '4') t.gridStart = start;
        else if (n >= 0 && n < 8 && !t.cues.some(x => x.n === n)) t.cues.push({ n, t: start, name: c.getAttribute('NAME') || '' });
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
    return { kind: 'Traktor NML', tracks, lists };
  }

  /* ---------- M3U8 / CSV ---------- */
  function m3uExport(tracks, abs) {
    const out = ['#EXTM3U'];
    for (const t of tracks) out.push(`#EXTINF:${Math.round(t.duration || 0)},${t.artist ? t.artist + ' - ' : ''}${t.title}`, abs(t));
    return out.join('\n') + '\n';
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
    return { kind: 'M3U-Playlist', tracks, lists: [{ name: name.replace(/\.[^.]+$/, ''), refs: tracks.map((_, i) => i) }] };
  }

  function csvExport(tracks, keyMode) {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [['Titel', 'Artist', 'Album', 'Genre', 'Jahr', 'BPM', 'Tonart', 'Dauer (s)', 'Bewertung', 'Tags', 'Kommentar', 'Datei'].map(q).join(';')];
    for (const t of tracks) rows.push([t.title, t.artist, t.album, t.genre, t.year || '', t.bpm || '', Keys.show(t.key, keyMode), Math.round(t.duration || 0), t.rating || 0, (t.tags || []).join(', '), t.comment, t.path].map(q).join(';'));
    return '﻿' + rows.join('\r\n') + '\r\n';
  }

  function parse(text, name) {
    const head = text.slice(0, 2000);
    if (/<DJ_PLAYLISTS/.test(head)) return rekordboxImport(parseXml(text));
    if (/<NML/.test(head)) return traktorImport(parseXml(text));
    if (/\.m3u8?$/i.test(name) || head.startsWith('#EXTM3U')) return m3uImport(text, name);
    throw new Error('Format nicht erkannt. Unterstützt: Rekordbox XML, Traktor NML, M3U/M3U8, ONE-Backup (JSON).');
  }

  return { rekordboxExport, traktorExport, m3uExport, csvExport, parse };
})();
