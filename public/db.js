// db.js — IndexedDB local + sync con backend SQLite
const DB_NAME = 'une_electrico', DB_VER = 3;
const API = location.origin + '/api';
let db = null;

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('readings')) d.createObjectStore('readings', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('equipment')) d.createObjectStore('equipment', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('config')) d.createObjectStore('config', { keyPath: 'key' });
      if (!d.objectStoreNames.contains('blackouts')) d.createObjectStore('blackouts', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('_pending')) d.createObjectStore('_pending', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => { db = e.target.result; res(db); };
    req.onerror = () => rej(req.error);
  });
}

function dbGetAll(store) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly'), s = tx.objectStore(store), r = s.getAll();
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}

function dbPut(store, data) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite'), s = tx.objectStore(store), r = s.put(data);
    r.onsuccess = () => res(); r.onerror = () => rej(r.error);
  });
}

function dbDelete(store, id) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite'), s = tx.objectStore(store), r = s.delete(id);
    r.onsuccess = () => res(); r.onerror = () => rej(r.error);
  });
}

function dbClear(store) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite'), s = tx.objectStore(store), r = s.clear();
    r.onsuccess = () => res(); r.onerror = () => rej(r.error);
  });
}

// --- Sync layer ---
async function queuePending(action) {
  await dbPut('_pending', { ...action, ts: Date.now() });
}

async function syncToServer() {
  try {
    // Push pending changes
    const pending = await dbGetAll('_pending');
    if (pending.length) {
      for (const p of pending) {
        const { id: _id, ts: _ts, ...action } = p;
        if (action.type === 'delete') {
          await fetch(`${API}/${action.store}/${action.itemId}`, { method: 'DELETE' });
        } else {
          await fetch(`${API}/${action.store}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action.data)
          });
        }
      }
      await dbClear('_pending');
    }

    // Pull full state from server
    const resp = await fetch(`${API}/sync`);
    if (!resp.ok) throw new Error('Sync failed');
    const remote = await resp.json();

    // Replace local stores with server data
    if (remote.readings) { await dbClear('readings'); for (const r of remote.readings) await dbPut('readings', r); }
    if (remote.equipment) { await dbClear('equipment'); for (const e of remote.equipment) await dbPut('equipment', e); }
    if (remote.blackouts) { await dbClear('blackouts'); for (const b of remote.blackouts) await dbPut('blackouts', b); }
    if (remote.config) { await dbClear('config'); for (const c of remote.config) await dbPut('config', { key: c.key, value: c.value }); }

    setSyncStatus('synced', 'Sincronizado ✓');
    return true;
  } catch (e) {
    setSyncStatus('error', 'Sin conexión al servidor');
    return false;
  }
}

function setSyncStatus(cls, text) {
  const el = document.getElementById('syncStatus');
  if (el) { el.className = 'sync-indicator ' + cls; el.textContent = text; }
}

// Wrapped operations that queue for sync
async function dbPutSync(store, data) {
  await dbPut(store, data);
  await queuePending({ type: 'upsert', store, data });
  syncToServer(); // fire and forget
}

async function dbDeleteSync(store, id) {
  await dbDelete(store, id);
  await queuePending({ type: 'delete', store, itemId: String(id) });
  syncToServer();
}

// Initial sync on load
async function initSync() {
  await syncToServer();
  // Re-sync every 60s
  setInterval(syncToServer, 60000);
  // Sync when coming back online
  window.addEventListener('online', syncToServer);
}
