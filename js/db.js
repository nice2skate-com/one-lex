'use strict';
/* Lokale Datenhaltung (IndexedDB). Alles bleibt auf diesem Rechner. */
const DB = (() => {
  let db;
  const STORES = ['tracks', 'lists', 'waves', 'handles', 'meta', 'covers', 'backups'];

  function open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('one-library', 2);
      r.onupgradeneeded = () => {
        const d = r.result, have = d.objectStoreNames;
        if (!have.contains('tracks')) d.createObjectStore('tracks', { keyPath: 'id' });
        if (!have.contains('lists')) d.createObjectStore('lists', { keyPath: 'id' });
        for (const s of ['waves', 'handles', 'meta', 'covers', 'backups']) if (!have.contains(s)) d.createObjectStore(s);
      };
      r.onsuccess = () => { db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  }

  function run(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => res(req ? req.result : undefined);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }

  const all = store => run(store, 'readonly', s => s.getAll());
  const get = (store, key) => run(store, 'readonly', s => s.get(key));
  const put = (store, val, key) => run(store, 'readwrite', s => key === undefined ? s.put(val) : s.put(val, key));
  const del = (store, key) => run(store, 'readwrite', s => s.delete(key));
  const clear = store => run(store, 'readwrite', s => s.clear());
  const putMany = (store, vals) => run(store, 'readwrite', s => { for (const v of vals) s.put(v); });
  const delMany = (store, keys) => run(store, 'readwrite', s => { for (const k of keys) s.delete(k); });

  /* Schlüssel + Werte eines Stores ohne keyPath (waves, handles) */
  function entries(store) {
    return new Promise((res, rej) => {
      const out = [];
      const t = db.transaction(store, 'readonly');
      t.objectStore(store).openCursor().onsuccess = e => {
        const c = e.target.result;
        if (c) { out.push([c.key, c.value]); c.continue(); }
      };
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
    });
  }

  return { open, all, get, put, del, clear, putMany, delMany, entries, STORES };
})();
