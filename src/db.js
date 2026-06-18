const DB_NAME = 'invoicemate-local';
const DB_VERSION = 1;
const STORES = ['settings', 'clients', 'invoices', 'meta'];

let dbPromise;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function withStore(storeName, mode, callback) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = callback(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  }));
}

export function get(storeName, id) {
  return withStore(storeName, 'readonly', (store) => store.get(id));
}

export function getAll(storeName) {
  return withStore(storeName, 'readonly', (store) => store.getAll());
}

export function put(storeName, value) {
  return withStore(storeName, 'readwrite', (store) => store.put(value));
}

export function remove(storeName, id) {
  return withStore(storeName, 'readwrite', (store) => store.delete(id));
}

export async function clearStore(storeName) {
  return withStore(storeName, 'readwrite', (store) => store.clear());
}

export async function clearAll() {
  for (const store of STORES) {
    await clearStore(store);
  }
}

export async function exportAll() {
  const result = {};
  for (const store of STORES) {
    result[store] = await getAll(store);
  }
  return {
    app: 'InvoiceMate Local',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: result
  };
}

export async function importAll(backup) {
  if (!backup?.data) throw new Error('Invalid backup file.');

  for (const store of STORES) {
    if (!Array.isArray(backup.data[store])) continue;
    await clearStore(store);
    for (const item of backup.data[store]) {
      await put(store, item);
    }
  }
}
