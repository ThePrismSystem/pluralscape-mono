/** Wraps an IDBRequest into a Promise. */
export function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      reject(new Error(req.error?.message ?? "IDBRequest failed"));
    };
  });
}

/** Opens an IndexedDB database, running `onUpgrade` during version upgrades. */
export function openIdb(
  name: string,
  version: number,
  onUpgrade: (db: IDBDatabase) => void,
): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = () => {
      onUpgrade(req.result);
    };
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      reject(new Error(req.error?.message ?? "Failed to open IndexedDB"));
    };
  });
}
