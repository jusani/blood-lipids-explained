// Local store (architect.md §5, §5.3, §5.4). IndexedDB only; health data is never
// put in cookies, Cache Storage or the URL. Panels are written only after the person
// chose "Keep on this phone"; otherwise they live in memory in the app state.

import { defaultSettings, emptyPlan, type Panel, type Plan, type Settings } from './model';

const DB_NAME = 'lipids';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      if (!db.objectStoreNames.contains('panels')) db.createObjectStore('panels', { keyPath: 'id' });
    };
    req.onsuccess = () => {
      const db = req.result;
      // Let deleteDatabase proceed if another tab deletes everything.
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        let result: T;
        if (req) req.onsuccess = () => { result = req.result; };
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export async function loadSettings(): Promise<Settings> {
  try {
    const s = await tx<Settings | undefined>('settings', 'readonly', (st) => st.get('settings'));
    return { ...defaultSettings, ...(s ?? {}) };
  } catch {
    return { ...defaultSettings };
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await tx('settings', 'readwrite', (st) => { st.put(s, 'settings'); });
}

/** Habits, check-ins and the re-test date: one record, saved only after consent to keep data. */
export async function loadPlan(): Promise<Plan> {
  try {
    const p = await tx<Plan | undefined>('settings', 'readonly', (st) => st.get('plan'));
    return { ...emptyPlan, ...(p ?? {}) };
  } catch {
    return { ...emptyPlan };
  }
}

export async function savePlan(p: Plan): Promise<void> {
  await tx('settings', 'readwrite', (st) => { st.put(p, 'plan'); });
}

export async function listPanels(): Promise<Panel[]> {
  try {
    const all = await tx<Panel[]>('panels', 'readonly', (st) => st.getAll());
    return (all ?? []).sort((a, b) => (b.testDate ?? b.enteredAt).localeCompare(a.testDate ?? a.enteredAt));
  } catch {
    return [];
  }
}

export async function savePanel(p: Panel): Promise<void> {
  await tx('panels', 'readwrite', (st) => { st.put(p); });
}

export async function savePanels(ps: Panel[]): Promise<void> {
  await tx('panels', 'readwrite', (st) => { for (const p of ps) st.put(p); });
}

export async function deletePanel(id: string): Promise<void> {
  await tx('panels', 'readwrite', (st) => { st.delete(id); });
}

export async function clearPanels(): Promise<void> {
  await tx('panels', 'readwrite', (st) => { st.clear(); });
}

/** "Delete all my data": every IndexedDB database, localStorage and sessionStorage. */
export async function deleteEverything(): Promise<void> {
  if (dbPromise) {
    try { (await dbPromise).close(); } catch { /* already closed */ }
    dbPromise = null;
  }
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
  try { localStorage.clear(); } catch { /* unavailable */ }
  try { sessionStorage.clear(); } catch { /* unavailable */ }
}

/** Ask the browser not to evict our data (architect §5.3 step 3). */
export async function requestPersist(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
