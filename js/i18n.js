'use strict';
/* Sprachumschaltung. Die Oberfläche ist auf Deutsch geschrieben; für andere Sprachen werden die Texte beim Einfügen in die Seite übersetzt.
   Eine Sprache ist eine Datei in js/lang/ mit festen Texten (exact) und Mustern für Texte mit Zahlen oder Namen (patterns).
   Eigene Inhalte – Titel, Artists, Playlist-Namen, Tags, Pfade – werden nie übersetzt (siehe SKIP). */
const I18n = (() => {
  const packs = {};
  let lang = 'de';
  try { lang = localStorage.getItem('one-lang') || ((navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en'); } catch { /* ohne Speicher: Deutsch */ }
  const SKIP = '.tr, .dt, .da, .dm, .fold, .tag, code, datalist, textarea, script, style, [data-raw], .raw, .ctime, #dtime, .si[data-view="list"] .grow, .si[data-view="tag"] .grow';
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  const done = new WeakMap(), attrDone = new WeakMap(), miss = new Set();

  function t(s) {
    const p = packs[lang];
    if (!p || !s) return s;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), key = m[2].replace(/\s+/g, ' ');
    if (!/[A-Za-zÄÖÜäöüß]/.test(key)) return s;
    if (Object.prototype.hasOwnProperty.call(p.exact, key)) return m[1] + p.exact[key] + m[3];
    for (const [re, to] of p.patterns) if (re.test(key)) return m[1] + key.replace(re, to) + m[3];
    if (!p.same || !p.same.has(key)) miss.add(key);
    return s;
  }
  function attrs(el) {
    let seen = attrDone.get(el);
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (!v || (seen && seen[a] === v)) continue;
      const out = t(v);
      if (out !== v) el.setAttribute(a, out);
      if (!seen) attrDone.set(el, seen = {});
      seen[a] = out;
    }
  }
  function walk(n) {
    if (n.nodeType === 3) {
      const par = n.parentElement;
      if (!par || par.closest(SKIP) || done.get(n) === n.nodeValue) return;
      const out = t(n.nodeValue);
      if (out !== n.nodeValue) n.nodeValue = out;
      done.set(n, out);
    } else if (n.nodeType === 1) {
      if (n.matches(SKIP)) return;
      attrs(n);
      for (const c of n.childNodes) walk(c);
    }
  }
  function start() {
    if (!packs[lang]) { lang = 'de'; return; }
    document.documentElement.lang = lang;
    document.title = t(document.title);
    walk(document.body);
    new MutationObserver(list => {
      for (const m of list) {
        if (m.type === 'childList') { for (const n of m.addedNodes) if (!(m.target.nodeType === 1 && m.target.closest(SKIP))) walk(n); }
        else if (m.type === 'characterData') walk(m.target);
        else if (!m.target.closest(SKIP)) attrs(m.target);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  return {
    add: (code, pack) => { packs[code] = pack; }, start, t, miss,
    get lang() { return packs[lang] ? lang : 'de'; },
    get locale() { return (packs[lang] && packs[lang].locale) || 'de-DE'; },
    langs: () => [['de', 'Deutsch'], ...Object.entries(packs).map(([c, p]) => [c, p.name])],
    set(code) { try { localStorage.setItem('one-lang', code); } catch { /* nicht speicherbar */ } location.reload(); }
  };
})();
