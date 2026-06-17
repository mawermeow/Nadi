import type {
  LocalEntityBase,
  LocalStoreName,
  SyncStatus,
} from '@/lib/local-db/types';

const LOCAL_DB_NAME = 'nadi-local-db';
const LOCAL_DB_VERSION = 1;

let databasePromise: Promise<IDBDatabase> | null = null;

function assertBrowserIndexedDb() {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB 只可在瀏覽器環境使用');
  }
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function createStoreSchema(database: IDBDatabase) {
  const itemsStore = database.createObjectStore('items', { keyPath: 'id' });
  itemsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
  itemsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
  itemsStore.createIndex('deletedAt', 'deletedAt', { unique: false });
  itemsStore.createIndex('deviceId', 'deviceId', { unique: false });
  itemsStore.createIndex('version', 'version', { unique: false });

  const recordsStore = database.createObjectStore('records', { keyPath: 'id' });
  recordsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
  recordsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
  recordsStore.createIndex('deletedAt', 'deletedAt', { unique: false });
  recordsStore.createIndex('deviceId', 'deviceId', { unique: false });
  recordsStore.createIndex('version', 'version', { unique: false });
  recordsStore.createIndex('itemId', 'itemId', { unique: false });

  const syncOperationsStore = database.createObjectStore('syncOperations', {
    keyPath: 'id',
  });
  syncOperationsStore.createIndex('status', 'status', { unique: false });
  syncOperationsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
  syncOperationsStore.createIndex('entityType', 'entityType', { unique: false });
  syncOperationsStore.createIndex('entityId', 'entityId', { unique: false });
  syncOperationsStore.createIndex('updatedAt', 'updatedAt', { unique: false });

  const syncMetaStore = database.createObjectStore('syncMeta', { keyPath: 'id' });
  syncMetaStore.createIndex('key', 'key', { unique: true });
  syncMetaStore.createIndex('syncStatus', 'syncStatus', { unique: false });
  syncMetaStore.createIndex('updatedAt', 'updatedAt', { unique: false });
}

export async function getLocalDatabase() {
  assertBrowserIndexedDb();

  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains('items')) {
          createStoreSchema(database);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error('IndexedDB open failed'));
    });
  }

  return databasePromise;
}

export async function deleteLocalDatabase() {
  assertBrowserIndexedDb();

  if (databasePromise) {
    const database = await databasePromise;
    database.close();
    databasePromise = null;
  }

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(LOCAL_DB_NAME);

    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB delete failed'));
    request.onblocked = () =>
      reject(new Error('IndexedDB delete blocked'));
  });
}

export async function getAllFromStore<T>(storeName: LocalStoreName) {
  const database = await getLocalDatabase();
  const transaction = database.transaction(storeName, 'readonly');
  const store = transaction.objectStore(storeName);
  const result = await requestToPromise(store.getAll() as IDBRequest<T[]>);
  await transactionDone(transaction);
  return result;
}

export async function getByIdFromStore<T>(
  storeName: LocalStoreName,
  id: string,
) {
  const database = await getLocalDatabase();
  const transaction = database.transaction(storeName, 'readonly');
  const store = transaction.objectStore(storeName);
  const result = await requestToPromise(store.get(id) as IDBRequest<T | undefined>);
  await transactionDone(transaction);
  return result ?? null;
}

export async function upsertInStore<T>(storeName: LocalStoreName, value: T) {
  const database = await getLocalDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);
  await requestToPromise(store.put(value));
  await transactionDone(transaction);
  return value;
}

export async function deleteFromStore(storeName: LocalStoreName, id: string) {
  const database = await getLocalDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);
  await requestToPromise(store.delete(id));
  await transactionDone(transaction);
}

export async function updateStoreEntity<
  T extends LocalEntityBase & Record<string, unknown>,
>(
  storeName: LocalStoreName,
  id: string,
  updater: (current: T) => T,
) {
  const current = await getByIdFromStore<T>(storeName, id);

  if (!current) {
    return null;
  }

  const nextValue = updater(current);
  await upsertInStore(storeName, nextValue);
  return nextValue;
}

export async function listBySyncStatus<
  T extends { syncStatus: SyncStatus; userId?: string | null },
>(
  storeName: LocalStoreName,
  syncStatus: SyncStatus,
  userId?: string | null,
) {
  const values = await getAllFromStore<T>(storeName);
  return values.filter(
    (value) =>
      value.syncStatus === syncStatus &&
      (userId === undefined ||
        (userId === null ? value.userId == null : value.userId === userId)),
  );
}
