// Tynt lag over IndexedDB. Løfter løses først når transaksjonen er fullført,
// slik at et sett er trygt lagret idet kallet returnerer.

const DB_NAME = 'litt-hver-dag';
const DB_VERSION = 1;

export const KEY_PATHS = {
  settings: 'key',
  assessments: 'id',
  sessions: 'id',
  sets: 'id',
  exerciseState: 'exerciseId',
};

export const STORES = Object.keys(KEY_PATHS);

const INDEXES = {
  assessments: ['date'],
  sessions: ['date', 'status'],
  sets: ['sessionId', 'date', 'exerciseId'],
};

export const DEFAULT_SETTINGS = {
  defaultLength: 'medium',
  percentOfMax: 60,
};

let connection = null;

function open() {
  connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const [name, keyPath] of Object.entries(KEY_PATHS)) {
        const store = db.createObjectStore(name, { keyPath });
        for (const index of INDEXES[name] ?? []) store.createIndex(index, index);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      db.onclose = () => {
        connection = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      connection = null;
      reject(request.error);
    };
  });
  return connection;
}

// work gjør jobben i transaksjonen og returnerer en funksjon som henter resultatet etterpå.
function transactOnce(db, stores, mode, work) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(stores, mode);
    let readResult;
    try {
      readResult = work(transaction);
    } catch (error) {
      // Uten abort ville endringene som allerede var gjort, blitt lagret.
      transaction.abort();
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(readResult());
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function transact(stores, mode, work) {
  try {
    return await transactOnce(await open(), stores, mode, work);
  } catch (error) {
    // iOS kan lukke tilkoblingen mens appen ligger i bakgrunnen.
    if (error?.name !== 'InvalidStateError') throw error;
    connection = null;
    return transactOnce(await open(), stores, mode, work);
  }
}

function run(store, mode, operation) {
  return transact(store, mode, (transaction) => {
    const request = operation(transaction.objectStore(store));
    return () => request.result;
  });
}

export const get = (store, key) => run(store, 'readonly', (s) => s.get(key));
export const getAll = (store) => run(store, 'readonly', (s) => s.getAll());
export const getAllByIndex = (store, index, value) =>
  run(store, 'readonly', (s) => s.index(index).getAll(value));
export const put = (store, value) => run(store, 'readwrite', (s) => s.put(value));
export const remove = (store, key) => run(store, 'readwrite', (s) => s.delete(key));

export async function getSettings() {
  const rows = await getAll('settings');
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map((row) => [row.key, row.value])) };
}

export const setSetting = (key, value) => put('settings', { key, value });

/** Gjør flere endringer i én transaksjon: enten lagres alt, eller ingenting. */
export function writeChanges({ puts = {}, deletes = {}, clears = [] }) {
  const stores = [...new Set([...Object.keys(puts), ...Object.keys(deletes), ...clears])];
  return transact(stores, 'readwrite', (transaction) => {
    for (const name of clears) transaction.objectStore(name).clear();
    for (const [name, keys] of Object.entries(deletes)) {
      for (const key of keys) transaction.objectStore(name).delete(key);
    }
    for (const [name, rows] of Object.entries(puts)) {
      for (const row of rows) transaction.objectStore(name).put(row);
    }
    return () => undefined;
  });
}

export const putMany = (rowsByStore) => writeChanges({ puts: rowsByStore });

export function readAllStores() {
  return transact(STORES, 'readonly', (transaction) => {
    const requests = STORES.map((name) => [name, transaction.objectStore(name).getAll()]);
    return () => Object.fromEntries(requests.map(([name, request]) => [name, request.result]));
  });
}

/** Bytter ut alt innhold i én transaksjon: enten lykkes alt, eller så endres ingenting. */
export function replaceAllStores(data) {
  return transact(STORES, 'readwrite', (transaction) => {
    for (const name of STORES) {
      const store = transaction.objectStore(name);
      store.clear();
      for (const row of data[name]) store.put(row);
    }
    return () => undefined;
  });
}
