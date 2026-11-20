'use strict';
/* Metadaten in Audiodateien zurückschreiben: ID3v2.3/2.4 (MP3, WAV, AIFF), Vorbis-Kommentare (FLAC), MP4-Atome (M4A).
   Unbekannte Inhalte (Cover, Daten anderer Programme) bleiben erhalten. Im Zweifel wird abgebrochen statt geschrieben. */
const TagWrite = (() => {
  const supported = name => /\.(mp3|flac|m4a|mp4|wav|aiff?)$/i.test(name);
  const synch = (u8, o) => ((u8[o] & 127) << 21) | ((u8[o + 1] & 127) << 14) | ((u8[o + 2] & 127) << 7) | (u8[o + 3] & 127);
  const be32 = (u8, o) => ((u8[o] << 24) | (u8[o + 1] << 16) | (u8[o + 2] << 8) | u8[o + 3]) >>> 0;
  const le32 = (u8, o) => (u8[o] | (u8[o + 1] << 8) | (u8[o + 2] << 16) | (u8[o + 3] << 24)) >>> 0;
  const ascii = (u8, a, n) => String.fromCharCode(...u8.subarray(a, a + n));
  const concat = parts => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
  const utf8 = s => new TextEncoder().encode(s);
  const bytes = async (file, a, b) => new Uint8Array(await file.slice(a, b).arrayBuffer());

  /* Werte, wie sie in die Datei gehören */
  function values(t) {
    return { title: t.title || '', artist: t.artist || '', album: t.album || '', genre: t.genre || '', year: t.year ? String(t.year) : '',
      bpm: t.bpm ? String(Math.round(t.bpm * 100) / 100) : '', key: Keys.musical(t.key), comment: t.comment || '' };
  }

  /* ---------- MP3 / ID3v2 ---------- */
  function id3Text(str, v4) {
    if (v4) return concat([Uint8Array.of(3), utf8(str)]);
    if (/^[\x00-\xff]*$/.test(str)) return concat([Uint8Array.of(0), Uint8Array.from(str, c => c.charCodeAt(0))]);
    const u = new Uint8Array(3 + str.length * 2);
    u[0] = 1; u[1] = 0xFF; u[2] = 0xFE; // UTF-16 mit BOM (Little Endian)
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); u[3 + i * 2] = c & 255; u[4 + i * 2] = c >> 8; }
    return u;
  }
  function frame(id, body, v4) {
    const h = new Uint8Array(10), n = body.length;
    for (let i = 0; i < 4; i++) h[i] = id.charCodeAt(i);
    if (v4) { h[4] = (n >> 21) & 127; h[5] = (n >> 14) & 127; h[6] = (n >> 7) & 127; h[7] = n & 127; }
    else new DataView(h.buffer).setUint32(4, n);
    return concat([h, body]);
  }
  /* COMM ohne Kurzbeschreibung ist der eigentliche Kommentar; andere (z. B. Lautheitsdaten) bleiben stehen */
  function plainComment(d) {
    if (d.length < 5) return true;
    const enc = d[0];
    if (enc === 1) return d.length >= 8 ? d[6] === 0 && d[7] === 0 : true;
    if (enc === 2) return d[4] === 0 && d[5] === 0;
    return d[4] === 0;
  }

  /* Baut einen vollständigen ID3v2-Tag. old: vorhandener Tag samt Kopf (oder null); dessen übrige Inhalte bleiben erhalten. */
  function id3Tag(old, t) {
    let v4 = false;
    const kept = [];
    if (old && old.length >= 10 && ascii(old, 0, 3) === 'ID3') {
      const ver = old[3], flags = old[5];
      if (ver !== 3 && ver !== 4) throw new Error('altes Tag-Format (ID3v2.2)');
      if (flags & 0xD0) throw new Error('Tag-Variante wird nicht unterstützt');
      v4 = ver === 4;
      const tag = old.subarray(10, Math.min(old.length, 10 + synch(old, 6)));
      const replace = new Set(['TIT2', 'TPE1', 'TALB', 'TCON', 'TBPM', 'TKEY', 'TYER', 'TDRC']);
      let o = 0;
      while (o + 10 <= tag.length && tag[o] !== 0) {
        const id = ascii(tag, o, 4);
        if (!/^[A-Z0-9]{4}$/.test(id)) throw new Error('Tag ist beschädigt');
        const n = v4 ? synch(tag, o + 4) : be32(tag, o + 4);
        if (o + 10 + n > tag.length) throw new Error('Tag ist beschädigt');
        if (tag[o + 9] !== 0) throw new Error('Tag-Variante wird nicht unterstützt');
        const body = tag.subarray(o + 10, o + 10 + n);
        if (!replace.has(id) && !(id === 'COMM' && plainComment(body))) kept.push(tag.subarray(o, o + 10 + n));
        o += 10 + n;
      }
    }
    const v = values(t), fresh = [];
    const add = (id, val) => { if (val) fresh.push(frame(id, id3Text(val, v4), v4)); };
    add('TIT2', v.title); add('TPE1', v.artist); add('TALB', v.album); add('TCON', v.genre); add(v4 ? 'TDRC' : 'TYER', v.year); add('TBPM', v.bpm); add('TKEY', v.key);
    if (v.comment) {
      const txt = id3Text(v.comment, v4);
      const sep = txt[0] === 1 ? Uint8Array.of(0xFF, 0xFE, 0, 0) : Uint8Array.of(0);
      fresh.push(frame('COMM', concat([txt.subarray(0, 1), utf8('deu'), sep, txt.subarray(1)]), v4));
    }
    const frames = concat([...fresh, ...kept]), size = frames.length + 1024;
    const h = Uint8Array.of(0x49, 0x44, 0x33, v4 ? 4 : 3, 0, 0, (size >> 21) & 127, (size >> 14) & 127, (size >> 7) & 127, size & 127);
    return concat([h, frames, new Uint8Array(1024)]);
  }

  async function buildMp3(file, t) {
    const head = await bytes(file, 0, 10);
    const audioStart = ascii(head, 0, 3) === 'ID3' ? 10 + synch(head, 6) : 0;
    return concat([id3Tag(audioStart ? await bytes(file, 0, audioStart) : null, t), await bytes(file, audioStart, file.size)]);
  }

  /* ---------- WAV / AIFF: ID3-Tag als eigener Abschnitt am Dateiende ---------- */
  async function buildChunked(file, t, little) {
    const u8 = await bytes(file, 0, file.size);
    const sig = ascii(u8, 0, 4);
    if (sig !== (little ? 'RIFF' : 'FORM')) throw new Error(sig === 'RF64' ? 'sehr große WAV-Dateien (RF64) werden nicht unterstützt' : 'unerwarteter Dateianfang');
    const rd = o => little ? le32(u8, o) : be32(u8, o);
    const parts = [u8.subarray(0, 12)];
    let o = 12, old = null;
    while (o + 8 <= u8.length) {
      const id = ascii(u8, o, 4), n = rd(o + 4), end = Math.min(u8.length, o + 8 + n + (n & 1));
      if (/^id3 $/i.test(id)) { if (!old) old = u8.subarray(o + 8, o + 8 + n); }
      else parts.push(u8.subarray(o, end), end - o < 8 + n + (n & 1) ? new Uint8Array(8 + n + (n & 1) - (end - o)) : new Uint8Array(0));
      o += 8 + n + (n & 1);
    }
    const tag = id3Tag(old, t), ch = new Uint8Array(8), dv = new DataView(ch.buffer);
    (little ? 'id3 ' : 'ID3 ').split('').forEach((c, i) => { ch[i] = c.charCodeAt(0); });
    dv.setUint32(4, tag.length, little);
    parts.push(ch, tag, new Uint8Array(tag.length & 1));
    const out = concat(parts);
    new DataView(out.buffer).setUint32(4, out.length - 8, little);
    return out;
  }

  /* ---------- M4A / MP4 ---------- */
  const lat = s => Uint8Array.from(s, c => c.charCodeAt(0));
  const atom = (type, ...parts) => { const body = concat(parts), h = new Uint8Array(8); new DataView(h.buffer).setUint32(0, body.length + 8); h.set(lat(type), 4); return concat([h, body]); };
  function kids(u8, from = 0) {
    const out = [];
    let o = from;
    while (o + 8 <= u8.length) {
      const size = be32(u8, o);
      if (size < 8 || o + size > u8.length) throw new Error('Datei ist beschädigt');
      out.push({ type: ascii(u8, o + 4, 4), raw: u8.subarray(o, o + size), body: u8.subarray(o + 8, o + size) });
      o += size;
    }
    return out;
  }
  async function buildM4a(file, t) {
    const u8 = await bytes(file, 0, file.size);
    if (ascii(u8, 4, 4) !== 'ftyp') throw new Error('unerwarteter Dateianfang');
    // oberste Ebene: moov finden, Lage der Audiodaten merken
    let o = 0, moov = null, dataAfter = false;
    while (o + 8 <= u8.length) {
      let size = be32(u8, o);
      const type = ascii(u8, o + 4, 4);
      if (size === 1) size = be32(u8, o + 8) * 4294967296 + be32(u8, o + 12);
      else if (size === 0) size = u8.length - o;
      if (size < 8) throw new Error('Datei ist beschädigt');
      if (type === 'moof') throw new Error('fragmentierte MP4-Dateien werden nicht unterstützt');
      if (type === 'moov') { if (be32(u8, o) === 1) throw new Error('Datei ist beschädigt'); moov = { start: o, end: o + size }; }
      else if (type === 'mdat' && moov) dataAfter = true;
      o += size;
    }
    if (!moov) throw new Error('keine Titelinformationen in der Datei');
    const v = values(t);
    const text = (name, val) => atom(name, atom('data', Uint8Array.of(0, 0, 0, 1, 0, 0, 0, 0), utf8(val)));
    const NAMES = ['\xa9nam', '\xa9ART', '\xa9alb', '\xa9gen', 'gnre', '\xa9day', 'tmpo', '\xa9cmt'];
    const isKey = it => it.type === '----' && kids(it.body).some(k => k.type === 'name' && /^initialkey$/i.test(new TextDecoder().decode(k.body.subarray(4))));
    const mk = kids(u8.subarray(moov.start + 8, moov.end));
    const udta = mk.find(k => k.type === 'udta'), uk = udta ? kids(udta.body) : [];
    const meta = uk.find(k => k.type === 'meta'), mek = meta ? kids(meta.body, 4) : [];
    const ilst = mek.find(k => k.type === 'ilst');
    const items = (ilst ? kids(ilst.body) : []).filter(it => !NAMES.includes(it.type) && !isKey(it)).map(it => it.raw);
    if (v.title) items.push(text('\xa9nam', v.title));
    if (v.artist) items.push(text('\xa9ART', v.artist));
    if (v.album) items.push(text('\xa9alb', v.album));
    if (v.genre) items.push(text('\xa9gen', v.genre));
    if (v.year) items.push(text('\xa9day', v.year));
    if (v.comment) items.push(text('\xa9cmt', v.comment));
    if (t.bpm) { const b = Math.round(t.bpm); items.push(atom('tmpo', atom('data', Uint8Array.of(0, 0, 0, 21, 0, 0, 0, 0, b >> 8, b & 255)))); }
    if (v.key) items.push(atom('----', atom('mean', new Uint8Array(4), lat('com.apple.iTunes')), atom('name', new Uint8Array(4), lat('initialkey')), atom('data', Uint8Array.of(0, 0, 0, 1, 0, 0, 0, 0), utf8(v.key))));
    const hdlr = mek.find(k => k.type === 'hdlr');
    const newMeta = atom('meta', meta ? meta.body.subarray(0, 4) : new Uint8Array(4),
      hdlr ? hdlr.raw : atom('hdlr', new Uint8Array(8), lat('mdirappl'), new Uint8Array(9)),
      ...mek.filter(k => !['hdlr', 'ilst', 'free'].includes(k.type)).map(k => k.raw), atom('ilst', ...items));
    const newUdta = atom('udta', ...uk.filter(k => k.type !== 'meta').map(k => k.raw), newMeta);
    const newMoov = atom('moov', ...mk.filter(k => k.type !== 'udta').map(k => k.raw), newUdta);
    const delta = newMoov.length - (moov.end - moov.start);
    if (dataAfter && delta) { // Audiodaten rücken: Verweise darauf anpassen
      const dv = new DataView(newMoov.buffer, newMoov.byteOffset, newMoov.length);
      const walk = (start, end, path) => {
        let p = start;
        while (p + 8 <= end) {
          const size = dv.getUint32(p), type = ascii(newMoov, p + 4, 4);
          if (size < 8) break;
          if (['trak', 'mdia', 'minf', 'stbl'].includes(type)) walk(p + 8, p + size);
          else if (type === 'stco') { const n = dv.getUint32(p + 12); for (let i = 0; i < n; i++) { const q = p + 16 + i * 4, off = dv.getUint32(q); if (off >= moov.end) dv.setUint32(q, off + delta); } }
          else if (type === 'co64') { const n = dv.getUint32(p + 12); for (let i = 0; i < n; i++) { const q = p + 16 + i * 8, off = dv.getUint32(q) * 4294967296 + dv.getUint32(q + 4); if (off >= moov.end) { const nv = off + delta; dv.setUint32(q, Math.floor(nv / 4294967296)); dv.setUint32(q + 4, nv >>> 0); } } }
          p += size;
        }
      };
      walk(8, newMoov.length);
    }
    return concat([u8.subarray(0, moov.start), newMoov, u8.subarray(moov.end)]);
  }

  /* ---------- FLAC / Vorbis-Kommentare ---------- */
  async function buildFlac(file, t) {
    const u8 = await bytes(file, 0, file.size);
    if (ascii(u8, 0, 4) !== 'fLaC') throw new Error('unerwarteter Dateianfang');
    const blocks = [];
    let o = 4, last = false;
    while (!last) {
      if (o + 4 > u8.length) throw new Error('Datei ist beschädigt');
      last = !!(u8[o] & 128);
      const type = u8[o] & 127, len = (u8[o + 1] << 16) | (u8[o + 2] << 8) | u8[o + 3];
      if (o + 4 + len > u8.length) throw new Error('Datei ist beschädigt');
      blocks.push({ type, body: u8.subarray(o + 4, o + 4 + len) });
      o += 4 + len;
    }
    if (!blocks.length || blocks[0].type !== 0) throw new Error('Datei ist beschädigt');
    const DROP = new Set(['TITLE', 'ARTIST', 'ALBUM', 'GENRE', 'DATE', 'YEAR', 'BPM', 'TBPM', 'KEY', 'INITIALKEY', 'COMMENT', 'DESCRIPTION']);
    let vendor = utf8('ONE Library');
    const comments = [];
    const old = blocks.find(b => b.type === 4);
    if (old) {
      const b = old.body, vl = le32(b, 0);
      vendor = b.subarray(4, 4 + vl);
      let p = 4 + vl;
      const n = le32(b, p); p += 4;
      for (let i = 0; i < n && p + 4 <= b.length; i++) {
        const l = le32(b, p), c = b.subarray(p + 4, p + 4 + l);
        p += 4 + l;
        const s = new TextDecoder().decode(c), eq = s.indexOf('=');
        if (eq < 1 || !DROP.has(s.slice(0, eq).toUpperCase())) comments.push(c);
      }
    }
    const v = values(t);
    for (const [k, val] of [['TITLE', v.title], ['ARTIST', v.artist], ['ALBUM', v.album], ['GENRE', v.genre], ['DATE', v.year], ['BPM', v.bpm], ['INITIALKEY', v.key], ['COMMENT', v.comment]]) if (val) comments.push(utf8(k + '=' + val));
    const u32 = n => { const x = new Uint8Array(4); new DataView(x.buffer).setUint32(0, n, true); return x; };
    const body = concat([u32(vendor.length), vendor, u32(comments.length), ...comments.flatMap(c => [u32(c.length), c])]);
    if (body.length > 0xFFFFFF) throw new Error('Kommentarblock zu groß');
    const next = blocks.filter(b => b.type !== 1 && b.type !== 4);
    next.splice(1, 0, { type: 4, body });
    next.push({ type: 1, body: new Uint8Array(1024) });
    const parts = [u8.subarray(0, 4)];
    next.forEach((b, i) => parts.push(Uint8Array.of((i === next.length - 1 ? 128 : 0) | b.type, b.body.length >> 16, (b.body.length >> 8) & 255, b.body.length & 255), b.body));
    parts.push(u8.subarray(o));
    return concat(parts);
  }

  /* Liefert den vollständigen neuen Dateiinhalt (Uint8Array). */
  function build(file, t) {
    if (/\.mp3$/i.test(file.name)) return buildMp3(file, t);
    if (/\.flac$/i.test(file.name)) return buildFlac(file, t);
    if (/\.(m4a|mp4)$/i.test(file.name)) return buildM4a(file, t);
    if (/\.wav$/i.test(file.name)) return buildChunked(file, t, true);
    if (/\.aiff?$/i.test(file.name)) return buildChunked(file, t, false);
    throw new Error('Dateityp wird nicht unterstützt');
  }

  return { supported, build };
})();
