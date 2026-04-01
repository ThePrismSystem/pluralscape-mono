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
