'use strict';
/* Metadaten aus Audiodateien lesen: ID3v2 (MP3/AIFF/WAV), Vorbis-Kommentare (FLAC), MP4-Atome (M4A/AAC). */
const Tags = (() => {
  const AUDIO_EXT = /\.(mp3|m4a|aac|mp4|flac|wav|aiff?|ogg|opus)$/i;
  const isAudio = name => AUDIO_EXT.test(name);
  const bytes = async (file, a, b) => new Uint8Array(await file.slice(a, b).arrayBuffer());
  const ascii = (u8, a, n) => String.fromCharCode(...u8.subarray(a, a + n));
  const be32 = (u8, o) => ((u8[o] << 24) | (u8[o + 1] << 16) | (u8[o + 2] << 8) | u8[o + 3]) >>> 0;
  const le32 = (u8, o) => (u8[o] | (u8[o + 1] << 8) | (u8[o + 2] << 16) | (u8[o + 3] << 24)) >>> 0;
  const synch = (u8, o) => ((u8[o] & 127) << 21) | ((u8[o + 1] & 127) << 14) | ((u8[o + 2] & 127) << 7) | (u8[o + 3] & 127);
  const clean = s => s.replace(/\0+/g, ' ').trim();

  function id3Text(u8) {
    if (!u8.length) return '';
    const enc = u8[0], body = u8.subarray(1);
    const label = enc === 0 ? 'latin1' : enc === 1 ? 'utf-16' : enc === 2 ? 'utf-16be' : 'utf-8';
    try { return new TextDecoder(label).decode(body); } catch { return ''; }
  }

  const imgMime = d => d[0] === 0x89 && d[1] === 0x50 ? 'image/png' : 'image/jpeg';
  function id3Pic(d, v2) {
    const enc = d[0];
    let p = v2 ? 4 : d.indexOf(0, 1) + 1;
    if (p <= 0) return null;
    p++; // Bildtyp
    if (enc === 1 || enc === 2) { while (p + 1 < d.length && (d[p] || d[p + 1])) p += 2; p += 2; }
    else { while (p < d.length && d[p]) p++; p++; }
    return p < d.length ? { mime: imgMime(d.subarray(p)), data: d.slice(p) } : null;
  }

  function parseId3(u8, out) {
    const ver = u8[3], flags = u8[5], end = Math.min(u8.length, 10 + synch(u8, 6));
    let o = 10;
    if (flags & 0x40 && ver >= 3) o += ver === 4 ? synch(u8, o) : be32(u8, o) + 4;
    const v2 = ver === 2, idLen = v2 ? 3 : 4, hdr = v2 ? 6 : 10;
    const MAP = { TIT2: 'title', TPE1: 'artist', TALB: 'album', TCON: 'genre', TYER: 'year', TDRC: 'year', TBPM: 'bpm', TKEY: 'key', COMM: 'comment',
      TT2: 'title', TP1: 'artist', TAL: 'album', TCO: 'genre', TYE: 'year', TBP: 'bpm', TKE: 'key', COM: 'comment' };
    while (o + hdr <= end) {
      const id = ascii(u8, o, idLen);
      if (!/^[A-Z0-9]+$/.test(id)) break;
      const size = v2 ? (u8[o + 3] << 16) | (u8[o + 4] << 8) | u8[o + 5] : ver === 4 ? synch(u8, o + 4) : be32(u8, o + 4);
      const data = u8.subarray(o + hdr, Math.min(end, o + hdr + size));
      o += hdr + size;
      if ((id === 'APIC' || id === 'PIC') && !out.picture && size > 16) { out.picture = id3Pic(data, v2); continue; }
      const f = MAP[id];
      if (!f || !size) continue;
      if (f === 'comment') {
        // Kodierung, 3 Byte Sprache, Kurzbeschreibung\0, Text
        const enc = new Uint8Array(data.length - 3);
        enc[0] = data[0]; enc.set(data.subarray(4), 1);
        const parts = id3Text(enc).split('\0').map(s => s.trim()).filter(Boolean);
        if (parts.length && !out.comment) out.comment = parts[parts.length - 1];
      } else {
        const v = clean(id3Text(data));
        if (v && !out[f]) out[f] = v;
      }
    }
  }

  async function readId3(file, head, out, base = 0) {
    const size = Math.min(10 + synch(head, 6), 12 << 20);
    parseId3(await bytes(file, base, base + size), out);
  }

  async function readFlac(file, out) {
    let o = 4;
    for (let i = 0; i < 64; i++) {
      const h = await bytes(file, o, o + 4);
      if (h.length < 4) return;
      const type = h[0] & 127, len = (h[1] << 16) | (h[2] << 8) | h[3];
      if (type === 4) {
        const b = await bytes(file, o + 4, o + 4 + len);
        let p = 4 + le32(b, 0);
        const n = le32(b, p); p += 4;
        const MAP = { TITLE: 'title', ARTIST: 'artist', ALBUM: 'album', GENRE: 'genre', DATE: 'year', YEAR: 'year', BPM: 'bpm', TBPM: 'bpm', KEY: 'key', INITIALKEY: 'key', COMMENT: 'comment', DESCRIPTION: 'comment' };
        const td = new TextDecoder();
        for (let k = 0; k < n && p + 4 <= b.length; k++) {
          const l = le32(b, p); p += 4;
          const s = td.decode(b.subarray(p, p + l)); p += l;
          const eq = s.indexOf('=');
          const f = MAP[s.slice(0, eq).toUpperCase()];
          if (f && !out[f]) out[f] = s.slice(eq + 1).trim();
        }
      } else if (type === 6 && !out.picture && len < (12 << 20)) {
        const b = await bytes(file, o + 4, o + 4 + len);
        let p = 4;
        p += 4 + be32(b, p); // MIME-Typ
        p += 4 + be32(b, p); // Beschreibung
        p += 16;
        const n = be32(b, p);
        if (n && p + 4 + n <= b.length) out.picture = { mime: imgMime(b.subarray(p + 4)), data: b.slice(p + 4, p + 4 + n) };
      }
      if (h[0] & 128) return;
      o += 4 + len;
    }
  }

  async function readMp4(file, out) {
    let o = 0, moov = null;
    while (o + 8 <= file.size) {
      const h = await bytes(file, o, o + 16);
      let size = be32(h, 0);
      const type = ascii(h, 4, 4);
      if (size === 1) size = be32(h, 8) * 4294967296 + be32(h, 12);
      if (size < 8) break;
      if (type === 'moov') { moov = await bytes(file, o + 8, o + Math.min(size, 16 << 20)); break; }
      o += size;
    }
    if (!moov) return;
    const find = (u8, name, skip = 0) => {
      let p = skip;
      while (p + 8 <= u8.length) {
        const size = be32(u8, p);
        if (size < 8) return null;
        if (ascii(u8, p + 4, 4) === name) return u8.subarray(p + 8, p + size);
        p += size;
      }
      return null;
    };
    const udta = find(moov, 'udta'); if (!udta) return;
    const meta = find(udta, 'meta'); if (!meta) return;
    const ilst = find(meta, 'ilst', 4); if (!ilst) return;
    const MAP = { '\xa9nam': 'title', '\xa9ART': 'artist', '\xa9alb': 'album', '\xa9gen': 'genre', '\xa9day': 'year', '\xa9cmt': 'comment', tmpo: 'bpm' };
    const td = new TextDecoder();
    let p = 0;
    while (p + 8 <= ilst.length) {
      const size = be32(ilst, p);
      if (size < 8) break;
      const name = ascii(ilst, p + 4, 4), f = MAP[name];
      if (name === 'covr' && !out.picture) {
        const data = find(ilst.subarray(p + 8, p + size), 'data');
        if (data && data.length > 24) out.picture = { mime: imgMime(data.subarray(8)), data: data.slice(8) };
      }
      if (f) {
        const data = find(ilst.subarray(p + 8, p + size), 'data');
        if (data && data.length > 8) {
          const v = data.subarray(8);
          out[f] = name === 'tmpo' ? String((v[0] << 8) | v[1]) : td.decode(v).trim();
        }
      }
      p += size;
    }
  }

  /* RIFF/AIFF: ID3-Chunk suchen */
  async function readChunked(file, out, little) {
    let o = 12;
    for (let i = 0; i < 200 && o + 8 <= file.size; i++) {
      const h = await bytes(file, o, o + 8);
      const id = ascii(h, 0, 4), size = little ? le32(h, 4) : be32(h, 4);
      if (/^id3 $/i.test(id)) {
        const head = await bytes(file, o + 8, o + 18);
        if (ascii(head, 0, 3) === 'ID3') await readId3(file, head, out, o + 8);
        return;
      }
      o += 8 + size + (size & 1);
    }
  }

  function fromName(name) {
    const base = name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').replace(/^\d{1,3}[\s.\-]+(?=\S)/, '');
    const m = base.match(/^(.+?)\s+[-–]\s+(.+)$/);
    return m ? { artist: m[1].trim(), title: m[2].trim() } : { artist: '', title: base.trim() };
  }

  async function read(file) {
    const out = {};
    try {
      const head = await bytes(file, 0, 12);
      const sig = ascii(head, 0, 4);
      if (sig.startsWith('ID3')) await readId3(file, head, out);
      else if (sig === 'fLaC') await readFlac(file, out);
      else if (ascii(head, 4, 4) === 'ftyp') await readMp4(file, out);
      else if (sig === 'RIFF') await readChunked(file, out, true);
      else if (sig === 'FORM') await readChunked(file, out, false);
    } catch (e) { /* defekte Tags: Dateiname genügt */ }
    const fb = fromName(file.name);
    if (!out.title) { out.title = fb.title; if (!out.artist) out.artist = fb.artist; }
    if (out.genre) out.genre = out.genre.replace(/^\(\d+\)(?=.)/, '');
    const y = /\d{4}/.exec(out.year || ''); out.year = y ? +y[0] : 0;
    const b = parseFloat(String(out.bpm || '').replace(',', '.')); out.bpm = b > 20 && b < 400 ? Math.round(b * 100) / 100 : 0;
    return out;
  }

  function duration(file) {
    return new Promise(res => {
      const a = new Audio(), url = URL.createObjectURL(file);
      const done = v => { URL.revokeObjectURL(url); a.removeAttribute('src'); res(v); };
      const timer = setTimeout(() => done(0), 8000);
      a.preload = 'metadata';
      a.onloadedmetadata = () => { clearTimeout(timer); done(isFinite(a.duration) ? a.duration : 0); };
      a.onerror = () => { clearTimeout(timer); done(0); };
      a.src = url;
    });
  }

  return { read, duration, isAudio, fromName };
})();
